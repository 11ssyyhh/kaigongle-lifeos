**LifeOS**

**产品需求文档 PRD**

完整产品版：节律推荐 × 行为 Debug × 日记复盘 × 桌面 AI Companion

**Life has bugs. Patch them.**

不是管理生活，而是 Debug 生活。

| **文档版本** | v4.0                            |
|--------------|---------------------------------|
| **更新日期** | 2026-08-22                      |
| **文档状态** | 可执行稿                        |
| **产品阶段** | 核心闭环 + Companion 多模态扩展 |

# 0. 本版更新摘要

- 继承 v2/v3 的核心闭环：TODO、NOW、RUN、行为监测、Debug、Patch、Verify、Timeline、Review、Life Rhythm。

- 新增 Companion Layer：以桌面小助手/桌面宠物作为常驻交互入口，承担状态提示、任务陪伴、Debug 入口和语音提醒。

- 新增 Camera Presence：用户显式授权后，摄像头只用于判断“在位/离席/长时间未面向屏幕”等低风险状态信号，不做身份识别和默认情绪判断。

- 新增 Screen Context：用户可选择共享整个屏幕或单个应用；默认推荐“仅共享单个应用”，用于理解任务做到哪里、当前卡在哪一步。

- 新增 Voice Intervention：根据游离程度采用视觉、文字、语音三级干预；用户可设置 Never / Severe Only / Smart。

- 新增 Companion 自定义：固定角色与自定义角色并存，用户可设置外观、名字、声音、文案风格、提醒强度。

- 新增 Sensor & Privacy Center：统一管理行为监测、摄像头、屏幕共享、麦克风、语音提醒等权限，并明确实时状态与数据留存。

> **产品升级后的核心定位**
> LifeOS 不只是“出 Bug 时修复”，而是一套常驻桌面的个人执行操作系统：它学习你何时适合做什么，推荐当下任务，陪你执行，在游离/卡住时适度介入，并通过每天的 Timeline 与 Review 持续学习。

# 1. 产品定位与愿景

## 1.1 一句话定义

LifeOS 是一套会学习个人节律、推荐当前任务、感知执行状态并以桌面 AI Companion 陪用户完成任务的个人生活操作系统。

## 1.2 核心价值

| **能力**     | **用户问题**         | **LifeOS 回答**                          |
|--------------|----------------------|------------------------------------------|
| KNOW ME      | 我什么时候状态最好？ | 从真实执行历史中学习个人节律             |
| TELL ME      | 我现在该做什么？     | 从 To Do 中推荐当下最匹配任务            |
| STAY WITH ME | 我能不能真的做下去？ | 桌面 Companion 常驻陪伴，必要时提醒/协助 |
| DEBUG ME     | 为什么我又卡住了？   | 识别异常、找根因、给最小 Patch           |
| REVIEW ME    | 我今天到底怎么过的？ | 自动 Timeline + 完成/未完成原因分析      |

# 2. 目标用户与核心场景

| **用户**            | **典型任务**                   | **核心需求**                                |
|---------------------|--------------------------------|---------------------------------------------|
| 研究生/大学生       | 论文、PPT、复习、课程任务      | 启动难、多任务、不同时间状态差异明显        |
| 知识工作者          | 方案、报告、邮件、研究、会议   | 需要在 To Do 中快速选出当下任务，并减少切换 |
| 创作者/自雇者（P1） | 写作、设计、内容创作、长期项目 | 需要节律学习、陪伴执行与跨任务复盘          |

## 2.1 典型场景 A：NOW 推荐

> **10:20 · Recommended Process**
> 修改论文 · 60 min · Rhythm Match 86%
> 推荐理由：当前是你的 Deep Work 高匹配时段；该任务距离截止 2 天；过去同类任务上午完成率更高。
> 备选：做汇报 PPT；Quick Task：回复导师消息 5 min。

## 2.2 典型场景 B：执行游离

> **Focus Drift detected**
> 用户执行“修改论文”时 8 分钟内切换 9 次应用；摄像头（已授权）同时检测到连续 3 分钟未面向屏幕。Companion 先轻微动作，若继续游离，再以文字/语音提醒：“这个任务好像离开一会儿了，要不要先回到第一条批注？”

## 2.3 典型场景 C：屏幕协助

> **Share with LifeOS**
> 用户主动选择“共享 Microsoft Word”。LifeOS 只在本次会话中读取该应用可见上下文，识别当前位于“研究方法”部分，并提示：“这一页有 3 个待处理点，先处理第一条？”用户可随时停止共享。

