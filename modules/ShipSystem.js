/**
 * @fileoverview Ship/fleet management system
 * @module modules/ShipSystem
 */

import { generateId } from '../utils/helpers.js';

/**
 * Manages all ships/fleets in the campaign
 * @class ShipManager
 */
export class ShipManager {
  constructor(galaxy) {
    this._galaxy = galaxy;
    this._ships = [];
  }

  /**
   * Get all ships
   * @returns {Array} All ships
   */
  getAll() {
    return [...this._ships];
  }

  /**
   * Get ship by ID
   * @param {string} shipId - Ship ID
   * @returns {Object|undefined} Ship or undefined
   */
  getById(shipId) {
    return this._ships.find(s => s.id === shipId);
  }

  /**
   * Get ships by faction
   * @param {string} factionId - Faction ID
   * @returns {Array} Faction's ships
   */
  getByFaction(factionId) {
    return this._ships.filter(s => s.factionId === factionId);
  }

  /**
   * Get ships at planet
   * @param {string} planetId - Planet ID
   * @returns {Array} Ships at planet
   */
  getAtPlanet(planetId) {
    return this._ships.filter(s => s.planetId === planetId);
  }

  /**
   * Add a new ship
   * @param {string} factionId - Faction ID
   * @param {string} planetId - Starting planet ID
   * @param {string} name - Ship name
   * @returns {Object} Created ship
   */
  addShip(factionId, planetId, name = 'Fleet') {
    const ship = {
      id: generateId(),
      factionId,
      planetId,
      name,
      createdAt: Date.now()
    };
    
    this._ships.push(ship);
    return ship;
  }

  /**
   * Remove a ship
   * @param {string} shipId - Ship ID
   * @returns {boolean} True if removed
   */
  removeShip(shipId) {
    const index = this._ships.findIndex(s => s.id === shipId);
    if (index !== -1) {
      this._ships.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Move ship to target planet
   * @param {string} shipId - Ship ID
   * @param {string} targetPlanetId - Target planet ID
   * @returns {Object} Result {ok, message}
   */
  moveShip(shipId, targetPlanetId) {
    const ship = this._ships.find(s => s.id === shipId);
    if (!ship) {
      return { ok: false, message: 'Ship not found.' };
    }

    const currentPlanet = this._galaxy.getPlanet(ship.planetId);
    if (!currentPlanet) {
      return { ok: false, message: 'Current planet not found.' };
    }

    const targetPlanet = this._galaxy.getPlanet(targetPlanetId);
    if (!targetPlanet) {
      return { ok: false, message: 'Target planet not found.' };
    }

    // Check if planets are connected
    const directlyConnected = currentPlanet.hasConnection(targetPlanetId);
    const wormholeConnected = this._galaxy.eventManager.hasWormhole(
      ship.planetId, 
      targetPlanetId
    );

    if (!directlyConnected && !wormholeConnected) {
      return { ok: false, message: 'Planets are not connected.' };
    }

    // Check for warp storms
    if (this._galaxy.eventManager.isRouteBlocked(ship.planetId, targetPlanetId)) {
      return { ok: false, message: 'Route blocked by warp storm!' };
    }

    // Move the ship
    ship.planetId = targetPlanetId;
    
    return { 
      ok: true, 
      message: `Fleet moved to ${targetPlanet.name}`,
      ship
    };
  }

  /**
   * Get valid move targets for a ship
   * @param {string} shipId - Ship ID
   * @returns {Array} Array of valid planet IDs
   */
  getValidMoveTargets(shipId) {
    const ship = this._ships.find(s => s.id === shipId);
    if (!ship) return [];

    const currentPlanet = this._galaxy.getPlanet(ship.planetId);
    if (!currentPlanet) return [];

    const targets = new Set();

    // Add directly connected planets
    currentPlanet.connections.forEach(connId => {
      if (!this._galaxy.eventManager.isRouteBlocked(ship.planetId, connId)) {
        targets.add(connId);
      }
    });

    // Add wormhole connections
    this._galaxy.eventManager.getByEffect('creates_route').forEach(wormhole => {
      if (wormhole.planetId === ship.planetId && 
          !this._galaxy.eventManager.isRouteBlocked(ship.planetId, wormhole.targetPlanetId)) {
        targets.add(wormhole.targetPlanetId);
      }
      if (wormhole.targetPlanetId === ship.planetId && 
          !this._galaxy.eventManager.isRouteBlocked(ship.planetId, wormhole.planetId)) {
        targets.add(wormhole.planetId);
      }
    });

    return [...targets];
  }

  /**
   * Rename a ship
   * @param {string} shipId - Ship ID
   * @param {string} newName - New name
   * @returns {boolean} True if renamed
   */
  renameShip(shipId, newName) {
    const ship = this._ships.find(s => s.id === shipId);
    if (ship) {
      ship.name = newName;
      return true;
    }
    return false;
  }

  /**
   * Clear all ships
   */
  clear() {
    this._ships = [];
  }

  /**
   * Serialize to JSON
   * @returns {Array} Ships array
   */
  toJSON() {
    return this._ships;
  }

  /**
   * Load from JSON
   * @param {Array} data - Ships data
   */
  fromJSON(data) {
    this._ships = data || [];
  }
}
