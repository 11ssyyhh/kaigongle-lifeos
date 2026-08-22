**LifeOS**

**产品执行文档**

完整落地版：核心 MVP + Companion 多模态增强路线

**Life has bugs. Patch them.**

不是管理生活，而是 Debug 生活。

| **文档版本** | v2.0                            |
|--------------|---------------------------------|
| **更新日期** | 2026-08-22                      |
| **文档状态** | 可执行稿                        |
| **产品阶段** | 核心闭环 + Companion 多模态扩展 |

# 1. 执行目标与原则

> **执行目标**
> 先把“TODO → NOW → RUN → DEBUG → TIMELINE → REVIEW”做成可真实使用的闭环，再用 Desktop Companion 承载交互；摄像头、语音、屏幕共享作为 P1 增强，必须建立在清晰权限和可降级架构上。

- 核心闭环不能依赖摄像头/屏幕共享才能工作。

- 所有感知能力本地优先、显式授权、随时可停。

- 桌面宠物先作为交互外壳，再逐步接入感知能力。

- AI 不负责“监控一切”，规则与用户确认负责检测，AI 只做受限解释/匹配/内容协助。

# 2. 交付范围冻结

| **层级**     | **必须做**                                                                             | **可延后**              |
|--------------|----------------------------------------------------------------------------------------|-------------------------|
| P0 Core      | TODO、NOW、RUN、Windows行为监测、START_FAILURE、Patch、Timeline、Outcome、Daily Review | 复杂 Rhythm/多 Bug      |
| P0 Companion | 常驻桌面小助手、拖动、状态、快捷入口、静默/专注状态                                    | 角色市场/复杂动画       |
| P1 Sensors   | Camera Presence、语音提醒、Share One App                                               | Entire Screen、语音对话 |
| P1 Learn     | Life Rhythm、推荐反馈、Companion 介入效果统计                                          | 复杂 ML                 |
| P2           | Entire Screen、麦克风对话、跨平台/移动端                                               | 商业化/社交             |

# 3. 推荐技术栈

| **层**           | **建议**                                                                 |
|------------------|--------------------------------------------------------------------------|
| 桌面壳           | Electron + TypeScript（黑客松/快速落地）；后续可评估 Tauri               |
| UI               | React + TypeScript + CSS/Tailwind；Companion 使用透明 always-on-top 窗口 |
| 本地数据库       | SQLite / better-sqlite3                                                  |
| Windows 行为采集 | Win32 GetForegroundWindow + GetLastInputInfo                             |
| Camera Presence  | 本地轻量视觉管线；优先浏览器/MediaPipe 类方案或原生推理，不上传原始帧    |
| Screen Capture   | Electron desktopCapturer；单应用源过滤 + 显式会话                        |
| 语音输出         | 系统 TTS 或本地 TTS；默认不需麦克风                                      |
| LLM              | 可选 Gateway；结构化 JSON；屏幕上下文逐次授权                            |
| 日志/配置        | 本地 JSON + SQLite；规则配置可热更新                                     |

# 4. 系统架构

Main Process  
├─ Window / Tray / Companion Overlay Manager  
├─ Permission & Sensor Manager  
├─ Windows Behavior Collector  
├─ Camera Presence Worker (optional)  
├─ Screen Context Session Manager (optional)  
├─ Rule Engine / Intervention Engine  
├─ Recommendation Engine  
├─ Timeline / Review / Rhythm Analyzer  
├─ Optional LLM Gateway  
└─ SQLite Repository  
  
Renderer  
├─ NOW / TODO / RUN / DEBUG  
├─ Timeline / Review / Rhythm  
├─ Sensor Center  
└─ Companion Overlay

# 5. 关键进程与隔离

- 行为采集、摄像头处理、屏幕捕获尽量与主 UI 解耦；单个 Worker 崩溃不影响任务与数据查看。

- 摄像头原始帧只在内存中处理，默认不写磁盘。

- 屏幕共享会话必须有 sessionId、scope、start/end 时间，并在 UI 上可见。

- LLM Gateway 接收最小上下文；无网络/关闭 AI 时，Patch 和 Review 走模板/规则降级。

# 6. 数据库表结构（建议）

