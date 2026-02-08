// ═══════════════════════════════════════════════════════════════════════
// Galaxy core - central campaign state management
// ═══════════════════════════════════════════════════════════════════════
/**
 * @fileoverview
 * @module core/Galaxy
 */

import { Planet, PlanetGenerator } from '../modules/Planet.js';
import { EventManager } from '../modules/EventSystem.js';
import { ShopManager } from '../modules/ShopSystem.js';
import { ShipManager } from '../modules/ShipSystem.js';
import { GalacticOrderManager } from '../modules/GalacticOrderSystem.js';
import { StratagemManager } from '../modules/StratagemSystem.js';
import {
  CONFIG,
  GALAXY_CENTER_TYPES,
  SECTOR_NAMES,
  HARVEST_YIELDS,
  AUTO_DISTRIBUTION,
} from '../config/constants.js';
import { StorageService } from '../services/StorageService.js';
import { distance, generateId, randomChoice } from '../utils/helpers.js';

/**
 * Main galaxy class coordinating all campaign systems
 * @class Galaxy
 */
export class Galaxy {
  // Make imported constants available as static properties
  static AUTO_DISTRIBUTION = AUTO_DISTRIBUTION;
  
  constructor() {
    this._id = generateId();
    this._name = 'Crusade Campaign';
    this._turn = 1;
    this._planets = [];
    this._createdAt = Date.now();
    this._lastModified = Date.now();

    // Galaxy center
    this._galaxyCenter = { 
      type: 'SUN',
      crusadeName: 'A Great Crusade',
      crusadeDescription: 'Campaign info, basic rules and shedules, easily visible to the players.',
      customFields: [
        {
          name: 'Campaign Status',
          value: 'No active engagements.',
          type: 'long-text'
        }
      ]
    };

    // Sector layout
    this._sectors = [];

    // Per-faction resources
    this._playerResources = {};

    // Planet modifiers
    this._planetModifiers = {};

    // Auto-distribution settings
    this._autoDistribution = {
      enabled: false,
      mode: 'EQUAL',
      manualAllocation: {},
    };

    this._customDistributionModes = {};

    // Custom UI text
    this.customText = {};

    // Initialize subsystems
    this.eventManager = new EventManager();
    this.shopManager = new ShopManager(this);
    this.shipManager = new ShipManager(this);
    this.galacticOrderManager = new GalacticOrderManager(this);
    this.stratagemManager = new StratagemManager(this);
  }

  // Getters
  get id() { return this._id; }
  get name() { return this._name; }
  get turn() { return this._turn; }
  get planets() { return [...this._planets]; }
  get ships() { return this.shipManager.getAll(); }
  get galaxyCenter() { return { ...this._galaxyCenter }; }
  get sectors() { return [...this._sectors]; }
  get playerResources() { return this._playerResources; }
  get autoDistribution() { return this._autoDistribution; }
  get customDistributionModes() { return this._customDistributionModes; }
  get stratagemCooldowns() { return this.stratagemManager._cooldowns; }
  get createdAt() { return this._createdAt; }
  get lastModified() { return this._lastModified; }

