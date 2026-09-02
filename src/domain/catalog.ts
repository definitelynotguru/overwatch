/** Typed asset catalog. Aliases resolve to canonical ids. Matchers: AND within, OR across. */

export type OsmTagValue = string | readonly string[]
export type OsmMatcher = Readonly<Record<string, OsmTagValue>>

export type AssetType = {
  readonly id: string
  readonly label: string
  readonly aliases: readonly string[]
  readonly matchers: readonly OsmMatcher[]
}

export const ASSET_TYPES = [
  {
    id: 'telecom',
    label: "Telecom Tower",
    aliases: ['tower', 'towers', 'telecom towers', 'communication tower', 'communication towers'],
    matchers: [
          { 'man_made': 'tower', 'tower:type': ['communication', 'telecommunications'] },
          { 'man_made': 'communications_tower' },
          { 'communication:mobile_phone': 'yes' }
        ],
  },
  {
    id: 'data_center',
    label: "Data Center",
    aliases: ['datacenter', 'data centre', 'datacenters', 'data centers', 'data centres'],
    matchers: [{ 'building': 'data_centre' }],
  },
  {
    id: 'power_plant',
    label: "Power Plant",
    aliases: ['powerplant', 'power plants', 'power station', 'power stations'],
    matchers: [{ 'power': 'plant' }],
  },
  {
    id: 'substation',
    label: "Substation",
    aliases: ['substations'],
    matchers: [{ 'power': 'substation' }],
  },
  {
    id: 'port',
    label: "Port",
    aliases: [],
    matchers: [{ 'landuse': 'port' }],
  },
  {
    id: 'harbour',
    label: "Harbour",
    aliases: [],
    matchers: [{ 'harbour': 'yes' }],
  },
  {
    id: 'warehouse',
    label: "Warehouse",
    aliases: [],
    matchers: [{ 'building': 'warehouse' }],
  },
  {
    id: 'building',
    label: "Building",
    aliases: [],
    matchers: [{ 'building': 'yes' }],
  },
  {
    id: 'airport',
    label: "Airport",
    aliases: ['airports', 'aerodrome', 'aerodromes'],
    matchers: [{ 'aeroway': 'aerodrome' }],
  },
  {
    id: 'helipad',
    label: "Helipad",
    aliases: [],
    matchers: [{ 'aeroway': 'helipad' }],
  },
  {
    id: 'railyard',
    label: "Rail Yard",
    aliases: ['rail_yard'],
    matchers: [{ 'landuse': 'railway' }],
  },
  {
    id: 'refinery',
    label: "Refinery",
    aliases: ['refineries'],
    matchers: [
      { industrial: 'refinery' },
      { man_made: 'works', product: 'petroleum' },
    ],
  },
  {
    id: 'pipeline',
    label: "Pipeline",
    aliases: [],
    matchers: [{ 'man_made': 'pipeline' }],
  },
  {
    id: 'solar',
    label: "Solar Farm",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'solar' }],
  },
  {
    id: 'wind',
    label: "Wind Farm",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'wind' }],
  },
  {
    id: 'nuclear',
    label: "Nuclear Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'nuclear' }],
  },
  {
    id: 'dam',
    label: "Dam",
    aliases: [],
    matchers: [{ 'waterway': 'dam' }],
  },
  {
    id: 'military',
    label: "Military Installation",
    aliases: [],
    matchers: [{ 'landuse': 'military' }],
  },
  {
    id: 'prison',
    label: "Prison",
    aliases: [],
    matchers: [{ 'amenity': 'prison' }],
  },
  {
    id: 'hospital',
    label: "Hospital",
    aliases: [],
    matchers: [{ 'amenity': 'hospital' }],
  },
  {
    id: 'embassy',
    label: "Embassy",
    aliases: [],
    matchers: [{ 'amenity': 'embassy' }],
  },
  {
    id: 'factory',
    label: "Factory",
    aliases: [],
    matchers: [{ 'building': 'industrial' }],
  },
  {
    id: 'industrial',
    label: "Industrial Zone",
    aliases: [],
    matchers: [{ 'landuse': 'industrial' }],
  },
  {
    id: 'school',
    label: "School",
    aliases: [],
    matchers: [{ 'amenity': 'school' }],
  },
  {
    id: 'university',
    label: "University",
    aliases: [],
    matchers: [{ 'amenity': 'university' }],
  },
  {
    id: 'college',
    label: "College",
    aliases: [],
    matchers: [{ 'amenity': 'college' }],
  },
  {
    id: 'stadium',
    label: "Stadium",
    aliases: [],
    matchers: [{ 'leisure': 'stadium' }],
  },
  {
    id: 'fire_station',
    label: "Fire Station",
    aliases: [],
    matchers: [{ 'amenity': 'fire_station' }],
  },
  {
    id: 'police',
    label: "Police Station",
    aliases: [],
    matchers: [{ 'amenity': 'police' }],
  },
  {
    id: 'courthouse',
    label: "Courthouse",
    aliases: [],
    matchers: [{ 'amenity': 'courthouse' }],
  },
  {
    id: 'bank',
    label: "Bank",
    aliases: [],
    matchers: [{ 'amenity': 'bank' }],
  },
  {
    id: 'atm',
    label: "ATM",
    aliases: [],
    matchers: [{ 'amenity': 'atm' }],
  },
  {
    id: 'fuel',
    label: "Fuel Station",
    aliases: ['petrol', 'gas station', 'gas_station'],
    matchers: [{ 'amenity': 'fuel' }],
  },
  {
    id: 'charging_station',
    label: "EV Charging Station",
    aliases: [],
    matchers: [{ 'amenity': 'charging_station' }],
  },
  {
    id: 'water_tower',
    label: "Water Tower",
    aliases: [],
    matchers: [{ 'man_made': 'water_tower' }],
  },
  {
    id: 'water_treatment',
    label: "Water Treatment Plant",
    aliases: [],
    matchers: [{ 'man_made': 'water_works' }],
  },
  {
    id: 'wastewater',
    label: "Wastewater Plant",
    aliases: ['sewage', 'sewage plant', 'sewage_plant'],
    matchers: [{ 'man_made': 'wastewater_plant' }],
  },
  {
    id: 'landfill',
    label: "Landfill",
    aliases: [],
    matchers: [{ 'landuse': 'landfill' }],
  },
  {
    id: 'quarry',
    label: "Quarry",
    aliases: ['mine'],
    matchers: [{ 'landuse': 'quarry' }],
  },
  {
    id: 'oil_well',
    label: "Oil Well",
    aliases: [],
    matchers: [{ 'man_made': 'petroleum_well' }],
  },
  {
    id: 'gas_well',
    label: "Gas Well",
    aliases: [],
    matchers: [{ 'man_made': 'petroleum_well' }],
  },
  {
    id: 'storage_tank',
    label: "Storage Tank",
    aliases: [],
    matchers: [{ 'man_made': 'storage_tank' }],
  },
  {
    id: 'silo',
    label: "Silo",
    aliases: [],
    matchers: [{ 'man_made': 'silo' }],
  },
  {
    id: 'chimney',
    label: "Chimney",
    aliases: [],
    matchers: [{ 'man_made': 'chimney' }],
  },
  {
    id: 'cooling_tower',
    label: "Cooling Tower",
    aliases: [],
    matchers: [{ 'man_made': 'cooling_tower' }],
  },
  {
    id: 'lighthouse',
    label: "Lighthouse",
    aliases: [],
    matchers: [{ 'man_made': 'lighthouse' }],
  },
  {
    id: 'radar',
    label: "Radar",
    aliases: [],
    matchers: [{ 'man_made': 'radar' }],
  },
  {
    id: 'surveillance_camera',
    label: "Surveillance Camera",
    aliases: ['cctv'],
    matchers: [
          { 'man_made': 'surveillance', 'surveillance:type': 'camera' },
          { 'man_made': 'surveillance', 'surveillance': 'outdoor' },
          { 'man_made': 'surveillance', 'surveillance': 'indoor' },
          { 'man_made': 'surveillance', 'surveillance': 'public' },
          { 'surveillance:type': 'camera' },
          { 'man_made': 'surveillance' }
        ],
  },
  {
    id: 'antenna',
    label: "Antenna",
    aliases: [],
    matchers: [{ 'man_made': 'antenna' }],
  },
  {
    id: 'mast',
    label: "Mast",
    aliases: [],
    matchers: [{ 'man_made': 'mast' }],
  },
  {
    id: 'bridge',
    label: "Bridge",
    aliases: ['bridges'],
    matchers: [{ 'man_made': 'bridge' }],
  },
  {
    id: 'tunnel',
    label: "Tunnel",
    aliases: [],
    matchers: [{ 'tunnel': 'yes' }],
  },
  {
    id: 'ferry_terminal',
    label: "Ferry Terminal",
    aliases: [],
    matchers: [{ 'amenity': 'ferry_terminal' }],
  },
  {
    id: 'bus_station',
    label: "Bus Station",
    aliases: [],
    matchers: [{ 'amenity': 'bus_station' }],
  },
  {
    id: 'train_station',
    label: "Train Station",
    aliases: [],
    matchers: [{ 'railway': 'station' }],
  },
  {
    id: 'metro',
    label: "Metro Station",
    aliases: [],
    matchers: [{ 'railway': 'subway_entrance' }],
  },
  {
    id: 'parking',
    label: "Parking",
    aliases: [],
    matchers: [{ 'amenity': 'parking' }],
  },
  {
    id: 'cemetery',
    label: "Cemetery",
    aliases: [],
    matchers: [{ 'landuse': 'cemetery' }],
  },
  {
    id: 'place_of_worship',
    label: "Place of Worship",
    aliases: [],
    matchers: [{ 'amenity': 'place_of_worship' }],
  },
  {
    id: 'mosque',
    label: "Mosque",
    aliases: [],
    matchers: [{ 'amenity': 'place_of_worship', 'religion': 'muslim' }],
  },
  {
    id: 'church',
    label: "Church",
    aliases: [],
    matchers: [{ 'amenity': 'place_of_worship', 'religion': 'christian' }],
  },
  {
    id: 'temple',
    label: "Temple",
    aliases: [],
    matchers: [{ 'amenity': 'place_of_worship', 'religion': 'hindu' }],
  },
  {
    id: 'synagogue',
    label: "Synagogue",
    aliases: [],
    matchers: [{ 'amenity': 'place_of_worship', 'religion': 'jewish' }],
  },
  {
    id: 'library',
    label: "Library",
    aliases: [],
    matchers: [{ 'amenity': 'library' }],
  },
  {
    id: 'museum',
    label: "Museum",
    aliases: [],
    matchers: [{ 'tourism': 'museum' }],
  },
  {
    id: 'theatre',
    label: "Theatre",
    aliases: [],
    matchers: [{ 'amenity': 'theatre' }],
  },
  {
    id: 'cinema',
    label: "Cinema",
    aliases: [],
    matchers: [{ 'amenity': 'cinema' }],
  },
  {
    id: 'hotel',
    label: "Hotel",
    aliases: [],
    matchers: [{ 'tourism': 'hotel' }],
  },
  {
    id: 'pharmacy',
    label: "Pharmacy",
    aliases: [],
    matchers: [{ 'amenity': 'pharmacy' }],
  },
  {
    id: 'clinic',
    label: "Clinic",
    aliases: [],
    matchers: [{ 'amenity': 'clinic' }],
  },
  {
    id: 'dentist',
    label: "Dentist",
    aliases: [],
    matchers: [{ 'amenity': 'dentist' }],
  },
  {
    id: 'veterinary',
    label: "Veterinary",
    aliases: [],
    matchers: [{ 'amenity': 'veterinary' }],
  },
  {
    id: 'post_office',
    label: "Post Office",
    aliases: [],
    matchers: [{ 'amenity': 'post_office' }],
  },
  {
    id: 'recycling',
    label: "Recycling Center",
    aliases: [],
    matchers: [{ 'amenity': 'recycling' }],
  },
  {
    id: 'observatory',
    label: "Observatory",
    aliases: [],
    matchers: [{ 'man_made': 'observatory' }],
  },
  {
    id: 'crane',
    label: "Crane",
    aliases: [],
    matchers: [{ 'man_made': 'crane' }],
  },
  {
    id: 'windmill',
    label: "Windmill",
    aliases: [],
    matchers: [{ 'man_made': 'windmill' }],
  },
  {
    id: 'watermill',
    label: "Watermill",
    aliases: [],
    matchers: [{ 'man_made': 'watermill' }],
  },
  {
    id: 'works',
    label: "Works",
    aliases: [],
    matchers: [{ 'man_made': 'works' }],
  },
  {
    id: 'gasometer',
    label: "Gasometer",
    aliases: [],
    matchers: [{ 'man_made': 'gasometer' }],
  },
  {
    id: 'bunker',
    label: "Bunker",
    aliases: [],
    matchers: [{ 'military': 'bunker' }],
  },
  {
    id: 'barracks',
    label: "Barracks",
    aliases: [],
    matchers: [{ 'military': 'barracks' }],
  },
  {
    id: 'airfield',
    label: "Military Airfield",
    aliases: [],
    matchers: [{ 'military': 'airfield' }],
  },
  {
    id: 'naval_base',
    label: "Naval Base",
    aliases: [],
    matchers: [{ 'military': 'naval_base' }],
  },
  {
    id: 'nuclear_site',
    label: "Nuclear Site",
    aliases: [],
    matchers: [{ 'military': 'nuclear_explosion_site' }],
  },
  {
    id: 'range',
    label: "Military Range",
    aliases: [],
    matchers: [{ 'military': 'range' }],
  },
  {
    id: 'checkpoint',
    label: "Checkpoint",
    aliases: [],
    matchers: [{ 'military': 'checkpoint' }],
  },
  {
    id: 'border_control',
    label: "Border Control",
    aliases: [],
    matchers: [{ 'barrier': 'border_control' }],
  },
  {
    id: 'hydroelectric',
    label: "Hydroelectric Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'hydro' }],
  },
  {
    id: 'geothermal',
    label: "Geothermal Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'geothermal' }],
  },
  {
    id: 'biogas',
    label: "Biogas Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'biogas' }],
  },
  {
    id: 'biomass',
    label: "Biomass Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'biomass' }],
  },
  {
    id: 'tidal',
    label: "Tidal Power Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'tidal' }],
  },
  {
    id: 'coal',
    label: "Coal Power Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'coal' }],
  },
  {
    id: 'gas_power',
    label: "Gas Power Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'gas' }],
  },
  {
    id: 'oil_power',
    label: "Oil Power Plant",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'oil' }],
  },
  {
    id: 'transformer',
    label: "Transformer",
    aliases: [],
    matchers: [{ 'power': 'transformer' }],
  },
  {
    id: 'power_line',
    label: "Power Line",
    aliases: [],
    matchers: [{ 'power': 'line' }],
  },
  {
    id: 'power_pole',
    label: "Power Pole",
    aliases: [],
    matchers: [{ 'power': 'pole' }],
  },
  {
    id: 'runway',
    label: "Runway",
    aliases: [],
    matchers: [{ 'aeroway': 'runway' }],
  },
  {
    id: 'taxiway',
    label: "Taxiway",
    aliases: [],
    matchers: [{ 'aeroway': 'taxiway' }],
  },
  {
    id: 'terminal',
    label: "Airport Terminal",
    aliases: [],
    matchers: [{ 'aeroway': 'terminal' }],
  },
  {
    id: 'hangar',
    label: "Hangar",
    aliases: [],
    matchers: [{ 'aeroway': 'hangar' }],
  },
  {
    id: 'seaport',
    label: "Seaport",
    aliases: [],
    matchers: [{ 'industrial': 'port' }],
  },
  {
    id: 'marina',
    label: "Marina",
    aliases: [],
    matchers: [{ 'leisure': 'marina' }],
  },
  {
    id: 'shipyard',
    label: "Shipyard",
    aliases: [],
    matchers: [{ 'industrial': 'shipyard' }],
  },
  {
    id: 'dock',
    label: "Dock",
    aliases: [],
    matchers: [{ 'waterway': 'dock' }],
  },
  {
    id: 'tram_stop',
    label: "Tram Stop",
    aliases: [],
    matchers: [{ 'railway': 'tram_stop' }],
  },
  {
    id: 'halt',
    label: "Railway Halt",
    aliases: [],
    matchers: [{ 'railway': 'halt' }],
  },
  {
    id: 'level_crossing',
    label: "Level Crossing",
    aliases: [],
    matchers: [{ 'railway': 'level_crossing' }],
  },
  {
    id: 'toll_booth',
    label: "Toll Booth",
    aliases: [],
    matchers: [{ 'barrier': 'toll_booth' }],
  },
  {
    id: 'weigh_station',
    label: "Weigh Station",
    aliases: [],
    matchers: [{ 'amenity': 'weighbridge' }],
  },
  {
    id: 'cell_tower',
    label: "Cell Tower",
    aliases: ['cell towers', 'mobile tower', 'mobile towers', 'cellular tower', 'cellphone tower'],
    matchers: [
          { 'communication:mobile_phone': 'yes' },
          { 'tower:type': 'communications_tower' },
          { 'man_made': 'communications_tower' }
        ],
  },
  {
    id: 'radio_tower',
    label: "Radio Tower",
    aliases: [],
    matchers: [{ 'man_made': 'tower', 'tower:type': 'communication' }],
  },
  {
    id: 'broadcast_tower',
    label: "Broadcast Tower",
    aliases: [],
    matchers: [{ 'man_made': 'tower', 'tower:type': 'broadcast' }],
  },
  {
    id: 'satellite_dish',
    label: "Satellite Dish",
    aliases: [],
    matchers: [{ 'man_made': 'satellite_dish' }],
  },
  {
    id: 'telephone_exchange',
    label: "Telephone Exchange",
    aliases: [],
    matchers: [{ 'telecom': 'exchange' }],
  },
  {
    id: 'ambulance_station',
    label: "Ambulance Station",
    aliases: [],
    matchers: [{ 'emergency': 'ambulance_station' }],
  },
  {
    id: 'emergency_phone',
    label: "Emergency Phone",
    aliases: [],
    matchers: [{ 'emergency': 'phone' }],
  },
  {
    id: 'fire_hydrant',
    label: "Fire Hydrant",
    aliases: [],
    matchers: [{ 'emergency': 'fire_hydrant' }],
  },
  {
    id: 'lifeguard',
    label: "Lifeguard Station",
    aliases: [],
    matchers: [{ 'emergency': 'lifeguard' }],
  },
  {
    id: 'rescue_station',
    label: "Rescue Station",
    aliases: [],
    matchers: [{ 'emergency': 'rescue_station' }],
  },
  {
    id: 'coast_guard',
    label: "Coast Guard",
    aliases: [],
    matchers: [{ 'emergency': 'coast_guard' }],
  },
  {
    id: 'townhall',
    label: "Town Hall",
    aliases: [],
    matchers: [{ 'amenity': 'townhall' }],
  },
  {
    id: 'government',
    label: "Government Office",
    aliases: [],
    matchers: [{ 'office': 'government' }],
  },
  {
    id: 'customs',
    label: "Customs Office",
    aliases: [],
    matchers: [{ 'office': 'customs' }],
  },
  {
    id: 'tax_office',
    label: "Tax Office",
    aliases: [],
    matchers: [{ 'office': 'tax' }],
  },
  {
    id: 'kindergarten',
    label: "Kindergarten",
    aliases: [],
    matchers: [{ 'amenity': 'kindergarten' }],
  },
  {
    id: 'driving_school',
    label: "Driving School",
    aliases: [],
    matchers: [{ 'amenity': 'driving_school' }],
  },
  {
    id: 'research',
    label: "Research Institute",
    aliases: [],
    matchers: [{ 'amenity': 'research_institute' }],
  },
  {
    id: 'brewery',
    label: "Brewery",
    aliases: [],
    matchers: [{ 'craft': 'brewery' }],
  },
  {
    id: 'distillery',
    label: "Distillery",
    aliases: [],
    matchers: [{ 'craft': 'distillery' }],
  },
  {
    id: 'sawmill',
    label: "Sawmill",
    aliases: [],
    matchers: [{ 'craft': 'sawmill' }],
  },
  {
    id: 'slaughterhouse',
    label: "Slaughterhouse",
    aliases: [],
    matchers: [{ 'industrial': 'slaughterhouse' }],
  },
  {
    id: 'scrap_yard',
    label: "Scrap Yard",
    aliases: [],
    matchers: [{ 'industrial': 'scrap_yard' }],
  },
  {
    id: 'depot',
    label: "Depot",
    aliases: [],
    matchers: [{ 'industrial': 'depot' }],
  },
  {
    id: 'recycling_plant',
    label: "Recycling Plant",
    aliases: [],
    matchers: [{ 'industrial': 'recycling' }],
  },
  {
    id: 'sports_centre',
    label: "Sports Centre",
    aliases: [],
    matchers: [{ 'leisure': 'sports_centre' }],
  },
  {
    id: 'swimming_pool',
    label: "Swimming Pool",
    aliases: [],
    matchers: [{ 'leisure': 'swimming_pool' }],
  },
  {
    id: 'golf_course',
    label: "Golf Course",
    aliases: [],
    matchers: [{ 'leisure': 'golf_course' }],
  },
  {
    id: 'racetrack',
    label: "Racetrack",
    aliases: [],
    matchers: [{ 'leisure': 'track' }],
  },
  {
    id: 'ice_rink',
    label: "Ice Rink",
    aliases: [],
    matchers: [{ 'leisure': 'ice_rink' }],
  },
  {
    id: 'campsite',
    label: "Campsite",
    aliases: [],
    matchers: [{ 'tourism': 'camp_site' }],
  },
  {
    id: 'caravan_site',
    label: "Caravan Site",
    aliases: [],
    matchers: [{ 'tourism': 'caravan_site' }],
  },
  {
    id: 'theme_park',
    label: "Theme Park",
    aliases: [],
    matchers: [{ 'tourism': 'theme_park' }],
  },
  {
    id: 'zoo',
    label: "Zoo",
    aliases: [],
    matchers: [{ 'tourism': 'zoo' }],
  },
  {
    id: 'aquarium',
    label: "Aquarium",
    aliases: [],
    matchers: [{ 'tourism': 'aquarium' }],
  },
  {
    id: 'viewpoint',
    label: "Viewpoint",
    aliases: [],
    matchers: [{ 'tourism': 'viewpoint' }],
  },
  {
    id: 'attraction',
    label: "Tourist Attraction",
    aliases: [],
    matchers: [{ 'tourism': 'attraction' }],
  },
  {
    id: 'nursing_home',
    label: "Nursing Home",
    aliases: [],
    matchers: [{ 'amenity': 'nursing_home' }],
  },
  {
    id: 'hospice',
    label: "Hospice",
    aliases: [],
    matchers: [{ 'amenity': 'hospice' }],
  },
  {
    id: 'blood_bank',
    label: "Blood Bank",
    aliases: [],
    matchers: [{ 'healthcare': 'blood_bank' }],
  },
  {
    id: 'farm',
    label: "Farm",
    aliases: [],
    matchers: [{ 'landuse': 'farmland' }],
  },
  {
    id: 'greenhouse',
    label: "Greenhouse",
    aliases: [],
    matchers: [{ 'building': 'greenhouse' }],
  },
  {
    id: 'orchard',
    label: "Orchard",
    aliases: [],
    matchers: [{ 'landuse': 'orchard' }],
  },
  {
    id: 'vineyard',
    label: "Vineyard",
    aliases: [],
    matchers: [{ 'landuse': 'vineyard' }],
  },
  {
    id: 'monument',
    label: "Monument",
    aliases: [],
    matchers: [{ 'historic': 'monument' }],
  },
  {
    id: 'memorial',
    label: "Memorial",
    aliases: [],
    matchers: [{ 'historic': 'memorial' }],
  },
  {
    id: 'castle',
    label: "Castle",
    aliases: [],
    matchers: [{ 'historic': 'castle' }],
  },
  {
    id: 'fort',
    label: "Fort",
    aliases: [],
    matchers: [{ 'historic': 'fort' }],
  },
  {
    id: 'ruins',
    label: "Ruins",
    aliases: [],
    matchers: [{ 'historic': 'ruins' }],
  },
  {
    id: 'archaeological_site',
    label: "Archaeological Site",
    aliases: [],
    matchers: [{ 'historic': 'archaeological_site' }],
  },
  {
    id: 'clock_tower',
    label: "Clock Tower",
    aliases: [],
    matchers: [{ 'man_made': 'tower', 'tower:type': 'clock' }],
  },
  {
    id: 'bell_tower',
    label: "Bell Tower",
    aliases: [],
    matchers: [{ 'man_made': 'tower', 'tower:type': 'bell_tower' }],
  },
  {
    id: 'water_well',
    label: "Water Well",
    aliases: [],
    matchers: [{ 'man_made': 'water_well' }],
  },
  {
    id: 'reservoir',
    label: "Reservoir",
    aliases: [],
    matchers: [{ 'landuse': 'reservoir' }],
  },
  {
    id: 'pumping_station',
    label: "Pumping Station",
    aliases: [],
    matchers: [{ 'man_made': 'pumping_station' }],
  },
  {
    id: 'rest_area',
    label: "Rest Area",
    aliases: [],
    matchers: [{ 'highway': 'rest_area' }],
  },
  {
    id: 'service_area',
    label: "Service Area",
    aliases: [],
    matchers: [{ 'highway': 'services' }],
  },
  {
    id: 'atc_tower',
    label: "ATC Tower",
    aliases: [],
    matchers: [{ 'aeroway': 'control_tower' }],
  },
  {
    id: 'bicycle_parking',
    label: "Bicycle Parking",
    aliases: [],
    matchers: [{ 'amenity': 'bicycle_parking' }],
  },
  {
    id: 'drinking_water',
    label: "Drinking Water",
    aliases: [],
    matchers: [{ 'amenity': 'drinking_water' }],
  },
  {
    id: 'public_toilet',
    label: "Public Toilet",
    aliases: [],
    matchers: [{ 'amenity': 'toilets' }],
  },
  {
    id: 'bench',
    label: "Bench",
    aliases: [],
    matchers: [{ 'amenity': 'bench' }],
  },
  {
    id: 'waste_basket',
    label: "Waste Basket",
    aliases: [],
    matchers: [{ 'amenity': 'waste_basket' }],
  },
  {
    id: 'pier',
    label: "Pier",
    aliases: [],
    matchers: [{ 'man_made': 'pier' }],
  },
  {
    id: 'jetty',
    label: "Jetty",
    aliases: [],
    matchers: [{ 'man_made': 'jetty' }],
  },
  {
    id: 'slipway',
    label: "Slipway",
    aliases: [],
    matchers: [{ 'leisure': 'slipway' }],
  },
  {
    id: 'boat_lift',
    label: "Boat Lift",
    aliases: [],
    matchers: [{ 'waterway': 'boat_lift' }],
  },
  {
    id: 'mooring',
    label: "Mooring",
    aliases: [],
    matchers: [{ 'waterway': 'mooring' }],
  },
  {
    id: 'aerialway',
    label: "Cable Car",
    aliases: [],
    matchers: [{ 'aerialway': 'cable_car' }],
  },
  {
    id: 'gondola',
    label: "Gondola",
    aliases: [],
    matchers: [{ 'aerialway': 'gondola' }],
  },
  {
    id: 'funicular',
    label: "Funicular",
    aliases: [],
    matchers: [{ 'aerialway': 'funicular' }],
  },
  {
    id: 'chairlift',
    label: "Chairlift",
    aliases: [],
    matchers: [{ 'aerialway': 'chair_lift' }],
  },
  {
    id: 'battery_storage',
    label: "Battery Storage",
    aliases: [],
    matchers: [{ 'power': 'generator', 'generator:source': 'battery' }],
  },
  {
    id: 'converter',
    label: "Power Converter",
    aliases: [],
    matchers: [{ 'power': 'converter' }],
  },
  {
    id: 'switch',
    label: "Power Switch",
    aliases: [],
    matchers: [{ 'power': 'switch' }],
  },
  {
    id: 'street_lamp',
    label: "Street Lamp",
    aliases: [],
    matchers: [{ 'highway': 'street_lamp' }],
  },
  {
    id: 'traffic_signals',
    label: "Traffic Signals",
    aliases: [],
    matchers: [{ 'highway': 'traffic_signals' }],
  },
  {
    id: 'siren',
    label: "Emergency Siren",
    aliases: [],
    matchers: [{ 'emergency': 'siren' }],
  },
  {
    id: 'defibrillator',
    label: "Defibrillator",
    aliases: [],
    matchers: [{ 'emergency': 'defibrillator' }],
  },
  {
    id: 'assembly_point',
    label: "Assembly Point",
    aliases: [],
    matchers: [{ 'emergency': 'assembly_point' }],
  },
  {
    id: 'life_ring',
    label: "Life Ring",
    aliases: [],
    matchers: [{ 'emergency': 'life_ring' }],
  },
  {
    id: 'information',
    label: "Tourist Information",
    aliases: [],
    matchers: [{ 'tourism': 'information' }],
  },
  {
    id: 'picnic_site',
    label: "Picnic Site",
    aliases: [],
    matchers: [{ 'tourism': 'picnic_site' }],
  },
  {
    id: 'supermarket',
    label: "Supermarket",
    aliases: [],
    matchers: [{ 'shop': 'supermarket' }],
  },
  {
    id: 'mall',
    label: "Shopping Mall",
    aliases: [],
    matchers: [{ 'shop': 'mall' }],
  },
  {
    id: 'marketplace',
    label: "Marketplace",
    aliases: [],
    matchers: [{ 'amenity': 'marketplace' }],
  },
  {
    id: 'bicycle_rental',
    label: "Bike Sharing",
    aliases: [],
    matchers: [{ 'amenity': 'bicycle_rental' }],
  },
  {
    id: 'car_sharing',
    label: "Car Sharing",
    aliases: [],
    matchers: [{ 'amenity': 'car_sharing' }],
  },
  {
    id: 'planetarium',
    label: "Planetarium",
    aliases: [],
    matchers: [{ 'amenity': 'planetarium' }],
  },
  {
    id: 'laboratory',
    label: "Laboratory",
    aliases: [],
    matchers: [{ 'man_made': 'laboratory' }],
  },
  {
    id: 'construction_site',
    label: "Construction Site",
    aliases: [],
    matchers: [{ 'landuse': 'construction' }],
  },
  {
    id: 'winery',
    label: "Winery",
    aliases: [],
    matchers: [{ 'craft': 'winery' }],
  },
  {
    id: 'bakery',
    label: "Bakery",
    aliases: [],
    matchers: [{ 'craft': 'bakery' }],
  },
  {
    id: 'dairy',
    label: "Dairy",
    aliases: [],
    matchers: [{ 'craft': 'dairy' }],
  },
  {
    id: 'taxi_stand',
    label: "Taxi Stand",
    aliases: [],
    matchers: [{ 'amenity': 'taxi' }],
  },
  {
    id: 'bicycle_repair',
    label: "Bicycle Repair Station",
    aliases: [],
    matchers: [{ 'amenity': 'bicycle_repair_station' }],
  },
  {
    id: 'car_wash',
    label: "Car Wash",
    aliases: [],
    matchers: [{ 'amenity': 'car_wash' }],
  },
  {
    id: 'post_box',
    label: "Post Box",
    aliases: [],
    matchers: [{ 'amenity': 'post_box' }],
  },
  {
    id: 'telephone',
    label: "Public Telephone",
    aliases: [],
    matchers: [{ 'amenity': 'telephone' }],
  },
  {
    id: 'community_centre',
    label: "Community Centre",
    aliases: [],
    matchers: [{ 'amenity': 'community_centre' }],
  },
  {
    id: 'social_facility',
    label: "Social Facility",
    aliases: [],
    matchers: [{ 'amenity': 'social_facility' }],
  },
  {
    id: 'shelter',
    label: "Shelter",
    aliases: [],
    matchers: [{ 'amenity': 'shelter' }],
  },
  {
    id: 'restaurant',
    label: "Restaurant",
    aliases: [],
    matchers: [{ 'amenity': 'restaurant' }],
  },
  {
    id: 'cafe',
    label: "Cafe",
    aliases: [],
    matchers: [{ 'amenity': 'cafe' }],
  },
  {
    id: 'fast_food',
    label: "Fast Food",
    aliases: [],
    matchers: [{ 'amenity': 'fast_food' }],
  },
  {
    id: 'playground',
    label: "Playground",
    aliases: [],
    matchers: [{ 'leisure': 'playground' }],
  },
  {
    id: 'park',
    label: "Park",
    aliases: [],
    matchers: [{ 'leisure': 'park' }],
  },
  {
    id: 'pitch',
    label: "Sports Pitch",
    aliases: [],
    matchers: [{ 'leisure': 'pitch' }],
  },
  {
    id: 'fountain',
    label: "Fountain",
    aliases: [],
    matchers: [{ 'amenity': 'fountain' }],
  },
  {
    id: 'waterfall',
    label: "Waterfall",
    aliases: [],
    matchers: [{ 'waterway': 'waterfall' }],
  },
  {
    id: 'hot_spring',
    label: "Hot Spring",
    aliases: [],
    matchers: [{ 'natural': 'hot_spring' }],
  },
  {
    id: 'monitoring_station',
    label: "Monitoring Station",
    aliases: [],
    matchers: [{ 'man_made': 'monitoring_station' }],
  },
  {
    id: 'weather_station',
    label: "Weather Station",
    aliases: [],
    matchers: [{ 'man_made': 'weather_station' }],
  },
] as const satisfies readonly AssetType[]

