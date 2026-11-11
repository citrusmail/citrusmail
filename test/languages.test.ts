import { describe, expect, it } from 'vitest'
import { detectLanguage, writtenPart } from '../shared/utils/languages'

const spanish = 'Hola equipo, les comparto la propuesta para el proyecto. Por favor revisen las dos opciones y me dicen cual prefieren para la reunion del martes. Gracias!'

describe('the language of a message', () => {
  it('goes by what the sender wrote, not the message quoted under a reply', () => {
    const reply = `Sounds good to me, let us go with option B.\n\nOn Tue, Nov 10, 2026 at 9:00 AM Ana <ana@example.com> wrote:\n> ${spanish}`
    expect(detectLanguage(reply)).toBe('es')
    expect(detectLanguage(writtenPart(reply))).not.toBe('es')
  })

  it('drops "> " lines, forwarded headers and Outlook-style quotes', () => {
    expect(writtenPart(`Thanks!\n> ${spanish}`)).toBe('Thanks!')
    expect(writtenPart(`FYI\n---------- Forwarded message ---------\n${spanish}`)).toBe('FYI')
    expect(writtenPart(`See below.\nFrom: Ana\nSent: Tuesday\n${spanish}`)).toBe('See below.')
  })

  it('leaves out links and addresses', () => {
    expect(writtenPart('Read it at https://example.com/es/que-para-con and write to ana@example.es').trim()).toBe('Read it at   and write to')
  })

  it('still finds a message written in another language', () => {
    expect(detectLanguage(writtenPart(spanish))).toBe('es')
    expect(detectLanguage(writtenPart('Bonjour, merci pour votre message. Nous vous répondrons dans les plus brefs délais.'))).toBe('fr')
  })
})
