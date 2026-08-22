import type { AppSnapshot, Settings, Sensors, TaskDraft, TodoTask, LifeEvent } from './types'

declare global {
  interface Window {
    lifeos?: {
      snapshot: () => Promise<AppSnapshot>
      createTask: (draft: TaskDraft) => Promise<void>
      updateTask: (task: TodoTask) => Promise<void>
      deleteTask: (id: number) => Promise<void>
      startTask: (id: number) => Promise<void>
      pauseSession: () => Promise<void>
      resumeSession: () => Promise<void>
      endSession: (result: string, reason?: string) => Promise<void>
      simulateDrift: () => Promise<void>
      installPatch: (patch: { action: string; minutes: number; rootCause: string }) => Promise<void>
      verifyPatch: (success: boolean) => Promise<void>
      setSensors: (sensors: Partial<Sensors>) => Promise<void>
      setSettings: (settings: Partial<Settings>) => Promise<void>
      seedDemo: () => Promise<void>
      exportData: () => Promise<string | null>
      deleteAllData: () => Promise<void>
      speak: (text: string) => Promise<void>
      showMain: () => Promise<void>
      toggleCompanion: () => Promise<void>
      onEvent: (callback: (event: LifeEvent) => void) => () => void
    }
  }
}
export {}
