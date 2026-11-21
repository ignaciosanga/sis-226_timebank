export const MAX_HISTORY_TURNS = 6
export const MAX_QUESTION_LENGTH = 500

export function historyFor(messages) {
  return messages
    .filter((message) => !message.error && message.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map(({ role, text }) => ({ role, content: text.trim().slice(0, 1200) }))
}

export function canAsk(text, pending) {
  const question = text.trim()
  return !pending && question.length > 0 && question.length <= MAX_QUESTION_LENGTH
}
