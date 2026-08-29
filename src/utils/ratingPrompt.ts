// One-time rating prompt: after a user has successfully sent N requests,
// show a single non-blocking prompt linking to the CWS review page.
// Everything is stored in localStorage; the prompt is never shown twice
// (CWS policy: prompts must be optional and dismissible).
import { Modal } from 'ant-design-vue'
import { createVNode } from 'vue'
import { HeartFilled } from '@ant-design/icons-vue'
import { useI18n } from '@/i18n/useI18n'

const COUNT_KEY = 'mp2:sendSuccessCount'
const SHOWN_KEY = 'mp2:ratingPromptShown'
const PROMPT_AFTER_SENDS = 15

export function getSuccessCount(): number {
  return Number(localStorage.getItem(COUNT_KEY) ?? 0) || 0
}

export function shouldAskForRating(): boolean {
  if (localStorage.getItem(SHOWN_KEY)) return false
  return getSuccessCount() >= PROMPT_AFTER_SENDS
}

export function recordSuccessfulSend(): void {
  try {
    localStorage.setItem(COUNT_KEY, String(getSuccessCount() + 1))
  } catch { /* storage unavailable — skip counting */ }
}

// The extension's CWS review page. The item id is stable across updates.
export const REVIEW_URL =
  'https://chromewebstore.google.com/detail/nckjedkhineddehjkdlgaibfgpacmhcl/reviews'

export function showRatingPromptIfDue(): void {
  if (!shouldAskForRating()) return
  try {
    localStorage.setItem(SHOWN_KEY, '1')
  } catch { /* if storage fails, don't risk re-prompting */ }
  const { t } = useI18n()
  Modal.confirm({
    title: t.value.ratingPromptTitle,
    icon: createVNode(HeartFilled, { style: { color: '#e5484d' } }),
    content: t.value.ratingPromptContent,
    okText: t.value.ratingPromptGo,
    cancelText: t.value.ratingPromptLater,
    onOk: () => {
      window.open(REVIEW_URL, '_blank', 'noopener')
    }
  })
}
