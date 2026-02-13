#!/usr/bin/env python3
"""
对社区投票率 < 60% 的题目，将解析改为更谨慎的表述：
- 不断定某答案一定正确/错误，而是建议用户上网搜索、结合权威资料自行判断，避免被参考答案误导。
"""
import json
import os

THRESHOLD = 60
CAUTION_SUFFIX = (
    "\n\n本题社区投票率较低，存在分歧。以上解析仅供参考，请勿视为标准答案；"
    "建议结合 AWS 官方文档或上网搜索本题进行深入了解，避免被参考答案误导。"
)
CAUTION_ALREADY = "避免被参考答案误导"
WHY_CORRECT_PREFIX = "当前采纳的参考答案为"
WHY_CORRECT_SUFFIX = " 以上仅供参考；建议上网搜索本题或 AWS 文档进一步确认，避免被单一参考答案误导。"
WHY_WRONG_WRAP_PREFIX = "参考解析中对该题其它选项的常见说明如下（仅供参考，不代表标准答案）：\n\n"
WHY_WRONG_WRAP_SUFFIX = "\n\n建议上网搜索本题或相关知识点进一步确认，避免被参考答案误导。"


def pct_from_question(q):
    raw = q.get("vote_percentage") or ""
    try:
        return int(str(raw).replace("%", "").strip())
    except (ValueError, TypeError):
        return 0


def is_low_vote(q):
    return pct_from_question(q) < THRESHOLD


def get_answer(q, use_best=True):
    if use_best and q.get("best_answer"):
        return q["best_answer"]
    return q.get("correct_answer") or q.get("official_answer") or "该选项"


def process_explanation(explanation, answer_str):
    if not explanation or not isinstance(explanation, dict):
        return explanation
    out = dict(explanation)

    # analysis: 若无谨慎提示则追加
    analysis = (out.get("analysis") or "").strip()
    if analysis and CAUTION_ALREADY not in analysis:
        out["analysis"] = analysis.rstrip() + CAUTION_SUFFIX

    # why_correct: 改为「当前采纳的参考答案」+ 简述 + 建议上网搜索
    why_correct = (out.get("why_correct") or "").strip()
    if why_correct and WHY_CORRECT_PREFIX not in why_correct:
        answer_display = answer_str if isinstance(answer_str, str) else "、".join(answer_str)
        out["why_correct"] = (
            f"{WHY_CORRECT_PREFIX} {answer_display}。理由简述：{why_correct}"
            f"{WHY_CORRECT_SUFFIX}"
        )

    # why_wrong: 保留原参考解析内容，仅外加「仅供参考」与建议上网搜索
    raw_wrong = out.get("why_wrong")
    if isinstance(raw_wrong, dict):
        why_wrong = "\n\n".join(f"选项 {k}：{v}" for k, v in sorted(raw_wrong.items())).strip()
    elif isinstance(raw_wrong, str):
        why_wrong = raw_wrong.strip()
    else:
        why_wrong = (str(raw_wrong) if raw_wrong else "").strip()
    if why_wrong and WHY_WRONG_WRAP_PREFIX not in why_wrong:
        out["why_wrong"] = WHY_WRONG_WRAP_PREFIX + why_wrong + WHY_WRONG_WRAP_SUFFIX

    return out


def process_file(path, use_best_answer=True):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    for q in data:
        if not is_low_vote(q):
            continue
        if not q.get("explanation") or not isinstance(q["explanation"], dict):
            continue
        answer = get_answer(q, use_best=use_best_answer)
        q["explanation"] = process_explanation(q["explanation"], answer)
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
    print(f"questions_v2.json: {v2_n} 条低投票率题目解析已改为谨慎表述")
    print(f"questions_bilingual_enriched.json: {enriched_n} 条低投票率题目解析已改为谨慎表述")


if __name__ == "__main__":
    main()
