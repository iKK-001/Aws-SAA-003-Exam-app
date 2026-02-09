#!/usr/bin/env python3
"""
阶段 3：为 questions_bilingual.json 补全 tags、explanation、related_terms。
调用 Gemini 生成考查点、解析、相关术语，输出 questions_bilingual_enriched.json。
每 15 题一批调用 API，遇 429 自动重试（60s→120s→180s→300s），批间间隔 1s。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/add_tags_and_explanation.py
  python3 scripts/add_tags_and_explanation.py --limit 5   # 试跑 5 题
  python3 scripts/add_tags_and_explanation.py --resume  # 从断点继续（每 50 题保存）
  python3 scripts/add_tags_and_explanation.py --fill-empty  # 全量跑完后，只补漏解析为空的题（逐题请求）
"""

import json
import os
import re
import sys
import time
from pathlib import Path

RETRY_MAX = 4
RETRY_WAIT_SEC = [60, 120, 180, 300]
BASE_SLEEP_SEC = 1.0
PROGRESS_SAVE_EVERY = 50
# 每批题数，减少 API 调用以降低 429
ENRICH_BATCH_SIZE = 15

USE_NEW_GENAI = False
try:
    from google import genai as genai_new
    USE_NEW_GENAI = True
except ImportError:
    try:
        import google.generativeai as genai_old
    except ImportError:
        print("请先安装: pip install google-genai  或  pip install google-generativeai")
        sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "public" / "data" / "questions_bilingual.json"
DEFAULT_OUTPUT = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"
PROGRESS_FILE = REPO_ROOT / "public" / "data" / ".enrich_progress.json"
DEBUG_PARSE_FAIL_LOG = REPO_ROOT / "public" / "data" / ".enrich_parse_fail_log.txt"
GLOSSARY_PATH = REPO_ROOT / "public" / "data" / "glossary.json"


def log_parse_fail(label: str, raw_text: str):
    """解析失败时把 API 原始响应写入调试文件，便于排查格式异常原因。"""
    try:
        DEBUG_PARSE_FAIL_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(DEBUG_PARSE_FAIL_LOG, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\n{label}\n{'='*60}\n{raw_text[:8000]}\n")
    except Exception:
        pass


def get_client_or_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("请设置环境变量 GEMINI_API_KEY")
        sys.exit(1)
    if USE_NEW_GENAI:
        return genai_new.Client(api_key=api_key.strip()), "new"
    genai_old.configure(api_key=api_key.strip())
    return genai_old.GenerativeModel("gemini-2.0-flash-lite"), "old"


def load_glossary_keys() -> set[str]:
    """加载 glossary 键，用于 related_terms 对齐。"""
    if not GLOSSARY_PATH.exists():
        return set()
    try:
        data = json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))
        return set(data.keys()) if isinstance(data, dict) else set()
    except Exception:
        return set()


def _correct_answer_letters(correct: str) -> set[str]:
    """将 correct_answer 规范为选项字母集合，支持单选 'A' 与多选 'CD'。"""
    if not correct:
        return set()
    letters = set()
    for c in (correct if isinstance(correct, str) else "").strip().upper():
        if c in "ABCDE":
            letters.add(c)
    return letters


def build_enrich_prompt(item: dict) -> str:
    """单题：根据题干、选项、正确答案，生成 tags、explanation、related_terms。多选时按字母拆 correct_answer，避免 wrong_opts 误含正确选项。"""
    q_cn = item.get("question_cn", "")
    opts_cn = item.get("options_cn") or {}
    opts_str = "\n".join(f"{k}. {v}" for k, v in sorted(opts_cn.items()))
    correct_raw = item.get("correct_answer", "")
    correct_set = _correct_answer_letters(correct_raw)
    if not correct_set and correct_raw:
        correct_set = {c for c in str(correct_raw).strip().upper() if c in "ABCDE"}
    correct_str = "、".join(sorted(correct_set)) if correct_set else (correct_raw or "")
    wrong_opts = [k for k in sorted(opts_cn.keys()) if k not in correct_set]
    wrong_list = "、".join(wrong_opts) if wrong_opts else "其余选项"
    return f"""你是一位 AWS SAA-C03 备考解析助手。根据以下题目与正确答案，输出 JSON（仅此 JSON，无其他文字）。

要求：
1. tags：考点/服务名数组，如 ["Amazon S3", "S3 Transfer Acceleration"]，用英文服务名。
2. explanation：对象，包含三键（均简体中文，技术术语保留英文）。解析请写详细，避免一两句带过；适当做知识点串联（如对比正确方案与错误方案、点出与其它 AWS 概念的关系）。
   - analysis：用 1～2 句话概括考查点，并点出与哪些相关知识有关（如「考查 X；与 Y、Z 的选型/对比相关」）。
   - why_correct：详细说明正确选项（本题为选项 {correct_str}）为何正确：适用场景、与题目条件的对应、关键特性或原理；可简要对比「为什么在这种场景下选它而不是其它方案」。不要写错误选项。约 2～4 句。
   - why_wrong：详细说明错误选项（本题为选项 {wrong_list}）为何错误：逐项或分组写不适用原因、与题目需求的矛盾、或与正确方案的对比。严禁在 why_wrong 里提及、批评或贬低正确选项 {correct_str}。约 2～4 句，可带知识点串联（如某选项为何在安全/可靠性上不足）。
3. related_terms：题干/选项/解析中出现的 AWS 服务名、产品名数组，用英文（如 Amazon S3, S3, Lambda, EC2, EBS），便于与词库对齐。

题目（中文）：
{q_cn}

选项：
{opts_str}

正确答案：{correct_str}（why_correct 只写选项 {correct_str} 为何对；why_wrong 只写选项 {wrong_list} 为何错，不要写选项 {correct_str}）

输出 JSON 格式（仅此对象）：
{{"tags": ["..."], "explanation": {{"analysis": "...", "why_correct": "...", "why_wrong": "..."}}, "related_terms": ["..."]}}"""


