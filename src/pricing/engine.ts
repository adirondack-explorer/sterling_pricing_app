import type { FinishOption } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessorySelection {
  key: string
  quantity: number
}

export interface CalcParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catalog: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
  gauge?: string
  billedLengthFt: number
  finish: FinishOption
  accessories: AccessorySelection[]
}

export interface CalcResult {
  listPrice: number
  weightLb: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, keyPath: string): any {
  return keyPath.split('.').reduce((cur, k) => (cur != null ? cur[k] : undefined), obj)
}

// ─── Price calculation ────────────────────────────────────────────────────────

export function calcEnclosurePrice(params: CalcParams): CalcResult {
  const { model, gauge, billedLengthFt, finish, accessories } = params

  // ── Base price per ft ────────────────────────────────────────────────────
  let pricePerFt = 0

  if (model.prices_per_ft) {
    const prices = model.prices_per_ft
    if (gauge && gauge in prices && prices[gauge] != null) {
      pricePerFt = prices[gauge]
    } else {
      const first = Object.values(prices).find((v) => typeof v === 'number' && v != null)
      pricePerFt = typeof first === 'number' ? first : 0
    }
  } else if (model.list_price_per_ft) {
    const lp = model.list_price_per_ft
    pricePerFt = typeof lp === 'object' ? (lp.prime ?? 0) : (lp as number)
  }

  // ── Finish adder per ft ──────────────────────────────────────────────────
  let finishAdderPerFt = 0
  const adders = model.finish_adders_per_ft

  if (adders) {
    if (finish === 'baked_powder' && adders.baked_powder != null) {
      finishAdderPerFt = adders.baked_powder
    } else if (finish === 'baked_metallic' && adders.baked_metallic != null) {
      finishAdderPerFt = adders.baked_metallic
    } else if (finish === 'two_tone') {
      finishAdderPerFt = adders.two_tone ?? model.two_tone_adder_per_ft ?? 0
    }
  }

  // Pipe enclosure add_ style
  if (model.list_price_per_ft && typeof model.list_price_per_ft === 'object') {
    const lp = model.list_price_per_ft
    if (finish === 'baked_powder' && lp.add_baked_powder != null) {
      finishAdderPerFt = lp.add_baked_powder
    } else if (finish === 'baked_metallic' && lp.add_baked_metallic != null) {
      finishAdderPerFt = lp.add_baked_metallic
    }
  }

  const enclosureListPrice = (pricePerFt + finishAdderPerFt) * billedLengthFt

  // ── Weight per ft ────────────────────────────────────────────────────────
  let weightPerFt = 0
  const weights = model.weights_per_ft

  if (weights) {
    if (gauge && gauge in weights && weights[gauge] != null) {
      weightPerFt = weights[gauge]
    } else if ('prime' in weights) {
      weightPerFt = weights.prime
    } else {
      const first = Object.values(weights).find((v) => typeof v === 'number' && v != null)
      weightPerFt = typeof first === 'number' ? first : 0
    }
  } else if (model.weight_per_ft) {
    const wp = model.weight_per_ft
    weightPerFt = typeof wp === 'object' ? (wp.prime ?? 0) : (wp as number)
  }

  const enclosureWeight = weightPerFt * billedLengthFt

  // ── Accessories ──────────────────────────────────────────────────────────
  let accessoryListPrice = 0
  let accessoryWeight = 0

  for (const sel of accessories) {
    const accObj = getNestedValue(model.accessories, sel.key)
    if (!accObj) continue

    if (typeof accObj.list_price === 'number') {
      accessoryListPrice += accObj.list_price * sel.quantity
    } else if (typeof accObj.list_price_per_ft === 'number') {
      accessoryListPrice += accObj.list_price_per_ft * billedLengthFt * sel.quantity
    }

    if (typeof accObj.weight_lb === 'number') {
      accessoryWeight += accObj.weight_lb * sel.quantity
    } else if (typeof accObj.weight_per_ft === 'number') {
      accessoryWeight += accObj.weight_per_ft * billedLengthFt * sel.quantity
    }
  }

  return {
    listPrice: Math.round((enclosureListPrice + accessoryListPrice) * 100) / 100,
    weightLb: Math.round((enclosureWeight + accessoryWeight) * 10) / 10,
  }
}

// ─── Element pricing ──────────────────────────────────────────────────────────

export function calcElementPrice(pricePerFt: number, weightPerFt: number, lengthFt: number): CalcResult {
  return {
    listPrice: Math.round(pricePerFt * lengthFt * 100) / 100,
    weightLb: Math.round(weightPerFt * lengthFt * 10) / 10,
  }
}

// ─── Rough-in pricing ─────────────────────────────────────────────────────────

export function calcRoughInPrice(
  unitPrice: number,
  unitWeight: number,
  quantity: number,
  pricingUnit: 'per_each' | 'per_ft',
  lengthFt = 1,
): CalcResult {
  const factor = pricingUnit === 'per_ft' ? lengthFt : quantity
  const weightFactor = pricingUnit === 'per_ft' ? lengthFt : quantity
  return {
    listPrice: Math.round(unitPrice * factor * 100) / 100,
    weightLb: Math.round(unitWeight * weightFactor * 10) / 10,
  }
}

// ─── Multiplier tiers ─────────────────────────────────────────────────────────

export function applyMultiplier(listTotal: number): {
  multiplier: number
  netCost: number
  tier: string
} {
  let multiplier: number
  let tier: string

  if (listTotal < 3000) {
    multiplier = 0.70; tier = 'Tier 1  (<$3,000)'
  } else if (listTotal < 4500) {
    multiplier = 0.67; tier = 'Tier 2  ($3,000–$4,499)'
  } else if (listTotal < 6000) {
    multiplier = 0.608; tier = 'Tier 3  ($4,500–$5,999)'
  } else {
    multiplier = 0.5776; tier = 'Tier 4  ($6,000+)'
  }

  return { multiplier, netCost: Math.round(listTotal * multiplier * 100) / 100, tier }
}

// ─── Sell price ───────────────────────────────────────────────────────────────

/** marginPct = gross margin percentage (0–99), e.g. 30 means 30% margin */
export function calcSellPrice(netCost: number, marginPct: number): number {
  if (marginPct <= 0) return netCost
  if (marginPct >= 100) return Infinity
  return Math.round((netCost / (1 - marginPct / 100)) * 100) / 100
}

// Round up to nearest 6-inch (0.5 ft) increment, min 2 ft
export function roundToSterlingLength(ft: number): number {
  if (ft <= 2) return 2
  return Math.ceil(ft * 2) / 2
}
