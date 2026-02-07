# 部署到 Netlify（经 GitHub）

按下面顺序做一遍即可完成部署。

---

## 一、在 GitHub 上建仓库并推送代码

### 1. 在 GitHub 新建仓库

- 打开 https://github.com/new
- **Repository name**：填 `exam-app` 或你喜欢的名字（如 `aws-saa-app`）
- **Public**，不要勾选 “Add a README” / “Add .gitignore”（本地已有）
- 点 **Create repository**

### 2. 在本地初始化 Git 并推送

在终端里进入项目目录，执行（把 `你的用户名` 和 `仓库名` 换成你刚建的）：

```bash
cd /Users/ikaken/cursor-workspace/exam-app

git init
git add -A
git status
git commit -m "chore: release v1.0.0"

git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main

git tag v1.0.0
git push origin v1.0.0
```

- 若用 SSH：`git remote add origin git@github.com:你的用户名/仓库名.git`
- 第一次 push 若提示登录，按 GitHub 提示用浏览器或 Personal Access Token 完成认证。

---

## 二、在 Netlify 里部署

### 1. 连接 GitHub 仓库

- 打开 https://app.netlify.com
- 登录后点 **Add new site** → **Import an existing project**
- 选 **Deploy with GitHub**，授权 Netlify 访问 GitHub
- 在列表里选你刚推送的 **仓库名**

### 2. 构建配置（一般不用改）

- **Branch to deploy**：`main`
- **Build command**：已由项目里的 `netlify.toml` 设为 `npm run build`
- **Publish directory**：留空，让 Netlify 按 Next.js 自动识别

直接点 **Deploy site**。

### 3. 等构建完成

- 第一次会跑几分钟（安装依赖 + `npm run build`）
- 成功后会给你一个 `https://xxx.netlify.app` 的地址，点进去就是线上站

### 4. 以后更新

改完代码后执行：

```bash
git add -A
git commit -m "你的提交说明"
git push origin main
```

Netlify 会自动重新构建并发布，无需再点部署。

---

## 三、可选：自定义域名

在 Netlify：**Site settings** → **Domain management** → **Add custom domain**，按提示把域名指到 Netlify 即可。

---

当前项目里已准备好：

- **.gitignore**：忽略 `node_modules`、`.next`、PWA 生成文件、`.env` 等，避免不该提交的文件进仓库  
- **netlify.toml**：构建命令 `npm run build`、Node 18，Netlify 会按 Next.js 正确发布

按上面“一、二”做完，就可以用 Netlify 的网址访问你的 AWS SAA 备考 App。
