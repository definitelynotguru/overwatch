import { describe, expect, it } from 'vitest'
import { parseQuery, validateQuery } from '../src/domain/parser'

describe('parseQuery — natural language', () => {
  it('parses airports near london', () => {
    const q = parseQuery('airports near london')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.region).toBeNull()
    expect(q.radius).toBe(50)
  })

  it('parses bridges in new york', () => {
    const q = parseQuery('bridges in new york')
    expect(q.type).toBe('bridge')
    expect(q.region).toBe('new york')
    expect(q.near).toBeNull()
  })

  it('parses telecom towers in karnataka', () => {
    const q = parseQuery('telecom towers in karnataka')
    expect(q.type).toBe('telecom')
    expect(q.region).toBe('karnataka')
  })

  it('resolves datacenter alias to data_center', () => {
    const q = parseQuery('datacenters in mumbai')
    expect(q.type).toBe('data_center')
    expect(q.region).toBe('mumbai')
  })

  it('parses radius in NL', () => {
    const q = parseQuery('airports near london within 20 km')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(20)
  })
})

describe('parseQuery — structured', () => {
  it('parses type:airport near:london radius:50', () => {
    const q = parseQuery('type:airport near:london radius:50')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(50)
    expect(q.region).toBeNull()
  })

  it('resolves type:datacenter to data_center', () => {
    const q = parseQuery('type:datacenter region:california')
    expect(q.type).toBe('data_center')
    expect(q.region).toBe('california')
  })

  it('caps radius at 500', () => {
    const q = parseQuery('type:bridge near:london radius:900')
    expect(q.radius).toBe(500)
  })
})

describe('validateQuery', () => {
  it('requires a type or operator', () => {
    const v = validateQuery(parseQuery('near london'))
    expect(v.valid).toBe(false)
    expect(v.error).toMatch(/type or operator/i)
  })

  it('requires geographic scope', () => {
    const v = validateQuery(parseQuery('airports'))
    expect(v.valid).toBe(false)
    expect(v.error).toMatch(/geographic/i)
  })

  it('accepts a well-formed query', () => {
    expect(validateQuery(parseQuery('airports near london')).valid).toBe(true)
    expect(validateQuery(parseQuery('type:airport near:london radius:50')).valid).toBe(true)
  })
})
