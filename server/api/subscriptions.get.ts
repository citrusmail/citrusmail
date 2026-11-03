import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(event => withAccount(event, (account): Promise<Subscription[]> => listSubscriptions(account)))
