// A mailbox whose calendar and contacts weren't found when it signed in (the
// server may keep them on the mail host, where CitrusMail didn't look before)
// gets them filled in the next time the app loads its session, so Calendar,
// Contacts and Settings all see them without signing in again
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    const accounts = [session.secure?.account, ...(session.secure?.others ?? [])].filter((item): item is AccountSettings => !!item)
    // An address that was emptied in Settings ('') means that service is off
    const missing = (item: AccountSettings) => item.caldav === undefined || item.carddav === undefined
    if (!accounts.some(missing)) return

    let changed = false
    const filled = await Promise.all(accounts.map(async (item) => {
      if (!missing(item)) return item
      const found = await foundOnMailHost(item)
      const next = { ...item, caldav: item.caldav ?? found.caldav, carddav: item.carddav ?? found.carddav }
      if (next.caldav !== item.caldav || next.carddav !== item.carddav) changed = true
      return next
    }))
    if (changed) session.user = await saveSessionAccounts(event, filled)
  })
})
