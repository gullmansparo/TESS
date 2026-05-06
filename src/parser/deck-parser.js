/**
 * Hearthstone Deck Code Parser (JavaScript port)
 * ===============================================
 * Parses Hearthstone deck codes into structured data with byte-level
 * section tracking for visual code annotation.
 *
 * Format specification (version 1):
 * - byte 0: reserved (always 0x00)
 * - byte 1+: unsigned LEB128 varint-encoded stream
 * - Structure: Version, Format, Heroes, Card groups (1-copy, 2-copy, ...)
 */

const FORMAT_NAMES = {
  1: '狂野模式',
  2: '标准模式',
  3: '经典模式',
  4: '扭曲模式',
}

const FORMAT_NAMES_EN = {
  1: 'Wild',
  2: 'Standard',
  3: 'Classic',
  4: 'Twist',
}

const SECTION_COLORS = {
  reserved: '#808080',
  version: '#4ECDC4',
  format: '#FF6B6B',
  heroes: '#FFD93D',
  cards_1: '#6BCB77',
  cards_2: '#4D96FF',
  cards_n: '#A66CFF',
  sideboard: '#FF8C42',
  padding: '#3a3a4a',
}

const SECTION_LABELS = {
  reserved: '保留字节',
  version: '版本号',
  format: '游戏模式',
  heroes: '英雄',
  cards_1: '卡牌 (x1)',
  cards_2: '卡牌 (x2)',
  cards_n: '多张卡牌',
  sideboard: '附属卡牌',
  padding: '填充数据',
}

const SECTION_LABELS_EN = {
  reserved: 'Reserved Byte',
  version: 'Version',
  format: 'Game Mode',
  heroes: 'Heroes',
  cards_1: 'Cards (x1)',
  cards_2: 'Cards (x2)',
  cards_n: 'N-Copy Cards',
  sideboard: 'Sideboard',
  padding: 'Padding',
}

/**
 * Read an unsigned LEB128 varint from a Uint8Array at offset.
 * Returns [value, newOffset].
 */
function readVarint(data, offset) {
  let value = 0
  let shift = 0
  while (offset < data.length) {
    const byte = data[offset]
    offset++
    value |= (byte & 0x7f) << shift
    shift += 7
    if (!(byte & 0x80)) break
  }
  return [value, offset]
}

/**
 * Convert a decoded byte range to a base64 character range.
 */
function byteToCharRange(codeLen, byteStart, byteEnd) {
  if (byteStart >= byteEnd) return [0, 0]

  function byteCharSpan(bytePos) {
    const block = Math.floor(bytePos / 3)
    const off = bytePos % 3
    return [block * 4 + off, block * 4 + off + 2]
  }

  const [startChar] = byteCharSpan(byteStart)
  const [, endChar] = byteCharSpan(byteEnd - 1)

  return [
    Math.max(0, Math.min(startChar, codeLen)),
    Math.max(startChar, Math.min(endChar, codeLen)),
  ]
}

/**
 * Decode a standard base64 string to a Uint8Array.
 * Handles missing padding.
 */
function b64decode(code) {
  // Add padding if needed
  let raw
  try {
    raw = Uint8Array.from(atob(code), c => c.charCodeAt(0))
  } catch {
    try {
      raw = Uint8Array.from(atob(code + '=='), c => c.charCodeAt(0))
    } catch {
      try {
        raw = Uint8Array.from(atob(code + '==='), c => c.charCodeAt(0))
      } catch (e) {
        return null
      }
    }
  }
  return raw
}

/**
 * Determine the semantic kind of a varint based on its section and position.
 */
function varintKind(sectionType, index) {
  if (sectionType === 'version') return 'version'
  if (sectionType === 'format') return 'format'
  if (sectionType === 'heroes') return index === 0 ? 'count' : 'hero_dbfid'
  if (sectionType === 'cards_1' || sectionType === 'cards_2')
    return index === 0 ? 'count' : 'card_dbfid'
  if (sectionType === 'cards_n') {
    if (index === 0) return 'count'
    return index % 2 === 1 ? 'card_dbfid' : 'copy_count'
  }
  if (sectionType === 'sideboard') {
    if (index === 0) return 'sideboard_flag'
    if (index === 1) return 'count'
    return index % 2 === 0 ? 'card_dbfid' : 'owner_dbfid'
  }
  return 'unknown'
}

