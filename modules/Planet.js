/**
 * @fileoverview Planet model and related classes
 * @module core/Planet
 */

import { PLANET_TYPES, SURFACE_ZONE_TYPES, BATTLE_STATUS, CONFIG, HARVEST_YIELDS } from '../config/constants.js';
import { generateId, randomChoice } from '../utils/helpers.js';

/**
 * Represents a planet in the galaxy
 * @class Planet
 */
export class Planet {
  /**
   * @param {Object} data - Planet initialization data
   */
  constructor(data) {
    this._id = data.id || generateId();
    this._name = data.name;
    this._type = data.type;
    this._position = data.position;
    this._owner = data.owner || null;
    this._value_one = data.value_one !== undefined 
      ? data.value_one 
      : (PLANET_TYPES[data.type]?.baseValueOne ?? 0);
    this._value_two = data.value_two !== undefined 
      ? data.value_two 
      : (PLANET_TYPES[data.type]?.baseValueTwo ?? 0);
    this._battleStatus = data.battleStatus || BATTLE_STATUS.NONE;
    this._connections = data.connections || [];
    this._history = data.history || [];
    
    // DESTROYED planets have no resources or surface zones
    if (data.type === 'DESTROYED') {
      this._resources = data.resources || {};
      this._surfaceZones = data.surfaceZones || [];
    } else {
      this._resources = data.resources !== undefined ? data.resources : this._generateResources();
      this._surfaceZones = data.surfaceZones || this._generateSurfaceZones();
    }
  }

  // Getters
  get id() { return this._id; }
  get name() { return this._name; }
  get type() { return this._type; }
  get position() { return this._position; }
  get owner() { return this._owner; }
  get value_one() { return this._value_one; }
  get value_two() { return this._value_two; }
  get battleStatus() { return this._battleStatus; }
  get connections() { return [...this._connections]; }
  get history() { return [...this._history]; }
  get resources() { return { ...this._resources }; }
  set resources(value) { this._resources = { ...value }; }
  get surfaceZones() { return [...this._surfaceZones]; }

  // Setters with validation
  set name(value) { this._name = value; }
  set type(value) { 
    if (PLANET_TYPES[value]) {
      this._type = value; 
    }
  }
  set owner(value) { this._owner = value; }
  set value_one(value) { this._value_one = Math.max(0, value); }
  set value_two(value) { this._value_two = Math.max(0, value); }
  set battleStatus(value) { 
    if (Object.values(BATTLE_STATUS).includes(value)) {
      this._battleStatus = value; 
    }
  }

  /**
   * Generate random resources for a planet
   * @private
   * @returns {Object} Resource map
   */
  _generateResources() {
    // Check if this planet type has defined harvest yields
    const yields = HARVEST_YIELDS[this._type];
    if (yields) {
      // Use defined yields (including negative values) from constants
      return { ...yields };
    }
    
    // Fallback to random resources for types without defined yields
    const resources = {};
    const resourceCount = Math.floor(Math.random() * 3) + 1;
    const allResources = app?.resourceManager?.getAll() || [
      { id: 'resource1' }, { id: 'resource2' }, { id: 'resource3' }, { id: 'resource4' }
    ];
    const resourceTypes = allResources.map(r => r.id);
    
    for (let i = 0; i < resourceCount; i++) {
      const type = randomChoice(resourceTypes);
      resources[type] = (resources[type] || 0) + Math.floor(Math.random() * 3) + 1;
    }
    
    return resources;
  }

  /**
   * Generate surface zones for the planet
   * @private
   * @returns {Array} Array of surface zones
   */
  _generateSurfaceZones() {
    const zones = [];
    
    for (let i = 0; i < CONFIG.SURFACE_ZONES_PER_PLANET; i++) {
      const zoneType = randomChoice(SURFACE_ZONE_TYPES);
      zones.push({
        id: generateId(),
        name: `${zoneType.name} ${String.fromCharCode(65 + i)}`,
        type: zoneType.id,
        icon: zoneType.icon,
        controller: this._owner,
        contested: false,
        value_two: Math.floor(Math.random() * 3),
      });
    }
    
    return zones;
  }

