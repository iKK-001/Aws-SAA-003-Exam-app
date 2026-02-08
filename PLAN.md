# AWS SAA-C03 备考 App — 项目进度表

## Current Status

- [x] 原始 PDF 提取与清洗（parse_questions.py → questions.json）
- [x] 语义重组与题库打标（enrich_questions.py → questions_final.json）
- [x] 术语提取与词库生成（generate_questions.py → questions_v2.json + glossary.json）
- [x] App 基础脚手架（Next.js 14 + Tailwind，Mobile-First + PWA）
- [x] 首页、练习、百科、我的、模拟考入口
- [x] 练习：顺序 / 乱序 / 按分类（上位概念合并，按题数从多到少）；进入练习前先选刷题方式
- [x] 百科：按类别分组、可折叠、收藏术语；我的页展示收藏术语
- [x] 解析展示：why_correct + why_wrong；选项对错用勾叉图标；相关术语去重
- [x] 设置抽屉：关于 + 清除本地数据
- [x] 加载骨架屏、底部导航与关键操作 aria-label
- [x] 模拟考：限时 130 分钟、随机 65 题、交卷确认、结果页（得分、错题列表、加入错题本、再考一次）
- [x] **多选兼容**：题干推断多选（选二/选三/Select TWO 等）；best_answer 为 "AB" 时拆成 ["A","B"]；多选 UI、判分（全部选对才得分）、「请再选择 N 项」、选够才展示解析
- [x] **进度恢复**：顺序/按分类刷题自动从上次位置继续；「从第一题开始」可清空该列表进度
- [x] **UI 游戏化**：Quicksand 字体、超级圆角与柔和彩色阴影、QuestionCard 厚底边与选项按下感；正确/错误选项绿/红反馈；解析区「看透真相 🔍」「✅ 原来如此」「💡 记住这点」；答对/答错文案「太棒啦！✨」「没关系，下次一定行！💪」；答错反馈条用琥珀色减轻「被放大错误」感
- [x] **Mascot 与反馈**：角落 mascot 按状态变化（🤖 默认 / 🥳 连续 3 题对 / 🧐 看解析 / 🎉 刚答对 / 🤗 刚答错，约 1.5s 后恢复）；连续答对露出「🔥 连续 N 题」；完成分类/本组时 toast「XX 全部刷完！🎉」
- [x] **今日与里程碑**：首页/练习顶「今日已练 X 题」+ 按日轮换鼓励语；首次完成 10 题 toast「完成 10 题！🌟」、首次 50 题「半百达成！👏」（localStorage 记已弹，每里程碑只一次）
- [x] **术语抽屉**：有 analogy 时突出「记住：{术语} 就像 …」区块（琥珀底+边框）
- [x] **内容与记忆 — 术语抽认小卡**：百科页与「我的」页入口「随机抽一个术语（抽认卡）」→ 独立页 `/glossary/flashcard`，只显示术语名，点击翻转显示 definition + analogy（无 3D 翻转，状态切换正反面），有「再抽一张」按钮
- [x] **内容与记忆 — 错题/收藏再练**：练习页支持 URL 参数 `sample`（如 5）；在得到错题/收藏/全部等 base 后 `shuffleArray(base).slice(0, sample)` 再设 list；首页与「我的」有「错题本 · 随机 5 题再练」「收藏 · 随机 5 题再练」入口（`/practice?filter=wrong|favorite&mode=order&sample=5`）；有 filter 无 mode 时默认 `mode=order` 以便直接进练习
- [x] **内容与记忆 — 解析内术语可点**：解析正文（analysis / why_correct / why_wrong）中术语高亮且可点击；`components/HighlightTerms.tsx` 接收 text、terms、onTermClick，按术语长度从长到短切分正文，术语渲染为可点击按钮，点击打开术语抽屉；练习页术语列表为 `q.related_terms` 与 glossary 键合并去重
- [x] **视觉与音效 — 主题/皮肤**：`lib/data.ts` 增加 `getTheme()`/`setTheme('relaxed'|'focus')`、STORAGE_KEY；`app/globals.css` 用 `[data-theme="focus"]` 覆盖主色与少量背景（body、.bg-aws-slate-soft 等），专注偏冷色；LayoutClient 挂载时 `document.documentElement.dataset.theme = getTheme()`；设置抽屉内「主题/皮肤」两按钮（轻松 / 专注）；`clearAllLocalData` 后重置为 relaxed 并同步到 document
- [x] **视觉与音效 — 轻音效**：`lib/data.ts` 增加 `getSoundEnabled()`/`setSoundEnabled(boolean)`，默认关闭；`lib/sound.ts` 用 Web Audio API 实现 `playCorrectSound()`/`playWrongSound()`（极短正弦波）；练习页在判对/错并 `setShowExplanation(true)` 前若 `getSoundEnabled()` 则调用对应音效；设置抽屉内「答对/答错音效」开关

