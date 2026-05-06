/**
 * Card Database Module (Browser-side)
 * ====================================
 * Fetches card data from hearthstonejson.com API and caches in IndexedDB.
 * Provides DbfId-based card lookup and enrichment for parsed deck codes.
 */

const CARD_IMAGE_RENDER = 'https://art.hearthstonejson.com/v1/render/latest'
const CARD_IMAGE_ART = 'https://art.hearthstonejson.com/v1'

const CACHE_DB_NAME = 'tess-card-db'
const CACHE_META_STORE = 'meta'
const CACHE_MAX_AGE = 86400000 // 24 hours in ms
const KNOWN_LOCALES = ['zh', 'en']

const RARITY_NAMES = {
  FREE: '基本', COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说',
}
const RARITY_NAMES_EN = {
  FREE: 'Free', COMMON: 'Common', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary',
}

const CLASS_NAMES = {
  DRUID: '德鲁伊', HUNTER: '猎人', MAGE: '法师', PALADIN: '圣骑士',
  PRIEST: '牧师', ROGUE: '潜行者', SHAMAN: '萨满', WARLOCK: '术士',
  WARRIOR: '战士', DEATHKNIGHT: '死亡骑士', DEMONHUNTER: '恶魔猎手', NEUTRAL: '中立',
}
const CLASS_NAMES_EN = {
  DRUID: 'Druid', HUNTER: 'Hunter', MAGE: 'Mage', PALADIN: 'Paladin',
  PRIEST: 'Priest', ROGUE: 'Rogue', SHAMAN: 'Shaman', WARLOCK: 'Warlock',
  WARRIOR: 'Warrior', DEATHKNIGHT: 'Death Knight', DEMONHUNTER: 'Demon Hunter', NEUTRAL: 'Neutral',
}

const CLASS_COLORS = {
  DRUID: '#FF7D0A', HUNTER: '#ABD473', MAGE: '#69CCF0', PALADIN: '#F58CBA',
  PRIEST: '#FFFFFF', ROGUE: '#FFF569', SHAMAN: '#0070DE', WARLOCK: '#9487C9',
  WARRIOR: '#C79C6E', DEATHKNIGHT: '#C41E3A', DEMONHUNTER: '#A330C9', NEUTRAL: '#C0C0C0',
}

// Hero English names by card_id (locale-independent)
const HERO_EN_NAMES_BY_ID = {
  HERO_01: 'Garrosh Hellscream', HERO_02: 'Thrall',
  HERO_03: 'Valeera Sanguinar', HERO_04: 'Uther Lightbringer',
  HERO_05: 'Rexxar', HERO_06: 'Malfurion Stormrage',
  HERO_07: "Gul'dan", HERO_08: 'Jaina Proudmoore',
  HERO_09: 'Anduin Wrynn', HERO_10: 'The Lich King',
  HERO_11: 'Illidan Stormrage',
  HERO_01a: 'Garrosh Hellscream', HERO_02a: 'Thrall',
  HERO_03a: 'Valeera Sanguinar', HERO_04a: 'Uther Lightbringer',
  HERO_05a: 'Rexxar', HERO_06a: 'Malfurion Stormrage',
  HERO_07a: "Gul'dan", HERO_08a: 'Jaina Proudmoore',
  HERO_09a: 'Anduin Wrynn', HERO_10a: 'The Lich King',
  HERO_11a: 'Illidan Stormrage',
}

// Hero DbfId -> class mapping for fallback
const HERO_DBF_IDS = {
  7: 'WARRIOR', 565: 'HUNTER', 637: 'PALADIN', 671: 'MAGE',
  813: 'WARLOCK', 893: 'DRUID', 894: 'PRIEST', 930: 'ROGUE',
  1066: 'SHAMAN', 27477: 'HUNTER', 28140: 'DRUID', 28214: 'WARLOCK',
  28226: 'PRIEST', 28307: 'MAGE', 28324: 'WARRIOR', 28499: 'PALADIN',
  28511: 'SHAMAN', 28520: 'ROGUE', 34062: 'WARRIOR', 34692: 'SHAMAN',
  52337: 'ROGUE', 54287: 'DEMONHUNTER', 54999: 'DEMONHUNTER',
  57780: 'DEMONHUNTER', 59677: 'DEMONHUNTER', 60049: 'MAGE',
  61077: 'DEMONHUNTER', 63615: 'DEMONHUNTER', 64150: 'WARRIOR',
  65316: 'DEMONHUNTER', 67362: 'DEATHKNIGHT', 71057: 'DEATHKNIGHT',
  71058: 'DEATHKNIGHT', 71059: 'DEATHKNIGHT', 71060: 'DEATHKNIGHT',
  71061: 'DEATHKNIGHT', 71062: 'DEATHKNIGHT', 71063: 'DEATHKNIGHT',
  71203: 'DEATHKNIGHT', 71473: 'DEATHKNIGHT', 71780: 'DEATHKNIGHT',
  71875: 'DEATHKNIGHT', 71902: 'DEATHKNIGHT', 71903: 'DEATHKNIGHT',
}

