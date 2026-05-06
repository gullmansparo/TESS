<template>
  <section class="card-panel input-panel">
    <h2 class="panel-title">
      <span class="panel-icon">✦</span>
      {{ $t('input.title') }}
    </h2>
    <p class="panel-desc">{{ $t('input.desc') }}</p>
    <div class="input-group">
      <textarea
        ref="inputRef"
        v-model="code"
        class="deck-input"
        :placeholder="$t('input.placeholder')"
        rows="3"
        spellcheck="false"
        @keydown.enter.exact.prevent="onParse"
        @paste="onPaste"
      ></textarea>
      <div class="input-actions">
        <button class="btn btn-primary" :disabled="loading" @click="onParse">
          <span class="btn-icon">{{ loading ? '⟳' : '⚔' }}</span>
          {{ loading ? $t('input.parsing') : $t('input.parse') }}
        </button>
        <button class="btn btn-secondary" @click="onClear">
          <span class="btn-icon">✕</span>
          {{ $t('input.clear') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ loading: Boolean, locale: String })
const emit = defineEmits(['parse', 'clear'])

const code = ref('')
const inputRef = ref(null)

function onParse() {
  if (!code.value.trim()) return
  emit('parse', code.value.trim())
}
function onClear() {
  code.value = ''
  emit('clear')
  inputRef.value?.focus()
}
function onPaste() {
  setTimeout(() => {
    if (code.value.trim()) emit('parse', code.value.trim())
  }, 100)
}
</script>
