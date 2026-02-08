/**
 * @fileoverview Stratagem system for tactical abilities
 * @module modules/StratagemSystem
 */

import { STRATAGEMS } from '../config/constants.js';
import { canAfford, spendResources } from '../utils/helpers.js';

/**
 * Manages stratagems and cooldowns
 * @class StratagemManager
 */
export class StratagemManager {
  constructor(galaxy) {
    this._galaxy = galaxy;
    this._cooldowns = {};
  }

  /**
   * Get all available stratagems
   * @returns {Array} Stratagems
   */
  getAll() {
    return Object.entries(STRATAGEMS).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  /**
   * Check if stratagem is on cooldown
   * @param {string} factionId - Faction ID
   * @param {string} stratagemId - Stratagem ID
   * @returns {number} Cooldown turns remaining (0 if ready)
   */
  getCooldown(factionId, stratagemId) {
    const key = `${factionId}:${stratagemId}`;
    return this._cooldowns[key] || 0;
  }

  /**
   * Check if faction can use stratagem
   * @param {string} factionId - Faction ID
   * @param {string} stratagemId - Stratagem ID
   * @returns {Object} {canUse: boolean, reason?: string}
   */
  canUse(factionId, stratagemId) {
    const stratagem = STRATAGEMS[stratagemId];
    if (!stratagem) {
      return { canUse: false, reason: 'Unknown stratagem.' };
    }

    // Check cooldown
    const cooldown = this.getCooldown(factionId, stratagemId);
    if (cooldown > 0) {
      return { canUse: false, reason: `On cooldown for ${cooldown} more turns.` };
    }

    // Check resources
    if (!canAfford(this._galaxy.playerResources, factionId, stratagem.cost)) {
      return { canUse: false, reason: 'Not enough resources.' };
    }

    return { canUse: true };
  }

  /**
   * Use a stratagem
   * @param {string} factionId - Faction ID
   * @param {string} stratagemId - Stratagem ID
   * @param {string} targetPlanetId - Target planet (if required)
   * @returns {Object} Result {ok, message}
   */
  use(factionId, stratagemId, targetPlanetId = null) {
    const stratagem = STRATAGEMS[stratagemId];
    if (!stratagem) {
      return { ok: false, message: 'Unknown stratagem.' };
    }

    // Check if can use
    const canUse = this.canUse(factionId, stratagemId);
    if (!canUse.canUse) {
      return { ok: false, message: canUse.reason };
    }

    // Validate target
    if (stratagem.targetRequired && !targetPlanetId) {
      return { ok: false, message: 'Target planet required.' };
    }

    const planet = targetPlanetId ? this._galaxy.getPlanet(targetPlanetId) : null;
    if (stratagem.targetRequired && !planet) {
      return { ok: false, message: 'Invalid target planet.' };
    }

    // Spend resources
    spendResources(this._galaxy.playerResources, factionId, stratagem.cost);

    // Apply effect
    const result = this._applyEffect(stratagemId, factionId, planet);

    // Set cooldown
    const key = `${factionId}:${stratagemId}`;
    this._cooldowns[key] = stratagem.cooldown;

    return result;
  }

  /**
   * Apply stratagem effect
   * @private
   * @param {string} stratagemId - Stratagem ID
   * @param {string} factionId - Faction ID
   * @param {Planet} planet - Target planet
   * @returns {Object} Result
   */
  _applyEffect(stratagemId, factionId, planet) {
    switch (stratagemId) {
      case 'ORBITAL_BOMBARDMENT':
        planet.value_two = Math.max(0, planet.value_two - 4);
        return {
          ok: true,
          message: `Orbital bombardment on ${planet.name}! -4 Value Two.`,
          planet
        };

      case 'REINFORCEMENT':
        planet.value_two += 3;
        return {
          ok: true,
          message: `Emergency reinforcements to ${planet.name}! +3 Value Two.`,
          planet
        };

      case 'SUPPLY_DROP': {
        const resources = this._galaxy.playerResources[factionId] || {};
        const allResources = this._galaxy.app?.resourceManager?.getAll() || [
          { id: 'resource1' }, { id: 'resource2' }, { id: 'resource3' }, { id: 'resource4' }
        ];
        allResources.forEach(resource => {
          resources[resource.id] = (resources[resource.id] || 0) + 2;
        });
        this._galaxy.playerResources[factionId] = resources;
        
        return {
          ok: true,
          message: 'Supply drop received! +2 of each resource.'
        };
      }

      default:
        return { ok: false, message: 'Unknown stratagem effect.' };
    }
  }

  /**
   * Decrease all cooldowns by 1 turn
   */
  advanceTurn() {
    for (const key in this._cooldowns) {
      this._cooldowns[key] = Math.max(0, this._cooldowns[key] - 1);
    }
  }

  /**
   * Clear all cooldowns
   */
  clearCooldowns() {
    this._cooldowns = {};
  }

  /**
   * Serialize to JSON
   * @returns {Object} Cooldowns
   */
  toJSON() {
    return this._cooldowns;
  }

  /**
   * Load from JSON
   * @param {Object} data - Cooldowns data
   */
  fromJSON(data) {
    this._cooldowns = data || {};
  }
}
