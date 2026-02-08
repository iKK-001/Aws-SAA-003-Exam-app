# 从零开始数据清洗计划（英文 PDF → 中英双语 App）

## 目标

1. **源文件**：英文 PDF（题目 + 正确答案 + 社区投票），**不抽取**社区讨论内容。
2. **流程**：PDF 提取（英文）→ API 翻译成中文（术语保留英文）→ 打标与解析 → 输出 App 可用的中英双语文案。
3. **结果**：题目数据同时包含英文与中文，支持 App 中英文切换；翻译质量优于「直接用中文 PDF」，术语统一保留英文。

---

## 一、源文件与抽取范围

| 项目 | 说明 |
|------|------|
| **英文 PDF 路径** | `ikaken/AWS-SAA/AWS-SAA-C03 en.pdf`（或你机器上的实际路径） |
| **只抽取（截图 1 对应内容）** | 问题 ID、题目正文、选项 A/B/C/D、正确答案（以社区投票率为准） |
| **不抽取（截图 2 对应内容）** | 社区讨论、用户评论、Selected Answer、upvoted、Highly Voted 等 |

**英文题块典型结构（供解析用）：**

- 左上：`Question #94`
- 右上：`Topic 1`（可选）
- 一段或多段：题干
- `A.` `B.` `C.` `D.` 各一行/多行
- `Correct Answer: C`
- `Community vote distribution` + 条形图（可解析出投票率，如 C (100%)）

**讨论区起始特征（遇到即停止当前题块）：**

- 出现用户评论、`Selected Answer: C`（评论框内）、`upvoted X times`、`Highly Voted`、`Most Recent` 等，视为讨论区，不纳入题目正文与选项。

---

## 二、整体流程（四阶段）

```
英文 PDF
    → [阶段 1] PDF 提取（pdfplumber）→ raw_questions_en.json（仅英文）
    → [阶段 2] 翻译（Gemini API）→ questions_bilingual.json（中+英，术语保留英文）
    → [阶段 3] 打标与解析（可选）→ 补全 tags、explanation、related_terms
    → [阶段 4] 输出 App 格式 → questions_v2.json（兼容现有 App，并增加英文字段）
```

---

## 三、阶段 1：PDF 提取（仅英文）

### 3.1 输入与输出

- **输入**：英文 PDF 绝对路径（或相对项目根路径）。
- **输出**：`raw_questions_en.json`，每道题一条记录，仅英文。

### 3.2 输出单条结构（建议）

```json
{
  "id": 94,
  "topic": "1",
  "question_en": "A company is designing an application...",
  "options_en": {
    "A": "Configure Amazon EMR to read text files...",
    "B": "Configure Amazon S3 to send event notification...",
    "C": "Configure Amazon S3 to send event notification...",
    "D": "Configure Amazon EventBridge..."
  },
  "correct_answer": "C",
  "vote_percentage": "100%"
}
```

### 3.3 实现要点

1. **用 pdfplumber 打开 PDF**，按页或按全文取文本；若排版稳定，可优先按「每页一题」或「Question #N」分块。
2. **题块识别**：用正则匹配 `Question #(\d+)`、`Topic (\d+)`、`Correct Answer:\s*([A-D])`、`Community vote distribution` 及条形图旁百分比（如 `C (100%)`），确定每题的起止范围。
3. **选项解析**：在题块内匹配 `A.` `B.` `C.` `D.` 作为选项起始，到下一选项或到 `Correct Answer` 为止截取为对应选项正文；注意选项可能多行。
4. **讨论区过滤**：一旦出现 `upvoted`、`Highly Voted`、用户名校验（或已知讨论区页眉/版式），则当前题块在该页的后续内容不再当作题干/选项；下一题以下一个 `Question #(\d+)` 开始。
5. **脚本位置与用法建议**：`scripts/extract_pdf_en.py`，用法示例：
   ```bash
   python3 scripts/extract_pdf_en.py "/path/to/AWS Certified Solutions Architect - Associate SAA-C03 1019题 题目+答案+讨论.pdf"
   ```
   输出默认 `public/data/raw_questions_en.json`（或通过参数指定）。

