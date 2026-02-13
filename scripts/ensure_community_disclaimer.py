#!/usr/bin/env python3
"""
为所有题目的 explanation.analysis 统一加上「本题以社区投票为准」前缀（若尚未包含）。
格式：「【本题以社区投票为准，答案为 X（社区 Y%），解析仅供参考。】
然后再接原有考查点概括（即现有 analysis 内容）。
"""
import json
import os

PREFIX_MARKER = "【本题以社区投票为准"

def get_answer(q, use_best_answer=True):
    if use_best_answer and "best_answer" in q:
        return q["best_answer"]
    if "correct_answer" in q:
        return q["correct_answer"]
    if "official_answer" in q:
        return q["official_answer"]
    return "—"

def get_pct(q):
    return q.get("vote_percentage") or "—"

def ensure_prefix(analysis, answer, pct):
    if not analysis or not isinstance(analysis, str):
        return analysis
    if analysis.strip().startswith(PREFIX_MARKER):
        return analysis
    # 答案可能为多选如 "AB"，直接显示
    answer_str = answer if isinstance(answer, str) else (",".join(answer) if isinstance(answer, list) else "—")
    prefix = f"【本题以社区投票为准，答案为 {answer_str}（社区 {pct}），解析仅供参考。】\n\n"
    return prefix + analysis.strip()

def process_file(path, use_best_answer=True):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    for q in data:
        if not q.get("explanation") or not isinstance(q["explanation"], dict):
            continue
        analysis = q["explanation"].get("analysis")
        if not analysis:
            continue
        answer = get_answer(q, use_best_answer=use_best_answer)
        pct = get_pct(q)
        new_analysis = ensure_prefix(analysis, answer, pct)
        if new_analysis != analysis:
            q["explanation"]["analysis"] = new_analysis
            updated += 1
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return updated

def main():
    base = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    v2_path = os.path.join(base, "questions_v2.json")
    enriched_path = os.path.join(base, "questions_bilingual_enriched.json")
    v2_n = process_file(v2_path, use_best_answer=True)
    enriched_n = process_file(enriched_path, use_best_answer=False)
    print(f"questions_v2.json: {v2_n} 条 analysis 已补前缀")
    print(f"questions_bilingual_enriched.json: {enriched_n} 条 analysis 已补前缀")

if __name__ == "__main__":
    main()
