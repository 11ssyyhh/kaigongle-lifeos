export interface TaskRow { id:number; name:string; deadline:string|null; estimated_minutes:number; task_type:string; priority:string; target_app:string|null; status:string; created_at:string }
export interface RhythmRow { timeSlot:string; taskType:string; samples:number; successRate:number; avgStartup:number; bugRate:number }

export function recommend(tasks:TaskRow[], availableMinutes:number, rhythm:RhythmRow[]){
  const p:Record<string,number>={High:1,Medium:.6,Low:.3}
  return tasks.filter(t=>t.status==='todo').map(t=>{
    const hours=t.deadline?Math.max(1,(new Date(t.deadline).getTime()-Date.now())/3600000):168
    const urgency=Math.min(1,24/hours)
    const duration=t.estimated_minutes<=availableMinutes?1:Math.max(.1,availableMinutes/t.estimated_minutes)
    const rh=rhythm.find(r=>r.taskType===t.task_type)
    const rhythmMatch=rh&&rh.samples>=5?rh.successRate:null
    const historical=rhythmMatch??.5
    const score=rhythmMatch!==null
      ?.30*rhythmMatch+.25*urgency+.20*duration+.15*(p[t.priority]??.5)+.10*historical
      :.35*urgency+.25*duration+.20*(p[t.priority]??.5)+.10*.65+.10*historical
    const reasons:string[]=[]
    if(duration>=.9)reasons.push(`当前 ${availableMinutes} 分钟空档足够完成或形成明确推进`)
    else reasons.push('当前空档短于预计时长，建议先切出可完成子任务')
    if(urgency>.7)reasons.push('截止时间接近，优先级自动上升')
    else reasons.push(`${t.task_type} 与当前任务类型匹配`)
    if(rhythmMatch===null)reasons.push('正在学习你的个人节律，暂不使用伪精确匹配率')
    else reasons.push(`该时段同类任务历史推进率 ${Math.round(rhythmMatch*100)}%`)
    return {task:mapTask(t),score,rhythmMatch,reasons,quick:t.estimated_minutes<=15}
  }).sort((a,b)=>b.score-a.score)
}

export function mapTask(t:TaskRow){return {id:t.id,name:t.name,deadline:t.deadline,estimatedMinutes:t.estimated_minutes,taskType:t.task_type,priority:t.priority,targetApp:t.target_app,status:t.status,createdAt:t.created_at}}