let _db = null
let _cardsByDbfId = {}
let _loaded = false
let _loadError = null
let _loadPromise = null

/**
 * Open or create the IndexedDB database.
 */
function storeName(locale) { return `cards_${locale}` }

function openDB(locale) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, 2)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      // Create per-locale card stores
      for (const loc of KNOWN_LOCALES) {
        if (!db.objectStoreNames.contains(storeName(loc))) {
          db.createObjectStore(storeName(loc), { keyPath: 'dbfId' })
        }
      }
      if (!db.objectStoreNames.contains(CACHE_META_STORE)) {
        db.createObjectStore(CACHE_META_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get metadata from cache.
 */
async function getMeta(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_META_STORE, 'readonly')
    const store = tx.objectStore(CACHE_META_STORE)
    const req = store.get('timestamp')
    req.onsuccess = () => resolve(req.result ? req.result.value : null)
    req.onerror = () => resolve(null)
  })
}

/**
 * Set metadata in cache.
 */
async function setMeta(db, key, value) {
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_META_STORE, 'readwrite')
    const store = tx.objectStore(CACHE_META_STORE)
    store.put({ key, value })
    tx.oncomplete = () => resolve()
  })
}

/**
 * Store cards in IndexedDB.
 */
async function storeCards(db, cards, locale) {
  return new Promise((resolve) => {
    const name = storeName(locale)
    const tx = db.transaction(name, 'readwrite')
    const store = tx.objectStore(name)
    for (const card of cards) {
      if (card.dbfId != null) store.put(card)
    }
    tx.oncomplete = () => resolve()
  })
}

/**
 * Get all cards from IndexedDB.
 */
async function getAllCards(db, locale) {
  return new Promise((resolve) => {
    const name = storeName(locale)
    if (!db.objectStoreNames.contains(name)) { resolve([]); return }
    const tx = db.transaction(name, 'readonly')
    const store = tx.objectStore(name)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve([])
  })
}

/**
 * Fetch cards from the hearthstonejson API for a given locale.
 */
async function fetchCardsFromAPI(locale) {
  const localeMap = { zh: 'zhCN', en: 'enUS' }
  const apiLocale = localeMap[locale] || 'zhCN'
  const url = `https://api.hearthstonejson.com/v1/latest/${apiLocale}/cards.json`

  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  return resp.json()
}

/**
 * Initialize the card database. Fetches from API if cache is stale,
 * otherwise loads from IndexedDB.
 */
let _currentLocale = null

export async function initCardDB(locale = 'zh', onProgress) {
  // Reset if locale changed
  if (_currentLocale !== locale) {
    _loadPromise = null
    _loaded = false
  }

  if (_loadPromise) return _loadPromise
  _currentLocale = locale

  _loadPromise = (async () => {
    try {
      _db = await openDB(locale)

      // Check per-locale cache freshness
      const metaKey = `ts_${locale}`
      const ts = await new Promise((res) => {
        const tx = _db.transaction(CACHE_META_STORE, 'readonly')
        const req = tx.objectStore(CACHE_META_STORE).get(metaKey)
        req.onsuccess = () => res(req.result ? req.result.value : null)
        req.onerror = () => res(null)
      })

      const isFresh = ts && (Date.now() - ts) < CACHE_MAX_AGE

      if (isFresh) {
        if (onProgress) onProgress({ type: 'cached' })
        const cards = await getAllCards(_db, locale)
        if (cards.length > 0) {
          _indexCards(cards)
          _loaded = true
          return
        }
      }

      // Fetch from API
      if (onProgress) onProgress({ type: 'loading' })
      const cards = await fetchCardsFromAPI(locale)
      if (onProgress) onProgress({ type: 'indexing', count: cards.length })

      // Store in per-locale IndexedDB store
      await storeCards(_db, cards, locale)
      await setMeta(_db, metaKey, Date.now())
      await setMeta(_db, 'card_count', cards.length)

      _indexCards(cards)
      _loaded = true
    } catch (e) {
      // Try fallback: load from cache even if stale
      try {
        const cards = await getAllCards(_db, locale)
        if (cards.length > 0) {
          _indexCards(cards)
          _loaded = true
          _loadError = `Cache fallback (${e.message})`
          return
        }
      } catch {}
      _loadError = e.message
      throw e
    }
  })()

  return _loadPromise
}

