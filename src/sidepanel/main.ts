// Side Panel entry point.
//
// Same Vue app as the options page (App.vue + Pinia + Antd + theme.css).
// The two contexts share IndexedDB and localStorage so collection /
// environment / settings data is consistent across them. Live state
// (e.g. "active capture") is relayed via chrome.runtime messages.

import { createApp } from 'vue'
import { createPinia, getActivePinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import '../options/theme.css'
import App from '../options/App.vue'
import { useSettingsStore, applyTheme } from '@/stores/settings'

const app = createApp(App)
app.use(createPinia())
app.use(Antd)
app.mount('#app')

// Match the persisted theme on first paint so the side panel doesn't
// flash-bang the user with the wrong palette.
const settings = useSettingsStore()
applyTheme(settings.theme)

// Dev-only: expose Pinia for e2e tests.
if (import.meta.env.DEV) {
  ;(window as any).__pinia = getActivePinia()
}
