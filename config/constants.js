/* ============================================
   Game constants and configuration
   ============================================ */

export const PLANET_TYPES = {
    HIVE:      { name:'Hive World',         color:0x8b4513, icon:'🏙️', description:'Description to be added...', baseValueOne:5, baseValueTwo:3 },
    FORGE:     { name:'Forge World',        color:0xff4500, icon:'⚙️', description:'Description to be added...', baseValueOne:6, baseValueTwo:4 },
    AGRI:      { name:'Agri World',         color:0x228b22, icon:'🌾', description:'Description to be added...', baseValueOne:3, baseValueTwo:2 },
    DEATH:     { name:'Death World',        color:0x2f4f2f, icon:'☠️', description:'Description to be added...', baseValueOne:2, baseValueTwo:5 },
    SHRINE:    { name:'Shrine World',       color:0xffd700, icon:'✝️', description:'Description to be added...', baseValueOne:4, baseValueTwo:3 },
    FEUDAL:    { name:'Feudal World',       color:0x8b7355, icon:'🏰', description:'Description to be added...', baseValueOne:2, baseValueTwo:2 },
    MINING:    { name:'Mining World',       color:0x696969, icon:'⛏️', description:'Description to be added...', baseValueOne:4, baseValueTwo:3 },
    FORTRESS:  { name:'Fortress World',     color:0x2f4f4f, icon:'🛡️', description:'Description to be added...', baseValueOne:3, baseValueTwo:8 },
    DEAD:      { name:'Dead World',         color:0x4a4a4a, icon:'💀', description:'Description to be added...', baseValueOne:1, baseValueTwo:1 },
    PARADISE:  { name:'Paradise World',     color:0x00ced1, icon:'🌴', description:'Description to be added...', baseValueOne:3, baseValueTwo:2 },
    CARDINAL:  { name:'Cardinal World',     color:0xb8860b, icon:'⛪', description:'Description to be added...', baseValueOne:5, baseValueTwo:4 },
    FERAL:     { name:'Feral World',        color:0x556b2f, icon:'🦴', description:'Description to be added...', baseValueOne:1, baseValueTwo:1 },
    DESTROYED: { name:'Destroyed / Debris', color:0x3b2f2f, icon:'💥', description:'Description to be added...', baseValueOne:0, baseValueTwo:0 },
    CURSED:    { name:'Cursed World',       color:0x4b0082, icon:'🔮', description:'Description to be added...', baseValueOne:3, baseValueTwo:4 },
    WAR_TORN:  { name:'War-Torn World',     color:0x8b0000, icon:'⚔️', description:'Description to be added...', baseValueOne:2, baseValueTwo:6 },
    CORRUPTED: { name:'Corrupted World',    color:0x800080, icon:'☣️', description:'Description to be added...', baseValueOne:7, baseValueTwo:2 }
};

// ─── Galaxy Center Types ────────────────────────────────────────────────────
export const GALAXY_CENTER_TYPES = {
    SUN:        { name:'Sun', icon:'☀️',  color:0xffdd44, lightColor:0xfff5cc, lightIntensity:2.2, emissiveColor:0xffaa22, radius:8,  description:'Description to be added...' },
    WHITE_DWARF:{ name:'White Dwarf',        icon:'✨',  color:0xeeeeff, lightColor:0xddeeff, lightIntensity:1.4, emissiveColor:0xccccff, radius:5,  description:'Description to be added...' },
    GAS_GIANT: { name:'Gas Giant',           icon:'🪐',  color:0xc8724a, lightColor:0xffaa66, lightIntensity:0.6, emissiveColor:0x442211, radius:12, description:'Description to be added...' },
    BLACK_HOLE:{ name:'Black Hole',          icon:'🕳️', color:0x050505, lightColor:0x9933ff, lightIntensity:1.8, emissiveColor:0x220044, radius:6,  description:'Description to be added...' },
    EMPTY:     { name:'Empty Void',          icon:'⬛',  color:0x0a0a0a, lightColor:0x222222, lightIntensity:0.3, emissiveColor:0x050505, radius:0,  description:'Description to be added...' }
};

// ─── Sector Names ─────────────────────────────
export const SECTOR_NAMES = [
    'Sector A','Sector B','Sector C',
    'Sector D','Sector E','Sector F',
    'Sector G','Sector H','Sector I',
    'Sector J','Sector K','Sector L',
    'Sector M','Sector N','Sector O'
];