/**
 * Build a varint stream from parsed sections.
 */
function buildVarintStream(raw, sections) {
  const stream = []

  for (const sec of sections) {
    const [brStart, brEnd] = sec.byte_range
    let offset = brStart
    const end = brEnd
    const stype = sec.type

    if (stype === 'padding') {
      for (let i = offset; i < end; i++) {
        stream.push({
          value: raw[i],
          byte_range: [i, i + 1],
          label: sec.label,
          labelEn: sec.label_en,
          color: sec.color,
          type: stype,
          kind: 'padding_byte',
        })
      }
      continue
    }

    if (stype === 'reserved') {
      stream.push({
        value: raw[0],
        byte_range: [0, 1],
        label: sec.label,
        labelEn: sec.label_en,
        color: sec.color,
        type: stype,
        kind: 'reserved_byte',
      })
      continue
    }

    let idx = 0
    while (offset < end) {
      const start = offset
      const [value, newOffset] = readVarint(raw, offset)
      offset = newOffset
      const kind = varintKind(stype, idx)

      stream.push({
        value,
        byte_range: [start, offset],
        label: sec.label,
        labelEn: sec.label_en,
        color: sec.color,
        type: stype,
        kind,
      })
      idx++
    }
  }

  return stream
}

/**
 * Get format name based on locale.
 */
export function getFormatName(formatId, locale) {
  if (locale === 'en') return FORMAT_NAMES_EN[formatId] || `Unknown(${formatId})`
  return FORMAT_NAMES[formatId] || `未知(${formatId})`
}

/**
 * Get section label based on locale.
 */
export function getSectionLabel(type, locale, extra) {
  const map = locale === 'en' ? SECTION_LABELS_EN : SECTION_LABELS
  return map[type] || type
}

/**
 * Parse a Hearthstone deck code.
 *
 * @param {string} code - Base64-encoded Hearthstone deck code
 * @param {string} [locale='zh'] - Locale for labels
 * @returns {object} Parsed result with sections, cards, varint stream
 */