# 3. 产品总闭环

PLAN / TODO  
↓  
NOW（当前最佳任务推荐）  
↓  
RUN（开始 Process）  
↓  
OBSERVE（行为 + 可选摄像头 + 可选屏幕上下文）  
↓  
ASSIST（桌面 Companion：视觉 / 文本 / 语音 / 任务协助）  
↓  
正常推进 ───────────────────┐  
↓ │  
异常 → DEBUG → PATCH → VERIFY│  
└──────────────┬─────────┘  
↓  
TIMELINE / REVIEW  
↓  
LEARN（Life Rhythm / 原因 / Patch / 推荐反馈）  
↓  
更新下一次 NOW 与 Companion 介入策略

# 4. 信息架构

| **一级模块** | **主要问题**              | **关键内容**                           |
|--------------|---------------------------|----------------------------------------|
| NOW          | 我现在最适合做什么？      | 推荐任务、备选、可用时长、推荐理由     |
| TODO         | 我有哪些事情？            | Deadline、估时、Task Type、Priority    |
| RUN          | 我正在做什么？            | 当前 Process、计时、目标应用、行为状态 |
| COMPANION    | 谁在陪我执行？            | 桌面宠物、提醒、语音、快速操作         |
| DEBUG        | 为什么运行不起来？        | Bug、Root Cause、Patch、Verify         |
| TIMELINE     | 今天各时段发生了什么？    | 自动任务日记、Debug/中断事件           |
| REVIEW       | 哪些完成/未完成？为什么？ | 原因分析、次日建议                     |
| RHYTHM       | 我什么时候适合做什么？    | 时段 × 任务类型 × 成功/启动/Bug        |
| SENSORS      | LifeOS 当前能看到什么？   | 行为、摄像头、屏幕、麦克风权限         |

# 5. TODO / PLAN

| **字段**         | **说明**                                                          | **示例**         |
|------------------|-------------------------------------------------------------------|------------------|
| Task Name        | 任务名称                                                          | 修改论文         |
| Deadline         | 截止时间，可为空                                                  | 周日 23:00       |
| Estimated Time   | 预计时长                                                          | 90 min           |
| Task Type        | Deep Work / Creative / Communication / Admin / Learning / Routine | Deep Work        |
| Priority         | High / Medium / Low                                               | High             |
| Target App       | 目标应用，可为空                                                  | Microsoft Word   |
| Required Context | 可选：是否需要浏览器/PDF等白名单                                  | Word + Chrome    |
| Notes            | 可选备注                                                          | 优先处理老师批注 |

# 6. NOW｜当前任务推荐

## 6.1 推荐输入

- 当前时间与星期

- To Do 的 Deadline、Priority、预计时长、Task Type

- 用户当前可用时长

- Life Rhythm：该时段同类任务的历史表现

- 历史完成率、启动耗时、Bug 频率、实际用时

- 当前状态：可选精力自评、上一任务强度、是否刚被打断

## 6.2 推荐规则

Recommendation Score =  
0.30 × Rhythm Match  
+ 0.25 × Deadline Urgency  
+ 0.20 × Duration Fit  
+ 0.15 × Priority  
+ 0.10 × Historical Success

- 样本不足 5 次时降低 Rhythm 权重，明确显示“正在学习你的节律”。

- 可用时间小于任务预计时长时，优先推荐 Quick Task 或建议切出一个可完成子任务。

- 每次推荐必须显示 2–4 条可解释理由；拒绝推荐也记录为学习信号。

# 7. Life Rhythm｜个人节律学习

| **维度**         | **学习内容**                                | **输出示例**                          |
|------------------|---------------------------------------------|---------------------------------------|
| 时段 × Task Type | 完成率、启动延迟、有效工作时长              | 09:00–11:30 Deep Work 高匹配          |
| 时段 × Bug       | START_FAILURE / FOCUS_LOOP / FATIGUE 发生率 | 21:00 后启动困难高发                  |
| 任务类型 × 估时  | 计划与实际时长差异                          | PPT 平均比计划多 35%                  |
| Patch × 情境     | 不同根因/时段下的 Patch 成功率              | 缩小第一步在上午成功率更高            |
| 连续任务         | 高强度任务连续安排的影响                    | 连续两段 Deep Work 后第二段失败率上升 |

> **节律原则**
> LifeOS 学习的是“哪个时间适合哪类任务”，而不是给用户贴“高效/低效”的标签。

# 8. RUN｜任务运行与行为感知

