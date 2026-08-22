import type { AppSnapshot, DailyReview, LifeEvent, Recommendation, RhythmStat, Sensors, Settings, TaskDraft, TodoTask } from '../types'

const TASKS_KEY = 'kg_tasks_v1'
const SETTINGS_KEY = 'kg_settings_v1'
const SENSORS_KEY = 'kg_sensors_v1'
const SESSIONS_KEY = 'kg_sessions_v1'

type BrowserSession = { id:number; taskId:number; taskName:string; startAt:string; endAt:string|null; result:string|null; effectiveMinutes:number; targetAppRatio:number; status:'running'|'paused'|'ended'; reason?:string }

const baseSettings: Settings = { availableMinutes: 60, proactiveLevel: 'Balanced', voiceMode: 'Smart', dndStart: '22:00', dndEnd: '08:00', companionCharacter: 'Milo' }
const baseSensors: Sensors = { applicationActivity: true, cameraPresence: false, screenContext: false, voiceReminder: true, aiContextSharing: false, ghostMode: false }

function load<T>(key:string, fallback:T):T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback } }
function save(key:string, v:unknown) { localStorage.setItem(key, JSON.stringify(v)) }
function seedTasks():TodoTask[] {
  const now = Date.now()
  return [
    { id:1, name:'修改论文', deadline:new Date(now+2*86400000).toISOString(), estimatedMinutes:90, taskType:'Deep Work', priority:'High', targetApp:'Microsoft Word', status:'todo', createdAt:new Date().toISOString() },
    { id:2, name:'准备组会汇报', deadline:new Date(now+86400000).toISOString(), estimatedMinutes:60, taskType:'Creative', priority:'High', targetApp:'PowerPoint', status:'todo', createdAt:new Date().toISOString() },
    { id:3, name:'回复导师消息', deadline:new Date(now+4*3600000).toISOString(), estimatedMinutes:5, taskType:'Communication', priority:'Medium', targetApp:'WeChat', status:'todo', createdAt:new Date().toISOString() },
    { id:4, name:'整理实验数据', deadline:new Date(now+5*86400000).toISOString(), estimatedMinutes:30, taskType:'Admin', priority:'Medium', targetApp:'Excel', status:'todo', createdAt:new Date().toISOString() }
  ]
}
function browserRecommendations(tasks:TodoTask[], settings:Settings):Recommendation[] {
  const p = {High:1,Medium:.6,Low:.3} as const
  return tasks.filter(t=>t.status==='todo').map(t=>{
    const hours = t.deadline ? Math.max(1,(new Date(t.deadline).getTime()-Date.now())/3600000) : 168
    const urgency = Math.min(1,24/hours)
    const duration = t.estimatedMinutes <= settings.availableMinutes ? 1 : Math.max(.1,settings.availableMinutes/t.estimatedMinutes)
    const type = ['Deep Work','Creative'].includes(t.taskType) ? .75 : .65
    const score=.35*urgency+.25*duration+.2*p[t.priority]+.1*type+.1*.5
    return { task:t, score, rhythmMatch:null, quick:t.estimatedMinutes<=15, reasons:[duration>.8?`当前 ${settings.availableMinutes} 分钟空档足够完成或推进`:'当前空档较短，建议先拆成子任务', urgency>.7?'截止时间接近，优先级上升':`${t.taskType} 与当前任务类型匹配`, '正在学习你的个人节律'] }
  }).sort((a,b)=>b.score-a.score)
}
function browserReview(tasks:TodoTask[], sessions:BrowserSession[]):DailyReview {
  const date = new Date().toISOString().slice(0,10)
  const today = sessions.filter(s=>s.startAt.slice(0,10)===date)
  const completed=today.filter(s=>s.result==='completed').length
  const cancelled=today.filter(s=>s.result==='cancelled').length
  const reasons=new Map<string,number>(); today.forEach(s=>{ if(s.reason) reasons.set(s.reason,(reasons.get(s.reason)||0)+1) })
  return { date, planned:tasks.length, started:today.length, completed, unfinished:today.filter(s=>s.result==='unfinished').length, cancelled, plannedMinutes:tasks.reduce((n,t)=>n+t.estimatedMinutes,0), actualMinutes:today.reduce((n,s)=>n+Math.max(1,Math.round(((s.endAt?new Date(s.endAt).getTime():Date.now())-new Date(s.startAt).getTime())/60000)),0), effectiveMinutes:today.reduce((n,s)=>n+s.effectiveMinutes,0), reasons:[...reasons].map(([code,count])=>({code,count})), insights:[completed?`今天已经完成 ${completed} 个 Process。`:'今天还没有完成任务，先从一个 Quick Task 开始。','上午更适合 Deep Work（演示数据，待样本积累后更新）。'], nextSuggestions:['把最重要的 Deep Work 放在上午','下午优先安排 Communication / Admin','高强度任务之间预留 15 分钟缓冲'] }
}
function browserRhythm():RhythmStat[] { return [
  {timeSlot:'09:00–11:00',taskType:'Deep Work',samples:3,successRate:.82,avgStartup:6,bugRate:.12},
  {timeSlot:'14:00–16:00',taskType:'Admin',samples:4,successRate:.76,avgStartup:4,bugRate:.08},
  {timeSlot:'16:00–18:00',taskType:'Creative',samples:2,successRate:.68,avgStartup:8,bugRate:.18}
] }
async function browserSnapshot():Promise<AppSnapshot>{
  let tasks=load<TodoTask[]>(TASKS_KEY,[]); if(!tasks.length){tasks=seedTasks(); save(TASKS_KEY,tasks)}
  const sessions=load<BrowserSession[]>(SESSIONS_KEY,[]); const active=sessions.find(s=>s.status!=='ended')||null
  const settings=load(SETTINGS_KEY,baseSettings); const sensors=load(SENSORS_KEY,baseSensors)
  return { tasks, activeSession:active, recommendations:browserRecommendations(tasks,settings), timeline:sessions.map(s=>({id:String(s.id),startAt:s.startAt,endAt:s.endAt,taskName:s.taskName,taskType:tasks.find(t=>t.id===s.taskId)?.taskType||'Routine',status:s.status,result:s.result,note:s.reason})), review:browserReview(tasks,sessions), rhythm:browserRhythm(), sensors, settings }
}

