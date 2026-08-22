import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'

export type DB = Database.Database
let db: DB | null = null

export function getDb():DB {
  if (db) return db
  const file = path.join(app.getPath('userData'), 'kaigongle.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS todo_tasks(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      deadline TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      task_type TEXT NOT NULL DEFAULT 'Routine',
      priority TEXT NOT NULL DEFAULT 'Medium',
      target_app TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT,
      result TEXT,
      effective_minutes INTEGER NOT NULL DEFAULT 0,
      target_app_ratio REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running'
    );
    CREATE TABLE IF NOT EXISTS behavior_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      app_name TEXT,
      event_type TEXT NOT NULL,
      idle_seconds INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bug_sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      bug_type TEXT NOT NULL,
      snapshot TEXT,
      root_cause TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS patch_attempts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id INTEGER,
      sequence INTEGER NOT NULL DEFAULT 1,
      template_id TEXT,
      action TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 3,
      result TEXT,
      installed_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recommendations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      recommended_at TEXT NOT NULL,
      score REAL NOT NULL,
      reasons_json TEXT,
      accepted INTEGER NOT NULL DEFAULT 0,
      final_result TEXT
    );
    CREATE TABLE IF NOT EXISTS session_outcomes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL UNIQUE,
      reason_code TEXT,
      user_confirmed INTEGER NOT NULL DEFAULT 1,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS sensor_permissions(
      sensor_type TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      scope TEXT,
      granted_at TEXT,
      expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS presence_signals(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      timestamp TEXT NOT NULL,
      presence INTEGER,
      facing_screen INTEGER,
      away_seconds INTEGER,
      confidence REAL
    );
    CREATE TABLE IF NOT EXISTS screen_context_sessions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      mode TEXT,
      app_id TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      ai_shared INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS intervention_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      level INTEGER NOT NULL,
      channel TEXT NOT NULL,
      reason TEXT,
      user_response TEXT,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_reviews(
      date TEXT PRIMARY KEY,
      summary_json TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      next_suggestions_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rhythm_stats(
      time_slot TEXT NOT NULL,
      task_type TEXT NOT NULL,
      samples INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      avg_startup REAL NOT NULL DEFAULT 0,
      bug_rate REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(time_slot,task_type)
    );
    CREATE TABLE IF NOT EXISTS companion_profile(
      id INTEGER PRIMARY KEY CHECK(id=1),
      character_id TEXT NOT NULL,
      name TEXT NOT NULL,
      voice TEXT NOT NULL,
      tone TEXT NOT NULL,
      proactive_level TEXT NOT NULL,
      animation_level TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_audit_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      purpose TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      model TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversation_summaries(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      through_message_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_documents(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_path TEXT,
      content_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_chunks(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      heading TEXT,
      content TEXT NOT NULL,
      FOREIGN KEY(document_id) REFERENCES knowledge_documents(id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(chunk_id UNINDEXED, document_name, heading, content, tokenize='unicode61');
    CREATE TABLE IF NOT EXISTS app_settings(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  ensureDefaults(db)
  return db
}

function ensureDefaults(d:DB){
  const defaults:Record<string,unknown>={
    'sensor.applicationActivity':true,
    'sensor.cameraPresence':false,
    'sensor.screenContext':false,
    'sensor.voiceReminder':true,
    'sensor.aiContextSharing':false,
    'sensor.ghostMode':false,
    'settings.availableMinutes':60,
    'settings.proactiveLevel':'Balanced',
    'settings.voiceMode':'Smart',
    'settings.dndStart':'22:00',
    'settings.dndEnd':'08:00',
    'settings.companionCharacter':'Milo',
    'settings.companionName':'Milo',
    'settings.meetingMode':false,
    'settings.retentionDays':30
  }
  const stmt=d.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES(?,?)')
  const tx=d.transaction(()=>Object.entries(defaults).forEach(([k,v])=>stmt.run(k,JSON.stringify(v))))
  tx()
  d.prepare("INSERT OR IGNORE INTO companion_profile(id,character_id,name,voice,tone,proactive_level,animation_level) VALUES(1,'Milo','Milo','system','calm','Balanced','normal')").run()
}

export function getSetting<T>(key:string, fallback:T):T{
  const row=getDb().prepare('SELECT value FROM app_settings WHERE key=?').get(key) as {value:string}|undefined
  if(!row)return fallback
  try{return JSON.parse(row.value) as T}catch{return fallback}
}
export function setSetting(key:string,value:unknown){getDb().prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))}