## 8.1 默认行为信号

- 前台应用

- 应用切换事件及时间戳

- 空闲时间

- 目标应用前台时长占比

- 多应用白名单内的有效工作占比

## 8.2 默认不采集

- 键盘输入内容

- 聊天内容、文档正文

- 浏览器 URL

- 截图/录屏

- 麦克风原始音频

# 9. Camera Presence｜摄像头状态感知

## 9.1 产品目标

摄像头用于补充“用户是否仍在任务交互中”的状态信息，不用于判断人格、能力或默认识别情绪。

## 9.2 MVP/P1 可识别信号

| **信号**                                | **用途**                 | **存储策略**               |
|-----------------------------------------|--------------------------|----------------------------|
| presence                                | 是否在电脑前             | 仅存布尔/时间段，不存画面  |
| away_duration                           | 离席持续时长             | 仅存秒数                   |
| screen_facing                           | 是否大致面向屏幕         | 仅存派生状态，不存脸部特征 |
| long_head_down / posture_change（可选） | 辅助判断是否需要休息提醒 | 默认关闭；不做健康诊断     |

## 9.3 明确禁止/不默认做

- 不做人脸身份识别。

- 不保存摄像头视频或图片。

- 不基于面部表情直接推断“懒惰、焦虑、抑郁”等状态。

- 不把摄像头单一信号作为“拖延”判定依据。

## 9.4 触发原则

Focus Drift 候选 =  
行为层异常（切换 / 目标应用占比下降）  
+ 可选 Presence 辅助信号  
+ 冷却期 / 免打扰 / 用户历史偏好

# 10. Screen Context｜屏幕/单应用共享

## 10.1 两种模式

| **模式**            | **说明**                       | **默认建议**               |
|---------------------|--------------------------------|----------------------------|
| Share One App       | 只共享用户指定应用的当前上下文 | 默认推荐；最小权限         |
| Share Entire Screen | 共享整个桌面可见内容           | 高级模式；每次会话显式确认 |

## 10.2 使用场景

- 理解当前任务做到哪一步。

- 用户说“这里卡住了”时，结合当前页面给出下一动作。

- 协助定位待处理项，例如 Word 批注、PPT 当前页结构、代码报错上下文。

- 生成更贴近当前内容的 Patch，而不是只依赖行为元数据。

## 10.3 权限与会话边界

- 每次共享必须有明显的“正在共享”状态标识。

- 用户可一键 Stop Sharing。

- 默认不长期保存屏幕帧；若未来需要截图作为任务上下文，必须单独明确授权。

- 向 LLM 发送屏幕上下文前展示“将发送的最小内容摘要”，并允许用户关闭。

# 11. Companion｜桌面 AI 小助手 / 桌面宠物

## 11.1 角色定位

> **Companion ≠ Supervisor**
> 它的目标是“陪你把任务继续运行下去”，而不是监督、批评或强迫。提醒文案应使用“这个任务好像卡住了，要不要一起拆小一点？”，避免“你又偷懒了”。

## 11.2 常驻形态

- 桌面右下角常驻小体积角色，可自由拖动。

- 平时安静待机，不遮挡主要内容。

- 点击可展开：NOW、当前任务、Debug、暂停监测、Sensor 状态。

- Focus Mode 时自动降低动画和提醒频率。

## 11.3 固定角色与自定义角色

| **类型**         | **能力**                                                                |
|------------------|-------------------------------------------------------------------------|
| 官方角色         | 预置外观、声音、文案风格，例如冷静型 / 轻松型 / 极简型                  |
| 自定义 Companion | 名称、外观、头像/角色素材、声音、说话语气、主动程度、动画频率、提醒强度 |

## 11.4 系统状态与宠物行为映射

| **LifeOS 状态**        | **Companion 行为**          |
|------------------------|-----------------------------|
| Idle                   | 安静待机                    |
| NOW Recommendation     | 轻提示可开始任务            |
| Deep Work              | 减少动画，保持安静          |
| Focus Drift            | 抬头/轻微动作 → 文本 → 语音 |
| START_FAILURE          | 显示“?”或 Debug 提示        |
| Debugging              | 扫描/分析动画               |
| Patch Running          | 工作/专注状态               |
| Task Complete          | 轻量庆祝，不强制激励        |
| Fatigue / Long Session | 建议休息或结束任务          |

# 12. Voice Intervention｜语音提醒

## 12.1 干预级别

