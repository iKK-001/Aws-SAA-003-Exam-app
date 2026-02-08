#!/usr/bin/env python3
"""
列出题目 related_terms 中在 glossary.json 里缺失的词条，便于补全百科。
可选：--add-stubs 将缺失词条以占位条目（待补充）写入 glossary，避免 App 显示「暂无该术语解释」。
"""
import json
import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = REPO_ROOT / "public" / "data" / "questions_v2.json"
GLOSSARY_PATH = REPO_ROOT / "public" / "data" / "glossary.json"
OUTPUT_TXT = REPO_ROOT / "public" / "data" / "missing_glossary_terms.txt"


def main():
    ap = argparse.ArgumentParser(description="List or stub missing glossary terms from questions")
    ap.add_argument("--add-stubs", action="store_true", help="Add stub entries (待补充) to glossary.json for missing terms")
    ap.add_argument("--output", default=None, help="Write missing term list to this file (default: public/data/missing_glossary_terms.txt)")
    args = ap.parse_args()

    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)
    with open(GLOSSARY_PATH, "r", encoding="utf-8") as f:
        glossary = json.load(f)

    terms_in_questions = set()
    for q in questions:
        for t in q.get("related_terms") or []:
            terms_in_questions.add(t)

    in_glossary = set(glossary.keys())
    missing = sorted(terms_in_questions - in_glossary)

    out_path = Path(args.output) if args.output else OUTPUT_TXT
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# 题目中出现但 glossary 中缺失的词条（共 {len(missing)} 个）\n")
        f.write("# 可在 glossary.json 中为这些词条添加 definition / analogy / features\n\n")
        for t in missing:
            f.write(t + "\n")
    print(f"缺失词条数: {len(missing)}，已写入: {out_path}")

    if args.add_stubs:
        stub = {
            "definition": "（待补充）",
            "analogy": "",
            "features": [],
        }
        for t in missing:
            glossary[t] = stub
        with open(GLOSSARY_PATH, "w", encoding="utf-8") as f:
            json.dump(glossary, f, ensure_ascii=False, indent=2)
        print(f"已在 glossary.json 中为 {len(missing)} 个词条添加占位条目（待补充）。请后续在 glossary.json 中补全 definition/analogy/features。")


if __name__ == "__main__":
    main()
