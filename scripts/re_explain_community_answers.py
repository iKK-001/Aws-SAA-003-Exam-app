#!/usr/bin/env python3
"""
对「已改为社区投票答案」的题目调用 Gemini 重新生成解析，使 why_correct/why_wrong 与当前正确答案一致。
前提：已运行 apply_community_answers.py，questions_v2.json 中这些题的 analysis 含「本题以社区投票为准」说明。

- 只处理 analysis 中含该说明的题目；
- 用当前 best_answer（即社区答案）和题干、选项请求 Gemini 生成新解析；
- 新解析的 analysis 前保留「本题以社区投票为准，答案为 X（社区 Y%），解析仅供参考。」；
- 写回 questions_v2.json（前端用）并同步 explanation 到 questions_bilingual_enriched.json。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/re_explain_community_answers.py
  python3 scripts/re_explain_community_answers.py --limit 5
  python3 scripts/re_explain_community_answers.py --dry-run
  python3 scripts/re_explain_community_answers.py --ids 6,7,592
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
V2_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
ENRICHED_PATH = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"
FAIL_LOG = REPO_ROOT / "public" / "data" / ".re_explain_community_fail_log.txt"

COMMUNITY_DISCLAIMER_MARKER = "【本题以社区投票为准，答案为"
DISCLAIMER_PREFIX = "【本题以社区投票为准，答案为"
DISCLAIMER_SUFFIX = "，解析仅供参考。】"


def is_community_answer_question(q: dict) -> bool:
    exp = q.get("explanation")
    if not isinstance(exp, dict):
        return False
    analysis = exp.get("analysis") or ""
    return isinstance(analysis, str) and COMMUNITY_DISCLAIMER_MARKER in analysis


def get_correct_letters(q: dict) -> list[str]:
    a = q.get("best_answer")
    if a is None or a == "":
        return []
    if isinstance(a, list):
        return [str(x).strip().upper() for x in a]
    s = str(a).strip().upper()
    return sorted(s) if len(s) > 1 else [s] if s else []


def get_disclaimer_line(q: dict) -> str:
    """从现有 analysis 中提取整行免责说明，或根据 best_answer、vote_percentage 拼出。"""
    exp = q.get("explanation")
    if isinstance(exp, dict):
        analysis = exp.get("analysis") or ""
        if COMMUNITY_DISCLAIMER_MARKER in analysis:
            first_line = analysis.split("\n")[0].strip()
            if first_line.startswith("【") and "】" in first_line:
                return first_line
    ans = (q.get("best_answer") or "").strip().upper()
    vote = (q.get("vote_percentage") or "").strip()
    return f"{DISCLAIMER_PREFIX} {ans}（社区 {vote}）{DISCLAIMER_SUFFIX}"


def build_prompt(q: dict, correct_letters: list[str]) -> str:
    q_cn = q.get("question_cn", "")
    opts = q.get("options_cn") or {}
    opts_str = "\n".join(f"{k}. {v}" for k, v in sorted(opts.items()))
    correct_str = "、".join(correct_letters)
    wrong_opts = [k for k in sorted(opts.keys()) if k not in correct_letters]
    wrong_str = "、".join(wrong_opts) if wrong_opts else "其余选项"
    return f"""你是一位 AWS SAA-C03 备考解析助手。本题正确答案为：{correct_str}。错误选项为：{wrong_str}。

