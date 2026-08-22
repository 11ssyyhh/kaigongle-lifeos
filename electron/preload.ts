import { contextBridge, ipcRenderer } from "electron";
const call = (name: string, ...args: unknown[]) =>
  ipcRenderer.invoke(name, ...args);
contextBridge.exposeInMainWorld("lifeos", {
  snapshot: () => call("snapshot"),
  createTask: (v: unknown) => call("task:create", v),
  updateTask: (v: unknown) => call("task:update", v),
  deleteTask: (id: number) => call("task:delete", id),
  rejectRecommendation: (id: number) => call("recommendation:reject", id),
  updateOutcome: (v: unknown) => call("outcome:update", v),
  startTask: (id: number) => call("session:start", id),
  pauseSession: () => call("session:pause"),
  resumeSession: () => call("session:resume"),
  endSession: (result: string, reason?: string) =>
    call("session:end", { result, reason }),
  simulateDrift: () => call("demo:drift"),
  installPatch: (v: unknown) => call("patch:install", v),
  verifyPatch: (v: boolean) => call("patch:verify", v),
  setSensors: (v: unknown) => call("sensors:set", v),
  setSettings: (v: unknown) => call("settings:set", v),
  aiStatus: () => call("ai:status"),
  generatePatch: (v: unknown) => call("ai:patch", v),
  chatHistory: () => call("chat:history"),
  sendChat: (v: string) => call("chat:send", v),
  clearChat: () => call("chat:clear"),
  knowledgeList: () => call("knowledge:list"),
  searchKnowledge: (v: string) => call("knowledge:search", v),
  indexDefaultKnowledge: () => call("knowledge:indexDefaults"),
  importKnowledge: () => call("knowledge:import"),
  pickCompanionImage: () => call("companion:pickImage"),
  cameraSignal: (v: unknown) => call("camera:signal", v),
  screenSources: () => call("screen:sources"),
  startScreenShare: (v: unknown) => call("screen:start", v),
  stopScreenShare: () => call("screen:stop"),
  respondIntervention: (v: string) => call("intervention:respond", v),
  navigate: (v: string) => call("window:navigate", v),
  saveScreenContext: (v: unknown) => call("screen:context", v),
  analyzeScreen: (v: unknown) => call("screen:analyze", v),
  seedDemo: () => call("demo:seed"),
  exportData: () => call("data:export"),
  deleteAllData: () => call("data:delete"),
  speak: (v: string) => call("voice:speak", v),
  showMain: () => call("window:showMain"),
  toggleCompanion: () => call("window:toggleCompanion"),
  onEvent: (cb: (v: unknown) => void) => {
    const fn = (_e: unknown, v: unknown) => cb(v);
    ipcRenderer.on("lifeos:event", fn);
    return () => ipcRenderer.removeListener("lifeos:event", fn);
  },
});
