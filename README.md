# 山海之间 · GitHub 写作版

网站：<https://weijungao575-hash.github.io/fieldnotes-blog/>

后台：<https://weijungao575-hash.github.io/fieldnotes-blog/#/admin>

这是一个直接使用 GitHub 存储的个人博客。无需租服务器、部署数据库或配置第三方登录服务。

## 第一次使用

1. 打开后台，展开“第一次使用：如何获得令牌”。
2. 登录仓库所有者的 GitHub 账号，在 GitHub 的 fine-grained personal access token 页面创建访问令牌。
3. Resource owner 选择 **weijungao575-hash**。
4. Repository access 选择 **Only select repositories**，只选 **fieldnotes-blog**。
5. Repository permissions 仅需 **Contents: Read and write**；Metadata 读取权限由 GitHub 自动添加。不需要 Workflows、账户管理或其他仓库权限。
6. 由你本人生成令牌，将它输入博客后台，然后连接。不要将令牌提交到仓库或发给他人。

令牌只发送到 `https://api.github.com`。默认只在页面内存中使用；勾选“当前标签页会话中记住授权”后放入 sessionStorage，点击断开连接会清除。令牌有效期结束后，需要本人重新生成并连接。

## 写文章和上传照片

1. 点击“写新文章”，填写标题、摘要与富文本正文。
2. 旅行手记至少选择一个地区，也可关联多个地区。日常随笔无需地区。
3. 选择 JPG、PNG 或 WebP 照片，最多 8 张，每张原文件不超过 8 MB。浏览器自动压缩到最长边 1400px；首张作为封面。
4. “保存本机草稿”只存在此浏览器，不上传，也不影响已发布版本。
5. “发布到 GitHub”会把照片存入 `uploads/`，文章保存到 `content.json`，并在同一笔 Git 提交中更新。
6. 提交成功后会显示提交链接。GitHub Pages 自动部署完成后，其他访客刷新即可看到新内容。点击“检查网站更新”可确认新版本已上线。

本仓库为公开仓库，已发布的文字、照片、足迹和提交历史都可以被访问。本机草稿不进入仓库。

## 地图着色

后台“足迹与着色”中可以修改 81 个地区的状态和独立颜色。调整完成后点击“保存足迹到 GitHub”。地区页面上的“编辑足迹与颜色”也可直接提交一个地区。

已到访统计仅计入“到访”和“居住”。状态、颜色和文章数量彼此独立。

## 冲突、失败与恢复

- 发布前读取仓库最新版本，合并其他文章的修改。
- 同一篇文章或同一个地区被其他设备修改时，会拒绝覆盖并提示冲突。
- 不使用 force push，保留其他网站文件与仓库提交历史。
- 照片上传失败时，文章不会被半途发布。
- 发布前会尝试保存一份本机恢复草稿。失败时正文仍留在当前页面，修复网络或权限后可重试。
- 已发布内容可通过 GitHub 提交历史恢复；本机草稿可在“数据备份”中导出 JSON。

## 从旧演示版迁移

旧版编辑器只保存浏览器数据。连接 GitHub 后，在“数据备份”点击“读取旧版浏览器文章”；或先在旧浏览器导出 JSON，再在新版导入。

导入的文章先成为本机草稿，逐篇确认后发布。导入不会覆盖 GitHub 上的足迹或直接公开草稿。

## 仓库文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 可直接部署的完整网页，包括 CSS、代码与示例 SVG 插画 |
| `content.json` | 对外展示的文章、地区状态和颜色 |
| `uploads/` | 后台发布时自动创建，存放照片 |
| `app.js` | 页面与编辑器的可编辑源代码 |
| `github.js` | GitHub API 登录、提交、媒体上传与冲突处理 |
| `content-model.js` | 内容校验与本机草稿 |
| `data.js` | 地图拼图几何与初始内容 |
| `store.js` | 公共数据查询与旧版备份迁移 |
| `styles.css` | 页面样式 |
| `shell.html`、`assets-inline.json`、`bundle-lib.mjs`、`build.mjs` | 生成部署 HTML 的模板、插画和打包工具 |
| `checks.test.js`、`github.test.js` | 地图完整性、上传失败、冲突、草稿隔离和凭据边界测试 |

## 开发和更新代码

需要 Node.js 20+，不需要安装 npm 依赖。

```sh
npm run check
npm run build
```

将修改的源文件和新生成的 `index.html` 提交到 `main`，Pages 会自动部署。日常发布文章不需要运行这些命令。

**更新代码时保留现有 `content.json` 和 `uploads/`。不要用初始示例内容覆盖已发布文章。** 浏览器访客始终从线上 `content.json` 读取内容；打包 HTML 中的初始内容只用于离线预览。

本版本已通过涵盖上述保存与冲突行为的自动检查。真实账号授权、第一次实际上传与最终线上发布效果需结合部署验证记录确认。
