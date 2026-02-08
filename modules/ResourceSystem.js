/**
 * @fileoverview Resource management system
 * @module modules/ResourceSystem
 */

import { DEFAULT_RESOURCE_TYPES } from '../config/constants.js';
import { StorageService } from '../services/StorageService.js';

/**
 * Manages resource types
 * @class ResourceManager
 */
export class ResourceManager {
  /**
   * Initialize resource manager with saved or default resources
   */
  constructor() {
    this._resources = this._loadResources();
  }

  /**
   * Load resources from storage or return defaults
   * @private
   * @returns {Array} Array of resource objects
   */
  _loadResources() {
    const saved = StorageService.loadResources();
    return saved || [...DEFAULT_RESOURCE_TYPES];
  }

  /**
   * Save current resources to storage
   */
  save() {
    StorageService.saveResources(this._resources);
  }

  /**
   * Get all resources
   * @returns {Array} Array of resource objects
   */
  getAll() {
    return [...this._resources];
  }

  /**
   * Get resource by ID
   * @param {string} id - Resource ID
   * @returns {Object|undefined} Resource object or undefined
   */
  getById(id) {
    return this._resources.find(r => r.id === id);
  }

  /**
   * Add a new resource type
   * @param {Object} resourceData - Resource data
   * @returns {Object} Created resource object
   */
  add(resourceData) {
    // Find the next available resource ID
    const existingNumbers = this._resources
      .map(r => {
        const match = r.id.match(/^resource(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 5;
    const resourceId = `resource${nextNumber}`;
    
    const resource = {
      id: resourceId,
      name: resourceData.name,
      icon: resourceData.icon || '📦',
      color: resourceData.color || 'var(--color-main-text)',
    };
    this._resources.push(resource);
    this.save();
    return resource;
  }

  /**
   * Update existing resource
   * @param {string} id - Resource ID
   * @param {Object} updates - Updates to apply
   * @returns {Object|null} Updated resource or null if not found
   */
  update(id, updates) {
    const index = this._resources.findIndex(r => r.id === id);
    if (index !== -1) {
      this._resources[index] = { ...this._resources[index], ...updates };
      this.save();
      return this._resources[index];
    }
    return null;
  }

  delete(id) {
    const index = this._resources.findIndex(r => r.id === id);
    if (index !== -1) {
      this._resources.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  reset() {
    this._resources = [...DEFAULT_RESOURCE_TYPES];
    this.save();
  }
}
