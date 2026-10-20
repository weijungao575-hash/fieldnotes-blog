# GitHub 写作后台验收记录

日期：2026-10-21。网站通过 GitHub Pages 托管，不使用额外服务器或数据库。

- 真实账号 `weijungao575-hash` 成功连接并读取仓库中的 5 篇文章。
- 通过网站富文本编辑器更新示例文章，同时选择一张不含个人信息的测试图片。
- [文章和照片在同一笔提交中保存](https://github.com/weijungao575-hash/fieldnotes-blog/commit/fe9c18a98634576ef4a160d0d3d5c9f6ada9fdb1)。图片以独立 JPG 文件存入 `uploads/`。
- [通过后台保存四川地区状态和独立颜色](https://github.com/weijungao575-hash/fieldnotes-blog/commit/5190a2c6e98e893853c97bd06464f51c95d17fdd)，其他文章保持原样。
- [GitHub Pages 自动部署成功](https://github.com/weijungao575-hash/fieldnotes-blog/actions/runs/39452626166)。未登录的浏览器页面确认了新正文、320×200 图片及地区页状态。
- 后台“检查网站更新”显示“网站已更新，访客可以看到最新内容”。
- 验收后恢复原示例文章的正文、封面和地区足迹；测试图片作为验收资产保留，未关联到公开文章。
- 浏览器请求调用方式的兼容性问题已修复，22 项自动检查通过。令牌不进入源码、内容文件、照片或仓库。

学术主页、个人资料和友情链接中的示例信息仍需替换为站主真实资料；此验收针对文章、图片和地图的 GitHub 保存与发布流程。
