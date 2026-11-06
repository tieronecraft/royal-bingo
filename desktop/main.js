/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — Electron Main Process (`desktop/main.js`)
 * Clean, Zero-Antivirus False-Positive Architecture (Standard NSIS + Persistent JSON State)
 * ============================================================================
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

function getHardwareFingerprint() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0] ? cpus[0].model : "GENERIC_CPU";
  const raw = `${os.hostname()}::${os.platform()}::${os.arch()}::${cpuModel}::${os.totalmem()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16).toUpperCase();
}

function getStateFilePath() {
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, "royal_bingo_pro_state_v1.json");
}

function loadPersistentState() {
  const fp = getStateFilePath();
  try {
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, "utf-8"));
    }
  } catch (err) {
    console.error("Failed reading state file:", err);
  }
  return null;
}

function savePersistentState(stateObj) {
  const fp = getStateFilePath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(stateObj, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Failed writing state file:", err);
    return false;
  }
}

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500)",
    backgroundColor: "#060b16",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("rbp:get-hardware-id", () => getHardwareFingerprint());
  ipcMain.handle("rbp:load-state", () => loadPersistentState());
  ipcMain.handle("rbp:save-state", (_event, data) => savePersistentState(data));
  ipcMain.handle("rbp:toggle-fullscreen", () => {
    if (mainWindow) {
      const nextState = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(nextState);
      return nextState;
    }
    return false;
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
