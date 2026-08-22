import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  dialog,
  screen,
  desktopCapturer,
  session as electronSession,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { getDb, getSetting, setSetting } from "./db";
import {
  BehaviorCollector,
  type BehaviorSample,
} from "./services/behaviorCollector";
import { mapTask, recommend, type TaskRow } from "./services/recommendation";
import { createWorker, type Worker } from "tesseract.js";

const localEnv = path.join(process.cwd(), ".env.local");
if (!process.env.DEEPSEEK_API_KEY && fs.existsSync(localEnv)) {
  const match = fs
    .readFileSync(localEnv, "utf8")
    .match(/^DEEPSEEK_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
  if (match) process.env.DEEPSEEK_API_KEY = match[1].trim();
}

let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let lastApp: string | null = null;
let bugCooldownAt = 0;
let ocrWorkerPromise: Promise<Worker> | null = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    const developmentData = path.join(process.cwd(), "public", "tessdata");
    const packagedData = path.join(app.getAppPath(), "dist", "tessdata");
    const langPath = fs.existsSync(developmentData)
      ? developmentData
      : packagedData;
    ocrWorkerPromise = createWorker(["chi_sim", "eng"], 1, {
      langPath,
      gzip: true,
      cacheMethod: "none",
    });
  }
  return ocrWorkerPromise;
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
const interventionState = new Map<
  number,
  {
    level: number;
    firstAt: number;
    suppressedUntil: number;
    ignored: number;
    lastVoiceAt: number;
  }
>();
const collector = new BehaviorCollector();

const sensorKeys = [
  "applicationActivity",
  "cameraPresence",
  "screenContext",
  "voiceReminder",
  "aiContextSharing",
  "ghostMode",
] as const;
const settingKeys = [
  "availableMinutes",
  "proactiveLevel",
  "voiceMode",
  "dndStart",
  "dndEnd",
  "companionCharacter",
  "companionName",
  "companionAvatar",
  "companionScale",
  "companionColor",
  "companionImage",
  "meetingMode",
  "retentionDays",
] as const;