## UX/UI 规范（已落地）

- **信息层级**：题干用 `font-medium text-aws-navy`；解析区口语化标题（原来如此 / 记住这点）；辅助文案保证对比度。
- **色彩**：正确用 emerald/green，错误用 red/amber（答错反馈条用 amber 减轻压迫感）；主 CTA 可用 AWS 橙（继续冒险、今日已练等）。
- **反馈**：选项选中/正确/错误有 scale、边框与背景区分；active 态 `scale-[0.98]` + 深边框；收藏/里程碑/完成分类用 toast。
- **导航与恢复**：自动从上次题号继续；题号旁「从第一题开始」；底部导航模拟考未完成时橙色角标。
- **无障碍**：抽屉焦点与 Esc；解析与反馈 `aria-live`；选项 `aria-label`。
- **情感化**：mascot、今日已练、鼓励语、里程碑、完成分类庆祝，减少枯燥感。
- **主题**：轻松（relaxed）默认暖色；专注（focus）冷色、略深背景，仅换主色与少量背景类，不改变布局。
- **音效**：可选、默认关闭，极短提示音减少干扰。

## 可复用设计模式（套用到其他考试 App）

### 题目与练习

- **题目数据结构**：`id`, `question_cn`（题干）, `options_cn`（选项键值）, `best_answer`（单选 string / 多选 string 如 "AB" 或数组）, `tags`（分类）, `related_terms`（解析中可高亮术语）, `explanation`（`analysis`, `why_correct`, `why_wrong`）。
- **练习页 URL 约定**：`/practice?filter=wrong|favorite|all&mode=order|shuffle|topic&tag=分类名&sample=N`。`filter` 决定题源（错题/收藏/全部）；`mode` 决定顺序/乱序/按分类；`sample` 存在且合法时在 base 上先 shuffle 再 slice(0, N)，实现「随机抽 N 题再练」；有 filter 无 mode 时建议默认 `mode=order` 以便从「我的」/首页直达练习。
- **列表构建顺序**：先按 filter 取 base（错题 id 列表 / 收藏 id 列表 / 全部）；再按 mode+tag 过滤（topic 时按 tag 筛）；再按 sample 随机截断；最后 order 模式按 id 排序、shuffle 模式打乱。

### 术语与记忆

- **词库结构**：`Record<术语名, { definition, analogy?, features?: string[] }>`；analogy 用于「记住：XXX 就像 …」类比块。
- **抽认卡页**：独立路由（如 `/glossary/flashcard`）；随机取一条术语，正面仅术语名，点击切换背面（definition + analogy）；「再抽一张」重新随机；术语列表可从 glossary 的 keys 或传入的 terms 数组来。
- **解析内术语高亮**：通用组件输入 `text`、`terms`（术语名数组）、`onTermClick(term)`；切分逻辑按术语长度从长到短在正文中查找并替换为片段（text | term）；术语片段渲染为可点击控件，点击回调打开术语抽屉或弹窗；术语列表建议题目 `related_terms` 与词库 keys 合并去重，避免漏掉正文中出现但题目未标的相关术语。

### 主题与音效

- **主题**：localStorage 存 theme（如 `relaxed` / `focus`）；挂载时与设置变更时设置 `document.documentElement.dataset.theme = theme`；CSS 用 `[data-theme="focus"]` 覆盖 `:root` 或关键类（主色、背景），保证只换主色和少量背景、不改变布局。
- **音效**：localStorage 存 sound 开关，默认关闭；独立模块用 Web Audio API 播放极短提示音（如 correct 高音、wrong 低音），无外部资源；在练习页判对/错并展示解析前若开关打开则调用对应音效。
- **清除数据**：清除时将 theme 重置为默认并执行 `document.documentElement.dataset.theme = 'relaxed'`（或你项目的默认主题），避免清除后界面仍为旧主题。

### 入口与导航

- **「随机 N 题再练」**：错题本/收藏页或首页在「有错题/有收藏」时展示入口，链接到 `/practice?filter=wrong|favorite&mode=order&sample=5`（或你的 N）。
- **抽认卡入口**：百科页顶部 + 「我的」页「内容与记忆」区块，链接到抽认卡页，文案如「随机抽一个术语（抽认卡）」。

## 数据清洗（从零：英文 PDF → 中英双语）

