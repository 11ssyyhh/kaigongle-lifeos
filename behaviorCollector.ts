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
- P1 Camera Presence / Share One App：当前仅做权限和 Demo 状态，界面明确标记 `DEMO`，没有假装真实分析。
- 一键生成演示数据。

## 技术栈

- Electron + TypeScript
- React + TypeScript + Vite
- better-sqlite3
- Windows PowerShell / Win32 API

## 运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run dist:win
```

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

默认不采集键盘输入内容、聊天内容、文档正文、浏览器 URL、截图/录屏和麦克风原始音频。Camera Presence 与 Screen Context 目前只作为 P1 Demo 权限，不执行真实内容分析。
