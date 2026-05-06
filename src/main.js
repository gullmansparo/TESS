import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import zh from './i18n/zh.js'
import en from './i18n/en.js'

const savedLang = localStorage.getItem('tess-lang') || 'zh'
const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'zh',
  messages: { zh, en },
})

createApp(App).use(i18n).mount('#app')
