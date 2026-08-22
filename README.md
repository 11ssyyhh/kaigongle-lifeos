# 开工了 · LifeOS MVP

> Life has bugs. Patch them. 不是管理生活，而是 Debug 生活。

这是根据 LifeOS PRD v4.0 / 执行文档 v2.0 制作的 Windows 桌面 MVP 源码。

## 已实现

- TODO CRUD：任务名、Deadline、预计时长、Task Type、Priority、目标应用。
- NOW：可解释推荐；冷启动使用 Deadline / Duration / Priority 等规则，有足够历史后引入 Rhythm。
- RUN：任务 Session 状态机，Start / Pause / Resume / End。
- Windows 行为采集：PowerShell + Win32 `GetForegroundWindow` / `GetLastInputInfo`，仅记录应用名、切换、空闲时长。
- START_FAILURE：规则触发 + 一键“模拟游离”用于演示。
- DEBUG → Root Cause → Patch → Focus → Verify 完整前端流程。
- Timeline：当天 Session 自动时间线。
- Daily Review：完成/未完成、结束原因、洞察与次日建议。
- Life Rhythm：按时段 × Task Type 聚合历史推进率；少于 5 个样本明确显示“学习中”。
- Desktop Companion：透明 always-on-top 桌面窗口，可拖动，显示状态/消息。
- Sensor & Privacy Center：Application / Camera / Screen / Voice / AI Context 独立开关，Ghost Mode。
- 本地 SQLite、JSON 导出、全部数据删除。
- Windows 系统 TTS 提醒。
- P1 Camera Presence：显式授权后仅在运行 Session 中开启设备，低帧率本地生成 presence / facing / away 派生信号，不保存或上传原始帧。
- P1 Share One App：使用 Electron `desktopCapturer` 选择单个应用窗口，显示持续共享状态并可立即停止。
- 三级干预：视觉 → 文本 → 本地 TTS，尊重 DND、Meeting、Focus、Ghost、冷却期与用户主动程度。
- 一键生成演示数据。

## 技术栈

- Electron + TypeScript
- React + TypeScript + Vite
- better-sqlite3
- Windows PowerShell / Win32 API

## 运行

```bash
npm install
npm run typecheck
npm run dev
```

## 源码结构

```text
electron/                  Electron 主进程、preload、本地数据库与行为采集
electron/services/         Windows 行为采集与 NOW 推荐算法
src/                       React 页面、类型与样式
IMPLEMENTATION_STATUS.md   当前完成度与验收路线
```

## 构建

```bash
npm run build
npm run dist:win
```

## DeepSeek AI（可选）

DeepSeek 用于根据固定 Root Cause 生成最小行动 Patch。没有 API Key 时会自动降级到本地模板，核心流程仍可运行。

1. 撤销任何曾公开发送过的 Key，并在 DeepSeek 控制台生成新 Key。
2. 复制 `.env.example` 为 `.env.local`。
3. 仅在 `.env.local` 中填写 `DEEPSEEK_API_KEY`；该文件已被 `.gitignore` 排除。
4. 通过桌面快捷方式启动，启动器会只在当前进程读取该 Key。

API Key 不写入 SQLite、不进入导出数据，也不会发送到 renderer。

> `dist:win` 最好在 Windows 环境执行；`better-sqlite3` 是原生模块，Electron 打包时需要针对目标 Electron 版本重建。

## 黑客松推荐演示路径

1. 点击 **生成演示数据**。
2. 在 NOW 接受“修改论文”推荐。
3. 进入 RUN，点击 **模拟游离**。
4. Companion 出现低调提醒，进入 Debug。
5. 选择“不知道从哪里开始”，安装 Patch。
6. 演示 Focus Mode 并点击“我已经开始了”。
7. 结束任务，选择完成/未完成原因。
8. 打开 Timeline、Review、Rhythm。
9. 打开 Sensors，展示 Camera / Screen / Voice 均可独立关闭，以及 Ghost Mode。

## 隐私边界

默认不采集键盘输入内容、聊天内容、文档正文、浏览器 URL、截图文件/录屏文件和麦克风原始音频。Camera Presence 只保存本地派生状态；Share One App 只在显式会话中处理用户选择的单个窗口，帧不落盘，当前不会自动发送给 AI。
