<p align="center">
  <img src="public/TESS.png" alt="TESS Logo" width="128" />
</p>

<h1 align="center">TESS — 卡组代码解析器</h1>

<p align="center">
  <strong>Hearthstone Deck String Tessellator</strong>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="#功能特性">功能特性</a> |
  <a href="#部署方式">部署方式</a> |
  <a href="https://hearthstonejson.com">数据来源</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/YOUR_USERNAME/TESS?style=social" alt="GitHub stars" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/vue-3.x-brightgreen.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/vite-5.x-purple.svg" alt="Vite 5" />
</p>

---

## 项目简介

TESS（**Tess**ellator，卡组代码解析器）是一个纯浏览器端的炉石传说卡组代码解析工具。它将 Base64 编码的卡组字符串解码为结构化数据，并以颜色标注的方式直观展示代码的每个部分——从保留字节、版本号、英雄 ID 到单张/双张/多张卡牌、附属卡牌及尾部填充。

所有解析计算均在**浏览器端完成**，无需任何后端服务器，可完美部署于 GitHub Pages 等静态托管平台。

## 功能特性

- **代码分块颜色标注** — 卡组代码的每个分区用不同颜色高亮显示，鼠标悬浮可查看分区名称，配有图例说明。
- **解码后的 Varint 序列** — 可展开查看每个 LEB128 varint 的解码值、字节范围、所属分区，卡牌 DbfId 悬浮可查看卡图。
- **卡图悬浮预览** — Varint 序列中鼠标悬停于卡牌条目上可看到对应卡牌原画。
- **卡牌分组解析** — 按照编码结构将卡牌分为单张组、双张组、多张组、附属卡牌组，每组展示卡牌详情。
- **费用曲线** — 可展开查看主卡组的法力费用分布柱状图。
- **卡牌列表与筛选** — 按费用、稀有度筛选卡牌，附属卡牌独立展示。
- **英雄原画** — 卡组概览使用英雄完整肖像原画（512px），而非卡牌渲染图。
- **中英文切换** — 界面支持中文/英文一键切换，卡图随语言切换对应语言版本，网页标题同步更新。
- **卡牌数据库离线缓存** — 卡牌数据从 HearthstoneJSON CDN 获取后缓存至浏览器 IndexedDB，24 小时有效期内无需重新下载。
- **零后端** — 纯静态站点，所有解析、富化、图片加载均在浏览器中完成。

## 技术栈

- **[Vue 3](https://vuejs.org/)** — Composition API + `<script setup>`
- **[Vite 5](https://vitejs.dev/)** — 构建工具
- **[vue-i18n](https://vue-i18n.intlify.dev/)** — 国际化
- **[HearthstoneJSON](https://hearthstonejson.com/)** — 卡牌数据与美术 CDN
- **[GitHub Pages](https://pages.github.com/)** — 静态托管

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/TESS.git
cd TESS

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

## 部署方式

### GitHub Pages（推荐）

本仓库包含 GitHub Actions 工作流（`.github/workflows/deploy.yml`），每次推送到 `main` 分支会自动构建并部署到 GitHub Pages。

1. Fork 本仓库
2. 前往 **Settings** → **Pages** → 设置 **Source** 为 **GitHub Actions**
3. 推送到 `main` 分支 — 站点将上线至 `https://<你的用户名>.github.io/TESS/`

### 手动部署

```bash
npm run build
# 将 dist/ 目录上传至任意静态托管服务
```

## 工作原理

1. **Base64 解码** 卡组代码字符串为原始字节
2. 读取 **保留字节**（固定为 `0x00`）
3. 依次解码 **LEB128 varint**：
   - 版本号 & 游戏模式
   - 英雄数量 + 英雄 DbfId
   - 单张卡牌（数量 + DbfId 列表）
   - 双张卡牌（数量 + DbfId 列表）
   - 多张卡牌（数量 + [DbfId, 复制数] 对）
   - 附属卡牌（存在标志 + 数量 + [卡牌 DbfId, 所属英雄 DbfId] 对）
4. 将字节范围映射为 **Base64 字符范围**，用于行内颜色标注
5. 从本地卡牌数据库中 **富化** 解析结果，补全卡牌名称、图片、费用、稀有度

## 数据来源

卡牌数据和美术资源由 [HearthstoneJSON](https://hearthstonejson.com/)（HearthSim 项目）提供。卡牌原画版权归暴雪娱乐所有。

**本项目与暴雪娱乐无关**，仅供学习交流使用。

## 许可证

MIT © 2025