| **级别** | **形式**              | **触发**                                   |
|----------|-----------------------|--------------------------------------------|
| Level 1  | 宠物轻微动作/图标变化 | 轻度游离，仅视觉                           |
| Level 2  | 桌面文字气泡          | 持续异常或第一次可解释提醒                 |
| Level 3  | 语音提醒              | 明显持续游离，且用户允许 Smart/Severe 模式 |

## 12.2 用户设置

- Never：永不主动出声。

- Severe Only：仅明显、持续异常时出声。

- Smart：结合个人历史、当前任务和冷却期自动选择级别。

- 自定义安静时段与会议模式。

## 12.3 文案原则

- 不批评、不羞辱、不做人格判断。

- 优先提出一个可执行下一步，而不是泛泛“请专注”。

- 用户连续忽略后降低干预频率，而不是升级强度。

# 13. DEBUG｜异常诊断与 Patch

Detect（规则 + 个人基线）  
→ Low-key Reminder  
→ 用户确认“有点卡”  
→ 1 个选择题  
→ 固定 Root Cause  
→ Patch Template  
→ 可选结合屏幕上下文微调  
→ Install → Focus → Verify

| **Root Cause**     | **示例 Patch**                       |
|--------------------|--------------------------------------|
| TASK_ENTRY_UNCLEAR | 只找到第一步，并只做这一步           |
| TASK_TOO_BIG       | 缩小到 5 分钟版本                    |
| BLOCKED_ON_STEP    | 把具体卡点单独拆出                   |
| DISTRACTION_PULL   | 关闭分心通知，先专注 3 分钟          |
| FATIGUE            | 休息 10 分钟，再决定是否继续         |
| AVOIDANCE          | 先做最容易的相关动作，或明确今天不做 |

# 14. TIMELINE｜每日自动日记

Timeline 的目标是让用户看到“我的一天是怎么运行的”，而不是只看到完成了几个 To Do。

| **时间**    | **任务/事件** | **状态**    | **关键记录**                        |
|-------------|---------------|-------------|-------------------------------------|
| 09:15–10:42 | 修改论文      | Completed   | START_FAILURE×1；Patch 后 3min 启动 |
| 11:05–11:13 | 回复导师消息  | Completed   | 无明显 Bug                          |
| 14:00–15:10 | 制作汇报 PPT  | Unfinished  | FOCUS_LOOP；有效工作 24min          |
| 16:20–16:40 | 报销          | Not Started | 临时会议占用计划时间                |
| 21:10–21:25 | 整理材料      | Cancelled   | 用户主动决定明天处理                |

- 自动合并相邻同一任务片段。

- 展示计划时长、实际时长、有效工作时长。

- 标记 Debug、Patch、主动提醒、摄像头离席（只显示派生事件）、屏幕共享会话。

- 任务结束最多补 1 个轻量原因选择；用户可修正系统记录。

# 15. REVIEW｜完成/未完成原因分析

| **Reason Code**  | **含义**                       |
|------------------|--------------------------------|
| COMPLETED        | 按预期完成                     |
| TIME_SHORTAGE    | 时间不够                       |
| INTERRUPTION     | 临时会议/电话/外部打断         |
| BLOCKED          | 卡在具体问题                   |
| FATIGUE          | 精力不足                       |
| WRONG_TIME_MATCH | 该时段与该任务类型历史匹配较差 |
| OVERRUN          | 上一任务超时挤占               |
| SCOPE_TOO_BIG    | 任务比预计复杂                 |
| DEPRIORITIZED    | 主动决定不做/延后              |
| UNKNOWN          | 无法判断                       |

> **归因原则**
> 系统可以提出候选原因，但用户确认优先。LifeOS 不应把“没有完成”自动等同于“拖延”。

## 15.1 Daily Review 输出

- 计划/开始/完成/未完成/主动放弃数量。

- 计划时长 vs 实际时长 vs 有效工作时长。

- 未完成原因 Top 3。

- 最匹配的时段 × Task Type。

- 高频 Bug 与高发时段。

- 1–3 条次日可行动建议。

# 16. LEARN｜个性化学习

| **学习对象**   | **形成的结论**                   |
|----------------|----------------------------------|
| 完成任务       | 什么时段/什么类型更容易成功      |
| 未完成任务     | 哪些原因与情境组合最常见         |
| 估时           | 哪些任务经常低估/高估时长        |
| Bug            | 高频 Bug 与高发时段              |
| Patch          | 哪些 Patch 对该用户最有效        |
| NOW 推荐       | 用户接受什么推荐，接受后是否推进 |
| Companion 介入 | 什么提醒级别最有效且最不打扰     |

