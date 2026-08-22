import { EventEmitter } from 'node:events'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'

export interface BehaviorSample { appName:string; idleSeconds:number; ts:string }

export class BehaviorCollector extends EventEmitter {
  private child:ChildProcessWithoutNullStreams|null=null
  start(){
    if(process.platform!=='win32' || this.child)return
    const script=`
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class WinActivity {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
 [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
 [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
 public static uint IdleSeconds(){ LASTINPUTINFO lii=new LASTINPUTINFO(); lii.cbSize=(uint)Marshal.SizeOf(lii); GetLastInputInfo(ref lii); return ((uint)Environment.TickCount-lii.dwTime)/1000; }
}
'@
Add-Type $signature
while($true){
  try {
    $h=[WinActivity]::GetForegroundWindow(); $pid=0; [WinActivity]::GetWindowThreadProcessId($h,[ref]$pid)|Out-Null
    $name='Unknown'; if($pid -gt 0){ try{$name=(Get-Process -Id $pid -ErrorAction Stop).ProcessName}catch{} }
    $obj=@{appName=$name;idleSeconds=[WinActivity]::IdleSeconds();ts=(Get-Date).ToString('o')}
    $obj|ConvertTo-Json -Compress
  } catch {}
  Start-Sleep -Seconds 2
}`
    this.child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{windowsHide:true})
    let buffer=''
    this.child.stdout.on('data',d=>{buffer+=d.toString();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;try{this.emit('sample',JSON.parse(line) as BehaviorSample)}catch{}}})
    this.child.on('exit',()=>{this.child=null})
  }
  stop(){this.child?.kill();this.child=null}
}
