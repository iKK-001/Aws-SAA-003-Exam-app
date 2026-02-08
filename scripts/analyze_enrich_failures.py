#!/usr/bin/env python3
"""
分析 questions_bilingual_enriched.json 中尚未完成阶段 3 的题，按失败原因分类：
- options_mismatch：options_en 与 options_cn 选项数不一致（源/格式问题）
- empty_question_or_options：题干或选项为空/过短（源/翻译问题）
- correct_answer_invalid：正确答案不在选项键中（源/格式问题）
- no_obvious_source_issue：无明显源数据问题（多为 API 超时/429 或模型返回解析异常）

用法:
  python3 scripts/analyze_enrich_failures.py
  python3 scripts/analyze_enrich_failures.py public/data/questions_bilingual_enriched.json

输出说明：
- options_mismatch：先运行 fix_options_en_mismatch.py 修复源文件，再 --fill-empty。
- empty_question / empty_options：检查 questions_bilingual.json 中对应题的翻译是否缺失。
- correct_answer_invalid：检查 correct_answer 与 options_cn 键是否一致。
- no_obvious_source_issue：多为 API 超时(504)/限流(429) 或模型返回 JSON 解析异常，可直接 --fill-empty 重试。
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATH = REPO_ROOT / "public" / "data" / "questions_bilingual_enriched.json"


def has_enrichment(item: dict) -> bool:
    """与 add_tags_and_explanation.py 中一致。"""
    if not item.get("tags") or not item.get("related_terms"):
        return False
    exp = item.get("explanation")
    return isinstance(exp, dict) and exp.get("analysis") and exp.get("why_correct")


def categorize_failure(item: dict, idx: int) -> list[str]:
    """返回该题失败原因标签列表（可多因）。"""
    reasons = []
    qid = item.get("id", idx + 1)
    opts_en = item.get("options_en") or {}
    opts_cn = item.get("options_cn") or {}
    q_cn = (item.get("question_cn") or "").strip()
    correct = item.get("correct_answer") or ""

    if len(opts_en) != len(opts_cn):
        reasons.append("options_mismatch")
    if not q_cn or len(q_cn) < 10:
        reasons.append("empty_question")
    for k, v in (opts_cn or {}).items():
        if not (v or "").strip() or len((v or "").strip()) < 2:
            reasons.append("empty_options")
            break
    if opts_cn and correct and correct not in opts_cn:
        reasons.append("correct_answer_invalid")
    if not reasons:
        reasons.append("no_obvious_source_issue")
    return reasons


def main():
    import argparse
    parser = argparse.ArgumentParser(description="分析阶段 3 未完成题目的失败原因")
    parser.add_argument("path", nargs="?", default=str(DEFAULT_PATH), help="questions_bilingual_enriched.json 路径")
    args = parser.parse_args()

    path = Path(args.path).resolve()
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = [data]

    failed = []
    for i, item in enumerate(data):
        if not has_enrichment(item):
            qid = item.get("id", i + 1)
            reasons = categorize_failure(item, i)
            failed.append((qid, i, reasons))

    if not failed:
        print("未发现尚未完成阶段 3 的题（当前文件中每题均有 tags、explanation.analysis/why_correct、related_terms）。")
        print("若你本地仍有格式/失败题，请对本地的 questions_bilingual_enriched.json 运行本脚本。")
        return

    # 按原因归类（一题可属多类，取主因：优先格式/源问题）
    by_reason = {
        "options_mismatch": [],
        "empty_question": [],
        "empty_options": [],
        "correct_answer_invalid": [],
        "no_obvious_source_issue": [],
    }
    for qid, idx, reasons in failed:
        if "options_mismatch" in reasons:
            by_reason["options_mismatch"].append(qid)
        if "empty_question" in reasons:
            by_reason["empty_question"].append(qid)
        if "empty_options" in reasons:
            by_reason["empty_options"].append(qid)
        if "correct_answer_invalid" in reasons:
            by_reason["correct_answer_invalid"].append(qid)
        if "no_obvious_source_issue" in reasons:
            by_reason["no_obvious_source_issue"].append(qid)

    print(f"共 {len(failed)} 题尚未完成阶段 3（无有效 tags/explanation/related_terms）\n")
    print("按可能原因分类（一题可属多类）：")
    print("-" * 60)
    print("1. options_mismatch（options_en 与 options_cn 选项数不一致，源/格式）")
    ids = by_reason["options_mismatch"]
    print(f"   题数: {len(ids)}，题号: {ids[:40]}{'...' if len(ids) > 40 else ''}\n")
    print("2. empty_question（题干中文为空或过短，源/翻译）")
    ids = by_reason["empty_question"]
    print(f"   题数: {len(ids)}，题号: {ids[:40]}{'...' if len(ids) > 40 else ''}\n")
    print("3. empty_options（选项中文为空或过短，源/翻译）")
    ids = by_reason["empty_options"]
    print(f"   题数: {len(ids)}，题号: {ids[:40]}{'...' if len(ids) > 40 else ''}\n")
    print("4. correct_answer_invalid（正确答案不在选项键中，源/格式）")
    ids = by_reason["correct_answer_invalid"]
    print(f"   题数: {len(ids)}，题号: {ids[:40]}{'...' if len(ids) > 40 else ''}\n")
    print("5. no_obvious_source_issue（无明显源数据问题，多为 API 超时/429 或模型解析异常）")
    ids = by_reason["no_obvious_source_issue"]
    print(f"   题数: {len(ids)}，题号: {ids[:40]}{'...' if len(ids) > 40 else ''}\n")
    print("-" * 60)
    print("建议：")
    if by_reason["options_mismatch"]:
        print("  · 先运行 fix_options_en_mismatch.py 修复 options_en 与 options_cn 不一致。")
    if by_reason["empty_question"] or by_reason["empty_options"]:
        print("  · 检查 empty_question / empty_options 对应题在 questions_bilingual.json 中的翻译是否缺失。")
    if by_reason["correct_answer_invalid"]:
        print("  · 检查 correct_answer_invalid 对应题的 correct_answer 与 options_cn 键是否一致。")
    print("  · 修复源数据后，再运行 add_tags_and_explanation.py --fill-empty 补漏。")


if __name__ == "__main__":
    main()
