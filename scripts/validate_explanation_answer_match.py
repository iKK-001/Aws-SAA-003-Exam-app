#!/usr/bin/env python3
"""
检测「解析中写到的正确选项」与题目 best_answer 是否一致，并找出多选题中解析为空（更新失败）的题。
输出不匹配与需重跑的题号，便于用 re_explain_multiple_choice --ids 重生成解析。

用法:
  python3 scripts/validate_explanation_answer_match.py
  python3 scripts/validate_explanation_answer_match.py public/data/questions_v2.json
  python3 scripts/validate_explanation_answer_match.py --output-ids   # 只输出需重跑的题号（逗号分隔，可接 --ids 给 re_explain）
"""
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"

# 从 why_correct 等文本中提取提到的选项字母（选项 A、选项B、选项 C 等）
OPTION_LETTER_RE = re.compile(r"选项\s*([A-E])")


def best_answer_letters(q: dict) -> set[str]:
    """将 best_answer 规范为选项字母集合。"""
    a = q.get("best_answer") or q.get("correct_answer") or ""
    if isinstance(a, list):
        return {str(x).strip().upper() for x in a if str(x).strip().upper() in "ABCDE"}
    s = str(a).strip().upper()
    return {c for c in s if c in "ABCDE"}


def mentioned_option_letters(text: str) -> set[str]:
    """从解析文本中提取被提到的选项字母（如 选项 B、选项 D）。"""
    if not text or not isinstance(text, str):
        return set()
    return set(OPTION_LETTER_RE.findall(text))


def check_match(q: dict) -> tuple[bool, set[str], set[str]]:
    """
    返回 (是否一致, 正确答案字母集合, 解析中提到的选项字母集合)。
    若解析中「正确选项」提到的字母与 best_answer 不一致，则判定为不匹配。
    """
    expected = best_answer_letters(q)
    exp = q.get("explanation")
    if not isinstance(exp, dict):
        return (len(expected) == 0, expected, set())
    why_correct = (exp.get("why_correct") or "").strip()
    mentioned = mentioned_option_letters(why_correct)
    if not expected:
        return (True, expected, mentioned)
    # 仅当解析中明确写了「选项 X」且与 best_answer 不一致时才判为不匹配（避免因未写选项字母而误报）
    if not mentioned:
        return (True, expected, mentioned)
    match = mentioned == expected
    return (match, expected, mentioned)


def is_multi_choice(q: dict) -> bool:
    """是否多选题（best_answer 为两字母及以上）。"""
    letters = best_answer_letters(q)
    return len(letters) >= 2


def has_empty_explanation(q: dict) -> bool:
    """多选题解析是否为空或过短（视为更新失败）。"""
    exp = q.get("explanation")
    if not isinstance(exp, dict):
        return True
    wc = (exp.get("why_correct") or "").strip()
    return len(wc) < 20


def main():
    import argparse
    parser = argparse.ArgumentParser(description="校验解析与答案一致性，并列出需重跑的多选题")
    parser.add_argument("path", nargs="?", default=str(DEFAULT_PATH), help="questions_v2.json 路径")
    parser.add_argument("--output-ids", action="store_true", help="只输出需重跑的题号（逗号分隔）")
    args = parser.parse_args()

    path = Path(args.path).resolve()
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = [data]

    mismatches = []
    empty_multi = []
    for q in data:
        qid = q.get("id")
        match, expected, mentioned = check_match(q)
        if not match and expected:
            mismatches.append({
                "id": qid,
                "best_answer": "".join(sorted(expected)),
                "mentioned_in_why_correct": "".join(sorted(mentioned)),
                "why_correct_preview": (q.get("explanation") or {}).get("why_correct", "")[:120],
            })
        if is_multi_choice(q) and has_empty_explanation(q):
            empty_multi.append(qid)

    need_retry_ids = sorted({m["id"] for m in mismatches} | set(empty_multi))
    if args.output_ids:
        if need_retry_ids:
            print(",".join(str(x) for x in need_retry_ids))
        return

    if not mismatches and not empty_multi:
        print("未发现需重跑的多选题（无解析与答案不一致，无多选题解析为空）。")
        return

    if mismatches:
        print(f"共 {len(mismatches)} 题解析与答案不一致（解析中写到的正确选项 ≠ best_answer）：\n")
        print("-" * 70)
        for m in mismatches:
            print(f"  id {m['id']}: best_answer={m['best_answer']}  解析中提到的选项={m['mentioned_in_why_correct']}")
            print(f"    why_correct 摘要: {m['why_correct_preview']}...")
            print()
        print("-" * 70)
    if empty_multi:
        print(f"共 {len(empty_multi)} 题为多选题但解析为空或过短（视为更新失败）：")
        print("  " + ", ".join(str(x) for x in empty_multi[:30]) + (" ..." if len(empty_multi) > 30 else ""))
        print()

    if need_retry_ids:
        print("需重跑题号（含不一致 + 解析为空的多选题）：")
        print("  " + ", ".join(str(x) for x in need_retry_ids))
        print()
        print("建议：只重跑上述题（多选题会用正确答案重写解析）：")
        print("  export GEMINI_API_KEY=\"你的API密钥\"")
        print(f"  python3 scripts/re_explain_multiple_choice.py --ids {','.join(str(x) for x in need_retry_ids)}")


if __name__ == "__main__":
    main()