// ─── Shop Items ─────────────────────────────────────────────────────────────
export const SHOP_ITEMS = [
    { id:'value_two_boost', name:'Raise Value Two', icon:'🛡️', description:'+2 Value Two on selected Planet.', cost:{resource1:2,resource3:1}, category:'military', targetRequired:true },
    { id:'value_one_boost', name:'Raise Value One', icon:'🛡️', description:'+1 Value One on selected Planet.', cost:{resource2:2,resource1:1}, category:'economy', targetRequired:true },
    { id:'deploy_ship', name:'Add Fleet', icon:'�', description:'Deploy Fleet on selected Planet', cost:{resource2:3,resource4:1}, category:'military', targetRequired:true },
    { id:'fortify', name:'Siege', icon:'🏰', description:'Start Siege on selected Planet (+4 Value Two)', cost:{resource3:3,resource2:2}, category:'military', targetRequired:true },
    { id:'spy_network', name:'Spy Network', icon:'�', description:'Reveal information for 3 turns', cost:{resource4:2}, category:'intelligence', targetRequired:false },
    { id:'propaganda', name:'Supply Lines', icon:'📢', description:'+1 Value One on all Planets you own', cost:{resource1:1,resource4:1}, category:'economy', targetRequired:false },
    { id:'elite_training', name:'Elite Training', icon:'⭐', description:'+1 Value Two and doubled effectiveness', cost:{resource1:2,resource2:2}, category:'military', targetRequired:true },
    { id:'planetary_defense', name:'Planetary Defense', icon:'🛡️', description:'Permanent +2 Value Two', cost:{resource3:3,resource2:1}, category:'military', targetRequired:true },
    { id:'trade_hub', name:'Trade Hub', icon:'💰', description:'+50% resource yield', cost:{resource1:2,resource2:2}, category:'economy', targetRequired:true },
    { id:'mining_upgrade', name:'Mining Upgrade', icon:'⛏️', description:'+1 to each resource type', cost:{resource2:2,resource3:2}, category:'economy', targetRequired:true },
    { id:'sabotage', name:'Sabotage', icon:'�', description:'Reduce enemy Value Two by 3', cost:{resource4:2,resource1:1}, category:'intelligence', targetRequired:true },
    { id:'infiltrate', name:'Infiltrate', icon:'🕵️', description:'Deploy Infiltration Unit', cost:{resource4:3}, category:'intelligence', targetRequired:true },
    { id:'warp_beacon', name:'Warp Beacon', icon:'🌌', description:'Create connection between two planets', cost:{resource4:4,resource2:2}, category:'tactical', targetRequired:true },
    { id:'resurrection', name:'Resurrection', icon:'✨', description:'Resurrect destroyed planet', cost:{resource4:5,resource1:3}, category:'special', targetRequired:true },
    { id:'super_weapon', name:'Super Weapon', icon:'☄️', description:'Destroy planet', cost:{resource4:8,resource2:5}, category:'super', targetRequired:true }
];

// ─── Resource Harvesting (per owned planet per turn-advance) ────────────────
export const HARVEST_YIELDS = {
    HIVE:{resource1:1}, FORGE:{resource2:2,resource3:1}, AGRI:{resource1:1},
    DEATH:{resource4:1}, SHRINE:{resource3:1}, FEUDAL:{resource1:1},
    MINING:{resource2:1,resource3:1}, FORTRESS:{resource3:2}, DEAD:{},
    PARADISE:{resource1:1}, CARDINAL:{resource3:1,resource4:1}, FERAL:{}, DESTROYED:{},
    CURSED:{resource1:1,resource3:-1},
    WAR_TORN:{resource2:1,resource4:-1},
    CORRUPTED:{resource4:2,resource1:-2}
};

// ─── Default Factions ─────────────────────────────────────────────
export const DEFAULT_FACTIONS = [
  {
    id: 'imperium',
    name: 'Imperium of Man',
    color: '#d4af37',
    symbol: '⧉',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'chaos',
    name: 'Chaos',
    color: '#8b0000',
    symbol: '☆',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'orks',
    name: 'Orks',
    color: '#228b22',
    symbol: '⚔',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'eldar',
    name: 'Aeldari',
    color: '#4169e1',
    symbol: '◆',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'tyranids',
    name: 'Tyranids',
    color: '#9400d3',
    symbol: '☬',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'necrons',
    name: 'Necrons',
    color: '#00ced1',
    symbol: '◇',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  },
  {
    id: 'tau',
    name: "T'au Empire",
    color: '#ff8c00',
    symbol: '◉',
    description: 'Description to be added...',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    homeworld: 'Homeworld to be added...',
    lore: 'Lore to be added...',
    leaders: 'Leaders to be added...',
    playstyle: 'Playstyle to be added...',
    military: 'Military units to be added...',
    strengths: 'Strengths to be added...',
    weaknesses: 'Weaknesses to be added...',
    allies: 'Allies to be added...',
    enemies: 'Enemies to be added...'
  }
];


