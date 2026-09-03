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

  it('parses type:airport near:london radius:5', () => {
    const q = parseQuery('type:airport near:london radius:5')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(5)
  })

  it('parses type:airport country:france', () => {
    const q = parseQuery('type:airport country:france')
    expect(q.type).toBe('airport')
    expect(q.country).toBe('france')
    expect(validateQuery(q).valid).toBe(true)
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

describe('validateQuery — empty input', () => {
  it('rejects empty, whitespace, and newline-only queries', () => {
    expect(validateQuery(parseQuery('')).valid).toBe(false)
    expect(validateQuery(parseQuery('   ')).valid).toBe(false)
    expect(validateQuery(parseQuery('\n')).valid).toBe(false)
    expect(validateQuery(parseQuery('\n\t  \n')).valid).toBe(false)
  })
})

describe('parseQuery — quoted structured values', () => {
  it('accepts quoted multi-word operator and region', () => {
    const q = parseQuery('operator:"Long Island Rail Road" region:"new york"')
    expect(q.operator).toBe('long island rail road')
    expect(q.region).toBe('new york')
  })

  it('keeps unquoted values as a single token', () => {
    const q = parseQuery('operator:Long region:new york')
    expect(q.operator).toBe('long')
    expect(q.region).toBe('new')
  })
})

describe('parseQuery — radius', () => {
  it('clamps radius 0 to 1', () => {
    expect(parseQuery('type:airport near:london radius:0').radius).toBe(1)
  })

  it('leaves radius foo at the default 50', () => {
    expect(parseQuery('type:airport near:london radius:foo').radius).toBe(50)
  })

  it('parses kilometers as the radius unit', () => {
    expect(parseQuery('airports near london within 20 kilometers').radius).toBe(20)
    expect(parseQuery('airports near london within 15 kilometres').radius).toBe(15)
  })

  it('parses airports near london radius:5', () => {
    const q = parseQuery('airports near london radius:5')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(5)
  })

  it('prefers structured radius over NL within', () => {
    const q = parseQuery('airports near london within 20 km radius:5')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(5)
  })
})

describe('parseQuery — operator word boundaries', () => {
  it('does not treat appleton as operator apple', () => {
    expect(parseQuery('appleton near london').operator).toBeNull()
    expect(parseQuery('airports near appleton').operator).toBeNull()
  })

  it('does not treat orange as a substring of a longer word', () => {
    expect(parseQuery('oranges near london').operator).toBeNull()
    expect(parseQuery('airports in orangeland').operator).toBeNull()
  })

  it('resolves the word airtel as an operator', () => {
    expect(parseQuery('airtel in karnataka').operator).toBe('airtel')
    expect(parseQuery('operator:airtel region:karnataka').operator).toBe('airtel')
  })
})

describe('parseQuery — join hops', () => {
  it('parses pipelines within 20 km of airports near london', () => {
    const q = parseQuery('pipelines within 20 km of airports near london')
    expect(q.type).toBe('pipeline')
    expect(q.hops).toEqual([{ type: 'airport', withinM: 20000 }])
    expect(q.near).toBe('london')
    expect(q.radius).toBe(50)
  })

  it('parses data centers within 10 km of substations within 50 km of airports near london', () => {
    const q = parseQuery(
      'data centers within 10 km of substations within 50 km of airports near london',
    )
    expect(q.type).toBe('data_center')
    expect(q.hops).toEqual([
      { type: 'substation', withinM: 10000 },
      { type: 'airport', withinM: 50000 },
    ])
    expect(q.near).toBe('london')
    expect(q.radius).toBe(50)
  })

  it('keeps within 20 km as place radius when there is no of <type>', () => {
    const q = parseQuery('airports near london within 20 km')
    expect(q.type).toBe('airport')
    expect(q.near).toBe('london')
    expect(q.radius).toBe(20)
    expect(q.hops).toEqual([])
  })

  it('parses three hops and caps at three', () => {
    const q = parseQuery(
      'warehouses within 5 km of data centers within 10 km of substations within 50 km of airports near london',
    )
    expect(q.type).toBe('warehouse')
    expect(q.hops).toEqual([
      { type: 'data_center', withinM: 5000 },
      { type: 'substation', withinM: 10000 },
      { type: 'airport', withinM: 50000 },
    ])
    expect(q.near).toBe('london')
    expect(q.radius).toBe(50)
  })

  it('drops a fourth hop and does not copy its distance into radius', () => {
    const q = parseQuery(
      'pipelines within 5 km of warehouses within 10 km of data centers within 20 km of substations within 80 km of airports near london',
    )
    expect(q.type).toBe('pipeline')
    expect(q.hops).toEqual([
      { type: 'warehouse', withinM: 5000 },
      { type: 'data_center', withinM: 10000 },
      { type: 'substation', withinM: 20000 },
    ])
    expect(q.hops).toHaveLength(3)
    expect(q.hops.some((h) => h.type === 'airport')).toBe(false)
    expect(q.radius).toBe(50)
    expect(q.near).toBe('london')
  })

  it('does not treat within 20 km of london as a hop', () => {
    const q = parseQuery('airports near london within 20 km of london')
    expect(q.type).toBe('airport')
    expect(q.hops).toEqual([])
    expect(q.near).toBe('london')
  })

  it('keeps hop distance and trailing place radius', () => {
    const q = parseQuery('pipelines within 20 km of airports near london within 5 km')
    expect(q.type).toBe('pipeline')
    expect(q.hops).toEqual([{ type: 'airport', withinM: 20000 }])
    expect(q.radius).toBe(5)
    expect(q.near).toBe('london')
  })

  it('clamps hop distance 0 km to 1 km and 900 km to 500 km', () => {
    const low = parseQuery('pipelines within 0 km of airports near london')
    expect(low.hops).toEqual([{ type: 'airport', withinM: 1000 }])
    const high = parseQuery('pipelines within 900 km of airports near london')
    expect(high.hops).toEqual([{ type: 'airport', withinM: 500000 }])
  })

  it('treats within 20 km of london as place radius, not a hop', () => {
    const q = parseQuery('airports within 20 km of london')
    expect(q.type).toBe('airport')
    expect(q.hops).toEqual([])
    expect(q.radius).toBe(20)
    expect(q.near).toBe('london')
    expect(q.region).toBeNull()
  })

  it('keeps structured operator when a hop is stripped', () => {
    const q = parseQuery('operator:airtel pipelines within 20 km of airports in karnataka')
    expect(q.operator).toBe('airtel')
    expect(q.type).toBe('pipeline')
    expect(q.hops).toEqual([{ type: 'airport', withinM: 20000 }])
    expect(q.region).toBe('karnataka')
    expect(q.radius).toBe(50)
  })
})