def build_enrich_batch_prompt(items: list[dict]) -> str:
    """多题一批的 prompt，要求返回 JSON 数组，顺序与输入一致。多选时按字母拆 correct_answer。"""
    n = len(items)
    parts = []
    for i, item in enumerate(items, 1):
        q_cn = item.get("question_cn", "")
        opts_cn = item.get("options_cn") or {}
        opts_str = "\n   ".join(f"{k}. {v}" for k, v in sorted(opts_cn.items()))
        correct_raw = item.get("correct_answer", "")
        correct_set = _correct_answer_letters(correct_raw)
        if not correct_set and correct_raw:
            correct_set = {c for c in str(correct_raw).strip().upper() if c in "ABCDE"}
        correct_str = "、".join(sorted(correct_set)) if correct_set else (correct_raw or "")
        wrong_opts = [k for k in sorted(opts_cn.keys()) if k not in correct_set]
        wrong_list = "、".join(wrong_opts) if wrong_opts else "其余选项"
        parts.append(
            f"--- 题目 {i} ---\n"
            f"题干: {q_cn}\n"
            f"选项:\n   {opts_str}\n"
            f"正确答案: {correct_str}（why_correct 只写选项 {correct_str} 为何对；why_wrong 只写选项 {wrong_list} 为何错，不要写选项 {correct_str}）"
        )
    body = "\n\n".join(parts)
    return f"""你是一位 AWS SAA-C03 备考解析助手。根据以下 {n} 道题目与各自正确答案，输出一个 JSON 数组（仅此数组，无其他文字）。数组必须恰好 {n} 个元素，顺序与题目 1～{n} 一一对应。

每道题的要求（与单题相同）：
1. tags：考点/服务名数组，用英文服务名。
2. explanation：对象，包含 analysis、why_correct、why_wrong（均简体中文，技术术语保留英文）。解析写详细，约 2～4 句；适当做知识点串联。why_wrong 只写错误选项为何错，严禁写正确选项的缺点。
3. related_terms：题干/选项/解析中出现的 AWS 服务名、产品名数组，用英文。

输入：

{body}

输出：JSON 数组，共 {n} 个元素，每个元素为 {{"tags": [...], "explanation": {{"analysis": "...", "why_correct": "...", "why_wrong": "..."}}, "related_terms": [...]}}。"""