# 17. Sensor & Privacy Center｜感知权限中心

| **权限**             | **默认**           | **说明**                               |
|----------------------|--------------------|----------------------------------------|
| Application Activity | ON（首次明确授权） | 应用名/时长/切换/空闲                  |
| Screen Context       | OFF                | 用户每次选择 Entire Screen 或 One App  |
| Camera Presence      | OFF                | 只生成派生状态；不保存视频/人脸特征    |
| Microphone Input     | OFF                | 仅未来语音对话使用；不是语音提醒所必需 |
| Voice Reminder       | Smart/可选         | 仅本地语音输出即可，不需录音           |
| AI Context Sharing   | OFF/逐次确认       | 向模型发送最小必要上下文               |

- 托盘/Companion 必须随时显示当前正在使用的传感器。

- 摄像头和屏幕共享必须提供显著状态指示。

- 支持一键“Ghost Mode”暂停全部感知。

- 支持导出/删除全部本地数据；默认保留期可设置 7/30/90 天/永久。

- 关闭任何一项感知后，核心功能应尽可能降级可用。

# 18. 干预策略与防打扰

- 同一任务 30 分钟内最多主动提醒 1 次（可配置）。

- 用户选择“我在工作”后至少 10 分钟不再提醒。

- 用户连续两次忽略 Companion 后自动降低主动性。

- Focus Mode、会议模式、免打扰时段禁止语音提醒。

- 摄像头/屏幕信号仅作为辅助，不单独触发高强度提醒。

- 用户可设置“Companion 主动程度”：Quiet / Balanced / Active。

# 19. 数据模型（v4 增量）

TodoTask  
└─ TaskSession ─\< BehaviorEvent  
├─ PresenceSignal (optional)  
├─ ScreenContextSession (optional)  
├─ InterventionEvent  
├─ BugSession ─\< PatchAttempt  
└─ SessionOutcome  
  
RecommendationEvent  
DailyTimeline ─\< TimelineEntry  
DailyReview  
RhythmProfile  
CompanionProfile  
SensorPermission

| **新增实体**         | **关键字段**                                                            |
|----------------------|-------------------------------------------------------------------------|
| PresenceSignal       | sessionId, timestamp, presence, facingScreen, awaySeconds, confidence   |
| ScreenContextSession | mode, appId, startedAt, endedAt, aiShared, retentionPolicy              |
| InterventionEvent    | level, channel, reason, userResponse, dismissed                         |
| CompanionProfile     | characterId, name, voice, tone, proactiveLevel, animationLevel          |
| SensorPermission     | sensorType, enabled, scope, grantedAt, expiresAt                        |
| UserStateSnapshot    | time, currentTask, behaviorScore, presenceScore, interventionSuppressed |

# 20. 技术架构建议

Desktop Client (Electron/Tauri)  
├─ UI / Companion Overlay  
├─ Task & Timeline UI  
├─ Sensor Permission Center  
│  
├─ Behavior Collector (Windows)  
├─ Camera Presence Processor (on-device)  
├─ Screen Share / App Capture Session  
│  
├─ Context Engine  
│ ├─ Recommendation Engine  
│ ├─ Bug Rule Engine  
│ ├─ Intervention Engine  
│ └─ Rhythm / Review Analyzer  
│  
├─ Optional LLM Gateway  
│ ├─ Patch matching / phrasing  
│ └─ Shared-screen task assistance  
│  
└─ SQLite Local Store

# 21. 功能优先级

| **优先级** | **功能**                  | **说明**                                 |
|------------|---------------------------|------------------------------------------|
| P0         | TODO + NOW                | 任务池与可解释推荐                       |
| P0         | RUN + Windows 最小监测    | 真实任务 Session                         |
| P0         | START_FAILURE Debug       | 核心价值验证                             |
| P0         | Timeline + Outcome Reason | 每日真实记录                             |
| P0         | Daily Review 基础版       | 完成/未完成与原因                        |
| P0         | Desktop Companion 最小壳  | 常驻入口、状态、快捷操作；不强依赖摄像头 |
| P1         | Life Rhythm 个性化        | 时段 × Task Type 学习                    |
| P1         | Camera Presence           | 用户显式授权；本地派生信号               |
| P1         | Voice Intervention        | 三级干预与可配置语音                     |
| P1         | Share One App             | 单应用上下文协助                         |
| P1         | Companion 角色自定义      | 外观/名字/语气/提醒强度                  |
| P2         | Share Entire Screen       | 高级权限模式                             |
| P2         | 语音对话/麦克风输入       | 可选多模态交互                           |
| P2         | 跨平台与移动端            | macOS/Linux/手机                         |