  /**
   * Set planet owner and update surface zones
   * @param {string|null} factionId - New owner faction ID
   * @param {boolean} recordHistory - Whether to record in history
   */
  setOwner(factionId, recordHistory = true) {
    const previousOwner = this._owner;
    this._owner = factionId;
    
    // Update surface zone controllers
    this._surfaceZones.forEach(zone => {
      if (!zone.contested) {
        zone.controller = factionId;
      }
    });
    
    if (recordHistory && previousOwner !== factionId) {
      this._history.push({
        turn: window.app?.galaxy?.turn || 0,
        event: 'conquest',
        from: previousOwner,
        to: factionId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Set surface zone controller
   * @param {string} zoneId - Zone ID
   * @param {string} factionId - New controller faction ID
   */
  setSurfaceZoneController(zoneId, factionId) {
    const zone = this._surfaceZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    zone.controller = factionId;
    zone.contested = false;
    
    // Check for majority rule
    const counts = {};
    this._surfaceZones.forEach(z => {
      if (z.controller) {
        counts[z.controller] = (counts[z.controller] || 0) + 1;
      }
    });
    
    const majority = Object.keys(counts).reduce((a, b) => 
      counts[a] > counts[b] ? a : b
    );
    
    if (counts[majority] > this._surfaceZones.length / 2) {
      this.setOwner(majority);
    }
  }

  /**
   * Set zone contested status
   * @param {string} zoneId - Zone ID
   * @param {boolean} contested - Contested status
   */
  setZoneContested(zoneId, contested = true) {
    const zone = this._surfaceZones.find(z => z.id === zoneId);
    if (zone) {
      zone.contested = contested;
    }
  }

  /**
   * Set battle status
   * @param {string} status - Battle status
   */
  setBattleStatus(status) {
    if (Object.values(BATTLE_STATUS).includes(status)) {
      this._battleStatus = status;
    }
  }

  /**
   * Add a connection to another planet
   * @param {string} planetId - Target planet ID
   */
  addConnection(planetId) {
    if (!this._connections.includes(planetId)) {
      this._connections.push(planetId);
    }
  }

  /**
   * Remove a connection
   * @param {string} planetId - Target planet ID
   */
  removeConnection(planetId) {
    const index = this._connections.indexOf(planetId);
    if (index !== -1) {
      this._connections.splice(index, 1);
    }
  }

  /**
   * Check if planet has connection
   * @param {string} planetId - Target planet ID
   * @returns {boolean} True if connected
   */
  hasConnection(planetId) {
    return this._connections.includes(planetId);
  }

  /**
   * Get planet type information
   * @returns {Object} Planet type data
   */
  getTypeInfo() {
    return PLANET_TYPES[this._type];
  }

  /**
   * Get a planet value by ID
   * @param {string} valueId - Value ID to retrieve
   * @returns {*} Value or undefined if not found
   */
  getValue(valueId) {
    switch (valueId) {
      case 'value_one':
        return this._value_one;
      case 'value_two':
        return this._value_two;
      default:
        return undefined;
    }
  }

  /**
   * Serialize planet to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this._id,
      name: this._name,
      type: this._type,
      position: this._position,
      owner: this._owner,
      value_one: this._value_one,
      value_two: this._value_two,
      resources: this._resources,
      surfaceZones: this._surfaceZones,
      battleStatus: this._battleStatus,
      connections: this._connections,
      history: this._history,
    };
  }

  /**
   * Create planet from JSON
   * @static
   * @param {Object} data - JSON data
   * @returns {Planet} New Planet instance
   */
  static fromJSON(data) {
    return new Planet(data);
  }
}

/**
 * Planet generator utility
 * @class PlanetGenerator
 */
export class PlanetGenerator {
  /**
   * Generate a random planet name
   * @static
   * @returns {string} Generated name
   */
  static generateName() {
    const prefixes = [
      'Primus', 'Secundus', 'Tertius', 'Magnus', 'Minoris',
      'Ultima', 'Proxima', 'Nova'
    ];
    
    const roots = [
      'Armageddon', 'Cadia', 'Macragge', 'Fenris', 'Baal',
      'Nocturne', 'Medusa', 'Chogoris', 'Caliban', 'Prospero',
      'Olympia', 'Colchis', 'Barbarus', 'Chemos', 'Deliverance'
    ];
    
    const suffixes = [
      'Prime', 'Secundus', 'Tertius', 'Major', 'Minor',
      'Extremis', 'Ultimata'
    ];

    let name = randomChoice(roots);
    if (Math.random() > 0.5) {
      name = randomChoice(prefixes) + ' ' + name;
    }
    if (Math.random() > 0.5) {
      name = name + ' ' + randomChoice(suffixes);
    }
    
    return name;
  }

  /**
   * Generate a random planet
   * @static
   * @param {Object} position - Optional position
   * @returns {Planet} New random Planet
   */
  static generateRandom(position) {
    const types = Object.keys(PLANET_TYPES);
    
    // Generate position in a circular arrangement around galaxy center
    if (!position) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 80; // Radius between 50-130 units
      position = {
        x: Math.cos(angle) * radius,
        y: (Math.random() - 0.5) * 20, // Small height variation
        z: Math.sin(angle) * radius,
      };
    }
    
    return new Planet({
      name: this.generateName(),
      type: randomChoice(types),
      position: position,
    });
  }
}
