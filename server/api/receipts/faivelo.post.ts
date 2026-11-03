import { defineEventHandler } from 'nuxt/server'

// Settings → Tracking: checks Faivelo will track opens for this mailbox
export default defineEventHandler(event => withAccount(event, account => checkFaivelo(account)))
