#!/usr/bin/env python3
"""
用 Gemini 为 glossary 中「待补充」或题目 related_terms 中缺失的词条批量生成释义，
合并回 glossary.json。支持断点续跑、限流重试。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/fill_glossary.py
  python3 scripts/fill_glossary.py --limit 30
  python3 scripts/fill_glossary.py --resume
  python3 scripts/fill_glossary.py --only-stubs   # 只补「（待补充）」条目，不补缺失
"""
import json
import os
import re
import sys
import time
from pathlib import Path

RETRY_MAX = 4
RETRY_WAIT_SEC = [60, 120, 180, 300]
BATCH_SIZE = 15
BASE_SLEEP_SEC = 1.5

try:
    import google.generativeai as genai
except ImportError:
    print("请先安装: pip install google-generativeai")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
GLOSSARY_PATH = REPO_ROOT / "public" / "data" / "glossary.json"
PROGRESS_FILE = REPO_ROOT / "public" / "data" / ".fill_glossary_progress.json"


def get_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("请设置环境变量 GEMINI_API_KEY")
        sys.exit(1)
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.0-flash-lite")


def get_terms_to_fill(only_stubs: bool) -> list[str]:
    """需要补充的词条：glossary 里「（待补充）」或题目 related_terms 中缺失的。"""
    with open(GLOSSARY_PATH, "r", encoding="utf-8") as f:
        glossary = json.load(f)
    stub_terms = [k for k, v in glossary.items() if (v.get("definition") or "").strip() == "（待补充）"]

    if only_stubs:
        return sorted(stub_terms)

    terms_in_questions = set()
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)
    for q in questions:
        for t in q.get("related_terms") or []:
            terms_in_questions.add(t)
    missing = sorted(terms_in_questions - set(glossary.keys()))
    # 合并：先补 stubs，再补 missing，去重且保持顺序
    seen = set()
    out = []
    for t in stub_terms + missing:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def build_prompt(terms: list[str]) -> str:
    terms_blob = "\n".join(terms)
    return f"""你是一位 AWS SAA 认证备考助手。为下面每一个术语写一条简短的百科条目（中文），用于备考 App 的术语解释。

要求：
1. 输出「仅」一个 JSON 对象，不要其他文字。键必须是下面列出的术语（一字不差），值是一个对象，包含：
   - "definition": 一两句中文解释（产品名、服务名保留英文，如 Amazon S3、Lambda）
   - "analogy": 一句生活化类比，帮助记忆；若无合适类比则填空字符串 ""
   - "features": 字符串数组，2～4 个要点，如 ["要点1", "要点2"]
2. 所有内容用简体中文，专业但简洁。术语本身（键）保持与下列完全一致（包括大小写、空格）。

术语列表（每行一个）：
{terms_blob}

直接输出 JSON 对象，不要用 markdown 代码块包裹。"""


def parse_batch_response(text: str, terms: list[str]) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        obj = json.loads(text)
        if not isinstance(obj, dict):
            return None
        result = {}
        for t in terms:
            v = obj.get(t)
            if not isinstance(v, dict):
                continue
            definition = (v.get("definition") or "").strip()
            if not definition:
                continue
            analogy = (v.get("analogy") or "").strip()
            features = v.get("features")
            if not isinstance(features, list):
                features = []
            features = [str(x).strip() for x in features if x]
            result[t] = {"definition": definition, "analogy": analogy, "features": features}
        return result if result else None
    except (json.JSONDecodeError, TypeError):
        return None


def load_progress() -> list[str]:
    """返回已处理过的 term 列表。glossary 以 GLOSSARY_PATH 为准（每批都会写回）。"""
    if not PROGRESS_FILE.exists():
        return []
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return data.get("done_terms", [])
    except Exception:
        return []


def save_progress(done_terms: list[str]):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(
        json.dumps({"done_terms": done_terms}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def fill_batch(model, terms: list[str]) -> dict:
    """对一批术语调用 API，返回 term -> { definition, analogy, features }。"""
    prompt = build_prompt(terms)
    for attempt in range(RETRY_MAX + 1):
        try:
            response = model.generate_content(prompt)
            text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            parsed = parse_batch_response(text, terms)
            if parsed:
                return parsed
            print(f"  [WARN] 本批 {len(terms)} 条解析异常，重试...")
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_rate_limit and attempt < RETRY_MAX:
                wait = RETRY_WAIT_SEC[attempt]
                print(f"  [429/限流] {wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                time.sleep(wait)
            else:
                print(f"  [ERROR] 本批: {e}")
                return {}
    return {}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fill glossary missing/stub entries with Gemini")
    parser.add_argument("--resume", action="store_true", help="从上次进度继续")
    parser.add_argument("--limit", type=int, default=0, help="最多处理 N 条（0=全部）")
    parser.add_argument("--only-stubs", action="store_true", help="只补「（待补充）」条目，不补题目中缺失的词条")
    args = parser.parse_args()

    if not GLOSSARY_PATH.exists():
        print(f"glossary 不存在: {GLOSSARY_PATH}")
        sys.exit(1)
    if not args.only_stubs and not QUESTIONS_PATH.exists():
        print(f"题目文件不存在: {QUESTIONS_PATH}")
        sys.exit(1)

    terms_to_fill = get_terms_to_fill(args.only_stubs)
    if not terms_to_fill:
        print("没有需要补充的词条。")
        return

    if args.limit > 0:
        terms_to_fill = terms_to_fill[: args.limit]
    print(f"待补充词条数: {len(terms_to_fill)}")

    with open(GLOSSARY_PATH, "r", encoding="utf-8") as f:
        glossary_snapshot = json.load(f)
    done_terms = load_progress() if args.resume else []
    if args.resume and done_terms:
        terms_to_fill = [t for t in terms_to_fill if t not in done_terms]
        if not terms_to_fill:
            print("进度已是最新，无需再补。")
            return
        print(f"续跑：剩余 {len(terms_to_fill)} 条")

    model = get_model()
    total_batches = (len(terms_to_fill) + BATCH_SIZE - 1) // BATCH_SIZE
    for start in range(0, len(terms_to_fill), BATCH_SIZE):
        batch = terms_to_fill[start : start + BATCH_SIZE]
        batch_no = start // BATCH_SIZE + 1
        print(f"  [{batch_no}/{total_batches}] 处理 {len(batch)} 条: {batch[0]} ... {batch[-1]}")
        filled = fill_batch(model, batch)
        for t, entry in filled.items():
            glossary_snapshot[t] = entry
            done_terms.append(t)
        save_progress(done_terms)
        # 写回 glossary.json，便于中断后已有结果不丢
        GLOSSARY_PATH.write_text(json.dumps(glossary_snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"      已合并 {len(filled)} 条到 glossary.json")
        time.sleep(BASE_SLEEP_SEC)

    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
    print(f"完成。共补充 {len(done_terms)} 条，已写入: {GLOSSARY_PATH}")


if __name__ == "__main__":
    main()
