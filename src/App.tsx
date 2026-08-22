import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSnapshot,
  LifeEvent,
  Sensors,
  TaskDraft,
  TodoTask,
} from "./types";
import type { ChatMessage, KnowledgeDocument, KnowledgeResult } from "./global";
import sleepyRobot from "./assets/sleepy-robot-companion.png";

const empty: AppSnapshot = {
  tasks: [],
  activeSession: null,
  recommendations: [],
  timeline: [],
  review: {
    date: "",
    planned: 0,
    started: 0,
    completed: 0,
    unfinished: 0,
    cancelled: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
    effectiveMinutes: 0,
    reasons: [],
    insights: [],
    nextSuggestions: [],
  },
  rhythm: [],
  sensors: {
    applicationActivity: true,
    cameraPresence: false,
    screenContext: false,
    voiceReminder: true,
    aiContextSharing: false,
    ghostMode: false,
  },
  settings: {
    availableMinutes: 60,
    proactiveLevel: "Balanced",
    voiceMode: "Smart",
    dndStart: "22:00",
    dndEnd: "08:00",
    companionCharacter: "Milo",
    companionName: "Milo",
    companionAvatar: "robot",
    companionScale: 100,
    companionColor: "#9dc5ff",
    companionImage: "",
    meetingMode: false,
    retentionDays: 30,
  },
  runtime: { screenSharing: null, cameraSignal: null },
};
const noop = async () => {};
const local: any = {
  snapshot: async () => empty,
  createTask: noop,
  updateTask: noop,
  deleteTask: noop,
  rejectRecommendation: noop,
  updateOutcome: noop,
  startTask: noop,
  pauseSession: noop,
  resumeSession: noop,
  endSession: noop,
  simulateDrift: noop,
  installPatch: noop,
  verifyPatch: noop,
  setSensors: noop,
  setSettings: noop,
  aiStatus: async () => ({
    configured: false,
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
  }),
  generatePatch: async () => ({
    action: "先做 5 分钟最小动作",
    minutes: 5,
    model: "local",
  }),
  chatHistory: async () => [],
  sendChat: async () => ({ answer: "请在桌面应用中使用对话。", sources: [] }),
  clearChat: noop,
  knowledgeList: async () => [],
  searchKnowledge: async () => [],
  indexDefaultKnowledge: async () => [],
  importKnowledge: async () => [],
  cameraSignal: noop,
  screenSources: async () => [],
  startScreenShare: async () => 0,
  stopScreenShare: noop,
  analyzeScreen: async () => ({ text: "", capturedAt: "" }),
  respondIntervention: noop,
  navigate: noop,
  seedDemo: noop,
  exportData: async () => null,
  deleteAllData: noop,
  speak: noop,
  showMain: noop,
  toggleCompanion: noop,
  onEvent: () => () => {},
};
const api = () => {
  const client = window.lifeos || local;
  return {
    ...client,
    sendChat: async (message: string) => {
      if (sharedStream) await refreshSharedScreenContext(true);
      return client.sendChat(message);
    },
  };
};
const pages = [
  "NOW",
  "TODO",
  "RUN",
  "CHAT",
  "DEBUG",
  "SHARE",
  "TIMELINE",
  "REVIEW",
  "RHYTHM",
  "SENSORS",
] as const;
type Page = (typeof pages)[number];
const pageMeta: Record<Page, { icon: string; zh: string }> = {
  NOW: { icon: "⌂", zh: "今日" },
  TODO: { icon: "☷", zh: "任务" },
  RUN: { icon: "▶", zh: "专注" },
  CHAT: { icon: "✦", zh: "对话" },
  DEBUG: { icon: "◆", zh: "拆解" },
  SHARE: { icon: "▣", zh: "屏幕共享" },
  TIMELINE: { icon: "≡", zh: "时间线" },
  REVIEW: { icon: "◷", zh: "复盘" },
  RHYTHM: { icon: "▥", zh: "节律" },
  SENSORS: { icon: "⚙", zh: "设置" },
};
const taskTypeZh: Record<string, string> = {
  "Deep Work": "深度工作",
  Creative: "创意",
  Communication: "沟通",
  Admin: "事务",
  Learning: "学习",
  Routine: "日常",
};
let sharedStream: MediaStream | null = null;
let sharedAppName = "";
let sharedScreenText = "";
let sharedScreenCapturedAt = 0;
const shareListeners = new Set<() => void>();
function publishShare(stream: MediaStream | null, name = "") {
  sharedStream = stream;
  sharedAppName = name;
  shareListeners.forEach((fn) => fn());
}
async function refreshSharedScreenContext(force = false) {
  if (!sharedStream) return "";
  if (!force && sharedScreenText && Date.now() - sharedScreenCapturedAt < 15000)
    return sharedScreenText;
  const track = sharedStream.getVideoTracks()[0];
  if (!track || track.readyState !== "live")
    throw new Error("共享画面已经停止，请重新选择软件窗口。");
  const video = document.createElement("video");
  video.srcObject = sharedStream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (video.readyState < 2)
    await new Promise<void>((resolve) =>
      video.addEventListener("loadeddata", () => resolve(), { once: true }),
    );
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, 1600 / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const result = await (window.lifeos || local).analyzeScreen({
    name: sharedAppName || "共享应用",
    image: canvas.toDataURL("image/png"),
  });
  sharedScreenText = result.text;
  sharedScreenCapturedAt = Date.now();
  return result.text;
}
function useSharedScreen() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fn = () => setVersion((x) => x + 1);
    shareListeners.add(fn);
    return () => {
      shareListeners.delete(fn);
    };
  }, []);
  return { stream: sharedStream, name: sharedAppName, version };
}
function SharedScreenView({ compact = false }: { compact?: boolean }) {
  const { stream, name, version } = useSharedScreen();
  const video = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState(sharedScreenText);
  const [ocr, setOcr] = useState(false);
  const [progress, setProgress] = useState("");
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream, version]);
  const extract = async () => {
    setOcr(true);
    setProgress("正在截取共享画面…");
    try {
      const value = await refreshSharedScreenContext(true);
      setText(value);
      setProgress("提取完成，已写入屏幕上下文知识库。");
    } catch (e) {
      setProgress(`提取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcr(false);
    }
  };
  return stream ? (
    <div className={compact ? "shared-context compact" : "shared-context"}>
      <div>
        <b>正在共享 / SHARING</b>
        <span>{name || "应用窗口"}</span>
      </div>
      <video ref={video} muted autoPlay playsInline />
      <div className="screen-extract">
        <button disabled={ocr} onClick={() => void extract()}>
          {ocr ? "识别中…" : "提取当前画面文字 / OCR"}
        </button>
        <span>{progress}</span>
        {text && <textarea readOnly value={text} />}
      </div>
    </div>
  ) : (
    <div className="shared-empty">
      当前没有共享的软件画面 / No shared application
    </div>
  );
}
const Btn = ({
  children,
  onClick,
  disabled = false,
  kind = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: string;
  type?: "button" | "submit";
}) => (
  <button type={type} className={kind} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);
const Card = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) => (
  <section className="card">
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

function SessionClock({
  startAt,
  paused,
}: {
  startAt: string;
  paused: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused]);
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(startAt).getTime()) / 1000),
  );
  return (
    <div className="session-clock">
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </div>
  );
}

function MiniCompanion({ text }: { text: string }) {
  return (
    <div className="mini-companion">
      <img src={sleepyRobot} />
      <div>
        <b>Companion 在线</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

function DebugView({ d }: { d: AppSnapshot }) {
  const [patch, setPatch] = useState<{
    rootCause: string;
    action: string;
    minutes: number;
    message?: string;
    model: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const generate = async (cause: string) => {
    setBusy(true);
    setStatus("");
    try {
      const p = await api().generatePatch({
        taskName: d.activeSession?.taskName || "当前任务",
        rootCause: cause,
      });
      setPatch({ rootCause: cause, ...p });
    } catch (e) {
      setStatus(
        `AI 请求失败：${e instanceof Error ? e.message : String(e)}。请重新启动应用以加载 .env.local。`,
      );
    } finally {
      setBusy(false);
    }
  };
  if (patch)
    return (
      <>
        <header>
          <div>
            <small>PATCH → VERIFY</small>
            <h1>这是建议执行的下一步</h1>
          </div>
        </header>
        <Card title="可执行 Patch">
          <h2>{patch.action}</h2>
          <p>
            {patch.minutes} 分钟 · {patch.model}
          </p>
          <p>{patch.message}</p>
          <Btn
            onClick={() =>
              void api()
                .installPatch(patch)
                .then(() => setStatus("Patch 已安装。完成这一步后点击验证。"))
            }
          >
            确认
          </Btn>
          <Btn kind="secondary" onClick={() => setPatch(null)}>
            重新选择原因
          </Btn>
          <div className="verify-box">
            <b>执行结果</b>
            <Btn
              kind="secondary"
              onClick={() =>
                void api()
                  .verifyPatch(true)
                  .then(() => setStatus("已记录：Patch 有效。"))
              }
            >
              已开始 / 有效
            </Btn>
            <Btn
              kind="secondary"
              onClick={() =>
                void api()
                  .verifyPatch(false)
                  .then(() => setStatus("已记录：还需要更小的下一步。"))
              }
            >
              仍然卡住
            </Btn>
          </div>
          {status && <p className="status-line">{status}</p>}
        </Card>
      </>
    );
  return (
    <>
      <header>
        <div>
          <small>DEBUG → PATCH → VERIFY</small>
          <h1>把卡点缩成下一步</h1>
          <p>选择后会在页面中展示方案，再由你确认执行。</p>
        </div>
      </header>
      <Card>
        {[
          ["不知道从哪里开始", "TASK_ENTRY_UNCLEAR"],
          ["任务太大", "TASK_TOO_BIG"],
          ["被其他应用拉走", "DISTRACTION_PULL"],
          ["需要休息", "FATIGUE"],
        ].map(([label, cause]) => (
          <button
            disabled={busy}
            className="choice"
            key={cause}
            onClick={() => void generate(cause)}
          >
            {busy ? "正在生成…" : label}
          </button>
        ))}
        {status && <p className="error">{status}</p>}
      </Card>
    </>
  );
}

function Companion() {
  const [d, setD] = useState(empty);
  const [msg, setMsg] = useState("今晚也只做下一小步。");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api().snapshot().then(setD);
    return api().onEvent((e: LifeEvent) => {
      if (e.message) setMsg(e.message);
      void api().snapshot().then(setD);
    });
  }, []);
  const send = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api().sendChat(input.trim());
      setMsg(r.answer);
      setInput("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "暂时无法回答");
    } finally {
      setBusy(false);
    }
  };
  const avatar =
    d.settings.companionAvatar === "image" && d.settings.companionImage
      ? d.settings.companionImage
      : sleepyRobot;
  return (
    <div
      className={`companion pet-dialog ${d.activeSession ? "working" : "idle"}`}
      style={
        {
          "--pet-color": d.settings.companionColor,
          "--pet-scale": d.settings.companionScale / 100,
        } as React.CSSProperties
      }
    >
      <div className="bubble pet-bubble">
        <b>✦ {d.settings.companionName}</b>
        <p>
          {d.activeSession
            ? `${d.activeSession.taskName} · ${d.activeSession.status}`
            : msg}
        </p>
        <small>
          摄像头 {d.sensors.cameraPresence ? "ON" : "OFF"} · 屏幕{" "}
          {d.runtime.screenSharing ? "共享中" : "OFF"}
        </small>
      </div>
      <img className="pet-photo" src={avatar} />
      <div className="pet-chat">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="和我说话或输入命令…"
        />
        <button disabled={busy} onClick={() => void send()}>
          {busy ? "…" : "发送"}
        </button>
      </div>
      <div className="companion-menu">
        <Btn kind="mini" onClick={() => api().navigate("NOW")}>
          今日 / NOW
        </Btn>
        <Btn kind="mini" onClick={() => api().navigate("CHAT")}>
          对话 / CHAT
        </Btn>
        <Btn kind="mini" onClick={() => api().navigate("SHARE")}>
          共享 / SHARE
        </Btn>
        <Btn kind="mini" onClick={() => api().navigate("SENSORS")}>
          设置 / SETTINGS
        </Btn>
      </div>
    </div>
  );
}

function TaskModal({
  task,
  onClose,
  onSave,
}: {
  task: TodoTask | null | "new";
  onClose: () => void;
  onSave: (v: TaskDraft | TodoTask) => Promise<void>;
}) {
  const old = task === "new" ? null : task;
  const [name, setName] = useState(old?.name || "");
  const [minutes, setMinutes] = useState(old?.estimatedMinutes || 30);
  const [type, setType] = useState<TaskDraft["taskType"]>(
    old?.taskType || "Deep Work",
  );
  const [priority, setPriority] = useState<TaskDraft["priority"]>(
    old?.priority || "Medium",
  );
  const [deadline, setDeadline] = useState(old?.deadline?.slice(0, 16) || "");
  const [targetApp, setTargetApp] = useState(old?.targetApp || "");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const draft: TaskDraft = {
      name: name.trim(),
      estimatedMinutes: Math.max(1, minutes),
      taskType: type,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      targetApp: targetApp.trim() || null,
    };
    await onSave(old ? { ...old, ...draft } : draft);
  };
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <h2>{old ? "编辑任务 / Edit Task" : "新建任务 / New Task"}</h2>
        <label>
          任务名称 / Task Name
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：完成产品方案"
          />
        </label>
        <div className="form-grid">
          <label>
            预计分钟 / Minutes
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <label>
            截止时间 / Deadline
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label>
            任务类型 / Task Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskDraft["taskType"])}
            >
              {(
                [
                  ["Deep Work", "深度工作 / Deep Work"],
                  ["Creative", "创意 / Creative"],
                  ["Communication", "沟通 / Communication"],
                  ["Admin", "事务 / Admin"],
                  ["Learning", "学习 / Learning"],
                  ["Routine", "日常 / Routine"],
                ] as const
              ).map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            优先级 / Priority
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as TaskDraft["priority"])
              }
            >
              {(
                [
                  ["High", "高 / High"],
                  ["Medium", "中 / Medium"],
                  ["Low", "低 / Low"],
                ] as const
              ).map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          目标应用 / Target App（可选）
          <input
            value={targetApp}
            onChange={(e) => setTargetApp(e.target.value)}
            placeholder="Word / VS Code"
          />
        </label>
        <div className="modal-actions">
          <Btn kind="secondary" onClick={onClose}>
            取消 / Cancel
          </Btn>
          <Btn type="submit">保存任务 / Save</Btn>
        </div>
      </form>
    </div>
  );
}

const reasonOptions = [
  ["COMPLETED", "已完成"],
  ["TIME_SHORTAGE", "时间不足"],
  ["INTERRUPTION", "被打断"],
  ["BLOCKED", "存在阻塞"],
  ["FATIGUE", "疲劳"],
  ["WRONG_TIME_MATCH", "时段不匹配"],
  ["OVERRUN", "任务超时"],
  ["SCOPE_TOO_BIG", "范围太大"],
  ["DEPRIORITIZED", "优先级变化"],
  ["UNKNOWN", "其他"],
] as const;
function EndModal({
  result,
  onClose,
  onSave,
}: {
  result: string;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(
    result === "completed" ? "COMPLETED" : "UNKNOWN",
  );
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>结束与归因</h2>
        <p>请选择最符合这次结果的原因，后续推荐会使用这条反馈。</p>
        <div className="reason-grid">
          {reasonOptions.map(([code, label]) => (
            <button
              className={reason === code ? "selected" : ""}
              onClick={() => setReason(code)}
              key={code}
            >
              <b>{label}</b>
              <small>{code}</small>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <Btn kind="secondary" onClick={onClose}>
            取消
          </Btn>
          <Btn onClick={() => void onSave(reason)}>确认结束</Btn>
        </div>
      </div>
    </div>
  );
}

function CameraPanel({
  enabled,
  active,
}: {
  enabled: boolean;
  active: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("未启用");
  useEffect(() => {
    if (!enabled) {
      setStatus("已关闭");
      return;
    }
    if (!active) {
      setStatus("请先开始任务后启用检测");
      return;
    }
    let stream: MediaStream | undefined,
      timer: number | undefined,
      cancelled = false,
      awaySince = 0;
    const canvas = document.createElement("canvas");
    void navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 320 },
          frameRate: { ideal: 5, max: 10 },
        },
        audio: false,
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
        }
        setStatus("摄像头运行中（画面仅本地显示）");
        timer = window.setInterval(async () => {
          const v = video.current;
          if (!v || v.readyState < 2) return;
          canvas.width = 160;
          canvas.height = 120;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, 160, 120);
          let presence = false,
            facing: null | boolean = null,
            confidence = 0.35;
          const Detector = (window as any).FaceDetector;
          if (Detector) {
            try {
              const faces = await new Detector({
                fastMode: true,
                maxDetectedFaces: 1,
              }).detect(canvas);
              presence = faces.length > 0;
              facing = presence;
              confidence = presence ? 0.9 : 0.75;
            } catch {}
          } else {
            const p = ctx.getImageData(0, 0, 160, 120).data;
            let sum = 0,
              sum2 = 0,
              n = 0;
            for (let i = 0; i < p.length; i += 16) {
              const y = (p[i] + p[i + 1] + p[i + 2]) / 3;
              sum += y;
              sum2 += y * y;
              n++;
            }
            const variance = sum2 / n - (sum / n) ** 2;
            presence = variance > 350;
            confidence = Math.min(0.7, Math.max(0.3, variance / 1200));
          }
          if (presence) awaySince = 0;
          else if (!awaySince) awaySince = Date.now();
          await api().cameraSignal({
            presence,
            facingScreen: facing,
            awaySeconds: awaySince
              ? Math.round((Date.now() - awaySince) / 1000)
              : 0,
            confidence,
          });
        }, 5000);
      })
      .catch((e) =>
        setStatus(
          `无法打开摄像头：${e instanceof Error ? e.message : "权限被拒绝"}`,
        ),
      );
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [enabled, active]);
  return (
    <Card title="摄像头在位检测">
      <div className="camera-preview">
        <video ref={video} muted playsInline />
        <span>{status}</span>
      </div>
      <p>只向数据库写入“在位/离席、置信度”等派生信号，不保存照片或视频。</p>
    </Card>
  );
}

function ScreenSharePanel({
  enabled,
  onChange,
}: {
  enabled: boolean;
  active: boolean;
  onChange: () => Promise<void>;
}) {
  const [sources, setSources] = useState<
    Array<{
      id: string;
      name: string;
      kind?: "window" | "screen";
      thumbnail: string;
    }>
  >([]);
  const [shareError, setShareError] = useState("");
  const { stream } = useSharedScreen();
  const stop = async () => {
    sharedStream?.getTracks().forEach((t) => t.stop());
    publishShare(null);
    await api().stopScreenShare();
    await onChange();
  };
  const start = async (source: { id: string; name: string }) => {
    setShareError("");
    try {
      sharedStream?.getTracks().forEach((t) => t.stop());
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: source.id,
          },
        } as any,
      });
      publishShare(media, source.name);
      media.getVideoTracks()[0]?.addEventListener("ended", () => void stop());
      await api().startScreenShare({ sourceId: source.id, name: source.name });
      setSources([]);
      await onChange();
      try {
        await refreshSharedScreenContext(true);
      } catch (ocrError) {
        setShareError(
          `画面已经共享，但文字识别失败：${ocrError instanceof Error ? ocrError.message : String(ocrError)}`,
        );
      }
    } catch (error) {
      publishShare(null);
      setShareError(error instanceof Error ? error.message : String(error));
    }
  };
  const choose = async () => {
    setShareError("");
    try {
      const next = await api().screenSources();
      setSources(next);
      if (!next.length)
        setShareError("没有检测到可共享的软件窗口，请先打开要共享的应用。");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <Card title="单应用屏幕共享 / Application Share">
      <p>
        {enabled
          ? "共享画面会持续保留，并同步显示在日常对话和桌面助手中。"
          : "请先开启屏幕共享能力。"}
      </p>
      <SharedScreenView />
      {!stream && (
        <div className="screen-extract standby">
          <button disabled>提取当前画面文字 / OCR</button>
          <span>请先从下方选择一个应用，共享成功后将自动识别文字。</span>
        </div>
      )}
      <Btn kind="secondary" disabled={!enabled} onClick={() => void choose()}>
        显示应用列表 / Application List
      </Btn>
      {shareError && <p className="error">共享失败：{shareError}</p>}
      {stream && (
        <Btn kind="danger" onClick={() => void stop()}>
          停止共享 / Stop
        </Btn>
      )}
      <div className="source-grid">
        {sources.some((x) => x.kind === "window") && (
          <h3 className="source-section-title">
            应用窗口 / APPLICATION WINDOWS
          </h3>
        )}
        {sources
          .filter((x) => x.kind === "window")
          .map((x) => (
            <button
              className="app-source"
              key={x.id}
              onClick={() => void start(x)}
            >
              <img src={x.thumbnail} />
              <span>{x.name}</span>
              <small>仅共享此应用窗口</small>
            </button>
          ))}
        {sources.some((x) => x.kind === "screen") && (
          <h3 className="source-section-title">整个屏幕 / FULL SCREEN</h3>
        )}
        {sources
          .filter((x) => x.kind === "screen")
          .map((x) => (
            <button
              className="screen-source"
              key={x.id}
              onClick={() => void start(x)}
            >
              <img src={x.thumbnail} />
              <span>{x.name}</span>
              <small>共享整个屏幕</small>
            </button>
          ))}
      </div>
    </Card>
  );
}

function ChatView({ voiceEnabled }: { voiceEnabled: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [results, setResults] = useState<KnowledgeResult[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setMessages(await api().chatHistory());
    setDocs(await api().knowledgeList());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const r = await api().sendChat(value);
      await load();
      if (voiceEnabled) await api().speak(r.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const listen = () => {
    const Speech =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setError("当前系统没有可用的语音识别引擎。仍可使用文字对话和语音播报。");
      return;
    }
    const r = new Speech();
    r.lang = "zh-CN";
    r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = (e: any) => {
      setListening(false);
      setError(`语音识别失败：${e.error}`);
    };
    r.onresult = (e: any) =>
      setText(
        Array.from(e.results)
          .map((x: any) => x[0].transcript)
          .join(""),
      );
    r.start();
  };
  return (
    <>
      <header>
        <div>
          <small>DAILY CHAT · RAG</small>
          <h1>日常对话与本地知识库</h1>
          <p>最近对话会自动压缩为长期上下文；回答前检索本地文档并显示来源。</p>
        </div>
      </header>
      <div className="chat-layout">
        <Card title="Companion 对话">
          <div className="messages">
            {messages.length ? (
              messages.map((m) => (
                <article className={`message ${m.role}`} key={m.id}>
                  <b>{m.role === "user" ? "你" : "LifeOS"}</b>
                  <p>{m.content}</p>
                  {m.sources?.length > 0 && (
                    <small>
                      来源：
                      {m.sources
                        .map((x) => `${x.name} / ${x.heading}`)
                        .join("；")}
                    </small>
                  )}
                </article>
              ))
            ) : (
              <p>可以聊任务、日常问题，也可以询问两份产品文档中的要求。</p>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="composer">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            />
            <button
              className={listening ? "listening" : "voice"}
              onClick={listen}
            >
              {listening ? "正在听…" : "🎙 语音输入"}
            </button>
            <Btn disabled={busy} onClick={() => void send()}>
              {busy ? "思考中…" : "发送"}
            </Btn>
          </div>
        </Card>
        <div>
          <Card title="知识库">
            <div className="kb-actions">
              <Btn
                kind="secondary"
                onClick={() => void api().indexDefaultKnowledge().then(load)}
              >
                索引两份需求文档
              </Btn>
              <Btn
                kind="secondary"
                onClick={() => void api().importKnowledge().then(load)}
              >
                导入 MD/TXT
              </Btn>
            </div>
            {docs.map((d) => (
              <div className="doc" key={d.id}>
                <b>{d.name}</b>
                <small>{d.chunks} 个分块</small>
              </div>
            ))}
            {!docs.length && <p>尚未索引文档。</p>}
          </Card>
          <Card title="上下文检索测试">
            <div className="search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入关键词"
              />
              <Btn
                kind="mini"
                onClick={() =>
                  void api().searchKnowledge(query).then(setResults)
                }
              >
                检索
              </Btn>
            </div>
            {results.map((r) => (
              <details key={r.id}>
                <summary>
                  {r.name} · {r.heading}
                </summary>
                <p>{r.content}</p>
              </details>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function App() {
  if (location.hash === "#/companion") return <Companion />;
  const [d, setD] = useState(empty);
  const [page, setPage] = useState<Page>("NOW");
  const [notice, setNotice] = useState("");
  const [taskModal, setTaskModal] = useState<TodoTask | null | "new">(null);
  const [endResult, setEndResult] = useState<string | null>(null);
  const refresh = useCallback(() => api().snapshot().then(setD), []);
  useEffect(() => {
    void refresh();
    return api().onEvent((e: LifeEvent) => {
      if (e.type === "navigate" && pages.includes(e.payload?.page as Page))
        setPage(e.payload?.page as Page);
      if (e.message) setNotice(e.message);
      void refresh();
    });
  }, [refresh]);
  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await refresh();
  };
  const start = async (id: number) => {
    await act(() => api().startTask(id));
    setPage("RUN");
  };
  const toggle = (k: keyof Sensors) => (
    <button
      className={`switch ${d.sensors[k] ? "on" : ""}`}
      onClick={() => void act(() => api().setSensors({ [k]: !d.sensors[k] }))}
    >
      <i />
    </button>
  );
  const view = () => {
    if (page === "NOW") {
      const top = d.recommendations[0];
      return (
        <>
          <header>
            <div>
              <small>NOW ENGINE</small>
              <h1>现在，做哪一个？</h1>
              <p>基于截止时间、空档、优先级与个人节律。</p>
            </div>
            <Btn onClick={() => void act(() => api().seedDemo())}>
              生成演示数据
            </Btn>
          </header>
          {top ? (
            <div className="grid two">
              <Card title="当前最值得开始">
                <h2>{top.task.name}</h2>
                <div className="tags">
                  <b>{top.task.taskType}</b>
                  <b>{top.task.estimatedMinutes} 分钟</b>
                  <b>{Math.round(top.score * 100)} 分</b>
                </div>
                {top.reasons.map((x) => (
                  <p key={x}>✓ {x}</p>
                ))}
                <Btn onClick={() => void start(top.task.id)}>开始任务</Btn>
              </Card>
              <Card title="候选队列">
                {d.recommendations.slice(1).map((x) => (
                  <button
                    className="row"
                    key={x.task.id}
                    onClick={() => void start(x.task.id)}
                  >
                    <span>{x.task.name}</span>
                    <small>{x.task.estimatedMinutes}m</small>
                  </button>
                ))}
                <MiniCompanion text="我会根据真实任务、完成记录和节律陪你选择下一步。" />
              </Card>
            </div>
          ) : (
            <Card>
              <p>还没有任务。</p>
              <Btn onClick={() => setTaskModal("new")}>新建第一个任务</Btn>
            </Card>
          )}
          <div className="dashboard-metrics">
            <Card title="专注 / Focus">
              <strong>{d.review.effectiveMinutes}m</strong>
              <small>今日有效时间</small>
            </Card>
            <Card title="任务 / Tasks">
              <strong>
                {d.tasks.filter((x) => x.status === "completed").length}
              </strong>
              <small>累计已完成</small>
            </Card>
            <Card title="Bug / 卡点">
              <strong>{d.review.unfinished}</strong>
              <small>今日未完成</small>
            </Card>
            <Card title="后台 / Background">
              <strong>
                {d.tasks.filter((x) => x.status === "todo").length}
              </strong>
              <small>待处理任务</small>
            </Card>
          </div>
        </>
      );
    }
    if (page === "TODO")
      return (
        <>
          <header>
            <div>
              <small>PROCESS POOL</small>
              <h1>任务池</h1>
            </div>
            <Btn onClick={() => setTaskModal("new")}>＋ 新建任务</Btn>
          </header>
          <div className="task-summary">
            <span>
              <b>{d.tasks.length}</b> 全部任务
            </span>
            <span>
              <b>{d.tasks.filter((x) => x.status === "todo").length}</b> 待开始
            </span>
            <span>
              <b>{d.tasks.filter((x) => x.status === "running").length}</b>{" "}
              进行中
            </span>
            <span>
              <b>{d.tasks.filter((x) => x.status === "completed").length}</b>{" "}
              已完成
            </span>
          </div>
          <Card>
            {d.tasks.length ? (
              d.tasks.map((t) => (
                <div className="task" key={t.id}>
                  <i className={t.status} />
                  <div>
                    <b>{t.name}</b>
                    <small>
                      {t.taskType} · {t.estimatedMinutes} min · {t.priority}
                      {t.targetApp && ` · ${t.targetApp}`}
                    </small>
                  </div>
                  <Btn kind="mini" onClick={() => setTaskModal(t)}>
                    编辑
                  </Btn>
                  <Btn
                    kind="mini"
                    disabled={t.status === "completed"}
                    onClick={() => void start(t.id)}
                  >
                    开始
                  </Btn>
                  <Btn
                    kind="danger"
                    onClick={() =>
                      confirm("确认删除这个任务？") &&
                      void act(() => api().deleteTask(t.id))
                    }
                  >
                    删除
                  </Btn>
                </div>
              ))
            ) : (
              <p>任务池为空，点击右上角新建任务。</p>
            )}
          </Card>
        </>
      );
    if (page === "RUN") {
      const s = d.activeSession;
      return (
        <>
          <header>
            <div>
              <small>RUN MODE</small>
              <h1>{s?.taskName || "没有运行中的任务"}</h1>
            </div>
          </header>
          {s ? (
            <div className="grid two">
              <Card title="任务状态">
                <SessionClock
                  startAt={s.startAt}
                  paused={s.status !== "running"}
                />
                <div className="focus-state">
                  ●{" "}
                  {s.status === "running"
                    ? "专注中 / Focus Session"
                    : "已暂停 / Paused"}
                </div>
                <Btn
                  onClick={() =>
                    void act(() =>
                      s.status === "running"
                        ? api().pauseSession()
                        : api().resumeSession(),
                    )
                  }
                >
                  {s.status === "running" ? "暂停" : "继续"}
                </Btn>
                <Btn
                  kind="secondary"
                  onClick={() => void act(() => api().simulateDrift())}
                >
                  模拟游离
                </Btn>
                <Btn kind="secondary" onClick={() => setPage("DEBUG")}>
                  遇到卡点
                </Btn>
              </Card>
              <Card title="结束任务">
                <p>结束后明确选择原因，帮助下一次推荐。</p>
                {[
                  ["completed", "完成"],
                  ["unfinished", "未完成"],
                  ["cancelled", "主动结束"],
                ].map(([r, label]) => (
                  <Btn
                    key={r}
                    kind={r === "completed" ? "primary" : "secondary"}
                    onClick={() => setEndResult(r)}
                  >
                    {label}
                  </Btn>
                ))}
              </Card>
            </div>
          ) : (
            <Card>
              <p>请先从任务池开始一个任务。</p>
              <Btn onClick={() => setPage("TODO")}>打开任务池</Btn>
            </Card>
          )}
        </>
      );
    }
    if (page === "CHAT")
      return (
        <>
          <Card title="共享应用上下文 / Shared App Context">
            <SharedScreenView compact />
            <p>
              对话会读取当前任务、共享应用名称和所有 LifeOS
              模块状态。共享画面在此持续显示；涉及敏感操作仍需你确认。
            </p>
          </Card>
          <ChatView
            voiceEnabled={d.sensors.voiceReminder && !d.sensors.ghostMode}
          />
        </>
      );
    if (page === "SHARE")
      return (
        <>
          <header>
            <div>
              <small>SCREEN SHARE / 屏幕共享</small>
              <h1>选择并共享一个软件窗口</h1>
              <p>
                画面会在下方实时预览。每次只共享你亲自选择的窗口，可以随时停止。
              </p>
            </div>
            {!d.sensors.screenContext && (
              <Btn
                onClick={() =>
                  void act(() => api().setSensors({ screenContext: true }))
                }
              >
                开启屏幕共享
              </Btn>
            )}
          </header>
          <div className="share-hero">
            <div>
              <b>01</b>
              <h3>开始一个任务</h3>
              <p>共享与当前任务 Session 绑定。</p>
            </div>
            <div>
              <b>02</b>
              <h3>选择软件窗口</h3>
              <p>只列出当前可共享的应用。</p>
            </div>
            <div>
              <b>03</b>
              <h3>预览并随时停止</h3>
              <p>共享帧不写入磁盘。</p>
            </div>
          </div>
          <ScreenSharePanel
            enabled={d.sensors.screenContext && !d.sensors.ghostMode}
            active={Boolean(d.activeSession)}
            onChange={refresh}
          />
          {!d.activeSession && (
            <Card title="尚未开始任务">
              <p>为了记录共享属于哪个执行过程，请先开始一个任务。</p>
              <Btn onClick={() => setPage("TODO")}>前往任务 / TODO</Btn>
            </Card>
          )}
        </>
      );
    if (page === "DEBUG") return <DebugView d={d} />;
    if (page === "TIMELINE")
      return (
        <>
          <header>
            <div>
              <small>TIMELINE</small>
              <h1>今天如何运行</h1>
            </div>
          </header>
          <Card>
            {d.timeline.length ? (
              d.timeline.map((x) => (
                <div className="timeline" key={x.id}>
                  <b>
                    {new Date(x.startAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </b>
                  <span>
                    {x.taskName}
                    <small>
                      {x.result || x.status} · 计划 {x.plannedMinutes || 0}m ·
                      有效 {x.effectiveMinutes || 0}m
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p>今天还没有 Session。</p>
            )}
          </Card>
        </>
      );
    if (page === "REVIEW")
      return (
        <>
          <header>
            <div>
              <small>DAILY REVIEW</small>
              <h1>理解今天，而不是打卡</h1>
            </div>
          </header>
          <div className="metrics">
            <Card>
              <strong>{d.review.completed}</strong>
              <span>已完成</span>
            </Card>
            <Card>
              <strong>{d.review.unfinished}</strong>
              <span>未完成</span>
            </Card>
            <Card>
              <strong>{d.review.effectiveMinutes}m</strong>
              <span>有效时间</span>
            </Card>
          </div>
          <Card title="今日洞察">
            {d.review.insights.map((x) => (
              <p key={x}>— {x}</p>
            ))}
          </Card>
        </>
      );
    if (page === "RHYTHM")
      return (
        <>
          <header>
            <div>
              <small>生活节律 / LIFE RHYTHM</small>
              <h1>找到适合你的时段</h1>
            </div>
          </header>
          <Card>
            {d.rhythm.map((x, i) => (
              <div className="rhythm" key={i}>
                <b>{x.timeSlot}</b>
                <span>
                  {taskTypeZh[x.taskType] || x.taskType} / {x.taskType}
                  <small>{x.samples} 个样本</small>
                </span>
                <progress value={x.successRate} max="1" />
                <small>
                  {x.samples < 5
                    ? "学习中"
                    : `${Math.round(x.successRate * 100)}%`}
                </small>
              </div>
            ))}
          </Card>
        </>
      );
    return (
      <>
        <header>
          <div>
            <small>SENSOR & PRIVACY</small>
            <h1>摄像头、屏幕与语音能力</h1>
            <p>所有感知都必须显式开启，并可以立即关闭。</p>
          </div>
          <Btn
            kind="secondary"
            onClick={() =>
              void act(() =>
                api().setSensors({ ghostMode: !d.sensors.ghostMode }),
              )
            }
          >
            {d.sensors.ghostMode ? "退出隐私模式" : "开启隐私模式"}
          </Btn>
        </header>
        <Card>
          {(
            [
              [
                "cameraPresence",
                "摄像头在位检测",
                "显示实时预览，只保存派生信号",
              ],
              ["screenContext", "单应用屏幕共享", "只共享你明确选择的一个窗口"],
              ["voiceReminder", "语音交互", "语音输入与本地播报"],
              [
                "aiContextSharing",
                "AI 上下文",
                "DeepSeek 最小字段传输并记录审计",
              ],
            ] as const
          ).map(([k, n, s]) => (
            <div className="sensor" key={k}>
              <div>
                <b>{n}</b>
                <small>{s}</small>
              </div>
              {toggle(k)}
            </div>
          ))}
        </Card>
        <div className="grid two">
          <CameraPanel
            enabled={d.sensors.cameraPresence && !d.sensors.ghostMode}
            active={Boolean(d.activeSession)}
          />
          <Card title="实时状态">
            <p>
              摄像头：
              {d.runtime.cameraSignal?.presence ? "检测到在位" : "暂无在位信号"}
            </p>
            <p>
              屏幕：{d.runtime.screenSharing ? "正在共享单个应用" : "未共享"}
            </p>
            <p>语音：{d.sensors.voiceReminder ? "已开启" : "已关闭"}</p>
          </Card>
        </div>
        <ScreenSharePanel
          enabled={d.sensors.screenContext && !d.sensors.ghostMode}
          active={Boolean(d.activeSession)}
          onChange={refresh}
        />
        <Card title="桌面宠物自定义">
          <div className="pet-settings">
            <label className="setting">
              名字
              <input
                value={d.settings.companionName}
                onChange={(e) =>
                  void act(() =>
                    api().setSettings({ companionName: e.target.value }),
                  )
                }
              />
            </label>
            <label className="setting">
              外观
              <select
                value={d.settings.companionAvatar}
                onChange={(e) =>
                  void act(() =>
                    api().setSettings({
                      companionAvatar: e.target
                        .value as typeof d.settings.companionAvatar,
                    }),
                  )
                }
              >
                <option value="robot">睡帽机器人</option>
                <option value="cat">猫咪</option>
                <option value="byte">Byte 机器人</option>
                <option value="image" disabled={!d.settings.companionImage}>
                  自定义图片
                </option>
              </select>
            </label>
            <label className="setting">
              主题颜色
              <input
                type="color"
                value={d.settings.companionColor}
                onChange={(e) =>
                  void act(() =>
                    api().setSettings({ companionColor: e.target.value }),
                  )
                }
              />
            </label>
            <label className="setting">
              大小 {d.settings.companionScale}%
              <input
                type="range"
                min="70"
                max="140"
                value={d.settings.companionScale}
                onChange={(e) =>
                  void act(() =>
                    api().setSettings({
                      companionScale: Number(e.target.value),
                    }),
                  )
                }
              />
            </label>
          </div>
          <Btn onClick={() => void api().toggleCompanion()}>
            显示 / 隐藏桌面宠物
          </Btn>
          <Btn
            kind="secondary"
            onClick={() => void api().pickCompanionImage().then(refresh)}
          >
            导入自定义图片
          </Btn>
          <Btn kind="secondary" onClick={() => setPage("CHAT")}>
            用对话控制能力
          </Btn>
        </Card>
      </>
    );
  };
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <em>开</em>
          <span>
            开工了<small>LifeOS</small>
          </span>
        </div>
        <nav>
          {pages.map((x) => (
            <button
              className={page === x ? "active" : ""}
              onClick={() => setPage(x)}
              key={x}
            >
              <i>{pageMeta[x].icon}</i>
              <span>
                <b>{x}</b>
                <small>{pageMeta[x].zh}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className={d.sensors.ghostMode ? "privacy ghost" : "privacy"}>
          ● {d.sensors.ghostMode ? "PRIVACY / 隐私模式" : "LOCAL / 本地运行"}
        </div>
      </aside>
      <main>
        <div className="top">
          <span>
            Life has bugs. <b>Patch them.</b>
          </span>
          <button onClick={() => void api().toggleCompanion()}>
            COMPANION / 桌面陪伴
          </button>
        </div>
        <div className="view">{view()}</div>
      </main>
      {taskModal && (
        <TaskModal
          task={taskModal}
          onClose={() => setTaskModal(null)}
          onSave={async (v) => {
            if ("id" in v) await act(() => api().updateTask(v));
            else await act(() => api().createTask(v));
            setTaskModal(null);
          }}
        />
      )}
      {endResult && (
        <EndModal
          result={endResult}
          onClose={() => setEndResult(null)}
          onSave={async (reason) => {
            await act(() => api().endSession(endResult, reason));
            setEndResult(null);
          }}
        />
      )}
      {notice && (
        <div className="toast">
          <span>🐱 {notice}</span>
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
    </div>
  );
}
