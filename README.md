# dsh-sidechat

面向 **DeepSeek Harness 0.2.1** Web GUI 的侧边聊天插件。

侧边聊天以**右侧栏停靠标签页**的形式存在，与「工作区文件 / 新建终端 / 浏览器」共用同一个入口：
只有主动打开时才出现，不悬浮、不遮挡主对话。它会自动共享**当前会话的对话内容**；在主对话中
用鼠标**划选**一段内容后，可一键将其作为引用带入并直接提问。

- 目标运行时：**DeepSeek Harness 0.2.1-rc.2**（Desktop / Web）
- 安装方式：DSH 插件管理器一键导入，Git 地址 `github:JiaskyNo1/dsh-sidechat`
- 开源协议：MIT

## 安装（一键导入）

本仓库是可直接导入的 bundle 包：`lib/` 已包含构建产物，安装器会自动完成依赖安装、
bundle 选择与配置注册，**无需构建、无需手动改配置**。

1. 打开 DSH 侧边栏 → **插件（Plugins）** → **添加插件**。
2. 在 Git 地址栏粘贴：

   ```
   github:JiaskyNo1/dsh-sidechat
   ```

3. 安装完成后启用插件。当前页面通常会热加载；若未出现，重启 DSH 即可。

## 功能

| 功能 | 说明 |
| --- | --- |
| 右侧栏停靠 | 注册为右侧栏标签类型（`kind: sidechat`），与内置的文件 / 终端 / 浏览器标签并列 |
| 快捷键 | `Ctrl+J`（Desktop）/ `Ctrl+Alt+J`（Web）打开；指南卡片与快捷键参考显示按键提示 |
| 会话上下文 | 每次回答自动注入当前会话最近 12 条消息，并与项目根目录、Git 分支一起提供给模型 |
| 划选提问 | 划选主对话文本后点击「添加到侧边聊天」，自动打开标签页并以该引用提问 |
| 流式输出 | 逐字流式显示，可中途停止 |
| 思考过程 | 可折叠的「💭 思考过程」块 |
| Markdown | 标题、代码块、列表、引用、链接、表格 |
| 模型选择 | 标签页内切换模型与推理等级 |
| 会话隔离 | 每个会话维护独立的侧边聊天历史 |
| 清空 | 二次确认后清空当前会话的侧边聊天 |

## 工作原理

```
浏览器 (lib/client.js)
├── ctx.remote.$mount(TYPERT_REMOTE)          挂载 sidechat Remote
├── ctx.sidebarRightTabs.register({ kind })   注册侧边栏标签类型
├── sidebar.right.pane.tab (key: dsh-sidechat) 停靠标签页正文
├── ctx.shortcuts.register('sidechat.open')   Ctrl+J / Ctrl+Alt+J
└── shell.overlay                              划选时出现的「添加到侧边聊天」按钮
        │
        │ Typert Remote（JSON over /api）
        ▼
宿主 (lib/index.js)
└── SidechatService
    ├── getContext(sessionId)  项目根 / Git 分支 / 会话最近 12 条消息
    ├── models()               provider / model / reasoning effort 目录
    ├── start(messages)        调用 llm.stream 生成，返回 job id
    ├── poll(jobId)            返回累计文本、思考过程、完成状态与错误
    └── stop(jobId)            停止任务
```

设计要点：

- 宿主半运行时只依赖 `zod`；`@deepseek-ai/*` 均为类型导入，安装后无需解析对等依赖。
- 浏览器半只使用 Web 平台共享模块表中的 `react` / `react/jsx-runtime` / `zod`。
- 宿主 `./typert` 导出为手写 strict manifest，由 `dsh-typert-loader` 自动发现并注册。
- 标签页正文注册在 session-scoped 的 `sidebar.right.pane.tab`，每个会话自动获得独立实例。

## 使用

| 操作 | 方式 |
| --- | --- |
| 打开 | 右侧栏「打开右侧边栏」→ 指南页「侧边聊天」卡片；或按 `Ctrl+J`（Web 为 `Ctrl+Alt+J`） |
| 关闭 | 标签页上的 ✕ |
| 划选提问 | 选中主对话文字 → 点击「添加到侧边聊天」，自动打开并发送引用 |
| 切换模型 | 标签页底部下拉框选择模型与推理等级 |
| 停止生成 | 生成中点击「停止」 |
| 清空 | 标签页头部「清空」，二次确认 |

侧边聊天是独立问答面：不写入主会话，也不会调用工具。

## 构建与开发

需要 Node.js 24 与安装好依赖的 DSH 0.2.1 运行时（`@deepseek-ai/*` 包）。

```bash
pnpm install                       # 安装开发依赖
pnpm run typecheck                 # tsc --noEmit
pnpm run build                     # tsc 中间产物 + tsdown 构建
```

构建产物：

| 文件 | 说明 |
| --- | --- |
| `lib/index.js` | 宿主半（ESM） |
| `lib/typert.js` | 宿主 strict Typert manifest |
| `lib/types.js` | wire 类型模块（运行时为空） |
| `lib/client.js` | 浏览器 bundle，`window.__ModuleLoader__.load` 包装，CSS Modules 内联 |

构建中间产物（`lib/types/`、`lib/*.map`）已被 `.gitignore` 排除，不进入仓库。

## 兼容性

- 目标版本：DeepSeek Harness **0.2.1-rc.2**。
- 使用的 client 契约：`client-modules` 的 bundle 格式、`ui-sidebar-right` 标签注册、
  `ui-slots` keyed slot、`client-shortcuts` 命令注册、`typert` Remote 协议。
- 跨 DSH 版本升级时，需要同步调整 `package.json` 的 peerDependencies 与 `tsdown.config.ts`
  中的平台共享模块表。

## 项目结构

```
.
├── cordis.patch.yml        # bundle 补丁：声明本包
├── src/
│   ├── index.ts            # 宿主半：SidechatService
│   ├── typert.ts           # 宿主 strict Typert manifest
│   ├── types.ts            # wire 类型
│   └── client/
│       ├── index.ts        # 浏览器半入口
│       ├── apply.tsx       # 标签类型 / 标签正文 / 快捷键 / 划选按钮 / Markdown
│       ├── remote.ts       # 浏览器侧 Remote contribution
│       ├── settings.ts     # 偏好存储（localStorage）
│       └── sidechat.module.css
├── lib/                    # 预构建产物（安装即用）
├── tsconfig.json
└── tsdown.config.ts
```

## 致谢与许可

- 上游实现：[kittsai/dsh-sidechat](https://github.com/kittsai/dsh-sidechat)（MIT）。
- 本项目同样以 **MIT** 发布，详见 [LICENSE](LICENSE)；版权声明与上游保持一致。