| **表**                  | **关键字段**                                                            |
|-------------------------|-------------------------------------------------------------------------|
| todo_tasks              | id,name,deadline,estimated_minutes,task_type,priority,target_app,status |
| task_sessions           | id,task_id,start_at,end_at,result,effective_minutes,target_app_ratio    |
| behavior_events         | session_id,timestamp,app_name,event_type,idle_seconds                   |
| presence_signals        | session_id,timestamp,presence,facing_screen,away_seconds,confidence     |
| screen_context_sessions | id,session_id,mode,app_id,start_at,end_at,ai_shared                     |
| intervention_events     | session_id,level,channel,reason,user_response,dismissed                 |
| bug_sessions            | session_id,bug_type,snapshot,root_cause,status                          |
| patch_attempts          | bug_id,sequence,template_id,action,estimated_minutes,result             |
| recommendations         | task_id,recommended_at,score,reasons_json,accepted,final_result         |
| session_outcomes        | session_id,reason_code,user_confirmed,note                              |
| daily_reviews           | date,summary_json,insights_json,next_suggestions_json                   |
| rhythm_stats            | time_slot,task_type,samples,success_rate,avg_startup,bug_rate           |
| companion_profile       | character_id,name,voice,tone,proactive_level,animation_level            |
| sensor_permissions      | sensor_type,enabled,scope,granted_at,expires_at                         |

# 7. P0 Core 开发任务

| **ID** | **任务**                  | **完成定义**                   |
|--------|---------------------------|--------------------------------|
| C01    | Electron + React 项目壳   | 安装可运行，托盘/主窗口可用    |
| C02    | SQLite Schema             | 所有 P0 表可 CRUD              |
| C03    | TODO CRUD                 | 任务 5 个核心字段可用          |
| C04    | TaskSession 状态机        | Start/Pause/Resume/End 可恢复  |
| C05    | Windows 行为采集          | 应用/切换/空闲真实入库         |
| C06    | NOW Recommendation Engine | 从真实 Todo 计算分数并解释     |
| C07    | START_FAILURE Rule Engine | 按兜底/个人基线触发            |
| C08    | Debug/Patch               | 固定根因 + 模板 + Focus/Verify |
| C09    | Outcome 原因选择          | 结束时 1 个轻量问题            |
| C10    | Timeline Builder          | 当天 Session 自动排序/合并     |
| C11    | Daily Review              | 完成/未完成、原因、3条洞察     |
| C12    | Privacy 基础              | 授权、导出/删除、Ghost Mode    |

# 8. P0 Companion 开发任务

| **ID** | **任务**     | **完成定义**                                    |
|--------|--------------|-------------------------------------------------|
| P01    | 透明悬浮窗口 | Always-on-top，可拖动，不抢焦点                 |
| P02    | 状态机       | Idle/Focus/Drift/Debug/Patch/Complete 动画状态  |
| P03    | 快捷菜单     | NOW、当前任务、Debug、Pause Monitoring、Sensors |
| P04    | Quiet Focus  | Focus Mode 自动降低动画和提示                   |
| P05    | 角色配置基础 | 官方角色至少 2 套；名字/提醒强度可设置          |
| P06    | 消息气泡     | 支持视觉/文本提醒，不依赖语音                   |

# 9. P1 Camera Presence

## 9.1 技术目标

- 只输出 presence / facing_screen / away_duration 等派生信号。

- 帧默认不落盘、不上传。

- Camera OFF 时不初始化摄像头设备。

## 9.2 处理流程

User grants Camera Presence  
→ open camera stream  
→ local frame sampling (low FPS)  
→ presence / rough facing classification  
→ aggregate to 5–10s signal  
→ write derived signal only  
→ Rule / Intervention Engine uses low weight

## 9.3 验收

- 用户关闭权限后 2 秒内释放摄像头。

- 本地目录与数据库不出现原始图片/视频。

- 摄像头单一信号不能直接触发 Level 3 语音提醒。

- 状态中心持续显示 Camera ON/OFF。

# 10. P1 Screen Context

## 10.1 单应用共享优先

> 1\. 用户点击 Companion → Share Context。
>
> 2\. 弹出可共享源列表，默认选择 One App。
>
> 3\. 创建 ScreenContextSession，并持续显示共享标识。
>
> 4\. 仅在用户主动请求协助/Debug 时抽取当前必要上下文。
>
> 5\. 用户点击 Stop Sharing 立即结束会话并释放捕获。

## 10.2 Entire Screen

- 放到 P2；每次开启单独二次确认。

