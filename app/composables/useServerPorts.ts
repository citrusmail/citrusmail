import type { SignInForm } from '~/composables/useSignIn'

// Switching protocol or security moves the port to the usual one for it,
// unless someone already typed a port of their own
const DEFAULT_PORTS: Record<string, Record<string, number>> = {
  imap: { tls: 993, starttls: 143, none: 143 },
  pop3: { tls: 995, starttls: 110, none: 110 },
  // JMAP is HTTP: SSL/TLS is https, None is plain http
  jmap: { tls: 443, starttls: 443, none: 80 },
  smtp: { tls: 465, starttls: 587, none: 25 }
}
const knownPorts = new Set(Object.values(DEFAULT_PORTS).flatMap(ports => Object.values(ports)))

export function useServerPorts(form: Ref<SignInForm>) {
  watch(() => [form.value.incoming.protocol, form.value.incoming.security], ([protocol, security]) => {
    if (knownPorts.has(form.value.incoming.port)) form.value.incoming.port = DEFAULT_PORTS[protocol!]![security!]!
  })
  watch(() => form.value.outgoing.security, (security) => {
    if (knownPorts.has(form.value.outgoing.port)) form.value.outgoing.port = DEFAULT_PORTS.smtp![security]!
  })
}
