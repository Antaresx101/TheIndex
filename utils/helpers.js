/**
 * @fileoverview Utility functions for the Crusade Map application
 * @module utils/helpers
 */

/**
 * Generate a unique identifier
 * @returns {string} Unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Select a random element from an array
 * @template T
 * @param {T[]} arr - Array to select from
 * @returns {T} Random element
 */
export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Calculate 3D distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} z1 - First point Z
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @param {number} z2 - Second point Z
 * @returns {number} Euclidean distance
 */
export function distance(x1, y1, z1, x2, y2, z2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a timestamp to locale string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

/**
 * Deep clone an object using JSON serialization
 * @template T
 * @param {T} obj - Object to clone
 * @returns {T} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string
 * @returns {{r: number, g: number, b: number} | null} RGB object or null if invalid
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB values to hex color string
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Check if a faction can afford a cost
 * @param {Object} playerResources - All faction resources
 * @param {string} factionId - Faction to check
 * @param {Object} costMap - Cost requirements
 * @returns {boolean} True if faction can afford
 */
export function canAfford(playerResources, factionId, costMap) {
  const wallet = playerResources[factionId] || {};
  return Object.entries(costMap).every(
    ([resource, amount]) => (wallet[resource] || 0) >= amount
  );
}

/**
 * Subtract resources from a faction's wallet (mutates)
 * @param {Object} playerResources - All faction resources
 * @param {string} factionId - Faction to debit
 * @param {Object} costMap - Resources to subtract
 */
export function spendResources(playerResources, factionId, costMap) {
  if (!playerResources[factionId]) {
    playerResources[factionId] = {};
  }
  
  Object.entries(costMap).forEach(([resource, amount]) => {
    playerResources[factionId][resource] =
      (playerResources[factionId][resource] || 0) - amount;
  });
}

/**
 * Add resources to a faction's wallet (mutates)
 * @param {Object} playerResources - All faction resources
 * @param {string} factionId - Faction to credit
 * @param {Object} resourceMap - Resources to add
 */
export function addResources(playerResources, factionId, resourceMap) {
  if (!playerResources[factionId]) {
    playerResources[factionId] = {};
  }
  
  Object.entries(resourceMap).forEach(([resource, amount]) => {
    playerResources[factionId][resource] =
      (playerResources[factionId][resource] || 0) + amount;
  });
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
