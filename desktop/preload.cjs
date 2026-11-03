// Marks the page as running in the Mac app, so the layout can make room for
// the window buttons and give the window somewhere to be dragged by
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('citrusDesktop', { platform: process.platform })

const mark = () => document.documentElement?.classList.add('desktop', `desktop-${process.platform}`)
mark()
window.addEventListener('DOMContentLoaded', mark)