- 明确提示可能出现其他应用敏感内容。

- 默认不自动发送给 LLM。

## 10.3 验收

- One App 模式不应读取其他应用源。

- 共享期间 UI 有持久在线指示。

- 停止后不得继续产生新上下文事件。

# 11. P1 Voice Intervention

| **模式**    | **实现**                                              |
|-------------|-------------------------------------------------------|
| Never       | 绝不调用 TTS                                          |
| Severe Only | 达到严重阈值且不在 Focus/DND 时调用                   |
| Smart       | Intervention Engine 在 Level 1/2 无效后才考虑 Level 3 |

- 语音输出使用系统 TTS 即可，第一版不需要麦克风。

- 同一任务语音提醒默认 30 分钟最多 1 次。

- 用户忽略/关闭后自动降低主动性。

# 12. Intervention Engine

Inputs:  
- behavior anomaly score  
- personal baseline deviation  
- optional presence signal  
- current task state  
- time since last intervention  
- focus / meeting / DND state  
- user companion proactive setting  
  
Outputs:  
0 = silent  
1 = visual animation  
2 = text bubble  
3 = voice reminder  
4 = suggest Debug (never forced)

- 输出必须可解释并记录 reason。

- 不要从 Level 1 直接跳 Level 3，除非用户显式选择 Active 且满足严重阈值。

- 用户选择“我在工作”后把此次事件作为误报样本。

# 13. NOW / Rhythm / Review 执行规则

## 13.1 冷启动推荐

cold_start_score =  
0.35 deadline_urgency  
+ 0.25 duration_fit  
+ 0.20 priority  
+ 0.10 task_type_preference  
+ 0.10 historical_signal

## 13.2 有历史后的推荐

score =  
0.30 rhythm_match  
+ 0.25 deadline_urgency  
+ 0.20 duration_fit  
+ 0.15 priority  
+ 0.10 historical_success

## 13.3 Timeline / Review

- Session 自动成为 Timeline 主事件；Debug、Patch、Intervention、屏幕共享作为子事件。

- 未完成必须尽量得到用户确认原因；系统推断仅作为候选。

- Daily Review 最多输出 3 条洞察 + 3 条次日建议，避免长报告。

# 14. Companion 状态机

IDLE  
↓ Start task  
FOCUS  
↓ mild anomaly  
DRIFT_VISUAL  
↓ persists  
DRIFT_TEXT  
↓ user chooses Debug  
DEBUG  
↓ patch installed  
PATCH_RUNNING  
↓ success  
COMPLETE  
↓  
IDLE  
  
Any state → GHOST / DND → suppress proactive intervention

# 15. 5 周落地排期

| **周次** | **目标**                      | **任务**                                            | **验收**                          |
|----------|-------------------------------|-----------------------------------------------------|-----------------------------------|
| 第1周    | P0 数据地基                   | Electron、SQLite、TODO、TaskSession、授权、行为采集 | 真实记录一段任务 Session          |
| 第2周    | NOW + Debug                   | 推荐引擎、START_FAILURE、提醒、Patch、Focus、Verify | 从 Todo 推荐到 Patch 成功完整跑通 |
| 第3周    | Timeline + Review + Companion | 时间线、原因、Daily Review、Companion 悬浮壳/状态机 | 完成一天数据→Review；宠物可常驻   |
| 第4周    | Camera + Voice                | Camera Presence、本地派生信号、三级干预、TTS        | Camera 可开关；提醒可配置且不打扰 |
| 第5周    | Screen One App + Rhythm       | 单应用共享、上下文协助、基础 Rhythm、用户测试       | 共享会话可控；Rhythm 影响 NOW     |

> **如果仍以黑客松为目标**
> 优先完成前 3 周功能；第 4–5 周能力在比赛 Demo 中可用明确标注的 Mock 展示概念，但不要声称已经真实实现。

# 16. 团队分工建议

| **角色**            | **职责**                                                     |
|---------------------|--------------------------------------------------------------|
| 产品/交互           | PRD、NOW 解释、Companion 规则、权限文案、用户测试、Demo      |
| 前端                | 主 UI、Companion Overlay、Timeline/Review、状态动画          |
| 客户端/后端         | Electron、Windows API、SQLite、权限、screen capture          |
| AI/算法             | 推荐、Rule Engine、Patch、Review/Rhythm、Intervention Engine |
| 视觉/角色（可兼任） | 宠物形象、状态动画、固定角色与自定义规范                     |

