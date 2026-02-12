#!/usr/bin/env python3
"""
将「PDF 正解 ≠ 社区投票」的题目改为以社区投票为准的答案，并在解析中补充说明与免责。

- 读取 raw_questions_en.json，找出 correct_answer != community_answer 的题目。
- 更新 questions_v2.json（前端通过 /data/questions_v2.json 读取）：best_answer、official_answer 改为
  community_answer；vote_percentage 同步；在 explanation.analysis 开头补充免责说明。
- 更新 questions_bilingual_enriched.json：correct_answer 改为 community_answer；同样补充解析说明。

答案同步后，建议调用 Gemini 重写解析以使 why_correct/why_wrong 与新区答案一致：
  export GEMINI_API_KEY="你的密钥"
  python3 scripts/re_explain_community_answers.py

用法：
  python3 scripts/apply_community_answers.py
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = REPO_ROOT / "public" / "data" / "raw_questions_en.json"
V2_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
ENRICHED_PATH = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"

DISCLAIMER_PREFIX = "【本题以社区投票为准，答案为"
DISCLAIMER_SUFFIX = "，解析仅供参考。】"


def load_raw() -> list[dict]:
    with RAW_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_mismatch_map(raw_items: list[dict]) -> dict[int, tuple[str, str]]:
    """返回 id -> (community_answer, vote_percentage) 的映射，仅包含 PDF 答案与社区答案不一致的题。"""
    out = {}
    for item in raw_items:
        qid = int(item.get("id", 0) or 0)
        if not qid:
            continue
        pdf = (item.get("correct_answer") or "").strip()
        community = (item.get("community_answer") or "").strip()
        vote = (item.get("vote_percentage") or "").strip()
        if not community or pdf == community:
            continue
        out[qid] = (community, vote)
    return out


def ensure_disclaimer(analysis: str, community_answer: str, vote_percentage: str) -> str:
    """若 analysis 尚未包含免责说明，则在开头加上。"""
    if not analysis or not isinstance(analysis, str):
        analysis = ""
    if DISCLAIMER_PREFIX in analysis:
        return analysis
    line = f"{DISCLAIMER_PREFIX} {community_answer}（社区 {vote_percentage}）{DISCLAIMER_SUFFIX}"
    return f"{line}\n\n{analysis}" if analysis.strip() else line


def main() -> None:
    if not RAW_PATH.exists():
        raise SystemExit(f"未找到 {RAW_PATH}，请先运行 extract_pdf_en.py")
    if not V2_PATH.exists():
        raise SystemExit(f"未找到 {V2_PATH}")
    if not ENRICHED_PATH.exists():
        raise SystemExit(f"未找到 {ENRICHED_PATH}")

    raw_items = load_raw()
    mismatch = build_mismatch_map(raw_items)
    if not mismatch:
        print("没有需要更新的题目（PDF 答案与社区答案一致）。")
        return

    print(f"将把 {len(mismatch)} 道题的答案改为社区投票答案，并补充解析说明。")

    # 更新 questions_v2.json
    with V2_PATH.open("r", encoding="utf-8") as f:
        v2_list = json.load(f)
    v2_by_id = {int(q["id"]): q for q in v2_list if isinstance(q, dict) and "id" in q}

    for qid, (community_answer, vote_percentage) in mismatch.items():
        q = v2_by_id.get(qid)
        if not q:
            continue
        q["best_answer"] = community_answer
        q["official_answer"] = community_answer
        q["vote_percentage"] = vote_percentage
        expl = q.get("explanation")
        if isinstance(expl, dict):
            analysis = expl.get("analysis") or ""
            expl["analysis"] = ensure_disclaimer(analysis, community_answer, vote_percentage)
        else:
            q["explanation"] = {
                "analysis": ensure_disclaimer("", community_answer, vote_percentage),
                "why_correct": "",
                "why_wrong": "",
            }

    with V2_PATH.open("w", encoding="utf-8") as f:
        json.dump(v2_list, f, ensure_ascii=False, indent=2)

    print(f"已写入 {V2_PATH}")

    # 更新 questions_bilingual_enriched.json
    with ENRICHED_PATH.open("r", encoding="utf-8") as f:
        enriched_list = json.load(f)
    enriched_by_id = {int(q.get("id")): q for q in enriched_list if isinstance(q, dict) and "id" in q}

    for qid, (community_answer, vote_percentage) in mismatch.items():
        q = enriched_by_id.get(qid)
        if not q:
            continue
        q["correct_answer"] = community_answer
        if "vote_percentage" in q or vote_percentage:
            q["vote_percentage"] = vote_percentage
        expl = q.get("explanation")
        if isinstance(expl, dict):
            analysis = expl.get("analysis")
            if isinstance(analysis, str):
                expl["analysis"] = ensure_disclaimer(analysis, community_answer, vote_percentage)
            else:
                expl["analysis"] = ensure_disclaimer("", community_answer, vote_percentage)
        else:
            q["explanation"] = {
                "analysis": ensure_disclaimer("", community_answer, vote_percentage),
                "why_correct": "",
                "why_wrong": "",
            }

    with ENRICHED_PATH.open("w", encoding="utf-8") as f:
        json.dump(enriched_list, f, ensure_ascii=False, indent=2)

    print(f"已写入 {ENRICHED_PATH}")
    print("完成。")


if __name__ == "__main__":
    main()
