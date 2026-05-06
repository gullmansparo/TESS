<template>
  <section class="card-panel card-gallery">
    <h2 class="panel-title">
      <span class="panel-icon">✦</span>
      {{ $t('cardGallery.title') }}
    </h2>

    <!-- Toolbar -->
    <div class="gallery-toolbar">
      <div class="filter-group">
        <select v-model="costFilter" @change="applyFilters">
          <option value="all">{{ $t('cardGallery.allCosts') }}</option>
          <option v-for="i in 10" :key="i" :value="i">{{ i === 10 ? '10+' : i + $t('cardGallery.costCurve').charAt(0) }}</option>
        </select>
        <select v-model="rarityFilter" @change="applyFilters">
          <option value="all">{{ $t('cardGallery.allRarities') }}</option>
          <option value="FREE">{{ $t('rarity.FREE') }}</option>
          <option value="COMMON">{{ $t('rarity.COMMON') }}</option>
          <option value="RARE">{{ $t('rarity.RARE') }}</option>
          <option value="EPIC">{{ $t('rarity.EPIC') }}</option>
          <option value="LEGENDARY">{{ $t('rarity.LEGENDARY') }}</option>
        </select>
      </div>
      <div class="cost-curve-toggle">
        <button class="btn btn-small" @click="showCurve = !showCurve">
          {{ showCurve ? $t('cardGallery.hideCurve') : $t('cardGallery.costCurve') }}
        </button>
      </div>
    </div>

    <!-- Cost Curve -->
    <div v-if="showCurve" class="cost-curve">
      <div class="curve-title">{{ $t('cardGallery.costCurve') }}</div>
      <div class="curve-chart">
        <div class="curve-bars-area">
          <div v-for="c in curveData" :key="c.cost" class="curve-bar-col">
            <div class="curve-bar-spacer"></div>
            <div
              class="curve-bar"
              :style="{ height: Math.max(c.pct, 3) + '%' }"
              :title="(c.cost === 10 ? '10+' : c.cost) + ' ' + $t('cardGallery.costCurve').charAt(0) + ': ' + c.count + ' 张'"
            >
              <span class="curve-count">{{ c.count > 0 ? c.count : '' }}</span>
            </div>
            <div class="curve-label">{{ c.cost === 10 ? '10+' : c.cost }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Card Grid -->
    <div class="card-grid">
      <div
        v-for="card in filteredCards"
        :key="card.dbf_id + '_' + (card.sideboard ? 1 : 0)"
        class="hs-card"
        :class="'rarity-' + (card.rarity || 'FREE').toLowerCase()"
        :data-cost="card.cost"
        :data-rarity="card.rarity"
      >
        <div class="card-img-wrapper">
          <img
            :src="card.image_url"
            :alt="card.name"
            class="card-img"
            loading="lazy"
            @error="onCardImgError($event, card)"
          />
          <div class="card-count-badge">x{{ card.count }}</div>
        </div>
        <div class="card-footer">
          <div class="card-upper">
            <span class="card-cost-diamond">{{ card.cost }}</span>
            <span class="card-name" :title="card.name">{{ card.name }}</span>
          </div>
          <div class="card-lower">
            <span v-if="hasStats(card)" class="cstat">
              <span class="cstat-val cstat-atk">{{ card.attack }}</span>
              <span class="cstat-sep">|</span>
              <span class="cstat-val cstat-hp">{{ card.health || card.durability || '' }}</span>
            </span>
            <span class="cstat-rarity">{{ card.rarity_name }}</span>
          </div>
        </div>
      </div>
      <div v-if="filteredCards.length === 0" class="empty-state">
        {{ $t('cardGallery.noMatch') }}
      </div>
    </div>

    <!-- Sideboard Section -->
    <div v-if="sideboardCards.length > 0" style="margin-top:16px">
      <h3 class="panel-title" style="font-size:16px;margin-bottom:12px">
        <span class="panel-icon">✦</span>
        {{ $t('cardGallery.sideboard') }}
      </h3>
      <div class="card-grid">
        <div
          v-for="card in sideboardCards"
          :key="card.dbf_id + '_sb'"
          class="hs-card"
          :class="'rarity-' + (card.rarity || 'FREE').toLowerCase()"
        >
          <div class="card-img-wrapper">
            <img
              :src="card.image_url"
              :alt="card.name"
              class="card-img"
              loading="lazy"
              @error="onCardImgError($event, card)"
            />
            <div class="card-count-badge">x{{ card.count }}</div>
          </div>
          <div class="card-footer">
            <div class="card-upper">
              <span class="card-cost-diamond">{{ card.cost }}</span>
              <span class="card-name" :title="card.name">{{ card.name }}</span>
            </div>
            <div class="card-lower">
              <span v-if="hasStats(card)" class="cstat">
                <span class="cstat-val cstat-atk">{{ card.attack }}</span>
                <span class="cstat-sep">|</span>
                <span class="cstat-val cstat-hp">{{ card.health || card.durability || '' }}</span>
              </span>
              <span class="cstat-rarity">{{ card.rarity_name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({ result: Object, locale: String })

const costFilter = ref('all')
const rarityFilter = ref('all')
const showCurve = ref(false)

const mainCards = computed(() => {
  const sideboard = (props.result.cards || []).filter(c => c.sideboard)
  const sbIds = new Set(sideboard.map(c => c.dbf_id))
  return (props.result.cards || []).filter(c => !c.sideboard && !sbIds.has(c.dbf_id))
})

const sideboardCards = computed(() =>
  (props.result.cards || []).filter(c => c.sideboard)
)

const filteredCards = ref([])

const curveData = computed(() => {
  const costMap = Array(11).fill(0)
  for (const c of mainCards.value) {
    const ci = Math.min(c.cost || 0, 10)
    costMap[ci] += c.count || 1
  }
  const maxCount = Math.max(...costMap, 1)
  return costMap.map((count, cost) => ({
    cost, count,
    pct: (count / maxCount) * 100,
  }))
})

function applyFilters() {
  let filtered = mainCards.value
  if (costFilter.value !== 'all') {
    const costVal = parseInt(costFilter.value)
    if (costVal === 10) {
      filtered = filtered.filter(c => (c.cost || 0) >= 10)
    } else {
      filtered = filtered.filter(c => c.cost === costVal)
    }
  }
  if (rarityFilter.value !== 'all') {
    filtered = filtered.filter(c => c.rarity === rarityFilter.value)
  }
  filteredCards.value = filtered
}

// Initialize
applyFilters()

// Re-apply filters when result changes (e.g. after locale switch)
watch(() => props.result, () => applyFilters())

function hasStats(card) {
  return card.cardType === 'MINION' || card.cardType === 'WEAPON' ||
    (card.attack !== undefined && card.attack !== null)
}

function onCardImgError(e, card) {
  if (card.image_backup && e.target.src !== card.image_backup) {
    e.target.src = card.image_backup
  }
}
</script>
