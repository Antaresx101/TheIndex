/**
 * @fileoverview Galactic orders system
 * @module modules/GalacticOrderSystem
 */

import { GALACTIC_ORDER_TEMPLATES, SECTOR_NAMES } from '../config/constants.js';
import { generateId, randomChoice } from '../utils/helpers.js';

/**
 * Manages galactic orders and objectives
 * @class GalacticOrderManager
 */
export class GalacticOrderManager {
  constructor(galaxy) {
    this._galaxy = galaxy;
    this._currentOrder = null;
    this._completedOrders = [];
    this._liberationProgress = {};
  }

  /**
   * Get current galactic order
   * @returns {Object|null} Current order or null
   */
  getCurrentOrder() {
    return this._currentOrder;
  }

  /**
   * Get completed orders
   * @returns {Array} Completed orders
   */
  getCompletedOrders() {
    return [...this._completedOrders];
  }

  /**
   * Generate a new galactic order (random)
   * @returns {Object} Generated order
   */
  generateOrder() {
    // Weight-based selection
    const templates = Object.entries(GALACTIC_ORDER_TEMPLATES);
    const totalWeight = templates.reduce((sum, [_, t]) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedTemplate = null;
    for (const [key, template] of templates) {
      random -= template.weight;
      if (random <= 0) {
        selectedTemplate = { key, ...template };
        break;
      }
    }

    return this.generateSpecificOrder(selectedTemplate.key);
  }

  /**
   * Generate a specific type of galactic order
   * @param {string} orderType - Specific order type to generate
   * @returns {Object} Generated order or null if type not found
   */
  generateSpecificOrder(orderType) {
    const template = GALACTIC_ORDER_TEMPLATES[orderType];
    if (!template) {
      console.error(`Unknown order type: ${orderType}`);
      return null;
    }

    // Generate order parameters
    const templateData = this._fillTemplate(template.description);
    const order = {
      id: generateId(),
      type: orderType,
      name: template.name,
      icon: template.icon,
      description: templateData.filled,
      reward: template.reward,
      createdAt: Date.now(),
      expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 7), // 7 days
      completed: false,
      progress: 0,
      target: templateData.target,
      turns: templateData.turns,
      amount: templateData.amount,
      sector: templateData.sector,
      resource: templateData.resource
    };

    this._currentOrder = order;
    return order;
  }

  /**
   * Delete the current galactic order
   * @returns {boolean} True if order was deleted, false if no order existed
   */
  deleteCurrentOrder() {
    if (!this._currentOrder) {
      return false;
    }

    this._currentOrder = null;
    this._liberationProgress = {};
    return true;
  }

  /**
   * Get available order types
   * @returns {Array} Array of available order types with names
   */
  getAvailableOrderTypes() {
    return Object.entries(GALACTIC_ORDER_TEMPLATES).map(([key, template]) => ({
      key,
      name: template.name,
      icon: template.icon
    }));
  }

  /**
   * Fill template placeholders
   * @private
   * @param {string} template - Template string
   * @returns {string} Filled template
   */
  _fillTemplate(template) {
    const turns = Math.floor(Math.random() * 5) + 3; // 3-7 turns
    const amount = Math.floor(Math.random() * 10) + 5; // 5-14
    const sector = randomChoice(SECTOR_NAMES);
    const allResources = this._app?.resourceManager?.getAll() || [
      { id: 'resource1' }, { id: 'resource2' }, { id: 'resource3' }, { id: 'resource4' }
    ];
    const resource = randomChoice(allResources.map(r => r.id));
    const target = Math.floor(Math.random() * 5) + 2; // 2-6

    return {
      filled: template
        .replace('{turns}', turns)
        .replace('{amount}', amount)
        .replace('{sector}', sector)
        .replace('{resource}', resource)
        .replace('{target}', target),
      turns,
      amount,
      sector,
      resource,
      target
    };
  }

  
  /**
   * Update order progress
   */
  updateProgress() {
    if (!this._currentOrder || this._currentOrder.completed) return;

    const progress = this._calculateProgress(this._currentOrder.type);
    this._currentOrder.progress = progress;

    if (progress >= this._currentOrder.target) {
      this.completeOrder();
    }
  }

  /**
   * Advance order expiration by one turn
   */
  advanceOrderExpiration() {
    if (!this._currentOrder || this._currentOrder.completed) return;
    
    // Reduce expiration time by one day (24 hours)
    this._currentOrder.expiresAt -= (24 * 60 * 60 * 1000);
    
    // Check if order has expired (0 or negative turns remaining)
    if (this._currentOrder.expiresAt <= Date.now()) {
      return this.completeOrder();
    }
    
    return null;
  }

  /**
   * Calculate current progress
   * @private
   * @param {string} type - Order type
   * @returns {number} Progress value
   */
  _calculateProgress(type) {
    switch (type) {
      case 'CONQUEST':
        return this._liberationProgress.planetsConquered || 0;
      
      case 'LIBERATION':
        return this._liberationProgress.sectorsLiberated || 0;
      
      case 'RESOURCE_GATHERING':
        return this._liberationProgress.resourcesGathered || 0;
      
      case 'DEFENSE':
        return this._liberationProgress.turnsHeld || 0;
      
      case 'EXPLORATION':
        return this._liberationProgress.planetsDiscovered || 0;
      
      case 'DIPLOMACY':
        return this._liberationProgress.relationsEstablished || 0;
      
      default:
        return 0;
    }
  }

  /**
   * Complete current order
   * @returns {Object} Completed order
   */
  completeOrder() {
    if (!this._currentOrder) return null;

    this._currentOrder.completed = true;
    this._currentOrder.completedAt = Date.now();
    
    this._completedOrders.push(this._currentOrder);
    
    const reward = this._currentOrder.reward;
    const completedOrder = this._currentOrder;
    
    this._currentOrder = null;
    this._liberationProgress = {};
    
    return { order: completedOrder, reward };
  }

  /**
   * Cancel current order
   */
  cancelOrder() {
    this._currentOrder = null;
    this._liberationProgress = {};
  }

  /**
   * Track liberation progress
   * @param {string} type - Progress type
   * @param {number} amount - Amount to add
   */
  trackProgress(type, amount = 1) {
    const progressMapping = {
      'CONQUEST': 'planetsConquered',
      'LIBERATION': 'sectorsLiberated', 
      'RESOURCE_GATHERING': 'resourcesGathered',
      'DEFENSE': 'turnsHeld',
      'EXPLORATION': 'planetsDiscovered',
      'DIPLOMACY': 'relationsEstablished'
    };
    
    const progressKey = progressMapping[type] || type;
    this._liberationProgress[progressKey] = (this._liberationProgress[progressKey] || 0) + amount;
    this.updateProgress();
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON data
   */
  toJSON() {
    return {
      currentOrder: this._currentOrder,
      completedOrders: this._completedOrders,
      liberationProgress: this._liberationProgress
    };
  }

  /**
   * Load from JSON
   * @param {Object} data - JSON data
   */
  fromJSON(data) {
    this._currentOrder = data.currentOrder || null;
    this._completedOrders = data.completedOrders || [];
    this._liberationProgress = data.liberationProgress || {};
  }
}
