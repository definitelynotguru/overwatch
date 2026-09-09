import { describe, expect, it } from 'vitest'
import { resolveType } from '../src/domain/catalog'
import { parseQuery, toCanonicalQuery, validateQuery } from '../src/domain/parser'

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

  it('requires a place', () => {
    const v = validateQuery(parseQuery('airports'))
    expect(v.valid).toBe(false)
    expect(v.error).toMatch(/missing place/i)
  })

  it('reports unknown structured type tokens', () => {
    const v = validateQuery(parseQuery('type:foobar near:london'))
    expect(v.valid).toBe(false)
    expect(v.error).toMatch(/unknown asset type/i)
    expect(v.error).toMatch(/foobar/i)
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

describe('parseQuery — structured join hops', () => {
  it('parses within:airport:20 as a hop', () => {
    const q = parseQuery('type:pipeline near:london within:airport:20')
    expect(q.type).toBe('pipeline')
    expect(q.near).toBe('london')
    expect(q.hops).toEqual([{ type: 'airport', withinM: 20000 }])
    expect(q.radius).toBe(50)
  })

  it('resolves within:datacenter:10 alias to data_center', () => {
    const q = parseQuery('type:warehouse near:london within:datacenter:10')
    expect(q.hops).toEqual([{ type: 'data_center', withinM: 10000 }])
  })

  it('clamps structured hop distance 0 km to 1 km and 900 km to 500 km', () => {
    const low = parseQuery('type:pipeline near:london within:airport:0')
    expect(low.hops).toEqual([{ type: 'airport', withinM: 1000 }])
    const high = parseQuery('type:pipeline near:london within:airport:900')
    expect(high.hops).toEqual([{ type: 'airport', withinM: 500000 }])
  })

  it('caps structured hops at three', () => {
    const q = parseQuery(
      'type:warehouse near:london within:data_center:5 within:substation:10 within:airport:50 within:port:80',
    )
    expect(q.hops).toEqual([
      { type: 'data_center', withinM: 5000 },
      { type: 'substation', withinM: 10000 },
      { type: 'airport', withinM: 50000 },
    ])
    expect(q.hops).toHaveLength(3)
    expect(q.hops.some((h) => h.type === 'port')).toBe(false)
    expect(q.radius).toBe(50)
  })

  it('does not treat unknown within type as a hop', () => {
    const q = parseQuery('type:airport near:london within:notatype:20')
    expect(q.hops).toEqual([])
    expect(q.near).toBe('london')
    expect(q.radius).toBe(50)
  })

  it('keeps within 20 km of london as place-radius, not a structured hop', () => {
    const q = parseQuery('airports within 20 km of london')
    expect(q.type).toBe('airport')
    expect(q.hops).toEqual([])
    expect(q.radius).toBe(20)
    expect(q.near).toBe('london')
  })

  it('combines structured hops before NL hops', () => {
    const q = parseQuery(
      'type:pipeline near:london within:airport:20 within 10 km of substations',
    )
    expect(q.type).toBe('pipeline')
    expect(q.hops).toEqual([
      { type: 'airport', withinM: 20000 },
      { type: 'substation', withinM: 10000 },
    ])
    expect(q.near).toBe('london')
  })

  it('prefers structured hop slots when the combined cap is hit', () => {
    const q = parseQuery(
      'type:warehouse near:london within:data_center:5 within:substation:10 within:airport:50 within 80 km of ports',
    )
    expect(q.hops).toEqual([
      { type: 'data_center', withinM: 5000 },
      { type: 'substation', withinM: 10000 },
      { type: 'airport', withinM: 50000 },
    ])
    expect(q.hops.some((h) => h.type === 'port')).toBe(false)
    expect(q.radius).toBe(50)
    expect(q.near).toBe('london')
  })

  it('matches NL within 20 km of airports via within:airport:20', () => {
    const nl = parseQuery('pipelines within 20 km of airports near london')
    const structured = parseQuery('type:pipeline near:london within:airport:20')
    expect(structured.hops).toEqual(nl.hops)
    expect(structured.type).toBe(nl.type)
    expect(structured.near).toBe(nl.near)
  })
})

describe('catalog aliases — densify DX', () => {
  it('resolves pipelines, power lines, aerodrome, and telecom variants', () => {
    expect(resolveType('pipelines')).toBe('pipeline')
    expect(resolveType('oil pipeline')).toBe('pipeline')
    expect(resolveType('power lines')).toBe('power_line')
    expect(resolveType('powerline')).toBe('power_line')
    expect(resolveType('transmission line')).toBe('power_line')
    expect(resolveType('aerodrome')).toBe('airport')
    expect(resolveType('telecoms')).toBe('telecom')
    expect(resolveType('comms tower')).toBe('telecom')
    expect(resolveType('electrical substation')).toBe('substation')
    expect(resolveType('road bridges')).toBe('bridge')
  })

  it('parses structured type:pipelines and type:powerline', () => {
    expect(parseQuery('type:pipelines near:london').type).toBe('pipeline')
    expect(parseQuery('type:powerline near:london').type).toBe('power_line')
    expect(parseQuery('type:aerodrome near:london').type).toBe('airport')
    expect(validateQuery(parseQuery('type:pipelines near:london')).valid).toBe(true)
  })
})

describe('toCanonicalQuery', () => {
  it('rewrites NL join queries into type:/near:/within:type:km', () => {
    expect(toCanonicalQuery('pipelines within 20 km of airports near london')).toBe(
      'type:pipeline near:london within:airport:20',
    )
  })

  it('rewrites multi-hop NL joins', () => {
    expect(
      toCanonicalQuery(
        'data centers within 10 km of substations within 50 km of airports near london',
      ),
    ).toBe('type:data_center near:london within:substation:10 within:airport:50')
  })

  it('uses region: for in-place queries', () => {
    expect(toCanonicalQuery('bridges in new york')).toBe('type:bridge region:new_york')
  })

  it('includes non-default radius', () => {
    expect(toCanonicalQuery('airports near london within 20 km')).toBe(
      'type:airport near:london radius:20',
    )
  })

  it('is idempotent on structured input', () => {
    const structured = 'type:pipeline near:london within:airport:20'
    expect(toCanonicalQuery(structured)).toBe(structured)
  })

  it('round-trips NL join parse through canonicalize', () => {
    const nl = 'pipelines within 20 km of airports near london'
    const canonical = toCanonicalQuery(nl)
    const fromNl = parseQuery(nl)
    const fromCanonical = parseQuery(canonical)
    expect(fromCanonical.type).toBe(fromNl.type)
    expect(fromCanonical.near).toBe(fromNl.near)
    expect(fromCanonical.hops).toEqual(fromNl.hops)
    expect(fromCanonical.radius).toBe(fromNl.radius)
  })

  it('leaves invalid queries unchanged', () => {
    expect(toCanonicalQuery('near london')).toBe('near london')
    expect(toCanonicalQuery('airports')).toBe('airports')
  })

  it('returns empty for blank input', () => {
    expect(toCanonicalQuery('')).toBe('')
    expect(toCanonicalQuery('   ')).toBe('')
  })

  it('keeps operator in the canonical form', () => {
    expect(toCanonicalQuery('operator:airtel pipelines within 20 km of airports in karnataka')).toBe(
      'type:pipeline operator:airtel region:karnataka within:airport:20',
    )
  })

  it('canonicalizes multi-word quoted operators with underscores', () => {
    const input = 'operator:"Long Island Rail Road" type:airport near:london'
    const canonical = toCanonicalQuery(input)
    expect(canonical).toBe('type:airport operator:long_island_rail_road near:london')
    const roundTrip = parseQuery(canonical)
    expect(roundTrip.operator).toBe('long island rail road')
    expect(roundTrip.type).toBe('airport')
    expect(roundTrip.near).toBe('london')
  })

  it('includes country in the canonical form', () => {
    expect(toCanonicalQuery('type:airport country:france')).toBe('type:airport country:france')
  })
})
