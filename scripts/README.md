# 数据脚本

## 从零清洗计划（英文 PDF → 中英双语）

详见 **DATA_CLEANING_PLAN.md**。流程概要：

1. **extract_pdf_en.py**：从英文 PDF 抽取题目+选项+正确答案+投票（不抽社区讨论）→ `raw_questions_en.json`
2. **translate_en_to_cn.py**：Gemini 2 Flash Lite 翻译，术语保留英文、保持可读性与准确度 → `questions_bilingual.json`
3. **add_tags_and_explanation.py**：打标 + 解析（analysis/why_correct/why_wrong）+ related_terms → `questions_bilingual_enriched.json`
4. **build_app_questions.py**：将 bilingual/enriched 转为 App 用 `questions_v2.json`（含中英字段）

### extract_pdf_en.py 用法

```bash
pip install pdfplumber
# 英文 PDF 在用户目录下 AWS-SAA 文件夹时（$HOME 已是 /Users/你的用户名，不要写成 $HOME/ikaken/... 会变成两层）：
python3 scripts/extract_pdf_en.py "$HOME/AWS-SAA/AWS-SAA-C03 en.pdf"
# 若 PDF 在别的盘或路径，用绝对路径，例如：
# python3 scripts/extract_pdf_en.py "/Users/你的用户名/ikaken/AWS-SAA/AWS-SAA-C03 en.pdf"

# 输出默认: public/data/raw_questions_en.json
python3 scripts/extract_pdf_en.py "/path/to/file.pdf" public/data/raw_questions_en.json
```

PDF 路径在项目外时，请传入绝对路径或 `$HOME/AWS-SAA/AWS-SAA-C03 en.pdf`（PDF 在用户目录下 AWS-SAA 文件夹时）。若解析出的题目数/选项与 PDF 不一致，需根据实际排版调整脚本内正则与分块逻辑。

### translate_en_to_cn.py 用法（阶段 2，Gemini 翻译）

```bash
pip install google-generativeai
export GEMINI_API_KEY="你的API密钥"
python3 scripts/translate_en_to_cn.py
# 输入默认: public/data/raw_questions_en.json
# 输出默认: public/data/questions_bilingual.json

# 先试跑 5 题，确认无误后再全量
python3 scripts/translate_en_to_cn.py --limit 5

# 全量翻译（每 50 题为 1 set 自动断点保存）
python3 scripts/translate_en_to_cn.py

# 中断后从上次断点继续
python3 scripts/translate_en_to_cn.py --resume

# 全量/续跑跑完后，只重试之前 429 等失败题（补翻）
python3 scripts/translate_en_to_cn.py --retry-failed
```

翻译规则：题干与选项译成简体中文，保持可读性与准确度；AWS 服务名、产品名、专有名词保留英文。每处理 50 题会写入 `public/data/.translate_progress.json`，便于断点续传；完成后会自动删除。遇到 429 的题会先保留英文，跑完后用 `--retry-failed` 只对这些题再请求一次翻译。

### add_tags_and_explanation.py 用法（阶段 3，打标与解析）

```bash
export GEMINI_API_KEY="你的API密钥"
# 输入默认: questions_bilingual.json，输出: questions_bilingual_enriched.json
python3 scripts/add_tags_and_explanation.py

# 试跑 5 题
python3 scripts/add_tags_and_explanation.py --limit 5

# 中断后从断点继续（每 50 题保存）
python3 scripts/add_tags_and_explanation.py --resume

# 全量/续跑跑完后，只补漏解析为空的题（逐题请求，避免批解析失败）
python3 scripts/add_tags_and_explanation.py --fill-empty
```

会为每题生成 `tags`（考点/服务名）、`explanation`（analysis、why_correct、why_wrong）、`related_terms`（与 glossary 键对齐）。进度写入 `public/data/.enrich_progress.json`，完成后自动删除。若出现「本批 15 题解析格式异常」或「题 N 解析格式异常，保留空」，跑完后用 `--fill-empty` 只对这些题逐题重试。解析失败时 API 原始响应会追加到 `public/data/.enrich_parse_fail_log.txt`，便于排查（多为 **options_en 与 options_cn 选项数不一致** 导致，可先跑 `fix_options_en_mismatch.py` 修复源文件）。

### fix_options_en_mismatch.py（修复源文件选项数不一致）

