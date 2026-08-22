# 开工了 · 实现状态

## P0 Core

- [x] Electron + React + TypeScript 项目结构
- [x] SQLite Schema / 本地设置
- [x] TODO CRUD
- [x] TaskSession Start / Pause / Resume / End
- [x] Windows 前台应用 / 切换 / 空闲采集代码
- [x] NOW 冷启动推荐 + 可解释理由
- [x] Rhythm 有样本后的推荐权重入口
- [x] START_FAILURE 真实规则入口
- [x] “模拟游离”演示入口
- [x] Debug 固定 Root Cause
- [x] Patch / Focus / Verify 前端闭环
- [x] Timeline
- [x] Daily Review
- [x] Outcome 原因选择
- [x] 数据导出 / 删除
- [x] Ghost Mode

## P0 Companion

- [x] 透明 always-on-top Electron 窗口
- [x] 可拖动 Companion
- [x] 主窗口 / Ghost 快捷入口
- [x] Companion 消息事件
- [x] Focus 状态视觉壳
- [x] Companion Idle / Working 状态动画与消息气泡

## P1 多模态与学习

- [x] Life Rhythm 聚合统计基础
- [x] Windows 系统 TTS
- [x] Camera Presence 真实设备生命周期：仅授权且 Session 运行时开启，低帧率本地派生信号，原始帧不落盘
- [x] FaceDetector 可用时做人脸在位派生；不可用时降级为本地画面变化启发式，不做身份/情绪判断
- [x] desktopCapturer 单应用源列表、单源实时捕获、共享状态与 Stop Sharing
- [x] Companion Level 1 视觉 → Level 2 文本 → Level 3 TTS 干预状态机
- [x] DND / Meeting / Ghost / Quiet / 连续忽略降级 / 10 分钟误报抑制
- [x] 推荐接受/拒绝/最终结果学习记录
- [x] Timeline 展示 Bug、Patch、Intervention、Presence、Screen 子事件
- [x] Daily Review / Rhythm 持久化与 DeepSeek 最小字段审计

## 当前验证情况

- [x] 已恢复标准 `electron/`、`electron/services/`、`src/` 目录与 Electron/Vite 构建入口。
- [x] 已恢复有效的 `package.json`、`tsconfig.json`、`index.html` 与 preload 安全桥。
- [x] 已补齐 NOW / TODO / RUN / DEBUG / TIMELINE / REVIEW / RHYTHM / SENSORS / Companion 可运行页面。
- [x] 已在项目 `.tools/` 安装 Node.js 22 LTS 便携运行时并完成 `npm install`。
- [x] `npm run typecheck` 与 `npm run build` 已通过。
- [x] `better-sqlite3` 已针对 Electron 34 重建，ABI 132 验证通过；`postinstall` 会自动保持 ABI 匹配。
- [x] Electron 主窗口已实机启动运行；主进程、preload 与 renderer 均已加载。
- [x] 最新 P0/P1 代码通过 `npm run typecheck`、`npm run build`，开发版启动无主进程异常。
- [ ] Camera OFF 2 秒释放、真实离席派生、单应用画面范围、TTS/DND 需要用户在实体 Windows 桌面完成硬件人工验收。
- [ ] Windows NSIS 安装包与完整人工交互验收路线仍待执行。

## 首轮验收路线

1. `npm install`
2. `npm run dev`
3. NOW → 生成演示数据
4. 开始“修改论文”
5. RUN → 模拟游离
6. Companion 提醒 → Debug
7. 安装 Patch → Verify
8. 结束任务并选择原因
9. Timeline → Review → Rhythm
10. Sensors → Ghost Mode → 导出数据