function _indexCards(cards) {
  _cardsByDbfId = {}
  for (const card of cards) {
    if (card.dbfId != null) {
      _cardsByDbfId[card.dbfId] = card
    }
  }
}

/** Get card by DbfId. */
export function getCard(dbfId) {
  return _cardsByDbfId[dbfId] || null
}

/** Check if DB is loaded. */
export function isLoaded() {
  return _loaded
}

/** Get load error. */
export function getLoadError() {
  return _loadError
}

/** Get total card count. */
export function getCardCount() {
  return Object.keys(_cardsByDbfId).length
}

/**
 * Get card image URLs for a given card and locale.
 */
export function getCardImageUrl(dbfId, cardId, locale = 'zh') {
  const loc = locale === 'en' ? 'enUS' : 'zhCN'
  if (cardId) {
    return {
      primary: `${CARD_IMAGE_RENDER}/${loc}/256x/${cardId}.png`,
      backup: `${CARD_IMAGE_ART}/256x/${cardId}.jpg`,
    }
  }
  return {
    primary: `${CARD_IMAGE_RENDER}/${loc}/${dbfId}.png`,
    backup: null,
  }
}

/**
 * Get hero portrait art URL.
 */
export function getHeroArtUrl(cardId) {
  if (cardId) {
    return {
      primary: `${CARD_IMAGE_ART}/512x/${cardId}.jpg`,
      backup: `${CARD_IMAGE_ART}/256x/${cardId}.jpg`,
    }
  }
  return { primary: null, backup: null }
}

/**
 * Get hero info from DbfId.
 */
export function getHeroInfo(dbfId, locale = 'zh') {
  const en = locale === 'en'
  const card = getCard(dbfId)
  if (card) {
    const cardClass = card.cardClass || 'NEUTRAL'
    const cardId = card.id || ''
    const art = getHeroArtUrl(cardId)
    return {
      dbf_id: dbfId,
      name: card.name || `Hero ${dbfId}`,
      name_en: HERO_EN_NAMES_BY_ID[cardId] || '',
      cardClass,
      class_name: en ? (CLASS_NAMES_EN[cardClass] || '') : (CLASS_NAMES[cardClass] || ''),
      class_color: CLASS_COLORS[cardClass] || '#C0C0C0',
      image_url: art.primary,
      image_backup: art.backup,
      card_id: cardId,
      cardType: card.type || 'HERO',
    }
  }
  // Fallback
  const cardClass = HERO_DBF_IDS[dbfId] || 'NEUTRAL'
  return {
    dbf_id: dbfId,
    name: `Hero (ID: ${dbfId})`,
    name_en: '',
    cardClass,
    class_name: en ? (CLASS_NAMES_EN[cardClass] || '') : (CLASS_NAMES[cardClass] || ''),
    class_color: CLASS_COLORS[cardClass] || '#C0C0C0',
    image_url: `${CARD_IMAGE_RENDER}/zhCN/${dbfId}.png`,
    image_backup: null,
    card_id: '',
    cardType: 'HERO',
  }
}

/**
 * Enrich a parse result with card data.
 */
