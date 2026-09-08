/** Shared hop legend colors — keep in sync with MapPane related layers. */
export const SUBJECT_COLOR = '#3b82f6'
export const HOP_COLORS = ['#f59e0b', '#34d399', '#a78bfa'] as const

export function formatWithinM(withinM: number): string {
  if (withinM >= 1000) {
    const km = withinM / 1000
    return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`
  }
  return `${withinM} m`
}

export type LegendItem = {
  label: string
  color: string
}