function rendererUrl(hash = "") {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev ? `${dev}${hash}` : path.join(__dirname, "../dist/index.html");
}
async function loadRenderer(win: BrowserWindow, hash = "") {
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) await win.loadURL(`${dev}${hash}`);
  else
    await win.loadFile(
      path.join(__dirname, "../dist/index.html"),
      hash ? { hash: hash.replace(/^#/, "") } : undefined,
    );
}
function createMain() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1050,
    minHeight: 720,
    backgroundColor: "#060a12",
    title: "开工了 · LifeOS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  void loadRenderer(mainWindow);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createCompanion() {
  companionWindow = new BrowserWindow({
    width: 440,
    height: 520,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 360,
    minHeight: 420,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  companionWindow.setAlwaysOnTop(true, "floating");
  void loadRenderer(companionWindow, "#/companion");
  companionWindow.once("ready-to-show", () => companionWindow?.showInactive());
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  companionWindow.setPosition(
    Math.max(0, width - 460),
    Math.max(0, height - 540),
  );
  companionWindow.on("closed", () => {
    companionWindow = null;
  });
}
function sendEvent(payload: unknown) {
  mainWindow?.webContents.send("lifeos:event", payload);
  companionWindow?.webContents.send("lifeos:event", payload);
}
function createTray() {
  const data =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAJUlEQVR42mNgGAWjYBSMglEwCkbB////L2RgYGBg+M/AwMDwH4gBAJmsD/5Ab8UAAAAASUVORK5CYII=";
  tray = new Tray(nativeImage.createFromDataURL(data));
  tray.setToolTip("开工了 · LifeOS");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "打开「开工了」",
        click: () => {
          if (!mainWindow) createMain();
          else {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { label: "显示 / 隐藏 Companion", click: () => toggleCompanion() },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]),
  );
  tray.on("double-click", () => mainWindow?.show());
}
function toggleCompanion() {
  if (!companionWindow) {
    createCompanion();
    return;
  }
  companionWindow.isVisible() ? companionWindow.hide() : companionWindow.show();
}

function currentSession() {
  return getDb()
    .prepare(
      `SELECT s.*,t.name task_name,t.target_app,t.task_type,t.estimated_minutes FROM task_sessions s JOIN todo_tasks t ON t.id=s.task_id WHERE s.status IN ('running','paused') ORDER BY s.id DESC LIMIT 1`,
    )
    .get() as any | undefined;
}
function aliases(target: string | null) {
  if (!target) return [];
  const x = target.toLowerCase();
  const a = [x];
  if (x.includes("word")) a.push("winword");
  if (x.includes("powerpoint")) a.push("powerpnt");
  if (x.includes("excel")) a.push("excel");
  if (x.includes("wechat")) a.push("wechat");
  if (x.includes("chrome")) a.push("chrome");
  return a;
}
function behaviorSummary(session: any) {
  const rows = getDb()
    .prepare(
      "SELECT app_name,event_type,idle_seconds FROM behavior_events WHERE session_id=? ORDER BY id",
    )
    .all(session.id) as Array<{
    app_name: string;
    event_type: string;
    idle_seconds: number;
  }>;
  const switches = rows.filter((r) => r.event_type === "switch").length;
  const targetAliases = aliases(session.target_app);
  const targetHits = targetAliases.length
    ? rows.filter((r) =>
        targetAliases.some((a) => (r.app_name || "").toLowerCase().includes(a)),
      ).length
    : 0;
  const ratio = rows.length ? targetHits / rows.length : 0;
  const maxIdle = rows.reduce((n, r) => Math.max(n, r.idle_seconds || 0), 0);
  return { switches, targetRatio: ratio, maxIdle, samples: rows.length };
}
function maybeDetectBug(session: any) {
  const sensors = getSensors();
  if (
    sensors.ghostMode ||
    !sensors.applicationActivity ||
    session.status !== "running"
  )
    return;
  const elapsed = (Date.now() - new Date(session.start_at).getTime()) / 60000;
  const m = behaviorSummary(session);
  const severity =
    (m.switches >= 5 || m.maxIdle >= 90 ? 1 : 0) +
    (m.switches > 8 && m.targetRatio < 0.4 ? 1 : 0) +
    (m.maxIdle >= 180 || m.switches > 14 ? 1 : 0);
  if (severity) interventionFor(session, severity, "START_FAILURE");
  if (Date.now() - bugCooldownAt < 30 * 60000) return;
  if (elapsed > 15 && m.switches > 8 && m.targetRatio < 0.4) {
    bugCooldownAt = Date.now();
    const snapshot = JSON.stringify({
      runningMinutes: Math.round(elapsed),
      windowSwitches: m.switches,
      targetAppRatio: m.targetRatio,
      idleSeconds: m.maxIdle,
    });
    getDb()
      .prepare(
        "INSERT INTO bug_sessions(session_id,bug_type,snapshot,status,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        session.id,
        "START_FAILURE",
        snapshot,
        "open",
        new Date().toISOString(),
      );
    sendEvent({
      type: "bug-detected",
      title: "任务启动得比平时慢",
      message: `「${session.task_name}」切换较频繁，要不要一起 Debug 一下？`,
      payload: JSON.parse(snapshot),
    });
  }
}
function onSample(sample: BehaviorSample) {
  const s = currentSession();
  if (!s || s.status !== "running") return;
  const eventType =
    lastApp && lastApp !== sample.appName ? "switch" : "heartbeat";
  lastApp = sample.appName;
  getDb()
    .prepare(
      "INSERT INTO behavior_events(session_id,timestamp,app_name,event_type,idle_seconds) VALUES(?,?,?,?,?)",
    )
    .run(s.id, sample.ts, sample.appName, eventType, sample.idleSeconds);
  maybeDetectBug(s);
}
collector.on("sample", onSample);

function getSensors() {
  return {
    applicationActivity: getSetting("sensor.applicationActivity", true),
    cameraPresence: getSetting("sensor.cameraPresence", false),
    screenContext: getSetting("sensor.screenContext", false),
    voiceReminder: getSetting("sensor.voiceReminder", true),
    aiContextSharing: getSetting("sensor.aiContextSharing", false),
    ghostMode: getSetting("sensor.ghostMode", false),
  };
}
function getSettings() {
  return {
    availableMinutes: getSetting("settings.availableMinutes", 60),
    proactiveLevel: getSetting("settings.proactiveLevel", "Balanced"),
    voiceMode: getSetting("settings.voiceMode", "Smart"),
    dndStart: getSetting("settings.dndStart", "22:00"),
    dndEnd: getSetting("settings.dndEnd", "08:00"),
    companionCharacter: getSetting("settings.companionCharacter", "Milo"),
    companionName: getSetting("settings.companionName", "Milo"),
    companionAvatar: getSetting("settings.companionAvatar", "robot"),
    companionScale: getSetting("settings.companionScale", 100),
    companionColor: getSetting("settings.companionColor", "#9dc5ff"),
    companionImage: getSetting("settings.companionImage", ""),
    meetingMode: getSetting("settings.meetingMode", false),
    retentionDays: getSetting("settings.retentionDays", 30),
  };
}
function inDnd(settings = getSettings()) {
  if (settings.meetingMode) return true;
  const now = new Date(),
    current = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = settings.dndStart.split(":").map(Number),
    [eh, em] = settings.dndEnd.split(":").map(Number);
  const start = sh * 60 + sm,
    end = eh * 60 + em;
  return start <= end
    ? current >= start && current < end
    : current >= start || current < end;
}
function speakLocal(text: string) {
  const sensors = getSensors(),
    settings = getSettings();
  if (
    process.platform !== "win32" ||
    !sensors.voiceReminder ||
    settings.voiceMode === "Never" ||
    inDnd(settings)
  )
    return;
  const safe = text.replace(/'/g, "''");
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${safe}')`,
    ],
    { windowsHide: true },
  );
}
function recordIntervention(
  session: any,
  level: number,
  channel: string,
  reason: string,
  message: string,
) {
  getDb()
    .prepare(
      "INSERT INTO intervention_events(session_id,level,channel,reason,created_at) VALUES(?,?,?,?,?)",
    )
    .run(session.id, level, channel, reason, new Date().toISOString());
  sendEvent({
    type: "intervention",
    level,
    title: level === 1 ? "轻微游离" : level === 2 ? "需要一点帮助" : "语音提醒",
    message,
    payload: { reason, level },
  });
  if (level === 3) speakLocal(message);
}
function interventionFor(
  session: any,
  severity: number,
  reason = "FOCUS_DRIFT",
) {
  const sensors = getSensors(),
    settings = getSettings();
  if (
    sensors.ghostMode ||
    session.status !== "running" ||
    settings.proactiveLevel === "Quiet"
  )
    return;
  const now = Date.now(),
    state = interventionState.get(session.id) || {
      level: 0,
      firstAt: now,
      suppressedUntil: 0,
      ignored: 0,
      lastVoiceAt: 0,
    };
  if (now < state.suppressedUntil) return;
  const effective = state.ignored >= 2 ? Math.max(0, severity - 1) : severity;
  if (effective >= 1 && state.level < 1) {
    state.level = 1;
    recordIntervention(
      session,
      1,
      "visual",
      reason,
      "这个任务似乎有一点游离，我会先安静陪着你。",
    );
  } else if (effective >= 2 && state.level < 2 && now - state.firstAt > 8000) {
    state.level = 2;
    recordIntervention(
      session,
      2,
      "text",
      reason,
      `「${session.task_name}」好像卡住了，要不要一起拆小一点？`,
    );
  } else if (
    effective >= 3 &&
    state.level < 3 &&
    state.level >= 2 &&
    now - state.firstAt > 16000 &&
    now - state.lastVoiceAt > 30 * 60000 &&
    settings.voiceMode !== "Never" &&
    !inDnd(settings)
  ) {
    state.level = 3;
    state.lastVoiceAt = now;
    recordIntervention(
      session,
      3,
      "voice",
      reason,
      "这个任务卡住了一会儿，要不要先做一个最小动作？",
    );
  }
  interventionState.set(session.id, state);
}
function rhythmStats() {
  const rows = getDb()
    .prepare(
      `SELECT s.start_at,s.result,s.effective_minutes,t.task_type FROM task_sessions s JOIN todo_tasks t ON t.id=s.task_id WHERE s.status='ended'`,
    )
    .all() as any[];
  const groups = new Map<
    string,
    { slot: string; type: string; n: number; ok: number; eff: number }
  >();
  for (const r of rows) {
    const h = new Date(r.start_at).getHours();
    const start = Math.floor(h / 2) * 2;
    const slot = `${String(start).padStart(2, "0")}:00–${String(start + 2).padStart(2, "0")}:00`;
    const key = `${slot}|${r.task_type}`;
    const g = groups.get(key) || {
      slot,
      type: r.task_type,
      n: 0,
      ok: 0,
      eff: 0,
    };
    g.n++;
    if (r.result === "completed") g.ok++;
    g.eff += r.effective_minutes || 0;
    groups.set(key, g);
  }
  let result = [...groups.values()].map((g) => ({
    timeSlot: g.slot,
    taskType: g.type,
    samples: g.n,
    successRate: g.n ? g.ok / g.n : 0,
    avgStartup: 6,
    bugRate: 0.12,
  }));
  if (!result.length)
    result = [
      {
        timeSlot: "09:00–11:00",
        taskType: "Deep Work",
        samples: 0,
        successRate: 0.5,
        avgStartup: 0,
        bugRate: 0,
      },
    ];
  result = result.sort((a, b) => b.successRate - a.successRate).slice(0, 8);
  const upsert = getDb().prepare(
    "INSERT INTO rhythm_stats(time_slot,task_type,samples,success_rate,avg_startup,bug_rate,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(time_slot,task_type) DO UPDATE SET samples=excluded.samples,success_rate=excluded.success_rate,avg_startup=excluded.avg_startup,bug_rate=excluded.bug_rate,updated_at=excluded.updated_at",
  );
  for (const x of result)
    upsert.run(
      x.timeSlot,
      x.taskType,
      x.samples,
      x.successRate,
      x.avgStartup,
      x.bugRate,
      new Date().toISOString(),
    );
  return result;
}
function timeline() {
  const day = new Date().toISOString().slice(0, 10);
  const rows = getDb()
    .prepare(
      `SELECT s.*,t.name task_name,t.task_type,t.estimated_minutes,o.reason_code FROM task_sessions s JOIN todo_tasks t ON t.id=s.task_id LEFT JOIN session_outcomes o ON o.session_id=s.id WHERE substr(s.start_at,1,10)=? ORDER BY s.start_at`,
    )
    .all(day) as any[];
  return rows.map((r) => {
    const bugs = getDb()
      .prepare("SELECT COUNT(*) n FROM bug_sessions WHERE session_id=?")
      .get(r.id) as any;
    const patches = getDb()
      .prepare(
        "SELECT COUNT(*) n FROM patch_attempts p JOIN bug_sessions b ON b.id=p.bug_id WHERE b.session_id=?",
      )
      .get(r.id) as any;
    const interventions = getDb()
      .prepare("SELECT COUNT(*) n FROM intervention_events WHERE session_id=?")
      .get(r.id) as any;
    const shares = getDb()
      .prepare(
        "SELECT COUNT(*) n FROM screen_context_sessions WHERE session_id=?",
      )
      .get(r.id) as any;
    const away = getDb()
      .prepare(
        "SELECT MAX(away_seconds) n FROM presence_signals WHERE session_id=?",
      )
      .get(r.id) as any;
    const details = [
      r.reason_code,
      bugs.n ? `Bug×${bugs.n}` : null,
      patches.n ? `Patch×${patches.n}` : null,
      interventions.n ? `提醒×${interventions.n}` : null,
      shares.n ? `单应用共享×${shares.n}` : null,
      away.n ? `离席 ${away.n}s` : null,
    ].filter(Boolean);
    const actual = r.end_at
      ? Math.max(
          1,
          Math.round(
            (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) /
              60000,
          ),
        )
      : null;
    return {
      id: String(r.id),
      startAt: r.start_at,
      endAt: r.end_at,
      taskName: r.task_name,
      taskType: r.task_type,
      status: r.status,
      result: r.result,
      plannedMinutes: r.estimated_minutes,
      actualMinutes: actual,
      effectiveMinutes: r.effective_minutes,
      note: details.join(" · ") || undefined,
    };
  });
}
function review(tasks: TaskRow[]) {
  const day = new Date().toISOString().slice(0, 10);
  const rows = getDb()
    .prepare(
      `SELECT s.*,o.reason_code FROM task_sessions s LEFT JOIN session_outcomes o ON o.session_id=s.id WHERE substr(s.start_at,1,10)=?`,
    )
    .all(day) as any[];
  const reasons = new Map<string, number>();
  for (const r of rows) {
    if (r.reason_code)
      reasons.set(r.reason_code, (reasons.get(r.reason_code) || 0) + 1);
  }
  const completed = rows.filter((r) => r.result === "completed").length,
    unfinished = rows.filter((r) => r.result === "unfinished").length,
    cancelled = rows.filter((r) => r.result === "cancelled").length;
  const actual = rows.reduce(
    (n, r) =>
      n +
      (r.end_at
        ? Math.max(
            1,
            Math.round(
              (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) /
                60000,
            ),
          )
        : 0),
    0,
  );
  const eff = rows.reduce((n, r) => n + (r.effective_minutes || 0), 0);
  const rh = rhythmStats()[0];
  const result = {
    date: day,
    planned: tasks.filter((t) => t.status !== "completed").length + completed,
    started: rows.length,
    completed,
    unfinished,
    cancelled,
    plannedMinutes: tasks.reduce((n, t) => n + t.estimated_minutes, 0),
    actualMinutes: actual,
    effectiveMinutes: eff,
    reasons: [...reasons]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count })),
    insights: [
      rows.length
        ? `今天共运行 ${rows.length} 个 Process，其中完成 ${completed} 个。`
        : "今天还没有运行记录。",
      rh?.samples
        ? `${rh.timeSlot} 的 ${rh.taskType} 历史推进率较高。`
        : "节律样本正在积累中。",
      unfinished
        ? "未完成不等于拖延：结束原因会用于下一次推荐。"
        : "目前没有未完成任务。",
    ].slice(0, 3),
    nextSuggestions: [
      "把最重要的 Deep Work 放在历史高匹配时段",
      "短空档优先处理 Quick Task",
      "高强度任务之间留出缓冲时间",
    ].slice(0, 3),
  };
  getDb()
    .prepare(
      "INSERT INTO daily_reviews(date,summary_json,insights_json,next_suggestions_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET summary_json=excluded.summary_json,insights_json=excluded.insights_json,next_suggestions_json=excluded.next_suggestions_json,updated_at=excluded.updated_at",
    )
    .run(
      day,
      JSON.stringify({
        ...result,
        insights: undefined,
        nextSuggestions: undefined,
      }),
      JSON.stringify(result.insights),
      JSON.stringify(result.nextSuggestions),
      new Date().toISOString(),
    );
  return result;
}
function serializeSession(row: any | null) {
  if (!row) return null;
  const m = behaviorSummary(row);
  return {
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    startAt: row.start_at,
    endAt: row.end_at,
    result: row.result,
    effectiveMinutes: row.effective_minutes,
    targetAppRatio: m.samples ? m.targetRatio : row.target_app_ratio,
    status: row.status,
  };
}
function snapshot() {
  const tasks = getDb()
    .prepare(
      "SELECT * FROM todo_tasks ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, id DESC",
    )
    .all() as TaskRow[];
  const settings = getSettings();
  const rhythm = rhythmStats();
  return {
    tasks: tasks.map(mapTask),
    activeSession: serializeSession(currentSession() || null),
    recommendations: recommend(tasks, settings.availableMinutes, rhythm),
    timeline: timeline(),
    review: review(tasks),
    rhythm,
    sensors: getSensors(),
    settings,
    runtime: sensorRuntime(),
  };
}
function upsertSensor(key: string, enabled: boolean) {
  getDb()
    .prepare(
      "INSERT INTO sensor_permissions(sensor_type,enabled,scope,granted_at) VALUES(?,?,?,?) ON CONFLICT(sensor_type) DO UPDATE SET enabled=excluded.enabled,granted_at=excluded.granted_at",
    )
    .run(
      key,
      enabled ? 1 : 0,
      key === "screenContext" ? "one_app" : null,
      enabled ? new Date().toISOString() : null,
    );
}

