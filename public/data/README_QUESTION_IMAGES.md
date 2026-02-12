# 题干可能含图的题目（题源 PDF 中为图片，抽取时未得到正文）

以下题目在题干中引用了「下列策略」「以下 JSON」等，但冒号后没有对应内容，说明题源里很可能是**图片/代码块**，阶段 1 抽取时未识别。若你手头有原 PDF，可对照补图或补文。

| 题号 | 题干要点 | 状态 |
|------|----------|------|
| **96** | "created the following policy associated with an IAM group... What is the effect of this policy?" | ✅ 已补图 `question_image: /data/images/96.png` |
| **423** | "use the following JSON text as an identity-based policy... Which IAM principals can..." | ✅ 已补图 `question_image: /data/images/423.png` |
| **429** | "The following IAM policy is attached to an IAM group... What are the effective IAM permissions..." | ✅ 已补图 `question_image: /data/images/429.png` |
| **477** | "created the following IAM policy to provide access to the bucket... Which statement should a solutions architect add..." | ✅ 已补题干图 + 选项图（question_image + options_image A/B/C/D） |
| **494** | "using an IAM role that has the following IAM policy attached: What is the cause of the unsuccessful request?" | ✅ 已补图 `question_image: /data/images/494.png` |

## 补图方式

1. 将题目对应的截图放到 `public/data/images/`，命名为 `{题号}.png`（如 `423.png`）。
2. 在 `questions_v2.json` 和 `questions_bilingual_enriched.json` 中，为该题增加字段：`"question_image": "/data/images/{题号}.png"`。
3. 题干中若之前加过「未录入」说明，可删掉，改由附图展示内容。

## 说明

- 题干里「consists of the following: • 列表项」这类**列表已在正文中**的题未列入，只列了「following policy/JSON」后**直接接问句、中间无内容**的题。
- 若某题你确认源题没有图、只是纯文本遗漏，可在清洗脚本或 raw 里补文本后重跑流程，不必用图。
