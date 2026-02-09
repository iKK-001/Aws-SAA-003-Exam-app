# 第 73、92 题解析失败原因分析

## 结论摘要

| 题号 | 失败原因 | 对策 |
|------|----------|------|
| **92** | 阶段 3 批解析时，API 返回的 JSON 中该题把 `explanation` 当成**字符串**（分析内容），而把 `why_correct`、`why_wrong` 放在对象**顶层**，不符合要求的 `explanation: { analysis, why_correct, why_wrong }`，导致整批 91–105 解析失败。 | 见下文「对策」。 |
| **73** | 失败日志中**没有**包含 73 的批次（有 76–90、91–105，没有 61–75）。若当时失败，多半是批失败后逐题重试时单题仍返回异常格式或超时。当前仓库中 73、92 已有解析，说明后续 `--fill-empty` 或重跑已补上。 | 若仍缺解析，用 `--fill-empty` 补漏。 |

---

## 92 题详细原因

失败日志 `public/data/.enrich_parse_fail_log.txt` 中有一条：

```
本批 15 题 id=91,92,93,94,95,96,97,98,99,100,101,102,103,104,105
```

该批 API 返回的 JSON 数组中，**第 2 个元素（id=92）** 结构为：

```json
{
  "tags": ["S3", "VPC", "EC2", "IAM"],
  "explanation": "本题考察如何安全地从 VPC 内部的 EC2 实例访问 S3。 配置 S3 gateway endpoint 和桶策略可以实现安全访问，并且保证数据不经过公共互联网。",
  "why_correct": "A 选项正确，配置 VPC gateway endpoint 可以使 EC2 实例通过私有网络访问 S3。C 选项正确，配置桶策略，限制仅允许 VPC 内的实例访问 S3。",
  "why_wrong": "B 选项错误，使 S3 存储桶中的对象公开违反了安全最佳实践。D 选项错误，IAM 用户凭证不应该被硬编码到 EC2 实例上。 E 选项错误，NAT 实例只是提供了访问互联网的途径，不能满足安全访问 S3 的要求。"
  "related_terms": ["VPC", "EC2", "S3", "VPC gateway endpoint", "IAM", "S3 bucket policy", "NAT instance"]
}
```

脚本期望的格式是：`explanation` 为**对象**，且包含 `analysis`、`why_correct`、`why_wrong`：

- 期望：`"explanation": { "analysis": "...", "why_correct": "...", "why_wrong": "..." }`
- 实际：`"explanation": "本题考察..."`（字符串），且 `why_correct`、`why_wrong` 在对象顶层。

因此 `parse_enrich_batch_response()` 中 `exp = o["explanation"]` 得到的是字符串，`isinstance(exp, dict)` 为 False，整批解析被判失败，脚本对该批 15 题逐题回退为单题请求（`enrich_one`）。若单题请求时模型仍返回同样格式，该题会保留空解析，需后续 `--fill-empty` 或重跑补漏。

---

## 73 题说明

失败日志中**没有**出现包含 73 的批次（例如 id=61,62,…,75）。因此：

- 要么当时 61–75 批一次通过，73 未在日志中失败；
- 要么 61–75 批因其他原因（如长度不符、JSON 异常）整批失败后，逐题重试时 73 单题仍失败（会记作「题 73」；当前日志中未搜到，可能被截断或为其他运行产生）。

当前仓库里 `questions_bilingual_enriched.json` 与 `questions_v2.json` 中 73、92 均已有完整解析，说明后续补漏或重跑已成功。

---

## 对策建议

1. **补漏**：若某题仍无解析，运行  
   `python3 scripts/add_tags_and_explanation.py --fill-empty`  
   只对「解析为空」的题逐题重试，避免整批格式问题。

2. **批解析容错（推荐）**：在 `add_tags_and_explanation.py` 的 `parse_enrich_batch_response()` 中，若某题的 `explanation` 为字符串且该题对象顶层有 `why_correct`（及可选 `why_wrong`），则规范化为  
   `explanation: { "analysis": <该字符串>, "why_correct": o["why_correct"], "why_wrong": o.get("why_wrong", "") }`  
   这样 92 这类返回格式不会导致整批失败，无需逐题回退。

3. **单题解析失败**：单题重试时若仍格式异常，API 原始响应会追加到 `public/data/.enrich_parse_fail_log.txt`，标签为「题 N」，便于排查。

4. **分析未完成题**：运行  
   `python3 scripts/analyze_enrich_failures.py`  
   可列出尚未完成阶段 3 的题，并按 options_mismatch、correct_answer_invalid、no_obvious_source_issue 等分类，便于决定先修源数据还是直接 `--fill-empty`。
