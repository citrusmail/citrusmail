import type { Editor } from '@tiptap/vue-3'

export interface Draft {
  to: Address[]
  cc: Address[]
  bcc: Address[]
  subject: string
  html: string
  attachments: OutgoingAttachment[]
  inReplyTo?: string
  references?: string[]
  /** Whether your signature goes under this message */
  signature: boolean
  /** The original of a reply or forward, sent under the signature as is */
  quote?: string
  /** The same original as text, for the preview under the editor */
  quoteText?: string
  /** The copy in the Drafts folder, replaced on each save and removed once sent */
  savedAs?: DraftRef
  /** The message a reply answers, so AI can read it */
  replyingTo?: { folder: string, id: string }
  /** You read the original translated: the language it was in, to offer your reply in */
  translateTo?: string
  /** Track delivery and opens (see mail/receipt-toggle); unset follows Settings → Tracking */
  readReceipt?: boolean
}

function emptyDraft(): Draft {
  return { to: [], cc: [], bcc: [], subject: '', html: '', attachments: [], signature: true }
}

function prefixed(prefix: string, subject: string): string {
  return new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`
}

/** What a person actually changed: recipients, subject, words and files */
function fingerprint(draft: Draft) {
  const words = draft.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return JSON.stringify([draft.to, draft.cc, draft.bcc, draft.subject, words, draft.attachments.length, /<img/i.test(draft.html)])
}

// The original under a reply or forward: a header line and the message in a
// blockquote, which every mail program renders the same. It stays out of the
// editor, so the signature can sit between your words and the quote
function quote(message: MessageDetail, intro: string): Pick<Draft, 'quote' | 'quoteText'> {
  const text = (message.text?.trim() || (message.html ? new DOMParser().parseFromString(message.html, 'text/html').body.textContent ?? '' : '')).trim()
  // The HTML keeps headings, lists and links; text is the fallback
  const body = message.html?.trim()
    ? message.html
    : text.split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')

  return {
    quote: `<br><p>${escapeHtml(intro).replace(/\n/g, '<br>')}</p><blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote>`,
    quoteText: `${intro}\n\n${text}`
  }
}

// One composer for the whole app, opened from mail, contacts or a shortcut.
// Closing it with something written saves that to Drafts and the next message
// starts clean; the open draft survives a reload in local storage
const _useComposer = () => {
  const toast = useToast()
  const { account } = useShell()
  const { settings } = useSettings()
  const { refresh: refreshScheduled, draftsLink } = useScheduled()
  const { recall } = useTranslationMemory()

  const open = ref(false)
  const sending = ref(false)
  // The docked composer (mail/composer): folded down to a bar while you look
  // at something else, or opened out large for a long message. Its size is
  // remembered, so the next one opens docked or large the way the last was
  // left. Folded down isn't: a message you open is one you mean to write
  const minimized = ref(false)
  const expanded = useLocalStorage('citrusmail-composer-expanded', false)
  renameStoredKey('letterbox-draft', 'citrusmail-draft')
  renameStoredKey('letterbox-draft-baseline', 'citrusmail-draft-baseline')
  const draft = useLocalStorage<Draft>('citrusmail-draft', emptyDraft(), { mergeDefaults: true })
  // Bumped whenever the draft is replaced wholesale, so the editor remounts
  // with the new content instead of keeping what it had
  const version = ref(0)
  // The draft as it was handed to the composer, so prefilled replies don't count as changes
  // A browser that has never written anything starts from the empty draft, so it isn't "changed"
  const baseline = useLocalStorage('citrusmail-draft-baseline', fingerprint(emptyDraft()))
  const isDirty = computed(() => fingerprint(draft.value) !== baseline.value)

  // The editor registers itself, so the subject's Tab can land in it
  const editor = shallowRef<Editor>()
  function focusBody() {
    editor.value?.commands.focus('start')
  }

  // Asking whether to put the open message aside for a new one
  const asking = ref(false)
  const overlay = useOverlay()

  /**
   * Opens a new message, reply or forward. With one already open that has
   * your writing in it, asks first: keep writing it, or save it to Drafts
   * and start the new one. Nothing you wrote is ever thrown away here.
   * Resolves false when the new one wasn't started
   */
  async function start(next: Partial<Draft> = {}): Promise<boolean> {
    if (asking.value) return false
    if (open.value && isDirty.value) {
      if (!await setAside(next)) {
        minimized.value = false
        return false
      }
      void putAway()
    }
    const isReply = Boolean(next.quote)
    draft.value = { ...emptyDraft(), signature: !isReply || settings.value.signatureOnReplies, ...next }
    baseline.value = fingerprint(draft.value)
    version.value++
    minimized.value = false
    open.value = true
    return true
  }

  // Saving to Drafts or carrying on writing; there's no choice that loses it
  async function setAside(next: Partial<Draft>) {
    const what = draft.value.subject.trim() ? `“${draft.value.subject.trim()}”` : 'The message you’re writing'
    const kind = next.inReplyTo ? 'reply' : /^fwd:/i.test(next.subject ?? '') ? 'forward' : 'message'
    asking.value = true
    try {
      const ConfirmDialog = (await import('~/components/confirm-dialog/index.vue')).default
      return await overlay.create(ConfirmDialog, {
        props: {
          title: 'Start a new message?',
          message: `${what} is still open. It will be saved to Drafts so you can finish it later, and the new ${kind} opens in its place.`,
          confirmLabel: kind === 'message' ? 'Save and start new' : kind === 'reply' ? 'Save and reply' : 'Save and forward',
          cancelLabel: 'Keep writing',
          color: 'primary'
        }
      }).open().result === true
    } finally {
      asking.value = false
    }
  }

  function compose(to: Address[] = []) {
    void start({ to })
  }

  function reply(message: MessageDetail, all = false) {
    const self = account.value?.email.toLowerCase()
    const primary = message.replyTo.length ? message.replyTo : [message.from]
    const others = all
      ? [...message.to, ...message.cc].filter(address => address.address.toLowerCase() !== self && !primary.some(p => p.address === address.address))
      : []

    void start({
      to: primary,
      cc: others,
      subject: prefixed('Re', message.subject),
      ...quote(message, `On ${fullDate(message.date)}, ${formatAddress(message.from)} wrote:`),
      inReplyTo: message.messageId,
      references: [...(message.references ?? []), ...(message.messageId ? [message.messageId] : [])],
      replyingTo: { folder: message.folder, id: message.id },
      translateTo: translatedFrom(message)
    })
  }

  function translatedFrom(message: MessageDetail) {
    const memory = recall(message)
    return memory?.from && memory.from !== memory.to ? memory.from : undefined
  }

  function forward(message: MessageDetail) {
    void start({
      subject: prefixed('Fwd', message.subject),
      ...quote(message, `---------- Forwarded message ----------\nFrom: ${formatAddress(message.from)}\nDate: ${fullDate(message.date)}\nSubject: ${message.subject}`)
    })
  }

  /** Opens a message from the Drafts folder, with its attachments, to carry on */
  async function editDraft(message: MessageDetail) {
    const attachments = await Promise.all(message.attachments.map(async (file) => {
      const blob = await $fetch<Blob>(`/api/messages/${encodeURIComponent(message.id)}/attachments/${file.index}`, { query: { folder: message.folder }, responseType: 'blob' })
      return { filename: file.filename, contentType: file.contentType, content: await blobToBase64(blob) }
    })).catch(() => [] as OutgoingAttachment[])
    void start({
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      html: message.html ?? textToHtml(message.text ?? ''),
      attachments,
      signature: false,
      inReplyTo: undefined,
      savedAs: /^\d+$/.test(message.id) ? { folder: message.folder, id: message.id } : undefined
    })
  }

  /** A scheduled message taken back out to edit */
  function reopen(message: OutgoingMessage) {
    void start({ ...message, cc: message.cc ?? [], bcc: message.bcc ?? [], attachments: message.attachments ?? [], signature: false })
  }

  function reset() {
    draft.value = emptyDraft()
    baseline.value = fingerprint(draft.value)
    version.value++
  }

  function discard() {
    const saved = draft.value.savedAs
    // Thrown out by mistake, it comes back with Undo (saved again on closing)
    const kept: Draft | undefined = isDirty.value || saved ? { ...JSON.parse(JSON.stringify(draft.value)), savedAs: undefined } : undefined
    reset()
    open.value = false
    if (saved) $fetch('/api/drafts', { method: 'DELETE', query: saved }).catch(() => {})
    if (kept) toast.add({ title: 'Draft discarded', icon: 'i-lucide-trash-2', actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => restore(kept) }] })
  }

  // Your words, then the signature, then the original
  function outgoingHtml(from = draft.value) {
    const { html, signature, quote } = from
    // Paragraphs sit line under line, as in every mail app; an empty one
    // keeps its height as a blank line in the recipient's client
    const body = html.replace(/<p><\/p>/g, '<p><br></p>').replace(/<p>/g, '<p style="margin:0">')
    const parts = [body]
    if (signature && settings.value.signature) parts.push(`<br><div class="citrusmail-signature">${settings.value.signature}</div>`)
    if (quote) parts.push(quote)
    return parts.join('')
  }

  function outgoing(from = draft.value): OutgoingMessage {
    return {
      to: from.to,
      cc: from.cc,
      bcc: from.bcc,
      subject: from.subject,
      html: outgoingHtml(from),
      attachments: from.attachments,
      inReplyTo: from.inReplyTo,
      references: from.references,
      // Only once Settings → Tracking is set up (see mail/receipt-toggle)
      readReceipt: (trackingReady(settings.value.receipts) && (from.readReceipt ?? settings.value.receipts?.default)) || undefined
    }
  }

  /**
   * Closing with changes keeps them: the message goes to Drafts and the
   * composer starts clean next time. Reopen brings it straight back
   */
  async function close() {
    open.value = false
    if (!isDirty.value) return reset()
    await putAway()
  }

  /** The draft goes to Drafts, with a toast to reopen it, and the composer starts clean */
  async function putAway() {
    const kept: Draft = JSON.parse(JSON.stringify(draft.value))
    reset()
    const reopenAction = { label: 'Reopen', color: 'neutral' as const, variant: 'outline' as const, onClick: () => restore(kept) }
    try {
      kept.savedAs = await $fetch<DraftRef>('/api/drafts', { method: 'POST', body: { ...outgoing(kept), replace: kept.savedAs } })
      toast.add({ title: 'Saved to Drafts', icon: 'i-lucide-file-pen-line', actions: [reopenAction] })
    } catch {
      toast.add({ title: 'Draft closed', description: 'It couldn’t be saved to Drafts.', icon: 'i-lucide-file-x', duration: 10_000, actions: [reopenAction] })
    }
  }

  function restore(kept: Draft) {
    draft.value = kept
    baseline.value = ''
    version.value++
    minimized.value = false
    open.value = true
  }

  async function send(sendAt?: Date) {
    if (!draft.value.to.length && !draft.value.cc.length && !draft.value.bcc.length) {
      toast.add({ title: 'Add someone to send this to', color: 'warning', icon: 'i-lucide-user-plus' })
      return
    }

    sending.value = true
    try {
      const result = await $fetch<{ scheduled?: ScheduledMessage }>('/api/send', {
        method: 'POST',
        body: { message: outgoing(), sendAt: sendAt?.toISOString(), draft: draft.value.savedAs }
      })
      reset()
      open.value = false
      if (result.scheduled) {
        await refreshScheduled()
        toast.add({ title: `Scheduled for ${scheduleLabel(result.scheduled.sendAt)}`, icon: 'i-lucide-clock-arrow-up', actions: [{ label: 'View', color: 'neutral', variant: 'outline', to: draftsLink.value }] })
      } else {
        toast.add({ title: 'Message sent', icon: 'i-lucide-send', color: 'success' })
      }
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: sendAt ? 'Message not scheduled' : 'Message not sent', description: message ?? 'Check your connection and try again.', color: 'error', icon: 'i-lucide-circle-alert' })
    } finally {
      sending.value = false
    }
  }

  async function attach(files: File[]) {
    const read = async (file: File): Promise<OutgoingAttachment> => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      content: await blobToBase64(file)
    })

    const added = await Promise.all(files.map(read))
    const size = [...draft.value.attachments, ...added].reduce((sum, file) => sum + file.content.length * 0.75, 0)
    if (size > 25 * 1024 * 1024) {
      toast.add({ title: 'Attachments are over 25 MB', description: 'Most mail servers refuse messages that large.', color: 'warning', icon: 'i-lucide-paperclip' })
      return
    }
    draft.value.attachments = [...draft.value.attachments, ...added]
  }

  function detach(index: number) {
    draft.value.attachments = draft.value.attachments.filter((_, i) => i !== index)
  }

  // An unsent message from last time is offered back, not thrown open: a
  // composer over the inbox is the wrong first thing to see on opening the app
  onNuxtReady(() => {
    if (!isDirty.value || open.value) return
    toast.add({
      title: 'You have an unsent message',
      description: draft.value.subject || undefined,
      icon: 'i-lucide-file-pen-line',
      duration: 10_000,
      actions: [{ label: 'Continue writing', color: 'neutral', variant: 'outline', onClick: () => {
        minimized.value = false
        open.value = true
      } }]
    })
  })

  defineKeys({
    c: () => compose(),
    meta_enter: {
      usingInput: true,
      handler: () => open.value && !sending.value && send()
    }
  })

  // Escape folds the composer down while you're in it: what you were writing
  // stays a click away. Large, it first goes back to its corner. A plain
  // listener, because a shortcut would cancel Escape for every menu in the
  // app; an open menu or suggestion list closes first
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open.value || event.defaultPrevented) return
    if (document.querySelector('[data-reka-popper-content-wrapper]:has([role="menu"], [role="listbox"], [role="dialog"])')) return
    if (!(document.activeElement as HTMLElement | null)?.closest('[data-composer-dock]')) return
    if (expanded.value) expanded.value = false
    else minimized.value = true
  })

  return { open, asking, minimized, expanded, sending, draft, version, isDirty, editor, focusBody, start, compose, reply, forward, editDraft, reopen, close, discard, send, attach, detach }
}

export const useComposer = createAppComposable(_useComposer)

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** "tomorrow at 8:00" or "Mon 12 Jan at 8:00" */
export function scheduleLabel(iso: string) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return `today at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`
}