`questions_bilingual.json` 中约 125 题为「选择两个」等多选题，英文提取时 D 和 E 被合并成一条（options_en 仅 4 键，options_cn 有 5 键），易导致阶段 3 批解析失败或单题解析异常。本脚本按 `" E. "` / `" F. "` 等拆分选项文案，为 options_en 补全 E、F 等键，与 options_cn 对齐。

```bash
# 只报告会修改的题，不写回
python3 scripts/fix_options_en_mismatch.py --dry-run

# 写回 questions_bilingual.json
python3 scripts/fix_options_en_mismatch.py
```

建议在**阶段 3 全量跑之前**先执行一次（去掉 `--dry-run`），再跑阶段 3；若已跑过阶段 3，修复源文件后可对空题跑 `--fill-empty` 补漏。

### analyze_enrich_failures.py（分析阶段 3 未完成题目的失败原因）

第一遍阶段 3 跑完后，若仍有「格式异常」或 API 失败，可先跑本脚本，对 `questions_bilingual_enriched.json` 中**尚未完成阶段 3 的题**按原因分类，再决定是先修源文件还是直接补漏。

```bash
python3 scripts/analyze_enrich_failures.py
# 或指定文件
python3 scripts/analyze_enrich_failures.py public/data/questions_bilingual_enriched.json
```

输出分类：`options_mismatch`（选项数不一致，先 fix_options_en_mismatch）、`empty_question`/`empty_options`（翻译缺失）、`correct_answer_invalid`（答案键不一致）、`no_obvious_source_issue`（多为 504/429 或解析异常，可直接 --fill-empty）。

### build_app_questions.py 用法（阶段 4，输出 App 格式）

```bash
# 默认先读 questions_bilingual_enriched.json，若无则读 questions_bilingual.json
# 输出: public/data/questions_v2.json
python3 scripts/build_app_questions.py

# 指定输入/输出
python3 scripts/build_app_questions.py public/data/questions_bilingual_enriched.json public/data/questions_v2.json
```

将 `correct_answer` 映射为 `best_answer`、`official_answer`，保留中英题干与选项，并写入 tags、explanation、related_terms（若输入无则填空）。

---

## glossary_missing_terms.py（百科缺失词条）

列出题目 `related_terms` 中在 `glossary.json` 里缺失的词条，便于补全百科；可选为缺失词条添加占位条目，避免 App 显示「暂无该术语解释」。

```bash
# 列出缺失词条，写入 public/data/missing_glossary_terms.txt
python3 scripts/glossary_missing_terms.py

# 指定输出文件
python3 scripts/glossary_missing_terms.py --output my_missing.txt

# 为所有缺失词条在 glossary.json 中添加占位条目（definition: "（待补充）"），后续可手动补全
python3 scripts/glossary_missing_terms.py --add-stubs
```

补全词条时：在 `public/data/glossary.json` 中为对应键添加或修改 `definition`、`analogy`、`features` 即可。

### fill_glossary.py（批量用 Gemini 补全百科）

用 Gemini 为「题目 related_terms 中缺失」或「glossary 里（待补充）」的词条批量生成释义，直接合并进 `glossary.json`。支持断点续跑、限流重试。

```bash
export GEMINI_API_KEY="你的API密钥"
# 全量补全（约 818 条，每 15 条一批，断点存 .fill_glossary_progress.json）
python3 scripts/fill_glossary.py

# 先试跑 30 条
python3 scripts/fill_glossary.py --limit 30

# 中断后从上次进度继续
python3 scripts/fill_glossary.py --resume

# 只补 glossary 中已有但 definition 为「（待补充）」的条目（不补缺失词条）
python3 scripts/fill_glossary.py --only-stubs
```

每批完成后会立即写回 `glossary.json`，中断后可用 `--resume` 继续。

---

## 多选题审计与答案补全（audit / fix_multiple_choice）

题干为「选二/Choose two」但 `best_answer` 仅 1 个的题目会导致多选只显示一个正确答案、解析也只写一个。先用审计脚本列出问题题，再用 Gemini 推断并补全第二（及第三）个正确选项。

### audit_multiple_choice.py

统计题干多选但答案数量不符的题目，输出 `public/data/multiple_choice_audit.json`。

