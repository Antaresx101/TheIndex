/**
 * @fileoverview Event system for campaign events
 * @module modules/EventSystem
 */

import { EVENT_TYPES } from '../config/constants.js';
import { generateId, randomChoice } from '../utils/helpers.js';

/**
 * Represents a campaign event
 * @class CampaignEvent
 */
export class CampaignEvent {
  /**
   * @param {Object} data - Event initialization data
   */
  constructor(data) {
    this._id = data.id || generateId();
    this._type = data.type;
    this._name = data.name || EVENT_TYPES[data.type]?.name || 'Custom Event';
    this._description = data.description || EVENT_TYPES[data.type]?.description || '';
    this._icon = data.icon || EVENT_TYPES[data.type]?.icon || '❓';
    this._color = data.color || EVENT_TYPES[data.type]?.color || 'var(--color-main-text)';
    this._planetId = data.planetId;
    this._targetPlanetId = data.targetPlanetId || null;
    this._duration = data.duration || EVENT_TYPES[data.type]?.duration || 1;
    this._turnsRemaining = data.turnsRemaining ?? this._duration;
    this._startTurn = data.startTurn || 0; // 0 means starts immediately
    this._effect = data.effect || EVENT_TYPES[data.type]?.effect || 'none';
    this._createdAt = data.createdAt || Date.now();
    this._customData = data.customData || {};
  }

  // Getters
  get id() { return this._id; }
  get type() { return this._type; }
  get name() { return this._name; }
  get description() { return this._description; }
  get icon() { return this._icon; }
  get color() { return this._color; }
  get planetId() { return this._planetId; }
  get targetPlanetId() { return this._targetPlanetId; }
  get duration() { return this._duration; }
  get turnsRemaining() { return this._turnsRemaining; }
  get startTurn() { return this._startTurn; }
  get effect() { return this._effect; }
  get createdAt() { return this._createdAt; }
  get customData() { return { ...this._customData }; }

  /**
   * Check if event is currently active (has started and not expired)
   * @returns {boolean} True if active
   */
  isActive() {
    return this._startTurn === 0 && !this.isExpired();
  }

  /**
   * Check if event is waiting to start
   * @returns {boolean} True if waiting to start
   */
  isWaiting() {
    return this._startTurn > 0;
  }

  /**
   * Get turns until event starts
   * @returns {number} Turns until start (0 if started)
   */
  getTurnsUntilStart() {
    return Math.max(0, this._startTurn);
  }

  /**
   * Advance one turn for this event
   * @returns {boolean} True if event expired
   */
  tick() {
    if (this._turnsRemaining === -1) {
      return false; // Infinite duration
    }
    
    // Decrease start turn counter if waiting to start
    if (this._startTurn > 0) {
      this._startTurn--;
      return false; // Not expired, just waiting
    }
    
    // Event has started, decrease duration
    this._turnsRemaining--;
    return this._turnsRemaining <= 0;
  }

  /**
   * Check if event has expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    return this._turnsRemaining === 0;
  }

  /**
   * Check if event has infinite duration
   * @returns {boolean} True if infinite
   */
  isInfinite() {
    return this._turnsRemaining === -1;
  }

  /**
   * Get event type information
   * @returns {Object} Event type data
   */
  getTypeInfo() {
    return EVENT_TYPES[this._type] || {
      name: this._name,
      icon: this._icon,
      color: this._color,
      description: this._description,
      effect: this._effect,
    };
  }

  /**
   * Serialize event to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this._id,
      type: this._type,
      name: this._name,
      description: this._description,
      icon: this._icon,
      color: this._color,
      planetId: this._planetId,
      targetPlanetId: this._targetPlanetId,
      duration: this._duration,
      turnsRemaining: this._turnsRemaining,
      startTurn: this._startTurn,
      effect: this._effect,
      createdAt: this._createdAt,
      customData: this._customData,
    };
  }

  /**
   * Create event from JSON
   * @static
   * @param {Object} data - JSON data
   * @returns {CampaignEvent} New CampaignEvent instance
   */
  static fromJSON(data) {
    return new CampaignEvent(data);
  }
}

/**
 * Manages all campaign events
 * @class EventManager
 */
export class EventManager {
  constructor() {
    this._events = [];
  }

  /**
   * Add a new event
   * @param {Object} eventData - Event data
   * @returns {CampaignEvent} Created event
   */
  add(eventData) {
    const event = new CampaignEvent(eventData);
    this._events.push(event);
    return event;
  }