  // Setters
  set name(value) { 
    this._name = value;
    this._lastModified = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLANET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Add a planet to the galaxy
   * @param {Planet|Object} planetData - Planet instance or data
   * @returns {Planet} Added planet
   */
  addPlanet(planetData) {
    const planet = planetData instanceof Planet 
      ? planetData 
      : new Planet(planetData);

    // Check for overlaps and adjust
    const tooClose = this._planets.some(p =>
      distance(
        planet.position.x, planet.position.y, planet.position.z,
        p.position.x, p.position.y, p.position.z
      ) < CONFIG.PLANET_MIN_DISTANCE
    );

    if (tooClose) {
      planet.position.x += (Math.random() - 0.5) * 10;
      planet.position.z += (Math.random() - 0.5) * 10;
    }

    this._planets.push(planet);
    this._lastModified = Date.now();
    return planet;
  }

  /**
   * Remove a planet
   * @param {string} planetId
   * @returns {boolean}
   */
  removePlanet(planetId) {
    const index = this._planets.findIndex(p => p.id === planetId);
    if (index === -1) return false;

    // Clean up connections
    this._planets.forEach(p => p.removeConnection(planetId));

    // Clean up events
    this.eventManager.getByPlanet(planetId).forEach(ev =>
      this.eventManager.remove(ev.id)
    );

    // Clean up ships
    const shipsToRemove = this.shipManager.getAtPlanet(planetId);
    shipsToRemove.forEach(ship => this.shipManager.removeShip(ship.id));

    // Remove from sectors
    this._sectors.forEach(sector => {
      sector.planetIds = sector.planetIds.filter(id => id !== planetId);
    });

    this._planets.splice(index, 1);
    this._lastModified = Date.now();
    return true;
  }

  /**
   * Get planet by ID
   * @param {string} planetId
   * @returns {Planet|undefined} Planet or undefined
   */
  getPlanet(planetId) {
    return this._planets.find(p => p.id === planetId);
  }

  /**
   * Set planet modifier
   * @param {string} planetId
   * @param {string} key - Modifier key
   * @param {any} value - Modifier value
   */
  setPlanetModifier(planetId, key, value) {
    if (!this._planetModifiers[planetId]) {
      this._planetModifiers[planetId] = {};
    }
    this._planetModifiers[planetId][key] = value;
    this._lastModified = Date.now();
  }

  /**
   * Get planet modifier
   * @param {string} planetId
   * @param {string} key - Modifier key
   * @returns {any} Modifier value
   */
  getPlanetModifier(planetId, key) {
    return this._planetModifiers[planetId]?.[key];
  }

  /**
   * Add a ship to the galaxy
   * @param {string} factionId
   * @param {string} planetId
   * @param {string} name - Ship name
   * @returns {Object} Created ship
   */
  addShip(factionId, planetId, name = 'Fleet') {
    return this.shipManager.addShip(factionId, planetId, name);
  }

  /**
   * Use a stratagem
   * @param {string} factionId
   * @param {string} stratagemId
   * @param {string} targetPlanetId - Target planet ID (optional)
   * @returns {Object} Result {ok, message}
   */
  useStratagem(factionId, stratagemId, targetPlanetId = null) {
    return this.stratagemManager.use(factionId, stratagemId, targetPlanetId);
  }

  /**
   * Get sector for a planet
   * @param {string} planetId
   * @returns {Object|null} Sector or null
   */
  getSectorForPlanet(planetId) {
    return this._sectors.find(sector => sector.planetIds.includes(planetId)) || null;
  }

  /**
   * Generate a new galactic order
   */
  generateGalacticOrder() {
    this.galacticOrderManager.generateOrder();
    this._lastModified = Date.now();
  }

  /**
   * Generate a specific type of galactic order
   * @param {string} orderType - Specific order type to generate
   */
  generateSpecificGalacticOrder(orderType) {
    const order = this.galacticOrderManager.generateSpecificOrder(orderType);
    if (order) {
      this._lastModified = Date.now();
    }
    return order;
  }

  /**
   * Delete the current galactic order
   * @returns {boolean} True if order was deleted
   */
  deleteGalacticOrder() {
    const deleted = this.galacticOrderManager.deleteCurrentOrder();
    if (deleted) {
      this._lastModified = Date.now();
    }
    return deleted;
  }

  /**
   * Get available galactic order types
   * @returns {Array} Array of available order types
   */
  getAvailableGalacticOrderTypes() {
    return this.galacticOrderManager.getAvailableOrderTypes();
  }

  /**
   * Set auto-distribution settings
   * @param {boolean} enabled
   * @param {string} mode - Distribution mode
   */
  setAutoDistribution(enabled, mode) {
    this._autoDistribution.enabled = enabled;
    this._autoDistribution.mode = mode;
    this._lastModified = Date.now();
    this.save();
  }

  /**
   * Check if stratagem is on cooldown for a faction
   * @param {string} factionId
   * @param {string} stratagemId
   * @returns {boolean} True if on cooldown
   */
  isStratagemOnCooldown(factionId, stratagemId) {
    return this.stratagemManager.getCooldown(factionId, stratagemId) > 0;
  }

  /**
   * Get valid move targets for a ship
   * @param {string} shipId - Ship ID
   * @returns {Array} Array of valid planet IDs
   */
  getValidMoveTargets(shipId) {
    return this.shipManager.getValidMoveTargets(shipId);
  }

  /**
   * Move ship to target planet
   * @param {string} shipId - Ship ID
   * @param {string} targetPlanetId - Target planet ID
   * @returns {Object} Result {ok, message}
   */
  moveShip(shipId, targetPlanetId) {
    return this.shipManager.moveShip(shipId, targetPlanetId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Add connection between planets
   * @param {string} id1 - First planet ID
   * @param {string} id2 - Second planet ID
   * @returns {boolean} True if added
   */
  addConnection(id1, id2) {
    const p1 = this.getPlanet(id1);
    const p2 = this.getPlanet(id2);
    
    if (p1 && p2 && id1 !== id2) {
      p1.addConnection(id2);
      p2.addConnection(id1);
      this._lastModified = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Remove connection between planets
   * @param {string} id1 - First planet ID
   * @param {string} id2 - Second planet ID
   * @returns {boolean} True if removed
   */
  removeConnection(id1, id2) {
    const p1 = this.getPlanet(id1);
    const p2 = this.getPlanet(id2);
    
    if (p1 && p2) {
      p1.removeConnection(id2);
      p2.removeConnection(id1);
      this._lastModified = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Toggle connection
   * @param {string} id1 - First planet ID
   * @param {string} id2 - Second planet ID
   * @returns {string|null} 'added' | 'removed' | null
   */
  toggleConnection(id1, id2) {
    if (id1 === id2) return null;
    
    const p1 = this.getPlanet(id1);
    if (!p1) return null;
    
    if (p1.hasConnection(id2)) {
      this.removeConnection(id1, id2);
      return 'removed';
    }
    
    this.addConnection(id1, id2);
    return 'added';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GALAXY GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate a new galaxy
   * @param {number} size - Number of planets
   */
  generateGalaxy(size = CONFIG.DEFAULT_GALAXY_SIZE) {
    this._planets = [];
    
    // Generate planets
    for (let i = 0; i < size; i++) {
      const planet = PlanetGenerator.generateRandom();
      this.addPlanet(planet);
    }

    // Generate connections
    this.generateConnections();

    // Generate sector layout
    this.generateSectorLayout();

    this._lastModified = Date.now();
  }

  /**
   * Generate connections between planets
   */
  generateConnections() {
    // Clear existing connections
    this._planets.forEach(p => p._connections = []);

    // First pass: Connect nearby planets
    for (let i = 0; i < this._planets.length; i++) {
      const p1 = this._planets[i];
      const distances = [];

      for (let j = 0; j < this._planets.length; j++) {
        if (i === j) continue;
        const p2 = this._planets[j];
        const dist = distance(
          p1.position.x, p1.position.y, p1.position.z,
          p2.position.x, p2.position.y, p2.position.z
        );
        distances.push({ planet: p2, distance: dist });
      }

      // Sort by distance and connect to nearest
      distances.sort((a, b) => a.distance - b.distance);
      
      const maxConnections = CONFIG.CONNECTION_MAX_PER_PLANET;
      for (let k = 0; k < Math.min(maxConnections, distances.length); k++) {
        const target = distances[k];
        // Use distance threshold for connections
        if (target.distance < CONFIG.CONNECTION_DISTANCE) {
          this.addConnection(p1.id, target.planet.id);
        }
      }
    }

    // Second pass: Ensure connectivity by connecting isolated planets to nearest neighbors
    this._ensureMinimumConnectivity();
    
    // Final pass: Ensure galaxy is fully connected
    this._ensureConnectedGraph();
    
    this._lastModified = Date.now();
  }

  /**
   * Ensure every planet has at least one connection
   * @private
   */
  _ensureMinimumConnectivity() {
    for (let i = 0; i < this._planets.length; i++) {
      const planet = this._planets[i];
      if (planet.connections.length === 0) {
        // Find nearest planet and connect to it
        let nearest = null;
        let minDist = Infinity;
        
        for (let j = 0; j < this._planets.length; j++) {
          if (i === j) continue;
          const other = this._planets[j];
          const dist = distance(
            planet.position.x, planet.position.y, planet.position.z,
            other.position.x, other.position.y, other.position.z
          );
          if (dist < minDist) {
            minDist = dist;
            nearest = other;
          }
        }
        
        if (nearest) {
          this.addConnection(planet.id, nearest.id);
        }
      }
    }
  }

  /**
   * Ensure all planets are reachable
   * @private
   */
  _ensureConnectedGraph() {
    if (this._planets.length === 0) return;

    const visited = new Set();
    const queue = [this._planets[0].id];

    while (queue.length > 0) {
      const planetId = queue.shift();
      if (visited.has(planetId)) continue;
      
      visited.add(planetId);
      const planet = this.getPlanet(planetId);
      planet.connections.forEach(connId => {
        if (!visited.has(connId)) queue.push(connId);
      });
    }

    // Connect isolated planets
    if (visited.size < this._planets.length) {
      const unvisited = this._planets.filter(p => !visited.has(p.id));
      unvisited.forEach(planet => {
        const nearest = this._findNearestPlanet(planet, this._planets);
        if (nearest) {
          this.addConnection(planet.id, nearest.id);
        }
      });
    }
  }

  /**
   * Find nearest planet
   * @private
   */
  _findNearestPlanet(planet, candidates) {
    let nearest = null;
    let minDist = Infinity;

    for (const candidate of candidates) {
      if (candidate.id === planet.id) continue;
      
      const dist = distance(
        planet.position.x, planet.position.y, planet.position.z,
        candidate.position.x, candidate.position.y, candidate.position.z
      );

      if (dist < minDist) {
        minDist = dist;
        nearest = candidate;
      }
    }

    return nearest;
  }

  /**
   * Generate sector layout using disc-based arrangement
   */
  generateSectorLayout() {
    const count = this._planets.length;
    if (count === 0) return;

    const numSectors = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(count))));
    const angleStep = (Math.PI * 2) / numSectors;

    this._sectors = [];

    for (let i = 0; i < numSectors; i++) {
      const centerAngle = i * angleStep;
      const sector = {
        id: generateId(),
        name: SECTOR_NAMES[i % SECTOR_NAMES.length],
        planetIds: [],
        centerAngle,
      };
      this._sectors.push(sector);
    }

    // Assign planets to sectors by angle
    this._planets.forEach(planet => {
      const angle = Math.atan2(planet.position.z, planet.position.x);
      const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
      const sectorIndex = Math.floor(normalizedAngle / angleStep) % numSectors;
      this._sectors[sectorIndex].planetIds.push(planet.id);
    });

    this._lastModified = Date.now();
  }

  /**
   * Distribute initial planets to factions
   * @param {Array} factions - Faction array
   * @param {number} planetsPerFaction - Planets per faction
   */
  distributeInitialPlanets(factions, planetsPerFaction = 2) {
    const available = [...this._planets];
    
    factions.forEach(faction => {
      for (let i = 0; i < planetsPerFaction && available.length > 0; i++) {
        const index = Math.floor(Math.random() * available.length);
        const planet = available.splice(index, 1)[0];
        planet.setOwner(faction.id, false);
      }
    });

    this._lastModified = Date.now();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TURN PROGRESSION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Advance to next turn
   * @returns {Object} Turn results
   */
  advanceTurn() {
    this._turn++;
    
    const expiredEvents = this.eventManager.advanceTurn();
    this.harvestResources();
    this.processAutoDistribution();
    this.galacticOrderManager.updateProgress();
    const expiredOrder = this.galacticOrderManager.advanceOrderExpiration();
    this.stratagemManager.advanceTurn();
    
    this._lastModified = Date.now();
    
    return {
      turn: this._turn,
      expiredEvents,
      expiredOrder
    };
  }

  /**
   * Harvest resources from owned planets
   */
  harvestResources() {
    this._planets.forEach(planet => {
      if (!planet.owner) return;

      // Ensure Harvest and GM choices are applied
      const yields = planet.resources;
      if (!yields || Object.keys(yields).length === 0) return;

      if (!this._playerResources[planet.owner]) {
        this._playerResources[planet.owner] = {};
      }

      console.log(`Harvesting from ${planet.name} (${planet.type}) for ${planet.owner}:`, yields);

      Object.entries(yields).forEach(([resource, amount]) => {
        // Apply modifiers
        let finalAmount = amount;
        
        if (this.getPlanetModifier(planet.id, 'trade_hub')) {
          finalAmount *= 1.5;
        }
        
        if (this.getPlanetModifier(planet.id, 'mining_upgrade')) {
          finalAmount += 1;
        }

        console.log(`  ${resource}: ${amount} -> ${finalAmount} (modifiers applied)`);
        
        this._playerResources[planet.owner][resource] =
          (this._playerResources[planet.owner][resource] || 0) + finalAmount;
      });
    });
    
    console.log('Resources after harvesting:', this._playerResources);
  }

  /**
   * Process auto-distribution
   */
  processAutoDistribution() {
    if (!this._autoDistribution.enabled) return;

    const mode = this._autoDistribution.mode;
    const factions = Object.keys(this._playerResources);
    
    console.log(`Processing auto-distribution with mode: ${mode}`, {
      totalResources: this._playerResources,
      customModes: Object.keys(this._customDistributionModes),
      manualAllocation: this._autoDistribution.manualAllocation
    });

    // Handle custom distribution modes
    if (this._customDistributionModes[mode]) {
      const customMode = this._customDistributionModes[mode];
      console.log(`Applying custom mode: ${mode}`, customMode);
      Object.entries(customMode.allocation).forEach(([factionId, resources]) => {
        if (!this._playerResources[factionId]) {
          this._playerResources[factionId] = {};
        }
        
        Object.entries(resources).forEach(([resourceId, amount]) => {
          // Support both positive and negative values for costs and bonuses
          console.log(`Custom distribution - ${factionId}: ${resourceId} += ${amount}`);
          this._playerResources[factionId][resourceId] =
            (this._playerResources[factionId][resourceId] || 0) + amount;
        });
      });
      return;
    }

    // Manual allocation
    if (this._autoDistribution.manualAllocation) {
      console.log('Applying manual allocation:', this._autoDistribution.manualAllocation);
      Object.entries(this._autoDistribution.manualAllocation).forEach(
        ([factionId, resources]) => {
          if (!this._playerResources[factionId]) {
            this._playerResources[factionId] = {};
          }
          
          Object.entries(resources).forEach(([resourceId, amount]) => {
            // Support both positive and negative values for costs and bonuses
            console.log(`Manual allocation - ${factionId}: ${resourceId} += ${amount}`);
            this._playerResources[factionId][resourceId] =
              (this._playerResources[factionId][resourceId] || 0) + amount;
          });
        }
      );
    }

    if (mode === 'MANUAL') return;

    // Calculate total resources
    const totalResources = {};
    Object.values(this._playerResources).forEach(resources => {
      Object.entries(resources).forEach(([resource, amount]) => {
        totalResources[resource] = (totalResources[resource] || 0) + amount;
      });
    });

    console.log('Total resources for distribution:', totalResources);

    // Distribute based on mode
    switch (mode) {
      case 'EQUAL':
        this._distributeEqually(totalResources, factions);
        break;
      case 'STRATEGIC_VALUE':
        this._distributeByStrategicValue(totalResources, factions);
        break;
      case 'TERRITORY_BASED':
        this._distributeByTerritory(totalResources, factions);
        break;
      case 'RANDOM':
        this._distributeRandomly(totalResources, factions);
        break;
      case 'NEED_BASED':
        this._distributeByNeed(totalResources, factions);
        break;
    }

    if (mode === 'MANUAL') {
      factions.forEach(factionId => {
        this._playerResources[factionId] = {};
      });
    }
    
    console.log('Final resources after distribution:', this._playerResources);
  }

  _distributeEqually(totalResources, factions) {
    const share = 1 / factions.length;
    factions.forEach(factionId => {
      Object.entries(totalResources).forEach(([resource, amount]) => {
        const distributedAmount = Math.floor(amount * share);
        console.log(`EQUAL distribution - ${factionId}: ${resource} = ${distributedAmount} (from total ${amount})`);
        this._playerResources[factionId][resource] = distributedAmount;
      });
    });
  }

  _distributeByStrategicValue(totalResources, factions) {
    const factionValues = {};
    let totalValue = 0;

    factions.forEach(factionId => {
      const value = this.planets
        .filter(p => p.owner === factionId)
        .reduce((sum, p) => sum + p.value_one, 0);
      factionValues[factionId] = value;
      totalValue += value;
    });

    if (totalValue === 0) {
      this._distributeEqually(totalResources, factions);
      return;
    }

    factions.forEach(factionId => {
      const share = factionValues[factionId] / totalValue;
      Object.entries(totalResources).forEach(([resource, amount]) => {
        const distributedAmount = Math.floor(amount * share);
        console.log(`STRATEGIC distribution - ${factionId}: ${resource} = ${distributedAmount} (from total ${amount}, share ${share})`);
        this._playerResources[factionId][resource] = distributedAmount;
      });
    });
  }

  _distributeByTerritory(totalResources, factions) {
    const factionPlanets = {};
    let totalPlanets = 0;

    factions.forEach(factionId => {
      const count = this._planets.filter(p => p.owner === factionId).length;
      factionPlanets[factionId] = count;
      totalPlanets += count;
    });

    if (totalPlanets === 0) {
      this._distributeEqually(totalResources, factions);
      return;
    }

    factions.forEach(factionId => {
      const share = factionPlanets[factionId] / totalPlanets;
      Object.entries(totalResources).forEach(([resource, amount]) => {
        this._playerResources[factionId][resource] = Math.floor(amount * share);
      });
    });
  }

  _distributeRandomly(totalResources, factions) {
    factions.forEach(factionId => {
      Object.entries(totalResources).forEach(([resource, amount]) => {
        const randomAmount =
          Math.floor(Math.random() * amount * 0.5) +
          Math.floor(amount / (factions.length * 2));
        this._playerResources[factionId][resource] = randomAmount;
      });
    });
  }

  _distributeByNeed(totalResources, factions) {
    const factionPlanets = {};

    factions.forEach(factionId => {
      const count = this._planets.filter(p => p.owner === factionId).length;
      factionPlanets[factionId] = count;
    });

    const maxPlanets = Math.max(...Object.values(factionPlanets));
    const totalWeight = factions.reduce(
      (sum, factionId) => sum + (maxPlanets - factionPlanets[factionId] + 1),
      0
    );

    factions.forEach(factionId => {
      const weight = (maxPlanets - factionPlanets[factionId] + 1) / totalWeight;
      Object.entries(totalResources).forEach(([resource, amount]) => {
        this._playerResources[factionId][resource] = Math.floor(amount * weight);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GALAXY CENTER
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set galaxy center type
   * @param {string} type - Center type
   * @returns {boolean} True if set
   */
  setGalaxyCenterType(type) {
    if (GALAXY_CENTER_TYPES[type]) {
      this._galaxyCenter = { ...this._galaxyCenter, type };
      this._lastModified = Date.now();
      return true;
    }
    return false;
  }

  setCrusadeInfo(name, description, customFields, links = null) {
    this._galaxyCenter = { 
      ...this._galaxyCenter,
      crusadeName: name,
      crusadeDescription: description,
      customFields: customFields,
      ...(links !== null && { links: links })
    };
    this._lastModified = Date.now();
    return true;
  }

  /**
   * Get galaxy center info
   * @returns {Object} Center type data
   */
  getGalaxyCenterInfo() {
    const centerType = GALAXY_CENTER_TYPES[this._galaxyCenter.type] || GALAXY_CENTER_TYPES.EMPTY;
    return {
      ...centerType,
      crusadeName: this._galaxyCenter.crusadeName || centerType.name,
      crusadeDescription: this._galaxyCenter.crusadeDescription || centerType.description,
      customFields: this._galaxyCenter.customFields || [],
      links: this._galaxyCenter.links || []
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Save galaxy to storage
   * @returns {boolean} True if saved
   */
  save() {
    try {
      // Saving
      const saveData = this.toJSON();
      
      // Double-check that custom distribution modes are included
      if (!saveData.customDistributionModes) {
        saveData.customDistributionModes = this._customDistributionModes || {};
      }
      
      // Double-check that auto distribution settings are included
      if (!saveData.autoDistribution) {
        saveData.autoDistribution = this._autoDistribution || {
          enabled: false,
          mode: 'EQUAL',
          manualAllocation: {},
        };
      }
      
      const result = StorageService.saveCampaign(saveData);
      
      if (result) {
        console.log('Galaxy saved successfully.');
      }
      
      return result;
    } catch (error) {
      console.error('Failed to save galaxy:', error);
      return false;
    }
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this._id,
      name: this._name,
      turn: this._turn,
      planets: this._planets.map(p => p.toJSON()),
      events: this.eventManager.toJSON(),
      galaxyCenter: this._galaxyCenter,
      ships: this.shipManager.toJSON(),
      sectors: this._sectors,
      playerResources: this._playerResources,
      planetModifiers: this._planetModifiers,
      galacticOrder: this.galacticOrderManager.toJSON(),
      stratagemCooldowns: this.stratagemManager.toJSON(),
      autoDistribution: this._autoDistribution,
      customDistributionModes: this._customDistributionModes,
      customText: this.customText,
      createdAt: this._createdAt,
      lastModified: Date.now()
    };
  }

  /**
   * Create from JSON
   * @static
   * @param {Object} data - JSON data
   * @returns {Galaxy} New Galaxy instance
   */
  static fromJSON(data) {
    const galaxy = new Galaxy();
    
    galaxy._id = data.id;
    galaxy._name = data.name;
    galaxy._turn = data.turn;
    galaxy._planets = data.planets.map(p => Planet.fromJSON(p));
    galaxy.eventManager.fromJSON(data.events || []);
    galaxy._galaxyCenter = data.galaxyCenter || { type: 'SUN' };
    galaxy.shipManager.fromJSON(data.ships || []);
    galaxy._sectors = data.sectors || [];
    galaxy._playerResources = data.playerResources || {};
    galaxy._planetModifiers = data.planetModifiers || {};
    galaxy.galacticOrderManager.fromJSON(data.galacticOrder || {});
    galaxy.stratagemManager.fromJSON(data.stratagemCooldowns || {});
    galaxy._autoDistribution = data.autoDistribution || {
      enabled: false,
      mode: 'EQUAL',
      manualAllocation: {},
    };
    galaxy._customDistributionModes = data.customDistributionModes || {};
    galaxy.customText = data.customText || {};
    galaxy._createdAt = data.createdAt;
    galaxy._lastModified = data.lastModified;
    
    // Log loaded custom distribution modes for debugging
    const customModeCount = Object.keys(galaxy._customDistributionModes).length;
    if (customModeCount > 0) {
      console.log(`Loaded ${customModeCount} custom distribution modes:`, 
        Object.keys(galaxy._customDistributionModes));
    }
    
    return galaxy;
  }

  /**
   * Load galaxy from storage
   * @static
   * @returns {Galaxy|null} Loaded galaxy or null
   */
  static load() {
    const data = StorageService.loadCampaign();
    return data && data.planets ? Galaxy.fromJSON(data) : null;
  }

  /**
   * Add an event to the galaxy
   * @param {string} type - Event type
   * @param {string} planetId
   * @param {number} duration - Event duration in turns
   * @param {number} startTurn - Turns until event starts (0 = immediate)
   * @returns {CampaignEvent} Created event
   */
  addEvent(type, planetId, duration = 3, startTurn = 0) {
    const eventData = {
      type: type,
      planetId: planetId,
      duration: duration,
      startTurn: startTurn
    };
    
    const event = this.eventManager.add(eventData);
    this.save();
    return event;
  }

  /**
   * Add a wormhole event between two planets
   * @param {string} planetId1 - First planet ID
   * @param {string} planetId2 - Second planet ID
   * @param {number} duration - Event duration in turns
   * @param {number} startTurn - Turns until wormhole appears (0 = immediate)
   * @returns {CampaignEvent} Created wormhole event
   */
  addWormhole(planetId1, planetId2, duration = 5, startTurn = 0) {
    const eventData = {
      type: 'WORMHOLE',
      planetId: planetId1,
      targetPlanetId: planetId2,
      duration: duration,
      startTurn: startTurn
    };
    
    const event = this.eventManager.add(eventData);
    this.save();
    return event;
  }
}
