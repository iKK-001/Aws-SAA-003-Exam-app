# 数据文件

将以下文件放入此目录，以支持题目与词库功能及 PWA 离线访问：

- `questions_v2.json` — 题目列表（含 question_cn/question_en、options_cn/options_en、tags、explanation、related_terms）
- `glossary.json` — 术语百科（definition、analogy、features）

## 百科词条与题干内可点词条（数据清洗后）

- **百科页词条**：来自 `glossary.json`。本次数据清洗（PDF 提取 → 翻译 → 打标/解析）**未重新生成**该文件，因此百科页的词条数量与内容与之前一致。
- **题干/解析内可点开抽屉的词条**：由「该题 `related_terms`」与「`glossary` 键」的并集决定；正文中出现在该集合里的术语会高亮并可点开抽屉。`related_terms` 在阶段 3 由每题新生成并与 glossary 键对齐，因此相比旧数据，可点词条可能**增多**（新题 related_terms 更全）或**减少**（个别题抽得少），随题目与 glossary 覆盖而变化。若希望统一增加可点词条，可后续增补 `glossary.json` 或调整阶段 3 的 related_terms 生成逻辑。
