const { app, BrowserWindow } = require('electron')
const path = require('path')

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true
    }
  })

  // Set CSP in the main process
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://fantasy.premierleague.com https://unpkg.com; " +
          "script-src 'self' https://unpkg.com 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' https://unpkg.com 'unsafe-inline';"
        ]
      }
    })
  })

  win.loadFile('index.html')
  win.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
}) 