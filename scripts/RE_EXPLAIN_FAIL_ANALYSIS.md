# 多选题重写解析失败原因分析与修复

## 一、目标

1. **答案与解析一致**：多选题的 `best_answer`（如 CD）与解析中写到的正确选项必须一致，不能出现「答案 CD、解析写 BD」。
2. **更新失败的题修到正确状态**：对上次运行中「解析失败」的题分析原因，并通过重试或调整后更新为正确解析。

---

## 二、常见失败原因

运行 `re_explain_multiple_choice.py` 时，单题「解析失败」通常由以下原因导致（失败时 API 原始响应会追加到 `public/data/.re_explain_fail_log.txt`）：

| 原因 | 表现 | 对策 |
|------|------|------|
| **JSON 格式异常** | 模型返回了非 JSON、或缺少 `explanation.why_correct`、或 explanation 为字符串而非对象。 | 重试通常可解决；若某题反复失败，可查看 fail log 中该题的原始响应，确认是否被截断或含非法字符。 |
| **429 / 限流** | 脚本会打印「限流，Xs 后重试」并自动重试。 | 若仍失败，用 `--retry-failed` 稍后只重试失败题，或加长脚本内 `BASE_SLEEP`。 |
| **空响应 / 被安全过滤** | `resp.text` 为空或极短。 | 查看 fail log 该题内容；若为空，多为模型拒绝输出，可稍后重试或检查题干是否含敏感词。 |
| **why_correct 未明确写选项字母** | 解析内容正确但未写「选项 C」「选项 D」，校验脚本不报错，但人工希望明确写选项。 | 已在 prompt 中要求「明确写出两个正确选项各自或共同满足题目的原因」；重跑该题即可。 |

查看失败日志示例：

```bash
# 查看最近记录的失败题
tail -n 200 public/data/.re_explain_fail_log.txt
# 查看某题 id 的失败记录
grep -A 80 "id 73" public/data/.re_explain_fail_log.txt
```

---

## 三、推荐流程（保证一致并修好失败题）

### 1. 校验并得到需重跑题号

```bash
# 列出「解析与答案不一致」+「多选题解析为空」的题
python3 scripts/validate_explanation_answer_match.py

# 只输出需重跑的题号（逗号分隔），便于复制给 re_explain --ids
python3 scripts/validate_explanation_answer_match.py --output-ids
```

### 2. 只对需重跑的题重新生成解析

```bash
export GEMINI_API_KEY="你的API密钥"

# 方式 A：使用校验脚本输出的 ID 列表（推荐）
python3 scripts/re_explain_multiple_choice.py --ids 45,151,223,233,...

# 方式 B：上次运行有失败时，只重试失败日志中的题
python3 scripts/re_explain_multiple_choice.py --retry-failed
```

### 3. 若仍有失败

- 查看 `public/data/.re_explain_fail_log.txt` 中对应题号的原始响应，判断是 JSON 形状问题、空响应还是限流。
- 再次运行 `python3 scripts/re_explain_multiple_choice.py --retry-failed` 只重试失败题。
- 校验：再次运行 `validate_explanation_answer_match.py`，确认无新不一致且无多选题解析为空。

### 4. 全量再跑一遍（可选）

若希望所有多选题解析都按「正确答案 + 明确选项字母」重写一遍（覆盖可能未写选项字母的题）：

```bash
python3 scripts/re_explain_multiple_choice.py
```

---

## 四、当前需重跑题号（由校验脚本得出）

运行一次：

```bash
python3 scripts/validate_explanation_answer_match.py --output-ids
```

将输出逗号分隔的题号，直接复制到：

```bash
python3 scripts/re_explain_multiple_choice.py --ids <粘贴输出>
```

即可只对这些题重写解析，使答案与解析一致，并尽量把之前更新失败的题修到正确状态。
