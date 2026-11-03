/** Languages CitrusMail translates between, by ISO 639-1 code */
export const LANGUAGES: Record<string, { name: string, native: string }> = {
  en: { name: 'English', native: 'English' },
  es: { name: 'Spanish', native: 'Español' },
  fr: { name: 'French', native: 'Français' },
  de: { name: 'German', native: 'Deutsch' },
  it: { name: 'Italian', native: 'Italiano' },
  pt: { name: 'Portuguese', native: 'Português' },
  nl: { name: 'Dutch', native: 'Nederlands' },
  sv: { name: 'Swedish', native: 'Svenska' },
  da: { name: 'Danish', native: 'Dansk' },
  no: { name: 'Norwegian', native: 'Norsk' },
  fi: { name: 'Finnish', native: 'Suomi' },
  pl: { name: 'Polish', native: 'Polski' },
  cs: { name: 'Czech', native: 'Čeština' },
  ro: { name: 'Romanian', native: 'Română' },
  hu: { name: 'Hungarian', native: 'Magyar' },
  tr: { name: 'Turkish', native: 'Türkçe' },
  ru: { name: 'Russian', native: 'Русский' },
  uk: { name: 'Ukrainian', native: 'Українська' },
  el: { name: 'Greek', native: 'Ελληνικά' },
  ar: { name: 'Arabic', native: 'العربية' },
  he: { name: 'Hebrew', native: 'עברית' },
  hi: { name: 'Hindi', native: 'हिन्दी' },
  th: { name: 'Thai', native: 'ไทย' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
  ja: { name: 'Japanese', native: '日本語' },
  ko: { name: 'Korean', native: '한국어' },
  zh: { name: 'Chinese', native: '中文' }
}

export const languageName = (code?: string) => (code && LANGUAGES[code]?.name) || code?.toUpperCase() || 'another language'

// The commonest short words of each language written in Latin letters. A
// message is called one of these only when it clearly leads the others
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'you', 'that', 'for', 'with', 'this', 'are', 'have', 'your', 'will', 'not', 'from', 'please', 'thanks'],
  es: ['que', 'los', 'las', 'por', 'para', 'con', 'una', 'del', 'gracias', 'está', 'usted', 'como', 'pero', 'muy', 'hola'],
  fr: ['les', 'des', 'est', 'pour', 'que', 'une', 'vous', 'avec', 'dans', 'pas', 'nous', 'sur', 'merci', 'bonjour', 'votre'],
  de: ['und', 'die', 'der', 'das', 'ist', 'nicht', 'sie', 'mit', 'für', 'auf', 'ich', 'wir', 'ihr', 'bitte', 'danke'],
  it: ['che', 'per', 'non', 'una', 'sono', 'della', 'con', 'grazie', 'questo', 'gli', 'anche', 'buongiorno', 'ciao', 'molto', 'del'],
  pt: ['que', 'não', 'para', 'com', 'uma', 'você', 'obrigado', 'obrigada', 'está', 'mas', 'como', 'dos', 'das', 'olá', 'muito'],
  nl: ['het', 'een', 'van', 'en', 'niet', 'met', 'voor', 'zijn', 'dat', 'wij', 'jij', 'bedankt', 'graag', 'ook', 'maar'],
  sv: ['och', 'att', 'det', 'som', 'för', 'med', 'inte', 'är', 'jag', 'har', 'tack', 'hej', 'på', 'vi', 'till'],
  da: ['og', 'at', 'det', 'er', 'ikke', 'med', 'for', 'jeg', 'har', 'til', 'tak', 'hej', 'på', 'vi', 'som'],
  no: ['og', 'at', 'det', 'er', 'ikke', 'med', 'for', 'jeg', 'har', 'til', 'takk', 'hei', 'på', 'vi', 'som'],
  fi: ['ja', 'on', 'ei', 'että', 'se', 'kiitos', 'hei', 'olen', 'tämä', 'myös', 'mutta', 'kun', 'voit', 'sinun', 'meidän'],
  pl: ['nie', 'się', 'jest', 'że', 'na', 'do', 'dla', 'jak', 'dziękuję', 'proszę', 'ale', 'też', 'czy', 'jestem', 'od'],
  cs: ['je', 'se', 'na', 'že', 'to', 'pro', 'jsem', 'děkuji', 'prosím', 'ale', 'jak', 'také', 'není', 'jsou', 'od'],
  ro: ['și', 'că', 'este', 'pentru', 'nu', 'cu', 'mulțumesc', 'vă', 'sunt', 'din', 'dar', 'una', 'acest', 'bună', 'care'],
  hu: ['és', 'hogy', 'nem', 'az', 'egy', 'van', 'köszönöm', 'kérem', 'meg', 'is', 'de', 'ez', 'vagy', 'már', 'csak'],
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'değil', 'teşekkürler', 'merhaba', 'çok', 'ama', 'gibi', 'daha', 'olarak', 'size', 'sizin'],
  vi: ['và', 'của', 'là', 'không', 'có', 'được', 'cho', 'với', 'cảm', 'ơn', 'bạn', 'chúng', 'tôi', 'này', 'những'],
  id: ['dan', 'yang', 'untuk', 'dengan', 'tidak', 'ini', 'itu', 'kami', 'anda', 'terima', 'kasih', 'dari', 'akan', 'ada', 'saya']
}

/**
 * The language a text is most likely in, or undefined when it can't tell.
 * Scripts decide at once; Latin-script languages go by their common words
 */
export function detectLanguage(text: string): string | undefined {
  const sample = text.slice(0, 4000)
  const count = (re: RegExp) => sample.match(re)?.length ?? 0
  const letters = Math.max(1, count(/\p{L}/gu))
  const scripts: [string, RegExp][] = [
    ['ko', /\p{Script=Hangul}/gu],
    ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/gu],
    ['zh', /\p{Script=Han}/gu],
    ['el', /\p{Script=Greek}/gu],
    ['ar', /\p{Script=Arabic}/gu],
    ['he', /\p{Script=Hebrew}/gu],
    ['hi', /\p{Script=Devanagari}/gu],
    ['th', /\p{Script=Thai}/gu]
  ]
  for (const [code, re] of scripts) if (count(re) / letters > 0.2) return code
  if (count(/\p{Script=Cyrillic}/gu) / letters > 0.3) return /[ієїґ]/i.test(sample) ? 'uk' : 'ru'

  const words = sample.toLowerCase().match(/\p{L}+/gu)?.slice(0, 600) ?? []
  if (words.length < 4) return undefined
  const scores = Object.entries(STOPWORDS).map(([code, list]) => {
    const set = new Set(list)
    return [code, words.filter(word => set.has(word)).length] as const
  }).sort((a, b) => b[1] - a[1])
  const [best, second] = scores
  if (!best || best[1] < 3 || best[1] < (second?.[1] ?? 0) * 1.5) return undefined
  return best[0]
}
