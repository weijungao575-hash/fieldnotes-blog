# 真实地理轮廓与数据来源

地图使用 Natural Earth 的真实行政区及海岸线轮廓，替代原来的抽象拼图。34 个中国省级地区和 47 个日本都道府县继续使用原 ID，因此文章、照片、到访状态及自定义颜色无需迁移。

## 来源和许可

- 数据：Natural Earth，1:10m Admin 1 – States, Provinces；Admin 0 – Countries。
- 原仓库：<https://github.com/nvkelso/natural-earth-vector>。
- 源快照：`ca96624a56bd078437bca8184e78163e5039ad19`，2026-10-21 获取。
- 许可：公有领域（Public domain）。[原始许可说明](https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/LICENSE.md)及 [Natural Earth 使用条款](https://www.naturalearthdata.com/about/terms-of-use/)。
- 具体输入文件 SHA-256 校验值保存在 `geography.js` 的 `MAP_SOURCE` 中。

## 显示处理

中国使用兰伯特圆锥投影，日本使用墨卡托投影。构建时将真实坐标转换为 SVG 路径，统一量化到 0.25 个 SVG 单位，仅移除重复点和共线点，不对相邻省份分别执行会产生缝隙的曲线简化。

香港、澳门保留地理位置上的轮廓，并另设放大附图。冲绳使用明确标注的附图。日本主图保留四大岛和邻近岛屿，远离主图的部分太平洋岛屿不展开显示。Natural Earth 源中归入冲绳的奄美岛屿多边形已归到鹿儿岛。

这是一张用于旅行记录的概览地图，轮廓经过显示简化，不作为导航、测绘或边界认定依据。前台无需请求第三方地图服务器，无 API key、配额或地图服务费用。

## 重新生成

从以下固定版本下载两个 GeoJSON 文件：

- <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson>
- <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_countries.geojson>

```sh
node generate-maps.mjs /path/to/admin-1.geojson /path/to/countries.geojson
```

本地开发版生成 `dist/geography.js`；平铺仓库中脚本会生成 `geography.js`。生成后的文件随网站一起提交，访客无需下载原始大型数据。

地图支持缩放、放大后的拖动、地名显隐、状态筛选、键盘进入地区、各地区独立颜色及游记关联。更新地图代码时，继续保留线上 `content.json` 和 `uploads/`。
