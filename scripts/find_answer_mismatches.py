#!/usr/bin/env python3
"""
快速排查「PDF 标注的 Correct Answer」与「社区投票最高答案」不一致的题目。

使用前提：
- 先运行阶段 1 抽取脚本（已更新支持 community_answer 字段）：
    python3 scripts/extract_pdf_en.py "$HOME/AWS-SAA/AWS-SAA-C03 en.pdf"

输出：
- 在 stdout 打印一个表格，每行包含：
    id, pdf_correct, community_answer, community_vote_percentage, app_answer
- 其中 app_answer 来自 questions_bilingual_enriched.json 的 correct_answer 字段（如果存在）。
"""

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = REPO_ROOT / "public" / "data" / "raw_questions_en.json"
ENRICHED_PATH = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"


def load_raw() -> list[dict]:
    if not RAW_PATH.exists():
        raise SystemExit(f"raw_questions_en.json 未找到，请先运行 extract_pdf_en.py 生成：\n  {RAW_PATH}")
    with RAW_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_enriched_by_id() -> dict[int, dict]:
    if not ENRICHED_PATH.exists():
        return {}
    with ENRICHED_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return {int(q.get("id")): q for q in data if isinstance(q, dict) and "id" in q}


def main() -> None:
    raw_items = load_raw()
    enriched_by_id = load_enriched_by_id()

    mismatches: list[tuple[int, str, str, str, str]] = []

    for item in raw_items:
        qid = int(item.get("id", 0) or 0)
        if not qid:
            continue

        pdf_correct = (item.get("correct_answer") or "").strip()
        community = (item.get("community_answer") or "").strip()
        vote_pct = (item.get("vote_percentage") or "").strip()

        if not pdf_correct or not community:
            continue
        if pdf_correct == community:
            continue

        app_answer = ""
        enriched = enriched_by_id.get(qid)
        if enriched:
            app_answer = (enriched.get("correct_answer") or "").strip()

        mismatches.append((qid, pdf_correct, community, vote_pct, app_answer))

    if not mismatches:
        print("没有发现 PDF Correct Answer 与社区投票最高答案不一致的题目（要求二者字段都存在）。")
        return

    # 按题号排序输出，方便对照
    mismatches.sort(key=lambda x: x[0])

    print("id,pdf_correct,community_answer,vote_percentage,app_answer")
    for qid, pdf_correct, community, vote_pct, app_answer in mismatches:
        print(f"{qid},{pdf_correct},{community},{vote_pct},{app_answer}")


if __name__ == "__main__":
    main()

