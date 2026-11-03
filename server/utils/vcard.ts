import ICAL from 'ical.js'

// Pure vCard <-> Contact conversion, no request context

type Component = ICAL.Component

export type ContactFields = Omit<Contact, 'id' | 'bookId'>

function parseCard(data: string): Component {
  const parsed = ICAL.parse(data)
  // A file holding several cards parses to a list; the first one is the contact
  const jcard = Array.isArray(parsed[0]) ? parsed[0] : parsed

  return new ICAL.Component(jcard)
}

function text(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(text).filter(Boolean).join(' ')
  }

  return value == null ? '' : String(value).trim()
}

function values(card: Component, name: string): string[] {
  return card.getAllProperties(name).map(property => text(property.getFirstValue())).filter(Boolean)
}

function first(card: Component, name: string): string | undefined {
  return values(card, name)[0] || undefined
}

const stripScheme = (value: string, scheme: string) => value.replace(new RegExp(`^${scheme}:`, 'i'), '')

function normalizeBirthday(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`
  }

  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value
}

function structuredName(card: Component): string {
  const value = card.getFirstPropertyValue('n')
  const parts = Array.isArray(value) ? value.map(text) : text(value).split(';')
  const [family = '', given = '', additional = '', prefix = '', suffix = ''] = parts

  return [prefix, given, additional, family, suffix].filter(Boolean).join(' ')
}

export function vcardToContact(data: string, id: string, bookId: string): Contact {
  const card = parseCard(data)
  const emails = values(card, 'email').map(email => stripScheme(email, 'mailto'))
  const org = card.getFirstPropertyValue('org')

  return {
    id,
    bookId,
    name: first(card, 'fn') || structuredName(card) || emails[0] || 'Unnamed',
    emails,
    phones: values(card, 'tel').map(phone => stripScheme(phone, 'tel')),
    company: (Array.isArray(org) ? text(org[0]) : text(org)) || undefined,
    title: first(card, 'title'),
    note: first(card, 'note'),
    birthday: normalizeBirthday(first(card, 'bday'))
  }
}

// "Ada King Lovelace" -> family "Lovelace", given "Ada King"
function nameParts(name: string): string[] {
  const words = name.trim().split(/\s+/)
  const family = words.length > 1 ? words.pop()! : ''

  return [family, words.join(' '), '', '', '']
}

function setOptional(card: Component, name: string, value: string | undefined) {
  if (value) {
    card.updatePropertyWithValue(name, value)
  } else {
    card.removeAllProperties(name)
  }
}

function setStructured(card: Component, name: string, value: string[]) {
  card.removeAllProperties(name)
  const property = new ICAL.Property(name, card)
  property.setValue(value)
  card.addProperty(property)
}

// Keeps the properties (and their TYPE labels) whose value survives, drops
// the rest, then appends the new ones
function syncList(card: Component, name: string, wanted: string[], scheme: string, type?: string) {
  const remaining = new Set(wanted.map(value => value.trim()).filter(Boolean))

  for (const property of card.getAllProperties(name)) {
    const value = stripScheme(text(property.getFirstValue()), scheme)
    if (remaining.has(value)) {
      remaining.delete(value)
    } else {
      card.removeProperty(property)
    }
  }

  for (const value of remaining) {
    const property = card.addPropertyWithValue(name, value)
    if (type) {
      property.setParameter('type', type)
    }
  }
}

function setBirthday(card: Component, birthday: string | undefined) {
  card.removeAllProperties('bday')
  if (birthday) {
    // A full date as a date; anything partial (`--05-12`) as text
    const type = /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? 'date' : 'text'
    card.addProperty(new ICAL.Property(['bday', {}, type, birthday], card))
  }
}

function applyFields(card: Component, contact: ContactFields, previous?: Contact) {
  if (!previous || previous.name !== contact.name || !card.hasProperty('fn') || !card.hasProperty('n')) {
    card.updatePropertyWithValue('fn', contact.name)
    setStructured(card, 'n', nameParts(contact.name))
  }
  syncList(card, 'email', contact.emails, 'mailto', 'INTERNET')
  syncList(card, 'tel', contact.phones, 'tel')
  if (!previous || previous.company !== contact.company) {
    if (contact.company) {
      setStructured(card, 'org', [contact.company])
    } else {
      card.removeAllProperties('org')
    }
  }
  setOptional(card, 'title', contact.title)
  setOptional(card, 'note', contact.note)
  if (!previous || previous.birthday !== contact.birthday) {
    setBirthday(card, contact.birthday)
  }
}

function stamp(card: Component) {
  card.updatePropertyWithValue('rev', new Date().toISOString().replace(/\.\d{3}/, ''))
}

export function contactToVcard(contact: ContactFields, uid: string): string {
  const card = new ICAL.Component('vcard')
  card.updatePropertyWithValue('version', '3.0')
  card.updatePropertyWithValue('prodid', '-//Letterbox//EN')
  card.updatePropertyWithValue('uid', uid)
  applyFields(card, contact)
  stamp(card)

  return card.toString()
}

/** Rewrites only the fields Contact manages; PHOTO, ADR, URL... stay */
export function patchVcard(data: string, contact: ContactFields): string {
  const card = parseCard(data)
  applyFields(card, contact, vcardToContact(data, '', ''))
  stamp(card)

  return card.toString()
}