const browserApi = {
  snapshot: browserSnapshot,
  createTask: async (draft:TaskDraft)=>{ const tasks=load<TodoTask[]>(TASKS_KEY,[]); tasks.push({id:Date.now(),name:draft.name,deadline:draft.deadline||null,estimatedMinutes:draft.estimatedMinutes,taskType:draft.taskType,priority:draft.priority,targetApp:draft.targetApp||null,status:'todo',createdAt:new Date().toISOString()}); save(TASKS_KEY,tasks) },
  updateTask: async (task:TodoTask)=>{ const tasks=load<TodoTask[]>(TASKS_KEY,[]).map(t=>t.id===task.id?task:t); save(TASKS_KEY,tasks) },
  deleteTask: async (id:number)=>{ save(TASKS_KEY,load<TodoTask[]>(TASKS_KEY,[]).filter(t=>t.id!==id)) },
  startTask: async (id:number)=>{ let sessions=load<BrowserSession[]>(SESSIONS_KEY,[]).map(s=>s.status!=='ended'?{...s,status:'ended' as const,endAt:new Date().toISOString(),result:'unfinished'}:s); const tasks=load<TodoTask[]>(TASKS_KEY,[]); const t=tasks.find(x=>x.id===id)!; sessions.push({id:Date.now(),taskId:id,taskName:t.name,startAt:new Date().toISOString(),endAt:null,result:null,effectiveMinutes:0,targetAppRatio:0,status:'running'}); save(SESSIONS_KEY,sessions); save(TASKS_KEY,tasks.map(x=>x.id===id?{...x,status:'running'}:x)) },
  pauseSession: async ()=>{ save(SESSIONS_KEY,load<BrowserSession[]>(SESSIONS_KEY,[]).map(s=>s.status==='running'?{...s,status:'paused'}:s)) },
  resumeSession: async ()=>{ save(SESSIONS_KEY,load<BrowserSession[]>(SESSIONS_KEY,[]).map(s=>s.status==='paused'?{...s,status:'running'}:s)) },
  endSession: async (result:string,reason?:string)=>{ const sessions=load<BrowserSession[]>(SESSIONS_KEY,[]); const active=sessions.find(s=>s.status!=='ended'); save(SESSIONS_KEY,sessions.map(s=>s.status!=='ended'?{...s,status:'ended',endAt:new Date().toISOString(),result,reason,effectiveMinutes:Math.max(1,Math.round((Date.now()-new Date(s.startAt).getTime())/60000)),targetAppRatio:.72}:s)); if(active){save(TASKS_KEY,load<TodoTask[]>(TASKS_KEY,[]).map(t=>t.id===active.taskId?{...t,status:result==='completed'?'completed':'todo'}:t))} },
  simulateDrift: async ()=>{},
  installPatch: async ()=>{}, verifyPatch: async ()=>{},
  setSensors: async (v:Partial<Sensors>)=>save(SENSORS_KEY,{...load(SENSORS_KEY,baseSensors),...v}),
  setSettings: async (v:Partial<Settings>)=>save(SETTINGS_KEY,{...load(SETTINGS_KEY,baseSettings),...v}),
  seedDemo: async ()=>{ save(TASKS_KEY,seedTasks()); save(SESSIONS_KEY,[]) },
  exportData: async ()=>null,
  deleteAllData: async ()=>{[TASKS_KEY,SETTINGS_KEY,SENSORS_KEY,SESSIONS_KEY].forEach(k=>localStorage.removeItem(k))},
  speak: async (text:string)=>{ if('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(text)) },
  showMain: async ()=>{}, toggleCompanion: async ()=>{}, onEvent: (_cb:(event:LifeEvent)=>void)=>()=>{}
}

export const api = () => window.lifeos ?? browserApi
