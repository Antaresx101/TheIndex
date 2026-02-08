// ═══════════════════════════════════════════════════════════════════════
// Planet Values
// ═══════════════════════════════════════════════════════════════════════
/**
 * @fileoverview Planet value management system
 * @module js/planetValues
 */

import { generateId } from '../utils/helpers.js';
import { StorageService } from '../services/StorageService.js';
import { DEFAULT_PLANET_VALUES } from '../config/constants.js';

/**
 * Manages custom planet values/attributes
 * @class PlanetValueManager
 */
export class PlanetValueManager {
    /**
     * Initialize planet value manager
     */
    constructor() {
        this.planetValues = this.loadPlanetValues();
    }

    /**
     * Load planet values from storage or use defaults
     * @returns {Array} Planet value definitions
     */
    loadPlanetValues() {
        const saved = StorageService.loadPlanetValues();
        return saved || [...DEFAULT_PLANET_VALUES];
    }

    /**
     * Save planet values to storage
     */
    save() {
        StorageService.savePlanetValues(this.planetValues);
    }

    /**
     * Get all planet values
     * @returns {Array} All planet values
     */
    getAll() {
        return [...this.planetValues];
    }

    /**
     * Get all planet values sorted by order
     * @returns {Array} Sorted planet values
     */
    getAllSorted() {
        return [...this.planetValues].sort((a, b) => a.order - b.order);
    }

    /**
     * Get planet value by ID
     * @param {string} id - Value ID
     * @returns {Object|undefined} Value definition or undefined
     */
    getById(id) {
        return this.planetValues.find(v => v.id === id);
    }

    /**
     * Add a new planet value
     * @param {Object} resourceData - Value data
     * @returns {Object} Created value
     */
    add(resourceData) {
        const value = {
            id: generateId(),
            name: resourceData.name,
            type: resourceData.type || 'text',
            defaultValue: resourceData.defaultValue !== undefined 
                ? resourceData.defaultValue 
                : (resourceData.type === 'number' || resourceData.type === 'integer' ? 0 : ''),
            order: resourceData.order !== undefined 
                ? resourceData.order 
                : this.planetValues.length
        };
        
        this.planetValues.push(value);
        this.save();
        return value;
    }

    /**
     * Update existing planet value
     * @param {string} id - Value ID
     * @param {Object} updates - Updates to apply
     * @returns {Object|null} Updated value or null
     */
    update(id, updates) {
        const index = this.planetValues.findIndex(v => v.id === id);
        
        if (index !== -1) {
            this.planetValues[index] = {
                ...this.planetValues[index],
                ...updates
            };
            this.save();
            return this.planetValues[index];
        }
        
        return null;
    }

    /**
     * Delete a planet value
     * @param {string} id - Value ID
     * @returns {boolean} True if deleted
     */
    delete(id) {
        const index = this.planetValues.findIndex(v => v.id === id);
        
        if (index !== -1) {
            this.planetValues.splice(index, 1);
            this.save();
            return true;
        }
        
        return false;
    }

    /**
     * Reset planet values to defaults
     */
    reset() {
        this.planetValues = [...DEFAULT_PLANET_VALUES];
        this.save();
    }

    /**
     * Validate a value against its definition
     * @param {string} valueId - Value ID
     * @param {*} value - Value to validate
     * @returns {Object} Validation result {valid, value?, error?}
     */
    validateValue(valueId, value) {
        const valueDef = this.getById(valueId);
        
        if (!valueDef) {
            return { valid: false, error: 'Value definition not found' };
        }

        switch (valueDef.type) {
            case 'number':
                const num = parseFloat(value);
                if (isNaN(num)) {
                    return { valid: false, error: 'Must be a valid number' };
                }
                return { valid: true, value: num };
                
            case 'integer':
                const int = parseInt(value, 10);
                if (isNaN(int)) {
                    return { valid: false, error: 'Must be a valid integer' };
                }
                return { valid: true, value: int };
                
            case 'text':
                return { valid: true, value: String(value) };
                
            default:
                return { valid: false, error: 'Unknown value type' };
        }
    }

    /**
     * Reorder a planet value
     * @param {string} valueId - Value ID to reorder
     * @param {number} newOrder - New order position
     * @returns {boolean} True if reordered
     */
    reorderValue(valueId, newOrder) {
        const valueIndex = this.planetValues.findIndex(v => v.id === valueId);
        
        if (valueIndex === -1) {
            return false;
        }

        const oldOrder = this.planetValues[valueIndex].order;
        
        // Update the order of the moved value
        this.planetValues[valueIndex].order = newOrder;
        
        // Shift other values as needed
        this.planetValues.forEach(value => {
            if (value.id !== valueId) {
                if (oldOrder < newOrder && value.order > oldOrder && value.order <= newOrder) {
                    value.order--;
                } else if (oldOrder > newOrder && value.order >= newOrder && value.order < oldOrder) {
                    value.order++;
                }
            }
        });
        
        this.save();
        return true;
    }
}