export function parseDeckCode(code, locale = 'zh') {
  code = code.trim()
  const raw = b64decode(code)
  if (!raw) return { error: '无法解码Base64' }
  if (raw.length < 2) return { error: '卡组代码数据太短' }

  const isEn = locale === 'en'
  const result = {
    code,
    sections: [],
    cards: [],
    hero_dbf_ids: [],
    format_id: null,
    format_name: null,
    version: null,
    card_count: 0,
  }

  // --- Reserved Byte ---
  let offset = 1
  result.sections.push({
    type: 'reserved',
    label: isEn ? 'Reserved Byte' : '保留字节',
    description: isEn ? 'Fixed 0x00, start of deck code' : '固定为 0x00，标识卡组代码格式起始',
    byte_range: [0, 1],
    values: [raw[0]],
    color: SECTION_COLORS.reserved,
  })

  // --- Version ---
  {
    const verStart = offset
    const [version, newOff] = readVarint(raw, offset)
    offset = newOff
    result.version = version
    result.sections.push({
      type: 'version',
      label: isEn ? 'Version' : '版本号',
      description: (isEn ? 'Deck code version v' : '卡组代码版本 v') + version,
      byte_range: [verStart, offset],
      values: [version],
      color: SECTION_COLORS.version,
    })
  }

  // --- Format ---
  {
    const fmtStart = offset
    const [fmtId, newOff] = readVarint(raw, offset)
    offset = newOff
    result.format_id = fmtId
    result.format_name = isEn ? FORMAT_NAMES_EN[fmtId] || `Unknown(${fmtId})` : FORMAT_NAMES[fmtId] || `未知(${fmtId})`
    result.sections.push({
      type: 'format',
      label: isEn ? 'Game Mode' : '游戏模式',
      description: result.format_name,
      byte_range: [fmtStart, offset],
      values: [fmtId],
      color: SECTION_COLORS.format,
    })
  }

  // --- Heroes ---
  {
    const heroNumStart = offset
    const [numHeroes, newOff] = readVarint(raw, offset)
    offset = newOff
    const heroIds = []
    for (let i = 0; i < numHeroes; i++) {
      const [hid, nOff] = readVarint(raw, offset)
      offset = nOff
      heroIds.push(hid)
    }
    result.hero_dbf_ids = heroIds
    result.sections.push({
      type: 'heroes',
      label: isEn ? 'Heroes' : '英雄',
      description: (isEn ? `${numHeroes} hero(s) (DbfId: ${heroIds.join(', ')})` : `${numHeroes} 个英雄 (DbfId: ${heroIds.join(', ')})`),
      byte_range: [heroNumStart, offset],
      values: heroIds,
      color: SECTION_COLORS.heroes,
    })
  }

  // --- Card Groups (3 fixed sections) ---
  let totalCards = 0
  const groupConfigs = [
    ['cards_1', 1, isEn ? '1-Copy Cards' : '单张卡牌'],
    ['cards_2', 2, isEn ? '2-Copy Cards' : '双张卡牌'],
    ['cards_n', null, isEn ? 'N-Copy Cards' : '多张卡牌'],
  ]

  for (const [typeKey, defaultCount, labelPrefix] of groupConfigs) {
    const groupStart = offset

    if (offset >= raw.length) {
      result.sections.push({
        type: typeKey,
        label: `${labelPrefix} (0)`,
        description: isEn ? 'No cards' : '无卡牌',
        byte_range: [groupStart, groupStart],
        values: [],
        color: SECTION_COLORS[typeKey],
        copy_count: defaultCount || 0,
      })
      continue
    }

    const [numCards, newOff] = readVarint(raw, offset)
    offset = newOff

    if (numCards === 0) {
      result.sections.push({
        type: typeKey,
        label: `${labelPrefix} (0)`,
        description: isEn ? 'No cards' : '无卡牌',
        byte_range: [groupStart, offset],
        values: [],
        color: SECTION_COLORS[typeKey],
        copy_count: defaultCount || 0,
      })
      continue
    }

    if (typeKey === 'cards_n') {
      const cardIds = []
      for (let i = 0; i < numCards; i++) {
        if (offset >= raw.length) break
        const [cid, o1] = readVarint(raw, offset)
        offset = o1
        const [cnt, o2] = readVarint(raw, offset)
        offset = o2
        if (cid !== 0) {
          cardIds.push(cid)
          result.cards.push({ dbf_id: cid, count: cnt })
          totalCards += cnt
        }
      }
      result.sections.push({
        type: typeKey,
        label: (isEn ? 'N-Copy Cards' : '多张卡牌') + ` (x${numCards})`,
        description: (isEn ? `${numCards} different cards` : `${numCards} 张不同卡牌`),
        byte_range: [groupStart, offset],
        values: cardIds,
        color: SECTION_COLORS[typeKey],
      })
    } else {
      const cardIds = []
      for (let i = 0; i < numCards; i++) {
        if (offset >= raw.length) break
        const [cid, o] = readVarint(raw, offset)
        offset = o
        if (cid !== 0) cardIds.push(cid)
      }
      const label = isEn ? `Cards (x${defaultCount})` : `卡牌 (x${defaultCount})`
      const desc = isEn ? `${numCards} different cards, ${defaultCount} each` : `${numCards} 张不同卡牌，各 ${defaultCount} 张`
      result.sections.push({
        type: typeKey,
        label,
        description: desc,
        byte_range: [groupStart, offset],
        values: cardIds,
        color: SECTION_COLORS[typeKey],
        copy_count: defaultCount,
      })
      for (const cid of cardIds) {
        result.cards.push({ dbf_id: cid, count: defaultCount })
      }
      totalCards += cardIds.length * defaultCount
    }
  }

  result.card_count = totalCards

  // --- Sideboard ---
  if (offset < raw.length) {
    const sbStart = offset
    const sbPresent = raw[offset]
    offset++
    if (sbPresent !== 0) {
      const [numSbEntries, o1] = readVarint(raw, offset)
      offset = o1
      const sbCardIds = []
      let totalSbCards = 0
      for (let i = 0; i < numSbEntries; i++) {
        const [cardDbfid, o2] = readVarint(raw, offset)
        offset = o2
        const [ownerDbfid, o3] = readVarint(raw, offset)
        offset = o3
        sbCardIds.push(cardDbfid)
        totalSbCards++
        result.cards.push({ dbf_id: cardDbfid, count: 1, sideboard: true, owner_dbf_id: ownerDbfid })
      }
      result.sections.push({
        type: 'sideboard',
        label: (isEn ? 'Sideboard' : '附属卡牌') + ` (x${numSbEntries})`,
        description: (isEn ? `${numSbEntries} sideboard cards` : `${numSbEntries} 张附属卡牌`),
        byte_range: [sbStart, offset],
        values: sbCardIds,
        color: SECTION_COLORS.sideboard,
        copy_count: 1,
      })
      totalCards += totalSbCards
    } else {
      result.sections.push({
        type: 'sideboard',
        label: isEn ? 'No Sideboard' : '无附属卡牌',
        description: isEn ? 'Sideboard count is 0' : 'Sideboard 数量为 0',
        byte_range: [sbStart, offset],
        values: [0],
        color: SECTION_COLORS.sideboard,
      })
    }
    result.card_count = totalCards
  }

  // --- Padding ---
  if (offset < raw.length) {
    const paddingBytes = Array.from(raw.slice(offset))
    result.sections.push({
      type: 'padding',
      label: isEn ? 'Padding' : '填充数据',
      description: (isEn ? `Trailing ${paddingBytes.length} byte(s)` : `尾部 ${paddingBytes.length} 字节填充/校验数据`),
      byte_range: [offset, raw.length],
      values: paddingBytes,
      color: SECTION_COLORS.padding,
    })
  }

  // Compute character ranges for sections
  const codeLen = code.length
  for (const sec of result.sections) {
    const [s, e] = sec.byte_range
    const [cs, ce] = byteToCharRange(codeLen, s, e)
    sec.char_range = [cs, ce]
  }

  // Build varint stream
  result.varint_stream = buildVarintStream(raw, result.sections)

  // Compute char ranges for varint stream
  for (const entry of result.varint_stream) {
    const [s, e] = entry.byte_range
    const [cs, ce] = byteToCharRange(codeLen, s, e)
    entry.char_range = [cs, ce]
  }

  // Sort sections by byte offset
  result.sections.sort((a, b) => a.byte_range[0] - b.byte_range[0])

  return result
}

