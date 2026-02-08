/**
 * @fileoverview Shop system for player purchases
 * @module modules/ShopSystem
 */

import { SHOP_ITEMS } from '../config/constants.js';
import { canAfford, spendResources } from '../utils/helpers.js';

/**
 * Manages shop purchases and item effects
 * @class ShopManager
 */
export class ShopManager {
  constructor(galaxy) {
    this._galaxy = galaxy;
  }

  /**
   * Get all available shop items
   * @returns {Array} Shop items
   */
  getItems() {
    return [...SHOP_ITEMS];
  }

  /**
   * Get items by category
   * @param {string} category - Category name
   * @returns {Array} Filtered items
   */
  getItemsByCategory(category) {
    return SHOP_ITEMS.filter(item => item.category === category);
  }

  /**
   * Check if faction can afford an item
   * @param {string} factionId - Faction ID
   * @param {string} itemId - Item ID
   * @returns {boolean} True if affordable
   */
  canPurchase(factionId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    return canAfford(this._galaxy.playerResources, factionId, item.cost);
  }

  /**
   * Purchase an item
   * @param {string} factionId - Faction ID
   * @param {string} itemId - Item ID
   * @param {string} targetPlanetId - Target planet (if required)
   * @returns {Object} Result object {ok, message, requiresSecondPlanet?, firstPlanetId?}
   */
  purchase(factionId, itemId, targetPlanetId = null) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) {
      return { ok: false, message: 'Unknown item.' };
    }

    // Afford check
    if (!canAfford(this._galaxy.playerResources, factionId, item.cost)) {
      return { ok: false, message: 'Not enough resources.' };
    }

    // Target validation
    if (item.targetRequired) {
      if (!targetPlanetId) {
        return { ok: false, message: 'Select a target planet first.' };
      }
      
      const planet = this._galaxy.getPlanet(targetPlanetId);
      if (!planet) {
        return { ok: false, message: 'Invalid planet.' };
      }
      
      // Most items require ownership
      if (item.id !== 'sabotage' && item.id !== 'infiltrate' && 
          item.id !== 'super_weapon' && planet.owner !== factionId) {
        return { ok: false, message: 'You must own the target planet.' };
      }
    }

    // Debit resources
    spendResources(this._galaxy.playerResources, factionId, item.cost);

    // Apply effect
    return this._applyItemEffect(factionId, itemId, targetPlanetId);
  }

  /**
   * Apply item effect
   * @private
   * @param {string} factionId - Faction ID
   * @param {string} itemId - Item ID
   * @param {string} targetPlanetId - Target planet ID
   * @returns {Object} Result
   */
  _applyItemEffect(factionId, itemId, targetPlanetId) {
    const planet = targetPlanetId ? this._galaxy.getPlanet(targetPlanetId) : null;

    switch (itemId) {
      case 'value_two_boost':
        planet.value_two += 2;
        return { ok: true, message: `+2 Value Two on ${planet.name}`, planet };

      case 'value_one_boost':
        planet.value_one += 1;
        return { ok: true, message: `+1 Value One on ${planet.name}`, planet };

      case 'deploy_ship': {
        const ship = this._galaxy.shipManager.addShip(factionId, targetPlanetId);
        return { 
          ok: true, 
          message: `New fleet deployed at ${planet.name}`,
          ship
        };
      }

      case 'fortify':
        planet.value_two += 4;
        planet.setBattleStatus('siege');
        return { 
          ok: true, 
          message: `Fortified ${planet.name}: +4 Strategic Might, Siege status`,
          planet
        };

      case 'spy_network': {
        // Create a temporary event for visibility
        const firstPlanet = this._galaxy.planets[0];
        if (firstPlanet) {
          this._galaxy.eventManager.add({
            type: 'ARCHAEOTECH',
            planetId: firstPlanet.id,
            duration: 3
          });
        }
        return { 
          ok: true, 
          message: 'Spy network active for 3 turns (all owners visible)'
        };
      }

      case 'propaganda': {
        const ownedPlanets = this._galaxy.planets.filter(p => p.owner === factionId);
        ownedPlanets.forEach(p => p.value_one += 1);
        return { 
          ok: true, 
          message: `+1 Value One on all your ${ownedPlanets.length} planets`
        };
      }

      case 'elite_training':
        planet.value_two += 1;
        this._galaxy.setPlanetModifier(targetPlanetId, 'elite_training', true);
        return { 
          ok: true, 
          message: `Elite training completed on ${planet.name} (+1 Value Two, doubled effectiveness)`,
          planet
        };

      case 'planetary_defense':
        planet.value_two += 2;
        this._galaxy.setPlanetModifier(targetPlanetId, 'planetary_defense', 2);
        return { 
          ok: true, 
          message: `Planetary defenses established on ${planet.name} (permanent +2 Value Two)`,
          planet
        };

      case 'trade_hub':
        this._galaxy.setPlanetModifier(targetPlanetId, 'trade_hub', 1.5);
        return { 
          ok: true, 
          message: `Trade hub established on ${planet.name} (+50% resource yield)`,
          planet
        };

      case 'mining_upgrade':
        this._galaxy.setPlanetModifier(targetPlanetId, 'mining_upgrade', 1);
        return { 
          ok: true, 
          message: `Mining complex built on ${planet.name} (+1 to each resource type)`,
          planet
        };

      case 'sabotage':
        if (planet.owner === factionId) {
          return { ok: false, message: 'Cannot sabotage your own planet!' };
        }
        planet.value_two = Math.max(0, planet.value_two - 3);
        return { 
          ok: true, 
          message: `Sabotage successful! -3 Value Two on ${planet.name}`,
          planet
        };

      case 'infiltrate':
        this._galaxy.setPlanetModifier(targetPlanetId, 'infiltrated', factionId);
        return { 
          ok: true, 
          message: `Deep cover agent deployed on ${planet.name} (permanent visibility)`,
          planet
        };

      case 'warp_beacon':
        return { 
          ok: true, 
          message: 'Select second planet for connection',
          requiresSecondPlanet: true,
          firstPlanetId: targetPlanetId
        };

      case 'resurrection':
        if (planet.type !== 'DESTROYED') {
          return { ok: false, message: 'Planet is not destroyed!' };
        }
        planet.type = 'DEAD';
        planet.value_one = 1;
        planet.value_two = 0;
        planet.setOwner(factionId);
        return { 
          ok: true, 
          message: `${planet.name} has been resurrected from the void!`,
          planet
        };

      case 'super_weapon':
        if (planet.owner === factionId) {
          return { ok: false, message: 'Cannot destroy your own planet!' };
        }
        planet.type = 'DESTROYED';
        planet.value_one = 0;
        planet.value_two = 0;
        planet.owner = null;
        planet._resources = {};
        planet._surfaceZones = [];
        return { 
          ok: true, 
          message: `EXTERMINATUS EXECUTED! ${planet.name} has been destroyed!`,
          planet
        };

      default:
        return { ok: false, message: 'Unknown item effect.' };
    }
  }

  /**
   * Complete two-planet purchase (e.g., warp beacon)
   * @param {string} factionId - Faction ID
   * @param {string} itemId - Item ID
   * @param {string} planet1Id - First planet ID
   * @param {string} planet2Id - Second planet ID
   * @returns {Object} Result
   */
  completeTwoPlanetPurchase(factionId, itemId, planet1Id, planet2Id) {
    if (itemId === 'warp_beacon') {
      this._galaxy.addConnection(planet1Id, planet2Id);
      const p1 = this._galaxy.getPlanet(planet1Id);
      const p2 = this._galaxy.getPlanet(planet2Id);
      return { 
        ok: true, 
        message: `Warp beacon established between ${p1.name} and ${p2.name}`
      };
    }
    return { ok: false, message: 'Invalid operation' };
  }
}