export type CanonicalType = (typeof ASSET_TYPES)[number]['id']

const byId = new Map<string, AssetType>()
const aliasToId = new Map<string, string>()

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

for (const t of ASSET_TYPES) {
  byId.set(t.id, t)
  aliasToId.set(norm(t.id), t.id)
  aliasToId.set(norm(t.label), t.id)
  for (const a of t.aliases) aliasToId.set(norm(a), t.id)
}

export function resolveType(token: string | null | undefined): string | null {
  if (!token) return null
  return aliasToId.get(norm(token)) ?? null
}

export function getAssetType(id: string): AssetType | undefined {
  return byId.get(id)
}

/** Longest-first phrases used by the NL parser. */
export function typePhrases(): { phrase: string; id: string }[] {
  const out: { phrase: string; id: string }[] = []
  const seen = new Set<string>()
  const add = (phrase: string, id: string) => {
    const p = norm(phrase)
    if (p.length < 2 || seen.has(p)) return
    seen.add(p)
    out.push({ phrase: p, id })
  }
  for (const t of ASSET_TYPES) {
    add(t.id.replace(/_/g, ' '), t.id)
    add(t.label, t.id)
    add(t.label + 's', t.id)
    for (const a of t.aliases) add(a, t.id)
  }
  out.sort((a, b) => b.phrase.length - a.phrase.length)
  return out
}

