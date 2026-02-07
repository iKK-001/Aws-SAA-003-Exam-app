# AWS SAA 备考 App

Next.js 14 + Tailwind 的「手机优先」备考脚手架，支持 PWA、底部导航、抽屉式名词解释与本地进度。

## 功能

- **响应式**：移动端底部 Tab Bar（首页、练习、模拟考、百科、我的），桌面端左侧边栏
- **抽屉**：名词解释、设置在手机端自底向上抽屉展示（Shadcn 风格）
- **PWA**：可添加到主屏幕，支持离线访问题目/词库数据
- **数据**：从 `public/data/questions_v2.json`、`public/data/glossary.json` 加载；进度、错题、收藏、考试日期目标存 localStorage

## 数据准备

将题目与词库放入 `public/data/`：

```bash
cp /path/to/AWS-SAA/questions_v2.json exam-app/public/data/
cp /path/to/AWS-SAA/glossary.json exam-app/public/data/
```

## 开发

```bash
cd exam-app
npm install
npm run dev
```

浏览器打开 http://localhost:3000 。移动端体验可用 DevTools 设备模拟或真机访问同一局域网地址。

## 构建与 PWA

```bash
npm run build
npm start
```

生产环境会生成 Service Worker，支持离线与「添加到主屏幕」。如需 PWA 图标，请将 `icon-192.png`、`icon-512.png` 放入 `public/icons/`。

## 技术栈

- Next.js 14 (App Router)
- Tailwind CSS
- next-pwa
- Radix UI（Drawer 可后续接入 @radix-ui/react-dialog 等）
