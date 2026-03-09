import type { EnclosureFamily } from '@/types'

import jvk from '@data/enclosures/jvk.json'
import jva from '@data/enclosures/jva.json'
import jvb from '@data/enclosures/jvb.json'
import xExpanded from '@data/enclosures/x-expanded.json'
import lcs10 from '@data/enclosures/lcs10-lb2.json'
import classicJ from '@data/enclosures/classic-j.json'
import classicStd from '@data/enclosures/classic-standard.json'
import duraVane from '@data/enclosures/dura-vane.json'
import guardian from '@data/enclosures/guardian.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENCLOSURE_CATALOGS: Record<EnclosureFamily, any> = {
  jvk,
  jva,
  jvb,
  'x-expanded': xExpanded,
  'lcs10-lb2': lcs10,
  'classic-j': classicJ,
  'classic-standard': classicStd,
  'dura-vane': duraVane,
  guardian,
}

export const ENCLOSURE_FAMILY_LABELS: Record<EnclosureFamily, string> = {
  jvk: 'JVK Classic',
  jva: 'JVA Classic',
  jvb: 'JVB Classic',
  'x-expanded': 'X-Expanded',
  'lcs10-lb2': 'LCS10 / LB2',
  'classic-j': 'Classic J',
  'classic-standard': 'Classic Standard',
  'dura-vane': 'Dura-Vane II',
  guardian: 'Guardian Security',
}

export const ENCLOSURE_FAMILIES = Object.keys(ENCLOSURE_FAMILY_LABELS) as EnclosureFamily[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModelsForFamily(family: EnclosureFamily): any[] {
  const cat = ENCLOSURE_CATALOGS[family]
  if (!cat) return []
  if (cat.models) return cat.models
  // Dura-Vane splits into sub-sections
  if (cat.ar_models || cat.arli_models || cat.arpm_models) {
    return [
      ...(cat.ar_models ?? []),
      ...(cat.arli_models ?? []),
      ...(cat.arpm_models ?? []),
    ]
  }
  return []
}

// Flatten accessory options from a model into a pick list
export interface AccessoryOption {
  key: string
  label: string
  unitListPrice: number
  weightLb: number
  isPricePerFt: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAccessoryOptions(model: any): AccessoryOption[] {
  if (!model?.accessories) return []
  const opts: AccessoryOption[] = []

  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue
      const fullKey = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'object' && !Array.isArray(v)) {
        const vObj = v as Record<string, unknown>
        if ('list_price' in vObj || 'list_price_per_ft' in vObj) {
          const isPricePerFt = 'list_price_per_ft' in vObj && !('list_price' in vObj)
          const unitListPrice = isPricePerFt
            ? (vObj.list_price_per_ft as number) ?? 0
            : (vObj.list_price as number) ?? 0
          const weightLb = isPricePerFt
            ? (vObj.weight_per_ft as number) ?? 0
            : (vObj.weight_lb as number) ?? 0
          const rawLabel = (vObj.description as string) ?? fullKey
          const label = rawLabel.replace(/_/g, ' ').replace(/\./g, ' › ')
          if (unitListPrice > 0) {
            opts.push({ key: fullKey, label, unitListPrice, weightLb, isPricePerFt })
          }
        } else {
          flatten(vObj, fullKey)
        }
      }
    }
  }

  flatten(model.accessories as Record<string, unknown>)
  return opts
}
