#!/usr/bin/env python3
"""
为「题干选二但 best_answer 仅 1 个」的题目，用 Gemini 根据题干+选项+解析推断出
第二（及第三）个正确选项，写回 questions_v2.json。需先跑 audit_multiple_choice.py 得到 id 列表。

用法:
  export GEMINI_API_KEY="你的API密钥"
  python3 scripts/fix_multiple_choice_answers.py
  python3 scripts/fix_multiple_choice_answers.py --limit 5   # 试跑 5 题
  python3 scripts/fix_multiple_choice_answers.py --dry-run   # 只输出建议，不写回
"""
import json
import os
import re
import sys
import time
from pathlib import Path

RETRY_MAX = 3
RETRY_WAIT = [30, 60, 120]
BATCH_SLEEP = 1.0

try:
    import google.generativeai as genai
except ImportError:
    print("请先安装: pip install google-generativeai")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
AUDIT_PATH = REPO_ROOT / "public" / "data" / "multiple_choice_audit.json"


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


def get_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("请设置环境变量 GEMINI_API_KEY")
        sys.exit(1)
    genai.configure(api_key=api_key.strip())
    return genai.GenerativeModel("gemini-2.0-flash-lite")


def build_prompt(q: dict, expect_n: int, current_letters: list[str]) -> str:
    q_cn = q.get("question_cn", "")
    opts = q.get("options_cn") or {}
    opts_str = "\n".join(f"{k}. {v}" for k, v in sorted(opts.items()))
    exp = q.get("explanation") or {}
    why_correct = exp.get("why_correct", "")
    why_wrong = exp.get("why_wrong", "")
    return f"""本题是「需选 {expect_n} 项」的多选题，但数据里目前只记录了其中一个正确选项：{current_letters}。
请根据题干、选项和解析，推断出全部 {expect_n} 个正确选项的字母（如 A、B、C、D、E 中的两个或三个）。

题干：
{q_cn}

选项：
{opts_str}

解析摘要：
- 正确项说明：{why_correct[:400] if why_correct else "无"}
- 错误项说明：{why_wrong[:400] if why_wrong else "无"}

请只输出一个 JSON 对象，格式：{{"correct_letters": ["X", "Y"]}}，按字母顺序排列。
例如选两项且正确为 B 和 C 时输出：{{"correct_letters": ["B", "C"]}}
不要输出其他文字。"""


def parse_response(text: str, expect_n: int) -> list[str] | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        obj = json.loads(text)
        letters = obj.get("correct_letters")
        if not isinstance(letters, list) or len(letters) != expect_n:
            return None
        letters = [str(x).strip().upper() for x in letters if x]
        if len(letters) != expect_n:
            return None
        return sorted(letters)
    except (json.JSONDecodeError, TypeError):
        return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="用 Gemini 补全多选题正确答案")
    parser.add_argument("--limit", type=int, default=0, help="只处理前 N 题（0=全部）")
    parser.add_argument("--dry-run", action="store_true", help="只打印建议，不写回 JSON")
    args = parser.parse_args()

    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)

    to_fix = []
    for i, q in enumerate(questions):
        expect_n = infer_answer_count(q.get("question_cn", ""), q.get("question_en", ""))
        if expect_n < 2:
            continue
        ans = get_best_answer_array(q)
        if len(ans) != expect_n:
            to_fix.append({"index": i, "q": q, "expect_n": expect_n, "current": ans})

    if args.limit > 0:
        to_fix = to_fix[: args.limit]
    if not to_fix:
        print("没有需要补全的多选题。")
        return

    print(f"待补全题数: {len(to_fix)}")
    model = get_model()
    updates = []
    for idx, item in enumerate(to_fix):
        i, q, expect_n, current = item["index"], item["q"], item["expect_n"], item["current"]
        qid = q.get("id")
        prompt = build_prompt(q, expect_n, current)
        for attempt in range(RETRY_MAX + 1):
            try:
                resp = model.generate_content(prompt)
                text = resp.text if hasattr(resp, "text") else (resp.candidates[0].content.parts[0].text if resp.candidates else "")
                parsed = parse_response(text, expect_n)
                if parsed:
                    updates.append({"index": i, "id": qid, "old": q.get("best_answer"), "new": "".join(parsed), "letters": parsed})
                    print(f"  题 {qid}: {q.get('best_answer')} -> {''.join(parsed)}")
                    break
                print(f"  题 {qid}: 解析失败")
            except Exception as e:
                if "429" in str(e) or "Resource exhausted" in str(e):
                    wait = RETRY_WAIT[min(attempt, len(RETRY_WAIT) - 1)]
                    print(f"  题 {qid}: 限流，{wait}s 后重试")
                    time.sleep(wait)
                else:
                    print(f"  题 {qid}: {e}")
                    break
        time.sleep(BATCH_SLEEP)

    if not updates or args.dry_run:
        if updates and args.dry_run:
            print(" dry-run: 建议修改", [u["id"] for u in updates])
        return

    id_to_new = {u["id"]: u["new"] for u in updates}
    for q in questions:
        if q.get("id") in id_to_new:
            q["best_answer"] = id_to_new[q["id"]]
            if q.get("official_answer") is not None:
                q["official_answer"] = id_to_new[q["id"]]
    with open(QUESTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f"已写回 {QUESTIONS_PATH}，共更新 {len(updates)} 题")


if __name__ == "__main__":
    main()
