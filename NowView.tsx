export type TaskType = 'Deep Work' | 'Creative' | 'Communication' | 'Admin' | 'Learning' | 'Routine'
export type Priority = 'High' | 'Medium' | 'Low'
export type TaskStatus = 'todo' | 'running' | 'paused' | 'completed' | 'cancelled'

export interface TodoTask {
  id: number
  name: string
  deadline: string | null
  estimatedMinutes: number
  taskType: TaskType
  priority: Priority
  targetApp: string | null
  status: TaskStatus
  createdAt: string
}

export interface TaskDraft {
  name: string
  deadline?: string | null
  estimatedMinutes: number
  taskType: TaskType
  priority: Priority
  targetApp?: string | null
}

export interface Session {
  id: number
  taskId: number
  taskName: string
  startAt: string
  endAt: string | null
  result: string | null
  effectiveMinutes: number
  targetAppRatio: number
  status: 'running' | 'paused' | 'ended'
}

export interface Recommendation {
  task: TodoTask
  score: number
  rhythmMatch: number | null
  reasons: string[]
  quick: boolean
}

export interface TimelineEntry {
  id: string
  startAt: string
  endAt: string | null
  taskName: string
  taskType: TaskType
  status: string
  result: string | null
  note?: string
  plannedMinutes?: number
  actualMinutes?: number | null
  effectiveMinutes?: number
}

export interface DailyReview {
  date: string
  planned: number
  started: number
  completed: number
  unfinished: number
  cancelled: number
  plannedMinutes: number
  actualMinutes: number
  effectiveMinutes: number
  reasons: Array<{ code: string; count: number }>
  insights: string[]
  nextSuggestions: string[]
}

export interface RhythmStat {
  timeSlot: string
  taskType: TaskType
  samples: number
  successRate: number
  avgStartup: number
  bugRate: number
}

export interface Sensors {
  applicationActivity: boolean
  cameraPresence: boolean
  screenContext: boolean
  voiceReminder: boolean
  aiContextSharing: boolean
  ghostMode: boolean
}

export interface Settings {
  availableMinutes: number
  proactiveLevel: 'Quiet' | 'Balanced' | 'Active'
  voiceMode: 'Never' | 'Severe Only' | 'Smart'
  dndStart: string
  dndEnd: string
  companionCharacter: 'Milo' | 'Byte'
  companionName: string
  companionAvatar: 'robot' | 'cat' | 'byte' | 'image'
  companionScale: number
  companionColor: string
  companionImage: string
  meetingMode: boolean
  retentionDays: 7 | 30 | 90 | 0
}

export interface AppSnapshot {
  tasks: TodoTask[]
  activeSession: Session | null
  recommendations: Recommendation[]
  timeline: TimelineEntry[]
  review: DailyReview
  rhythm: RhythmStat[]
  sensors: Sensors
  settings: Settings
  runtime: {
    screenSharing: { id:number; appId:string; mode:string; startAt:string } | null
    cameraSignal: { presence:boolean; facingScreen:boolean|null; awaySeconds:number; confidence:number; timestamp:string } | null
  }
}

export interface LifeEvent {
  type: 'bug-detected' | 'companion-message' | 'session-updated' | 'intervention' | 'sensor-updated' | 'settings-updated' | 'screen-sharing' | 'navigate'
  level?: number
  title?: string
  message?: string
  payload?: Record<string, unknown>
}
