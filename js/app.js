// ═══════════════════════════════════════════════════════════════════════
// Main application initialization and coordination
// ═══════════════════════════════════════════════════════════════════════

// Config and utilities
import { CONFIG } from '../config/constants.js';
import { generateId, canAfford, spendResources, addResources } from '../utils/helpers.js';

// Services
import { StorageService } from '../services/StorageService.js';

// Modules
import { ResourceManager } from '../modules/ResourceSystem.js';
import { FactionManager } from '../modules/FactionSystem.js';
import { Planet, PlanetGenerator } from '../modules/Planet.js';
import { EventGenerator } from '../modules/EventSystem.js';

// JS files
import { PlanetValueManager } from './planetValues.js';
import { Galaxy } from './galaxy.js';
import { GalaxyRenderer } from './renderer.js';
import { UIManager } from './ui.js';

// ═══════════════════════════════════════════════════════════════════════
// MAIN APPLICATION CLASS
// ═══════════════════════════════════════════════════════════════════════

class CrusadeApp {
    constructor() {
        this.galaxy = null;
        this.renderer = null;
        this.ui = null;
        this.resourceManager = new ResourceManager();
        this.planetValueManager = new PlanetValueManager();
        this.factionManager = new FactionManager();
        this.autoSaveInterval = null;
        window.app = this;
    }