def parse_enrich_response(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        data = json.loads(text)
        if not isinstance(data, dict):
            return None
        if "tags" not in data or "explanation" not in data or "related_terms" not in data:
            return None
        exp = data["explanation"]
        if not isinstance(exp, dict) or "analysis" not in exp or "why_correct" not in exp:
            return None
        if "why_wrong" not in exp:
            exp["why_wrong"] = ""
        if not isinstance(data["tags"], list):
            data["tags"] = []
        if not isinstance(data["related_terms"], list):
            data["related_terms"] = []
        return data
    except (json.JSONDecodeError, TypeError):
        return None


def _normalize_explanation(o: dict) -> dict | None:
    """将单题对象中的 explanation 规范为 { analysis, why_correct, why_wrong }；若模型把 explanation 当字符串、why_correct/why_wrong 放顶层则兼容。"""
    exp = o.get("explanation")
    if isinstance(exp, dict) and exp.get("analysis") and exp.get("why_correct"):
        if "why_wrong" not in exp:
            exp["why_wrong"] = ""
        return exp
    # 容错：explanation 为字符串，why_correct/why_wrong 在对象顶层（如题 92 的 API 返回）
    if isinstance(exp, str) and o.get("why_correct"):
        return {
            "analysis": (exp or "").strip(),
            "why_correct": (o.get("why_correct") or "").strip(),
            "why_wrong": (o.get("why_wrong") or "").strip(),
        }
    return None


def parse_enrich_batch_response(text: str, expected_len: int) -> list[dict] | None:
    """解析多题一批的 JSON 数组，长度须与 expected_len 一致。"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        arr = json.loads(text)
        if not isinstance(arr, list) or len(arr) != expected_len:
            return None
        out = []
        for i, o in enumerate(arr):
            if not isinstance(o, dict) or "tags" not in o or "related_terms" not in o:
                return None
            if "explanation" not in o and "why_correct" not in o:
                return None
            exp = _normalize_explanation(o)
            if exp is None:
                return None
            out.append({
                "tags": o.get("tags") if isinstance(o.get("tags"), list) else [],
                "explanation": exp,
                "related_terms": o.get("related_terms") if isinstance(o.get("related_terms"), list) else [],
            })
        return out
    except (json.JSONDecodeError, TypeError):
        return None


def load_progress() -> tuple[list, int]:
    if not PROGRESS_FILE.exists():
        return [], 0
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return data.get("items", []), data.get("last_index", 0)
    except Exception:
        return [], 0


def save_progress(items: list, last_index: int):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(
        json.dumps({"items": items, "last_index": last_index}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def has_enrichment(item: dict) -> bool:
    """是否已有 tags、explanation、related_terms。"""
    if not item.get("tags") or not item.get("related_terms"):
        return False
    exp = item.get("explanation")
    return isinstance(exp, dict) and exp.get("analysis") and exp.get("why_correct")


def align_related_terms(terms: list[str], glossary_keys: set[str]) -> list[str]:
    """尽量与 glossary 键对齐：优先保留在 glossary 中存在的术语。"""
    if not glossary_keys:
        return list(dict.fromkeys(terms))
    seen = set()
    out = []
    for t in terms:
        t = (t or "").strip()
        if not t or t in seen:
            continue
        if t in glossary_keys:
            seen.add(t)
            out.append(t)
    for t in terms:
        t = (t or "").strip()
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def enrich_one(client_or_model, sdk: str, item: dict, glossary_keys: set[str]) -> dict:
    """为单题调用 API 生成 tags、explanation、related_terms。"""
    qid = item.get("id", 0)
    for attempt in range(RETRY_MAX + 1):
        try:
            prompt = build_enrich_prompt(item)
            if sdk == "new":
                response = client_or_model.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=prompt,
                )
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            else:
                response = client_or_model.generate_content(prompt)
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            parsed = parse_enrich_response(text)
            if parsed:
                terms = align_related_terms(parsed["related_terms"], glossary_keys)
                return {
                    **item,
                    "tags": parsed["tags"],
                    "explanation": parsed["explanation"],
                    "related_terms": terms,
                }
            log_parse_fail(f"题 {qid}", text)
            print(f"  [WARN] 题 {qid} 解析格式异常，保留空（原始响应已写入 {DEBUG_PARSE_FAIL_LOG.name}）")
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_rate_limit and attempt < RETRY_MAX:
                wait = RETRY_WAIT_SEC[attempt]
                print(f"  [429/限流] 题 {qid}，{wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                time.sleep(wait)
            else:
                print(f"  [ERROR] 题 {qid}: {e}")
        break
    return {
        **item,
        "tags": [],
        "explanation": {"analysis": "", "why_correct": "", "why_wrong": ""},
        "related_terms": [],
    }


def enrich_batch(client_or_model, sdk: str, items: list[dict], glossary_keys: set[str]) -> list[dict]:
    """每批最多 ENRICH_BATCH_SIZE 题调用一次 API；失败或解析异常则逐题回退。"""
    n = len(items)
    prompt = build_enrich_batch_prompt(items)
    for attempt in range(RETRY_MAX + 1):
        try:
            if sdk == "new":
                response = client_or_model.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=prompt,
                )
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            else:
                response = client_or_model.generate_content(prompt)
                text = response.text if hasattr(response, "text") else (response.candidates[0].content.parts[0].text if response.candidates else "")
            parsed_list = parse_enrich_batch_response(text, n)
            if parsed_list:
                return [
                    {
                        **item,
                        "tags": p["tags"],
                        "explanation": p["explanation"],
                        "related_terms": align_related_terms(p["related_terms"], glossary_keys),
                    }
                    for item, p in zip(items, parsed_list)
                ]
            ids_str = ",".join(str(item.get("id", i)) for i, item in enumerate(items))
            log_parse_fail(f"本批 {n} 题 id={ids_str}", text)
            print(f"  [WARN] 本批 {n} 题解析格式异常，改为逐题请求（原始响应已写入 {DEBUG_PARSE_FAIL_LOG.name}）")
            return [enrich_one(client_or_model, sdk, item, glossary_keys) for item in items]
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "Resource exhausted" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_rate_limit and attempt < RETRY_MAX:
                wait = RETRY_WAIT_SEC[attempt]
                ids_str = ",".join(str(item.get("id", i)) for i, item in enumerate(items))
                print(f"  [429/限流] 本批题 {ids_str}，{wait} 秒后重试（第 {attempt + 1}/{RETRY_MAX} 次）")
                time.sleep(wait)
            else:
                print(f"  [ERROR] 本批 {n} 题: {e}，改为逐题请求")
                return [enrich_one(client_or_model, sdk, item, glossary_keys) for item in items]
    return [
        {**item, "tags": [], "explanation": {"analysis": "", "why_correct": "", "why_wrong": ""}, "related_terms": []}
        for item in items
    ]


def _run_fill_empty(client_or_model, sdk: str, output_path: Path, glossary_keys: set[str]):
    """只补漏解析为空的题：从 enriched 或进度中找出未成功的题，逐题重新请求。"""
    if PROGRESS_FILE.exists():
        done_items, last_index = load_progress()
        source = "进度"
    else:
        if not output_path.exists():
            print(f"未找到 {output_path}，无法 --fill-empty。请先跑完阶段 3 或 --resume。")
            return
        done_items = json.loads(output_path.read_text(encoding="utf-8"))
        if not isinstance(done_items, list):
            done_items = [done_items]
        last_index = len(done_items)
        source = "输出"
    empty_indices = [i for i in range(len(done_items)) if not has_enrichment(done_items[i])]
    if not empty_indices:
        print(f"当前 {source} 中无解析为空的题，无需补漏。")
        return
    print(f"从 {source} 中检出 {len(empty_indices)} 题需补漏（逐题请求），题号示例: {empty_indices[:15]}{'...' if len(empty_indices) > 15 else ''}")
    for idx in empty_indices:
        item = done_items[idx]
        qid = item.get("id", idx + 1)
        done_items[idx] = enrich_one(client_or_model, sdk, item, glossary_keys)
        time.sleep(BASE_SLEEP_SEC)
    if PROGRESS_FILE.exists():
        save_progress(done_items, last_index)
        print(f"已更新进度，共 {len(done_items)} 题，断点第 {last_index} 题。")
    else:
        output_path.write_text(json.dumps(done_items, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已写入: {output_path}，共 {len(done_items)} 题。")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="为题目补全 tags、explanation、related_terms")
    parser.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="输入 JSON（questions_bilingual.json）")
    parser.add_argument("output", nargs="?", default=str(DEFAULT_OUTPUT), help="输出 JSON（enriched）")
    parser.add_argument("--resume", action="store_true", help="从上次进度继续")
    parser.add_argument("--limit", type=int, default=0, help="最多处理题数（0=全部）")
    parser.add_argument("--fill-empty", action="store_true", help="只补漏解析为空的题（逐题请求，避免批解析失败）")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    if not input_path.exists():
        print(f"输入文件不存在: {input_path}")
        sys.exit(1)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client_or_model, sdk = get_client_or_model()
    print("使用: Gemini 2 Flash Lite")
    glossary_keys = load_glossary_keys()
    print(f"已加载 glossary 键数: {len(glossary_keys)}")

    if args.fill_empty:
        _run_fill_empty(client_or_model, sdk, output_path, glossary_keys)
        return

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raw = [raw]

    done_items, last_index = load_progress() if args.resume else ([], 0)
    if args.resume and done_items:
        print(f"从进度恢复: 已完成 {len(done_items)} 题，从第 {last_index + 1} 题继续")
    else:
        last_index = 0
        done_items = []

    end_index = len(raw) if args.limit <= 0 else min(last_index + args.limit, len(raw))

    print(f"每 {ENRICH_BATCH_SIZE} 题一批调用 API")
    start = last_index
    while start < end_index:
        chunk_end = min(start + ENRICH_BATCH_SIZE, end_index)
        chunk = [raw[i] for i in range(start, chunk_end)]
        enriched = enrich_batch(client_or_model, sdk, chunk, glossary_keys)
        done_items.extend(enriched)
        if (start + len(chunk)) % PROGRESS_SAVE_EVERY == 0 or chunk_end == end_index:
            save_progress(done_items, chunk_end)
            print(f"  已处理 {len(done_items)}/{end_index} 题，已保存断点（第 {chunk_end} 题）")
        time.sleep(BASE_SLEEP_SEC)
        start = chunk_end

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(done_items, f, ensure_ascii=False, indent=2)
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
    print(f"已写入: {output_path}，共 {len(done_items)} 题")


if __name__ == "__main__":
    main()
