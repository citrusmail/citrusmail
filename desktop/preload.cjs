// Marks the page as running in the Mac app, so the layout can make room for
// the window buttons and give the window somewhere to be dragged by, and
// gives it the few things only the app's own process can do: a system
// notification for new mail, and the message to open when one is clicked
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('citrusDesktop', {
  platform: process.platform,
  /** Shows a system notification. Clicking it brings the window back and opens `open` */
  notify: notice => ipcRenderer.invoke('citrusmail:notify', notice),
  /** Called with the `open` of a clicked notification */
  onOpen: (handler) => {
    const listener = (_event, open) => handler(open)
    ipcRenderer.on('citrusmail:open', listener)
    return () => ipcRenderer.removeListener('citrusmail:open', listener)
  }
})

const mark = () => document.documentElement?.classList.add('desktop', `desktop-${process.platform}`)
mark()
window.addEventListener('DOMContentLoaded', mark)
