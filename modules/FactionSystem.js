/**
 * @fileoverview Faction management system
 * @module modules/FactionSystem
 */

import { DEFAULT_FACTIONS } from '../config/constants.js';
import { generateId } from '../utils/helpers.js';
import { StorageService } from '../services/StorageService.js';

/**
 * Extended faction detail fields
 */
export const FACTION_DETAIL_FIELDS = [
  { key: 'homeworld', label: 'Homeworld' },
  { key: 'lore', label: 'Lore' },
  { key: 'leaders', label: 'Leaders' },
  { key: 'playstyle', label: 'Playstyle' },
  { key: 'military', label: 'Military' },
  { key: 'strengths', label: 'Strengths' },
  { key: 'weaknesses', label: 'Weaknesses' },
  { key: 'allies', label: 'Allies' },
  { key: 'enemies', label: 'Enemies' },
];

/**
 * Manages all factions in the campaign
 * @class FactionManager
 */
export class FactionManager {
  constructor() {
    this._factions = this._loadFactions();
    this._galaxy = null;
  }

  /**
   * Set galaxy reference
   * @param {Galaxy} galaxy - Galaxy instance
   */
  setGalaxy(galaxy) {
    this._galaxy = galaxy;
  }

  /**
   * Load factions from storage
   * @private
   * @returns {Array} Faction array
   */
  _loadFactions() {
    const saved = StorageService.loadFactions();
    return saved || [...DEFAULT_FACTIONS];
  }

  /**
   * Save factions to storage
   */
  save() {
    StorageService.saveFactions(this._factions);
  }

  /**
   * Get all factions
   * @returns {Array} All factions
   */
  getAll() {
    const factions = [...this._factions];
    
    // Apply crusade creation date to default factions
    if (this._galaxy && this._galaxy.createdAt) {
      const crusadeDate = new Date(this._galaxy.createdAt).toISOString();
      
      factions.forEach(faction => {
        if (!faction.createdAt || faction.createdAt === '2024-01-01T00:00:00.000Z') {
          faction.createdAt = crusadeDate;
          faction.updatedAt = crusadeDate;
        }
      });
    }
    
    return factions;
  }

  /**
   * Get faction by ID
   * @param {string} id - Faction ID
   * @returns {Object|undefined} Faction or undefined
   */
  getById(id) {
    return this._factions.find(f => f.id === id);
  }

  /**
   * Add a new faction
   * @param {Object} factionData - Faction data
   * @returns {Object} Created faction
   */
  add(factionData) {
    const now = new Date().toISOString();
    
    const faction = {
      id: factionData.id || generateId(),
      name: factionData.name,
      color: factionData.color,
      symbol: factionData.symbol || '◆',
      description: factionData.description || '',
      createdAt: factionData.createdAt || now,
      updatedAt: now,
    };
    
    // Copy extended detail fields
    FACTION_DETAIL_FIELDS.forEach(({ key }) => {
      if (factionData[key] !== undefined) {
        faction[key] = factionData[key];
      }
    });
    
    this._factions.push(faction);
    this.save();
    return faction;
    
    // Update UI elements
    if (typeof window !== 'undefined' && window.app && window.app.ui) {
      window.app.ui.updateFactionStats();
      window.app.ui.populateFactionDropdown();
    }
  }

  /**
   * Update a faction
   * @param {string} id - Faction ID
   * @param {Object} updates - Update data
   * @returns {Object|null} Updated faction or null
   */
  update(id, updates) {
    const index = this._factions.findIndex(f => f.id === id);
    
    if (index !== -1) {
      this._factions[index] = {
        ...this._factions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
      
      // Update UI elements
      if (typeof window !== 'undefined' && window.app && window.app.ui) {
        window.app.ui.updateFactionStats();
        window.app.ui.populateFactionDropdown();
      }
    }
    
    return this._factions[index] || null;
  }

  /**
   * Delete a faction
   * @param {string} id - Faction ID
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const index = this._factions.findIndex(f => f.id === id);
    
    if (index !== -1) {
      this._factions.splice(index, 1);
      this.save();
      
      // Update UI elements
      if (typeof window !== 'undefined' && window.app && window.app.ui) {
        window.app.ui.updateFactionStats();
        window.app.ui.populateFactionDropdown();
      }
    }
    
    return index !== -1;
  }

  /**
   * Reset factions to defaults
   */
  reset() {
    this._factions = [...DEFAULT_FACTIONS];
    this.save();
    
    // Update UI elements
    if (typeof window !== 'undefined' && window.app && window.app.ui) {
      window.app.ui.updateFactionStats();
      window.app.ui.populateFactionDropdown();
    }
  }

  /**
   * Get faction statistics
   * @param {Planet[]} planets - All planets
   * @returns {Array} Faction stats sorted by planet count
   */
  getStats(planets) {
    const stats = {};
    
    this._factions.forEach(faction => {
      stats[faction.id] = {
        faction,
        planetCount: 0,
        totalValue: 0,
      };
    });
    
    planets.forEach(planet => {
      if (planet.owner && stats[planet.owner]) {
        stats[planet.owner].planetCount++;
        stats[planet.owner].totalValue += planet.value;
      }
    });
    
    return Object.values(stats).sort((a, b) => b.planetCount - a.planetCount);
  }
}