async function generateAiPatch(input: { taskName: string; rootCause: string }) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_NOT_CONFIGURED");
  const session = currentSession();
  const audit = getDb()
    .prepare(
      "INSERT INTO ai_audit_events(session_id,purpose,fields_json,model,success,created_at) VALUES(?,?,?,?,0,?)",
    )
    .run(
      session?.id || null,
      "PATCH",
      JSON.stringify(["taskName", "rootCause"]),
      "deepseek-v4-flash",
      new Date().toISOString(),
    );
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      stream: false,
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            '你是 LifeOS 执行教练。只输出 JSON，不批评用户，不做心理诊断。格式：{"action":"一个具体可执行动作","minutes":1到15的整数,"message":"一句温和说明"}。动作必须足够小，且不替用户完成任务。',
        },
        {
          role: "user",
          content: `任务：${input.taskName}\n固定根因：${input.rootCause}\n请生成最小行动 Patch。`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  const data = (await response.json()) as any;
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("DEEPSEEK_EMPTY_RESPONSE");
  const parsed = JSON.parse(raw) as {
    action?: string;
    minutes?: number;
    message?: string;
  };
  getDb()
    .prepare("UPDATE ai_audit_events SET success=1,model=? WHERE id=?")
    .run(data.model || "deepseek-v4-flash", Number(audit.lastInsertRowid));
  return {
    action: String(parsed.action || "只做一个最小动作"),
    minutes: Math.max(1, Math.min(15, Math.round(Number(parsed.minutes) || 5))),
    message: String(parsed.message || "先只做这一小步。"),
    model: data.model || "deepseek-v4-flash",
  };
}

function activeScreenSession() {
  return getDb()
    .prepare(
      "SELECT * FROM screen_context_sessions WHERE end_at IS NULL ORDER BY id DESC LIMIT 1",
    )
    .get() as any | undefined;
}
function sensorRuntime() {
  const shared = activeScreenSession();
  const p = getDb()
    .prepare(
      "SELECT presence,facing_screen,away_seconds,confidence,timestamp FROM presence_signals ORDER BY id DESC LIMIT 1",
    )
    .get() as any | undefined;
  return {
    screenSharing: shared
      ? {
          id: shared.id,
          appId: shared.app_id,
          mode: shared.mode,
          startAt: shared.start_at,
        }
      : null,
    cameraSignal: p
      ? {
          presence: Boolean(p.presence),
          facingScreen:
            p.facing_screen == null ? null : Boolean(p.facing_screen),
          awaySeconds: p.away_seconds,
          confidence: p.confidence,
          timestamp: p.timestamp,
        }
      : null,
  };
}

