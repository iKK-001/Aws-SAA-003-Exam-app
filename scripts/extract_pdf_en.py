#!/usr/bin/env python3
"""
阶段 1：从英文 PDF 抽取题目（仅题目+选项+正确答案+投票，不抽社区讨论）。

用法:
  pip install pdfplumber
  python3 scripts/extract_pdf_en.py "$HOME/AWS-SAA/AWS-SAA-C03 en.pdf"
  python3 scripts/extract_pdf_en.py "/path/to/file.pdf" public/data/raw_questions_en.json
"""

import json
import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("请先安装: pip install pdfplumber")
    sys.exit(1)


def extract_text_from_pdf(pdf_path: str) -> str:
    """逐页提取 PDF 文本并拼接。"""
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n\n".join(text_parts)


def split_question_blocks(full_text: str) -> list[dict]:
    """
    按 "Question #N" 分块，每块内解析：题干、选项 A-E、Correct Answer（支持多字母如 BD）、Community vote。
    遇到讨论区特征（如 upvoted、Highly Voted）则截断当前块，不纳入题干/选项。
    """
    pattern = re.compile(r"Question\s*#\s*(\d+)", re.IGNORECASE)
    blocks = []
    discussion_markers = [
        r"upvoted\s+\d+\s+times",
        r"Highly\s+Voted",
        r"Most\s+Recent",
        r"Selected\s+Answer\s*:\s*[A-E]",
        r"\d+\s+(?:year|month|day)s?\s+ago",
    ]
    for m in pattern.finditer(full_text):
        start = m.start()
        q_id = int(m.group(1))
        next_m = pattern.search(full_text, m.end())
        end = next_m.start() if next_m else len(full_text)
        block_text = full_text[start:end]
        for marker in discussion_markers:
            match = re.search(marker, block_text, re.IGNORECASE)
            if match:
                block_text = block_text[: match.start()]
                break
        parsed = parse_one_block(block_text, q_id)
        if parsed:
            blocks.append(parsed)
    return blocks


def parse_one_block(block_text: str, default_id: int) -> dict | None:
    """
    解析单题块：题干只取到第一个选项 "A." 之前；选项只取 "Correct Answer:" 之前。
    """
    # 在 "Correct Answer:" 处切开，题干+选项只在前半段；多选答案为 BD 等形式
    correct_pos = re.search(r"\bCorrect\s+Answer\s*:\s*[A-E]+", block_text, re.IGNORECASE)
    if correct_pos:
        before_correct = block_text[: correct_pos.start()].strip()
        after_correct = block_text[correct_pos.start() :]
    else:
        before_correct = block_text.strip()
        after_correct = ""

    topic = ""
    topic_m = re.search(r"Topic\s*(\d+)", before_correct, re.IGNORECASE)
    if topic_m:
        topic = topic_m.group(1)

    correct_answer = ""
    vote_percentage = ""
    # 多选答案为 BD、BC 等，单选为 B；统一按字母顺序输出如 "BD"
    correct_m = re.search(r"Correct\s+Answer\s*:\s*([A-E]+)", after_correct, re.IGNORECASE)
    if correct_m:
        letters = sorted(correct_m.group(1).upper())
        correct_answer = "".join(letters)
    vote_m = re.search(
        r"([A-E]+)\s*\(\s*(\d+)%?\s*\)",
        after_correct,
        re.IGNORECASE,
    )
    if vote_m:
        vote_percentage = vote_m.group(2) + "%"
        if not correct_answer:
            letters = sorted(vote_m.group(1).upper())
            correct_answer = "".join(letters)

    lines = [ln.strip() for ln in before_correct.splitlines() if ln.strip()]
    # 支持选项 E（多选题多为 A-E 五选二）
    option_pattern = re.compile(r"^([A-E])\.\s*", re.IGNORECASE)
    question_parts = []
    options = {}
    current_option = None
    current_text = []

    for line in lines:
        if re.match(r"Question\s*#", line, re.IGNORECASE) or re.match(r"^Topic\s*\d+", line, re.IGNORECASE):
            continue
        m = option_pattern.match(line)
        if m:
            if current_option:
                options[current_option] = " ".join(current_text).strip()
            current_option = m.group(1).upper()
            current_text = [line[m.end() :].strip()]
        elif current_option:
            current_text.append(line)
        else:
            question_parts.append(line)

    if current_option:
        options[current_option] = " ".join(current_text).strip()

    question_en = " ".join(question_parts).strip()
    if not question_en and not options:
        return None

    # PDF 提取有时会把 "fi" 变成空字符，导致 files→les, Configure→Con gure, profile→pro le 等
    def fix_null_char(s: str) -> str:
        return s.replace("\u0000", "fi") if s else s

    question_en = fix_null_char(question_en)
    options = {k: fix_null_char(v) for k, v in options.items()}

    return {
        "id": default_id,
        "topic": topic,
        "question_en": question_en,
        "options_en": options,
        "correct_answer": correct_answer or "",
        "vote_percentage": vote_percentage or "",
    }


def main():
    repo_root = Path(__file__).resolve().parent.parent
    default_output = repo_root / "public" / "data" / "raw_questions_en.json"

    if len(sys.argv) < 2:
        print(__doc__)
        print(f"示例: python3 {sys.argv[0]} \"$HOME/AWS-SAA/AWS-SAA-C03 en.pdf\"")
        print(f"输出默认: {default_output}")
        sys.exit(1)

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.exists():
        print(f"文件不存在: {pdf_path}")
        print("提示: 若 PDF 在「用户名/AWS-SAA/」下，请用: $HOME/AWS-SAA/AWS-SAA-C03 en.pdf")
        print("      若在「用户名/ikaken/AWS-SAA/」下，请用绝对路径，如: /Users/你的用户名/ikaken/AWS-SAA/AWS-SAA-C03 en.pdf")
        sys.exit(1)

    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else default_output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"正在读取 PDF: {pdf_path}")
    full_text = extract_text_from_pdf(str(pdf_path))
    print(f"文本总长度: {len(full_text)} 字符")

    blocks = split_question_blocks(full_text)
    print(f"解析到题目数: {len(blocks)}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(blocks, f, ensure_ascii=False, indent=2)

    print(f"已写入: {output_path}")


if __name__ == "__main__":
    main()