### 3.4 校验

- 题目总数约 1019；抽查若干题，确认 id、题干、选项、正确答案、投票率与 PDF 一致，且无讨论内容混入。

---

## 四、阶段 2：翻译（英文 → 中文，术语保留英文）

### 4.1 输入与输出

- **输入**：`raw_questions_en.json`。
- **输出**：`questions_bilingual.json`，在原有英文字段基础上增加中文题干与选项。

### 4.2 翻译规则（与截图 3 一致）

- **题干与选项**：整段翻译成中文，但**以下保持英文**：
  - AWS 服务名：Amazon S3、Amazon EMR、Amazon SQS、AWS Lambda、Amazon DynamoDB、Amazon EventBridge、Amazon Kinesis Data Streams、Amazon Aurora DB、Amazon EC2、Amazon CloudWatch Events 等。
  - 产品/功能名：S3、Lambda、DynamoDB、EMR、SQS、EventBridge、Kinesis、Aurora、EBS、Glue、Athena、Redshift 等。
  - 专有名词与缩写：JSON、SQL、VPC、IAM、ETL 等。
- **实现方式**：调用 **Gemini API**，在 system/user prompt 中明确写出「翻译成简体中文，但列表中列出的 AWS/技术术语不翻译、保留英文」；可把常见术语列表写进 prompt，减少漏翻。

### 4.3 输出单条结构（建议）

在阶段 1 的每条上增加中文字段，例如：

```json
{
  "id": 94,
  "topic": "1",
  "question_en": "A company is designing...",
  "question_cn": "一家公司正在设计一个应用程序，用户可上传小文件到 Amazon S3。上传后需一次性简单处理...",
  "options_en": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "options_cn": {
    "A": "配置 Amazon EMR 从 Amazon S3 读取文本文件...",
    "B": "配置 Amazon S3 向 Amazon SQS 队列发送事件通知...",
    "C": "配置 Amazon S3 向 Amazon SQS 队列发送事件通知，使用 AWS Lambda...",
    "D": "配置 Amazon EventBridge 在有新文件上传时向 Amazon Kinesis Data Streams 发送事件..."
  },
  "correct_answer": "C",
  "vote_percentage": "100%"
}
```

### 4.4 实现要点

- 脚本：`scripts/translate_en_to_cn.py`，读 `raw_questions_en.json`，逐题或按批调用 Gemini（注意 rate limit），写回 `questions_bilingual.json`。
- 建议：对题干、选项 A–D 分别调用或合并为一条「题干+选项」请求，在 prompt 中强调「术语不翻译」；可先对少量题试跑，确认格式与术语后再全量跑。
- API Key：从环境变量或配置文件读取（如 `GEMINI_API_KEY`），不要写死在代码里。

---

## 五、阶段 3：打标与解析（可选，可后续做）

### 5.1 目的

- 为每道题补充：**tags**（考点/分类）、**explanation**（analysis、why_correct、why_wrong）、**related_terms**（术语列表），以便 App 展示解析与术语高亮。

### 5.2 数据来源

- **tags**：可由 `topic` 映射，或根据题干/选项用关键词/规则/小模型打标（如 S3、Lambda、DynamoDB）。
- **explanation**：建议基于**中文题干 + 中文选项 + 正确答案**调用 Gemini 生成三段：考查点、为何正确、为何错误；生成时明确「技术术语保留英文」。
- **related_terms**：从题干与选项中抽取服务名/产品名（与 glossary 对齐），或由解释文本中抽取。

### 5.3 输出

- 在 `questions_bilingual.json` 上增加字段：`tags`、`explanation`（如 `analysis_cn`、`why_correct_cn`、`why_wrong_cn`）、`related_terms`；若需英文解析可再加 `analysis_en` 等。

### 5.4 实现

- **已实现**：`scripts/add_tags_and_explanation.py`。读 `questions_bilingual.json`，调用 Gemini 生成 tags、explanation、related_terms，输出 `questions_bilingual_enriched.json`。支持 `--resume`（每 50 题断点）、`--limit`。related_terms 与 `glossary.json` 键对齐。

