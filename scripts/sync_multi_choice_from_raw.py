#!/usr/bin/env python3
"""
从重新抽取的 raw_questions_en.json 同步多选题（选项含 E）的正确答案到 questions_bilingual_enriched.json。
需先重新运行 extract_pdf_en.py 生成含多字母 correct_answer（如 BD）的 raw。
同步完成后请运行 build_app_questions.py 以根据 enriched 重新生成 questions_v2.json。

用法:
  python3 scripts/sync_multi_choice_from_raw.py
  python3 scripts/sync_multi_choice_from_raw.py public/data/raw_questions_en.json public/data/questions_bilingual_enriched.json
  python3 scripts/sync_multi_choice_from_raw.py --dry-run   # 只打印将要修改的题，不写回
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW = REPO_ROOT / "public" / "data" / "raw_questions_en.json"
DEFAULT_ENRICHED = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"


def normalize_answer(raw_answer: str) -> str:
    """多字母按字母序拼接，如 'DB' -> 'BD'。"""
    if not raw_answer or not isinstance(raw_answer, str):
        return ""
    letters = sorted(c.upper() for c in raw_answer.strip() if c.upper() in "ABCDE")
    return "".join(letters)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="从 raw 同步多选题答案到 questions_bilingual_enriched.json")
    parser.add_argument("raw", nargs="?", default=str(DEFAULT_RAW), help="重新抽取的 raw_questions_en.json")
    parser.add_argument("enriched", nargs="?", default=str(DEFAULT_ENRICHED), help="questions_bilingual_enriched.json 路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印将要修改的题，不写回")
    args = parser.parse_args()

    raw_path = Path(args.raw)
    enriched_path = Path(args.enriched)
    if not raw_path.exists():
        print(f"raw 文件不存在: {raw_path}")
        print("请先重新运行: python3 scripts/extract_pdf_en.py \"$HOME/AWS-SAA/AWS-SAA-C03 en.pdf\"")
        sys.exit(1)
    if not enriched_path.exists():
        print(f"enriched 文件不存在: {enriched_path}")
        sys.exit(1)

    with open(raw_path, "r", encoding="utf-8") as f:
        raw_list = json.load(f)
    with open(enriched_path, "r", encoding="utf-8") as f:
        enriched_list = json.load(f)

    raw_by_id = {item["id"]: item for item in raw_list if item.get("id") is not None}
    updates = []
    for q in enriched_list:
        qid = q.get("id")
        opts = q.get("options_cn") or {}
        if "E" not in opts:
            continue
        raw_item = raw_by_id.get(qid)
        if not raw_item:
            continue
        raw_ans = raw_item.get("correct_answer", "")
        new_ans = normalize_answer(raw_ans)
        if len(new_ans) < 2:
            continue
        # enriched 使用 correct_answer（无 best_answer/official_answer）
        old_ans = q.get("correct_answer", "") or q.get("best_answer", "")
        if isinstance(old_ans, list):
            old_ans = "".join(sorted(str(x).upper() for x in old_ans))
        else:
            old_ans = normalize_answer(str(old_ans))
        if new_ans == old_ans:
            continue
        updates.append({"id": qid, "old": old_ans or "(空)", "new": new_ans})
        if not args.dry_run:
            q["correct_answer"] = new_ans

    print(f"选项含 E 的题数: {sum(1 for q in enriched_list if (q.get('options_cn') or {}).get('E'))}")
    print(f"raw 中 correct_answer 为多字母的题数: {sum(1 for r in raw_list if len(normalize_answer(r.get('correct_answer') or '')) >= 2)}")
    print(f"本次将更新答案的题数: {len(updates)}")
    for u in updates[:20]:
        print(f"  id {u['id']}: {u['old']} -> {u['new']}")
    if len(updates) > 20:
        print(f"  ... 共 {len(updates)} 题")

    if updates and not args.dry_run:
        with open(enriched_path, "w", encoding="utf-8") as f:
            json.dump(enriched_list, f, ensure_ascii=False, indent=2)
        print(f"已写回: {enriched_path}")
        print("请运行 build_app_questions.py 以根据 enriched 重新生成 questions_v2.json")
    elif args.dry_run and updates:
        print("(dry-run，未写回)")


if __name__ == "__main__":
    main()
