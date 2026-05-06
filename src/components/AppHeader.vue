<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-icon">
        <img :src="logoUrl" alt="TESS" class="header-logo" />
      </div>
      <div class="header-text">
        <h1 class="header-title">TESS | {{ appName }}</h1>
        <p v-if="locale === 'zh'" class="header-subtitle">{{ t('app.nameEn') }}</p>
        <p v-else class="header-subtitle">{{ t('header.subtitle') }}</p>
        <button class="lang-toggle" @click="$emit('toggleLocale')" :title="locale === 'zh' ? 'Switch to English' : '切换到中文'">
          <span class="lang-icon">🌐</span>
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
defineEmits(['toggleLocale'])

const appName = computed(() => t('app.name'))
const logoUrl = computed(() => import.meta.env.BASE_URL + 'TESS.png')
</script>
