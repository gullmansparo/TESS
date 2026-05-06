<template>
  <section class="card-panel deck-overview">
    <div class="overview-header">
      <h2 class="panel-title">
        <span class="panel-icon">✦</span>
        {{ $t('overview.title') }}
      </h2>
    </div>
    <div class="overview-stats">
      <div class="stat">
        <div class="stat-body">
          <span class="stat-value">{{ result.card_count || 0 }}</span>
          <span class="stat-label">{{ $t('overview.totalCards') }}</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat-body">
          <span class="stat-value">{{ result.format_name || '-' }}</span>
          <span class="stat-label">{{ $t('overview.format') }}</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat-body">
          <span class="stat-value">v{{ result.version ?? '-' }}</span>
          <span class="stat-label">{{ $t('overview.version') }}</span>
        </div>
      </div>
      <div class="stat hero-stat">
        <div class="stat-body hero-stat-body">
          <div v-if="hero" class="hero-info-compact">
            <div class="hero-portrait-frame">
              <img
                :src="hero.image_url"
                :alt="hero.name"
                class="hero-portrait"
                @error="onHeroImgError"
              />
            </div>
            <div class="hero-text">
              <span class="hero-name-cn">{{ hero.name }}</span>
              <span v-if="locale === 'zh' && hero.name_en" class="hero-name-en">{{ hero.name_en }}</span>
              <span class="hero-class">{{ hero.class_name }}</span>
            </div>
          </div>
          <div v-else class="hero-info-compact">
            <span class="hero-name-cn">-</span>
          </div>
          <span class="stat-label">{{ $t('overview.hero') }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ result: Object, locale: String })

const hero = computed(() => {
  if (props.result.heroes && props.result.heroes.length > 0) {
    return props.result.heroes[0]
  }
  return null
})

function onHeroImgError(e) {
  if (hero.value && hero.value.image_backup) {
    if (e.target.src !== hero.value.image_backup) {
      e.target.src = hero.value.image_backup
    }
  }
}
</script>
