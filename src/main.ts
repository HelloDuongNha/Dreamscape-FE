import { createApp }      from 'vue'
import { createPinia }    from 'pinia'
import { i18n }           from './i18n'
import { useLocaleStore } from '@/store/useLocaleStore'

import App    from './App.vue'
import router from './router'

// Global styles (imports variables.css internally)
import './assets/styles/global.css'

const app   = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)

// Explicitly initialise locale store before router and mount.
// Passing the pinia instance is the official Pinia pattern for running a store
// outside a Vue component. This fires all locale side-effects
// (html lang, Accept-Language header) synchronously before any route resolves.
useLocaleStore(pinia).initialize()

app.use(router)
app.mount('#app')