# 17. 测试用例

| **用例** | **操作**                            | **预期**                          |
|----------|-------------------------------------|-----------------------------------|
| NOW-01   | 当前只有 15min 空档                 | 优先推荐 5–15min Quick Task       |
| DBG-01   | 任务\>15min、切换\>8、目标应用\<40% | 触发低调 START_FAILURE            |
| CMP-01   | Focus Mode 中                       | Companion 减少动画，不主动语音    |
| CMP-02   | 连续忽略两次提醒                    | 主动性自动下降                    |
| CAM-01   | Camera OFF                          | 进程不占用摄像头                  |
| CAM-02   | Camera ON 后离席                    | 只写 presence/away 派生数据       |
| SCR-01   | Share One App=Word                  | 只创建 Word 共享会话              |
| SCR-02   | Stop Sharing                        | 立即停止捕获并更新状态            |
| VOICE-01 | Voice=Never                         | 任何异常都不调用 TTS              |
| VOICE-02 | DND 时严重异常                      | 不语音，最多记录/静默             |
| TL-01    | 完成/未完成混合一天                 | Timeline 和 Review 正确汇总       |
| PRIV-01  | Ghost Mode                          | 所有主动感知暂停，TODO/NOW 仍可用 |

# 18. 隐私/安全工程检查单

- Camera 帧不落盘；代码 review 检查临时文件。

- Screen capture 只在 session active 时初始化。

- Sensor 状态必须在托盘/Companion 可见。

- 任何 LLM 请求记录发送字段，便于审计。

- 日志不得写入文档正文、聊天内容等敏感上下文。

- 导出/删除覆盖新增 presence/screen/intervention 表。

- 权限撤销后清理运行中的资源与订阅。

# 19. Demo 脚本（8–10 分钟）

> 1\. 展示 TODO 与 NOW：推荐“修改论文”，解释为什么现在适合。
>
> 2\. 从桌面 Companion 点击 Start，宠物进入 Quiet Focus。
>
> 3\. 展示真实行为监测；模拟/真实出现 START_FAILURE。
>
> 4\. Companion Level 1 动作 → Level 2 文本：“任务启动得比平时慢，要 Debug 吗？”
>
> 5\. 进入 Debug，生成 Patch：“只修改第一条批注”。
>
> 6\. 展示“Share Word with LifeOS（单应用）”开关：明确说明只在授权后读取当前应用上下文。
>
> 7\. 完成 Patch，显示 Verify。
>
> 8\. 展示 Timeline：任务、Debug、Patch、提醒事件。
>
> 9\. 展示 Daily Review 与 Rhythm：今天什么时候适合 Deep Work，未完成任务是什么原因。
>
> 10\. 最后打开 Sensor Center：Camera/Screen/Voice 都可独立开关，强调隐私边界。

# 20. 砍功能顺序

| **如果时间不足** | **优先砍**                         | **必须保留**                                        |
|------------------|------------------------------------|-----------------------------------------------------|
| 轻微超期         | 角色自定义、复杂动画               | Companion 常驻壳 + 核心快捷操作                     |
| 中度超期         | Camera Presence、Voice             | TODO/NOW/RUN/DEBUG/TIMELINE/REVIEW                  |
| 严重超期         | Screen Context、Rhythm 可视化、LLM | 可解释 NOW + START_FAILURE Patch + Timeline/Outcome |

# 21. 最终交付物

- Windows 可运行 LifeOS MVP 安装包/开发版。

- 完整 P0 主流程与 Desktop Companion。

- SQLite Schema 与迁移脚本。

- Windows 行为采集模块。

- Recommendation / Rule / Intervention 配置。

- Patch 模板库。

- Camera Presence P1 模块（若完成）。

- Screen One App P1 模块（若完成）。

- Sensor & Privacy Center。

- Demo Seed 与演示脚本。

- 10 名目标用户测试记录与指标结果。

# 22. 上线/验收门槛

- P0 主流程无死链；应用重启后数据不丢。

- 行为采集不记录内容数据。

- Companion 不抢焦点、不持续遮挡用户。

- Camera/Screen/Voice 每一项都可彻底关闭。

- 无 AI、无 Camera、无 Screen Share 时核心闭环仍可用。

- 所有主动提醒都尊重 DND、Focus、冷却期和用户主动程度。
