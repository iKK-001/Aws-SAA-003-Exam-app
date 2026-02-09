#!/usr/bin/env python3
"""
对多选题（best_answer 为两字母及以上）用 Gemini 重新生成解析，
使 why_correct 明确说明全部正确选项为何正确，why_wrong 说明其余选项为何错误。
需先完成 sync_multi_choice_from_raw.py 或 fix_multiple_choice_answers.py 使 best_answer 为多字母。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/re_explain_multiple_choice.py
  python3 scripts/re_explain_multiple_choice.py --limit 5
  python3 scripts/re_explain_multiple_choice.py --dry-run   # 只列出将处理的题，不调用 API
  python3 scripts/re_explain_multiple_choice.py --ids 73,92,94   # 只处理指定题号
  python3 scripts/re_explain_multiple_choice.py --retry-failed   # 只重试上次失败日志中的题
解析失败时 API 原始响应会追加到 public/data/.re_explain_fail_log.txt，便于分析原因。
"""
import json
import os
import re
import sys
import time
from pathlib import Path

RETRY_MAX = 3
RETRY_WAIT = [30, 60, 120]
BASE_SLEEP = 1.5

try:
    import google.generativeai as genai
except ImportError:
    print("请先安装: pip install google-generativeai")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
FAIL_LOG = REPO_ROOT / "public" / "data" / ".re_explain_fail_log.txt"


def get_best_answer_letters(item: dict) -> list[str]:
    a = item.get("best_answer")
    if a is None or a == "":
        return []
    if isinstance(a, list):
        return [str(x).strip().upper() for x in a]
    s = str(a).strip().upper()
    if len(s) > 1:
        return sorted(s)
    return [s]


def build_prompt(q: dict, correct_letters: list[str]) -> str:
    q_cn = q.get("question_cn", "")
    opts = q.get("options_cn") or {}
    opts_str = "\n".join(f"{k}. {v}" for k, v in sorted(opts.items()))
    correct_str = "、".join(correct_letters)
    wrong_opts = [k for k in sorted(opts.keys()) if k not in correct_letters]
    wrong_str = "、".join(wrong_opts) if wrong_opts else "其余选项"
    return f"""本题为多选题，正确选项为：{correct_str}。错误选项为：{wrong_str}。

请根据题干与选项，输出一个 JSON 对象（仅此对象，无其他文字）：
1. explanation：对象，包含三键（均简体中文，技术术语保留英文）。
   - analysis：用 1～2 句话概括考查点。
   - why_correct：详细说明「选项 {correct_str}」为何都正确：分别或综合说明适用场景、与题目条件的对应、关键特性；明确写出两个正确选项各自或共同满足题目的原因。约 3～5 句。
   - why_wrong：详细说明选项 {wrong_str} 为何错误：逐项或分组写不适用原因、与题目需求的矛盾。严禁在 why_wrong 里批评正确选项 {correct_str}。约 2～4 句。
2. related_terms：题干/选项/解析中出现的 AWS 服务名、产品名数组，用英文。

题目（中文）：
{q_cn}

选项：
{opts_str}

输出 JSON 格式（仅此对象）：
{{"explanation": {{"analysis": "...", "why_correct": "...", "why_wrong": "..."}}, "related_terms": ["..."]}}"""


