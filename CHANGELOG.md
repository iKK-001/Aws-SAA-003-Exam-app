# 更新日志

## 近期更新（2025-02）

### 题目附图

- **题干图**：支持 `question_image` 字段，题干下方展示题目附图。已为 96、423、429、494、477 补题干图（`public/data/images/`）。
- **选项图**：支持 `options_image`（A/B/C/D 各对应一张图），选项区域展示图片 + 下方保留文字说明。477 题已补全题干图 + 四个选项图（477.png、477_A.png～477_D.png）。
- **数据与类型**：`lib/data.ts` 中 `Question` 新增可选字段 `question_image?`、`options_image?: Record<string, string>`；`questions_v2.json` 与 `questions_bilingual_enriched.json` 中对应题目已写入上述字段。
- **构建透传**：`scripts/build_app_questions.py` 的 `to_app_item` 已透传 `question_image` 和 `options_image`，从 enriched 生成 v2 时不会丢失。
- **文档**：`public/data/README_QUESTION_IMAGES.md` 记录各题附图状态及补图方式。

### 进步曲线

- **答题记录**：`lib/data.ts` 增加 `answerHistory` 存储与 `addAnswerRecord(questionId, correct)`，每次作答写入一条记录。
- **进步曲线页**：`/progress` 展示按日正确率、每 20 题/每 50 题正确率曲线（或等价统计）。
- **导航**：底部导航中间项由「模拟考」改为「进步」，入口为进步曲线页；侧边栏同步更新。

### 体验与数据

- **切题滚动**：练习页切换上一题/下一题（或「继续冒险」）时，主内容区滚动到顶部，避免解析过长时停留在底部。
- **答案与解析**：以社区投票率最高的选项为准；450、451、455、493、598、929、592 等题答案与解析已按社区投票修正；解析中增加「本题以社区投票为准」类说明。脚本：`apply_community_answers.py`、`re_explain_community_answers.py` 等。
- **题 96 备注**：题目数据中为 96 题增加缺失 policy 内容的说明（题干/附图说明），便于后续补全或校对。

### 组件与渲染

- **QuestionCard**：有 `question_image` 时在题干下方显示题干图；有 `options_image[key]` 时在对应选项下显示选项图，下方保留选项文字。
