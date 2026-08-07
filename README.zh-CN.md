**English** | [简体中文](./README.zh-CN.md)

# Pico API

一个住在 Chrome 侧边栏里的轻量级 REST 客户端。发送请求、抓取流量、调试 API，无需离开当前标签页。

> `pico-` 是国际单位制中 10⁻¹² 的前缀，意为"最小的有意义的单位"。
> 我们想做最小、但仍然好用的 REST 客户端。

## 品牌信息

- **名称**：Pico API（简称 **Pico**）
- **发音**："PEE-co"（与 "echo" 押韵，不是 "pick-o"）
- **Tagline**：The smallest meaningful unit of a REST client
- **主色**：cyan/teal（`#00C9A7`）— 取其快速、干净的视觉感受

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia 做状态管理
- Ant Design Vue 做 UI 组件库
- IndexedDB 做本地持久化
- 原生 HTML5 拖拽（不依赖 `vuedraggable`，该生态停留在 Vue 2 / Sortable.js 兼容垫片）

## 核心特性（MVP）

- 树状文件夹（最多 5 层）用于整理已保存的请求
- HTTP 请求构造器：method、URL、headers、params、body
  （支持 urlencoded / 原始 JSON / XML / 纯文本）
- 响应查看器，按 Content-Type 智能渲染
- IndexedDB 持久化
- 历史记录（有上限）

## 开发

```bash
npm install
npm run dev      # 本地开发（在普通浏览器标签页加载）
npm run build    # 生产构建到 dist/
```

`npm run dev` 启动后，在浏览器中打开以下任一地址即可。项目根目录没有
`index.html`，直接访问 `http://localhost:5173/` 会 404，必须指定具体入口：

- 主界面：    <http://localhost:5173/src/options/index.html>
- 侧边栏：    <http://localhost:5173/src/sidepanel/index.html>
- 沙箱：      <http://localhost:5173/src/sandbox/index.html>

## 以扩展方式加载

1. `npm run build`
2. 打开 `chrome://extensions/`
3. 勾选右上角"开发者模式"
4. 点击"加载已解压的扩展程序" → 选择 `dist/` 目录

## 源码结构

```
src/
├── background/      Service Worker（点击图标 → 打开侧边栏）
├── options/         主 UI（Vue 应用，挂在 options.html）
├── sidepanel/       侧边栏入口
├── sandbox/         脚本沙箱（隔离执行的 iframe）
├── components/
│   ├── layout/      AppLayout
│   ├── tree/        CollectionTree + treeUtils
│   ├── request/     RequestEditor + KeyValueTable + BodyEditor + MethodDropdown
│   ├── response/    ResponsePanel
│   ├── capture/     CapturePanel + CaptureRow
│   └── common/      StatusTag、EmptyState、HistoryPanel、SettingsModal 等
├── stores/          Pinia：collection、request、response、settings、environment
├── db/              IndexedDB schema + CRUD
├── core/            纯函数：http、headers、url、body、curl、openapi、scripts 等
└── utils/           id、format、clone、download、methodColors
```

## 许可证

本扩展的源代码为**专有代码（Proprietary）**，保留所有权利。详见 [`LICENSE`](./LICENSE)。

最终用户可通过 Chrome Web Store 安装并使用已编译的扩展。源代码的复制、再分发、二次发布（无论开源或商业）须经维护者书面授权。