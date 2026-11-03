// Checks for new mail to push to closed browsers, every minute
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  const timer = setInterval(() => {
    inBackground(runPush).catch(error => console.warn('[CitrusMail] Push:', (error as Error).message))
  }, 60_000)
  timer.unref?.()
})
