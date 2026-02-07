# V1.0 发布前检查清单

## 一、代码与 Lint（已检查）

- **Lint**：`app`、`components`、`lib` 下无 linter 报错。
- **重复导入**：各文件内 `Link` 等符号仅导入一次（profile 已修复重复 `import Link`）。
- **关键依赖**：DataContext 拉取 `/data/questions_v2.json`、`/data/glossary.json`；Drawer 使用 `onClose`；LayoutClient 挂载时同步 `dataset.theme`；练习页 `sample` 在 useEffect 依赖数组中。

## 二、路由与入口（已检查）

| 路由 | 用途 | 状态 |
|------|------|------|
| `/` | 首页 | ✓ |
| `/practice` | 练习（可选 ?filter=&mode=&tag=&sample=） | ✓ |
| `/practice?filter=wrong&mode=order&sample=5` | 错题随机 5 题 | ✓ |
| `/practice?filter=favorite&mode=order&sample=5` | 收藏随机 5 题 | ✓ |
| `/glossary` | 百科 | ✓ |
| `/glossary/flashcard` | 术语抽认卡 | ✓ |
| `/mock` | 模拟考入口 | ✓ |
| `/mock/run` | 模拟考进行中 | ✓ |
| `/mock/result` | 模拟考结果 | ✓ |
| `/profile` | 我的 | ✓ |

首页、百科、我的页中的「随机 5 题再练」「抽认卡」等链接与上述路由一致。

## 三、数据与资源（已检查）

- **题目与词库**：`public/data/questions_v2.json`、`public/data/glossary.json` 存在。
- **manifest**：`public/manifest.json` 存在，含 name、short_name、start_url、icons 等。
- **PWA 配置**：`next.config.js` 使用 `@ducanh2912/next-pwa`，开发环境禁用、生产构建输出到 public。

## 四、发布前需你确认的事项

### 1. PWA 图标 ✅

- `public/icons/icon-192.png`、`public/icons/icon-512.png` 已就绪，manifest 引用正确。

### 2. 构建与运行

- 请在本地执行一次生产构建与启动，确认无编译错误与运行时问题：
  - `npm run build`
  - `npm run start`
- 建议在真机或模拟器中测试：底部导航、练习（含 sample 再练）、抽认卡、设置（主题/音效）、解析内术语点击、模拟考流程。

### 3. 版本号 ✅

- `package.json` 已设为 `"version": "1.0.0"`。

## 五、功能流程速览（便于回归测试）

1. **首页**：今日已练、进度、入口（练习/模拟考/百科）、错题·随机 5 题、收藏·随机 5 题（有数据时显示）。
2. **练习**：选择方式（顺序/乱序/按分类）→ 做题 → 解析（术语可点）→ 上一题/下一题；从「我的」或首页进入「随机 5 题」应只练 5 题。
3. **百科**：分类折叠、术语列表、抽认卡入口、收藏术语。
4. **抽认卡**：随机术语、点击翻转、再抽一张、返回百科。
5. **我的**：昵称、考试日期、小助手开关、内容与记忆（抽认卡、错题/收藏再练）、收藏术语、设置入口。
6. **设置抽屉**：关于、小助手陪伴语、主题（轻松/专注）、答对/答错音效、清除本地数据。
7. **模拟考**：开始 → 限时 65 题 → 交卷 → 结果页（错题列表、加入错题本、再考一次）。

---

## 六、发布执行步骤

1. **本地构建**（在项目根目录执行）：
   ```bash
   npm run build
   npm run start   # 可选：本地验证生产包
   ```
2. **打 Git 标签**（建议）：
   ```bash
   git add -A && git status
   git commit -m "chore: release v1.0.0"
   git tag v1.0.0
   git push origin main --tags   # 或你的默认分支名
   ```
3. **部署**：按你的托管方式（Vercel / Netlify / 自建等）部署 `next build` 产物（或连接仓库自动构建）。
4. **验证**：部署完成后访问线上地址，测试首页、练习、百科、抽认卡、设置、模拟考；在手机端「添加到主屏幕」确认 PWA 图标与名称正确。

按上述清单逐项确认后，即可发布 V1.0。