请根据题干与选项，输出一个 JSON 对象（仅此对象，无其他文字）：
1. explanation：对象，包含三键（均简体中文，技术术语保留英文）。
   - analysis：用 1～2 句话概括考查点（不要写「本题以社区投票为准」等说明，只写考查内容）。
   - why_correct：详细说明「选项 {correct_str}」为何正确：适用场景、与题目条件的对应、关键特性。约 2～4 句。
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
    try:
        FAIL_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(FAIL_LOG, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\nid {qid}\n{'='*60}\n{(raw_text or '')[:4000]}\n")
    except Exception:
        pass


def main():
    import argparse
    parser = argparse.ArgumentParser(description="对社区答案题目用 Gemini 重新生成解析")
    parser.add_argument("--limit", type=int, default=0, help="只处理前 N 题（0=全部）")
    parser.add_argument("--dry-run", action="store_true", help="只列出将处理的题，不调用 API")
    parser.add_argument("--ids", type=str, default="", help="只处理指定题号，逗号分隔")
    args = parser.parse_args()

    if not V2_PATH.exists():
        print(f"未找到 {V2_PATH}")
        sys.exit(1)
    if not ENRICHED_PATH.exists():
        print(f"未找到 {ENRICHED_PATH}")
        sys.exit(1)

    with open(V2_PATH, "r", encoding="utf-8") as f:
        v2_list = json.load(f)
    with open(ENRICHED_PATH, "r", encoding="utf-8") as f:
        enriched_list = json.load(f)

    v2_by_id = {int(q["id"]): (i, q) for i, q in enumerate(v2_list) if isinstance(q, dict) and "id" in q}
    enriched_by_id = {int(q.get("id")): q for q in enriched_list if isinstance(q, dict) and "id" in q}

    to_process = []
    for qid, (idx, q) in v2_by_id.items():
        if not is_community_answer_question(q):
            continue
        letters = get_correct_letters(q)
        if not letters:
            continue
        to_process.append({"qid": qid, "v2_index": idx, "v2_q": q, "letters": letters})

    if args.ids.strip():
        filter_ids = {int(x.strip()) for x in args.ids.split(",") if x.strip()}
        to_process = [t for t in to_process if t["qid"] in filter_ids]
        print(f"按 --ids 过滤，本次处理 {len(to_process)} 题")
    if args.limit > 0:
        to_process = to_process[: args.limit]
    if not to_process:
        print("没有待处理的题目（需先运行 apply_community_answers.py 且 analysis 含「本题以社区投票为准」）。")
        return

    print(f"待重新生成解析的题目数: {len(to_process)}（前端数据: questions_v2.json）")
    if args.dry_run:
        for t in to_process[:20]:
            print(f"  id {t['qid']}: 正确选项 {''.join(t['letters'])}")
        if len(to_process) > 20:
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
        qid = item["qid"]
        v2_q = item["v2_q"]
        letters = item["letters"]
        disclaimer_line = get_disclaimer_line(v2_q)

        for attempt in range(RETRY_MAX + 1):
            try:
                prompt = build_prompt(v2_q, letters)
                resp = model.generate_content(prompt)
                text = resp.text if hasattr(resp, "text") else (resp.candidates[0].content.parts[0].text if resp.candidates else "")
                parsed = parse_response(text)
                if parsed:
                    exp = parsed["explanation"]
                    new_analysis = (exp.get("analysis") or "").strip()
                    full_analysis = f"{disclaimer_line}\n\n{new_analysis}" if new_analysis else disclaimer_line
                    v2_q["explanation"] = {
                        "analysis": full_analysis,
                        "why_correct": exp.get("why_correct", ""),
                        "why_wrong": exp.get("why_wrong", ""),
                    }
                    if isinstance(parsed.get("related_terms"), list) and parsed["related_terms"]:
                        v2_q["related_terms"] = parsed["related_terms"]
                    # 同步到 enriched
                    eq = enriched_by_id.get(qid)
                    if eq:
                        eq["explanation"] = {
                            "analysis": full_analysis,
                            "why_correct": exp.get("why_correct", ""),
                            "why_wrong": exp.get("why_wrong", ""),
                        }
                        if isinstance(parsed.get("related_terms"), list) and parsed["related_terms"]:
                            eq["related_terms"] = parsed["related_terms"]
                    updated += 1
                    print(f"  [{idx + 1}/{len(to_process)}] id {qid} 已更新解析并同步到 enriched")
                    break
                _log_fail(qid, text)
                print(f"  [{idx + 1}/{len(to_process)}] id {qid} 解析失败（原始响应已写入 {FAIL_LOG.name}）")
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
        with open(V2_PATH, "w", encoding="utf-8") as f:
            json.dump(v2_list, f, ensure_ascii=False, indent=2)
        with open(ENRICHED_PATH, "w", encoding="utf-8") as f:
            json.dump(enriched_list, f, ensure_ascii=False, indent=2)
        print(f"已写回 {V2_PATH} 与 {ENRICHED_PATH}，共更新 {updated} 题解析")
    else:
        print("未更新任何题目。")


if __name__ == "__main__":
    main()