export const EVENT_TYPES = {
    WARP_STORM:   { name:'Warp Storm',            icon:'🌪️', color:'#9400d3', description:'Blocks all routes through this system',   duration:3, effect:'blocks_travel'  },
    WORMHOLE:     { name:'Wormhole',              icon:'🌀', color:'#00ffff', description:'Creates a shortcut through space',        duration:5, effect:'creates_route'  },
    SPACE_HULK:   { name:'Space Hulk',            icon:'🛸', color:'#696969', description:'Derelict vessel with valuable technology',      duration:2, effect:'bonus_resources' },
    PLAGUE:       { name:'Plague',                icon:'☣️', color:'#8b8b00', description:'Reduces planet Value One or Value Two',       duration:4, effect:'debuff'         },
    EXTERMINATUS: { name:'Exterminatus',          icon:'💥', color:'#ff0000', description:'Planet destruction',            duration:1, effect:'destroy_planet'  },
    CRUSADE:      { name:'Reinforcements',         icon:'⚔️', color:'#ffd700', description:'Provides supply bonus / recovery',     duration:3, effect:'attack_bonus'    },
    ARCHAEOTECH:  { name:'Archaeotech Discovery', icon:'🔮', color:'#4169e1', description:'Ancient technology found',               duration:1, effect:'bonus_tech'      },
    WAAAGH:       { name:'WAAAGH!',               icon:'⚡', color:'#228b22', description:'NPC invasion force gathering',            duration:2, effect:'ork_invasion'    }
};

export const DEFAULT_RESOURCE_TYPES = [
    { id:'resource1', name:'Promethium',   icon:'⛽', color:'#ff4500' },
    { id:'resource2', name:'Adamantium',   icon:'🔩', color:'#696969' },
    { id:'resource3', name:'Ceramite',     icon:'🛡️', color:'#8b8b8b' },
    { id:'resource4', name:'Plasma Cores', icon:'⚡', color:'#00ffff' }
];

export const SURFACE_ZONE_TYPES = [
    { id:'capital',       name:'Capital',       icon:'🏛️' },
    { id:'industrial',   name:'Industrial',    icon:'🎛️' },
    { id:'military',     name:'Military Base', icon:'🪖' },
    { id:'spaceport',    name:'Spaceport',     icon:'🛰️' },
    { id:'agricultural', name:'Agricultural',  icon:'🌾' },
    { id:'mining',       name:'Mining',        icon:'⛏️' },
    { id:'research',     name:'Research',      icon:'🔬' },
    { id:'residential',  name:'Residential',   icon:'🏘️' },
    { id:'temple',       name:'Temple',        icon:'⛪' },
    { id:'wasteland',    name:'Wasteland',     icon:'💀' }
];

export const CONFIG = {
    AUTO_SAVE_INTERVAL: 5 * 60 * 1000,
    MAX_PLANETS: 50,
    MIN_PLANETS: 10,
    DEFAULT_GALAXY_SIZE: 20,
    CAMERA_ROTATION_SPEED: 0.0005,
    CAMERA_TRANSITION_SPEED: 0.08, // Smooth camera transition speed (0.01 = very slow, 0.2 = fast)
    ZOOM_SPEED: 0.1,
    MIN_ZOOM: 30,
    MAX_ZOOM: 300,
    PARTICLE_COUNT: 1000,
    PLANET_MIN_DISTANCE: 15,
    CONNECTION_PROBABILITY: 0.3,
    CONNECTION_MAX_PER_PLANET: 2,
    CONNECTION_DISTANCE: 120,
    SURFACE_ZONES_PER_PLANET: 16,
    SHIP_BOB_SPEED: 2.0,
    SHIP_BOB_AMPLITUDE: 0.55,
    // Sector disc layout
    SECTOR_INNER_RADIUS: 35,
    SECTOR_OUTER_RADIUS: 160,
    SECTOR_BAND_WIDTH: 60,
    SECTOR_Y_SPREAD: 50
};

export const BATTLE_STATUS = { NONE:'none', SKIRMISH:'skirmish', MAJOR:'major_battle', SIEGE:'siege' };

