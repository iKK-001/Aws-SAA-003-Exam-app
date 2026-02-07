# 数据脚本

## refine_data.py

将题目转换为**多选兼容格式**，供 App 支持单选/多选统一数据结构。

### 识别逻辑

- **多选**：`best_answer` 或 `official_answer` 含多个字母（如 `"A, C"`、`"AC"`），或题干 `question_cn` 含「选择两个」「选择三个」「Select TWO」等关键词。

### 字段重构

- `best_answer`、`official_answer` 统一为**字符串数组**（如 `"A"` → `["A"]`，`"A, C"` → `["A", "C"]`）。
- 新增 `is_multiple`（Boolean）、`answer_count`（Number）。

### 解析修正

- 多选时若 `why_correct` 未明确覆盖所有正确项，会在末尾追加说明：「（本题为多选题，正确项为：A、C，需全部选对才得分。）」

### 用法

```bash
# 默认：读 public/data/questions_v2.json，写 public/data/questions_v2_refined.json
python3 scripts/refine_data.py

# 指定输入/输出
python3 scripts/refine_data.py 输入.json 输出.json
```

### 使用 refined 数据

- 输出为 `public/data/questions_v2_refined.json`。若要让 App 使用，可将该文件覆盖 `public/data/questions_v2.json`，并更新 App 中题目类型与答题逻辑以支持 `best_answer` 为数组及 `is_multiple` 多选 UI。
