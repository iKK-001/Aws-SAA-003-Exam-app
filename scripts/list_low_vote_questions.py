#!/usr/bin/env python3
"""
筛选社区投票率低于 70% 的题目（可能存在分歧），便于人工复核解析。
输出：题目 id、投票率、正确答案、题干摘要。
"""
import json
import os

THRESHOLD = 60  # 低于此值视为「投票率不高」

def main():
    base = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    path = os.path.join(base, "questions_v2.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    low = []
    for q in data:
        raw = q.get("vote_percentage") or ""
        try:
            pct = int(str(raw).replace("%", "").strip())
        except (ValueError, TypeError):
            pct = 0
        if pct < THRESHOLD:
            title = (q.get("question_cn") or "")[:80]
            if len((q.get("question_cn") or "")) > 80:
                title += "…"
            low.append({
                "id": q.get("id"),
                "vote_percentage": raw or "—",
                "best_answer": q.get("best_answer") or q.get("official_answer") or "—",
                "other_options_note": "各选项投票分布当前数据未收录，建议在 ExamTopics 等网站查看本题讨论与各选项占比。",
                "question_cn_preview": title,
            })

    low.sort(key=lambda x: (x["id"],))

    # 输出 JSON 供程序用
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, "low_vote_questions.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(low, f, ensure_ascii=False, indent=2)
    print(f"已写入 {json_path}，共 {len(low)} 题")

    # 输出 Markdown 便于人工查阅
    md_path = os.path.join(out_dir, "low_vote_questions.md")
    lines = [
        "# 社区投票率 < 60% 的题目（建议复核解析）",
        "",
        f"共 **{len(low)}** 题。以下题目社区投票率低于 60%，可能存在分歧，建议重点看解析是否需要修正。",
        "",
        "**说明**：表中「当前采纳答案」为数据中记录的社区最高票答案；各选项的详细投票分布当前数据未收录，建议在 ExamTopics 等网站搜索本题（如题号或题干关键词）查看各选项占比与讨论，再自行判断。",
        "",
        "| 题号 | 当前采纳答案投票率 | 当前采纳答案 | 其他选项比率 | 题干摘要 |",
        "|------|-------------------|--------------|--------------|----------|",
    ]
    other_note = "建议查阅 ExamTopics 等来源"
    for item in low:
        preview = (item["question_cn_preview"] or "").replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {item['id']} | {item['vote_percentage']} | {item['best_answer']} | {other_note} | {preview} |")
    lines.extend(["", "---", "生成自 `scripts/list_low_vote_questions.py`，阈值 60%。"])
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"已写入 {md_path}")

if __name__ == "__main__":
    main()