function chunkMarkdown(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const chunks: Array<{ heading: string; content: string }> = [];
  let heading = "文档",
    buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body)
      for (let i = 0; i < body.length; i += 900)
        chunks.push({ heading, content: body.slice(i, i + 1000) });
    buf = [];
  };
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line)) {
      flush();
      heading = line.replace(/^#{1,4}\s+/, "").trim();
    } else {
      buf.push(line);
      if (buf.join("\n").length >= 1000) flush();
    }
  }
  flush();
  return chunks;
}
function indexKnowledge(
  name: string,
  sourcePath: string | null,
  content: string,
) {
  const d = getDb(),
    hash = crypto.createHash("sha256").update(content).digest("hex");
  const existing = d
    .prepare("SELECT id FROM knowledge_documents WHERE content_hash=?")
    .get(hash) as any;
  if (existing) return { documentId: existing.id, chunks: 0, duplicate: true };
  const doc = d
    .prepare(
      "INSERT INTO knowledge_documents(name,source_path,content_hash,created_at) VALUES(?,?,?,?)",
    )
    .run(name, sourcePath, hash, new Date().toISOString());
  const documentId = Number(doc.lastInsertRowid),
    insertChunk = d.prepare(
      "INSERT INTO knowledge_chunks(document_id,chunk_index,heading,content) VALUES(?,?,?,?)",
    ),
    insertFts = d.prepare(
      "INSERT INTO knowledge_fts(chunk_id,document_name,heading,content) VALUES(?,?,?,?)",
    );
  const chunks = chunkMarkdown(content);
  d.transaction(() =>
    chunks.forEach((x, i) => {
      const row = insertChunk.run(documentId, i, x.heading, x.content);
      insertFts.run(Number(row.lastInsertRowid), name, x.heading, x.content);
    }),
  )();
  return { documentId, chunks: chunks.length, duplicate: false };
}
function searchKnowledge(query: string) {
  const terms = (query.match(/[\p{L}\p{N}]{2,}/gu) || []).slice(0, 8);
  if (!terms.length) return [];
  const fts = terms.map((x) => `"${x.replace(/"/g, "")}"`).join(" OR ");
  try {
    const exact = getDb()
      .prepare(
        "SELECT chunk_id id,document_name name,heading,content,bm25(knowledge_fts) rank FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 5",
      )
      .all(fts) as any[];
    if (exact.length) return exact;
  } catch {}
  const chinese = [...query.replace(/[^\p{Script=Han}]/gu, "")];
  const fuzzy = [
    ...terms,
    ...chinese
      .slice(0, 20)
      .map((x, i) => x + (chinese[i + 1] || ""))
      .filter((x) => x.length === 2),
  ].slice(0, 12);
  if (!fuzzy.length) return [];
  const where = fuzzy
      .map(() => "(c.content LIKE ? OR c.heading LIKE ?)")
      .join(" OR "),
    args = fuzzy.flatMap((x) => [`%${x}%`, `%${x}%`]);
  return getDb()
    .prepare(
      `SELECT c.id,d.name,c.heading,c.content,0 rank FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id WHERE ${where} LIMIT 5`,
    )
    .all(...args) as any[];
}
function chatHistory() {
  return getDb()
    .prepare(
      "SELECT id,role,content,sources_json,created_at FROM chat_messages ORDER BY id DESC LIMIT 60",
    )
    .all()
    .reverse()
    .map((x: any) => ({
      ...x,
      sources: x.sources_json ? JSON.parse(x.sources_json) : [],
    }));
}
function localChatCommand(message: string) {
  const d = getDb(),
    now = new Date().toISOString();
  let answer = "",
    command: string | undefined,
    page: string | undefined;
  if (/(屏幕共享|共享屏幕|共享软件|共享应用)/.test(message)) {
    setSetting("sensor.screenContext", true);
    upsertSensor("screenContext", true);
    answer = currentSession()
      ? "已打开“单应用屏幕共享”。请在能力页选择要共享的软件窗口；为保护隐私，我不会替你跳过窗口确认。"
      : "已打开屏幕共享能力。请先开始一个任务，再选择要共享的软件窗口。";
    command = "screen-share";
    page = "SENSORS";
  } else if (
    /(打开|显示).*(桌面宠物|桌面小助手)|^(桌面宠物|桌面小助手)$/.test(message)
  ) {
    if (!companionWindow) createCompanion();
    else companionWindow.show();
    answer =
      "桌面宠物已经显示。你可以在能力页修改名字、外观、颜色、大小或导入自己的图片。";
    command = "show-companion";
    page = "SENSORS";
  } else if (/(关闭|隐藏).*(桌面宠物|桌面小助手)/.test(message)) {
    companionWindow?.hide();
    answer = "桌面宠物已经隐藏。";
    command = "hide-companion";
  } else if (/(打开|启用).*(摄像头|相机)/.test(message)) {
    setSetting("sensor.cameraPresence", true);
    upsertSensor("cameraPresence", true);
    answer = currentSession()
      ? "摄像头在位检测已开启，请在能力页确认实时预览。"
      : "摄像头能力已开启；开始任务后会显示预览并运行在位检测。";
    command = "camera";
    page = "SENSORS";
  } else if (/(打开|启用).*(语音|麦克风)/.test(message)) {
    setSetting("sensor.voiceReminder", true);
    upsertSensor("voiceReminder", true);
    answer = "语音能力已开启。进入对话页点击“语音输入”即可授权麦克风。";
    command = "voice";
    page = "CHAT";
  } else if (/(新建|创建|添加).*(任务)/.test(message)) {
    answer = "已打开任务池，请填写可见的新建任务表单。";
    command = "new-task";
    page = "TODO";
  } else if (/(打开|进入).*(对话|聊天)/.test(message)) {
    answer = "已打开日常对话。";
    command = "chat";
    page = "CHAT";
  }
  if (!answer) return null;
  d.prepare(
    "INSERT INTO chat_messages(role,content,created_at) VALUES(?,?,?)",
  ).run("user", message, now);
  d.prepare(
    "INSERT INTO chat_messages(role,content,sources_json,created_at) VALUES(?,?,?,?)",
  ).run("assistant", answer, "[]", now);
  if (page) sendEvent({ type: "navigate", payload: { page, command } });
  else sendEvent({ type: "settings-updated" });
  return { answer, sources: [], command, page };
}
async function compressConversation() {
  const d = getDb(),
    count = (d.prepare("SELECT COUNT(*) n FROM chat_messages").get() as any).n;
  if (count < 12 || count % 8 !== 0) return;
  const rows = d
      .prepare(
        "SELECT id,role,content FROM chat_messages ORDER BY id DESC LIMIT 16",
      )
      .all()
      .reverse() as any[],
    last = rows.at(-1);
  if (!last) return;
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "压缩以下对话为中文长期记忆。只保留用户目标、偏好、决定、未解决问题和重要事实；不要保留寒暄，不添加推测。",
        },
        {
          role: "user",
          content: rows.map((x) => `${x.role}: ${x.content}`).join("\n"),
        },
      ],
    }),
  });
  if (response.ok) {
    const data = (await response.json()) as any;
    const summary = data?.choices?.[0]?.message?.content;
    if (summary)
      d.prepare(
        "INSERT INTO conversation_summaries(through_message_id,summary,created_at) VALUES(?,?,?)",
      ).run(last.id, summary, new Date().toISOString());
  }
}
async function sendChat(message: string) {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("DEEPSEEK_API_KEY_NOT_CONFIGURED");
  const d = getDb(),
    sources = searchKnowledge(message),
    summary =
      (
        d
          .prepare(
            "SELECT summary FROM conversation_summaries ORDER BY id DESC LIMIT 1",
          )
          .get() as any
      )?.summary || "",
    recent = d
      .prepare(
        "SELECT role,content FROM chat_messages ORDER BY id DESC LIMIT 10",
      )
      .all()
      .reverse() as any[];
  d.prepare(
    "INSERT INTO chat_messages(role,content,created_at) VALUES(?,?,?)",
  ).run("user", message, new Date().toISOString());
  const context = sources
    .map(
      (x: any, i: number) =>
        `[资料${i + 1}: ${x.name} / ${x.heading}]\n${String(x.content).slice(0, 1200)}`,
    )
    .join("\n\n");
  const system = `你是 LifeOS Companion。你的职责是陪用户推进任务、回答日常问题和结合本地知识库提供帮助。\n规则：不批评、不羞辱、不做医学心理诊断；优先给一个可执行下一步；不知道就明确说不知道；引用知识库时使用[资料1]格式；不要声称看过未共享的屏幕。\n长期上下文摘要：${summary || "暂无"}\n检索资料：${context || "无匹配资料"}`;
  const audit = d
    .prepare(
      "INSERT INTO ai_audit_events(session_id,purpose,fields_json,model,success,created_at) VALUES(?,?,?,?,0,?)",
    )
    .run(
      currentSession()?.id || null,
      "CHAT_RAG",
      JSON.stringify({
        sent: [
          "message",
          "conversationSummary",
          "recentMessages",
          "retrievedChunks",
        ],
        chunkIds: sources.map((x: any) => x.id),
      }),
      "deepseek-v4-flash",
      new Date().toISOString(),
    );
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(35000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        ...recent.map((x) => ({ role: x.role, content: x.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  const data = (await response.json()) as any,
    answer = String(
      data?.choices?.[0]?.message?.content || "暂时没有生成回答。",
    );
  const refs = sources.map((x: any) => ({
    id: x.id,
    name: x.name,
    heading: x.heading,
  }));
  d.prepare(
    "INSERT INTO chat_messages(role,content,sources_json,created_at) VALUES(?,?,?,?)",
  ).run("assistant", answer, JSON.stringify(refs), new Date().toISOString());
  d.prepare("UPDATE ai_audit_events SET success=1,model=? WHERE id=?").run(
    data.model || "deepseek-v4-flash",
    Number(audit.lastInsertRowid),
  );
  void compressConversation();
  return { answer, sources: refs };
}

function saveCommandReply(
  message: string,
  answer: string,
  page?: string,
  command?: string,
) {
  const d = getDb(),
    now = new Date().toISOString();
  d.prepare(
    "INSERT INTO chat_messages(role,content,created_at) VALUES(?,?,?)",
  ).run("user", message, now);
  d.prepare(
    "INSERT INTO chat_messages(role,content,sources_json,created_at) VALUES(?,?,?,?)",
  ).run("assistant", answer, "[]", now);
  if (page) sendEvent({ type: "navigate", payload: { page, command } });
  else sendEvent({ type: "session-updated" });
  return { answer, sources: [], page, command };
}
function moduleCommand(message: string) {
  const d = getDb();
  if (/(开始|启动).*(推荐|当前|第一个)?任务/.test(message)) {
    const active = currentSession();
    if (active)
      return saveCommandReply(
        message,
        `“${active.task_name}”已经在运行。`,
        "RUN",
        "session-active",
      );
    const task = d
      .prepare(
        "SELECT id,name FROM todo_tasks WHERE status='todo' ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,id LIMIT 1",
      )
      .get() as any;
    if (!task)
      return saveCommandReply(
        message,
        "当前没有待办任务，已为你打开新建任务页面。",
        "TODO",
        "new-task",
      );
    d.prepare("UPDATE todo_tasks SET status='running' WHERE id=?").run(task.id);
    d.prepare(
      "INSERT INTO task_sessions(task_id,start_at,status) VALUES(?,?,?)",
    ).run(task.id, new Date().toISOString(), "running");
    return saveCommandReply(
      message,
      `已开始任务：“${task.name}”。`,
      "RUN",
      "start-task",
    );
  }
  if (/暂停.*任务|暂停专注/.test(message)) {
    const s = currentSession();
    if (s)
      d.prepare("UPDATE task_sessions SET status='paused' WHERE id=?").run(
        s.id,
      );
    return saveCommandReply(
      message,
      s ? "任务已暂停。" : "当前没有运行中的任务。",
      "RUN",
      "pause",
    );
  }
  if (/(继续|恢复).*(任务|专注)/.test(message)) {
    const s = currentSession();
    if (s)
      d.prepare("UPDATE task_sessions SET status='running' WHERE id=?").run(
        s.id,
      );
    return saveCommandReply(
      message,
      s ? "任务已继续。" : "当前没有可以继续的任务。",
      "RUN",
      "resume",
    );
  }
  const routes: Array<[RegExp, string, string]> = [
    [/打开.*(时间线|记录)/, "TIMELINE", "已打开时间线。"],
    [/打开.*(复盘|总结)/, "REVIEW", "已打开每日复盘。"],
    [/打开.*(节律|统计)/, "RHYTHM", "已打开节律学习。"],
    [/打开.*(拆解|debug|排障)/i, "DEBUG", "已打开任务拆解。"],
    [/打开.*(设置|传感器)/, "SENSORS", "已打开能力设置。"],
    [
      /(协同操作|协作操作)/,
      "SHARE",
      "已打开屏幕共享协作页，请确认要共享的软件窗口。",
    ],
  ];
  for (const [pattern, page, answer] of routes)
    if (pattern.test(message))
      return saveCommandReply(message, answer, page, page.toLowerCase());
  return null;
}
async function handleChat(message: string) {
  if (!message) throw new Error("EMPTY_MESSAGE");
  const command = moduleCommand(message) || localChatCommand(message);
  if (command) return command;
  const s = currentSession(),
    shared = activeScreenSession(),
    tasks = getDb()
      .prepare(
        "SELECT name,status,priority FROM todo_tasks WHERE status!='completed' ORDER BY id DESC LIMIT 8",
      )
      .all(),
    screenText = getSetting("runtime.screenText", ""),
    screenApp = getSetting("runtime.screenApp", ""),
    capturedAt = getSetting("runtime.screenCapturedAt", "");
  const context = `\n\n[LifeOS真实运行上下文，仅用于本次回答]\n当前任务：${s ? `${s.task_name}（${s.status}）` : "无"}\n共享应用：${screenApp || shared?.app_id || "无"}\n屏幕文字提取时间：${capturedAt || "尚未提取"}\n共享屏幕OCR内容：${screenText || "尚未提取；不得推测屏幕内容"}\n待办模块：${JSON.stringify(tasks)}\n传感器：${JSON.stringify(getSensors())}\n必须基于真实上下文回答；没有OCR内容时明确要求用户点击提取，不得假装看到了画面。可以建议并调用任务、专注、拆解、共享、时间线、复盘、节律和设置模块。`;
  const result = await sendChat(message + context);
  getDb()
    .prepare(
      "UPDATE chat_messages SET content=? WHERE id=(SELECT id FROM chat_messages WHERE role='user' ORDER BY id DESC LIMIT 1)",
    )
    .run(message);
  return result;
}
async function safeGenerateAiPatch(input: {
  taskName: string;
  rootCause: string;
}) {
  try {
    return await generateAiPatch(input);
  } catch (error) {
    const templates: Record<
      string,
      { action: string; minutes: number; message: string }
    > = {
      TASK_ENTRY_UNCLEAR: {
        action: "打开当前任务文件，只写下第一条待办",
        minutes: 5,
        message: "先建立清晰入口，再决定下一步。",
      },
      TASK_TOO_BIG: {
        action: "把任务拆成一个今天能交付的最小结果",
        minutes: 8,
        message: "先缩小范围，不增加压力。",
      },
      DISTRACTION_PULL: {
        action: "关闭无关窗口，只保留目标应用工作 5 分钟",
        minutes: 5,
        message: "先减少环境拉力。",
      },
      FATIGUE: {
        action: "离开屏幕，喝水并休息 10 分钟",
        minutes: 10,
        message: "恢复精力也是任务的一部分。",
      },
    };
    const fallback = templates[input.rootCause] || {
      action: "只完成一个 5 分钟最小动作",
      minutes: 5,
      message: "先行动，再根据结果调整。",
    };
    return {
      ...fallback,
      model: "本地安全模板 / Local fallback",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
async function generateActualPatch(input: {
  taskName: string;
  rootCause: string;
}) {
  const screenText = getSetting("runtime.screenText", ""),
    screenApp = getSetting("runtime.screenApp", "");
  if (!screenText)
    return {
      action: `先在“屏幕共享”页提取“${screenApp || "当前应用"}”的画面文字`,
      minutes: 2,
      message: `当前真实任务是“${input.taskName}”，但尚无可验证的屏幕内容，因此没有生成推测性拆解。`,
      model: "真实上下文检查 / Grounding required",
    };
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key)
    return {
      action: "检查共享画面提取文字，并手动标记当前具体卡点",
      minutes: 3,
      message: "已取得真实屏幕文字，但 DeepSeek 未配置，未使用虚构建议。",
      model: "本地真实上下文 / Local grounded",
    };
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        thinking: { type: "disabled" },
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              '你是 LifeOS 任务拆解器。只能依据用户真实任务与OCR屏幕文字定位卡点。不得编造界面、按钮或进度。输出严格JSON：{"action":"具体下一步","minutes":1到15整数,"message":"依据屏幕内容的简短解释"}',
          },
          {
            role: "user",
            content: `真实任务：${input.taskName}\n用户选择的卡点：${input.rootCause}\n共享应用：${screenApp}\nOCR屏幕文字：\n${String(screenText).slice(0, 12000)}`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const data = (await response.json()) as any,
      raw = String(data?.choices?.[0]?.message?.content || "")
        .replace(/^```json\s*|\s*```$/g, "")
        .trim();
    if (!raw) throw new Error("EMPTY_RESPONSE");
    const parsed = JSON.parse(raw);
    return {
      action: String(parsed.action),
      minutes: Math.max(
        1,
        Math.min(15, Math.round(Number(parsed.minutes) || 5)),
      ),
      message: String(parsed.message),
      model: data.model || "deepseek-v4-flash",
    };
  } catch (error) {
    return {
      action: "根据已提取的屏幕文字，手动确认一个当前可点击或可填写的步骤",
      minutes: 3,
      message: `真实上下文已保留，但模型生成失败（${error instanceof Error ? error.message : String(error)}），未使用虚假数据。`,
      model: "真实上下文回退 / Grounded fallback",
    };
  }
}

function registerIpc() {
  ipcMain.handle("snapshot", () => snapshot());
  ipcMain.handle("chat:history", () => chatHistory());
  ipcMain.handle("chat:send", (_e, message: string) =>
    handleChat(String(message || "").trim()),
  );
  ipcMain.handle("companion:pickImage", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择桌面宠物图片",
      properties: ["openFile"],
      filters: [
        { name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = result.filePaths[0],
      ext = path.extname(file).slice(1).replace("jpg", "jpeg");
    const data = `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
    setSetting("settings.companionImage", data);
    setSetting("settings.companionAvatar", "image");
    sendEvent({ type: "settings-updated" });
    return data;
  });
  ipcMain.handle("chat:clear", () => {
    getDb().exec(
      "DELETE FROM chat_messages;DELETE FROM conversation_summaries;",
    );
  });
  ipcMain.handle("knowledge:list", () =>
    getDb()
      .prepare(
        "SELECT d.id,d.name,d.source_path sourcePath,d.created_at createdAt,COUNT(c.id) chunks FROM knowledge_documents d LEFT JOIN knowledge_chunks c ON c.document_id=d.id GROUP BY d.id ORDER BY d.id DESC",
      )
      .all(),
  );
  ipcMain.handle("knowledge:search", (_e, query: string) =>
    searchKnowledge(String(query || "")),
  );
  ipcMain.handle("knowledge:indexDefaults", () => {
    const names = [
      "LifeOS_执行文档_v2.0_完整落地版.md",
      "LifeOS_PRD_v4.0_完整产品版 (1).md",
    ];
    return names.map((name) => {
      const file = [
        path.join(process.cwd(), name),
        path.join(app.getAppPath(), name),
      ].find(fs.existsSync);
      if (!file) return { name, error: "FILE_NOT_FOUND" };
      return {
        name,
        ...indexKnowledge(name, file, fs.readFileSync(file, "utf8")),
      };
    });
  });
  ipcMain.handle("knowledge:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入本地知识库",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Markdown / Text", extensions: ["md", "txt"] }],
    });
    if (result.canceled) return [];
    return result.filePaths.map((file) => ({
      name: path.basename(file),
      ...indexKnowledge(
        path.basename(file),
        file,
        fs.readFileSync(file, "utf8"),
      ),
    }));
  });
  ipcMain.handle("ai:status", () => ({
    configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
  }));
  ipcMain.handle(
    "ai:patch",
    (_e, input: { taskName: string; rootCause: string }) =>
      generateActualPatch(input),
  );
  ipcMain.handle(
    "camera:signal",
    (
      _e,
      value: {
        presence: boolean;
        facingScreen: boolean | null;
        awaySeconds: number;
        confidence: number;
      },
    ) => {
      const s = currentSession(),
        sensors = getSensors();
      if (!s || !sensors.cameraPresence || sensors.ghostMode) return;
      getDb()
        .prepare(
          "INSERT INTO presence_signals(session_id,timestamp,presence,facing_screen,away_seconds,confidence) VALUES(?,?,?,?,?,?)",
        )
        .run(
          s.id,
          new Date().toISOString(),
          value.presence ? 1 : 0,
          value.facingScreen == null ? null : value.facingScreen ? 1 : 0,
          Math.max(0, value.awaySeconds || 0),
          Math.max(0, Math.min(1, value.confidence || 0)),
        );
      sendEvent({ type: "sensor-updated" });
    },
  );
  ipcMain.handle("screen:sources", async () => {
    const sensors = getSensors();
    if (!sensors.screenContext) throw new Error("请先开启“屏幕共享”能力");
    if (sensors.ghostMode)
      throw new Error("隐私模式下不能共享屏幕，请先退出隐私模式");
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources
      .filter(
        (x) =>
          x.id &&
          x.name &&
          !x.name.includes("开工了") &&
          !x.name.includes("LifeOS"),
      )
      .map((x) => ({
        id: x.id,
        name: x.name,
        kind: x.id.startsWith("screen:") ? "screen" : "window",
        thumbnail: x.thumbnail.toDataURL(),
      }));
  });
  ipcMain.handle(
    "screen:context",
    (_e, { name, text }: { name: string; text: string }) => {
      const clean = String(text || "")
        .trim()
        .slice(0, 30000);
      if (!clean) return;
      const capturedAt = new Date().toISOString();
      setSetting("runtime.screenText", clean);
      setSetting("runtime.screenApp", String(name || "共享应用"));
      setSetting("runtime.screenCapturedAt", capturedAt);
      indexKnowledge(
        `屏幕上下文：${name || "共享应用"} ${capturedAt.slice(0, 19)}`,
        null,
        clean,
      );
      sendEvent({
        type: "screen-sharing",
        message: `已提取共享画面文字：${clean.length} 字`,
        payload: { ocr: true, name, length: clean.length },
      });
    },
  );
  ipcMain.handle(
    "screen:analyze",
    async (_e, { name, image }: { name: string; image: string }) => {
      if (!String(image || "").startsWith("data:image/"))
        throw new Error("没有取得有效的共享画面");
      try {
        const worker = await getOcrWorker();
        const result = await worker.recognize(image);
        const clean = String(result.data.text || "")
          .trim()
          .slice(0, 30000);
        if (!clean)
          throw new Error("当前应用画面没有识别到文字，请把文字页面放大后重试");
        const capturedAt = new Date().toISOString();
        setSetting("runtime.screenText", clean);
        setSetting("runtime.screenApp", String(name || "共享应用"));
        setSetting("runtime.screenCapturedAt", capturedAt);
        indexKnowledge(
          `屏幕上下文：${name || "共享应用"} ${capturedAt.slice(0, 19)}`,
          null,
          clean,
        );
        sendEvent({
          type: "screen-sharing",
          message: `已识别共享应用文字：${clean.length} 字`,
          payload: { ocr: true, name, length: clean.length },
        });
        return { text: clean, capturedAt };
      } catch (error) {
        ocrWorkerPromise = null;
        throw error;
      }
    },
  );
  ipcMain.handle(
    "screen:start",
    (_e, { sourceId, name }: { sourceId: string; name: string }) => {
      const s = currentSession(),
        sensors = getSensors();
      if (!sensors.screenContext) throw new Error("请先开启“屏幕共享”能力");
      if (sensors.ghostMode)
        throw new Error("隐私模式下不能共享屏幕，请先退出隐私模式");
      if (!sourceId) throw new Error("没有选择有效的软件窗口");
      const old = activeScreenSession();
      if (old)
        getDb()
          .prepare("UPDATE screen_context_sessions SET end_at=? WHERE id=?")
          .run(new Date().toISOString(), old.id);
      const row = getDb()
        .prepare(
          "INSERT INTO screen_context_sessions(session_id,mode,app_id,start_at,ai_shared) VALUES(?,?,?,?,0)",
        )
        .run(s?.id ?? null, "one_app", name, new Date().toISOString());
      sendEvent({
        type: "screen-sharing",
        message: `正在共享：${name}`,
        payload: { active: true, sourceId, name },
      });
      return Number(row.lastInsertRowid);
    },
  );
  ipcMain.handle("screen:stop", () => {
    const active = activeScreenSession();
    if (active)
      getDb()
        .prepare("UPDATE screen_context_sessions SET end_at=? WHERE id=?")
        .run(new Date().toISOString(), active.id);
    sendEvent({
      type: "screen-sharing",
      message: "屏幕共享已停止",
      payload: { active: false },
    });
  });
  ipcMain.handle("intervention:respond", (_e, response: string) => {
    const s = currentSession();
    if (!s) return;
    const state = interventionState.get(s.id) || {
      level: 0,
      firstAt: Date.now(),
      suppressedUntil: 0,
      ignored: 0,
      lastVoiceAt: 0,
    };
    if (response === "working") {
      state.suppressedUntil = Date.now() + 10 * 60000;
      state.ignored++;
    }
    if (response === "dismissed") state.ignored++;
    interventionState.set(s.id, state);
    getDb()
      .prepare(
        "UPDATE intervention_events SET user_response=?,dismissed=? WHERE id=(SELECT id FROM intervention_events WHERE session_id=? ORDER BY id DESC LIMIT 1)",
      )
      .run(response, response === "dismissed" ? 1 : 0, s.id);
  });
  ipcMain.handle("window:navigate", (_e, page: string) => {
    if (!mainWindow) createMain();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
    sendEvent({ type: "navigate", payload: { page } });
  });
  ipcMain.handle("task:create", (_e, d: any) => {
    getDb()
      .prepare(
        "INSERT INTO todo_tasks(name,deadline,estimated_minutes,task_type,priority,target_app,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        d.name,
        d.deadline || null,
        d.estimatedMinutes,
        d.taskType,
        d.priority,
        d.targetApp || null,
        "todo",
        new Date().toISOString(),
      );
  });
  ipcMain.handle("task:update", (_e, t: any) => {
    getDb()
      .prepare(
        "UPDATE todo_tasks SET name=?,deadline=?,estimated_minutes=?,task_type=?,priority=?,target_app=?,status=? WHERE id=?",
      )
      .run(
        t.name,
        t.deadline,
        t.estimatedMinutes,
        t.taskType,
        t.priority,
        t.targetApp,
        t.status,
        t.id,
      );
  });
  ipcMain.handle("task:delete", (_e, id: number) =>
    getDb().prepare("DELETE FROM todo_tasks WHERE id=?").run(id),
  );
  ipcMain.handle("recommendation:reject", (_e, id: number) => {
    const snap = snapshot();
    const rec = snap.recommendations.find((x: any) => x.task.id === id);
    if (rec)
      getDb()
        .prepare(
          "INSERT INTO recommendations(task_id,recommended_at,score,reasons_json,accepted) VALUES(?,?,?,?,0)",
        )
        .run(
          id,
          new Date().toISOString(),
          rec.score,
          JSON.stringify(rec.reasons),
        );
    sendEvent({
      type: "companion-message",
      message: "已记录这次不合适，下一次推荐会参考。",
    });
  });
  ipcMain.handle(
    "outcome:update",
    (_e, { sessionId, reason }: { sessionId: number; reason: string }) => {
      getDb()
        .prepare(
          "INSERT INTO session_outcomes(session_id,reason_code,user_confirmed) VALUES(?,?,1) ON CONFLICT(session_id) DO UPDATE SET reason_code=excluded.reason_code,user_confirmed=1",
        )
        .run(sessionId, reason);
      sendEvent({ type: "session-updated" });
    },
  );
  ipcMain.handle("session:start", (_e, id: number) => {
    const d = getDb();
    const active = currentSession();
    if (active) {
      d.prepare(
        "UPDATE task_sessions SET status='ended',end_at=?,result='unfinished' WHERE id=?",
      ).run(new Date().toISOString(), active.id);
    }
    d.prepare(
      "UPDATE todo_tasks SET status='todo' WHERE status IN ('running','paused')",
    ).run();
    d.prepare("UPDATE todo_tasks SET status='running' WHERE id=?").run(id);
    const started = d
      .prepare(
        "INSERT INTO task_sessions(task_id,start_at,status) VALUES(?,?,?)",
      )
      .run(id, new Date().toISOString(), "running");
    const snap = snapshot();
    const rec = snap.recommendations.find((x: any) => x.task.id === id);
    if (rec)
      d.prepare(
        "INSERT INTO recommendations(task_id,recommended_at,score,reasons_json,accepted) VALUES(?,?,?,?,1)",
      ).run(
        id,
        new Date().toISOString(),
        rec.score,
        JSON.stringify(rec.reasons),
      );
    interventionState.set(Number(started.lastInsertRowid), {
      level: 0,
      firstAt: Date.now(),
      suppressedUntil: 0,
      ignored: 0,
      lastVoiceAt: 0,
    });
    lastApp = null;
    sendEvent({
      type: "session-updated",
      payload: { companionState: "FOCUS" },
    });
  });
  ipcMain.handle("session:pause", () => {
    const s = currentSession();
    if (s)
      getDb()
        .prepare("UPDATE task_sessions SET status='paused' WHERE id=?")
        .run(s.id);
  });
  ipcMain.handle("session:resume", () => {
    const s = currentSession();
    if (s)
      getDb()
        .prepare("UPDATE task_sessions SET status='running' WHERE id=?")
        .run(s.id);
  });
  ipcMain.handle(
    "session:end",
    (_e, { result, reason }: { result: string; reason?: string }) => {
      const s = currentSession();
      if (!s) return;
      const end = new Date().toISOString();
      const m = behaviorSummary(s);
      const minutes = Math.max(
        1,
        Math.round((Date.now() - new Date(s.start_at).getTime()) / 60000),
      );
      getDb()
        .prepare(
          "UPDATE task_sessions SET status='ended',end_at=?,result=?,effective_minutes=?,target_app_ratio=? WHERE id=?",
        )
        .run(
          end,
          result,
          Math.round(minutes * (m.targetRatio || 0.7)),
          m.targetRatio || 0.7,
          s.id,
        );
      getDb()
        .prepare(
          "INSERT INTO session_outcomes(session_id,reason_code,user_confirmed) VALUES(?,?,1) ON CONFLICT(session_id) DO UPDATE SET reason_code=excluded.reason_code",
        )
        .run(s.id, reason || "UNKNOWN");
      getDb()
        .prepare("UPDATE todo_tasks SET status=? WHERE id=?")
        .run(result === "completed" ? "completed" : "todo", s.task_id);
      getDb()
        .prepare(
          "UPDATE recommendations SET final_result=? WHERE task_id=? AND accepted=1 AND final_result IS NULL",
        )
        .run(result, s.task_id);
      const shared = activeScreenSession();
      if (shared)
        getDb()
          .prepare("UPDATE screen_context_sessions SET end_at=? WHERE id=?")
          .run(end, shared.id);
      interventionState.delete(s.id);
      sendEvent({
        type: "session-updated",
        message:
          result === "completed"
            ? "完成了，辛苦了。"
            : "这次结果已经记录，下次推荐会考虑原因。",
        payload: {
          companionState: result === "completed" ? "COMPLETE" : "IDLE",
        },
      });
    },
  );
  ipcMain.handle("demo:drift", () => {
    const s = currentSession();
    if (!s) return;
    const apps = [
      "winword",
      "wechat",
      "winword",
      "chrome",
      "winword",
      "wechat",
      "chrome",
      "winword",
      "wechat",
      "chrome",
      "wechat",
    ];
    const ins = getDb().prepare(
      "INSERT INTO behavior_events(session_id,timestamp,app_name,event_type,idle_seconds) VALUES(?,?,?,?,?)",
    );
    apps.forEach((a, i) =>
      ins.run(
        s.id,
        new Date(Date.now() + i * 1000).toISOString(),
        a,
        "switch",
        i === 9 ? 180 : 0,
      ),
    );
    bugCooldownAt = 0;
    const snap = JSON.stringify({
      windowSwitches: 11,
      targetAppRatio: 0.27,
      idleSeconds: 180,
      demo: true,
    });
    getDb()
      .prepare(
        "INSERT INTO bug_sessions(session_id,bug_type,snapshot,status,created_at) VALUES(?,?,?,?,?)",
      )
      .run(s.id, "START_FAILURE", snap, "open", new Date().toISOString());
    recordIntervention(
      s,
      1,
      "visual",
      "START_FAILURE",
      "我注意到任务有一点游离。",
    );
    setTimeout(
      () =>
        recordIntervention(
          s,
          2,
          "text",
          "START_FAILURE",
          `「${s.task_name}」出现频繁切换，要不要一起 Debug？`,
        ),
      1200,
    );
    sendEvent({
      type: "bug-detected",
      title: "Focus Drift",
      message: `「${s.task_name}」出现频繁切换。要不要先把任务拆小一点？`,
      payload: JSON.parse(snap),
    });
  });
  ipcMain.handle("patch:install", (_e, p: any) => {
    const s = currentSession();
    if (!s) return;
    let bug = getDb()
      .prepare(
        "SELECT * FROM bug_sessions WHERE session_id=? AND status='open' ORDER BY id DESC LIMIT 1",
      )
      .get(s.id) as any;
    if (!bug) {
      const r = getDb()
        .prepare(
          "INSERT INTO bug_sessions(session_id,bug_type,root_cause,status,created_at) VALUES(?,?,?,?,?)",
        )
        .run(
          s.id,
          "START_FAILURE",
          p.rootCause,
          "open",
          new Date().toISOString(),
        );
      bug = { id: Number(r.lastInsertRowid) };
    } else
      getDb()
        .prepare("UPDATE bug_sessions SET root_cause=? WHERE id=?")
        .run(p.rootCause, bug.id);
    getDb()
      .prepare(
        "INSERT INTO patch_attempts(bug_id,sequence,template_id,action,estimated_minutes,installed_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        bug.id,
        1,
        `tmpl_${String(p.rootCause).toLowerCase()}_001`,
        p.action,
        p.minutes,
        new Date().toISOString(),
      );
    sendEvent({
      type: "companion-message",
      message: "Patch 已安装。先只做这一小步。",
    });
  });
  ipcMain.handle("patch:verify", (_e, success: boolean) => {
    const s = currentSession();
    if (!s) return;
    const patch = getDb()
      .prepare(
        `SELECT p.*,b.id bug_id FROM patch_attempts p JOIN bug_sessions b ON b.id=p.bug_id WHERE b.session_id=? ORDER BY p.id DESC LIMIT 1`,
      )
      .get(s.id) as any;
    if (patch) {
      getDb()
        .prepare("UPDATE patch_attempts SET result=?,resolved_at=? WHERE id=?")
        .run(
          success ? "success" : "failed",
          new Date().toISOString(),
          patch.id,
        );
      getDb()
        .prepare("UPDATE bug_sessions SET status=? WHERE id=?")
        .run(success ? "resolved" : "open", patch.bug_id);
    }
    sendEvent({
      type: "companion-message",
      message: success
        ? "你已经重新进入行动。"
        : "没关系，我们可以把下一步再缩小一点。",
    });
  });
  ipcMain.handle("sensors:set", (_e, values: Record<string, boolean>) => {
    for (const [k, v] of Object.entries(values)) {
      if (sensorKeys.includes(k as any)) {
        setSetting(`sensor.${k}`, v);
        upsertSensor(k, v);
        if ((k === "screenContext" && !v) || (k === "ghostMode" && v)) {
          const active = activeScreenSession();
          if (active)
            getDb()
              .prepare("UPDATE screen_context_sessions SET end_at=? WHERE id=?")
              .run(new Date().toISOString(), active.id);
        }
      }
    }
    sendEvent({ type: "sensor-updated" });
  });
  ipcMain.handle("settings:set", (_e, values: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(values))
      if (settingKeys.includes(k as any)) setSetting(`settings.${k}`, v);
    const settings = getSettings();
    getDb()
      .prepare(
        "UPDATE companion_profile SET character_id=?,name=?,proactive_level=? WHERE id=1",
      )
      .run(
        settings.companionCharacter,
        settings.companionName,
        settings.proactiveLevel,
      );
    sendEvent({ type: "settings-updated" });
  });
  ipcMain.handle("demo:seed", () => seedDemo());
  ipcMain.handle("data:export", async () => {
    const tables = [
      "todo_tasks",
      "task_sessions",
      "behavior_events",
      "bug_sessions",
      "patch_attempts",
      "recommendations",
      "session_outcomes",
      "sensor_permissions",
      "presence_signals",
      "screen_context_sessions",
      "intervention_events",
      "daily_reviews",
      "rhythm_stats",
      "companion_profile",
      "ai_audit_events",
      "app_settings",
    ];
    const out: Object = Object.fromEntries(
      tables.map((t) => [t, getDb().prepare(`SELECT * FROM ${t}`).all()]),
    );
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "导出 LifeOS 本地数据",
      defaultPath: `kaigongle-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2), "utf8");
    return filePath;
  });
  ipcMain.handle("data:delete", () => {
    const d = getDb();
    d.exec(
      "DELETE FROM behavior_events;DELETE FROM bug_sessions;DELETE FROM patch_attempts;DELETE FROM recommendations;DELETE FROM session_outcomes;DELETE FROM task_sessions;DELETE FROM todo_tasks;DELETE FROM presence_signals;DELETE FROM screen_context_sessions;DELETE FROM intervention_events;DELETE FROM daily_reviews;DELETE FROM rhythm_stats;DELETE FROM ai_audit_events;DELETE FROM companion_profile;DELETE FROM sensor_permissions;DELETE FROM app_settings;",
    );
    interventionState.clear();
    sendEvent({
      type: "session-updated",
      message: "全部本地数据与设置已删除。",
    });
  });
  ipcMain.handle("voice:speak", (_e, text: string) => speakLocal(text));
  ipcMain.handle("window:showMain", () => {
    if (!mainWindow) createMain();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  ipcMain.handle("window:toggleCompanion", () => toggleCompanion());
}
function seedDemo() {
  const d = getDb();
  d.exec(
    "DELETE FROM behavior_events;DELETE FROM bug_sessions;DELETE FROM patch_attempts;DELETE FROM recommendations;DELETE FROM session_outcomes;DELETE FROM task_sessions;DELETE FROM todo_tasks;",
  );
  const ins = d.prepare(
    "INSERT INTO todo_tasks(name,deadline,estimated_minutes,task_type,priority,target_app,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
  );
  const now = Date.now();
  const tasks = [
    ["修改论文", 2, 90, "Deep Work", "High", "Microsoft Word"],
    ["准备组会汇报", 1, 60, "Creative", "High", "PowerPoint"],
    ["回复导师消息", 0.2, 5, "Communication", "Medium", "WeChat"],
    ["整理实验数据", 5, 30, "Admin", "Medium", "Excel"],
    ["报销材料", 7, 15, "Admin", "Low", null],
  ];
  const ids = tasks.map((t: any[]) =>
    Number(
      ins.run(
        t[0],
        new Date(now + t[1] * 86400000).toISOString(),
        t[2],
        t[3],
        t[4],
        t[5],
        "todo",
        new Date().toISOString(),
      ).lastInsertRowid,
    ),
  );
  // Prior history to make Rhythm meaningful
  for (let day = 1; day <= 6; day++) {
    const start = new Date(now - day * 86400000);
    start.setHours(9 + (day % 2), 10, 0, 0);
    const end = new Date(start.getTime() + 55 * 60000);
    const res = d
      .prepare(
        "INSERT INTO task_sessions(task_id,start_at,end_at,result,effective_minutes,target_app_ratio,status) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        ids[0],
        start.toISOString(),
        end.toISOString(),
        day === 5 ? "unfinished" : "completed",
        45,
        0.82,
        "ended",
      );
    d.prepare(
      "INSERT INTO session_outcomes(session_id,reason_code,user_confirmed) VALUES(?,?,1)",
    ).run(Number(res.lastInsertRowid), day === 5 ? "FATIGUE" : "COMPLETED");
  }
  for (let day = 1; day <= 4; day++) {
    const start = new Date(now - day * 86400000);
    start.setHours(14, 10, 0, 0);
    const end = new Date(start.getTime() + 25 * 60000);
    const res = d
      .prepare(
        "INSERT INTO task_sessions(task_id,start_at,end_at,result,effective_minutes,target_app_ratio,status) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        ids[3],
        start.toISOString(),
        end.toISOString(),
        "completed",
        22,
        0.77,
        "ended",
      );
    d.prepare(
      "INSERT INTO session_outcomes(session_id,reason_code,user_confirmed) VALUES(?,?,1)",
    ).run(Number(res.lastInsertRowid), "COMPLETED");
  }
  sendEvent({ type: "session-updated", message: "演示数据已生成。" });
}

function applyRetention() {
  const days = Number(getSetting("settings.retentionDays", 30));
  if (!days) return;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const d = getDb();
  d.prepare("DELETE FROM behavior_events WHERE timestamp<?").run(cutoff);
  d.prepare("DELETE FROM presence_signals WHERE timestamp<?").run(cutoff);
  d.prepare("DELETE FROM intervention_events WHERE created_at<?").run(cutoff);
  d.prepare("DELETE FROM ai_audit_events WHERE created_at<?").run(cutoff);
}

app.whenReady().then(() => {
  getDb();
  getDb()
    .prepare("UPDATE screen_context_sessions SET end_at=? WHERE end_at IS NULL")
    .run(new Date().toISOString());
  applyRetention();
  electronSession.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      if (permission !== "media") {
        callback(false);
        return;
      }
      const sensors = getSensors();
      callback(
        !sensors.ghostMode && (sensors.cameraPresence || sensors.screenContext),
      );
    },
  );
  registerIpc();
  createMain();
  createCompanion();
  createTray();
  collector.start();
});
app.on("window-all-closed", () => {
  mainWindow = null;
});
app.on("before-quit", () => {
  collector.stop();
  void ocrWorkerPromise?.then((worker) => worker.terminate());
});
app.on("activate", () => {
  if (!mainWindow) createMain();
});
app.on("second-instance", () => {
  if (!mainWindow) createMain();
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
