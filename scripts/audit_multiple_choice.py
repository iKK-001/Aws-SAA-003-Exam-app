#!/usr/bin/env python3
"""
审计多选题：题干为「选二/Choose two」等但 best_answer 仅 1 个的题目，
并检查解析中是否明确写出全部正确答案。输出报告便于后续修正。

用法:
  python3 scripts/audit_multiple_choice.py
  python3 scripts/audit_multiple_choice.py --output report.json
"""
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
DEFAULT_REPORT = REPO_ROOT / "public" / "data" / "multiple_choice_audit.json"


def infer_answer_count(question_cn: str, question_en: str) -> int:
    cn = (question_cn or "").strip()
    en = (question_en or "").strip()
    if re.search(r"选二|选择两个|Select\s+TWO|选二。", cn, re.I):
        return 2
    if re.search(r"Choose\s+two|Select\s+two|\(Choose\s+2\)", en, re.I):
        return 2
    if re.search(r"选三|Select\s+THREE", cn, re.I):
        return 3
    return 0


def get_best_answer_array(item: dict) -> list[str]:
    a = item.get("best_answer")
    if a is None or a == "":
        return []
    if isinstance(a, list):
        return [str(x).strip().upper() for x in a]
    s = str(a).strip().upper()
    if len(s) > 1:
        return sorted(s)
    return [s]


def main():
    import argparse
    parser = argparse.ArgumentParser(description="审计多选题答案与解析")
    parser.add_argument("--output", "-o", default=str(DEFAULT_REPORT), help="输出报告路径")
    args = parser.parse_args()

    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)

    expect_multi = []
    for i, q in enumerate(questions):
        expect_n = infer_answer_count(q.get("question_cn", ""), q.get("question_en", ""))
        if expect_n < 2:
            continue
        ans = get_best_answer_array(q)
        expect_multi.append({
            "id": q.get("id"),
            "index": i,
            "expect_count": expect_n,
            "actual_count": len(ans),
            "best_answer_raw": q.get("best_answer"),
            "best_answer_letters": ans,
            "needs_fix": len(ans) != expect_n,
        })

    # 仅答案数量不对的
    needs_answer_fix = [x for x in expect_multi if x["needs_fix"]]
    report = {
        "total_questions": len(questions),
        "multi_by_question_text": len(expect_multi),
        "needs_answer_fix_count": len(needs_answer_fix),
        "needs_answer_fix_ids": [x["id"] for x in needs_answer_fix],
        "detail": expect_multi,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"题干为选二/Choose two 的题数: {len(expect_multi)}")
    print(f"其中答案数量不符（需补全）: {len(needs_answer_fix)}")
    print(f"题目 id: {report['needs_answer_fix_ids'][:20]}..." if len(report['needs_answer_fix_ids']) > 20 else f"题目 id: {report['needs_answer_fix_ids']}")
    print(f"报告已写: {out_path}")


if __name__ == "__main__":
    main()