### 原因

- 此前题目数据来自**中文 PDF + pdfplumber** 提取，存在：(1) 中文 PDF 本身翻译质量不佳，题干/选项与原文不一致；(2) 选项与 PDF 不匹配导致后续 AI 解析出现偏差；(3) 无法支持 App 中英文切换。因此改为**英文 PDF 提取 + Gemini API 翻译**，从源头保证题干/选项正确性，并支持中英双语文案。

### 步骤（详细见 scripts/DATA_CLEANING_PLAN.md）

| 阶段 | 脚本 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| 1 | `extract_pdf_en.py` | 英文 PDF 路径 | `public/data/raw_questions_en.json`（仅英文，不抽社区讨论） | ✅ 已完成 |
| 2 | `translate_en_to_cn.py` | `raw_questions_en.json` | `questions_bilingual.json`（中+英，术语保留英文，Gemini 2 Flash Lite） | 进行中 |
| 3 | 可选 | `questions_bilingual.json` | 补全 tags、explanation、related_terms | 待做 |
| 4 | `build_app_questions.py`（待写） | `questions_bilingual.json` | `questions_v2.json`（兼容现有 App，含中英字段） | 待做 |

### 阶段 1 要点（已做）

- **源 PDF**：`ikaken/AWS-SAA/AWS-SAA-C03 en.pdf`。只抽取「Question #N、题干、选项 A.–D.、Correct Answer、Community vote distribution」，不抽取社区讨论（upvoted、Highly Voted、Selected Answer、用户评论等）。
- **题块截断**：在「Correct Answer:」处切开，题干+选项只取前半段；讨论区特征（如 `upvoted X times`、`Highly Voted`、`X year ago`）出现时截断块，不纳入题干/选项。
- **空字符修复**：PDF 提取中 `\u0000`（原为 "fi"）统一替换为 "fi"，修复 "files"、"Configure"、"profile" 等。

### 阶段 2 要点（Gemini 翻译）

- **模型**：Gemini 2 Flash Lite；API Key 从环境变量 `GEMINI_API_KEY` 读取。
- **规则**：题干与选项翻译成简体中文，保持可读性与准确度；AWS 服务名、产品名、专有名词（如 Amazon S3、Lambda、DynamoDB、JSON、SQL、VPC）保留英文。

## Immediate Tasks

- [ ] **translate_en_to_cn.py**：跑通阶段 2，生成 `questions_bilingual.json`
- [ ] **build_app_questions.py**（可选）：阶段 4 输出 App 用 `questions_v2.json`
- [ ] **refine_data.py**（可选）：拆解每个错误选项的详细解析；对 related_terms 去重或规范化
- [ ] **generate_glossary.py**：若词库需增补或重跑，可调整后重新生成

## Known Issues

- PDF 提取曾存在字符前置/重影，已通过 enrich 阶段修复
- API 频率限制在脚本中已用重试与间隔处理
- 分类标签以上位概念（首词）合并，如 "ALB Health Checks" 归入 "ALB"
- 多选题干推断依赖中文/英文关键词（选二、Select TWO 等），正则不依赖 `\b`（对中文无效）

## 数据与脚本位置（供新对话参考）

- **题目与词库**：`public/data/questions_v2.json`、`glossary.json`；可选多选细化数据 `questions_v2_refined.json`
- **数据清洗中间文件**：`public/data/raw_questions_en.json`（阶段 1 输出）、`public/data/questions_bilingual.json`（阶段 2 输出）
- **数据清洗脚本与计划**：`scripts/DATA_CLEANING_PLAN.md`（从零清洗计划）、`scripts/extract_pdf_en.py`（阶段 1）、`scripts/translate_en_to_cn.py`（阶段 2）；英文 PDF 路径示例：`ikaken/AWS-SAA/AWS-SAA-C03 en.pdf`
- **脚本**：`scripts/refine_data.py` 等
- **App 根目录**：工作区内的 `exam-app/`
- **核心逻辑**：`lib/data.ts`（progress、错题/收藏、多选/判分、今日题数、里程碑、主题、音效、练习位置等）；题目卡片与选项：`components/QuestionCard.tsx`；练习页：`app/practice/page.tsx`；解析术语高亮：`components/HighlightTerms.tsx`；抽认卡页：`app/glossary/flashcard/page.tsx`；音效：`lib/sound.ts`
- **设置与主题**：设置抽屉 `components/Drawer.tsx`（关于、主题、音效、清除数据）；主题 CSS 覆盖在 `app/globals.css` 的 `[data-theme="focus"]`；LayoutClient 挂载时同步 `dataset.theme`