def parse_response(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "explanation" not in data:
            return None
        exp = data["explanation"]
        if not isinstance(exp, dict) or "why_correct" not in exp:
            return None
        if "analysis" not in exp:
            exp["analysis"] = ""
        if "why_wrong" not in exp:
            exp["why_wrong"] = ""
        return data
    except (json.JSONDecodeError, TypeError):
        return None


def _log_fail(qid: int, raw_text: str):
    """解析失败时追加到失败日志，便于分析原因。"""
    try:
        FAIL_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(FAIL_LOG, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\nid {qid}\n{'='*60}\n{(raw_text or '')[:4000]}\n")
    except Exception:
        pass


def main():
    import argparse
    parser = argparse.ArgumentParser(description="对多选题重新生成解析")
    parser.add_argument("--limit", type=int, default=0, help="只处理前 N 题（0=全部）")
    parser.add_argument("--dry-run", action="store_true", help="只列出将处理的题，不调用 API")
    parser.add_argument("--ids", type=str, default="", help="只处理指定题号，逗号分隔，如 --ids 73,92,94")
    parser.add_argument("--retry-failed", action="store_true", help="只重试上次运行失败日志中的题号")
    args = parser.parse_args()

    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)

    to_process = []
    for i, q in enumerate(questions):
        letters = get_best_answer_letters(q)
        if len(letters) >= 2:
            to_process.append({"index": i, "q": q, "letters": letters})

    filter_ids = set()
    if args.retry_failed and FAIL_LOG.exists():
        raw = FAIL_LOG.read_text(encoding="utf-8")
        for m in re.finditer(r"id\s+(\d+)", raw):
            filter_ids.add(int(m.group(1)))
        to_process = [t for t in to_process if t["q"].get("id") in filter_ids]
        print(f"从失败日志中读取到 {len(filter_ids)} 个题号，本次处理 {len(to_process)} 题")
    elif args.ids.strip():
        filter_ids = {int(x.strip()) for x in args.ids.split(",") if x.strip()}
        to_process = [t for t in to_process if t["q"].get("id") in filter_ids]
        print(f"按 --ids 过滤，本次处理 {len(to_process)} 题")

    if args.limit > 0:
        to_process = to_process[: args.limit]
    if not to_process:
        print("没有待处理的多选题（请先运行 sync_multi_choice_from_raw 或使用 --ids/--retry-failed）。")
        return

    print(f"待重新生成解析的多选题数: {len(to_process)}")
    if args.dry_run:
        for t in to_process[:15]:
            print(f"  id {t['q']['id']}: 正确选项 {''.join(t['letters'])}")
        if len(to_process) > 15:
            print(f"  ... 共 {len(to_process)} 题")
        return

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("请设置环境变量 GEMINI_API_KEY")
        sys.exit(1)
    genai.configure(api_key=api_key.strip())
    model = genai.GenerativeModel("gemini-2.0-flash-lite")

    updated = 0
    for idx, item in enumerate(to_process):
        i, q, letters = item["index"], item["q"], item["letters"]
        qid = q.get("id")
        prompt = build_prompt(q, letters)
        for attempt in range(RETRY_MAX + 1):
            try:
                resp = model.generate_content(prompt)
                text = resp.text if hasattr(resp, "text") else (resp.candidates[0].content.parts[0].text if resp.candidates else "")
                parsed = parse_response(text)
                if parsed:
                    exp = parsed["explanation"]
                    q["explanation"] = {
                        "analysis": exp.get("analysis", (q.get("explanation") or {}).get("analysis", "")),
                        "why_correct": exp.get("why_correct", ""),
                        "why_wrong": exp.get("why_wrong", ""),
                    }
                    if parsed.get("related_terms"):
                        q["related_terms"] = parsed["related_terms"]
                    updated += 1
                    print(f"  [{idx + 1}/{len(to_process)}] id {qid} 已更新解析")
                    break
                _log_fail(qid, text)
                print(f"  [{idx + 1}/{len(to_process)}] id {qid} 解析失败（原始响应已追加到 {FAIL_LOG.name}）")
            except Exception as e:
                err = str(e)
                if "429" in err or "Resource exhausted" in err:
                    wait = RETRY_WAIT[min(attempt, len(RETRY_WAIT) - 1)]
                    print(f"  id {qid} 限流，{wait}s 后重试")
                    time.sleep(wait)
                else:
                    print(f"  id {qid}: {e}")
                    break
        time.sleep(BASE_SLEEP)

    if updated > 0:
        with open(QUESTIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"已写回 {QUESTIONS_PATH}，共更新 {updated} 题解析")
    else:
        print("未更新任何题目。")


if __name__ == "__main__":
    main()
