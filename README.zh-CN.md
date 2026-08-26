[English](./README.md) | **简体中文**

# Pico API

一个轻量级的 Chrome HTTP 客户端与 REST API 测试工具。发送请求、调试 API、
实时查看流式响应——无需离开浏览器，也无需注册账号。

<!-- 上架后请替换为真实的 Chrome Web Store 徽章/链接：
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-安装-34A853)](https://chromewebstore.google.com/detail/XXX)
-->

![Pico API 截图：流式响应实时渲染](docs/assets/hero-1280x800.png)

> `pico-` 是国际单位制中 10⁻¹² 的前缀，意为"最小的有意义的单位"。
> 我们想做最小、但仍然好用的 REST 客户端。

## 为什么选 Pico API

- **零配置** — 在 Chrome 标签页中直接运行，没有账号、工作区、云同步
- **本地优先、注重隐私** — 所有数据都保存在浏览器 IndexedDB 里；无统计、无广告、无第三方脚本（[隐私政策](https://fengliii123.github.io/pico-api/privacy.html)）
- **刻意保持小巧** — 只保留你日常真正用到的请求/响应工作流，没有平台包袱

## 功能特性

- HTTP 请求构造器：method、URL、params、headers、认证（Bearer / Basic / API key）、body（urlencoded / 原始 JSON / XML / 纯文本 / form-data）
- **流式响应实时渲染** — SSE 与分块响应按 chunk 逐段显示，无需等待完整响应
- 响应查看器按 Content-Type 智能渲染（JSON 树、格式化 body、headers、cookies、耗时）
- 环境与全局变量，`{{变量}}` 在 URL、headers、body、脚本中统一替换
- 前置/后置脚本：沙箱隔离执行，提供 Postman 风格的 `pm` API，支持 `pm.test` 断言
- 集合管理：树状文件夹（最多 5 层）、复制、移动、撤销/重做
- 请求历史（有上限），支持重发
- 导入 cURL 命令、OpenAPI/Swagger 规范、ApiFox 项目；导出集合；任意请求复制为 cURL
- 浏览器 Cookie 转发 + 通过 Service Worker 绕过 CORS
- 命令面板（⌘K）与快捷键：发送 / 保存 / 切换请求 / 切换环境
- 英文 & 简体中文界面

## 安装

**从 Chrome Web Store 安装**（推荐）：

<!-- 上架后请替换为真实的商店链接。 -->
在 [Chrome Web Store](https://chromewebstore.google.com) 搜索 "Pico API"。

**从源码加载**：

1. `npm run build`
2. 打开 `chrome://extensions/`
3. 勾选右上角"开发者模式"
4. 点击"加载已解压的扩展程序" → 选择 `dist/` 目录

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

## 开发

```bash
npm install
npm run dev      # 本地开发（在普通浏览器标签页加载）
npm run build    # 生产构建到 dist/
npm test         # 单元测试（vitest）
```

`npm run dev` 启动后，在浏览器中打开以下任一地址即可。项目根目录没有
`index.html`，直接访问 `http://localhost:5173/` 会 404，必须指定具体入口：

- 主界面：    <http://localhost:5173/src/options/index.html>
- 沙箱：      <http://localhost:5173/src/sandbox/index.html>

## 源码结构

```
src/
├── background/      Service Worker（请求转发、流式传输、Cookie 注入）
├── options/         主 UI（Vue 应用）
├── sandbox/         脚本沙箱（隔离执行用户脚本的 iframe）
├── components/
│   ├── layout/      AppLayout
│   ├── tree/        CollectionTree + treeUtils
│   ├── request/     RequestEditor + KeyValueTable + BodyEditor + MethodDropdown
│   ├── response/    ResponsePanel + ResponseBodyRenderer
│   └── common/      StatusTag、EmptyState、CommandPalette、HistoryPanel、SettingsModal 等
├── stores/          Pinia：collection、request、response、settings、environment、undoRedo
├── db/              IndexedDB schema + CRUD
├── core/            纯函数：http、headers、url、body、curl、openapi、scripts 等
└── utils/           id、format
```

## 许可证

源代码公开仅供阅读与审阅。代码为**专有（Proprietary）**，使用须遵守
[`LICENSE`](./LICENSE) 条款——复制、再分发、二次发布（无论开源或商业）
须经维护者书面授权。

最终用户可通过 Chrome Web Store 安装并使用已编译的扩展。
