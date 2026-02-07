#!/usr/bin/env python3
"""
refine_data.py - 将题目转换为多选兼容格式

1. 识别多选：best_answer/official_answer 含多个字母，或题干含「选择两个」等关键词
2. 字段重构：best_answer/official_answer 转为字符串数组，增加 is_multiple、answer_count
3. 多选解析：确保 explanation.why_correct 覆盖所有正确项说明
"""

import json
import re
import sys
from pathlib import Path

# 题干中表示多选的关键词（不区分大小写匹配）
MULTIPLE_KEYWORDS = [
    "选择两个", "选择三个", "选择四个",
    "选两个", "选三个", "选四个",
    "select two", "select three", "select four",
    "Select TWO", "Select THREE", "Select FOUR",
    "Select 2", "Select 3", "Select 4",
    "two options", "three options", "four options",
    "两个选项", "三个选项", "四个选项",
    "选出两个", "选出三个",
    "（选择两个", "（选择三个",
    "(Select two", "(Select three",
]


def answer_to_list(value):
    """将 best_answer / official_answer 统一转为字符串数组。"""
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return sorted([str(x).strip().upper() for x in value if str(x).strip()])
    s = str(value).strip().upper()
    if not s:
        return []
    # 先按逗号、分号、空格分
    parts = re.split(r"[,;\s]+", s)
    letters = []
    for p in parts:
        p = p.strip()
        if len(p) == 1 and "A" <= p <= "Z":
            letters.append(p)
        elif len(p) > 1:
            for c in p:
                if "A" <= c <= "Z":
                    letters.append(c)
    return sorted(list(dict.fromkeys(letters)))  # 去重且保持顺序按字母


def is_multiple_by_question_text(question_cn):
    """题干是否包含多选关键词。"""
    if not question_cn:
        return False
    q = question_cn.strip()
    for kw in MULTIPLE_KEYWORDS:
        if kw in q:
            return True
    # 正则：Select TWO / Select 2 等
    if re.search(r"select\s+(two|three|four|2|3|4)\b", q, re.I):
        return True
    return False


def is_multiple_question(q, best_list, official_list):
    """是否应标记为多选。"""
    if len(best_list) > 1 or len(official_list) > 1:
        return True
    return is_multiple_by_question_text(q.get("question_cn") or "")


def ensure_why_correct_for_multiple(explanation, correct_letters):
    """
    多选时确保 why_correct 明确覆盖所有正确项。
    若已有对所有正确项的提及则不改；否则在末尾追加正确项列表说明。
    """
    if not explanation or not isinstance(explanation, dict) or not correct_letters:
        return explanation
    why = (explanation.get("why_correct") or "").strip()
    if not why:
        return explanation
    # 检查是否已提及所有正确项（如「选项A…选项C」）
    mentioned = [opt for opt in correct_letters if f"选项{opt}" in why or opt in why]
    if set(mentioned) >= set(correct_letters):
        return explanation
    suffix = f"（本题为多选题，正确项为：{'、'.join(correct_letters)}，需全部选对才得分。）"
    if suffix not in why:
        explanation = {**explanation, "why_correct": why.rstrip() + " " + suffix}
    return explanation


def refine_question(q):
    """单题转换：答案转数组、增加 is_multiple / answer_count、多选解析修正。"""
    best_raw = q.get("best_answer")
    official_raw = q.get("official_answer")

    best_list = answer_to_list(best_raw)
    official_list = answer_to_list(official_raw) if official_raw is not None else []

    # 若解析结果为空，保留原样为单元素列表（兼容异常数据）
    if not best_list and best_raw is not None:
        best_list = [str(best_raw).strip().upper()[0]] if str(best_raw).strip() else []
    if not official_list and official_raw is not None:
        official_list = [str(official_raw).strip().upper()[0]] if str(official_raw).strip() else []

    is_multiple = is_multiple_question(q, best_list, official_list)
    answer_count = len(best_list) if best_list else 0

    out = {k: v for k, v in q.items() if k not in ("best_answer", "official_answer")}
    out["best_answer"] = best_list
    out["official_answer"] = official_list
    out["is_multiple"] = is_multiple
    out["answer_count"] = answer_count

    if is_multiple and best_list and "explanation" in out and out["explanation"]:
        out["explanation"] = ensure_why_correct_for_multiple(
            out["explanation"], best_list
        )

    return out


def main():
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    default_input = repo_root / "public" / "data" / "questions_v2.json"
    default_output = repo_root / "public" / "data" / "questions_v2_refined.json"

    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_input
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else default_output

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("Error: expected JSON array of questions", file=sys.stderr)
        sys.exit(1)

    refined = [refine_question(q) for q in data]
    multiple_count = sum(1 for q in refined if q.get("is_multiple"))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(refined, f, ensure_ascii=False, indent=2)

    print(f"Refined {len(refined)} questions, {multiple_count} marked as multiple-choice.")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
