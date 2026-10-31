declare namespace NodeJS {
  interface Process {
    resourcesPath?: string
  }
}

declare namespace Electron {
  interface IpcMainInvokeEvent {
    sender: any
    frameId: number
    processId: number
  }
}

declare module 'electron' {
  export const app: any
  export class BrowserWindow {
    constructor(options?: any)
    [key: string]: any
  }
  export const ipcMain: any
  export const ipcRenderer: any
  export const contextBridge: any
  export const clipboard: any
  export const Menu: any
  export class Tray {
    constructor(image?: any)
    [key: string]: any
  }
  export const nativeImage: any
  export const nativeTheme: any
  export const systemPreferences: any
  export const dialog: any
  export const shell: any
  export const screen: any
  export const globalShortcut: any
}
