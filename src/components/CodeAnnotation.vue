<template>
  <section class="card-panel code-annotation">
    <h2 class="panel-title">
      <span class="panel-icon">✦</span>
      {{ $t('codeAnnotation.title') }}
    </h2>
    <p class="panel-desc">{{ $t('codeAnnotation.desc') }}</p>

    <!-- Colored code display -->
    <div class="code-display">
      <div class="annotated-code" v-html="annotatedHtml"></div>
    </div>

    <!-- Legend -->
    <div class="section-legend">
      <div class="legend-title">{{ $t('codeAnnotation.legend') }}</div>
      <div class="legend-items">
        <div
          v-for="sec in legendSections"
          :key="sec.type"
          class="legend-item"
        >
          <span class="legend-color" :style="{ background: sec.color }"></span>
          <span class="legend-label">{{ sec.label }}</span>
          <span class="legend-desc">{{ sec.description || '' }}</span>
        </div>
      </div>
    </div>

    <!-- Varint Stream -->
    <details class="raw-details">
      <summary>{{ $t('codeAnnotation.varintStream') }}</summary>
      <div class="varint-stream">
        <div class="varint-tags">
          <span
            v-for="(entry, i) in result.varint_stream"
            :key="i"
            class="varint-tag"
            :class="{ 'varint-tag-card': entry.card_name && entry.card_image }"
            :style="{ background: entry.color + '44', borderLeftColor: entry.color }"
            :title="entry.card_name ? entry.card_name + ' (' + entry.card_cost + $t('cardGallery.costCurve').charAt(0) + ')' : ''"
            @mouseenter="showTooltip($event, entry)"
            @mousemove="moveTooltip($event)"
            @mouseleave="hideTooltip"
          >
            <span class="varint-value">{{ entry.value }}</span>
            <span class="varint-label">{{ entry.label }}</span>
            <span class="varint-chars">chars [{{ entry.char_range[0] }},{{ entry.char_range[1] }})</span>
            <span v-if="entry.card_name" class="varint-card-name">{{ entry.card_name }}</span>
          </span>
        </div>
      </div>
    </details>

    <!-- Raw Data -->
    <details class="raw-details">
      <summary>{{ $t('codeAnnotation.rawData') }}</summary>
      <div class="raw-data">
        <div v-for="sec in result.sections" :key="sec.type" class="raw-row">
          <span class="raw-color" :style="{ background: sec.color }"></span>
          <span class="raw-label">{{ sec.label }}</span>
          <span class="raw-bytes">bytes [{{ sec.byte_range[0] }},{{ sec.byte_range[1] }})</span>
          <span class="raw-bytes">chars [{{ sec.char_range[0] }},{{ sec.char_range[1] }})</span>
          <span class="raw-values">{{ formatValues(sec.values) }}</span>
        </div>
      </div>
    </details>

    <!-- Floating tooltip -->
    <Teleport to="body">
      <div ref="tooltipEl" class="varint-tooltip" style="display:none">
        <img ref="tooltipImg" class="varint-tooltip-img" src="" alt="" />
        <div ref="tooltipName" class="varint-tooltip-name"></div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'

const props = defineProps({ result: Object, locale: String })

const tooltipEl = ref(null)
const tooltipImg = ref(null)
const tooltipName = ref(null)

const legendSections = computed(() =>
  (props.result.sections || []).filter(s => {
    const cr = s.char_range || [0, 0]
    return cr[0] < cr[1]
  })
)

const annotatedHtml = computed(() => {
  const code = props.result.code
  const charColors = props.result.char_colors || []
  const charLabels = props.result.char_labels || []

  if (!charColors.length) return code

  let html = ''
  let currentColor = null
  let segment = ''

  for (let i = 0; i < code.length; i++) {
    const color = charColors[i] || null
    const label = charLabels[i] || ''

    if (color !== currentColor) {
      if (segment) {
        const style = currentColor
          ? ` style="background-color:${currentColor}33;border-bottom:2px solid ${currentColor}"`
          : ''
        const title = currentColor ? ` title="${escapeHtml(label)}"` : ''
        html += `<span class="code-segment"${style}${title}>${escapeHtml(segment)}</span>`
      }
      segment = code[i]
      currentColor = color
    } else {
      segment += code[i]
    }
  }
  if (segment) {
    const style = currentColor
      ? ` style="background-color:${currentColor}33;border-bottom:2px solid ${currentColor}"`
      : ''
    const title = currentColor ? ` title="${escapeHtml(currentColor)}"` : ''
    html += `<span class="code-segment"${style}${title}>${escapeHtml(segment)}</span>`
  }
  return html
})

function showTooltip(e, entry) {
  if (!entry.card_name || !entry.card_image) return
  const el = tooltipEl.value
  const img = tooltipImg.value
  const name = tooltipName.value
  if (!el || !img) return

  name.textContent = entry.card_name
  el.style.display = 'block'

  img.onload = () => { img.style.display = 'block'; name.style.display = 'none' }
  img.onerror = entry.card_image_backup
    ? () => {
        img.src = entry.card_image_backup
        img.onerror = () => { img.style.display = 'none'; name.style.display = 'block' }
      }
    : () => { img.style.display = 'none'; name.style.display = 'block' }
  img.src = entry.card_image
}

function moveTooltip(e) {
  const el = tooltipEl.value
  if (!el) return
  let x = e.clientX + 12
  let y = e.clientY - 220
  if (y < 10) y = e.clientY + 12
  if (x + 200 > window.innerWidth) x = e.clientX - 210
  el.style.left = x + 'px'
  el.style.top = y + 'px'
}

function hideTooltip() {
  if (tooltipEl.value) tooltipEl.value.style.display = 'none'
}

function formatValues(values) {
  if (!values || !values.length) return ''
  if (values.length <= 10) return values.join(', ')
  return values.slice(0, 10).join(', ') + ` ... (${values.length} values)`
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
</script>
