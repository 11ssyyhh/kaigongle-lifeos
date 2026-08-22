import type {
  AppSnapshot,
  Sensors,
  Settings,
  TaskDraft,
  TodoTask,
  LifeEvent,
} from "./types";
export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: Array<{ id: number; name: string; heading: string }>;
  created_at: string;
}
export interface KnowledgeDocument {
  id: number;
  name: string;
  sourcePath: string | null;
  createdAt: string;
  chunks: number;
}
export interface KnowledgeResult {
  id: number;
  name: string;
  heading: string;
  content: string;
}
declare global {
  interface Window {
    lifeos?: {
      snapshot: () => Promise<AppSnapshot>;
      createTask: (v: TaskDraft) => Promise<void>;
      updateTask: (v: TodoTask) => Promise<void>;
      deleteTask: (id: number) => Promise<void>;
      rejectRecommendation: (id: number) => Promise<void>;
      updateOutcome: (v: {
        sessionId: number;
        reason: string;
      }) => Promise<void>;
      startTask: (id: number) => Promise<void>;
      pauseSession: () => Promise<void>;
      resumeSession: () => Promise<void>;
      endSession: (r: string, reason?: string) => Promise<void>;
      simulateDrift: () => Promise<void>;
      installPatch: (v: unknown) => Promise<void>;
      verifyPatch: (v: boolean) => Promise<void>;
      setSensors: (v: Partial<Sensors>) => Promise<void>;
      setSettings: (v: Partial<Settings>) => Promise<void>;
      aiStatus: () => Promise<{
        configured: boolean;
        provider: string;
        model: string;
      }>;
      generatePatch: (v: { taskName: string; rootCause: string }) => Promise<{
        action: string;
        minutes: number;
        message: string;
        model: string;
      }>;
      chatHistory: () => Promise<ChatMessage[]>;
      sendChat: (v: string) => Promise<{
        answer: string;
        sources: Array<{ id: number; name: string; heading: string }>;
        command?: string;
        page?: string;
      }>;
      clearChat: () => Promise<void>;
      knowledgeList: () => Promise<KnowledgeDocument[]>;
      searchKnowledge: (v: string) => Promise<KnowledgeResult[]>;
      indexDefaultKnowledge: () => Promise<unknown[]>;
      importKnowledge: () => Promise<unknown[]>;
      pickCompanionImage: () => Promise<string | null>;
      cameraSignal: (v: {
        presence: boolean;
        facingScreen: boolean | null;
        awaySeconds: number;
        confidence: number;
      }) => Promise<void>;
      screenSources: () => Promise<
        Array<{
          id: string;
          name: string;
          kind?: "window" | "screen";
          thumbnail: string;
        }>
      >;
      startScreenShare: (v: {
        sourceId: string;
        name: string;
      }) => Promise<number>;
      stopScreenShare: () => Promise<void>;
      saveScreenContext: (v: { name: string; text: string }) => Promise<void>;
      analyzeScreen: (v: {
        name: string;
        image: string;
      }) => Promise<{ text: string; capturedAt: string }>;
      respondIntervention: (v: string) => Promise<void>;
      navigate: (v: string) => Promise<void>;
      seedDemo: () => Promise<void>;
      exportData: () => Promise<string | null>;
      deleteAllData: () => Promise<void>;
      speak: (v: string) => Promise<void>;
      showMain: () => Promise<void>;
      toggleCompanion: () => Promise<void>;
      onEvent: (cb: (e: LifeEvent) => void) => () => void;
    };
  }
}
export {};
