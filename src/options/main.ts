import { createApp } from 'vue'
import { createPinia, getActivePinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './theme.css'
import App from './App.vue'
import { useSettingsStore, applyTheme } from '@/stores/settings'

const app = createApp(App)
app.use(createPinia())
app.use(Antd)
app.mount('#app')

// Apply the persisted theme as early as possible so first paint matches
// what the user picked last session.
const settings = useSettingsStore()
applyTheme(settings.theme)

// Expose Pinia so e2e tests can drive store state without bouncing through
// the UI. Available in all builds — the dist/ build is production-optimised
// but has no devtools hooks, so tests need this handle to seed state.
;(window as any).__pinia = getActivePinia()

// Also expose the OpenAPI export function for direct test access.
// (exportOpenApi is used by the ExportModal's computed preview.)
import { exportOpenApi } from '@/core/openapi/export'
;(window as any).__exportOpenApi = exportOpenApi