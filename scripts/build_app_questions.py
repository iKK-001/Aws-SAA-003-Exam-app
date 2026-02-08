#!/usr/bin/env python3
"""
阶段 4：将 questions_bilingual（或 enriched）转为 App 使用的 questions_v2.json 格式。
字段映射：correct_answer → best_answer / official_answer，保留中英题干与选项，补全 tags、explanation、related_terms。

用法:
  python3 scripts/build_app_questions.py
  python3 scripts/build_app_questions.py public/data/questions_bilingual_enriched.json public/data/questions_v2.json
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"
FALLBACK_INPUT = REPO_ROOT / "public" / "data" / "questions_bilingual.json"
DEFAULT_OUTPUT = REPO_ROOT / "public" / "data" / "questions_v2.json"


def to_app_item(item: dict) -> dict:
    """将单条双语/ enriched 题转为 App 格式。"""
    correct = item.get("correct_answer") or item.get("best_answer") or ""
    explanation = item.get("explanation")
    if not isinstance(explanation, dict):
        explanation = {"analysis": "", "why_correct": "", "why_wrong": ""}
    else:
        explanation = {
            "analysis": explanation.get("analysis", ""),
            "why_correct": explanation.get("why_correct", ""),
            "why_wrong": explanation.get("why_wrong", ""),
        }
    return {
        "id": item.get("id"),
        "topic": item.get("topic", ""),
        "question_cn": item.get("question_cn", ""),
        "question_en": item.get("question_en", ""),
        "options_cn": item.get("options_cn") or {},
        "options_en": item.get("options_en") or {},
        "best_answer": correct,
        "official_answer": correct,
        "vote_percentage": item.get("vote_percentage", ""),
        "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        "explanation": explanation,
        "related_terms": item.get("related_terms") if isinstance(item.get("related_terms"), list) else [],
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="生成 App 用 questions_v2.json")
    parser.add_argument("input", nargs="?", default=None, help="输入 JSON（默认先读 enriched，若无则读 bilingual）")
    parser.add_argument("output", nargs="?", default=str(DEFAULT_OUTPUT), help="输出 questions_v2.json 路径")
    args = parser.parse_args()

    if args.input:
        input_path = Path(args.input).resolve()
    else:
        input_path = DEFAULT_INPUT.resolve()
        if not input_path.exists():
            input_path = FALLBACK_INPUT.resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        print(f"输入文件不存在: {input_path}")
        print("请先运行: python3 scripts/add_tags_and_explanation.py 生成 questions_bilingual_enriched.json")
        sys.exit(1)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raw = [raw]

    app_list = [to_app_item(item) for item in raw]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(app_list, f, ensure_ascii=False, indent=2)
    print(f"已写入: {output_path}，共 {len(app_list)} 题")


if __name__ == "__main__":
    main()
