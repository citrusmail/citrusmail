import { createHash, randomBytes } from 'node:crypto'
import { useRuntimeConfig } from 'nuxt/server'

/**
 * Sign in with Microsoft, for Microsoft 365 and Outlook.com mailboxes, whose
 * IMAP server takes no password at all (it answers LOGINDISABLED and offers
 * only XOAUTH2). The authorization code flow with PKCE, so the app works as
 * a public client (the Mac app, the open template) and with a client secret
 * when one is set. Tokens live in the sealed session cookie like a password
 * would, and are renewed before they expire by requireAccount()
 */
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'https://outlook.office.com/IMAP.AccessAsUser.All', 'https://outlook.office.com/SMTP.Send']
/** Renew this long before the access token expires */
const EARLY = 5 * 60_000
export const MICROSOFT_IMAP: AccountSettings['incoming'] = { protocol: 'imap', host: 'outlook.office365.com', port: 993, security: 'tls' }
export const MICROSOFT_SMTP: ServerSettings = { host: 'smtp.office365.com', port: 587, security: 'starttls' }

interface MicrosoftConfig { clientId: string, clientSecret: string, tenant: string }

function config(): MicrosoftConfig {
  const raw = (useRuntimeConfig().oauth as { microsoft?: Partial<MicrosoftConfig> } | undefined)?.microsoft ?? {}
  return { clientId: String(raw.clientId ?? '').trim(), clientSecret: String(raw.clientSecret ?? '').trim(), tenant: String(raw.tenant ?? '').trim() || 'common' }
}

/** Whether this server can sign people in with the provider */
export function oauthConfigured(provider: 'microsoft'): boolean {
  return provider === 'microsoft' && !!config().clientId
}

const base64url = (buffer: Buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** A fresh state and PKCE pair for one sign-in attempt */
export function microsoftChallenge() {
  const verifier = base64url(randomBytes(48))
  return { state: base64url(randomBytes(24)), verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) }
}

export function microsoftAuthorizeUrl(redirectUri: string, state: string, challenge: string, loginHint?: string): string {
  const { clientId, tenant } = config()
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`)
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    ...(loginHint ? { login_hint: loginHint } : {})
  }).toString()
  return url.toString()
}

interface TokenResponse { access_token?: string, refresh_token?: string, expires_in?: number, id_token?: string, error?: string, error_description?: string }

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret, tenant } = config()
  const response = await guardedFetch(false, 15_000)(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}), ...body }).toString()
  })
  const json = await response.json().catch(() => ({})) as TokenResponse
  if (!response.ok || !json.access_token) {
    // The description carries trace ids nobody signing in needs
    const description = json.error_description?.split('\n')[0]?.replace(/\s*Trace ID:.*$/i, '').trim()
    throw new Error(description || json.error || `Microsoft answered ${response.status}`)
  }
  return json
}

function tokens(json: TokenResponse, previous?: OAuthTokens): OAuthTokens {
  return {
    provider: 'microsoft',
    accessToken: json.access_token!,
    // Microsoft usually rotates the refresh token; the old one stays valid if it didn't
    refreshToken: json.refresh_token || previous?.refreshToken || '',
    expiresAt: Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000,
    secret: previous?.secret ?? randomBytes(32).toString('hex')
  }
}

/** The address of the signed-in mailbox, from the id token Microsoft returned with the code */
function addressFrom(idToken?: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1]!, 'base64url').toString('utf8')) as { email?: string, preferred_username?: string }
    const candidate = (payload.email || payload.preferred_username || '').trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

/** Trades the code for tokens; the mailbox address comes from Microsoft, not the form */
export async function microsoftExchange(code: string, verifier: string, redirectUri: string): Promise<{ email: string, oauth: OAuthTokens }> {
  const json = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri })
  const email = addressFrom(json.id_token)
  if (!email) throw new Error('Microsoft didn’t say which mailbox was signed in.')
  if (!json.refresh_token) throw new Error('Microsoft didn’t allow staying signed in (no refresh token).')
  return { email, oauth: tokens(json) }
}

async function microsoftRefresh(previous: OAuthTokens): Promise<OAuthTokens> {
  const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: previous.refreshToken, scope: SCOPES.join(' ') })
  return tokens(json, previous)
}

/**
 * The account with a working access token: the same object when the token
 * is fine, a new one after a renewal. Throws when Microsoft refuses the
 * renewal (revoked, password changed, 90 days unused): time to sign in again
 */
export async function freshAccount(account: AccountSettings): Promise<AccountSettings> {
  if (!account.oauth || account.oauth.expiresAt - Date.now() > EARLY) return account
  return { ...account, oauth: await microsoftRefresh(account.oauth) }
}