export function enrichParseResult(parseResult, locale = 'zh') {
  if (parseResult.error) return parseResult
  const en = locale === 'en'

  // Hero info
  parseResult.heroes = (parseResult.hero_dbf_ids || []).map(id => getHeroInfo(id, locale))

  // Enrich flat card list with deduplication
  const CARD_KINDS = new Set(['hero_dbfid', 'card_dbfid'])

  // First, enrich varint stream entries
  if (parseResult.varint_stream) {
    for (const entry of parseResult.varint_stream) {
      if (!CARD_KINDS.has(entry.kind)) continue
      const card = getCard(entry.value)
      if (card) {
        const cardId = card.id || ''
        const img = getCardImageUrl(entry.value, cardId, locale)
        entry.card_name = card.name || ''
        entry.card_image = img.primary
        entry.card_image_backup = img.backup
        entry.card_cost = card.cost || 0
        entry.card_type = card.type || ''
      }
    }
  }

  // Enrich flat card list
  const merged = new Map()
  for (const entry of parseResult.cards || []) {
    const key = `${entry.dbf_id}_${entry.sideboard ? 1 : 0}`
    if (merged.has(key)) {
      merged.get(key).count += entry.count
    } else {
      merged.set(key, { ...entry })
    }
  }

  const enrichedCards = []
  for (const [, entry] of merged) {
    const card = getCard(entry.dbf_id)
    if (card) {
      const cardId = card.id || ''
      const img = getCardImageUrl(entry.dbf_id, cardId, locale)
      enrichedCards.push({
        dbf_id: entry.dbf_id,
        card_id: cardId,
        count: entry.count,
        sideboard: entry.sideboard || false,
        owner_dbf_id: entry.owner_dbf_id,
        name: card.name || `Unknown (${entry.dbf_id})`,
        cost: card.cost || 0,
        cardClass: card.cardClass || 'NEUTRAL',
        cardType: card.type || 'MINION',
        rarity: card.rarity || 'FREE',
        rarity_name: en ? (RARITY_NAMES_EN[card.rarity] || '') : (RARITY_NAMES[card.rarity] || ''),
        attack: card.attack,
        health: card.health,
        durability: card.durability,
        image_url: img.primary,
        image_backup: img.backup,
        class_color: CLASS_COLORS[card.cardClass] || '#C0C0C0',
        class_name: en ? (CLASS_NAMES_EN[card.cardClass] || '') : (CLASS_NAMES[card.cardClass] || ''),
      })
    } else {
      const img = getCardImageUrl(entry.dbf_id, '', locale)
      enrichedCards.push({
        dbf_id: entry.dbf_id,
        card_id: '',
        count: entry.count,
        sideboard: entry.sideboard || false,
        owner_dbf_id: entry.owner_dbf_id,
        name: `${en ? 'Unknown' : '未知卡牌'} (ID: ${entry.dbf_id})`,
        cost: 0,
        cardClass: 'UNKNOWN',
        cardType: 'UNKNOWN',
        rarity: 'UNKNOWN',
        rarity_name: en ? 'Unknown' : '未知',
        image_url: img.primary,
        image_backup: null,
        class_color: '#888888',
        class_name: '',
      })
    }
  }
  parseResult.cards = enrichedCards

  // Build card groups from sections
  const groupTypes = ['cards_1', 'cards_2', 'cards_n', 'sideboard']
  const sbOwnerMap = {}
  for (const c of enrichedCards) {
    if (c.sideboard && c.owner_dbf_id) {
      sbOwnerMap[c.dbf_id] = c.owner_dbf_id
    }
  }

  parseResult.card_groups = []
  for (const sec of parseResult.sections || []) {
    if (!groupTypes.includes(sec.type)) continue
    const groupCards = []
    for (const dbfId of (sec.values || [])) {
      if (dbfId === 0) continue
      const card = getCard(dbfId)
      if (card) {
        const cardId = card.id || ''
        const img = getCardImageUrl(dbfId, cardId, locale)
        const enriched = {
          dbf_id: dbfId,
          card_id: cardId,
          name: card.name || `Unknown (${dbfId})`,
          cost: card.cost || 0,
          cardClass: card.cardClass || 'NEUTRAL',
          cardType: card.type || 'MINION',
          rarity: card.rarity || 'FREE',
          rarity_name: en ? (RARITY_NAMES_EN[card.rarity] || '') : (RARITY_NAMES[card.rarity] || ''),
          attack: card.attack,
          health: card.health,
          durability: card.durability,
          image_url: img.primary,
          image_backup: img.backup,
          class_color: CLASS_COLORS[card.cardClass] || '#C0C0C0',
          class_name: en ? (CLASS_NAMES_EN[card.cardClass] || '') : (CLASS_NAMES[card.cardClass] || ''),
        }
        // Filter assembled tokens (same name as owner)
        if (sec.type === 'sideboard' && sbOwnerMap[dbfId]) {
          const ownerCard = getCard(sbOwnerMap[dbfId])
          if (ownerCard && enriched.name === ownerCard.name) continue
          enriched.owner_dbf_id = sbOwnerMap[dbfId]
          enriched.owner_name = ownerCard ? ownerCard.name : ''
        }
        groupCards.push(enriched)
      }
    }
    if (groupCards.length > 0) {
      parseResult.card_groups.push({
        type: sec.type,
        label: sec.label,
        copy_count: sec.copy_count || 1,
        color: sec.color,
        description: sec.description || '',
        cards: groupCards,
      })
    }
  }

  return parseResult
}