  /**
   * Remove an event by ID
   * @param {string} eventId - Event ID
   * @returns {boolean} True if removed
   */
  remove(eventId) {
    const index = this._events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      this._events.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all events
   * @returns {CampaignEvent[]} Array of all events
   */
  getAll() {
    return [...this._events];
  }

  /**
   * Get event by ID
   * @param {string} id - Event ID
   * @returns {CampaignEvent|undefined} Event or undefined
   */
  getById(id) {
    return this._events.find(e => e.id === id);
  }

  /**
   * Get all events affecting a planet
   * @param {string} planetId - Planet ID
   * @returns {CampaignEvent[]} Events on planet
   */
  getByPlanet(planetId) {
    return this._events.filter(e => e.planetId === planetId);
  }

  /**
   * Get events by effect type
   * @param {string} effect - Effect type
   * @returns {CampaignEvent[]} Events with effect
   */
  getByEffect(effect) {
    return this._events.filter(e => e.effect === effect);
  }

  /**
   * Advance turn for all events
   * @returns {CampaignEvent[]} Expired events
   */
  advanceTurn() {
    const expired = [];
    
    this._events = this._events.filter(event => {
      const isExpired = event.tick();
      if (isExpired) {
        expired.push(event);
      }
      return !isExpired;
    });
    
    return expired;
  }

  /**
   * Check if route between planets is blocked
   * @param {string} planetId1 - First planet ID
   * @param {string} planetId2 - Second planet ID
   * @returns {boolean} True if blocked
   */
  isRouteBlocked(planetId1, planetId2) {
    const warpStorms = this._events.filter(e => e.effect === 'blocks_travel' && e.isActive());
    
    for (const storm of warpStorms) {
      if (storm.planetId === planetId1 || storm.planetId === planetId2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if wormhole connects two planets
   * @param {string} planetId1 - First planet ID
   * @param {string} planetId2 - Second planet ID
   * @returns {boolean} True if wormhole exists
   */
  hasWormhole(planetId1, planetId2) {
    const wormholes = this._events.filter(e => e.effect === 'creates_route' && e.isActive());
    
    for (const wormhole of wormholes) {
      if (
        (wormhole.planetId === planetId1 && wormhole.targetPlanetId === planetId2) ||
        (wormhole.planetId === planetId2 && wormhole.targetPlanetId === planetId1)
      ) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Clear all events
   */
  clear() {
    this._events = [];
  }

  /**
   * Serialize to JSON
   * @returns {Array} JSON array of events
   */
  toJSON() {
    return this._events.map(e => e.toJSON());
  }

  /**
   * Load from JSON
   * @param {Array} data - JSON data
   */
  fromJSON(data) {
    this._events = data.map(e => CampaignEvent.fromJSON(e));
  }
}

/**
 * Event generator utility
 * @class EventGenerator
 */
export class EventGenerator {
  /**
   * Generate a random event
   * @static
   * @param {Planet[]} planets - Available planets
   * @returns {CampaignEvent} Random event
   */
  static generateRandom(planets) {
    const eventTypes = Object.keys(EVENT_TYPES);
    const type = randomChoice(eventTypes);
    const planet = randomChoice(planets);
    
    const eventData = {
      type: type,
      planetId: planet.id,
    };
    
    // For wormholes, select a target planet
    if (type === 'WORMHOLE') {
      const otherPlanets = planets.filter(p => p.id !== planet.id);
      if (otherPlanets.length > 0) {
        eventData.targetPlanetId = randomChoice(otherPlanets).id;
      }
    }
    
    return new CampaignEvent(eventData);
  }

  /**
   * Create a warp storm event
   * @static
   * @param {string} planetId - Target planet ID
   * @param {number} duration - Event duration
   * @returns {CampaignEvent} Warp storm event
   */
  static createWarpStorm(planetId, duration = 3) {
    return new CampaignEvent({
      type: 'WARP_STORM',
      planetId: planetId,
      duration: duration,
    });
  }

  /**
   * Create a wormhole event
   * @static
   * @param {string} planetId1 - First planet ID
   * @param {string} planetId2 - Second planet ID
   * @param {number} duration - Event duration
   * @returns {CampaignEvent} Wormhole event
   */
  static createWormhole(planetId1, planetId2, duration = 5) {
    return new CampaignEvent({
      type: 'WORMHOLE',
      planetId: planetId1,
      targetPlanetId: planetId2,
      duration: duration,
    });
  }

  /**
   * Create a custom event
   * @static
   * @param {Object} data - Custom event data
   * @returns {CampaignEvent} Custom event
   */
  static createCustom(data) {
    return new CampaignEvent({
      type: 'CUSTOM',
      name: data.name,
      description: data.description,
      icon: data.icon || '❓',
      color: data.color || 'var(--color-main-text)',
      planetId: data.planetId,
      duration: data.duration || 1,
      effect: data.effect || 'none',
      customData: data.customData || {},
    });
  }
}