export const OPERATOR_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "airtel": ["bharti airtel", "airtel india", "airtel telecom"],
  "jio": ["reliance jio", "jio infocomm"],
  "vodafone": ["vodafone idea", "vi", "vodafone india"],
  "bsnl": ["bharat sanchar nigam"],
  "google": ["google llc", "google inc"],
  "amazon": ["amazon web services", "aws"],
  "microsoft": ["microsoft azure", "azure"],
  "meta": ["facebook", "meta platforms"],
  "apple": ["apple inc"],
  "at&t": ["att", "at and t"],
  "verizon": ["verizon wireless"],
  "t-mobile": ["tmobile", "t mobile"],
  "vodacom": ["vodacom group"],
  "mtn": ["mtn group"],
  "orange": ["orange telecom"],
  "telefonica": ["movistar"],
  "china mobile": ["cmcc"],
  "china unicom": [],
  "china telecom": [],
  "ntpc": ["national thermal power corporation"],
  "adani": ["adani power", "adani green"],
  "tata": ["tata power", "tata steel"],
  "reliance": ["reliance industries", "ril"],
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  return new RegExp(`\\b${escapeRe(needle)}\\b`, 'i').test(haystack)
}

export function resolveOperator(text: string): string | null {
  const normalized = text.toLowerCase()
  for (const [canonical, aliases] of Object.entries(OPERATOR_ALIASES)) {
    if (hasWord(normalized, canonical)) return canonical
    for (const alias of aliases) {
      if (alias && hasWord(normalized, alias)) return canonical
    }
  }
  return null
}
