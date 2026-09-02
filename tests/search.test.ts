import { afterAll, describe, expect, it } from 'vitest'
import { searchAssets } from '../src/db/search'
import { sql } from '../src/db/client'
import { isSearchError } from '../src/domain/types'

afterAll(async () => {
  await sql.end({ timeout: 2 })
})

describe('searchAssets', () => {
  it('returns seeded airports near london with plausible coordinates', async () => {
    const out = await searchAssets('airports near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results.length).toBeGreaterThan(5)
    expect(out.results.every((a) => a.type === 'airport')).toBe(true)
    const heathrow = out.results.find((a) => a.name?.includes('Heathrow'))
    expect(heathrow).toBeTruthy()
    expect(heathrow!.lat).toBeGreaterThan(51)
    expect(heathrow!.lat).toBeLessThan(52)
    expect(heathrow!.lon).toBeGreaterThan(-1)
    expect(heathrow!.lon).toBeLessThan(1)
    for (const a of out.results) {
      expect(a.lat).toBeGreaterThan(50.5)
      expect(a.lat).toBeLessThan(52.5)
      expect(a.lon).toBeGreaterThan(-2)
      expect(a.lon).toBeLessThan(2)
    }
  })

  it('returns seeded bridges in new york inside the city bbox', async () => {
    const out = await searchAssets('bridges in new york')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(10)
    expect(out.results.some((a) => a.name?.includes('Brooklyn Bridge'))).toBe(true)
    for (const a of out.results) {
      expect(a.type).toBe('bridge')
      expect(a.lat).toBeGreaterThan(40.4)
      expect(a.lat).toBeLessThan(41.0)
      expect(a.lon).toBeGreaterThan(-74.3)
      expect(a.lon).toBeLessThan(-73.6)
    }
  })

  it('honors structured type:airport near:london radius:50', async () => {
    const out = await searchAssets('type:airport near:london radius:50')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.query.type).toBe('airport')
    expect(out.query.near).toBe('london')
    expect(out.query.radius).toBe(50)
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results[0]?.type).toBe('airport')
  })

  it('finds telecom in karnataka', async () => {
    const out = await searchAssets('telecom towers in karnataka')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results.every((a) => a.type === 'telecom')).toBe(true)
  })
})
