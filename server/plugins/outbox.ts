// Checks the outbox for messages due to go out, every 20 seconds
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  const timer = setInterval(() => {
    inBackground(runOutbox).catch(error => console.warn('[CitrusMail] Outbox:', (error as Error).message))
  }, 20_000)
  timer.unref?.()
})