# 22. MVP 与演示版本边界

- 黑客松/第一版 Demo：Companion UI 可以真实；摄像头/屏幕共享可先做明确标注的 Demo 模式，不假装已实现。

- 核心价值验证仍优先：NOW 是否有用、Patch 是否缩短启动、Timeline/Review 是否帮助理解规律。

- 摄像头与屏幕共享属于“能力增强”，不应成为核心闭环不可用的前置条件。

# 23. 关键指标

| **指标**                  | **定义**                    | **参考目标**                       |
|---------------------------|-----------------------------|------------------------------------|
| TAR                       | 从提醒到恢复有效行动的时间  | 较干预前显著下降                   |
| NOW Acceptance            | 推荐任务被接受比例          | ≥50%                               |
| Recommended Task Progress | 接受推荐后有效推进/完成比例 | ≥60%                               |
| Patch 5min Start Rate     | Patch 后 5 分钟内开始率     | ≥60%                               |
| Timeline Review Rate      | 查看当日 Review 比例        | ≥50%                               |
| Reason Confirmation       | 未完成原因被用户确认比例    | ≥60%                               |
| False Positive            | “我在工作/误报”提醒占比     | ≤30%                               |
| Companion Dismiss Rate    | 主动提醒被立刻关闭比例      | ≤25%                               |
| Sensor Opt-in             | 摄像头/屏幕等单项授权率     | 仅观察，不设强制 KPI，避免诱导授权 |

# 24. 核心验收标准

| **模块**     | **验收**                                           |
|--------------|----------------------------------------------------|
| NOW          | 从真实 Todo 生成排序，并展示推荐理由               |
| RUN          | 任务开始/暂停/结束数据真实入库                     |
| DEBUG        | START_FAILURE 从检测到 Patch/Verify 完整跑通       |
| Timeline     | 当天 Session 自动生成并可修改                      |
| Review       | 正确统计完成/未完成与用户确认原因                  |
| Companion    | 可常驻、可拖动、可一键打开 NOW/Debug/暂停          |
| Camera       | 关闭时零调用；开启时不保存画面，只写派生状态       |
| Screen Share | 共享范围可见、可随时停止；单应用模式只处理指定应用 |
| Voice        | 可彻底关闭；免打扰/Focus 下不主动出声              |
| Privacy      | 所有感知权限有状态指示、导出、删除、Ghost Mode     |

# 25. 产品边界

- LifeOS 不做医学或心理诊断；“Fatigue/Avoidance”只是任务执行情境标签。

- LifeOS 不把摄像头变成监控工具，不对用户做身份识别、面部画像或情绪标签。

- LifeOS 不以“完成更多”为唯一目标，主动结束、延后、休息都可以是合理结果。

- LifeOS 不应替用户完成全部任务；Companion 的核心是协助用户继续行动。

- 任何跨内容理解能力必须建立在明确、可撤销、可见的共享会话之上。

# 26. 典型端到端场景

> 1\. 用户在 TODO 中录入“修改论文 90min、回导师消息 5min、报销 20min”。
>
> 2\. 10:20 打开 LifeOS，NOW 推荐“修改论文”，显示 Rhythm Match 与推荐原因。
>
> 3\. 用户从桌面 Companion 点击 Start。Companion 自动进入 Quiet Focus 状态。
>
> 4\. 运行 15 分钟后，行为切换明显增多；若用户已授权 Camera Presence，系统同时发现连续离席/未面向屏幕。
>
> 5\. Companion 先以轻微动作提示；持续异常后显示文字：“这个任务启动得比平时慢，要 Debug 一下吗？”
>
> 6\. 用户进入 Debug，选择“不知道从哪里开始”。系统生成 Patch：“只修改第一条批注，3min”。
>
> 7\. 用户可选“Share Word with LifeOS”，让系统结合当前页面确认第一条批注位置；也可完全不共享内容。
>
> 8\. Patch 成功后用户继续工作并完成 Session。
>
> 9\. 下午某任务未完成，用户结束时选择“被临时会议打断”。
>
> 10\. 晚上 Timeline 自动展示全天各时段；Daily Review 总结上午 Deep Work 成功、下午 Admin 更匹配，并更新 Life Rhythm。
>
> 11\. 下一天 NOW 使用新的节律与执行数据重新排序任务。
