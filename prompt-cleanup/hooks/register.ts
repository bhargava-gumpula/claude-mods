import type { Register } from 'claude-code'

const SYSTEM = `You fix typos and misspellings in a message someone typed to a coding assistant.
Change only misspelled words and obvious typos. Keep everything else exactly: wording, grammar,
slang, casing style, punctuation, line breaks, technical terms, code, identifiers, file paths,
URLs, commands and numbers. Never answer, rephrase or add anything.
Reply with the corrected message only. If nothing needs fixing, reply with it unchanged.`

// Typed by a person, short enough to be prose, and not a command, shell line or code.
export const shouldClean = (text: string) =>
  text.trim().length >= 3 &&
  text.length <= 1500 &&
  !/^\s*[/!#]/.test(text) &&
  !text.includes('```')

// A typo fix keeps the length close; anything else means the model did more than fix typos.
export const isTypoFix = (before: string, after: string) =>
  after.length > 0 && Math.abs(after.length - before.length) <= Math.max(6, before.length * 0.15)

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const isTyped = ['composer', 'bridge', 'sdk'].includes(e.origin.kind)
    if (!isTyped || !shouldClean(e.text)) return next(e)

    const r = await $.model
      .complete({ model: 'haiku', system: SYSTEM, prompt: e.text, effort: 'low', timeoutMs: 4000, maxTokens: 1024 })
      .catch(() => undefined)
    const fixed = r?.isAnswered ? r.text.trim() : ''
    if (!isTypoFix(e.text, fixed) || fixed === e.text.trim()) return next(e)

    $.ui.toast('Fixed typos in your prompt')
    return next({ ...e, text: fixed })
  })
}