    async init() {
        try {
            this.updateLoadingText('Initializing systems…');
            const canvas = document.getElementById('galaxyCanvas');
            this.renderer = new GalaxyRenderer(canvas);
            this.renderer.setApp(this);

            this.updateLoadingText('Loading campaign data…');
            const saved = Galaxy.load();
            if (saved) {
                this.galaxy = saved;
                this.factionManager.setGalaxy(this.galaxy);
                this.updateLoadingText('Restoring galaxy state…');
            } else {
                this.galaxy = new Galaxy();
                this.galaxy.generateGalaxy(CONFIG.DEFAULT_GALAXY_SIZE);
                this.factionManager.setGalaxy(this.galaxy);
                this.galaxy.distributeInitialPlanets(this.factionManager.getAll(), 2);
                this.galaxy.save();
                this.updateLoadingText('Generating new galaxy…');
            }

            this.updateLoadingText('Preparing interface…');
            this.ui = new UIManager(this);

            // Ensure all planets have current planet values
            this.updateLoadingText('Updating planet values…');
            this.ensureAllPlanetsHaveCurrentValues();

            this.updateLoadingText('Rendering Planets…');
            this.renderGalaxy();

            this.setupAutoSave();

            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('app').style.display = 'flex';
                this.ui.updateTurnDisplay();
                this.ui.updateFactionStats();
                this.ui.updateResourceBar();
                this.ui.populateFactionDropdown();
                this.ui.applyCustomText();
            }, 1000);

        } catch (err) {
            console.error('Failed to initialize app:', err);
            this.updateLoadingText('Error initializing. Please report to the developer.');
        }
    }

    updateLoadingText(text) {
        const el = document.querySelector('.loading-text');
        if (el) el.textContent = text;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════════════════════════════════

    renderGalaxy() {
        this.renderer.clear();

        // Galaxy center
        this.renderer.updateGalaxyCenter(this.galaxy.galaxyCenter.type);

        // Sector visuals (rings + labels)
        this.renderer.buildSectorVisuals(this.galaxy.sectors);

        // Planets
        this.galaxy.planets.forEach(p => this.renderer.createPlanetMesh(p));

        // Connections
        this.galaxy.planets.forEach(planet => {
            planet.connections.forEach(connId => {
                const other = this.galaxy.getPlanet(connId);
                if (other && planet.id < connId) {
                    if (!this.galaxy.eventManager.isRouteBlocked(planet.id, connId)) {
                        this.renderer.createConnectionLine(planet, other);
                    }
                }
            });
        });

        // Wormholes
        this.galaxy.eventManager.getByEffect('creates_route').forEach(wh => {
            const p1 = this.galaxy.getPlanet(wh.planetId);
            const p2 = this.galaxy.getPlanet(wh.targetPlanetId);
            if (p1 && p2 && wh.isActive()) {
                this.renderer.createConnectionLine(p1, p2, true);
                this.renderer.createEventRing(wh, p1);
                this.renderer.createEventRing(wh, p2);
            }
        });

        // Other events
        this.galaxy.eventManager.getAll().forEach(ev => {
            if (ev.effect !== 'creates_route') {
                const p = this.galaxy.getPlanet(ev.planetId);
                if (p) {
                    // Only create visual rings for active events
                    if (ev.isActive()) {
                        this.renderer.createEventRing(ev, p);
                    }
                }
            }
        });

        // Ships
        this.galaxy.ships.forEach(ship => this.renderer.createShipMesh(ship));

        // Apply connection visibility setting
        this.renderer.setConnectionsVisible(this.ui ? this.ui.connectionsVisible : true);
    }

    setupAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.galaxy) {
                this.galaxy.save();
                console.log('Auto-saved');
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CAMPAIGN LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    createNewCampaign(name = 'Crusade Campaign', size = CONFIG.DEFAULT_GALAXY_SIZE) {
        this.galaxy = new Galaxy();
        this.galaxy.name = name;
        this.galaxy.generateGalaxy(size);
        this.factionManager.setGalaxy(this.galaxy);
        this.galaxy.distributeInitialPlanets(this.factionManager.getAll(), 2);
        this.galaxy.save();
        this.renderGalaxy();
        this.ui.updateTurnDisplay();
        this.ui.updateFactionStats();
        this.ui.updateResourceBar();
        this.ui.closeSidePanel();
        this.ui.reattachEventListeners();
    }

    loadGalaxy(galaxy) {
        this.galaxy = galaxy;
        this.renderGalaxy();
        this.ui.updateTurnDisplay();
        this.ui.updateFactionStats();
        this.ui.updateResourceBar();
        this.ui.closeSidePanel();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLANET MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    addPlanet(name, type) {
        let position, attempts = 0;
        do {
            position = {
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 40,
                z: (Math.random() - 0.5) * 200
            };
            attempts++;
        } while (attempts < 100 && this.galaxy.planets.some(p => {
            const dx = p.position.x - position.x;
            const dy = p.position.y - position.y;
            const dz = p.position.z - position.z;
            return Math.sqrt(dx*dx + dy*dy + dz*dz) < CONFIG.PLANET_MIN_DISTANCE;
        }));

        const planet = new Planet({ name, type, position });
        this.galaxy.addPlanet(planet);
        this.renderer.createPlanetMesh(planet);
        this.ui.showPlanetDetails(planet.id);
        this.renderer.selectPlanet(planet.id);
        this.galaxy.save();
        this.ui.updateFactionStats();
    }

    removePlanet(planetId) {
        (this.galaxy.ships || []).filter(s => s.planetId === planetId)
            .forEach(s => this.renderer.removeShipMesh(s.id));
        this.galaxy.removePlanet(planetId);
        this.renderer.removePlanetMesh(planetId);
        this.galaxy.save();
        this.renderGalaxy();
        this.ui.updateFactionStats();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SHOP & STRATAGEM PURCHASES
    // ═══════════════════════════════════════════════════════════════════════

    // Delegate to shop manager
    purchaseItem(factionId, itemId, targetPlanetId = null) {
        const result = this.galaxy.shopManager.purchase(factionId, itemId, targetPlanetId);
        
        if (result.ok) {
            this.galaxy.save();
            this.ui.updateResourceBar();
            this.ui.updateFactionStats();
            
            if (result.planet) {
                this.renderer.updatePlanetMesh(result.planet);
            }
            
            if (result.ship) {
                this.renderer.createShipMesh(result.ship);
            }
            
            if (this.ui.selectedPlanetId) {
                this.ui.showPlanetDetails(this.ui.selectedPlanetId);
            }
            
            this.renderGalaxy();
        }
        
        return result;
    }

     // Complete two-planet shop purchase (like warp beacon)
    completeTwoPlanetPurchase(factionId, itemId, planet1Id, planet2Id) {
        const result = this.galaxy.shopManager.completeTwoPlanetPurchase(
            factionId, itemId, planet1Id, planet2Id
        );
        
        if (result.ok) {
            this.renderGalaxy();
            this.galaxy.save();
        }
        
        return result;
    }

     // Use stratagem
    useStratagem(factionId, stratagemId, targetPlanetId = null) {
        const result = this.galaxy.stratagemManager.use(factionId, stratagemId, targetPlanetId);
        
        if (result.ok) {
            this.galaxy.save();
            this.ui.updateResourceBar();
            this.ui.updateFactionStats();
            
            if (result.planet) {
                this.renderer.updatePlanetMesh(result.planet);
            }
            
            if (this.ui.selectedPlanetId) {
                this.ui.showPlanetDetails(this.ui.selectedPlanetId);
            }
            
            this.renderGalaxy();
        }
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLANET VALUES
    // ═══════════════════════════════════════════════════════════════════════

     // Ensure planets have current planet values from PlanetValueManager
    ensureAllPlanetsHaveCurrentValues() {
        const planetValues = this.planetValueManager.getAllSorted();
        let updated = false;

        this.galaxy.planets.forEach(planet => {
            // Ensure planet has values object and methods
            if (!planet.values) {
                planet.values = {};
                
                // Add methods if they don't exist
                if (!planet.getValue) {
                    planet.getValue = function(valueId) {
                        return this.values[valueId];
                    };
                }
                
                if (!planet.setValue) {
                    planet.setValue = function(valueId, value) {
                        this.values[valueId] = value;
                        // Keep backward compatibility
                        if (valueId === 'value_one') this.value_one = value;
                        if (valueId === 'value_two') this.value_two = value;
                    };
                }
            }

            planetValues.forEach(valueDef => {
                if (planet.getValue(valueDef.id) === undefined) {
                    planet.setValue(valueDef.id, valueDef.defaultValue);
                    updated = true;
                }
            });
        });

        if (updated) {
            this.galaxy.save();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// PWA INSTALL FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════

let deferredPrompt;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install button
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'flex';
    }
});

// Handle the install button click
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            console.log('PWA installation prompt not available');
            return;
        }
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
        
        // Hide the install button regardless of the outcome
        pwaInstallBtn.style.display = 'none';
    });
}

// Hide the install button if the app is already installed
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'none';
    }
});

// Check if app is already installed and hide button
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════
// APPLICATION INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const app = new CrusadeApp().init();
    
    // Close fleet control panel on page reload
    const shipPanel = document.getElementById('shipPanel');
    if (shipPanel) {
        shipPanel.style.display = 'none';
    }
});