/**
 * Generate per-character color mapping for annotated code display.
 */
export function generateCharMap(parseResult) {
  const result = { ...parseResult }
  if (result.error) return result

  const codeLen = result.code.length
  const charColors = new Array(codeLen).fill(null)
  const charLabels = new Array(codeLen).fill(null)

  for (const sec of result.sections) {
    const [cs, ce] = sec.char_range
    for (let i = cs; i < ce; i++) {
      if (i < codeLen) {
        charColors[i] = sec.color
        charLabels[i] = sec.label
      }
    }
  }

  // Handle trailing '=' (base64 padding)
  let eqStart = codeLen
  while (eqStart > 0 && result.code[eqStart - 1] === '=') {
    eqStart--
  }
  if (eqStart < codeLen) {
    let paddingLabel = null
    for (const sec of result.sections) {
      if (sec.type === 'padding') {
        paddingLabel = sec.label
        sec.char_range[1] = Math.max(sec.char_range[1], codeLen)
        break
      }
    }
    if (paddingLabel === null) paddingLabel = 'Base64 填充 (=)'
    for (let i = eqStart; i < codeLen; i++) {
      charColors[i] = SECTION_COLORS.padding
      charLabels[i] = paddingLabel
    }
  }

  result.char_colors = charColors
  result.char_labels = charLabels
  return result
}
