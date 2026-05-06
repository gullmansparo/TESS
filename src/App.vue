<template>
  <div class="app-root">
    <div class="hearthstone-bg"></div>

    <AppHeader
      :locale="locale"
      @toggle-locale="toggleLocale"
    />

    <main class="main-container">
      <DeckInput
        :locale="locale"
        :loading="parsing"
        @parse="handleParse"
        @clear="handleClear"
      />

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div v-if="result" id="resultSection">
        <DeckOverview
          :result="result"
          :locale="locale"
        />

        <CodeAnnotation
          :result="result"
          :locale="locale"
        />

        <CardGroups
          v-if="result.card_groups && result.card_groups.length"
          :groups="result.card_groups"
          :locale="locale"
        />

        <CardGallery
          :result="result"
          :locale="locale"
        />
      </div>
    </main>

    <footer class="footer">
      <p>
        {{ locale === 'zh' ? '数据来源' : 'Data source' }}:
        <a href="https://hearthstonejson.com" target="_blank">HearthstoneJSON</a>
        | {{ locale === 'zh' ? '原画' : 'Art' }}: Blizzard Entertainment
      </p>
      <p>{{ locale === 'zh' ? '本应用与暴雪娱乐无关，仅供学习交流使用' : 'This app is not affiliated with Blizzard Entertainment. For educational use only.' }}</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import DeckInput from './components/DeckInput.vue'
import { useI18n } from 'vue-i18n'
import DeckOverview from './components/DeckOverview.vue'
import CodeAnnotation from './components/CodeAnnotation.vue'
import CardGroups from './components/CardGroups.vue'
import CardGallery from './components/CardGallery.vue'
import { parseDeckCode, generateCharMap } from './parser/deck-parser.js'
import { initCardDB, enrichParseResult, isLoaded } from './db/card-db.js'

const { locale } = useI18n()
const parsing = ref(false)
const errorMsg = ref('')
const result = ref(null)

// Persist locale changes — re-fetch cards for new locale & re-parse
watch(locale, async (val) => {
  localStorage.setItem('tess-lang', val)
  document.documentElement.lang = val === 'en' ? 'en-US' : 'zh-CN'
  updateTitle()
  if (result.value) {
    await initCardDB(val)
    reparseWithLocale()
  }
})

function updateTitle() {
  if (locale.value === 'zh') {
    document.title = 'TESS | 卡组代码解析器'
  } else {
    document.title = 'TESS | Hearthstone Deck String Tessellator'
  }
}
updateTitle()

function toggleLocale() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

async function ensureDB() {
  return initCardDB(locale.value).catch(err => {
    errorMsg.value = (locale.value === 'zh' ? '卡牌数据库加载失败：' : 'Card DB load failed: ') + err.message
  })
}

async function handleParse(code) {
  errorMsg.value = ''
  parsing.value = true

  // Parse in next tick so UI updates
  await new Promise(r => setTimeout(r, 10))

  // Ensure card DB is ready
  await ensureDB()

  // Parse deck code
  const parseResult = parseDeckCode(code, locale.value)
  if (parseResult.error) {
    errorMsg.value = parseResult.error
    parsing.value = false
    return
  }

  // Generate char map for code annotation
  const withCharMap = generateCharMap(parseResult)

  // Enrich with card data
  enrichParseResult(withCharMap, locale.value)

  result.value = withCharMap
  parsing.value = false

  // Scroll to results
  setTimeout(() => {
    document.getElementById('resultSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

async function reparseWithLocale() {
  if (!result.value) return
  // Re-parse with new locale for labels
  const parseResult = parseDeckCode(result.value.code, locale.value)
  if (parseResult.error) return
  const withCharMap = generateCharMap(parseResult)
  enrichParseResult(withCharMap, locale.value)
  result.value = withCharMap
}

function handleClear() {
  result.value = null
  errorMsg.value = ''
}
</script>

<style>
@import './styles/main.css';
</style>