---

## 六、阶段 4：输出 App 格式（兼容现有 + 中英双语）

### 6.1 目标

- 生成 App 当前使用的 `questions_v2.json` 结构，并**增加英文字段**，便于后续做中英文切换。

### 6.2 建议的 App 单条结构（兼容现有 + 双语）

```json
{
  "id": 94,
  "topic": "1",
  "question_cn": "一家公司正在设计...",
  "question_en": "A company is designing...",
  "options_cn": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "options_en": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "best_answer": "C",
  "vote_percentage": "100%",
  "official_answer": "C",
  "tags": ["Amazon S3", "Amazon SQS", "AWS Lambda", "Amazon DynamoDB"],
  "explanation": {
    "analysis": "考查 S3 事件通知 + SQS + Lambda 实现无服务器处理...",
    "why_correct": "选项 C 使用 S3 事件通知触发 SQS，由 Lambda 消费并处理，再写入 DynamoDB，操作开销最小。",
    "why_wrong": "选项 A 使用 EMR 和 Aurora，适合大批量而非按文件触发；选项 B 使用 EC2 需维护；选项 D 使用 EventBridge 和 Kinesis，复杂度更高。"
  },
  "related_terms": ["Amazon S3", "Amazon SQS", "AWS Lambda", "Amazon DynamoDB", "Amazon EMR", "Amazon Aurora", "Amazon EC2", "Amazon EventBridge", "Amazon Kinesis Data Streams"]
}
```

- 现有 App 只读 `question_cn`、`options_cn`、`best_answer`、`explanation`、`related_terms` 等即可，**无需改代码**即可继续用。
- 后续做「中英文切换」时，前端根据语言选择读 `question_cn`/`question_en`、`options_cn`/`options_en` 即可。

### 6.3 脚本建议

- **已实现**：`scripts/build_app_questions.py`。默认读 `questions_bilingual_enriched.json`（若无则读 `questions_bilingual.json`），输出 `public/data/questions_v2.json`。字段映射：correct_answer → best_answer / official_answer，保留中英题干与选项；若输入无 tags/explanation/related_terms 则填空。

---

## 七、脚本与文件一览（建议）

| 脚本 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `extract_pdf_en.py` | 英文 PDF 路径 | `raw_questions_en.json` | 只抽题目+选项+正确答案+投票，不抽讨论 |
| `translate_en_to_cn.py` | `raw_questions_en.json` | `questions_bilingual.json` | Gemini 翻译，术语保留英文 |
| `add_tags_and_explanation.py`（可选） | `questions_bilingual.json` | 同文件或新文件 | 打标 + 生成解析 + related_terms |
| `build_app_questions.py` | `questions_bilingual.json` | `questions_v2.json` | 生成 App 所需格式（含中英字段） |

### 中间/最终文件

- `public/data/raw_questions_en.json`：阶段 1 输出。
- `public/data/questions_bilingual.json`：阶段 2 输出（阶段 3 可在此基础上追加字段）。
- `public/data/questions_v2.json`：阶段 4 输出，App 直接使用。

---

## 八、执行顺序与注意事项

1. **顺序**：阶段 1 → 2 → 4 必做；阶段 3 可与 4 合并或延后。
2. **PDF 路径**：`ikaken/AWS-SAA/` 在项目外，脚本通过**命令行参数或配置文件**接收 PDF 路径，避免写死。
3. **API Key**：Gemini 的 key 用环境变量（如 `GEMINI_API_KEY`）或本地配置文件，不要提交到仓库。
4. **备份**：全量覆盖 `questions_v2.json` 前，先备份当前 `questions_v2.json` 和 `glossary.json`；若词库与题目强绑定，可等题目稳定后再决定是否重跑 glossary。
5. **术语列表**：翻译前整理一份「保留英文」的术语列表（AWS 服务名、产品名、缩写），在阶段 2 的 prompt 中显式列出，可显著减少误译。

按此计划即可从英文 PDF 从零清洗到支持中英双语的 App 数据；先实现阶段 1 与 2，再视需要补阶段 3 与 4。
