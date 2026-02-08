/**
 * @fileoverview Storage service for localStorage management
 * @module services/StorageService
 */

/**
 * Storage keys enumeration
 */
const STORAGE_KEYS = {
  CAMPAIGN: 'crusade_campaign',
  FACTIONS: 'crusade_factions',
  RESOURCES: 'crusade_resources',
  SETTINGS: 'crusade_settings',
};

/**
 * Service for managing localStorage operations
 * @class StorageService
 */
export class StorageService {
  /**
   * Save campaign data
   * @static
   * @param {Object} campaignData - Campaign data to save
   * @returns {boolean} True if successful
   */
  static saveCampaign(campaignData) {
    try {
      const data = {
        ...campaignData,
        lastSaved: Date.now(),
        version: '2.0',
      };
      
      localStorage.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save campaign:', error);
      return false;
    }
  }

  /**
   * Load campaign data with migration support
   * @static
   * @returns {Object|null} Campaign data or null
   */
  static loadCampaign() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
      if (!data) return null;
      
      const campaign = JSON.parse(data);
      
      // Migration: Check if playerResources uses old resource names
      if (campaign.playerResources) {
        const needsMigration = Object.values(campaign.playerResources).some(wallet => 
          Object.keys(wallet).some(key => 
            ['promethium', 'adamantium', 'ceramite', 'plasma'].includes(key)
          )
        );
        
        if (needsMigration) {
          console.log('Migrating playerResources from old naming scheme...');
          const migrationMap = {
            'promethium': 'resource1',
            'adamantium': 'resource2', 
            'ceramite': 'resource3',
            'plasma': 'resource4'
          };
          
          const migratedPlayerResources = {};
          Object.entries(campaign.playerResources).forEach(([factionId, wallet]) => {
            migratedPlayerResources[factionId] = {};
            Object.entries(wallet).forEach(([resourceId, amount]) => {
              const newId = migrationMap[resourceId] || resourceId;
              migratedPlayerResources[factionId][newId] = amount;
            });
          });
          
          campaign.playerResources = migratedPlayerResources;
          this.saveCampaign(campaign);
        }
      }
      
      return campaign;
    } catch (error) {
      console.error('Failed to load campaign:', error);
      return null;
    }
  }

  /**
   * Save factions
   * @static
   * @param {Array} factions - Factions array
   * @returns {boolean} True if successful
   */
  static saveFactions(factions) {
    try {
      localStorage.setItem(STORAGE_KEYS.FACTIONS, JSON.stringify(factions));
      return true;
    } catch (error) {
      console.error('Failed to save factions:', error);
      return false;
    }
  }

  /**
   * Load factions
   * @static
   * @returns {Array|null} Factions or null
   */
  static loadFactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FACTIONS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load factions:', error);
      return null;
    }
  }

  /**
   * Save resources
   * @static
   * @param {Array} resources - Resources array
   * @returns {boolean} True if successful
   */
  static saveResources(resources) {
    try {
      localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
      return true;
    } catch (error) {
      console.error('Failed to save resources:', error);
      return false;
    }
  }

  /**
   * Load resources with migration support for old resource names
   * @static
   * @returns {Array|null} Resources or null
   */
  static loadResources() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
      if (!data) return null;
      
      const resources = JSON.parse(data);
      
      // Migration: Check if resources use old naming scheme
      const needsMigration = resources.some(r => 
        ['promethium', 'adamantium', 'ceramite', 'plasma'].includes(r.id)
      );
      
      if (needsMigration) {
        console.log('Migrating resources from old naming scheme...');
        const migrationMap = {
          'promethium': 'resource1',
          'adamantium': 'resource2', 
          'ceramite': 'resource3',
          'plasma': 'resource4'
        };
        
        const migratedResources = resources.map(r => ({
          ...r,
          id: migrationMap[r.id] || r.id
        }));
        
        // Save migrated resources
        this.saveResources(migratedResources);
        return migratedResources;
      }
      
      return resources;
    } catch (error) {
      console.error('Failed to load resources:', error);
      return null;
    }
  }

  /**
   * Save settings
   * @static
   * @param {Object} settings - Settings object
   * @returns {boolean} True if successful
   */
  static saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Load settings
   * @static
   * @returns {Object|null} Settings or null
   */
  static loadSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return null;
    }
  }

  /**
   * Export complete campaign to file
   * @static
   * @param {Object} campaignData - Campaign galaxy data
   * @param {Array} factions - Faction data
   * @param {Array} resources - Resource type data
   * @param {Array} planetValues - Planet value definitions
   * @param {Object} settings - UI settings
   * @param {string} filename - Output filename
   * @returns {boolean} True if successful
   */
  static exportCampaign(campaignData, factions = null, resources = null, planetValues = null, settings = null, filename = 'crusade-campaign.json') {
    try {
      // Get all data if not provided
      if (!factions) factions = this.loadFactions() || [];
      if (!resources) resources = this.loadResources() || [];
      if (!planetValues) planetValues = this.loadPlanetValues() || [];
      if (!settings) settings = this.loadSettings() || {};
      
      const data = {
        campaign: campaignData,
        factions: factions,
        resources: resources,
        planetValues: planetValues,
        settings: settings,
        exportDate: Date.now(),
        version: '2.1', // Updated version for complete export
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to export campaign:', error);
      return false;
    }
  }

  /**
   * Import complete campaign from file
   * @static
   * @param {File} file - File object
   * @returns {Promise<Object>} Complete campaign data with all components
   */
  static async importCampaign(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          // Handle both old format (v2.0) and new format (v2.1+)
          if (data.campaign && data.version) {
            // New format - return complete data
            if (data.version >= '2.1') {
              resolve({
                campaign: data.campaign,
                factions: data.factions || [],
                resources: data.resources || [],
                planetValues: data.planetValues || [],
                settings: data.settings || {},
                version: data.version
              });
            } else {
              // Old format - return just campaign for backward compatibility
              resolve({
                campaign: data.campaign,
                factions: null, // Will use defaults
                resources: null, // Will use defaults  
                planetValues: null, // Will use defaults
                settings: null, // Will use defaults
                version: data.version
              });
            }
          } else {
            reject(new Error('Invalid campaign file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Clear all stored data
   * @static
   * @returns {boolean} True if successful
   */
  static clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get total storage size in KB
   * @static
   * @returns {string} Size in KB
   */
  static getStorageSize() {
    let total = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    
    return (total / 1024).toFixed(2);
  }

  /**
   * Save planet values
   * @static
   * @param {Object} planetValues - Planet values data
   * @returns {boolean} True if successful
   */
  static savePlanetValues(planetValues) {
    try {
      localStorage.setItem('crusade_planet_values', JSON.stringify(planetValues));
      return true;
    } catch (error) {
      console.error('Failed to save planet values:', error);
      return false;
    }
  }

  /**
   * Load planet values
   * @static
   * @returns {Object|null} Planet values or null
   */
  static loadPlanetValues() {
    try {
      const data = localStorage.getItem('crusade_planet_values');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load planet values:', error);
      return null;
    }
  }
}