export const STRATAGEMS = {
    // Defensive
    orbital_shield: {
        id: 'orbital_shield',
        name: 'Orbital Shield',
        icon: '🛡️',
        description: 'Prevents attacks for 1 turn',
        cost: { resource3: 2 },
        cooldown: 3,
        targetRequired: true,
        category: 'defensive'
    },
    emergency_recall: {
        id: 'emergency_recall',
        name: 'Emergency Recall',
        icon: '↻',
        description: 'Recall ground units',
        cost: { resource4: 2 },
        cooldown: 4,
        targetRequired: true,
        category: 'defensive'
    },
    
    // Offensive
    orbital_bombardment: {
        id: 'orbital_bombardment',
        name: 'Orbital Bombardment',
        icon: '💥',
        description: '-4 Value Two on target planet',
        cost: { resource2: 2, resource4: 1 },
        cooldown: 2,
        targetRequired: true,
        category: 'offensive'
    },
    precision_strike: {
        id: 'precision_strike',
        name: 'Precision Strike',
        icon: '🎯',
        description: '-2 Value Two, destroy building on target area',
        cost: { resource2: 3 },
        cooldown: 3,
        targetRequired: true,
        category: 'offensive'
    },
    
    // Intelligence
    deep_space_scan: {
        id: 'deep_space_scan',
        name: 'Deep Space Scan',
        icon: '🔍',
        description: 'Reveal target Planet information',
        cost: { resource4: 2 },
        cooldown: 5,
        targetRequired: true,
        category: 'intelligence'
    },
    resource_sabotage: {
        id: 'resource_sabotage',
        name: 'Resource Sabotage',
        icon: '⚠️',
        description: 'Target Planet produces no resources next turn',
        cost: { resource1: 2 },
        cooldown: 3,
        targetRequired: true,
        category: 'intelligence'
    },
    
    // Economic
    resource_boost: {
        id: 'resource_boost',
        name: 'Resource Boost',
        icon: '⚡',
        description: 'Double resource production from one planet next turn',
        cost: { resource1: 1 },
        cooldown: 2,
        targetRequired: true,
        category: 'economic'
    },
    
    // Special
    warp_jump: {
        id: 'warp_jump',
        name: 'Warp Jump',
        icon: '⚡',
        description: 'Instantly move one fleet to any Planet',
        cost: { resource4: 3 },
        cooldown: 3,
        targetRequired: true,
        category: 'tactical'
    },
    psychic_scream: {
        id: 'psychic_scream',
        name: 'Psychic Scream',
        icon: '👁️',
        description: '-1 Value Two on all enemy Planets in sector',
        cost: { resource4: 4 },
        cooldown: 5,
        targetRequired: true,
        category: 'offensive'
    },
    establish_cult: {
        id: 'establish_cult',
        name: 'Establish Cult',
        icon: '🪬',
        description: 'Promotes rebellions on surface areas',
        cost: { resource4: 4 },
        cooldown: 5,
        targetRequired: true,
        category: 'offensive'
    }
};

// ─── Galactic Orders ─────────────────────────────────────────────────────────────
export const GALACTIC_ORDER_TEMPLATES = {
    CONQUEST: {
        name: 'Galactic Conquest',
        icon: '⚔️',
        description: 'Conquer {target} Planets in the {sector} sector within {turns} turns',
        reward: { resource2: 4, resource3: 3, resource4: 2 },
        weight: 35
    },
    LIBERATION: {
        name: 'Planetary Liberation Campaign',
        icon: '🔥',
        description: 'Take control of {target} Planets in the {sector} sector within {turns} turns',
        reward: { resource1: 5, resource2: 3, resource4: 2 },
        weight: 30
    },
    RESOURCE_GATHER: {
        name: 'Resource Collection',
        icon: '⛏️',
        description: 'Gather {amount} {resource} across all Planets within {turns} turns',
        reward: { resource1: 3, resource2: 2, resource4: 1 },
        weight: 25
    },
    DEFENSE: {
        name: 'Sector Defense',
        icon: '🛡️',
        description: 'Maintain control of {target} Planets in {sector} for {turns} turns',
        reward: { resource3: 4, resource2: 2 },
        weight: 20
    },
    EXPLORATION: {
        name: 'Exploration Mission',
        icon: '🚀',
        description: 'Discover and capture {target} new planets within {turns} turns',
        reward: { resource4: 3, resource1: 2 },
        weight: 15
    },
    DIPLOMACY: {
        name: 'Diplomatic Relations',
        icon: '🤝',
        description: 'Establish peaceful relations with {target} factions in {turns} turns',
        reward: { resource1: 2, resource4: 2 },
        weight: 10
    }
};

// ─── Auto-Distribution ────────────────────────────────────────────────────────
export const AUTO_DISTRIBUTION = {
    MANUAL: {
        name: 'Manual Allocation',
        icon: '✋',
        description: 'Set specific resource amounts for each faction each turn'
    }
};

// ─── Default Planet Values ───────────────────────────────────────────────────────
export const DEFAULT_PLANET_VALUES = [
    {
        id: 'value_one',
        name: 'Value One',
        type: 'integer',
        defaultValue: 1,
        order: 0
    },
    {
        id: 'value_two', 
        name: 'Value Two',
        type: 'integer',
        defaultValue: 1,
        order: 1
    },
    {
        id: 'strategic_might',
        name: 'Strategic Might',
        type: 'integer',
        defaultValue: 0,
        order: 2
    },
    {
        id: 'infrastructure',
        name: 'Infrastructure',
        type: 'text',
        defaultValue: '',
        order: 3
    }
];