<template>
  <section class="card-panel card-groups-panel">
    <h2 class="panel-title">
      <span class="panel-icon">✦</span>
      {{ $t('cardGroups.title') }}
    </h2>
    <p class="panel-desc">{{ $t('cardGroups.desc') }}</p>
    <div class="card-groups-content">
      <div v-for="g in groups" :key="g.type" class="card-group-block">
        <div class="card-group-header" :style="{ borderLeftColor: g.color }">
          <span class="card-group-label">{{ g.label }}</span>
          <span class="card-group-desc">{{ g.description || '' }}</span>
        </div>
        <div class="card-group-cards">
          <div
            v-for="card in g.cards"
            :key="card.dbf_id"
            class="group-card"
            :class="'rarity-' + (card.rarity || 'FREE').toLowerCase()"
          >
            <span class="group-card-cost">{{ card.cost }}</span>
            <span class="group-card-name">{{ card.name }}</span>
            <span v-if="hasStats(card)" class="group-card-stats">
              {{ card.attack }}/{{ card.health || card.durability || '' }}
            </span>
            <span class="group-card-rarity">{{ card.rarity_name }}</span>
            <span v-if="g.type === 'sideboard' && card.owner_name" class="group-card-owner">
              ({{ locale === 'zh' ? '属' : 'owner' }}: {{ card.owner_name }})
            </span>
            <span v-else-if="!g.type.startsWith('sideboard') && g.copy_count > 1" class="group-card-count">
              x{{ g.copy_count }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ groups: Array, locale: String })

function hasStats(card) {
  return card.cardType === 'MINION' || card.cardType === 'WEAPON' ||
    (card.attack !== undefined && card.attack !== null)
}
</script>