```bash
python3 scripts/audit_multiple_choice.py
python3 scripts/audit_multiple_choice.py -o my_audit.json
```

### fix_multiple_choice_answers.py

根据题干+选项+解析，用 Gemini 推断全部正确选项字母并写回 `questions_v2.json`。

```bash
export GEMINI_API_KEY="你的API密钥"
python3 scripts/fix_multiple_choice_answers.py          # 全量
python3 scripts/fix_multiple_choice_answers.py --limit 5   # 试跑 5 题
python3 scripts/fix_multiple_choice_answers.py --dry-run   # 只打印建议，不写回
```

补全后 App 解析区会显示「本题需选 2 项 · 正确答案：B、C」（多选时固定展示）。

### 从 PDF 重新抽取多选题答案（推荐）

英文 PDF 中「Correct Answer: BD」等双选答案，若第一次抽取时只抽到单字母，可重新抽取后同步到 **questions_bilingual_enriched.json**，再运行 build 生成 questions_v2，最后重写解析。

1. **extract_pdf_en.py** 已支持多字母正确答案与选项 E：正则改为 `Correct\s+Answer\s*:\s*([A-E]+)`，选项支持 A-E。
2. **重新抽取 PDF**：`python3 scripts/extract_pdf_en.py "$HOME/AWS-SAA/AWS-SAA-C03 en.pdf"` → 得到含 `correct_answer: "BD"` 等的 `raw_questions_en.json`（若 PDF 在别处请用绝对路径）。
3. **sync_multi_choice_from_raw.py**：从 raw 同步「选项含 E」的题的正确答案到 **questions_bilingual_enriched.json**（只更新 correct_answer）。同步后需运行 **build_app_questions.py** 根据 enriched 重新生成 questions_v2.json。
4. **re_explain_multiple_choice.py**：对 best_answer 为两字母及以上的题，用 Gemini 重新生成解析（why_correct 说明全部正确选项，why_wrong 说明其余选项）；读写的为 questions_v2.json。

```bash
# 1. 重新抽取 PDF（输出 raw_questions_en.json）
python3 scripts/extract_pdf_en.py "$HOME/AWS-SAA/AWS-SAA-C03 en.pdf"

# 2. 同步多选题答案到 questions_bilingual_enriched.json（选项含 E 的题）
python3 scripts/sync_multi_choice_from_raw.py --dry-run   # 只预览
python3 scripts/sync_multi_choice_from_raw.py
# 2.5 根据 enriched 重新生成 questions_v2.json
python3 scripts/build_app_questions.py

# 3. 对多选题重新生成解析（需 GEMINI_API_KEY，读写 questions_v2.json）
export GEMINI_API_KEY="你的API密钥"
python3 scripts/re_explain_multiple_choice.py
python3 scripts/re_explain_multiple_choice.py --limit 5   # 试跑 5 题
python3 scripts/re_explain_multiple_choice.py --dry-run   # 只列出将处理的题
```

### 解析与答案一致性（最小化「答案 CD 但解析写 BD」）

- **原因**：阶段 3 多选时若把 `correct_answer` 当整体（如 `"CD"`），`wrong_opts` 会误含 C、D，导致 prompt 里「错误选项」包含正确选项，模型易写错。
- **已做**：`add_tags_and_explanation.py` 中多选时按字母拆 `correct_answer`（如 `"CD"` → C、D），`wrong_opts` 只含真正错误选项，prompt 中正确/错误选项明确，减少解析与答案不一致。
- **校验**：`validate_explanation_answer_match.py` 检测「解析中写到的正确选项」与 `best_answer` 是否一致，并列出多选题中解析为空（更新失败）的题。  
  `python3 scripts/validate_explanation_answer_match.py`  
  `python3 scripts/validate_explanation_answer_match.py --output-ids` → 只输出需重跑的题号（逗号分隔）。
- **重跑**：只对需重跑的题重写解析（保证一致 + 修失败）：  
  `python3 scripts/re_explain_multiple_choice.py --ids 73,92,94,...`  
  上次运行有失败时：`python3 scripts/re_explain_multiple_choice.py --retry-failed`。解析失败时 API 原始响应会追加到 `public/data/.re_explain_fail_log.txt`。
- **失败原因与修复**：见 `scripts/RE_EXPLAIN_FAIL_ANALYSIS.md`。

---

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
