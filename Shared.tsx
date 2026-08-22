import { useCallback, useEffect, useState } from 'react'
import type { AppSnapshot, LifeEvent, Sensors, Settings, TaskDraft } from './types'
import { api } from './lib/api'
import Sidebar from './components/Sidebar'
import NowView from './components/NowView'
import TodoView from './components/TodoView'
import RunView from './components/RunView'
import DebugFlow from './components/DebugFlow'
import TimelineView from './components/TimelineView'
import ReviewView from './components/ReviewView'
import RhythmView from './components/RhythmView'
import SensorsView from './components/SensorsView'
import Companion from './components/Companion'

const EMPTY:AppSnapshot={tasks:[],activeSession:null,recommendations:[],timeline:[],review:{date:'',planned:0,started:0,completed:0,unfinished:0,cancelled:0,plannedMinutes:0,actualMinutes:0,effectiveMinutes:0,reasons:[],insights:[],nextSuggestions:[]},rhythm:[],sensors:{applicationActivity:true,cameraPresence:false,screenContext:false,voiceReminder:true,aiContextSharing:false,ghostMode:false},settings:{availableMinutes:60,proactiveLevel:'Balanced',voiceMode:'Smart',dndStart:'22:00',dndEnd:'08:00',companionCharacter:'Milo'}}

export default function App(){
 if(location.hash==='#/companion') return <Companion/>
 const [data,setData]=useState<AppSnapshot>(EMPTY)
 const [active,setActive]=useState('NOW')
 const [debug,setDebug]=useState(false)
 const [notice,setNotice]=useState<string|null>(null)
 const refresh=useCallback(async()=>setData(await api().snapshot()),[])
 useEffect(()=>{refresh(); const off=api().onEvent((e:LifeEvent)=>{if(e.type==='bug-detected'){setNotice(e.message||'这个任务启动得比平时慢，要 Debug 一下吗？')} refresh()}); return off},[refresh])
 const mutate=async(fn:()=>Promise<unknown>)=>{await fn(); await refresh()}
 const start=async(id:number)=>{await mutate(()=>api().startTask(id));setActive('RUN')}
 const create=async(d:TaskDraft)=>mutate(()=>api().createTask(d))
 const sensors=(x:Partial<Sensors>)=>mutate(()=>api().setSensors(x))
 const settings=(x:Partial<Settings>)=>mutate(()=>api().setSettings(x))
 const view=()=>{
  switch(active){
   case 'NOW': return <NowView data={data} onStart={start} onSeed={()=>mutate(()=>api().seedDemo())}/>
   case 'TODO': return <TodoView tasks={data.tasks} onCreate={create} onDelete={id=>mutate(()=>api().deleteTask(id))} onStart={start}/>
   case 'RUN': return <RunView data={data} onPause={()=>mutate(()=>api().pauseSession())} onResume={()=>mutate(()=>api().resumeSession())} onEnd={(r,reason)=>mutate(()=>api().endSession(r,reason))} onDrift={()=>mutate(()=>api().simulateDrift())} onDebug={()=>setDebug(true)}/>
   case 'DEBUG': return <div className="view"><div className="view-title"><div><span className="eyebrow">DEBUG</span><h1>任务运行不起来？</h1><p>从当前 Process 进入 Debug，系统只问一个问题，再给一个最小 Patch。</p></div><button className="primary" disabled={!data.activeSession} onClick={()=>setDebug(true)}>开始 Debug</button></div></div>
   case 'TIMELINE': return <TimelineView entries={data.timeline}/>
   case 'REVIEW': return <ReviewView review={data.review}/>
   case 'RHYTHM': return <RhythmView rhythm={data.rhythm}/>
   case 'SENSORS': return <SensorsView sensors={data.sensors} settings={data.settings} onSensors={sensors} onSettings={settings} onExport={async()=>{const p=await api().exportData(); if(p)setNotice(`已导出：${p}`)}} onDelete={async()=>{if(confirm('确认删除全部本地数据？'))await mutate(()=>api().deleteAllData())}} onSpeak={()=>api().speak('这个任务好像卡住了一会儿，要不要先做最小的一步？')}/>
   default:return null
  }
 }
 return <div className="app-shell"><Sidebar active={active} onChange={setActive} ghost={data.sensors.ghostMode}/><main className="main"><header className="topbar"><div className="top-status"><span className="live-dot"/>开工了正在本地运行</div><div className="top-actions"><button className="ghost-btn" onClick={()=>api().toggleCompanion()}>桌面 Companion</button><button className="ghost-btn" onClick={()=>setActive('SENSORS')}>隐私中心</button></div></header>{view()}</main>
 {notice&&<div className="toast"><div className="toast-pet">🐱</div><div><b>Companion</b><p>{notice}</p><div><button onClick={()=>setNotice(null)}>我在工作</button><button className="primary tiny" onClick={()=>{setNotice(null);setDebug(true)}}>有点卡 · Debug</button></div></div></div>}
 <DebugFlow open={debug} taskName={data.activeSession?.taskName||'当前任务'} onClose={()=>{setDebug(false);refresh()}} onInstall={p=>api().installPatch(p)} onVerify={s=>api().verifyPatch(s)}/>
 </div>
}
