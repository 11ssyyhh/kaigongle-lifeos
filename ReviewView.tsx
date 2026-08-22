{
  "name": "kaigongle-lifeos",
  "version": "0.1.0",
  "private": true,
  "description": "开工了 · LifeOS — 个人执行操作系统 MVP",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "pack": "npm run build && electron-builder --dir",
    "dist:win": "npm run build && electron-builder --win nsis"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "date-fns": "^4.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.3",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^34.0.0",
    "electron-builder": "^25.1.8",
    "electron-vite": "^3.0.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.7"
  },
  "build": {
    "appId": "com.lifeos.kaigongle",
    "productName": "开工了",
    "files": ["dist/**/*", "dist-electron/**/*", "package.json"],
    "win": {"target": ["nsis"]},
    "nsis": {"oneClick": false, "allowToChangeInstallationDirectory": true}
  }
}
