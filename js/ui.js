// ═══════════════════════════════════════════════════════════════════════
// UI management and interactions
// ═══════════════════════════════════════════════════════════════════════

import { EVENT_TYPES, PLANET_TYPES, BATTLE_STATUS, GALAXY_CENTER_TYPES, SHOP_ITEMS, DEFAULT_RESOURCE_TYPES, AUTO_DISTRIBUTION, STRATAGEMS } from '../config/constants.js';
import { canAfford } from '../utils/helpers.js';
import { StorageService } from '../services/StorageService.js';
import { Galaxy } from './galaxy.js';
import { FACTION_DETAIL_FIELDS } from '../modules/FactionSystem.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.isGMMode = false;
        this.compassVisible = false;
        this.currentModal = null;
        this.selectedPlanetId = null;
        this.selectedShipId   = null;
        this.followFleetId    = null; // Track which fleet is being followed

        // Connection editor state
        this.connectionEditorActive = false;
        this.connEditorFirst        = null; // first planet clicked in editor mode

        // Connection line visibility
        this.connectionsVisible = true;

        // Active shop faction (set when shop is opened)
        this.shopFactionId = null;

        this.initializeElements();
        this.loadSavedColorTheme();
        this.loadSavedAutoRotation();
        this.loadSavedCameraState();
        this.loadSavedConnectionColor();
        this.loadSavedDisplaySettings();
        this.setupEventListeners();
        
        // Initialize auto-save timer (every 30 seconds)
        this.setupAutoSaveTimer();
    }

    // ── DOM refs ─────────────────────────────────────────────────────────

    initializeElements() {
        this.menuBtn         = document.getElementById('menuBtn');
        this.editFactionBtn  = document.getElementById('editFactionBtn');
        this.reinforcementsBtn = document.getElementById('reinforcementsBtn');
        this.autoRotateBtn   = document.getElementById('autoRotateBtn');
        this.gmModeBtn       = document.getElementById('gmModeBtn');
        this.compassBtn       = document.getElementById('compassBtn');
        this.helpBtn          = document.getElementById('helpBtn');
        this.currentTurnEl   = document.getElementById('currentTurn');
        this.factionDropdown = document.getElementById('factionDropdown');

        // Initialize edit faction button as enabled (will check in click handler)
        if (this.editFactionBtn) {
            this.editFactionBtn.disabled = false;
        }

        this.sidePanel       = document.getElementById('sidePanel');
        this.panelTitle      = document.getElementById('panelTitle');
        this.panelContent    = document.getElementById('panelContent');
        this.closePanelBtn   = document.getElementById('closePanelBtn');
        this.gmPanel         = document.getElementById('gmPanel');
        this.closeGmPanelBtn = document.getElementById('closeGmPanelBtn');
        this.statsPanel      = document.getElementById('statsPanel');
        this.surfacePanel    = document.getElementById('surfacePanelContent') ? document.getElementById('surfacePanel') : null;
        this.surfacePanelContent = document.getElementById('surfacePanelContent');
        this.closeSurfacePanelBtn = document.getElementById('closeSurfacePanelBtn');

        this.shipPanel       = document.getElementById('shipPanel');
        this.shipPanelContent = document.getElementById('shipPanelContent');
        this.closeShipPanelBtn = document.getElementById('closeShipPanelBtn');

        // Edit Planet Panel
        this.editPlanetPanel = document.getElementById('editPlanetPanel');
        this.editPlanetPanelContent = document.getElementById('editPlanetPanelContent');
        this.closeEditPlanetPanelBtn = document.getElementById('closeEditPlanetPanelBtn');

        // Connection management buttons
        this.addConnectionBtn = document.getElementById('addConnectionBtn');
        this.removeConnectionBtn = document.getElementById('removeConnectionBtn');
        
        // Crusade info button
        this.crusadeInfoBtn = document.getElementById('crusadeInfoBtn');

        // Resource bar
        this.resourceBarEl   = document.getElementById('resourceBar');

        this.panelStates = {
            sidePanel:    { visible: false, position: { x: 10, y: 70 },                            size: { width: 400, height: 1200 } },
            gmPanel:      { visible: false, position: { x: window.innerWidth - 320, y: 80 },       size: { width: 300, height: 1200 } },
            statsPanel:   { visible: true,  position: { x: window.innerWidth - 310, y: 70 },      size: { width: 300, height: 1200 } },
            surfacePanel: { visible: false, position: { x: 430, y: 70 },                           size: { width: 450, height: 525 } },
            shipPanel:    { visible: false, position: { x: 430, y: 600 },                           size: { width: 450, height: 300 } },
            editPlanetPanel: { visible: false, position: { x: 340, y: 110 },                     size: { width: 450, height: 1000 } }
        };

        this.loadPanelStates();
        this.initializeDraggablePanels();
        this.initializeResizablePanels();
        this.initializePanelToggles();

        this.menuModal    = document.getElementById('menuModal');
        this.genericModal = document.getElementById('genericModal');
        this.helpModal     = document.getElementById('helpModal');
        this.factionStatsEl = document.getElementById('factionStats');
        this.toastContainer = document.getElementById('toastContainer');
        
        // Compass indicator
        this.compassIndicator = document.getElementById('compassIndicator');
        
        // Initialize modal dragging
        this.initializeModalDragging();
    }

    // ── Auto-save Management ─────────────────────────────────────────────────────

    setupAutoSaveTimer() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.app?.galaxy) {
                this.app.galaxy.save();
                this.saveCameraState(); // Save camera state along with galaxy
                console.log('Auto-saved galaxy state and camera position');
            }
        }, 30000); // 30 seconds
    }

    // ── Event wiring ─────────────────────────────────────────────────────

    setupEventListeners() {
        if (this.menuBtn) this.menuBtn.addEventListener('click', () => this.openMenu());
        if (this.editFactionBtn) this.editFactionBtn.addEventListener('click', () => this.showEditActiveFactionDialog());
        if (this.reinforcementsBtn) this.reinforcementsBtn.addEventListener('click', () => this.openReinforcementsShop());
        if (this.autoRotateBtn) this.autoRotateBtn.addEventListener('click', () => this.toggleAutoRotation());
        if (this.gmModeBtn) this.gmModeBtn.addEventListener('click', () => this.toggleGMMode());
        if (this.compassBtn) this.compassBtn.addEventListener('click', () => this.toggleCompass());
        if (this.helpBtn) this.helpBtn.addEventListener('click', () => this.openHelpModal());
        
        // Auto-save on page unload to prevent data loss
        window.addEventListener('beforeunload', () => {
            if (this.app?.galaxy) {
                this.app.galaxy.save();
                this.saveCameraState(); // Save camera state on page unload
            }
        });
        
        // Faction dropdown
        if (this.factionDropdown) this.factionDropdown.addEventListener('change', (e) => this.handleFactionSelection(e.target.value));

        // Galactic Orders button
        if (document.getElementById('ordersBtn')) document.getElementById('ordersBtn').addEventListener('click', () => this.showGalacticOrderPanel());

        this.closePanelBtn?.addEventListener('click', () => this.closeSidePanel());
        this.closeGmPanelBtn?.addEventListener('click', () => this.closeGMPanel());
        if (this.closeSurfacePanelBtn) this.closeSurfacePanelBtn.addEventListener('click', () => this.closeSurfacePanel());
        if (this.closeShipPanelBtn) this.closeShipPanelBtn.addEventListener('click', () => this.closeShipPanel());
        if (this.closeEditPlanetPanelBtn) this.closeEditPlanetPanelBtn.addEventListener('click', () => this.closeEditPlanetPanel());

        // GM Panel buttons
        if (document.getElementById('advanceTurnBtn')) document.getElementById('advanceTurnBtn').addEventListener('click', () => this.advanceTurn());
        
        if (document.getElementById('rewindTurnBtn')) document.getElementById('rewindTurnBtn').addEventListener('click', () => this.rewindTurn());
        
        // Campaign Management buttons
        if (document.getElementById('createOrderBtn')) document.getElementById('createOrderBtn').addEventListener('click', () => {
            this.showCreateOrderModal(false);
        });
        
        if (document.getElementById('editOrderBtn')) document.getElementById('editOrderBtn').addEventListener('click', () => {
            const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
            if (!currentOrder) {
                this.showToast('No active order to edit', 'info');
                return;
            }
            this.showCreateOrderModal(true);
        });
        
        if (document.getElementById('deleteOrderBtn')) document.getElementById('deleteOrderBtn').addEventListener('click', () => {
            const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
            if (!currentOrder) {
                this.showToast('No active order to delete', 'info');
                return;
            }
            
            if (confirm(`Are you sure you want to delete the current order: ${currentOrder.name}?`)) {
                const deleted = this.app.galaxy.deleteGalacticOrder();
                if (deleted) {
                    this.app.galaxy.save();
                    this.showToast('Galactic Order deleted', 'success');
                } else {
                    this.showToast('Failed to delete order', 'error');
                }
            }
        });
        
        if (document.getElementById('generateOrderBtn')) document.getElementById('generateOrderBtn').addEventListener('click', () => {
            this.app.galaxy.generateGalacticOrder();
            this.app.galaxy.save();
            this.showToast(this.getToastText('newGalacticOrder', 'New Galactic Order generated!'), 'success');
            this.showGalacticOrderPanel();
        });
        
        if (document.getElementById('autoDistBtn')) document.getElementById('autoDistBtn').addEventListener('click', () => this.showAutoDistributionSettings());
        if (document.getElementById('addPlanetBtn')) document.getElementById('addPlanetBtn').addEventListener('click', () => this.showAddPlanetDialog());
        if (document.getElementById('deletePlanetBtn')) document.getElementById('deletePlanetBtn').addEventListener('click', () => this.deletePlanet());
        if (document.getElementById('addFleetBtn')) document.getElementById('addFleetBtn').addEventListener('click', () => this.showAddFleetDialog());
        if (document.getElementById('manageFleetsBtn')) document.getElementById('manageFleetsBtn').addEventListener('click', () => this.showManageFleetsDialog());
        if (document.getElementById('addEventBtn')) document.getElementById('addEventBtn').addEventListener('click', () => this.showAddEventDialog());
        if (document.getElementById('manageResourcesBtn')) document.getElementById('manageResourcesBtn').addEventListener('click', () => this.showManageResources());
        if (document.getElementById('managePlanetValuesBtn')) document.getElementById('managePlanetValuesBtn').addEventListener('click', () => this.showManagePlanetValues());
        if (document.getElementById('galaxyCenterBtn')) document.getElementById('galaxyCenterBtn').addEventListener('click', () => this.showGalaxyCenterDialog());
        
        // Connection management buttons
        if (document.getElementById('addConnectionBtn')) document.getElementById('addConnectionBtn').addEventListener('click', () => this.showAddConnectionDialog());
        if (document.getElementById('removeConnectionBtn')) document.getElementById('removeConnectionBtn').addEventListener('click', () => this.showRemoveConnectionDialog());
        
        // Crusade info button
        if (document.getElementById('crusadeInfoBtn')) document.getElementById('crusadeInfoBtn').addEventListener('click', () => this.showCrusadeInfoDialog());
        
        // Interface & Display buttons
        if (document.getElementById('customizeUITextBtn')) document.getElementById('customizeUITextBtn').addEventListener('click', () => this.showCustomizeUITextDialog());
        if (document.getElementById('resetUITextBtn')) document.getElementById('resetUITextBtn').addEventListener('click', () => this.resetUITextToDefaults());
        if (document.getElementById('colorThemeBtn')) document.getElementById('colorThemeBtn').addEventListener('click', () => this.showColorThemeDialog());
        
        // Display controls - now handled in color theme modal

        // New GM buttons
        document.getElementById('editConnectionsBtn')?.addEventListener('click', () => this.toggleConnectionEditor());
        document.getElementById('toggleLinesBtn')?.addEventListener('click', () => this.toggleConnectionVisibility());
        document.getElementById('regenConnectionsBtn')?.addEventListener('click', () => this.regenConnections());
        document.getElementById('regenSectorsBtn')?.addEventListener('click', () => this.regenSectors());

        // Menu buttons
        document.getElementById('newCampaignBtn').addEventListener('click', () => this.newCampaign());
        document.getElementById('importCampaignBtn').addEventListener('click', () => this.importCampaign());
        document.getElementById('menuColorThemeBtn').addEventListener('click', () => this.showColorThemeDialog());
        document.getElementById('manageFactionsBtn').addEventListener('click', () => this.showManageFactions());
        document.getElementById('saveCampaignBtn').addEventListener('click', () => this.saveCampaign());
        document.getElementById('exportCampaignBtn').addEventListener('click', () => this.exportCampaign());
        document.getElementById('shopBtn')?.addEventListener('click', () => this.showShopFactionPicker());

        // Modal close delegation
        document.addEventListener('click', e => { if (e.target.classList.contains('modal-close')) this.closeModal(); });
        [this.menuModal, this.genericModal, this.helpModal].forEach(m => {
            m.addEventListener('click', e => { 
                if (e.target === m) {
                    // Check if click-outside closing is disabled
                    if (this.currentModalOptions && this.currentModalOptions.closeOnOutsideClick === false) {
                        return; // Don't close if explicitly disabled
                    }
                    this.closeModal(); 
                }
            });
        });

        // Planet selection broadcast
        window.addEventListener('planetSelected', e => this.showPlanetDetails(e.detail.planetId));
        
        // Galaxy center selection broadcast
        window.addEventListener('galaxyCenterSelected', e => this.showGalaxyCenterDetails());
        
        // Deselection broadcast
        window.addEventListener('deselectedAll', e => this.closeSidePanel());

        // Escape key and other shortcuts
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeSidePanel();
                this.deselectShip();
                if (this.connectionEditorActive) this.toggleConnectionEditor();
            }
            
            // Help shortcuts (only if not typing in input fields)
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
                if (e.key === 'h' || e.key === 'H') {
                    e.preventDefault();
                    this.openHelpModal();
                }
                if (e.key === 'm' || e.key === 'M') {
                    e.preventDefault();
                    this.openMenu();
                }
                if (e.key === 'g' || e.key === 'G') {
                    e.preventDefault();
                    this.toggleGMMode();
                }
                if (e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    this.toggleCompass();
                }
                if (e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    this.togglePanel('statsPanel');
                }
                if (e.key === ' ') {
                    e.preventDefault();
                    this.toggleAutoRotation();
                }
            }
        });
    }

    // ── Mode toggles ─────────────────────────────────────────────────────

    toggleGMMode() {
        this.isGMMode = !this.isGMMode;
        if (this.isGMMode) {
            this.gmModeBtn.classList.add('active');
            this.gmModeBtn.querySelector('.mode-text').textContent = 'GM MODE';
            this.showPanel('gmPanel');
            this.showToast(this.getToastText('gmModeActivated', 'GM Mode activated'), 'success');
        } else {
            this.gmModeBtn.classList.remove('active');
            this.gmModeBtn.querySelector('.mode-text').textContent = 'PLAYER';
            this.hidePanel('gmPanel');
            if (this.connectionEditorActive) this.toggleConnectionEditor();
            this.showToast(this.getToastText('playerModeActivated', 'Player Mode activated'), 'success');
        }
        
        // Reload planet information panel if a planet is currently selected
        if (this.selectedPlanetId) {
            this.showPlanetDetails(this.selectedPlanetId);
        }
    }

    toggleAutoRotation() {
        const on = this.app.renderer.toggleAutoRotation();
        this.autoRotateBtn.classList.toggle('active', on);
        this.autoRotateBtn.querySelector('.mode-text').textContent = on ? 'Rotation: AUTO' : 'Rotation: OFF';
        
        // Save auto rotation state to localStorage
        localStorage.setItem('autoRotationState', on.toString());
        
        this.showToast(
            on ? this.getToastText('autoRotationEnabled', 'Auto-rotation enabled') : this.getToastText('autoRotationDisabled', 'Auto-rotation disabled'),
            on ? 'success' : 'info'
        );
    }

    toggleCompass() {
        this.compassVisible = !this.compassVisible;
        if (this.compassIndicator) {
            this.compassIndicator.style.display = this.compassVisible ? 'flex' : 'none';
        }
        this.compassBtn.classList.toggle('active', this.compassVisible);
        this.showToast(
            this.compassVisible ? this.getToastText('compassEnabled', 'Compass enabled') : this.getToastText('compassDisabled', 'Compass disabled'),
            'info'
        );
    }

    // ── Connection editor ────────────────────────────────────────────────

    toggleConnectionEditor() {
        this.connectionEditorActive = !this.connectionEditorActive;
        // Let handleConnEditorClick manage
        this.app.renderer.clearConnEditorHighlights();

        const btn = document.getElementById('editConnectionsBtn');
        if (btn) btn.classList.toggle('active', this.connectionEditorActive);

        if (this.connectionEditorActive) {
            this.showToast('Connection editor ON – Select start Planet, then target planet. ESC to exit.', 'info');
        } else {
            this.showToast('Connection editor OFF', 'info');
        }
    }

    /**
     * Called by renderer when a planet is clicked while connection editor is active
     */
    handleConnEditorClick(planetId) {
        if (!this.connEditorFirst) {
            // Start connection from currently selected planet
            this.connEditorFirst = this.selectedPlanetId || planetId;
            this.app.renderer.addConnEditorHighlight(this.connEditorFirst);
            const p = this.app.galaxy.getPlanet(this.connEditorFirst);
            this.showToast(`Starting connection from: ${p?.name || this.connEditorFirst}. Click target planet.`, 'info');
        } else {
            // Second planet – toggle connection
            const second = planetId;
            this.app.renderer.clearConnEditorHighlights();

            if (second === this.connEditorFirst) {
                this.showToast('Same planet – cancelled.', 'warning');
                this.connEditorFirst = null;
                return;
            }

            const result = this.app.galaxy.toggleConnection(this.connEditorFirst, second);
            const p1 = this.app.galaxy.getPlanet(this.connEditorFirst);
            const p2 = this.app.galaxy.getPlanet(second);

            if (result === 'added') {
                this.app.renderer.createConnectionLine(p1, p2);
                this.showToast(`Link added: ${p1?.name} ↔ ${p2?.name}`, 'success');
            } else if (result === 'removed') {
                this.app.renderer.removeConnectionLine(this.connEditorFirst, second);
                this.showToast(`Link removed: ${p1?.name} ↔ ${p2?.name}`, 'success');
            }

            this.app.galaxy.save();
            // Reset connection editor state
            this.connEditorFirst = null;
        }
    }

    // ── Connection visibility toggle ─────────────────────────────────────

    toggleConnectionVisibility() {
        this.connectionsVisible = !this.connectionsVisible;
        this.app.renderer.setConnectionsVisible(this.connectionsVisible);
        const btn = document.getElementById('toggleLinesBtn');
        if (btn) btn.textContent = this.connectionsVisible ? '👁 Hide Lines' : '👁 Show Lines';
        this.showToast(this.connectionsVisible ? 'Connection lines shown' : 'Connection lines hidden', 'info');
    }

    // ── Regenerate connections / sectors ─────────────────────────────────

    regenConnections() {
        this.app.galaxy.generateConnections();
        this.app.galaxy.save();
        this.app.renderGalaxy();
        this.showToast('Connections regenerated', 'success');
    }

    regenSectors() {
        this.app.galaxy.generateSectorLayout();
    }

    closeModal() {
        if (this.currentModal) { 
            this.currentModal.classList.remove('active'); 
            this.currentModal.classList.remove('color-theme-modal'); 
            this.currentModal.classList.remove('no-backdrop'); 
            this.currentModal = null; 
        }
        this.menuModal.classList.remove('active');
        this.genericModal.classList.remove('active');
        this.helpModal.classList.remove('active');
        this.genericModal.classList.remove('color-theme-modal');
        this.genericModal.classList.remove('no-backdrop');
        this.menuModal.style.display = 'none';
        this.genericModal.style.display = 'none';
        this.helpModal.style.display = 'none';
    }

    showModal(title, content) {
        this.openGenericModal(title, content);
    }

    openGenericModal(title, content, buttons = [], options = {}) {
        document.getElementById('genericModalTitle').textContent = title;
        document.getElementById('genericModalBody').innerHTML = content;
        const footer = document.getElementById('genericModalFooter');
        footer.innerHTML = '';
        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.className = btn.className || 'btn';
            b.textContent = btn.text;
            b.onclick = e => { 
                if (typeof btn.onClick === 'function') btn.onClick(e); 
                else if (typeof btn.action === 'function') btn.action(e); 
                if (btn.close !== false) this.closeModal(); 
            };
            footer.appendChild(b);
        });
        this.genericModal.style.display = 'flex';
        this.genericModal.classList.add('active');
        this.currentModal = this.genericModal;
        
        // Store option for click-outside behavior
        this.currentModalOptions = options;
    }

    openMenu() {
        this.menuModal.style.display = 'flex';
        this.menuModal.classList.add('active');
        this.currentModal = this.menuModal;
        this.currentModalOptions = { clickOutsideToClose: true };
    }

    openHelpModal() {
        this.helpModal.style.display = 'flex';
        this.helpModal.classList.add('active');
        this.currentModal = this.helpModal;
        this.currentModalOptions = { clickOutsideToClose: true };
    }

    // ── HUD updates ──────────────────────────────────────────────────────

    updateTurnDisplay() { this.currentTurnEl.textContent = this.app.galaxy.turn; }

    // ── Faction Dropdown ─────────────────────────────────────────────────────

    /**
     * Populate the faction dropdown with available factions
     */
    populateFactionDropdown() {
        if (!this.factionDropdown) return;
        
        const factions = this.app.factionManager.getAll();
        const currentValue = this.factionDropdown.value;
        
        // Clear existing options except the default
        this.factionDropdown.innerHTML = '<option value="">Select Faction</option>';
        
        // Add faction options
        factions.forEach(faction => {
            const option = document.createElement('option');
            option.value = faction.id;
            option.textContent = `${faction.symbol} ${faction.name}`;
            option.style.color = faction.color;
            this.factionDropdown.appendChild(option);
        });
        
        // Restore previous selection if it still exists
        if (currentValue && factions.find(f => f.id === currentValue)) {
            this.factionDropdown.value = currentValue;
        }
    }

    /**
     * Handle faction selection from dropdown
     * @param {string} factionId - Selected faction ID
     */
    handleFactionSelection(factionId) {
        if (!factionId) {
            this.activeFactionId = null;
            this.showToast('No faction selected', 'info');
            return;
        }

        const faction = this.app.factionManager.getById(factionId);
        if (!faction) {
            this.activeFactionId = null;
            this.showToast('Invalid faction selected', 'error');
            return;
        }

        this.activeFactionId = factionId;
        this.showToast(`Active faction: ${faction.symbol} ${faction.name}`, 'success');
        
        // Update planet information panel if a planet is currently selected
        if (this.selectedPlanetId) {
            this.showPlanetDetails(this.selectedPlanetId);
        }
        
        // Update fleet panel if a ship is currently selected
        if (this.selectedShipId) {
            this.selectShip(this.selectedShipId);
        }
        
        // Update UI elements that depend on the active faction
        this.updateResourceBar();
        this.updateFactionStats();
        
        // Broadcast faction selection event
        window.dispatchEvent(new CustomEvent('factionSelected', {
            detail: { factionId, faction }
        }));
    }

    /**
     * Get the currently active faction ID
     * @returns {string|null} Active faction ID or null
     */
    getActiveFaction() {
        return this.activeFactionId || null;
    }

    updateFactionStats() {
        const factions = this.app.factionManager.getAll();
        
        // Update faction dropdown when stats are updated
        this.populateFactionDropdown();
        
        const renderSortedFactionStats = (sortBy) => {
            let sortedFactions = [...factions];
            
            // Always put selected faction at top if one is selected
            if (this.activeFactionId) {
                const selectedFaction = sortedFactions.find(f => f.id === this.activeFactionId);
                if (selectedFaction) {
                    sortedFactions = sortedFactions.filter(f => f.id !== this.activeFactionId);
                    sortedFactions.unshift(selectedFaction);
                }
            }
            
            switch(sortBy) {
                case 'alphabetical':
                    // Sort all factions except the first one (selected faction)
                    const [first, ...rest] = sortedFactions;
                    rest.sort((a, b) => a.name.localeCompare(b.name));
                    sortedFactions = first ? [first, ...rest] : rest;
                    break;
                case 'control':
                    // Sort all factions except the first one (selected faction)
                    const [selected, ...others] = sortedFactions;
                    others.sort((a, b) => {
                        const aPlanets = this.app.galaxy.planets.filter(p => p.owner === a.id).length;
                        const bPlanets = this.app.galaxy.planets.filter(p => p.owner === b.id).length;
                        return bPlanets - aPlanets; // Descending order (most planets first)
                    });
                    sortedFactions = selected ? [selected, ...others] : others;
                    break;
                case 'creation':
                    // Sort all factions except the first one (selected faction)
                    const [topFaction, ...remaining] = sortedFactions;
                    remaining.sort((a, b) => {
                        const crusadeDate = this.app.galaxy.createdAt ? new Date(this.app.galaxy.createdAt) : new Date('2024-01-01T00:00:00.000Z');
                        const aDate = new Date(a.createdAt || crusadeDate);
                        const bDate = new Date(b.createdAt || crusadeDate);
                        return aDate - bDate; // Ascending order (oldest first)
                    });
                    sortedFactions = topFaction ? [topFaction, ...remaining] : remaining;
                    break;
                default:
                    // Default order (selected faction already at top if exists)
                    break;
            }
            
            const stats = sortedFactions.map(f => ({
                faction: f,
                planetCount: this.app.galaxy.planets.filter(p => p.owner === f.id).length
            }));

            return stats.map(s => {
                const f = s.faction;
                const detailRows = FACTION_DETAIL_FIELDS.map(({ key, label }) => {
                    const val = f[key];
                    if (!val) return '';
                    return `<div class="faction-detail-row"><span class="faction-detail-label">${label}</span><span class="faction-detail-value">${val}</span></div>`;
                }).join('');

                // Wallet summary - show all resources for faction (even if 0)
                const wallet = this.app.galaxy.playerResources[f.id] || {};
                
                // Get all available resource types
                const allResourceTypes = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
                
                const walletHtml = allResourceTypes.map(rt => {
                    const amt = wallet[rt.id] || 0; // Show 0 if resource not present
                    return `<span class="res-chip" data-amount="${amt}" style="color:${rt.color};">${rt.icon}${amt}</span>`;
                }).join('');

                const isSelected = f.id === this.activeFactionId;
                return `
                    <div class="faction-stat${isSelected ? ' selected' : ''}" style="border-left-color: ${f.color}; color: ${f.color};" data-faction-id="${f.id}">
                        <div class="faction-stat-header" onclick="window.app.ui.toggleFactionDetail('${f.id}')">
                            <div class="faction-name">
                                <span class="faction-symbol">${f.symbol}</span>
                                ${f.name}
                            </div>
                            <div class="faction-planets">${s.planetCount > 0 ? s.planetCount + ' 🌍' : '—'}</div>
                            <span class="faction-expand-icon">${detailRows ? '▾' : ''}</span>
                        </div>
                        ${walletHtml ? `<div class="faction-wallet">${walletHtml}</div>` : ''}
                        ${detailRows ? `<div class="faction-detail-block" style="display:none;">${detailRows}</div>` : ''}
                    </div>
                `;
            }).join('');
        };

        // Add sort buttons to the stats panel
        const sortButtonsHtml = `
            <div style="display:flex;gap:0.25rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('default')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">Default</button>
                <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('alphabetical')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">A-Z</button>
                <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('control')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">Control</button>
            </div>
        `;

        this.factionStatsEl.innerHTML = `
            <div style="height:100%;overflow-y:auto;padding-right:5px;">
                ${sortButtonsHtml}
                <div style="max-height:calc(100% - 30px);overflow-y:auto;">
                    ${renderSortedFactionStats('default')}
                </div>
            </div>
        `;
        
        // Store the render function for sorting
        this.currentFactionStatsSortRender = renderSortedFactionStats;
    }

    sortFactionStats(sortBy) {
        if (this.currentFactionStatsSortRender) {
            const sortButtonsHtml = `
                <div style="display:flex;gap:0.25rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('default')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">Default</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('alphabetical')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">A-Z</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('control')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">Control</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactionStats('creation')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">Creation</button>
                </div>
            `;
            this.factionStatsEl.innerHTML = `
                <div style="height:100%;overflow-y:auto;padding-right:5px;">
                    ${sortButtonsHtml}
                    <div style="max-height:calc(100% - 30px);overflow-y:auto;">
                        ${this.currentFactionStatsSortRender(sortBy)}
                    </div>
                </div>
            `;
        }
    }

    toggleFactionDetail(factionId) {
        const row = this.factionStatsEl.querySelector(`[data-faction-id="${factionId}"]`);
        if (!row) return;
        const block = row.querySelector('.faction-detail-block');
        if (!block) return;
        const open = block.style.display !== 'none';
        block.style.display = open ? 'none' : 'block';
        const icon = row.querySelector('.faction-expand-icon');
        if (icon) icon.textContent = open ? '▾' : '▴';
    }

    // ── Resource bar (top-center, below header) ─────────────────────────

    updateResourceBar() {
        if (!this.resourceBarEl) return;
        // Show resources for all factions that have any
        const entries = Object.entries(this.app.galaxy.playerResources || {}).filter(([,w]) => Object.values(w).some(v => v > 0));
        if (entries.length === 0) { this.resourceBarEl.innerHTML = ''; return; }

        this.resourceBarEl.innerHTML = entries.map(([fid, wallet]) => {
            const f = this.app.factionManager.getById(fid);
            if (!f) return '';
            const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
            const chips = Object.entries(wallet).filter(([,v]) => v > 0).map(([res, amt]) => {
                const rt = allResources.find(r => r.id === res);
                return rt ? `<span class="resbar-chip" style="color:${rt.color};">${rt.icon} ${amt}</span>` : '';
            }).join('');
            return `<div class="resbar-faction" style="border-color:${f.color};">
                <span class="resbar-faction-name" style="color:${f.color};">${f.symbol} ${f.name}</span>
                ${chips}
            </div>`;
        }).join('');
    }

    // ── Planet detail panel ──────────────────────────────────────────────

    showPlanetDetails(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        if (!planet) return;
        this.selectedPlanetId = planetId;

        if (this.isGMMode) {
            document.getElementById('deletePlanetBtn').disabled = false;
        }

        const typeInfo = planet.getTypeInfo();
        const faction  = planet.owner ? this.app.factionManager.getById(planet.owner) : null;
        const events   = this.app.galaxy.eventManager.getByPlanet(planetId);
        const shipsHere = (this.app.galaxy.ships || []).filter(s => s.planetId === planetId);
        const sector   = this.app.galaxy.getSectorForPlanet(planetId);

        let html = `
            <div class="planet-detail">
                <div class="planet-header">
                    <h2 class="planet-name">${planet.name}</h2>
                    <div class="planet-type">${typeInfo.icon} ${typeInfo.name}</div>
                    ${sector ? `<div class="planet-sector-tag">${sector.name}</div>` : ''}
                </div>

                <div class="planet-section">
                    <h3 class="section-title">INFORMATION</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Owner</div>
                            <div class="info-value" style="color:${faction ? faction.color : 'var(--color-muted-text)'}">${faction ? faction.symbol+' '+faction.name : 'Unclaimed'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">${planet.battleStatus === 'none' ? 'Peaceful' : planet.battleStatus.toUpperCase()}</div>
                        </div>
                        ${this.renderPlanetValues(planet)}
                    </div>
                    ${planet.type === 'DESTROYED' ? '<p style="color:var(--color-destroyed);margin-top:.5rem;font-style:italic;">This world is nothing but shattered debris.</p>' : ''}
                </div>

                <div class="planet-section">
                    <h3 class="section-title">RESOURCES</h3>
                    <div class="info-grid">
                        ${(() => {
                            // Get all available resource types
                            const allResources = this.app.resourceManager?.getAll() || [];
                            console.log('Displaying planet resources for', planet.name, ':', planet.resources);
                            return allResources.map(r => {
                                // Check if resource exists in planet resources (including negative values)
                                const amount = planet.resources.hasOwnProperty(r.id) ? planet.resources[r.id] : 0;
                                console.log(`  Resource ${r.id}: ${amount} (hasOwnProperty: ${planet.resources.hasOwnProperty(r.id)})`);
                                return `<div class="info-item"><div class="info-label">${r.icon} ${r.name}</div><div class="info-value">${amount}</div></div>`;
                            }).join('');
                        })()}
                    </div>
                </div>

                ${events.length > 0 ? `
                    <div class="planet-section">
                        <h3 class="section-title">EVENTS</h3>
                        ${events.map(ev => {
                            const dest = ev.effect === 'creates_route' && ev.targetPlanetId === planetId;
                            const status = ev.isWaiting() ? 'WAITING' : (ev.isActive() ? 'ACTIVE' : 'EXPIRED');
                            const statusColor = ev.isWaiting() ? 'var(--color-warning)' : (ev.isActive() ? ev.color : 'var(--color-muted-text)');
                            const timeText = ev.isWaiting() ? `Starts in ${ev.getTurnsUntilStart()} turns` : `${ev.turnsRemaining} turns remaining`;
                            
                            return `<div class="info-item" style="border-left:3px solid ${statusColor};">
                                <div class="info-label">${ev.icon} ${ev.name}${dest?' (Destination)':''}</div>
                                <div class="info-value">
                                    <span style="font-size:.7rem;color:${statusColor};text-transform:uppercase;">${status}</span>
                                    <br>${timeText}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                ` : ''}

                ${shipsHere.length > 0 ? `
                    <div class="planet-section">
                        <h3 class="section-title">FLEETS IN ORBIT</h3>
                        ${shipsHere.map(ship => {
                            const sf = this.app.factionManager.getById(ship.factionId);
                            const selectedFactionId = this.factionDropdown.value;
                            // GM can control any ship, players can only control their own faction's ships
                            const canControl = this.isGMMode || ship.factionId === selectedFactionId;
                            return `<div class="info-item" style="border-left:3px solid ${sf?sf.color:'var(--color-muted-text)'};">
                                <div class="info-label">${sf?sf.symbol:''} ${ship.name}</div>
                                <div class="info-value" style="font-size:.85rem;cursor:${canControl ? 'pointer' : 'not-allowed'};color:${canControl ? 'var(--color-success)' : 'var(--color-danger)'};" ${canControl ? `onclick="window.app.ui.selectShip('${ship.id}')"` : ''}>▶ Select</div>
                            </div>`;
                        }).join('')}
                    </div>
                ` : ''}

                ${this.isGMMode ? `
                    <div class="planet-section">
                        <h3 class="section-title">GM ACTIONS</h3>
                        <button class="gm-btn" onclick="window.app.ui.changeOwner('${planetId}')">Change Owner</button>
                        <button class="gm-btn" onclick="window.app.ui.setBattleStatus('${planetId}')">Set Battle Status</button>
                        ${planet.type !== 'DESTROYED' ? `<button class="gm-btn" onclick="window.app.ui.editResources('${planetId}')">Edit Resources</button>` : ''}
                        <button class="gm-btn" onclick="window.app.ui.showEditPlanetDialog()">Edit Planet</button>
                        <button class="gm-btn" onclick="window.app.ui.showAddShipDialog('${planetId}')">Add Fleet Here</button>
                        <button class="gm-btn" onclick="window.app.ui.showPlanetDetails('${planetId}')">Refresh Planet Info</button>
                    </div>
                ` : ''}

                ${!this.isGMMode && this.playerCanPerformFleetActions(planetId) ? `
                    <div class="planet-section">
                        <h3 class="section-title">FLEET ACTIONS</h3>
                        ${this.playerHasShipsOnPlanet(planetId) ? `<button class="gm-btn" onclick="window.app.ui.playerSetBattleStatus('${planetId}')">Report Battle Status</button>` : ''}
                        <button class="gm-btn" onclick="window.app.ui.playerChangeOwner('${planetId}')">${planet.owner === this.activeFactionId ? 'Relinquish Planet' : 'Claim Planet'}</button>
                    </div>
                ` : ''}

                ${planet.surfaceZones && planet.surfaceZones.length > 0 ? `
                    <div class="planet-section">
                        <h3 class="section-title">SURFACE</h3>
                        <button class="gm-btn" onclick="window.app.ui.toggleSurfaceMap('${planetId}')">View Surface Map</button>
                    </div>
                ` : ''}
            </div>
        `;

        this.panelTitle.textContent = planet.name.toUpperCase();
        this.panelContent.innerHTML = html;
        this.showPanel('sidePanel');
        
        // Save camera state when planet selection changes camera focus
        setTimeout(() => this.saveCameraState(), 100);
        
        // Update surface panel if it's currently open
        if (this.panelStates.surfacePanel.visible) {
            if (planet.surfaceZones && planet.surfaceZones.length > 0) {
                // Update to show new planet's surface
                this.showSurfaceMap(planetId);
            } else {
                // Close surface panel if new planet has no surface zones
                this.closeSurfacePanel();
            }
        }
    }

    closeSidePanel() {
        this.hidePanel('sidePanel');
        this.selectedPlanetId = null;
        if (this.isGMMode) {
            document.getElementById('deletePlanetBtn').disabled = true;
        }
    }

    showGalaxyCenterDetails() {
        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        const customText = this.app.galaxy?.customText || {};
        const galaxyCenterLabel = customText.galaxyCenter || 'GALAXY CENTER';
        
        let html = `
            <div class="planet-detail">
                <div class="planet-header">
                    <h2 class="planet-name">${centerInfo.icon} ${this.processMarkdown(centerInfo.crusadeName || centerInfo.name)}</h2>
                    <div class="planet-type">${galaxyCenterLabel}</div>
                </div>

                <div class="planet-section">
                    <h3 class="section-title">CRUSADE INFORMATION</h3>
                    <p style="color:var(--color-muted-text);margin-bottom:1.1rem;">${this.processMarkdown(centerInfo.crusadeDescription || '')}</p>
                    
                    ${centerInfo.links && centerInfo.links.length > 0 ? `
                        <div class="info-value" style="margin-top:0.5rem;margin-bottom:1.1rem;">
                            <strong>Links:</strong>
                            ${centerInfo.links.map(link => `
                                <div style="margin-top:0.25rem;">
                                    <a href="${link.url}" target="_blank" style="color:var(--color-gold);text-decoration:underline;">${link.name}</a>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${centerInfo.customFields && centerInfo.customFields.length > 0 ? `
                        <div class="info-grid" id="crusadeCustomFields">
                            ${centerInfo.customFields.map((field, index) => {
                                const priorityClass = field.priority === 'critical' ? 'critical-priority' : 
                                                     field.priority === 'important' ? 'important-priority' : '';
                                const priorityIcon = field.priority === 'critical' ? '🔴' : 
                                                    field.priority === 'important' ? '🟡' : '';
                                
                                if (field.type === 'long-text') {
                                    return `
                                        <div class="info-item long-text-field ${priorityClass} custom-field-item" 
                                             style="grid-column: 1 / -1; cursor: move;" 
                                             data-field-index="${index}"
                                             draggable="${this.isGMMode ? 'true' : 'false'}">
                                            <div class="field-header">
                                                <div class="info-label">${priorityIcon} ${field.name}</div>
                                                ${this.isGMMode ? `
                                                    <div class="field-actions">
                                                        <button class="btn btn-sm btn-primary" onclick="window.app.ui.editCustomField(${index})">Edit</button>
                                                        <button class="btn btn-sm btn-danger" onclick="window.app.ui.deleteCustomField(${index})">Delete</button>
                                                    </div>
                                                ` : ''}
                                            </div>
                                            <div class="info-value long-text-content">${field.value}</div>
                                            ${field.links && field.links.length > 0 ? `
                                                <div class="info-value" style="margin-top:0.5rem;">
                                                    <strong>Links:</strong>
                                                    ${field.links.map(link => `
                                                        <div style="margin-top:0.25rem;">
                                                            <a href="${link.url}" target="_blank" style="color:var(--color-gold);text-decoration:underline;">${link.name}</a>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div class="info-item ${priorityClass} custom-field-item" 
                                             style="cursor: ${this.isGMMode ? 'move' : 'default'};" 
                                             data-field-index="${index}"
                                             draggable="${this.isGMMode ? 'true' : 'false'}">
                                            <div class="field-header">
                                                <div class="info-label">${priorityIcon} ${field.name}</div>
                                                ${this.isGMMode ? `
                                                    <div class="field-actions">
                                                        <button class="btn btn-sm btn-primary" onclick="window.app.ui.editCustomField(${index})">Edit</button>
                                                        <button class="btn btn-sm btn-danger" onclick="window.app.ui.deleteCustomField(${index})">Delete</button>
                                                    </div>
                                                ` : ''}
                                            </div>
                                            <div class="info-value">
                                                ${field.type === 'link' && field.url ? 
                                                    `<a href="${field.url}" target="_blank" style="color:var(--color-gold);text-decoration:underline;">${field.value}</a>` 
                                                    : field.value
                                                }
                                            </div>
                                        </div>
                                    `;
                                }
                            }).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="planet-section">
                    <h3 class="section-title">CAMPAIGN INFORMATION</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Campaign Start</div>
                            <div class="info-value">${new Date(this.app.galaxy._createdAt).toLocaleDateString()}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Current Turn</div>
                            <div class="info-value">${this.app.galaxy._turn}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Active Factions</div>
                            <div class="info-value">${this.app.factionManager.getAll().length}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Controlled Planets</div>
                            <div class="info-value">${this.app.galaxy._planets.filter(p => p.owner).length} / ${this.app.galaxy._planets.length}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Total Fleets</div>
                            <div class="info-value">${this.app.galaxy.ships.length}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Active Events</div>
                            <div class="info-value">${this.app.galaxy.eventManager.getAll().length}</div>
                        </div>
                    </div>
                </div>

                ${this.isGMMode ? `
                    <div class="planet-section">
                        <h3 class="section-title">GM ACTIONS</h3>
                        <button class="gm-btn" onclick="window.app.ui.showCrusadeInfoDialog()">Edit Crusade Info</button>
                        <button class="gm-btn" onclick="window.app.ui.addLongTextMessage()">Add Status/Information</button>
                    </div>
                ` : ''}
            </div>
        `;

        this.panelTitle.textContent = 'GALAXY CENTER';
        this.panelContent.innerHTML = html;
        this.showPanel('sidePanel');
        
        // Setup drag and drop for custom fields if in GM mode
        if (this.isGMMode) {
            setTimeout(() => this.setupCustomFieldDragAndDrop(), 100);
        }
    }

    // ── Surface map ──────────────────────────────────────────────────────

    toggleSurfaceMap(planetId) {
        if (this.panelStates.surfacePanel.visible && this.selectedPlanetId === planetId) {
            // Surface panel is open and showing the same planet - close it
            this.closeSurfacePanel();
        } else {
            // Either closed or showing different planet - open/update it
            this.showSurfaceMap(planetId);
        }
    }

    showSurfaceMap(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        if (!planet || !planet.surfaceZones || !planet.surfaceZones.length) return;

        this.surfacePanelContent.innerHTML = `
            <div class="surface-detail">
                <div class="surface-header"><h2 class="surface-name">${planet.name}</h2></div>
                <div class="surface-map">
                    <div class="surface-grid">
                        ${planet.surfaceZones.map(z => {
                            const ctrl = z.controller ? this.app.factionManager.getById(z.controller) : null;
                            return `<div class="surface-zone ${z.contested?'contested':''} ${ctrl?'controlled':''}" style="border-color:${ctrl?ctrl.color:'#000000'}" data-zone-id="${z.id}">
                                <div class="zone-icon">${z.icon}</div>
                                <div class="zone-name">${z.name}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        this.showPanel('surfacePanel');
        document.querySelectorAll('.surface-zone').forEach(el => {
            el.addEventListener('click', () => { 
                if (this.isGMMode) {
                    this.showZoneActions(planetId, el.dataset.zoneId); 
                } else {
                    this.showPlayerZoneActions(planetId, el.dataset.zoneId); 
                }
            });
        });
    }

    closeSurfacePanel() { this.hidePanel('surfacePanel'); }

    showCreateOrderModal(editMode = false) {
        const orderTypes = this.app.galaxy.getAvailableGalacticOrderTypes();
        const currentOrder = editMode ? this.app.galaxy.galacticOrderManager.getCurrentOrder() : null;
        
        let orderTypeOptions = '';
        orderTypes.forEach(type => {
            orderTypeOptions += `<option value="${type.key}" ${currentOrder && currentOrder.type === type.key ? 'selected' : ''}>${type.icon} ${type.name}</option>`;
        });
        
        const resourceTypes = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
        
        const modalHTML = `
            <div class="create-order-form">
                <div class="form-row">
                    <label>Order Type:</label>
                    <select id="modalOrderType" class="modal-select" ${editMode ? 'disabled' : ''}>${orderTypeOptions}</select>
                </div>
                <div class="form-row">
                    <label>Name:</label>
                    <input type="text" id="modalOrderName" class="modal-input" placeholder="Enter order name..." value="${currentOrder ? currentOrder.name : ''}">
                </div>
                <div class="form-row">
                    <label>Objective:</label>
                    <textarea id="modalOrderObjective" class="modal-textarea" placeholder="Enter objective..." rows="3">${currentOrder ? currentOrder.description : ''}</textarea>
                </div>
                <div class="form-row">
                    <label>Turns:</label>
                    <input type="number" id="modalOrderTurns" class="modal-input" min="1" max="20" value="${currentOrder ? currentOrder.turns : 5}">
                </div>
                <div class="form-row">
                    <label>Target:</label>
                    <input type="number" id="modalOrderTarget" class="modal-input" min="1" max="20" value="${currentOrder ? currentOrder.target : 3}">
                </div>
                <div class="form-row">
                    <label>Rewards:</label>
                    <div class="reward-inputs">
                        ${resourceTypes.map(resource => {
                            const value = currentOrder ? (currentOrder.reward[resource.id] || 0) : (resource.id === 'resource1' ? 5 : resource.id === 'resource2' ? 3 : resource.id === 'resource3' ? 2 : 1);
                            return `
                                <div class="reward-input-row">
                                    <span class="reward-label">${resource.icon} ${resource.name}:</span>
                                    <input type="number" id="reward_${resource.id}" class="reward-input" min="0" max="99" value="${value}">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="form-actions">
                    <button id="confirmCreateOrder" class="modal-btn primary">${editMode ? 'Update Order' : 'Create Order'}</button>
                    <button id="cancelCreateOrder" class="modal-btn secondary">Cancel</button>
                </div>
            </div>
        `;
        
        this.showModal(editMode ? 'Edit Galactic Order' : 'Create Galactic Order', modalHTML);
        
        // Add event listeners
        document.getElementById('confirmCreateOrder').addEventListener('click', () => {
            if (editMode) {
                this.updateOrderFromModal();
            } else {
                this.createOrderFromModal();
            }
        });
        
        document.getElementById('cancelCreateOrder').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Auto-fill fields when order type changes (only in create mode)
        if (!editMode) {
            document.getElementById('modalOrderType').addEventListener('change', (e) => {
                this.autoFillOrderFields(e.target.value);
            });
            
            // Initial auto-fill
            this.autoFillOrderFields(document.getElementById('modalOrderType').value);
        }
    }
    
    autoFillOrderFields(orderType) {
        const template = this.app.galaxy.getAvailableGalacticOrderTypes().find(t => t.key === orderType);
        if (template) {
            document.getElementById('modalOrderName').value = template.name;
        }
    }
    
    createOrderFromModal() {
        const orderType = document.getElementById('modalOrderType').value;
        const name = document.getElementById('modalOrderName').value.trim();
        const objective = document.getElementById('modalOrderObjective').value.trim();
        const turns = parseInt(document.getElementById('modalOrderTurns').value);
        const target = parseInt(document.getElementById('modalOrderTarget').value);
        
        if (!orderType || !name || !objective) {
            this.showToast('Please fill in all required fields', 'warning');
            return;
        }
        
        // Parse rewards from individual inputs
        const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
        const reward = {};
        allResources.forEach(resource => {
            reward[resource.id] = parseInt(document.getElementById(`reward_${resource.id}`).value) || 0;
        });
        
        // Create custom order
        const order = {
            id: Date.now().toString(),
            type: orderType,
            name: name,
            icon: this.app.galaxy.getAvailableGalacticOrderTypes().find(t => t.key === orderType)?.icon || '📋',
            description: objective,
            reward: reward,
            createdAt: Date.now(),
            expiresAt: Date.now() + (turns * 24 * 60 * 60 * 1000),
            completed: false,
            progress: 0,
            target: target,
            turns: turns
        };
        
        // Set order
        this.app.galaxy.galacticOrderManager._currentOrder = order;
        this.app.galaxy._lastModified = Date.now();
        this.app.galaxy.save();
        
        this.closeModal();
        this.showToast(`${order.icon} ${order.name} created!`, 'success');
        this.showGalacticOrderPanel();
    }

    updateOrderFromModal() {
        const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
        if (!currentOrder) {
            this.showToast('No order to update', 'error');
            return;
        }
        
        const name = document.getElementById('modalOrderName').value.trim();
        const objective = document.getElementById('modalOrderObjective').value.trim();
        const turns = parseInt(document.getElementById('modalOrderTurns').value);
        const target = parseInt(document.getElementById('modalOrderTarget').value);
        
        if (!name || !objective) {
            this.showToast('Please fill in all required fields', 'warning');
            return;
        }
        
        // Parse rewards from individual inputs
        const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
        const reward = {};
        allResources.forEach(resource => {
            reward[resource.id] = parseInt(document.getElementById(`reward_${resource.id}`).value) || 0;
        });
        
        // Update order
        currentOrder.name = name;
        currentOrder.description = objective;
        currentOrder.turns = turns;
        currentOrder.target = target;
        currentOrder.reward = reward;
        currentOrder.expiresAt = Date.now() + (turns * 24 * 60 * 60 * 1000);
        
        this.app.galaxy._lastModified = Date.now();
        this.app.galaxy.save();
        
        this.closeModal();
        this.showToast(`${currentOrder.icon} ${currentOrder.name} updated!`, 'success');
        this.showGalacticOrderPanel();
    }

    closeGMPanel() {
        this.hidePanel('gmPanel');
        this.isGMMode = false;
        this.gmModeBtn.classList.remove('active');
        this.gmModeBtn.querySelector('.mode-text').textContent = 'PLAYER';
        if (this.connectionEditorActive) this.toggleConnectionEditor();
        this.showToast('Player Mode activated', 'success');
    }

    reattachEventListeners() {
        if (this.menuBtn) this.menuBtn.addEventListener('click', () => this.openMenu());
        if (this.reinforcementsBtn) this.reinforcementsBtn.addEventListener('click', () => this.openReinforcementsShop());
        if (this.autoRotateBtn) this.autoRotateBtn.addEventListener('click', () => this.toggleAutoRotation());
        if (this.gmModeBtn) this.gmModeBtn.addEventListener('click', () => this.toggleGMMode());
        if (this.helpBtn) this.helpBtn.addEventListener('click', () => this.showHelp());
    }

    // ── Ship panel & movement ────────────────────────────────────────────

    selectShip(shipId) {
        this.deselectShip();
        const ship = (this.app.galaxy.ships || []).find(s => s.id === shipId);
        if (!ship) return;
        this.selectedShipId = shipId;

        const faction  = this.app.factionManager.getById(ship.factionId);
        const current  = this.app.galaxy.getPlanet(ship.planetId);
        const targets  = this.app.galaxy.getValidMoveTargets(shipId);

        // Highlight targets with blue rings by default
        this.app.renderer.highlightMoveTargets(targets, false);

        const targetHTML = targets.length > 0
            ? targets.map(tid => {
                const tp = this.app.galaxy.getPlanet(tid);
                return tp ? `<button class="gm-btn ship-target-btn" data-target="${tid}" onmouseover="window.app.ui.highlightTargetPlanet('${tid}', true)" onmouseout="window.app.ui.highlightTargetPlanet('${tid}', false)" onclick="window.app.ui.executeShipMove('${tid}')">${tp.name} <span style="color:var(--color-muted-text);font-size:.8rem;">(${tp.getTypeInfo().icon})</span></button>` : '';
            }).join('')
            : '<p style="color:var(--color-destroyed);font-style:italic;">No reachable planets (routes may be blocked).</p>';

        const panelHTML = `
            <div class="info-item">
                <div class="info-label">Current Location</div>
                <div class="info-value">${current?.name || 'Unknown'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Move To</div>
                <div class="info-value">${targetHTML}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Auxiliary Options</div>
                <div class="info-value">
                    <button id="focusFleetBtn" class="gm-btn text-center" onclick="window.app.ui.focusCameraOnFleet('${ship.id}')" style="width:100%; max-width:200px; text-align:center;">
                        Follow Fleet
                    </button>
                </div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header" onclick="window.app.ui.toggleCollapsible('ship-appearance')">
                    <span class="collapsible-title">Ship Appearance</span>
                    <span class="collapsible-icon" id="ship-appearance-icon">▼</span>
                </div>
                <div class="collapsible-content" id="ship-appearance">
                    <div class="info-item">
                        <div class="info-label">Ship Shape</div>
                        <div class="info-value">
                            <select id="shipShapeSelect" class="form-select" onchange="window.app.ui.changeShipShape('${ship.id}', this.value)">
                                <option value="tetrahedron">🔺 Tetrahedron</option>
                                <option value="cube">⬜ Cube</option>
                                <option value="octahedron">⬡ Octahedron</option>
                                <option value="dodecahedron">⬢ Dodecahedron</option>
                                <option value="icosahedron">💎 Icosahedron</option>
                                <option value="sphere">⚪ Sphere</option>
                                <option value="cylinder">🥫 Cylinder</option>
                                <option value="cone">🔻 Cone</option>
                                <option value="torus">⭕ Torus</option>
                                <option value="capsule">🚀 Capsule</option>
                                <option value="pyramid">📐 Pyramid</option>
                                <option value="prism">🔷 Prism</option>
                                <option value="ring">⭕ Ring</option>
                                <option value="tube">📦 Tube</option>
                            </select>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Rotation Y</div>
                        <div class="info-value">
                            <input type="range" id="shipRotationY" min="0" max="360" value="0" class="gm-slider" onchange="window.app.ui.changeShipRotation('${ship.id}', 'y', this.value)" style="margin:0; padding:0;">
                            <span id="shipRotationYValue">0°</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Size</div>
                        <div class="info-value">
                            <input type="range" id="shipSize" min="0.5" max="3" step="0.1" value="1" class="gm-slider" onchange="window.app.ui.changeShipSize('${ship.id}', this.value)" style="margin:0; padding:0;">
                            <span id="shipSizeValue">1.0x</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showPanel('shipPanel');
        this.shipPanelContent.innerHTML = panelHTML;
        
        // Update ship panel header with ship name
        const shipPanelTitle = document.querySelector('#shipPanel .ship-panel-header h3');
        if (shipPanelTitle) {
            shipPanelTitle.innerHTML = `Fleet Control - ${ship.name}`;
        }
        
        // Set current rotation and size values
        const rotationY = ship.rotationY || 0;
        const size = ship.size || 1;
        document.getElementById('shipRotationY').value = rotationY;
        document.getElementById('shipSize').value = size;
        document.getElementById('shipRotationYValue').textContent = rotationY + '°';
        document.getElementById('shipSizeValue').textContent = size.toFixed(1) + 'x';
        
        this.showToast(`Selected: ${ship.name}. Pick a green planet to move.`, 'info');
    }

    getFactionName(factionId) {
        const faction = this.app.factionManager.getById(factionId);
        return faction ? faction.name : 'Unknown';
    }

    executeShipMove(targetPlanetId) {
        if (!this.selectedShipId) return;
        
        // Check if selected faction owns this fleet
        const ship = this.app.galaxy.ships.find(s => s.id === this.selectedShipId);
        if (!ship) return;
        
        const selectedFactionId = this.factionDropdown.value;
        // GM can move any ship, players can only move their own faction's ships
        if (!this.isGMMode && ship.factionId !== selectedFactionId) {
            this.showToast(`You must select ${this.getFactionName(ship.factionId)} faction to control this fleet`, 'error');
            return;
        }
        
        const ok = this.app.galaxy.moveShip(this.selectedShipId, targetPlanetId);
        if (ok) {
            this.app.renderer.updateShipMesh(ship);
            this.app.galaxy.save();
            const target = this.app.galaxy.getPlanet(targetPlanetId);
            this.showToast(`Fleet moved to ${target?.name || 'target'}`, 'success');
            
            // If follow fleet is enabled, update camera to follow the new position
            if (this.followFleetId === this.selectedShipId) {
                this.showPlanetDetails(targetPlanetId);
                this.app.renderer.selectedPlanet = targetPlanetId;
                this.app.renderer.updateCameraPosition();
            }
            
            // Refresh the ship panel to show updated movement targets
            this.selectShip(this.selectedShipId);
        } else {
            this.showToast('Move blocked or invalid.', 'error');
        }
    }

    deselectShip() {
        this.selectedShipId = null;
        this.app.renderer.clearMoveTargetHighlights();
        
        // Reset ship panel header to default text
        const shipPanelTitle = document.querySelector('#shipPanel .ship-panel-header h3');
        if (shipPanelTitle) {
            shipPanelTitle.textContent = this.getText('fleetMovement', 'FLEET CONTROL');
        }
        
        this.hidePanel('shipPanel');
    }

    closeShipPanel() { this.deselectShip(); }

    /**
     * Highlight a specific target planet when hovering over its button
     */
    highlightTargetPlanet(planetId, isGreen) {
        if (!this.selectedShipId) return;
        
        // Update the specific planet's ring color
        this.app.renderer.updateTargetHighlight(planetId, isGreen);
    }

    /**
     * Change the rotation of a specific ship
     */
    changeShipRotation(shipId, axis, value) {
        const ship = this.app.galaxy.ships.find(s => s.id === shipId);
        if (!ship) return;
        
        // Store the rotation value on the ship
        ship.rotationY = parseInt(value);
        document.getElementById('shipRotationYValue').textContent = value + '°';
        
        // Update the ship mesh rotation
        this.app.renderer.updateShipMesh(ship);
        
        // Save the changes
        this.app.galaxy.save();
    }

    /**
     * Change the size of a specific ship
     */
    changeShipSize(shipId, value) {
        const ship = this.app.galaxy.ships.find(s => s.id === shipId);
        if (!ship) return;
        
        // Store the size value on the ship
        ship.size = parseFloat(value);
        document.getElementById('shipSizeValue').textContent = parseFloat(value).toFixed(1) + 'x';
        
        // Update the ship mesh size
        this.app.renderer.updateShipMesh(ship);
        
        // Save the changes
        this.app.galaxy.save();
    }

    /**
     * Focus camera on fleet's current planet
     */
    focusCameraOnFleet(shipId) {
        const ship = this.app.galaxy.ships.find(s => s.id === shipId);
        if (!ship) return;
        
        // Preserve selected ship state when focusing camera
        const selectedShipId = this.selectedShipId;
        
        // Selects planet where fleet is located if it's not already active planet
        if (this.selectedPlanetId !== ship.planetId) {
            this.showPlanetDetails(ship.planetId);
        }
        
        // Restore selected ship if it was deselected during planet selection
        if (selectedShipId && !this.selectedShipId) {
            this.selectedShipId = selectedShipId;
        }
        
        // Focus camera on planet where fleet is located without deselecting ship
        this.app.renderer.selectedPlanet = ship.planetId;
        this.app.renderer.updateCameraPosition();
        
        this.showToast(`Camera focused on ${ship.name}`, 'info');
    }

    /**
     * Change the shape of a specific ship
     */
    changeShipShape(shipId, shape) {
        const ship = this.app.galaxy.ships.find(s => s.id === shipId);
        if (!ship) return;
        
        // Store the shape preference on the ship
        ship.shape = shape;
        
        // Recreate the ship mesh with new shape
        this.app.renderer.updateShipMesh(ship);
        
        // Save the changes
        this.app.galaxy.save();
        
        this.showToast(`Ship shape changed to ${shape}`, 'success');
    }

    // ── Galaxy center dialog ─────────────────────────────────────────────

    showGalaxyCenterDialog() {
        const current = this.app.galaxy.galaxyCenter.type;
        const options = Object.entries(GALAXY_CENTER_TYPES).map(([key, info]) =>
            `<option value="${key}" ${key === current ? 'selected' : ''}>${info.icon} ${info.name}</option>`
        ).join('');
        const currentInfo = GALAXY_CENTER_TYPES[current];

        this.openGenericModal('Galaxy Center', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">The object at the heart of the galaxy acts as the primary light source for all planets.</p>
            <div class="form-group">
                <label class="form-label">Center Type</label>
                <select id="galaxyCenterType" class="form-select">${options}</select>
            </div>
            <div id="centerDescription" class="info-item" style="margin-top:.75rem;">
                <div class="info-label">Description</div>
                <div class="info-value" style="font-size:.9rem;color:var(--color-silver);">${currentInfo.description}</div>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Set', className: 'btn btn-primary', onClick: () => {
                const type = document.getElementById('galaxyCenterType').value;
                this.app.galaxy.setGalaxyCenterType(type);
                this.app.renderer.updateGalaxyCenter(type);
                this.app.galaxy.save();
                this.showToast(`Galaxy center set to ${GALAXY_CENTER_TYPES[type].name}`, 'success');
            }}
        ]);

        setTimeout(() => {
            const sel = document.getElementById('galaxyCenterType');
            if (sel) sel.addEventListener('change', () => {
                const info = GALAXY_CENTER_TYPES[sel.value];
                const desc = document.getElementById('centerDescription');
                if (desc && info) desc.querySelector('.info-value').textContent = info.description;
            });
        }, 50);
    }

    // ── Crusade Info Management ─────────────────────────────────────

    showCrusadeInfoDialog() {
        if (!this.isGMMode) {
            this.showToast('GM mode required to edit crusade info', 'error');
            return;
        }

        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        
        this.openGenericModal('Edit Crusade Information', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Manage crusade information displayed to all players.</p>
            
            <div class="form-group">
                <label class="form-label">Crusade Name</label>
                <input type="text" id="crusadeName" class="form-input" value="${centerInfo.crusadeName || ''}" placeholder="Enter crusade name... (Supports markdown: **bold**, *italic*, __underline__, ~~strikethrough~~)" />
            </div>
            
            <div class="form-group">
                <label class="form-label">Crusade Description</label>
                <textarea id="crusadeDescription" class="form-input" rows="4" placeholder="Enter crusade description... (Supports markdown: **bold**, *italic*, __underline__, ~~strikethrough~~)">${centerInfo.crusadeDescription || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Links</label>
                <div id="crusadeLinksContainer">
                    ${centerInfo.links && centerInfo.links.length > 0 ? centerInfo.links.map((link, index) => `
                        <div class="link-item" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
                            <input type="text" class="form-input" value="${link.name}" placeholder="Link name..." data-link-index="${index}" data-link-type="name" />
                            <input type="text" class="form-input" value="${link.url}" placeholder="URL..." data-link-index="${index}" data-link-type="url" />
                            <button class="btn btn-sm btn-danger" onclick="window.app.ui.removeCrusadeLink(${index})">Remove</button>
                        </div>
                    `).join('') : ''}
                </div>
                <button class="btn btn-sm" onclick="window.app.ui.addCrusadeLink()">Add Link</button>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Save Changes', className: 'btn btn-primary', onClick: () => {
                this.saveCrusadeInfo();
            }}
        ]);
    }

    saveCrusadeInfo() {
        const crusadeName = document.getElementById('crusadeName').value.trim();
        const crusadeDescription = document.getElementById('crusadeDescription').value.trim();
        
        // Validation
        if (!crusadeName) {
            this.showToast('Crusade name is required', 'error');
            return;
        }
        
        if (!crusadeDescription) {
            this.showToast('Crusade description is required', 'error');
            return;
        }
        
        // Preserve existing custom fields
        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        const existingCustomFields = centerInfo.customFields || [];
        
        // Collect links
        const links = [];
        const linkElements = document.querySelectorAll('#crusadeLinksContainer .link-item');
        
        linkElements.forEach(linkItem => {
            const nameInput = linkItem.querySelector('[data-link-type="name"]');
            const urlInput = linkItem.querySelector('[data-link-type="url"]');
            
            if (nameInput && urlInput && nameInput.value.trim() && urlInput.value.trim()) {
                let url = urlInput.value.trim();
                
                // Auto-add https if missing protocol
                if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                
                links.push({
                    name: nameInput.value.trim(),
                    url: url
                });
            }
        });

        // Update galaxy center using proper method
        this.app.galaxy.setCrusadeInfo(crusadeName, crusadeDescription, existingCustomFields, links);
        
        // Save to storage
        this.app.galaxy.save();
        
        // Update display
        this.showGalaxyCenterDetails();
        this.closeModal();
        this.showToast('Crusade information updated', 'success');
    }

    addCrusadeLink() {
        const container = document.getElementById('crusadeLinksContainer');
        const linkCount = container.querySelectorAll('.link-item').length;
        
        const newLink = document.createElement('div');
        newLink.className = 'link-item';
        newLink.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.5rem;';
        newLink.innerHTML = `
            <input type="text" class="form-input" placeholder="Link name..." data-link-index="${linkCount}" data-link-type="name" />
            <input type="text" class="form-input" placeholder="URL..." data-link-index="${linkCount}" data-link-type="url" />
            <button class="btn btn-sm btn-danger" onclick="window.app.ui.removeCrusadeLink(${linkCount})">Remove</button>
        `;
        
        container.appendChild(newLink);
    }

    removeCrusadeLink(index) {
        const container = document.getElementById('crusadeLinksContainer');
        const linkItem = container.querySelector(`[data-link-index="${index}"]`).closest('.link-item');
        if (linkItem) {
            linkItem.remove();
        }
    }

    addLongTextMessage() {
        if (!this.isGMMode) {
            this.showToast('GM mode required to add long-text messages', 'error');
            return;
        }

        this.openGenericModal('Add Long-Text Message', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Add a message or status update for players.</p>
            
            <div class="form-group">
                <label class="form-label">Message Title</label>
                <input type="text" id="messageTitle" class="form-input" placeholder="Enter message title..." />
            </div>
            
            <div class="form-group">
                <label class="form-label">Message Content</label>
                <textarea id="messageContent" class="form-input" rows="8" placeholder="Enter message content...&#10;&#10;This field supports basic markdown:&#10;**Bold text**  *Italic text*  __Underlined text__  ~~Strikethrough text~~&#10;&#10;Links will appear as their clickable title."></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Priority (Optional)</label>
                <select id="messagePriority" class="form-select">
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Links</label>
                <div id="messageLinksContainer">
                </div>
                <button class="btn btn-sm" onclick="window.app.ui.addMessageLink()">Add Link</button>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Add Message', className: 'btn btn-primary', onClick: () => {
                this.saveLongTextMessage();
            }}
        ], { closeOnOutsideClick: false });
    }

    addMessageLink() {
        const container = document.getElementById('messageLinksContainer');
        const linkCount = container.querySelectorAll('.link-item').length;
        
        const newLink = document.createElement('div');
        newLink.className = 'link-item';
        newLink.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.5rem;';
        newLink.innerHTML = `
            <input type="text" class="form-input" placeholder="Link name..." data-message-link-index="${linkCount}" data-message-link-type="name" />
            <input type="text" class="form-input" placeholder="URL..." data-message-link-index="${linkCount}" data-message-link-type="url" />
            <button class="btn btn-sm btn-danger" onclick="window.app.ui.removeMessageLink(${linkCount})">Remove</button>
        `;
        
        container.appendChild(newLink);
    }

    removeMessageLink(index) {
        const container = document.getElementById('messageLinksContainer');
        const linkItem = container.querySelector(`[data-message-link-index="${index}"]`).closest('.link-item');
        if (linkItem) {
            linkItem.remove();
        }
    }

    processMarkdown(text) {
        return text
            // Convert line breaks to <br>
            .replace(/\n/g, '<br>')
            // Bold: **text** -> <strong>text</strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic: *text* -> <em>text</em>
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Underline: __text__ -> <u>text</u>
            .replace(/__(.*?)__/g, '<u>$1</u>')
            // Strikethrough: ~~text~~ -> <del>text</del>
            .replace(/~~(.*?)~~/g, '<del>$1</del>');
    }

    saveLongTextMessage() {
        const title = document.getElementById('messageTitle').value.trim();
        const content = document.getElementById('messageContent').value.trim();
        const priority = document.getElementById('messagePriority').value;
        
        // Validation
        if (!title) {
            this.showToast('Message title is required', 'error');
            return;
        }
        
        if (!content) {
            this.showToast('Message content is required', 'error');
            return;
        }
        
        // Get current crusade info
        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        
        // Collect links
        const links = [];
        const linkElements = document.querySelectorAll('#messageLinksContainer .link-item');
        
        linkElements.forEach(linkItem => {
            const nameInput = linkItem.querySelector('[data-message-link-type="name"]');
            const urlInput = linkItem.querySelector('[data-message-link-type="url"]');
            
            if (nameInput && urlInput && nameInput.value.trim() && urlInput.value.trim()) {
                let url = urlInput.value.trim();
                
                // Auto-add https if missing protocol
                if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                
                links.push({
                    name: nameInput.value.trim(),
                    url: url
                });
            }
        });
        
        // Create new long-text field with processed markdown
        const newField = {
            name: title,
            value: this.processMarkdown(content),
            type: 'long-text',
            priority: priority,
            links: links,
            timestamp: new Date().toISOString()
        };
        
        // Add to custom fields
        const updatedCustomFields = [...(centerInfo.customFields || []), newField];
        
        // Update galaxy center
        this.app.galaxy.setCrusadeInfo(
            centerInfo.crusadeName || 'Crusade',
            centerInfo.crusadeDescription || '',
            updatedCustomFields,
            centerInfo.links || null
        );
        
        // Save to storage
        this.app.galaxy.save();
        
        // Update display
        this.showGalaxyCenterDetails();
        this.closeModal();
        this.showToast('Long-text message added successfully', 'success');
    }

    editCustomField(index) {
        if (!this.isGMMode) {
            this.showToast('GM mode required to edit custom fields', 'error');
            return;
        }

        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        const field = centerInfo.customFields[index];
        if (!field) return;

        this.openGenericModal('Edit Custom Field', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Edit the custom field details.</p>
            
            <div class="form-group">
                <label class="form-label">Field Name</label>
                <input type="text" id="editFieldName" class="form-input" value="${field.name}" placeholder="Enter field name..." />
            </div>
            
            <div class="form-group">
                <label class="form-label">Field Type</label>
                <select id="editFieldType" class="form-select">
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="long-text" ${field.type === 'long-text' ? 'selected' : ''}>Long Text</option>
                    <option value="link" ${field.type === 'link' ? 'selected' : ''}>Link</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Field Value</label>
                ${field.type === 'long-text' ? 
                    `<textarea id="editFieldValue" class="form-input" rows="8" placeholder="Enter field content...">${field.value}</textarea>` :
                    `<input type="text" id="editFieldValue" class="form-input" value="${field.value}" placeholder="Enter field value..." />`
                }
            </div>

            ${field.type === 'link' ? `
                <div class="form-group">
                    <label class="form-label">URL</label>
                    <input type="text" id="editFieldUrl" class="form-input" value="${field.url || ''}" placeholder="Enter URL..." />
                </div>
            ` : ''}

            <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="editFieldPriority" class="form-select">
                    <option value="normal" ${field.priority === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="important" ${field.priority === 'important' ? 'selected' : ''}>Important</option>
                    <option value="critical" ${field.priority === 'critical' ? 'selected' : ''}>Critical</option>
                </select>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Save Changes', className: 'btn btn-primary', onClick: () => {
                this.saveEditedCustomField(index);
            }}
        ], { closeOnOutsideClick: false });
    }

    saveEditedCustomField(index) {
        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        const field = centerInfo.customFields[index];
        if (!field) return;

        const name = document.getElementById('editFieldName').value.trim();
        const type = document.getElementById('editFieldType').value;
        const value = document.getElementById('editFieldValue').value.trim();
        const priority = document.getElementById('editFieldPriority').value;
        
        // Validation
        if (!name) {
            this.showToast('Field name is required', 'error');
            return;
        }
        
        if (!value) {
            this.showToast('Field value is required', 'error');
            return;
        }

        // Update field
        const updatedField = {
            ...field,
            name: name,
            type: type,
            value: value,
            priority: priority
        };

        // Handle URL for link type
        if (type === 'link') {
            const urlInput = document.getElementById('editFieldUrl');
            if (urlInput) {
                const url = urlInput.value.trim();
                if (!url) {
                    this.showToast('URL is required for link fields', 'error');
                    return;
                }
                
                // Validate and normalize URL format
                try {
                    new URL(url);
                } catch (e) {
                    this.showToast('Invalid URL format', 'error');
                    return;
                }
                
                updatedField.url = url.startsWith('http') ? url : 'https://' + url;
            }
        }

        // Update custom fields array
        const updatedCustomFields = [...centerInfo.customFields];
        updatedCustomFields[index] = updatedField;

        // Update galaxy center
        this.app.galaxy.setCrusadeInfo(
            centerInfo.crusadeName || 'Crusade',
            centerInfo.crusadeDescription || '',
            updatedCustomFields,
            centerInfo.links || null
        );
        
        // Save to storage
        this.app.galaxy.save();
        
        // Update display
        this.showGalaxyCenterDetails();
        this.closeModal();
        this.showToast('Custom field updated successfully', 'success');
    }

    deleteCustomField(index) {
        if (!this.isGMMode) {
            this.showToast('GM mode required to delete custom fields', 'error');
            return;
        }

        const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
        const field = centerInfo.customFields[index];
        if (!field) return;

        if (confirm(`Are you sure you want to delete the field "${field.name}"?`)) {
            const updatedCustomFields = centerInfo.customFields.filter((_, i) => i !== index);
            
            // Update galaxy center
            this.app.galaxy.setCrusadeInfo(
                centerInfo.crusadeName || 'Crusade',
                centerInfo.crusadeDescription || '',
                updatedCustomFields,
                centerInfo.links || null
            );
            
            // Save to storage
            this.app.galaxy.save();
            
            // Update display
            this.showGalaxyCenterDetails();
            this.showToast('Custom field deleted successfully', 'success');
        }
    }

    setupCustomFieldDragAndDrop() {
        const customFieldsContainer = document.getElementById('crusadeCustomFields');
        if (!customFieldsContainer) return;

        let draggedElement = null;
        let draggedIndex = null;

        const handleDragStart = (e) => {
            draggedElement = e.target;
            draggedIndex = parseInt(e.target.dataset.fieldIndex);
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleDragEnd = (e) => {
            e.target.classList.remove('dragging');
            draggedElement = null;
            draggedIndex = null;
        };

        const handleDragOver = (e) => {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = getDragAfterElement(customFieldsContainer, e.clientY);
            if (afterElement == null) {
                customFieldsContainer.appendChild(draggedElement);
            } else {
                customFieldsContainer.insertBefore(draggedElement, afterElement);
            }
            
            return false;
        };

        const handleDrop = (e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            // Get new order
            const items = [...customFieldsContainer.querySelectorAll('[data-field-index]')];
            const newOrder = items.map(item => parseInt(item.dataset.fieldIndex));
            
            // Reorder custom fields
            const centerInfo = this.app.galaxy.getGalaxyCenterInfo();
            const reorderedFields = newOrder.map(index => centerInfo.customFields[index]);
            
            // Update galaxy center with new order
            this.app.galaxy.setCrusadeInfo(
                centerInfo.crusadeName || 'Crusade',
                centerInfo.crusadeDescription || '',
                reorderedFields,
                centerInfo.links || null
            );
            
            // Save to storage
            this.app.galaxy.save();
            
            // Update display to reflect new indices
            this.showGalaxyCenterDetails();
            this.showToast('Fields reordered', 'success');
            return false;
        };

        const getDragAfterElement = (container, y) => {
            const draggableElements = [...container.querySelectorAll('.custom-field-item:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };

        // Add event listeners to all custom field items
        const fieldItems = customFieldsContainer.querySelectorAll('.custom-field-item');
        fieldItems.forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
        });
    }

    // ── Add ship dialog ─────────────────────────────────────────────────

    showAddShipDialog(planetId) {
        const factions = this.app.factionManager.getAll();
        this.openGenericModal('Add Ship', `
            <div class="form-group">
                <label class="form-label">Faction</label>
                <select id="shipFaction" class="form-select">
                    ${factions.map(f => `<option value="${f.id}">${f.symbol} ${f.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Fleet Name</label>
                <input type="text" id="shipName" class="form-input" placeholder="e.g. 7th Crusade Fleet" />
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Deploy', className: 'btn btn-primary', onClick: () => {
                const fId  = document.getElementById('shipFaction').value;
                const name = document.getElementById('shipName').value || 'Fleet';
                const ship = this.app.galaxy.addShip(fId, planetId, name);
                this.app.renderer.createShipMesh(ship);
                this.app.galaxy.save();
                this.showToast(`${name} deployed`, 'success');
                if (this.selectedPlanetId) this.showPlanetDetails(this.selectedPlanetId);
            }}
        ]);
    }

    // ── Coordinate adjustment helper ───────────────────────────────────────

    adjustCoordinate(inputId, delta) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const currentValue = parseFloat(input.value) || 0;
        const newValue = currentValue + delta;
        input.value = newValue.toFixed(1);
    }

    adjustCoordinateRealtime(inputId, delta) {
        const input = document.getElementById(inputId);
        if (!input || !this.selectedPlanetId) return;
        
        const planet = this.app.galaxy.getPlanet(this.selectedPlanetId);
        if (!planet) return;
        
        const currentValue = parseFloat(input.value) || 0;
        const newValue = currentValue + delta;
        input.value = newValue.toFixed(1);
        
        // Update planet position in real-time
        const coord = inputId.replace('pos', '').toLowerCase();
        planet.position[coord] = newValue;
        
        // Update mesh position immediately
        const mesh = this.app.renderer.planetMeshes.get(this.selectedPlanetId);
        if (mesh) {
            mesh.position.set(planet.position.x, planet.position.y, planet.position.z);
        }
        
        // Update connection lines
        this.app.renderGalaxy();
    }

    saveEditPlanetChanges() {
        if (!this.selectedPlanetId) return;
        const planet = this.app.galaxy.getPlanet(this.selectedPlanetId);
        if (!planet) return;
        
        planet.name = document.getElementById('editPlanetName').value;
        const newType = document.getElementById('editPlanetType').value;
        if (newType !== planet.type) {
            planet.type = newType;
            if (newType === 'DESTROYED') { 
                planet.surfaceZones = []; 
                planet.resources = {}; 
                // Reset all values to 0 for destroyed planets
                const allValues = this.app.planetValueManager.getAll();
                allValues.forEach(valueDef => {
                    planet.setValue(valueDef.id, 0);
                });
            }
            this.app.renderer.removePlanetMesh(planet.id);
            this.app.renderer.createPlanetMesh(planet);
        }
        
        // Update all planet values
        const allValues = this.app.planetValueManager.getAllSorted();
        let validationErrors = [];
        
        allValues.forEach(valueDef => {
            const input = document.getElementById(`editPlanetValue_${valueDef.id}`);
            if (input) {
                let newValue = input.value;
                if (valueDef.type === 'number') {
                    newValue = parseFloat(newValue);
                    if (isNaN(newValue)) {
                        validationErrors.push(`${valueDef.name} must be a valid number`);
                        return;
                    }
                } else if (valueDef.type === 'integer') {
                    newValue = parseInt(newValue, 10);
                    if (isNaN(newValue)) {
                        validationErrors.push(`${valueDef.name} must be a valid integer`);
                        return;
                    }
                }
                planet.setValue(valueDef.id, newValue);
            }
        });
        
        if (validationErrors.length > 0) {
            this.showToast(validationErrors.join(', '), 'error');
            return;
        }
        
        // Update position from inputs (in case manual entry was used)
        planet.position.x = parseFloat(document.getElementById('posX').value) || 0;
        planet.position.y = parseFloat(document.getElementById('posY').value) || 0;
        planet.position.z = parseFloat(document.getElementById('posZ').value) || 0;
        
        // Update mesh position
        const mesh = this.app.renderer.planetMeshes.get(planet.id);
        if (mesh) mesh.position.set(planet.position.x, planet.position.y, planet.position.z);
        
        this.app.galaxy.save();
        this.app.renderer.updatePlanetMesh(planet);
        this.app.renderGalaxy();
        this.showPlanetDetails(planet.id);
        this.closeEditPlanetPanel();
        this.showToast('Planet updated', 'success');
    }

    closeEditPlanetPanel() {
        this.hidePanel('editPlanetPanel');
    }

    // ── Connection Management ───────────────────────────────────────

    showAddConnectionDialog() {
        if (!this.isGMMode) {
            this.showToast('GM mode required to add connections', 'error');
            return;
        }

        const planets = this.app.galaxy.planets;
        const planetOptions = planets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        this.openGenericModal('Add Connection', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Select two planets to connect.</p>
            <div class="form-group">
                <label class="form-label">From Planet</label>
                <select id="connFromPlanet" class="form-select">${planetOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label">To Planet</label>
                <select id="connToPlanet" class="form-select">${planetOptions}</select>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Add Connection', className: 'btn btn-primary', onClick: () => {
                const fromId = document.getElementById('connFromPlanet').value;
                const toId = document.getElementById('connToPlanet').value;
                
                if (!fromId || !toId || fromId === toId) {
                    this.showToast('Please select two different planets', 'error');
                    return;
                }

                const result = this.app.galaxy.toggleConnection(fromId, toId);
                const p1 = this.app.galaxy.getPlanet(fromId);
                const p2 = this.app.galaxy.getPlanet(toId);

                if (result === 'added') {
                    this.app.renderer.createConnectionLine(p1, p2);
                    this.showToast(`Connection added: ${p1?.name} ↔ ${p2?.name}`, 'success');
                } else if (result === 'removed') {
                    this.app.renderer.removeConnectionLine(fromId, toId);
                    this.showToast(`Connection removed: ${p1?.name} ↔ ${p2?.name}`, 'success');
                }

                this.app.galaxy.save();
                this.closeModal();
            }}
        ]);
    }

    showRemoveConnectionDialog() {
        if (!this.isGMMode) {
            this.showToast('GM mode required to remove connections', 'error');
            return;
        }

        const planets = this.app.galaxy.planets;
        const planetOptions = planets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        this.openGenericModal('Remove Connection', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Select connection to remove.</p>
            <div class="form-group">
                <label class="form-label">Connection</label>
                <select id="connRemoveSelect" class="form-select">
                    <option value="">Select connection...</option>
                    ${this.app.galaxy.planets.flatMap(p => 
                        (p.connections || []).map(connId => {
                            const connectedPlanet = this.app.galaxy.getPlanet(connId);
                            if (connectedPlanet) {
                                return `<option value="${p.id}-${connId}">${p.name} ↔ ${connectedPlanet.name}</option>`;
                            }
                            return '';
                        }).filter(Boolean)
                    ).join('')}
                </select>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Remove Connection', className: 'btn btn-danger', onClick: () => {
                const selectedValue = document.getElementById('connRemoveSelect').value;
                if (!selectedValue) {
                    this.showToast('Please select a connection to remove', 'error');
                    return;
                }

                const [fromId, toId] = selectedValue.split('-');
                const result = this.app.galaxy.toggleConnection(fromId, toId);
                
                if (result === 'removed') {
                    this.app.renderer.removeConnectionLine(fromId, toId);
                    const p1 = this.app.galaxy.getPlanet(fromId);
                    const p2 = this.app.galaxy.getPlanet(toId);
                    this.showToast(`Connection removed: ${p1?.name} ↔ ${p2?.name}`, 'success');
                }

                this.app.galaxy.save();
                this.closeModal();
            }}
        ]);
    }

    // ── Compass Helper ─────────────────────────────────────────────────────

    updateCompass() {
        if (!this.compassIndicator || !this.compassVisible) return;
        
        // Get camera rotation from renderer
        const camera = this.app.renderer?.camera;
        if (!camera) return;
        
        // Calculate the direction the camera is looking
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        
        // Calculate angle relative to north (negative Z direction in world space)
        const northDirection = new THREE.Vector3(0, 0, -1);
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z) - Math.atan2(northDirection.x, northDirection.z);
        const degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // Update compass arrow to point to actual north
        const arrow = this.compassIndicator.querySelector('.compass-arrow');
        if (arrow) {
            arrow.style.transform = `translate(-50%, -100%) rotate(${degrees}deg)`;
        }
    }

    // ── Shop ─────────────────────────────────────────────────────────────

    /** Open reinforcements shop for selected faction */
    openReinforcementsShop() {
        const selectedFactionId = this.factionDropdown.value;
        if (!selectedFactionId) {
            this.showToast('Please select a faction first', 'warning');
            return;
        }
        this.showShop(selectedFactionId);
    }

    /** Pick which faction to shop for */
    showShopFactionPicker() {
        const factions = this.app.factionManager.getAll();
        this.openGenericModal('Reinforcements – Select Faction', `
            <p style="color:var(--color-silver);margin-bottom:1rem;">Choose which faction will make purchases.</p>
            <div style="display:flex;flex-direction:column;gap:.5rem;">
                ${factions.map(f => {
                    const wallet = this.app.galaxy.playerResources[f.id] || {};
                    const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
                    const chips = Object.entries(wallet).filter(([,v]) => v > 0).map(([res, amt]) => {
                        const rt = allResources.find(r => r.id === res);
                        return rt ? `<span style="color:${rt.color};">${rt.icon}${amt}</span>` : '';
                    }).join(' ');
                    return `<button class="gm-btn" onclick="window.app.ui.showShop('${f.id}');window.app.ui.closeModal();" style="border-left:3px solid ${f.color};">
                        <span style="color:${f.color};margin-right:.5rem;">${f.symbol} ${f.name}</span>
                        <span style="font-size:.8rem;color:var(--color-silver);">Wallet: ${chips || '—'}</span>
                    </button>`;
                }).join('')}
            </div>
        `, [{ text: 'Cancel', className: 'btn' }]);
    }

    /** Open the shop for a specific faction */
    showShop(factionId) {
        this.shopFactionId = factionId;
        const faction = this.app.factionManager.getById(factionId);
        const wallet  = this.app.galaxy.playerResources[factionId] || {};

        // Wallet display
        const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
        const walletChips = allResources.map(rt => {
            const amt = wallet[rt.id] || 0;
            return `<span class="shop-wallet-chip" style="color:${rt.color};">${rt.icon} ${amt}</span>`;
        }).join('');

        // Item cards
        const items = SHOP_ITEMS.map(item => {
            const affordable = canAfford(wallet, factionId, item.cost);
            const costStr = Object.entries(item.cost).map(([res, amt]) => {
                const resource = allResources.find(r => r.id === res);
                const resourceName = resource ? resource.name : res;
                const resourceIcon = resource ? resource.icon : '📦';
                return `${resourceIcon} ${amt} ${resourceName}`;
            }).join(', ');

            return `<div class="shop-item ${affordable ? '' : 'shop-item-cant-afford'}">
                <div class="shop-item-header">
                    <span class="shop-item-icon">${item.icon}</span>
                    <div class="shop-item-info">
                        <div class="shop-item-name">${item.name}</div>
                        <div class="shop-item-desc">${item.description}</div>
                    </div>
                </div>
                <div class="shop-item-footer">
                    <span class="shop-item-cost">${costStr}</span>
                    <button class="gm-btn shop-buy-btn ${affordable ? 'affordable' : 'unaffordable'}" onclick="window.app.ui.shopBuy('${item.id}')">Buy</button>
                </div>
            </div>`;
        }).join('');

        this.openGenericModal(`Requisitions – ${faction?.name || ''}`, `
            <div class="shop-wallet">${walletChips}</div>
            <div class="shop-items-list">${items}</div>
            ${this.selectedPlanetId ? '' : '<p class="shop-target-warn">⚠ Select a planet first for items that require a target.</p>'}
        `, [{ text: 'Close', className: 'btn' }]);
    }

    shopBuy(itemId) {
        if (!this.shopFactionId) return;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return;

        if (item.targetRequired && !this.selectedPlanetId) {
            this.showToast('Select a planet first (close shop, click a planet, then reopen shop).', 'warning');
            return;
        }

        const result = this.app.purchaseItem(this.shopFactionId, itemId, this.selectedPlanetId);
        if (result.ok) {
            this.showToast(result.message, 'success');
            // Refresh shop to reflect new wallet
            this.closeModal();
            this.showShop(this.shopFactionId);
        } else {
            this.showToast(result.message, 'error');
        }
    }

    // ── Campaign controls ────────────────────────────────────────────────

    advanceTurn() {
        const result = this.app.galaxy.advanceTurn();
        this.updateTurnDisplay();
        if (result.expiredEvents.length) {
            this.showToast(`${result.expiredEvents.length} event(s) expired`, 'info');
            result.expiredEvents.forEach(ev => this.app.renderer.removeEventRing(ev.id));
        }
        
        // Handle expired galactic order
        if (result.expiredOrder) {
            this.showToast(`⏰ Galactic Order "${result.expiredOrder.order.name}" has expired!`, 'warning');
            // Distribute rewards to all factions
            this.app.factionManager.getAll().forEach(faction => {
                Object.entries(result.expiredOrder.reward).forEach(([resource, amount]) => {
                    if (amount > 0) {
                        // Initialize wallet if it doesn't exist
                        if (!this.app.galaxy.playerResources[faction.id]) {
                            this.app.galaxy.playerResources[faction.id] = {};
                        }
                        this.app.galaxy.playerResources[faction.id][resource] = (this.app.galaxy.playerResources[faction.id][resource] || 0) + amount;
                    }
                });
            });
            this.updateFactionStats();
            this.updateResourceBar();
        }
        
        this.app.galaxy.save();
        
        // Re-render galaxy to show newly activated events and update visuals
        this.app.renderGalaxy();
        
        this.showToast(`Advanced to turn ${result.turn} — resources harvested`, 'success');
        this.updateFactionStats();
        this.updateResourceBar();
    }

    rewindTurn() {
        const currentTurn = this.app.galaxy.turn;
        const newTurn = currentTurn - 1;
        
        // Only update the turn number, don't trigger any mechanics
        this.app.galaxy._turn = newTurn;
        this.app.galaxy._lastModified = Date.now();
        this.app.galaxy.save();
        
        // Update UI displays
        this.updateTurnDisplay();
        this.app.renderGalaxy();
        
        this.showToast(`Rewound to turn ${newTurn}`, 'info');
    }

    saveCampaign() {
        this.showToast(this.app.galaxy.save() ? 'Campaign saved' : 'Save failed', this.app.galaxy.save() ? 'success' : 'error');
    }

    exportCampaign() {
        const fn = `crusade-${this.app.galaxy.name.toLowerCase().replace(/\s+/g,'-')}-turn${this.app.galaxy.turn}.json`;
        
        // Gather all campaign data for complete export
        const campaignData = this.app.galaxy.toJSON();
        const factions = this.app.factionManager.getAll();
        const resources = this.app.resourceManager.getAll();
        const planetValues = this.app.planetValueManager.getAll();
        const settings = StorageService.loadSettings() || {};
        
        this.showToast(StorageService.exportCampaign(campaignData, factions, resources, planetValues, settings, fn) ? 'Complete campaign exported' : 'Export failed', 'success');
    }

    async importCampaign() {
        const input = document.getElementById('fileInput');
        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const data = await StorageService.importCampaign(file);
                
                // Import galaxy data
                const gal = Galaxy.fromJSON(data.campaign);
                this.app.loadGalaxy(gal);
                
                // Import additional data if available (new format)
                if (data.version >= '2.1') {
                    // Import factions
                    if (data.factions && data.factions.length > 0) {
                        this.app.factionManager._factions = data.factions;
                        this.app.factionManager.save();
                    }
                    
                    // Import resources
                    if (data.resources && data.resources.length > 0) {
                        this.app.resourceManager._resources = data.resources;
                        this.app.resourceManager.save();
                    }
                    
                    // Import planet values
                    if (data.planetValues && data.planetValues.length > 0) {
                        this.app.planetValueManager.planetValues = data.planetValues;
                        this.app.planetValueManager.save();
                    }
                    
                    // Import settings
                    if (data.settings && Object.keys(data.settings).length > 0) {
                        StorageService.saveSettings(data.settings);
                    }
                    
                    this.showToast('Complete campaign imported with all custom data', 'success');
                } else {
                    this.showToast('Campaign imported (legacy format)', 'success');
                }
                
                // Refresh UI components
                this.updateFactionStats();
                this.updateResourceBar();
                this.populateFactionDropdown();
                this.applyCustomText();
                
                this.closeModal();
            } catch (err) { 
                this.showToast('Import failed: ' + err.message, 'error'); 
            }
        };
        input.click();
    }

    newCampaign() {
        this.openGenericModal('New Campaign', `
            <p>This will replace the current campaign.</p>
            <div class="form-group"><label class="form-label">Campaign Name</label>
                <input type="text" id="campaignName" class="form-input" value="Crusade Campaign" /></div>
            <div class="form-group"><label class="form-label">Galaxy Size (10–50 planets)</label>
                <input type="number" id="galaxySize" class="form-input" value="20" min="10" max="50" /></div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Create', className: 'btn btn-primary', onClick: () => {
                this.app.createNewCampaign(document.getElementById('campaignName').value, parseInt(document.getElementById('galaxySize').value));
                this.showToast('New campaign created', 'success');
            }}
        ]);
    }

    // ── Planet GM dialogs ────────────────────────────────────────────────

    showAddPlanetDialog() {
        const types = Object.keys(PLANET_TYPES);
        this.openGenericModal('Add Planet', `
            <div class="form-group"><label class="form-label">Planet Name</label>
                <input type="text" id="newPlanetName" class="form-input" placeholder="Enter planet name" /></div>
            <div class="form-group"><label class="form-label">Planet Type</label>
                <select id="newPlanetType" class="form-select">
                    ${types.map(t => `<option value="${t}">${PLANET_TYPES[t].icon} ${PLANET_TYPES[t].name}</option>`).join('')}
                </select>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Add Planet', className: 'btn btn-primary', onClick: () => {
                const n = document.getElementById('newPlanetName').value;
                const t = document.getElementById('newPlanetType').value;
                if (n) { this.app.addPlanet(n, t); this.showToast('Planet added', 'success'); }
            }}
        ]);
    }

    showEditPlanetDialog() {
        if (!this.selectedPlanetId) return;
        const planet = this.app.galaxy.getPlanet(this.selectedPlanetId);
        if (!planet) return;
        const types = Object.keys(PLANET_TYPES);
        const planetValues = this.app.planetValueManager.getAll();

        // Auto-show compass when editing planet
        if (!this.compassVisible) {
            this.toggleCompass();
        }

        // Set connection editor to start from this planet if not already in connection mode
        if (this.connectionEditorActive && !this.connEditorFirst) {
            this.connEditorFirst = this.selectedPlanetId;
            this.app.renderer.addConnEditorHighlight(this.connEditorFirst);
            const p = this.app.galaxy.getPlanet(this.connEditorFirst);
            this.showToast(`Connection editor: Starting from ${p?.name || this.connEditorFirst}`, 'info');
        }

        this.editPlanetPanelContent.innerHTML = `
            <div class="edit-planet-scroll-wrapper">
                <div class="form-group"><label class="form-label">Planet Name</label>
                    <input type="text" id="editPlanetName" class="form-input" value="${planet.name}" /></div>
                <div class="form-group"><label class="form-label">Planet Type</label>
                    <select id="editPlanetType" class="form-select">
                        ${types.map(t => `<option value="${t}" ${t===planet.type?'selected':''}>${PLANET_TYPES[t].icon} ${PLANET_TYPES[t].name}</option>`).join('')}
                    </select>
                </div>
                ${this.renderPlanetValueInputs(planet)}
                <div style="border-top:1px solid var(--color-border);margin-top:1rem;padding-top:1rem;">
                    <h4 style="margin-bottom:0.75rem;color:var(--color-silver);">📍 Position Coordinates</h4>
                    <div class="form-group"><label class="form-label">X (Left / Right)</label>
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posX', -10)">-10</button>
                            <input type="number" id="posX" class="form-input" value="${planet.position.x.toFixed(1)}" step="1" style="flex:1;" />
                            <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posX', 10)">+10</button>
                        </div>
                    </div>
                <div class="form-group"><label class="form-label">Y (Forward / Backward)</label>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posZ', -10)">-10</button>
                        <input type="number" id="posZ" class="form-input" value="${planet.position.z.toFixed(1)}" step="1" style="flex:1;" />
                        <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posZ', 10)">+10</button>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Z (Height)</label>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posY', -10)">-10</button>
                        <input type="number" id="posY" class="form-input" value="${planet.position.y.toFixed(1)}" step="1" style="flex:1;" />
                        <button type="button" class="btn btn-sm" onclick="window.app.ui.adjustCoordinateRealtime('posY', 10)">+10</button>
                    </div>
                </div>
            </div>
            <div style="margin-top:1.5rem;display:flex;gap:0.5rem;justify-content:flex-end;">
                <button class="btn" onclick="window.app.ui.closeEditPlanetPanel()">Cancel</button>
                <button class="btn btn-primary" onclick="window.app.ui.saveEditPlanetChanges()">Save Changes</button>
            </div>
        `;

        this.showPanel('editPlanetPanel');
    }

    deletePlanet() {
        if (!this.selectedPlanetId) return;
        const planet = this.app.galaxy.getPlanet(this.selectedPlanetId);
        if (!planet) return;
        this.openGenericModal('Delete Planet', `<p>Delete <strong>${planet.name}</strong>? Cannot be undone.</p>`, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Delete', className: 'btn btn-danger', onClick: () => {
                this.app.removePlanet(this.selectedPlanetId);
                this.closeSidePanel();
                this.showToast('Planet deleted', 'success');
            }}
        ]);
    }

    // ── Event dialogs ────────────────────────────────────────────────────

    showAddEventDialog() {
        const types   = Object.keys(EVENT_TYPES);
        const planets = this.app.galaxy.planets;
        
        // Check if WORMHOLE type exists and get its info
        const wormholeType = types.find(t => t === 'WORMHOLE');
        
        this.openGenericModal('Add Event', `
            <div class="form-group"><label class="form-label">Event Type</label>
                <select id="newEventType" class="form-select" onchange="window.app.ui.handleEventTypeChange()">
                    ${types.map(t => `<option value="${t}">${EVENT_TYPES[t].icon} ${EVENT_TYPES[t].name}</option>`).join('')}
                </select></div>
            <div class="form-group"><label class="form-label">Planet</label>
                <select id="newEventPlanet" class="form-select">
                    ${planets.map(p => `<option value="${p.id}" ${p.id === this.selectedPlanetId ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select></div>
            <div id="targetPlanetGroup" class="form-group" style="display:none;">
                <label class="form-label">Target Planet (for Wormholes)</label>
                <select id="newEventTargetPlanet" class="form-select">
                    <option value="">Select target planet</option>
                    ${planets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label class="form-label">Starts in (turns)</label>
                <input type="number" id="newEventStartTurn" class="form-input" value="0" min="0" max="20" /></div>
            <div class="form-group"><label class="form-label">Duration (turns)</label>
                <input type="number" id="newEventDuration" class="form-input" value="3" min="1" max="10" /></div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Add Event', className: 'btn btn-primary', onClick: () => {
                const eventType = document.getElementById('newEventType').value;
                const planetId = document.getElementById('newEventPlanet').value;
                const duration = parseInt(document.getElementById('newEventDuration').value);
                const startTurn = parseInt(document.getElementById('newEventStartTurn').value);
                
                if (eventType === 'WORMHOLE') {
                    const targetPlanetId = document.getElementById('newEventTargetPlanet').value;
                    if (!targetPlanetId) {
                        this.showToast('Please select a target planet for the wormhole', 'warning');
                        return;
                    }
                    this.app.galaxy.addWormhole(planetId, targetPlanetId, duration, startTurn);
                    this.app.renderGalaxy();
                    this.showToast('Wormhole added', 'success');
                } else {
                    this.app.galaxy.addEvent(eventType, planetId, duration, startTurn);
                    this.app.renderGalaxy();
                    this.showToast('Event added', 'success');
                }
            }}
        ]);
    }

    handleEventTypeChange() {
        const eventType = document.getElementById('newEventType').value;
        const targetGroup = document.getElementById('targetPlanetGroup');
        
        if (eventType === 'WORMHOLE') {
            targetGroup.style.display = 'block';
        } else {
            targetGroup.style.display = 'none';
        }
    }

    // ── Resource / faction management ────────────────────────────────────

    showManageResources() {
        const resources = this.app.resourceManager.getAll();
        
        const renderSortedResources = (sortBy) => {
            let sortedResources = [...resources];
            
            switch(sortBy) {
                case 'alphabetical':
                    sortedResources.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'creation':
                    sortedResources.sort((a, b) => {
                        const aDate = new Date(a.createdAt || '2024-01-01T00:00:00.000Z');
                        const bDate = new Date(b.createdAt || '2024-01-01T00:00:00.000Z');
                        return aDate - bDate;
                    });
                    break;
                default:
                    // Default order (no sorting)
                    break;
            }
            
            return sortedResources.map(r => `<div class="info-item" style="margin-bottom:.5rem;display:flex;justify-content:space-between;">
                <div class="info-label">${r.icon} ${r.name}</div>
                <button class="btn btn-danger" onclick="window.app.ui.deleteResource('${r.id}')">Delete</button>
            </div>`).join('');
        };
        
        this.openGenericModal('Manage Resources', `
            <div style="margin-bottom:1rem;">
                <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" onclick="window.app.ui.sortResources('default')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Default</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortResources('alphabetical')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">A-Z</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortResources('creation')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Creation</button>
                </div>
                <div id="resourceList" class="mb-md">
                    ${renderSortedResources('default')}
                </div>
            </div>
            <div class="form-group"><label class="form-label">New Resource Name</label><input type="text" id="newResourceName" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Icon (emoji)</label><input type="text" id="newResourceIcon" class="form-input" maxlength="2" /></div>
            <div class="form-group"><label class="form-label">Color</label><input type="color" id="newResourceColor" class="form-input" /></div>
        `, [
            { text: 'Close', className: 'btn' },
            { text: 'Add Resource', className: 'btn btn-primary', close: false, onClick: () => {
                const n = document.getElementById('newResourceName').value;
                const i = document.getElementById('newResourceIcon').value;
                if (n && i) { this.app.resourceManager.add({ name: n, icon: i, color: document.getElementById('newResourceColor').value }); this.showToast('Resource added','success'); this.updateFactionStats(); this.showManageResources(); }
            }}
        ]);
        
        // Store the render function for sorting
        this.currentResourceSortRender = renderSortedResources;
    }

    sortResources(sortBy) {
        const resourceList = document.getElementById('resourceList');
        if (resourceList && this.currentResourceSortRender) {
            resourceList.innerHTML = this.currentResourceSortRender(sortBy);
        }
    }

    deleteResource(id) { this.app.resourceManager.delete(id); this.showToast('Resource deleted','success'); this.updateFactionStats(); this.showManageResources(); }

    showManagePlanetValues() {
        const planetValues = this.app.planetValueManager.getAllSorted();
        
        const renderSortedPlanetValues = () => {
            return planetValues.map((v, index) => `<div class="info-item" style="margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center;cursor:move;" data-value-id="${v.id}" draggable="true">
                <div class="info-label" style="display:flex;align-items:center;gap:0.5rem;">
                    <span class="drag-handle" style="color:var(--color-muted-text);font-size:1.2rem;">⋮⋮</span>
                    <div>
                        <strong>${v.name}</strong>
                        <span style="margin-left:0.5rem;color:var(--color-muted-text);font-size:0.9rem;">(${v.type})</span>
                        <br>
                        <span style="font-size:0.8rem;color:var(--color-muted-text);">Default: ${v.defaultValue}</span>
                    </div>
                </div>
                <button class="btn btn-danger" onclick="window.app.ui.deletePlanetValue('${v.id}')">Delete</button>
            </div>`).join('');
        };
        
        this.openGenericModal('Manage Planet Values', `
            <div style="margin-bottom:1rem;">
                <div id="planetValueList" class="mb-md">
                    ${renderSortedPlanetValues()}
                </div>
            </div>
            <div class="form-group"><label class="form-label">Value Name</label><input type="text" id="newPlanetValueName" class="form-input" placeholder="e.g., Defense Rating" /></div>
            <div class="form-group">
                <label class="form-label">Value Type</label>
                <select id="newPlanetValueType" class="form-input" onchange="window.app.ui.updateDefaultValueInput()">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="integer">Integer</option>
                    <option value="keywords">Keywords (comma-separated)</option>
                    <option value="link">Link</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Starting Value</label><input type="text" id="newPlanetValueDefault" class="form-input" placeholder="Default value for new planets" pattern="[0-9.-]*" inputmode="decimal" /></div>
        `, [
            { text: 'Close', className: 'btn' },
            { text: 'Add Value', className: 'btn btn-primary', close: false, onClick: () => {
                const name = document.getElementById('newPlanetValueName').value;
                const type = document.getElementById('newPlanetValueType').value;
                const defaultValue = document.getElementById('newPlanetValueDefault').value;
                
                if (!name) {
                    this.showToast('Please enter a value name', 'error');
                    return;
                }
                
                let processedDefaultValue = defaultValue;
                if (type === 'number') {
                    processedDefaultValue = parseFloat(defaultValue);
                    if (isNaN(processedDefaultValue)) {
                        this.showToast('Default value must be a valid number', 'error');
                        return;
                    }
                } else if (type === 'integer') {
                    processedDefaultValue = parseInt(defaultValue, 10);
                    if (isNaN(processedDefaultValue)) {
                        this.showToast('Default value must be a valid integer', 'error');
                        return;
                    }
                }
                
                this.app.planetValueManager.add({ 
                    name, 
                    type, 
                    defaultValue: processedDefaultValue 
                });
                this.showToast('Planet value added', 'success');
                this.showManagePlanetValues();
            }}
        ]);
        
        // Setup drag and drop
        this.setupPlanetValueDragAndDrop();
    }

    deletePlanetValue(id) { 
        this.app.planetValueManager.delete(id); 
        this.showToast('Planet value deleted', 'success'); 
        this.showManagePlanetValues(); 
    }

    updateDefaultValueInput() {
        const typeSelect = document.getElementById('newPlanetValueType');
        const defaultInput = document.getElementById('newPlanetValueDefault');
        
        if (!typeSelect || !defaultInput) return;
        
        const selectedType = typeSelect.value;
        
        // Update input attributes based on type
        defaultInput.value = ''; // Clear value when type changes
        
        if (selectedType === 'text') {
            defaultInput.type = 'text';
            defaultInput.placeholder = 'Default value for new planets';
            defaultInput.removeAttribute('pattern');
            defaultInput.removeAttribute('inputmode');
        } else if (selectedType === 'number') {
            defaultInput.type = 'number';
            defaultInput.placeholder = 'Enter default number...';
            defaultInput.pattern = '[0-9.-]*';
            defaultInput.inputmode = 'decimal';
            defaultInput.step = 'any';
        } else if (selectedType === 'integer') {
            defaultInput.type = 'number';
            defaultInput.placeholder = 'Enter default integer...';
            defaultInput.pattern = '[0-9-]*';
            defaultInput.inputmode = 'numeric';
            defaultInput.step = '1';
        } else if (selectedType === 'keywords') {
            defaultInput.type = 'text';
            defaultInput.placeholder = 'Enter comma-separated keywords...';
            defaultInput.removeAttribute('pattern');
            defaultInput.removeAttribute('inputmode');
        } else if (selectedType === 'link') {
            defaultInput.type = 'url';
            defaultInput.placeholder = 'Enter URL (e.g., https://example.com)...';
            defaultInput.removeAttribute('pattern');
            defaultInput.removeAttribute('inputmode');
        }
    }

    setupPlanetValueDragAndDrop() {
        const planetValueList = document.getElementById('planetValueList');
        if (!planetValueList) return;

        let draggedElement = null;
        let draggedValueId = null;

        const handleDragStart = (e) => {
            draggedElement = e.target;
            draggedValueId = e.target.dataset.valueId;
            e.target.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleDragEnd = (e) => {
            e.target.style.opacity = '';
            draggedElement = null;
            draggedValueId = null;
        };

        const handleDragOver = (e) => {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = getDragAfterElement(planetValueList, e.clientY);
            if (afterElement == null) {
                planetValueList.appendChild(draggedElement);
            } else {
                planetValueList.insertBefore(draggedElement, afterElement);
            }
            
            return false;
        };

        const handleDrop = (e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            // Update the order in the manager
            const items = [...planetValueList.querySelectorAll('[data-value-id]')];
            items.forEach((item, index) => {
                const valueId = item.dataset.valueId;
                this.app.planetValueManager.reorderValue(valueId, index);
            });
            
            this.showToast('Values reordered', 'success');
            return false;
        };

        const getDragAfterElement = (container, y) => {
            const draggableElements = [...container.querySelectorAll('[data-value-id]:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };

        // Add event listeners to all value items
        const valueItems = planetValueList.querySelectorAll('[data-value-id]');
        valueItems.forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
        });
    }

    renderPlanetValues(planet) {
        const planetValues = this.app.planetValueManager.getAllSorted();
        
        return planetValues.map(valueDef => {
            const value = planet.getValue(valueDef.id);
            let displayValue = value !== undefined ? value : valueDef.defaultValue;
            
            // Handle special display for different types
            if (valueDef.type === 'link' && displayValue) {
                // Make links clickable
                const url = displayValue.startsWith('http') ? displayValue : `https://${displayValue}`;
                displayValue = `<a href="${url}" target="_blank" style="color:var(--color-link);text-decoration:underline;">${displayValue}</a>`;
            } else if (valueDef.type === 'keywords' && displayValue) {
                // Display keywords as tags
                displayValue = displayValue.split(',').map(keyword => 
                    `<span class="keyword-tag" style="background:var(--color-button-background);color:var(--color-primary-accent);padding:2px 6px;border-radius:3px;margin:2px;font-size:0.8rem;">${keyword.trim()}</span>`
                ).join(' ');
            }
            
            return `
                <div class="info-item">
                    <div class="info-label">${valueDef.name}</div>
                    <div class="info-value">${displayValue}</div>
                </div>
            `;
        }).join('');
    }

    renderPlanetValueInputs(planet) {
        const planetValues = this.app.planetValueManager.getAllSorted();
        
        return planetValues.map(valueDef => {
            const currentValue = planet.getValue(valueDef.id) ?? valueDef.defaultValue;
            let inputType = valueDef.type === 'text' ? 'text' : 'number';
            let step = valueDef.type === 'integer' ? '1' : 'any';
            let placeholder = valueDef.type === 'text' ? 'Enter text...' : 'Enter number...';
            let pattern = '';
            let inputmode = '';
            
            // Handle special types
            if (valueDef.type === 'keywords') {
                inputType = 'text';
                placeholder = 'Enter comma-separated keywords...';
            } else if (valueDef.type === 'link') {
                inputType = 'url';
                placeholder = 'Enter URL...';
            } else if (valueDef.type === 'number' || valueDef.type === 'integer') {
                pattern = '[0-9.-]*';
                inputmode = valueDef.type === 'integer' ? 'numeric' : 'decimal';
            }
            
            return `
                <div class="form-group">
                    <label class="form-label">${valueDef.name}</label>
                    <input type="${inputType}" 
                           id="editPlanetValue_${valueDef.id}" 
                           class="form-input" 
                           value="${currentValue}" 
                           ${step ? `step="${step}"` : ''}
                           ${pattern ? `pattern="${pattern}"` : ''}
                           ${inputmode ? `inputmode="${inputmode}"` : ''}
                           placeholder="${placeholder}" />
                </div>
            `;
        }).join('');
    }

    showManageFactions() {
        // Check if user has GM privileges
        if (!this.isGMMode) {
            this.showToast('GM mode required to manage factions', 'error');
            return;
        }
        
        const factions = this.app.factionManager.getAll();
        
        const renderSortedFactions = (sortBy) => {
            let sortedFactions = [...factions];
            
            switch(sortBy) {
                case 'alphabetical':
                    sortedFactions.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'creation':
                    sortedFactions.sort((a, b) => {
                        const crusadeDate = this.app.galaxy.createdAt ? new Date(this.app.galaxy.createdAt) : new Date('2024-01-01T00:00:00.000Z');
                        const aDate = new Date(a.createdAt || crusadeDate);
                        const bDate = new Date(b.createdAt || crusadeDate);
                        return aDate - bDate; // Ascending order (oldest first)
                    });
                    break;
                case 'control':
                    sortedFactions.sort((a, b) => {
                        const aPlanets = this.app.galaxy.planets.filter(p => p.owner === a.id).length;
                        const bPlanets = this.app.galaxy.planets.filter(p => p.owner === b.id).length;
                        return bPlanets - aPlanets; // Descending order (most planets first)
                    });
                    break;
                case 'alliance':
                    // Placeholder for future alliance sorting
                    sortedFactions.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                default:
                    // Default order (no sorting)
                    break;
            }
            
            return sortedFactions.map(f => `<div class="faction-stat" style="border-left-color:${f.color};margin-bottom:.5rem;">
                <div class="faction-stat-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="faction-name"><span class="faction-symbol">${f.symbol}</span>${f.name}</div>
                    <div style="display:flex;gap:.4rem;">
                        <button class="btn" style="padding:.2rem .5rem;font-size:.75rem;" onclick="window.app.ui.showEditFactionDialog('${f.id}')">Edit</button>
                        <button class="btn btn-danger" style="padding:.2rem .5rem;font-size:.75rem;" onclick="window.app.ui.deleteFaction('${f.id}')">Del</button>
                    </div>
                </div>
            </div>`).join('');
        };
        
        this.openGenericModal('Manage Factions', `
            <div style="margin-bottom:1rem;">
                <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactions('default')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Default</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactions('alphabetical')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">A-Z</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactions('control')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Control</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactions('creation')" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Creation</button>
                    <button class="btn btn-sm" onclick="window.app.ui.sortFactions('alliance')" style="padding:0.25rem 0.5rem;font-size:0.8rem;" disabled>Alliance</button>
                </div>
                <div id="factionList" class="mb-md">
                    ${renderSortedFactions('default')}
                </div>
            </div>
            <div class="form-group"><label class="form-label">Faction Name</label><input type="text" id="newFactionName" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Symbol</label><input type="text" id="newFactionSymbol" class="form-input" maxlength="2" /></div>
            <div class="form-group"><label class="form-label">Color</label><input type="color" id="newFactionColor" class="form-input" /></div>
        `, [
            { text: 'Close', className: 'btn' },
            { text: 'Add Faction', className: 'btn btn-primary', close: false, onClick: () => {
                const n = document.getElementById('newFactionName').value;
                const s = document.getElementById('newFactionSymbol').value;
                if (n && s) { 
                    this.app.factionManager.add({ name: n, symbol: s, color: document.getElementById('newFactionColor').value }); 
                    this.showToast('Faction added','success'); 
                    this.populateFactionDropdown(); // Refresh faction dropdown
                    this.updateFactionStats(); // Refresh faction standings panel
                    this.showManageFactions(); 
                }
            }}
        ]);
        
        // Store the render function for sorting
        this.currentFactionSortRender = renderSortedFactions;
    }

    sortFactions(sortBy) {
        const factionList = document.getElementById('factionList');
        if (factionList && this.currentFactionSortRender) {
            factionList.innerHTML = this.currentFactionSortRender(sortBy);
        }
    }

    showEditFactionDialog(factionId) {
        const f = this.app.factionManager.getById(factionId);
        if (!f) return;
        const detailInputs = FACTION_DETAIL_FIELDS.map(({ key, label }) => `
            <div class="form-group">
                <label class="form-label">${label}</label>
                <textarea id="editFaction_${key}" class="form-textarea" style="min-height:55px;" placeholder="${label}…">${f[key] || ''}</textarea>
            </div>`
        ).join('');

        this.openGenericModal(`Edit: ${f.name}`, `
            <div class="form-group"><label class="form-label">Name</label><input type="text" id="editFactionName" class="form-input" value="${f.name}" /></div>
            <div class="form-group"><label class="form-label">Symbol</label><input type="text" id="editFactionSymbol" class="form-input" value="${f.symbol}" maxlength="2" /></div>
            <div class="form-group"><label class="form-label">Color</label><input type="color" id="editFactionColor" class="form-input" value="${f.color}" /></div>
            <div class="form-group"><label class="form-label">Short Description</label><input type="text" id="editFactionDesc" class="form-input" value="${f.description || ''}" /></div>
            ${detailInputs}
        `, [
            { text: 'Cancel', className: 'btn', close: true },
            { text: 'Save', className: 'btn btn-primary', close: true, onClick: () => {
                const updates = {
                    name: document.getElementById('editFactionName').value,
                    symbol: document.getElementById('editFactionSymbol').value,
                    color: document.getElementById('editFactionColor').value,
                    description: document.getElementById('editFactionDesc').value
                };
                FACTION_DETAIL_FIELDS.forEach(({ key }) => { updates[key] = document.getElementById(`editFaction_${key}`).value; });
                this.app.factionManager.update(factionId, updates);
                this.showToast('Faction updated', 'success');
                this.updateFactionStats();
                // Refresh the manage factions display to show updated faction info
                setTimeout(() => this.showManageFactions(), 100);
            }}
        ], { closeOnOutsideClick: false });
    }

    deleteFaction(id) { this.app.factionManager.delete(id); this.showToast('Faction deleted','success'); this.showManageFactions(); }

    showEditActiveFactionDialog() {
        const factionId = this.getActiveFaction();
        if (!factionId) {
            this.showToast('Please select a faction first', 'warning');
            return;
        }

        const f = this.app.factionManager.getById(factionId);
        if (!f) {
            this.showToast('Active faction not found', 'error');
            return;
        }

        // Create the same edit dialog as GM mode but only for the active faction
        const detailInputs = FACTION_DETAIL_FIELDS.map(({ key, label }) => `
            <div class="form-group">
                <label class="form-label">${label}</label>
                <textarea id="editFaction_${key}" class="form-textarea" style="min-height:55px;" placeholder="${label}…">${f[key] || ''}</textarea>
            </div>`
        ).join('');

        this.openGenericModal(`Edit Your Faction: ${f.name}`, `
            <div class="form-group"><label class="form-label">Name</label><input type="text" id="editFactionName" class="form-input" value="${f.name}" /></div>
            <div class="form-group"><label class="form-label">Symbol</label><input type="text" id="editFactionSymbol" class="form-input" value="${f.symbol}" maxlength="2" /></div>
            <div class="form-group"><label class="form-label">Color</label><input type="color" id="editFactionColor" class="form-input" value="${f.color}" /></div>
            <div class="form-group"><label class="form-label">Short Description</label><input type="text" id="editFactionDesc" class="form-input" value="${f.description || ''}" /></div>
            ${detailInputs}
        `, [
            { text: 'Cancel', className: 'btn', close: true },
            { text: 'Save', className: 'btn btn-primary', close: true, onClick: () => {
                const updates = {
                    name: document.getElementById('editFactionName').value,
                    symbol: document.getElementById('editFactionSymbol').value,
                    color: document.getElementById('editFactionColor').value,
                    description: document.getElementById('editFactionDesc').value
                };
                FACTION_DETAIL_FIELDS.forEach(({ key }) => { updates[key] = document.getElementById(`editFaction_${key}`).value; });
                this.app.factionManager.update(factionId, updates);
                this.showToast('Faction updated', 'success');
                this.updateFactionStats();
                this.populateFactionDropdown(); // Refresh dropdown to show updated name/symbol
            }}
        ], { closeOnOutsideClick: false });
    }

    // ── Planet GM actions ────────────────────────────────────────────────

    /**
     * Check if player can perform fleet actions on a planet
     * @param {string} planetId - Planet ID to check
     * @returns {boolean} - True if player has ships on the planet OR owns the planet
     */
    playerCanPerformFleetActions(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        if (!planet || !this.activeFactionId) return false;
        
        // Check if player has ships on this planet
        const playerShips = (this.app.galaxy.ships || []).filter(s => 
            s.factionId === this.activeFactionId && s.planetId === planetId
        );
        
        const hasShips = playerShips.length > 0;
        const ownsPlanet = planet.owner === this.activeFactionId;
        
        return hasShips || ownsPlanet;
    }

    /**
     * Check if player has ships on a planet
     * @param {string} planetId - Planet ID to check
     * @returns {boolean} - True if player has ships on the planet
     */
    playerHasShipsOnPlanet(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        if (!planet || !this.activeFactionId) return false;
        
        // Check if player has ships on this planet
        const playerShips = (this.app.galaxy.ships || []).filter(s => 
            s.factionId === this.activeFactionId && s.planetId === planetId
        );
        
        return playerShips.length > 0;
    }

    /**
     * Player version of changeOwner - limited to self or unclaimed
     */
    playerChangeOwner(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        const playerFaction = this.app.factionManager.getById(this.activeFactionId);
        const isOwnedByPlayer = planet.owner === this.activeFactionId;
        
        this.openGenericModal(isOwnedByPlayer ? 'Relinquish Planet' : 'Claim Planet', `
            <div class="form-group"><label class="form-label">New Owner</label>
                <select id="newOwner" class="form-select">
                    ${!isOwnedByPlayer ? `<option value="${this.activeFactionId}" selected>${playerFaction.symbol} ${playerFaction.name}</option>` : ''}
                    <option value="">Unclaimed</option>
                </select></div>
            <p style="color:var(--color-muted-text);font-size:0.9rem;margin-top:0.5rem;">
                ${isOwnedByPlayer 
                    ? 'You can relinquish ownership of this planet, leaving it unclaimed.' 
                    : 'You can claim this planet for yourself or leave it unclaimed.'}
            </p>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: isOwnedByPlayer ? 'Relinquish' : 'Claim', className: 'btn btn-primary', onClick: () => {
                const newOwner = document.getElementById('newOwner').value || null;
                planet.setOwner(newOwner);
                this.app.renderer.updatePlanetMesh(planet);
                this.app.galaxy.save();
                this.showPlanetDetails(planetId);
                this.updateFactionStats();
                this.showToast(
                    newOwner === this.activeFactionId 
                        ? `Planet claimed by ${playerFaction.name}`
                        : newOwner 
                            ? 'Planet ownership transferred' 
                            : 'Planet relinquished (unclaimed)', 
                    'success'
                );
            }}
        ]);
    }

    /**
     * Player version of setBattleStatus - same as GM version but with different messaging
     */
    playerSetBattleStatus(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        this.openGenericModal('Set Battle Status', `
            <div class="form-group"><label class="form-label">Battle Status</label>
                <select id="battleStatus" class="form-select">
                    <option value="${BATTLE_STATUS.NONE}" ${planet.battleStatus===BATTLE_STATUS.NONE?'selected':''}>None</option>
                    <option value="${BATTLE_STATUS.SKIRMISH}" ${planet.battleStatus===BATTLE_STATUS.SKIRMISH?'selected':''}>Skirmish</option>
                    <option value="${BATTLE_STATUS.MAJOR}" ${planet.battleStatus===BATTLE_STATUS.MAJOR?'selected':''}>Major Battle</option>
                    <option value="${BATTLE_STATUS.SIEGE}" ${planet.battleStatus===BATTLE_STATUS.SIEGE?'selected':''}>Siege</option>
                </select></div>
            <p style="color:var(--color-muted-text);font-size:0.9rem;margin-top:0.5rem;">Report the battle status based on your fleet's engagement.</p>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Set', className: 'btn btn-primary', onClick: () => {
                planet.setBattleStatus(document.getElementById('battleStatus').value);
                this.app.renderer.updatePlanetMesh(planet);
                this.app.galaxy.save();
                this.showPlanetDetails(planetId);
                this.showToast('Battle status reported', 'success');
            }}
        ]);
    }

    changeOwner(planetId) {
        const planet  = this.app.galaxy.getPlanet(planetId);
        const factions = this.app.factionManager.getAll();
        this.openGenericModal('Change Owner', `
            <div class="form-group"><label class="form-label">New Owner</label>
                <select id="newOwner" class="form-select">
                    <option value="">Unclaimed</option>
                    ${factions.map(f => `<option value="${f.id}" ${planet.owner===f.id?'selected':''}>${f.symbol} ${f.name}</option>`).join('')}
                </select></div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Change', className: 'btn btn-primary', onClick: () => {
                planet.setOwner(document.getElementById('newOwner').value || null);
                this.app.renderer.updatePlanetMesh(planet);
                this.app.galaxy.save();
                this.showPlanetDetails(planetId);
                this.updateFactionStats();
                this.showToast('Owner changed', 'success');
            }}
        ]);
    }

    setBattleStatus(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        this.openGenericModal('Set Battle Status', `
            <div class="form-group"><label class="form-label">Battle Status</label>
                <select id="battleStatus" class="form-select">
                    <option value="${BATTLE_STATUS.NONE}" ${planet.battleStatus===BATTLE_STATUS.NONE?'selected':''}>None</option>
                    <option value="${BATTLE_STATUS.SKIRMISH}" ${planet.battleStatus===BATTLE_STATUS.SKIRMISH?'selected':''}>Skirmish</option>
                    <option value="${BATTLE_STATUS.MAJOR}" ${planet.battleStatus===BATTLE_STATUS.MAJOR?'selected':''}>Major Battle</option>
                    <option value="${BATTLE_STATUS.SIEGE}" ${planet.battleStatus===BATTLE_STATUS.SIEGE?'selected':''}>Siege</option>
                </select></div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Set', className: 'btn btn-primary', onClick: () => {
                planet.setBattleStatus(document.getElementById('battleStatus').value);
                this.app.renderer.updatePlanetMesh(planet);
                this.app.galaxy.save();
                this.showPlanetDetails(planetId);
                this.showToast('Battle status updated', 'success');
            }}
        ]);
    }

    editResources(planetId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        const all    = this.app.resourceManager.getAll();
        this.openGenericModal('Edit Resources', all.map(r => `
            <div class="form-group"><label class="form-label">${r.icon} ${r.name}</label>
                <input type="number" id="resource-${r.id}" class="form-input" value="${planet.resources[r.id]||0}" min="-99" max="99" /></div>
        `).join(''), [
            { text: 'Cancel', className: 'btn' },
            { text: 'Save', className: 'btn btn-primary', onClick: () => {
                console.log('=== SAVE BUTTON CLICKED ===');
                console.log('Before save - planet resources:', planet.resources);
                
                // Create a new resources object
                const newResources = { ...planet.resources };
                
                all.forEach(r => {
                    const v = parseInt(document.getElementById(`resource-${r.id}`).value) || 0;
                    console.log(`Processing resource ${r.id}: input=${v}`);
                    // Save all values including negative and zero
                    if (v !== 0) {
                        newResources[r.id] = v;
                        console.log(`  Set ${r.id} = ${v}`);
                    } else {
                        delete newResources[r.id];
                        console.log(`  Deleted ${r.id} (value was 0)`);
                    }
                });
                
                console.log('New resources object:', newResources);
                
                // Replace entire resources object
                planet.resources = newResources;
                
                console.log('After save - planet resources:', planet.resources);
                console.log('About to call galaxy.save()...');
                this.app.galaxy.save();
                console.log('galaxy.save() completed, about to call showPlanetDetails...');
                this.showPlanetDetails(planetId);
                this.showToast('Resources updated', 'success');
            }}
        ]);
    }

    showZoneActions(planetId, zoneId) {
        const planet  = this.app.galaxy.getPlanet(planetId);
        const zone    = planet.surfaceZones.find(z => z.id === zoneId);
        const factions = this.app.factionManager.getAll();
        this.openGenericModal(zone.name, `
            <div class="form-group"><label class="form-label">Controller</label>
                <select id="zoneController" class="form-select">
                    <option value="">None</option>
                    ${factions.map(f => `<option value="${f.id}" ${zone.controller===f.id?'selected':''}>${f.symbol} ${f.name}</option>`).join('')}
                </select></div>
            <div class="form-group"><label class="form-label">Zone Name</label>
                <input type="text" id="zoneName" class="form-input" value="${zone.name}" />
            </div>
            <div class="form-group"><label class="form-label">Zone Icon</label>
                <select id="zoneIcon" class="form-select">
                    <option value="🏛️">🏛️ Fortress</option>
                    <option value="🏭️">🏭️ Shield Generator</option>
                    <option value="⚡">⚡ Power Generator</option>
                    <option value="🏥️">🏥️ Factory</option>
                    <option value="🏚�">🏚� Space Port</option>
                    <option value="🛡️">🛡️ Defense Turret</option>
                    <option value="🛰️">🛰️ Mine</option>
                    <option value="🏥">🏥 Bunker</option>
                    <option value="📡">📡 Communications</option>
                    <option value="🔬">🔬 Research Lab</option>
                    <option value="⚗️">⚗️ Barracks</option>
                    <option value="🏺">🏺️ Command Center</option>
                    <option value="🌐">🌐 Web Generator</option>
                    <option value="">⭕ None</option>
                </select></div>
            <div class="form-group"><label class="form-label">Status</label>
                <select id="zoneBattleStatus" class="form-select">
                    <option value="normal" ${!zone.contested?'selected':''}>Normal</option>
                    <option value="contested" ${zone.contested?'selected':''}>Contested</option>
                </select></div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Save', className: 'btn btn-primary', onClick: () => {
                zone.name = document.getElementById('zoneName').value || zone.name;
                zone.controller = document.getElementById('zoneController').value || null;
                zone.contested = document.getElementById('zoneBattleStatus').value === 'contested';
                zone.icon = document.getElementById('zoneIcon').value || '';
                this.app.galaxy.save();
                this.app.renderer.updatePlanetMesh(planet);
                this.showPlanetDetails(planetId);
                this.showToast('Zone updated', 'success');
            }}
        ]);
    }

    showPlayerZoneActions(planetId, zoneId) {
        const planet  = this.app.galaxy.getPlanet(planetId);
        const zone    = planet.surfaceZones.find(z => z.id === zoneId);
        const playerFaction = this.app.factionManager.getById(this.activeFactionId);
        const isControlledByPlayer = zone.controller === this.activeFactionId;
        
        this.openGenericModal(zone.name, `
            <div class="form-group"><label class="form-label">Status</label>
                <select id="zoneBattleStatus" class="form-select">
                    <option value="normal" ${!zone.contested?'selected':''}>Normal</option>
                    <option value="contested" ${zone.contested?'selected':''}>Contested</option>
                </select></div>
            <div class="form-group">
                <button class="gm-btn" onclick="window.app.ui.playerSetZoneController('${planetId}', '${zoneId}')">
                    ${isControlledByPlayer ? 'Relinquish Control' : 'Take Control'}
                </button>
            </div>
        `, [
            { text: 'Cancel', className: 'btn' },
            { text: 'Save', className: 'btn btn-primary', onClick: () => {
                zone.contested = document.getElementById('zoneBattleStatus').value === 'contested';
                this.app.galaxy.save();
                this.showPlanetDetails(planetId);
                this.showToast('Zone status updated', 'success');
            }}
        ]);
    }

    playerSetZoneController(planetId, zoneId) {
        const planet = this.app.galaxy.getPlanet(planetId);
        const zone = planet.surfaceZones.find(z => z.id === zoneId);
        const playerFaction = this.app.factionManager.getById(this.activeFactionId);
        const isControlledByPlayer = zone.controller === this.activeFactionId;
        
        if (isControlledByPlayer) {
            // Relinquish control
            zone.controller = null;
            this.showToast(`Relinquished control of ${zone.name}`, 'info');
        } else {
            // Take control - but preserve contested status if it exists
            zone.controller = this.activeFactionId;
            const factionName = playerFaction ? playerFaction.name : 'Unknown Faction';
            const factionSymbol = playerFaction ? playerFaction.symbol : '?';
            this.showToast(`${factionSymbol} ${factionName} took control of ${zone.name}`, 'success');
        }
        
        this.app.galaxy.save();
        this.app.renderer.updatePlanetMesh(planet);
        this.showPlanetDetails(planetId);
        this.updateFactionStats();
    }

    // ── Info modals ──────────────────────────────────────────────────────

    showSettings() {
        const content = `
            <div class="settings-content">
                <div class="settings-info">
                    <p>Storage used: ${StorageService.getStorageSize()} KB</p>
                </div>
                <div class="settings-actions">
                    <button id="saveCampaignFromSettingsBtn" class="menu-item-btn"><span class="menu-item-icon">💾</span> Save Campaign</button>
                    <button id="exportCampaignFromSettingsBtn" class="menu-item-btn"><span class="menu-item-icon">📤</span> Export to File</button>
                </div>
            </div>
        `;
        
        this.openGenericModal('Settings', content, [{ text:'Close', className:'btn' }]);
        
        // Add event listeners for the new buttons
        setTimeout(() => {
            document.getElementById('saveCampaignFromSettingsBtn')?.addEventListener('click', () => {
                this.saveCampaign();
                this.showToast('Campaign saved', 'success');
            });
            
            document.getElementById('exportCampaignFromSettingsBtn')?.addEventListener('click', () => {
                this.exportCampaign();
            });
        }, 100);
    }

    showColorThemeDialog() {
        // Get current color values from CSS variables
        const currentColors = this.getCurrentColorValues();
        
        // Get current display settings
        const currentThickness = this.app.renderer?.connectionThickness || 3;
        const currentBrightness = this.app.renderer?.galaxyCenterBrightness || 100;
        const currentConnectionColor = localStorage.getItem('connectionLineColor') || 'var(--color-secondary-accent-bright)';
        
        const content = `
            <div class="color-theme-dialog">
                <div class="color-section">
                    <h4>Main Colors</h4>
                    <div class="color-grid">
                        <div class="color-item">
                            <label for="color-main-background">Main Background</label>
                            <input type="color" id="color-main-background" value="${currentColors['main-background']}" class="color-input">
                            <span class="color-value">${currentColors['main-background']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-secondary-background">Secondary Background</label>
                            <input type="color" id="color-secondary-background" value="${currentColors['secondary-background']}" class="color-input">
                            <span class="color-value">${currentColors['secondary-background']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-button-background">Button Background</label>
                            <input type="color" id="color-button-background" value="${currentColors['button-background']}" class="color-input">
                            <span class="color-value">${currentColors['button-background']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-main-text">Main Text Color</label>
                            <input type="color" id="color-main-text" value="${currentColors['main-text']}" class="color-input">
                            <span class="color-value">${currentColors['main-text']}</span>
                        </div>
                    </div>
                </div>
                
                <div class="color-section">
                    <h4>Accent Colors</h4>
                    <div class="color-grid">
                        <div class="color-item">
                            <label for="color-primary-accent">Primary Accent</label>
                            <input type="color" id="color-primary-accent" value="${currentColors['primary-accent']}" class="color-input">
                            <span class="color-value">${currentColors['primary-accent']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-secondary-accent">Secondary Accent</label>
                            <input type="color" id="color-secondary-accent" value="${currentColors['secondary-accent']}" class="color-input">
                            <span class="color-value">${currentColors['secondary-accent']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-highlight-accent">Highlight Accent</label>
                            <input type="color" id="color-highlight-accent" value="${currentColors['highlight-accent']}" class="color-input">
                            <span class="color-value">${currentColors['highlight-accent']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-shadow-accent">Shadows Accent</label>
                            <input type="color" id="color-shadow-accent" value="${currentColors['shadow-accent']}" class="color-input">
                            <span class="color-value">${currentColors['shadow-accent']}</span>
                        </div>
                    </div>
                </div>
                
                <div class="color-section">
                    <h4>Game Element Colors</h4>
                    <div class="color-grid">
                        <div class="color-item">
                            <label for="color-combat-damage">Combat/Damage</label>
                            <input type="color" id="color-combat-damage" value="${currentColors['combat-damage']}" class="color-input">
                            <span class="color-value">${currentColors['combat-damage']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-energy-power">Energy/Power</label>
                            <input type="color" id="color-energy-power" value="${currentColors['energy-power']}" class="color-input">
                            <span class="color-value">${currentColors['energy-power']}</span>
                        </div>
                        <div class="color-item">
                            <label for="color-warp-psychic">Warp/Psychic</label>
                            <input type="color" id="color-warp-psychic" value="${currentColors['warp-psychic']}" class="color-input">
                            <span class="color-value">${currentColors['warp-psychic']}</span>
                        </div>
                    </div>
                </div>
                
                <div class="color-section">
                    <h4>Display Settings</h4>
                    <div class="color-grid">
                        <div class="color-item">
                            <label for="connection-thickness">Connection Line Thickness</label>
                            <input type="range" id="connection-thickness" min="1" max="10" value="${currentThickness}" class="color-range">
                            <span class="color-value" id="connection-thickness-value">${currentThickness}</span>
                        </div>
                        <div class="color-item">
                            <label for="galaxy-center-brightness">Galaxy Center Brightness</label>
                            <input type="range" id="galaxy-center-brightness" min="0" max="1000" value="${currentBrightness}" class="color-range">
                            <span class="color-value" id="galaxy-center-brightness-value">${currentBrightness}</span>
                        </div>
                        <div class="color-item">
                            <label for="connection-line-color">Connection Line Color</label>
                            <input type="color" id="connection-line-color" value="${currentConnectionColor}" class="color-input">
                            <span class="color-value">${currentConnectionColor}</span>
                        </div>
                    </div>
                </div>
                
                <div class="theme-presets">
                    <h4>Theme Presets</h4>
                    <div class="preset-buttons">
                        <button class="preset-btn" data-preset="default">Default</button>
                        <button class="preset-btn" data-preset="dark">Darker</button>
                        <button class="preset-btn" data-preset="light">Lighter</button>
                        <button class="preset-btn" data-preset="silver">Silver</button>
                        <button class="preset-btn" data-preset="blue">Blue</button>
                        <button class="preset-btn" data-preset="cyan">Cyan</button>
                        <button class="preset-btn" data-preset="green">Green</button>
                        <button class="preset-btn" data-preset="red">Red</button>
                        <button class="preset-btn" data-preset="orange">Orange</button>
                        <button class="preset-btn" data-preset="holographic">Holo</button>
                        <button class="preset-btn" data-preset="night">Night</button>
                    </div>
                </div>
            </div>
        `;
        
        this.openGenericModal('Color Theme Customization', content, [
            { text: 'Apply', className: 'btn primary', action: () => this.applyColorTheme() },
            { text: 'Reset to Default', className: 'btn secondary', action: () => this.resetColorTheme() },
            { text: 'Cancel', className: 'btn', action: () => this.closeModal() }
        ]);
        
        // Add special class to prevent dimming for color theme dialog
        setTimeout(() => {
            const modal = this.genericModal;
            if (modal) {
                modal.classList.add('color-theme-modal');
            }
            this.setupColorThemeListeners();
        }, 100);
    }

    getCurrentColorValues() {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        
        // Helper function to get color value with fallback
        const getColor = (property, fallback = 'var(--color-main-background)') => {
            const value = style.getPropertyValue(property).trim();
            return value ? this.rgbToHex(value) : fallback;
        };
        
        return {
            'main-background': getColor('--color-main-background', '#0a0a0a'),
            'secondary-background': getColor('--color-secondary-background', '#1a1a1a'),
            'button-background': getColor('--color-button-background', '#2a2a2a'),
            'shadow-accent': getColor('--color-shadow-accent', '#1a1a1a'),
            'main-text': getColor('--color-main-text', '#c8c8c8'),
            'primary-accent': getColor('--color-primary-accent', '#c8a464'),
            'secondary-accent': getColor('--color-secondary-accent', '#a48450'),
            'highlight-accent': getColor('--color-highlight-accent', '#d4b474'),
            'combat-damage': getColor('--color-combat-damage', '#aa5555'),
            'energy-power': getColor('--color-energy-power', '#5555aa'),
            'warp-psychic': getColor('--color-warp-psychic', '#aa55aa')
        };
    }

    rgbToHex(color) {
        // If already hex, return as-is
        if (color && color.startsWith('#')) return color;
        
        // Handle empty or invalid color values
        if (!color || color.trim() === '') return '#000000';
        
        // Convert rgb to hex
        const rgb = color.match(/\d+/g);
        if (!rgb || rgb.length < 3) return '#000000';
        
        const hex = rgb.map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        });
        
        return '#' + hex.join('');
    }

    setupColorThemeListeners() {
        // Add real-time preview for color changes
        const colorInputs = document.querySelectorAll('.color-input');
        colorInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const colorVar = this.mapToCssVariable(e.target.id.replace('color-', ''));
                if (colorVar) {
                    document.documentElement.style.setProperty(colorVar, e.target.value);
                }
                
                // Update the displayed value
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
            });
        });
        
        // Add real-time preview for range inputs
        const rangeInputs = document.querySelectorAll('.color-range');
        rangeInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                // Update the displayed value
                const valueSpan = document.getElementById(e.target.id + '-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
                
                // Apply the setting in real-time
                if (this.app?.renderer) {
                    if (e.target.id === 'connection-thickness') {
                        this.app.renderer.setConnectionThickness(parseInt(e.target.value));
                    } else if (e.target.id === 'galaxy-center-brightness') {
                        this.app.renderer.setGalaxyCenterBrightness(parseInt(e.target.value));
                    }
                }
            });
        });
        
        // Add real-time preview for connection line color
        const connectionColorInput = document.getElementById('connection-line-color');
        if (connectionColorInput) {
            connectionColorInput.addEventListener('input', (e) => {
                // Update the displayed value
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
                
                // Apply the color in real-time
                if (this.app?.renderer) {
                    this.app.renderer.setConnectionColor(e.target.value);
                }
            });
        }
        
        // Add preset button listeners
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyColorPreset(e.target.dataset.preset);
            });
        });
    }

    applyColorPreset(preset) {
        const presets = {
            default: {
                'main-background': '#0a0a0a',
                'secondary-background': '#1a1a1a',
                'panel-background': '#2a2a2a',
                'button-background': '#3a3a3a',
                'main-text': '#dbd8d8',
                'primary-accent': '#d4af37',
                'secondary-accent': '#8b7520',
                'highlight-accent': '#ffd700',
                'combat-damage': '#8b0000',
                'energy-power': '#00ffff',
                'warp-psychic': '#9400d3',
                'shadow-accent': '#1a1a1a'
            },
            dark: {
                'main-background': '#000000',
                'secondary-background': '#0a0a0a',
                'panel-background': '#1a1a1a',
                'button-background': '#2a2a2a',
                'main-text': '#999999',
                'primary-accent': '#b8860b',
                'secondary-accent': '#6b5d00',
                'highlight-accent': '#daa520',
                'combat-damage': '#660000',
                'energy-power': '#00cccc',
                'warp-psychic': '#660066',
                'shadow-accent': '#0a0a0a'
            },
            light: {
                'main-background': '#1a1a1a',
                'secondary-background': '#2a2a2a',
                'panel-background': '#3a3a3a',
                'button-background': '#4a4a4a',
                'main-text': '#ffffff',
                'primary-accent': '#ffd700',
                'secondary-accent': '#ccaa00',
                'highlight-accent': '#ffed4e',
                'combat-damage': '#cc0000',
                'energy-power': '#00ffff',
                'warp-psychic': '#9932cc',
                'shadow-accent': '#2a2a2a'
            },
            blue: {
                'main-background': '#0a0a1a',
                'secondary-background': '#1a1a2a',
                'panel-background': '#2a2a3a',
                'button-background': '#3a3a4a',
                'main-text': '#e6f3ff',
                'primary-accent': '#bdceff',
                'secondary-accent': '#4d64a3',
                'highlight-accent': '#71afd6',
                'combat-damage': '#dc2626',
                'energy-power': '#06b6d4',
                'warp-psychic': '#7c3aed',
                'shadow-accent': '#1a1a2a'
            },
            green: {
                'main-background': '#0a1a0a',
                'secondary-background': '#1a2a1a',
                'panel-background': '#2a3a2a',
                'button-background': '#3a4a3a',
                'main-text': '#f0fdf4',
                'primary-accent': '#47a96b',
                'secondary-accent': '#52986e',
                'highlight-accent': '#4ade80',
                'combat-damage': '#dc2626',
                'energy-power': '#06b6d4',
                'warp-psychic': '#7c3aed',
                'shadow-accent': '#1a2a1a'
            },
            red: {
                'main-background': '#1a0a0a',
                'secondary-background': '#2a1a1a',
                'panel-background': '#3a2a2a',
                'button-background': '#4a3a3a',
                'main-text': '#fef2f2',
                'primary-accent': '#dc2626',
                'secondary-accent': '#ca2121',
                'highlight-accent': '#ef4444',
                'combat-damage': '#7f1d1d',
                'energy-power': '#06b6d4',
                'warp-psychic': '#7c3aed',
                'shadow-accent': '#2a1a1a'
            },
            silver: {
                'main-background': '#0a0a0a',
                'secondary-background': '#1a1a2a',
                'panel-background': '#2a2a3a',
                'button-background': '#3a3a4a',
                'main-text': '#e8e8e8',
                'primary-accent': '#d4d4d4',
                'secondary-accent': '#a8a8a8',
                'highlight-accent': '#f0f0f0',
                'combat-damage': '#ff6b6b',
                'energy-power': '#66d9ef',
                'warp-psychic': '#b794f4',
                'shadow-accent': '#2a2a3a'
            },
            holographic: {
                'main-background': '#0a0f1a',
                'secondary-background': '#0d1a2e',
                'panel-background': '#152338',
                'button-background': '#1e2d48',
                'main-text': '#e0f7fa',
                'primary-accent': '#00e5ff',
                'secondary-accent': '#00acc1',
                'highlight-accent': '#40e0ff',
                'combat-damage': '#ff1744',
                'energy-power': '#00bcd4',
                'warp-psychic': '#d500f9',
                'shadow-accent': '#0d1a2e'
            },
            cyan: {
                'main-background': '#001e26',
                'secondary-background': '#0b191e',
                'panel-background': '#005164',
                'button-background': '#006974',
                'main-text': '#b2dfdb',
                'primary-accent': '#00acc1',
                'secondary-accent': '#00838f',
                'highlight-accent': '#26c6da',
                'combat-damage': '#ef5350',
                'energy-power': '#00acc1',
                'warp-psychic': '#ab47bc',
                'shadow-accent': '#0b191e'
            },
            night: {
                'main-background': '#0a0a0f',
                'secondary-background': '#1a1a2e',
                'panel-background': '#2a2a3e',
                'button-background': '#3a3a4e',
                'main-text': '#b8c5d6',
                'primary-accent': '#4a5568',
                'secondary-accent': '#2d3748',
                'highlight-accent': '#718096',
                'combat-damage': '#e53e3e',
                'energy-power': '#4299e1',
                'warp-psychic': '#805ad5',
                'shadow-accent': '#1a1a2e'
            },
            orange: {
                'main-background': '#1a0e0a',
                'secondary-background': '#2d1a0e',
                'panel-background': '#40280d',
                'button-background': '#533612',
                'main-text': '#ffe0b2',
                'primary-accent': '#ff9800',
                'secondary-accent': '#f57c00',
                'highlight-accent': '#ffb74d',
                'combat-damage': '#d32f2f',
                'energy-power': '#00acc1',
                'warp-psychic': '#ff6f00',
                'shadow-accent': '#2d1a0e'
            }
        };
        
        const colors = presets[preset];
        if (!colors) return;
        
        // Apply preset colors to CSS variables
        Object.entries(colors).forEach(([key, value]) => {
            const cssVar = this.mapToCssVariable(key);
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, value);
                
                // Update input field if it exists
                const input = document.getElementById(`color-${key}`);
                if (input) {
                    input.value = value;
                    const valueSpan = input.nextElementSibling;
                    if (valueSpan) {
                        valueSpan.textContent = value;
                    }
                }
            }
        });
    }
    
    mapToCssVariable(key) {
        const mapping = {
            'main-background': '--color-main-background',
            'secondary-background': '--color-secondary-background',
            'button-background': '--color-button-background',
            'shadow-accent': '--color-shadow-accent',
            'main-text': '--color-main-text',
            'primary-accent': '--color-primary-accent',
            'secondary-accent': '--color-secondary-accent',
            'highlight-accent': '--color-highlight-accent',
            'combat-damage': '--color-combat-damage',
            'energy-power': '--color-energy-power',
            'warp-psychic': '--color-warp-psychic'
        };
        return mapping[key] || null;
    }

    applyColorTheme() {
        // Get colors from the input fields (user's selections)
        const colorInputs = document.querySelectorAll('.color-input');
        const colors = {};
        
        colorInputs.forEach(input => {
            const colorKey = input.id.replace('color-', '');
            colors[colorKey] = input.value;
        });
        
        // Get display settings
        const thickness = document.getElementById('connection-thickness')?.value || 3;
        const brightness = document.getElementById('galaxy-center-brightness')?.value || 100;
        const connectionColor = document.getElementById('connection-line-color')?.value || '#c8a464';
        
        // Save the color theme to localStorage
        localStorage.setItem('customColorTheme', JSON.stringify(colors));
        
        // Save display settings to localStorage and apply them
        localStorage.setItem('connectionThickness', thickness);
        localStorage.setItem('galaxyCenterBrightness', brightness);
        localStorage.setItem('connectionLineColor', connectionColor);
        
        // Apply the settings to the renderer
        if (this.app?.renderer) {
            this.app.renderer.setConnectionThickness(parseInt(thickness));
            this.app.renderer.setGalaxyCenterBrightness(parseInt(brightness));
            this.app.renderer.setConnectionColor(connectionColor);
        }
        
        this.showToast('Color theme and display settings applied and saved', 'success');
        this.closeModal();
    }

    resetColorTheme() {
        // Reset to default colors
        this.applyColorPreset('default');
        
        // Reset display settings to defaults
        localStorage.setItem('connectionThickness', '3');
        localStorage.setItem('galaxyCenterBrightness', '100');
        localStorage.setItem('connectionLineColor', '#c8a464');
        
        // Apply default display settings
        if (this.app?.renderer) {
            this.app.renderer.setConnectionThickness(3);
            this.app.renderer.setGalaxyCenterBrightness(100);
            this.app.renderer.setConnectionColor('#c8a464');
        }
        
        // Remove saved theme
        localStorage.removeItem('customColorTheme');
        
        this.showToast('Color theme and display settings reset to default', 'info');
    }

    loadSavedColorTheme() {
        const savedTheme = localStorage.getItem('customColorTheme');
        if (savedTheme) {
            try {
                const colors = JSON.parse(savedTheme);
                Object.entries(colors).forEach(([key, value]) => {
                    // Apply to CSS variable using the mapping
                    const cssVar = this.mapToCssVariable(key);
                    if (cssVar) {
                        document.documentElement.style.setProperty(cssVar, value);
                    }
                });
            } catch (e) {
                console.warn('Failed to load saved color theme:', e);
            }
        }
    }

    loadSavedAutoRotation() {
        const savedState = localStorage.getItem('autoRotationState');
        if (savedState) {
            try {
                const shouldAutoRotate = savedState === 'true';
                // Only apply if renderer is available
                if (this.app?.renderer && this.autoRotateBtn) {
                    // Sync the renderer state
                    if (shouldAutoRotate !== this.app.renderer.autoRotate) {
                        this.app.renderer.toggleAutoRotation();
                    }
                    // Update the button state
                    this.autoRotateBtn.classList.toggle('active', shouldAutoRotate);
                    this.autoRotateBtn.querySelector('.mode-text').textContent = shouldAutoRotate ? 'Rotation: AUTO' : 'Rotation: OFF';
                }
            } catch (e) {
                console.warn('Failed to load saved auto rotation state:', e);
            }
        }
    }

    loadSavedDisplaySettings() {
        // Load connection thickness
        const savedThickness = localStorage.getItem('connectionThickness');
        if (savedThickness && this.app?.renderer) {
            this.app.renderer.setConnectionThickness(parseInt(savedThickness));
            // Update GM slider if it exists
            const thicknessSlider = document.getElementById('connectionThicknessSlider');
            if (thicknessSlider) {
                thicknessSlider.value = savedThickness;
            }
        }
        
        // Load galaxy center brightness
        const savedBrightness = localStorage.getItem('galaxyCenterBrightness');
        if (savedBrightness && this.app?.renderer) {
            this.app.renderer.setGalaxyCenterBrightness(parseInt(savedBrightness));
            // Update GM slider if it exists
            const brightnessSlider = document.getElementById('galaxyCenterBrightnessSlider');
            if (brightnessSlider) {
                brightnessSlider.value = savedBrightness;
            }
        }
        
        // Connection line color is already loaded by loadSavedConnectionColor()
        this.loadSavedConnectionColor();
    }

    loadSavedCameraState() {
        const savedState = localStorage.getItem('cameraState');
        if (savedState && this.app?.renderer) {
            try {
                const cameraState = JSON.parse(savedState);
                
                // Restore camera rotation
                if (cameraState.rotation) {
                    this.app.renderer.cameraRotation.x = cameraState.rotation.x || 0;
                    this.app.renderer.cameraRotation.y = cameraState.rotation.y || 0;
                }
                
                // Restore camera distance
                if (typeof cameraState.distance === 'number') {
                    this.app.renderer.cameraDistance = cameraState.distance;
                }
                
                // Restore camera position
                if (cameraState.position) {
                    this.app.renderer.cameraPosition.x = cameraState.position.x || 0;
                    this.app.renderer.cameraPosition.y = cameraState.position.y || 0;
                    this.app.renderer.cameraPosition.z = cameraState.position.z || 0;
                }
                
                // Restore selected planet (if it still exists)
                if (cameraState.selectedPlanet) {
                    const planet = this.app.galaxy.getPlanet(cameraState.selectedPlanet);
                    if (planet) {
                        this.app.renderer.selectedPlanet = cameraState.selectedPlanet;
                    }
                }
                
                // Update camera position after restoring all values
                this.app.renderer.updateCameraPosition();
                
            } catch (e) {
                console.warn('Failed to load saved camera state:', e);
            }
        }
    }

    saveCameraState() {
        if (!this.app?.renderer) return;
        
        const cameraState = {
            rotation: {
                x: this.app.renderer.cameraRotation.x,
                y: this.app.renderer.cameraRotation.y
            },
            distance: this.app.renderer.cameraDistance,
            position: {
                x: this.app.renderer.cameraPosition.x,
                y: this.app.renderer.cameraPosition.y,
                z: this.app.renderer.cameraPosition.z
            },
            selectedPlanet: this.app.renderer.selectedPlanet || null
        };
        
        localStorage.setItem('cameraState', JSON.stringify(cameraState));
    }

    saveConnectionColor(color) {
        localStorage.setItem('connectionLineColor', color);
    }

    loadSavedConnectionColor() {
        const savedColor = localStorage.getItem('connectionLineColor');
        if (savedColor && this.app?.renderer) {
            try {
                // Apply the saved color to the renderer
                this.app.renderer.setConnectionColor(savedColor);
                
                // Update the color picker to show the saved color
                const colorSlider = document.getElementById('connectionColorSlider');
                if (colorSlider) {
                    colorSlider.value = savedColor;
                }
            } catch (e) {
                console.warn('Failed to load saved connection line color:', e);
            }
        }
    }

    // ── Toast notifications ──────────────────────────────────────────────

    showToast(message, type = 'info') {
        const icons = { success:'✓', error:'✗', warning:'⚠', info:'ℹ' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div class="toast-icon">${icons[type]||icons.info}</div><div class="toast-message">${message}</div>`;
        this.toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'slideInRight 0.3s ease-out reverse'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    // ── Panel management ─────────────────────────────────────────────────

    loadPanelStates() {
        const saved = localStorage.getItem('crusadeMap_panelStates');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                Object.keys(s).forEach(k => { 
                    if (this.panelStates[k]) {
                        this.panelStates[k] = { ...this.panelStates[k], ...s[k], size: s[k].size || this.panelStates[k].size };
                        // Always force GM panel to be closed on startup
                        if (k === 'gmPanel') {
                            this.panelStates[k].visible = false;
                        }
                    }
                });
            } catch(e) { console.warn('panel state load error', e); }
        }
        this.applyPanelStates();
    }

    savePanelStates() { localStorage.setItem('crusadeMap_panelStates', JSON.stringify(this.panelStates)); }

    applyPanelStates() {
        const mins = {
            sidePanel:    { w:380, h:550, maxW:1200 },
            gmPanel:      { w:280, h:450, maxW:600 },
            surfacePanel: { w:350, h:400, maxW:700 },
            statsPanel:   { w:250, h:180, maxW:600 },
            shipPanel:    { w:300, h:300, maxW:600 },
            editPlanetPanel: { w:400, h:500, maxW:700 }
        };
        Object.entries(this.panelStates).forEach(([id, state]) => {
            const panel = this.getPanelElement(id);
            if (!panel) {
                console.warn(`Panel element not found: ${id}`);
                return;
            }
            panel.style.position = 'fixed';
            panel.style.left     = state.position.x + 'px';
            panel.style.top      = state.position.y + 'px';
            panel.style.zIndex   = '100';
            if (state.size) { panel.style.width = state.size.width + 'px'; panel.style.height = state.size.height + 'px'; }
            panel.style.display  = state.visible ? 'block' : 'none';
            panel.classList.toggle('active', state.visible);
            const m = mins[id];
            if (m) { panel.style.minWidth = m.w+'px'; panel.style.minHeight = m.h+'px'; panel.style.maxWidth = m.maxW+'px'; panel.style.maxHeight = '90vh'; }
        });
    }

    getPanelElement(id) {
        const map = { sidePanel:this.sidePanel, gmPanel:this.gmPanel, statsPanel:this.statsPanel, surfacePanel:this.surfacePanel, shipPanel:this.shipPanel, editPlanetPanel:this.editPlanetPanel };
        return map[id] || null;
    }

    initializeDraggablePanels() { Object.keys(this.panelStates).forEach(id => this.makePanelDraggable(id)); }

    makePanelDraggable(panelId) {
        const panel = this.getPanelElement(panelId);
        if (!panel) {
            console.warn(`Cannot make panel draggable - element not found: ${panelId}`);
            return;
        }
        const header = panel.querySelector('.panel-header, .gm-panel-header, .surface-panel-header, .ship-panel-header, .edit-planet-panel-header, h3');
        if (!header) {
            console.warn(`Cannot make panel draggable - header not found: ${panelId}`);
            return;
        }
        header.style.cursor = 'move';
        let dragging = false, sx, sy, ix, iy;
        header.addEventListener('mousedown', e => {
            dragging = true; sx = e.clientX; sy = e.clientY;
            ix = this.panelStates[panelId].position.x; iy = this.panelStates[panelId].position.y;
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            this.panelStates[panelId].position.x = ix + (e.clientX - sx);
            this.panelStates[panelId].position.y = iy + (e.clientY - sy);
            panel.style.left = this.panelStates[panelId].position.x + 'px';
            panel.style.top  = this.panelStates[panelId].position.y + 'px';
        });
        document.addEventListener('mouseup', () => { 
            if (dragging) { 
                dragging = false; 
                this.savePanelStates(); 
            } 
        });
    }

    initializeResizablePanels() { ['sidePanel','gmPanel','surfacePanel','statsPanel','shipPanel','editPlanetPanel'].forEach(id => this.makePanelResizable(id)); }

    makePanelResizable(panelId) {
        const panel = this.getPanelElement(panelId);
        if (!panel) return;
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.style.cssText = 'position:absolute;bottom:0;right:0;width:20px;height:20px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--color-gold-dim) 50%);border-radius:0 0 4px 0;z-index:101;opacity:.7;transition:opacity .3s;';
        handle.onmouseenter = () => handle.style.opacity = '1';
        handle.onmouseleave = () => handle.style.opacity = '.7';
        panel.appendChild(handle);

        const limits = { sidePanel:{minW:380,maxW:800,minH:550}, gmPanel:{minW:280,maxW:600,minH:450}, surfacePanel:{minW:350,maxW:700,minH:400}, statsPanel:{minW:250,maxW:600,minH:180}, shipPanel:{minW:300,maxW:600,minH:180}, editPlanetPanel:{minW:400,maxW:700,minH:500} };
        const lim = limits[panelId] || { minW:250, maxW:600, minH:180 };
        let resizing = false, sx, sy, sw, sh;
        handle.addEventListener('mousedown', e => {
            resizing = true; sx = e.clientX; sy = e.clientY;
            sw = parseInt(getComputedStyle(panel).width); sh = parseInt(getComputedStyle(panel).height);
            e.preventDefault(); e.stopPropagation();
        });
        document.addEventListener('mousemove', e => {
            if (!resizing) return;
            if (!this.panelStates[panelId].size) this.panelStates[panelId].size = { width:400, height:600 };
            this.panelStates[panelId].size.width  = Math.max(lim.minW, Math.min(lim.maxW, sw + (e.clientX - sx)));
            this.panelStates[panelId].size.height = Math.max(lim.minH, Math.min(window.innerHeight*0.9, sh + (e.clientY - sy)));
            panel.style.width  = this.panelStates[panelId].size.width  + 'px';
            panel.style.height = this.panelStates[panelId].size.height + 'px';
        });
        document.addEventListener('mouseup', () => { if (resizing) { resizing = false; this.savePanelStates(); } });
    }

    // ── Modal dragging ─────────────────────────────────────────────────────

    initializeModalDragging() {
        const modalContent = this.genericModal.querySelector('.modal-content');
        if (!modalContent) return;
        
        const modalHeader = modalContent.querySelector('.modal-header');
        if (!modalHeader) return;
        
        // Store original modal styles
        const originalStyles = {
            position: modalContent.style.position,
            left: modalContent.style.left,
            top: modalContent.style.top,
            transform: modalContent.style.transform,
            margin: modalContent.style.margin
        };
        
        // Modal dragging state
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        // Make header draggable
        modalHeader.style.cursor = 'move';
        
        modalHeader.addEventListener('mousedown', (e) => {
            // Only allow dragging on the header, not on buttons
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get current position
            const rect = modalContent.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            // Change positioning to absolute for dragging
            modalContent.style.position = 'fixed';
            modalContent.style.left = initialLeft + 'px';
            modalContent.style.top = initialTop + 'px';
            modalContent.style.transform = 'none';
            modalContent.style.margin = '0';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = initialLeft + deltaX;
            const newTop = initialTop + deltaY;
            
            // Keep modal within viewport bounds
            const maxLeft = window.innerWidth - modalContent.offsetWidth;
            const maxTop = window.innerHeight - modalContent.offsetHeight;
            
            modalContent.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            modalContent.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
            }
        });
        
        // Reset position when modal is closed
        const originalOpenGenericModal = this.openGenericModal.bind(this);
        this.openGenericModal = function(title, content, buttons = [], options = {}) {
            // Reset to original styles when opening
            Object.assign(modalContent.style, originalStyles);
            return originalOpenGenericModal(title, content, buttons, options);
        };
        
        const originalCloseModal = this.closeModal.bind(this);
        this.closeModal = function() {
            // Reset to original styles when closing
            Object.assign(modalContent.style, originalStyles);
            return originalCloseModal();
        };
    }

    initializePanelToggles() {
        // Set up event listener for the faction stats button in header
        const factionStatsBtn = document.getElementById('factionStatsBtn');
        if (factionStatsBtn) {
            factionStatsBtn.addEventListener('click', () => this.togglePanel('statsPanel'));
            this.factionStatsBtn = factionStatsBtn;
        }
    }

    togglePanel(id) { 
        if (!this.getPanelElement(id)) {
            console.warn(`Panel element not found: ${id}`);
            return;
        }
        this.panelStates[id].visible = !this.panelStates[id].visible; 
        this.applyPanelStates(); 
        this.savePanelStates(); 
    }
    
    showPanel(id) { 
        if (!this.getPanelElement(id)) {
            console.warn(`Panel element not found: ${id}`);
            return;
        }
        this.panelStates[id].visible = true;  
        this.applyPanelStates(); 
        this.savePanelStates(); 
    }
    
    hidePanel(id) { 
        if (!this.getPanelElement(id)) {
            console.warn(`Panel element not found: ${id}`);
            return;
        }
        this.panelStates[id].visible = false; 
        this.applyPanelStates(); 
        this.savePanelStates(); 
    }

    toggleCollapsible(id) {
        const content = document.getElementById(id);
        const icon = document.getElementById(id + '-icon');
        
        if (!content || !icon) {
            console.warn(`Collapsible elements not found for: ${id}`);
            return;
        }
        
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            content.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    }

    // ── UI Text Customization ────────────────────────────────────────────────

    /**
     * Show comprehensive UI text customization dialog
     */
    showCustomizeUITextDialog() {
        const customText = this.app.galaxy.customText;
        
        let html = `
            <div class="custom-ui-dialog">
                <div class="custom-ui-header">
                    <h3>📝 Customize Interface Text</h3>
                    <p>Customize all headers, labels, and text throughout the interface</p>
                </div>
                
                <div class="custom-ui-tabs">
                    <button class="tab-btn active" data-tab="main">Main Interface</button>
                    <button class="tab-btn" data-tab="panels">Panel Headers</button>
                    <button class="tab-btn" data-tab="sections">Section Titles</button>
                    <button class="tab-btn" data-tab="gm">GM Sections</button>
                    <button class="tab-btn" data-tab="ui">UI Labels</button>
                    <button class="tab-btn" data-tab="toasts">Toast Notifications</button>
                </div>
                
                <div class="custom-ui-content">
                    ${this.generateMainInterfaceTab()}
                    ${this.generatePanelHeadersTab()}
                    ${this.generateSectionTitlesTab()}
                    ${this.generateGMSectionsTab()}
                    ${this.generateUILabelsTab()}
                    ${this.generateToastNotificationsTab()}
                </div>
                
                <div class="custom-ui-actions">
                    <button class="gm-btn" onclick="window.app.ui.saveAllUIText()">💾 Save All Changes</button>
                    <button class="gm-btn" onclick="window.app.ui.resetUITextToDefaults()">🔄 Reset to Defaults</button>
                    <button class="gm-btn" onclick="window.app.ui.closeModal()">Cancel</button>
                </div>
            </div>
        `;
        
        this.openGenericModal('Customize Interface Text', html);
        
        // Setup tab switching
        setTimeout(() => this.setupUITabs(), 100);
    }

    generateMainInterfaceTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content active" id="tab-main">
                <div class="text-group">
                    <h4>Main Interface</h4>
                    <div class="text-item">
                        <label>App Title</label>
                        <input type="text" id="edit-appTitle" value="${customText.appTitle || 'The INDEX'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Turn Label</label>
                        <input type="text" id="edit-turnLabel" value="${customText.turnLabel || 'TURN'}" maxlength="20">
                    </div>
                    <div class="text-item">
                        <label>Galaxy Center</label>
                        <input type="text" id="edit-galaxyCenter" value="${customText.galaxyCenter || 'GALAXY CENTER'}" maxlength="30">
                    </div>
                </div>
            </div>
        `;
    }

    generatePanelHeadersTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content" id="tab-panels">
                <div class="text-group">
                    <h4>Panel Headers</h4>
                    <div class="text-item">
                        <label>Planet Details</label>
                        <input type="text" id="edit-planetDetails" value="${customText.planetDetails || 'PLANET DETAILS'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Faction Standings</label>
                        <input type="text" id="edit-factionStandings" value="${customText.factionStandings || 'FACTION STANDINGS'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Surface Map</label>
                        <input type="text" id="edit-surfaceMap" value="${customText.surfaceMap || 'SURFACE MAP'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Fleet Movement</label>
                        <input type="text" id="edit-fleetMovement" value="${customText.fleetMovement || 'FLEET MOVEMENT'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Edit Planet</label>
                        <input type="text" id="edit-editPlanet" value="${customText.editPlanet || 'EDIT PLANET'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>GM Controls</label>
                        <input type="text" id="edit-gmControls" value="${customText.gmControls || 'GAME MASTER CONTROLS'}" maxlength="30">
                    </div>
                </div>
            </div>
        `;
    }

    generateGMSectionsTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content" id="tab-gm">
                <div class="text-group">
                    <h4>GM Panel Sections</h4>
                    <div class="text-item">
                        <label>Campaign Management</label>
                        <input type="text" id="edit-gmSections.campaignManagement" value="${customText.gmSections?.campaignManagement || 'Campaign Management'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Planets</label>
                        <input type="text" id="edit-gmSections.planets" value="${customText.gmSections?.planets || 'Planets'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Connections</label>
                        <input type="text" id="edit-gmSections.connections" value="${customText.gmSections?.connections || 'Connections'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Fleets</label>
                        <input type="text" id="edit-gmSections.fleets" value="${customText.gmSections?.fleets || 'Fleets'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Events</label>
                        <input type="text" id="edit-gmSections.events" value="${customText.gmSections?.events || 'Events'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Resources & Values</label>
                        <input type="text" id="edit-gmSections.resourcesValues" value="${customText.gmSections?.resourcesValues || 'Resources & Values'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Galaxy</label>
                        <input type="text" id="edit-gmSections.galaxy" value="${customText.gmSections?.galaxy || 'Galaxy'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Interface & Display</label>
                        <input type="text" id="edit-gmSections.interfaceDisplay" value="${customText.gmSections?.interfaceDisplay || 'Interface & Display'}" maxlength="30">
                    </div>
                </div>
            </div>
        `;
    }

    generateSectionTitlesTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content" id="tab-sections">
                <div class="text-group">
                    <h4>Section Titles</h4>
                    <div class="text-item">
                        <label>Information</label>
                        <input type="text" id="edit-uiLabels.information" value="${customText.uiLabels?.information || 'INFORMATION'}" maxlength="25">
                    </div>
                    <div class="text-item">
                        <label>Resources</label>
                        <input type="text" id="edit-uiLabels.resources" value="${customText.uiLabels?.resources || 'RESOURCES'}" maxlength="25">
                    </div>
                    <div class="text-item">
                        <label>Active Events</label>
                        <input type="text" id="edit-uiLabels.activeEvents" value="${customText.uiLabels?.activeEvents || 'ACTIVE EVENTS'}" maxlength="25">
                    </div>
                    <div class="text-item">
                        <label>Fleets in Orbit</label>
                        <input type="text" id="edit-uiLabels.fleetsInOrbit" value="${customText.uiLabels?.fleetsInOrbit || 'FLEETS IN ORBIT'}" maxlength="25">
                    </div>
                    <div class="text-item">
                        <label>GM Actions</label>
                        <input type="text" id="edit-uiLabels.gmActions" value="${customText.uiLabels?.gmActions || 'GM ACTIONS'}" maxlength="25">
                    </div>
                    <div class="text-item">
                        <label>Surface</label>
                        <input type="text" id="edit-uiLabels.surface" value="${customText.uiLabels?.surface || 'SURFACE'}" maxlength="25">
                    </div>
                </div>
            </div>
        `;
    }

    generateUILabelsTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content" id="tab-ui">
                <div class="text-group">
                    <h4>UI Labels & Buttons</h4>
                    <div class="text-item">
                        <label>Loading Title</label>
                        <input type="text" id="edit-uiLabels.loadingTitle" value="${customText.uiLabels?.loadingTitle || 'The INDEX'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Loading Text</label>
                        <input type="text" id="edit-uiLabels.loadingText" value="${customText.uiLabels?.loadingText || 'Initializing Galaxy…'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Select Planet Hint</label>
                        <input type="text" id="edit-uiLabels.selectPlanet" value="${customText.uiLabels?.selectPlanet || 'Select Planet or Center'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>New Campaign</label>
                        <input type="text" id="edit-uiLabels.newCampaign" value="${customText.uiLabels?.newCampaign || 'New Campaign'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Import Campaign</label>
                        <input type="text" id="edit-uiLabels.importCampaign" value="${customText.uiLabels?.importCampaign || 'Import Campaign'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Manage Factions</label>
                        <input type="text" id="edit-uiLabels.manageFactions" value="${customText.uiLabels?.manageFactions || 'Manage Factions'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>GM Mode</label>
                        <input type="text" id="edit-uiLabels.gmMode" value="${customText.uiLabels?.gmMode || 'GM MODE'}" maxlength="20">
                    </div>
                    <div class="text-item">
                        <label>Player Mode</label>
                        <input type="text" id="edit-uiLabels.playerMode" value="${customText.uiLabels?.playerMode || 'PLAYER'}" maxlength="20">
                    </div>
                    <div class="text-item">
                        <label>Faction Label</label>
                        <input type="text" id="edit-uiLabels.factionLabel" value="${customText.uiLabels?.factionLabel || 'FACTION:'}" maxlength="20">
                    </div>
                    <div class="text-item">
                        <label>Galactic Order</label>
                        <input type="text" id="edit-uiLabels.galacticOrder" value="${customText.uiLabels?.galacticOrder || 'Galactic Order'}" maxlength="30">
                    </div>
                    <div class="text-item">
                        <label>Compass</label>
                        <input type="text" id="edit-uiLabels.compass" value="${customText.uiLabels?.compass || 'Compass'}" maxlength="20">
                    </div>
                    <div class="text-item">
                        <label>Reinforcements</label>
                        <input type="text" id="edit-uiLabels.reinforcements" value="${customText.uiLabels?.reinforcements || 'Reinforcements'}" maxlength="30">
                    </div>
                </div>
            </div>
        `;
    }

    generateToastNotificationsTab() {
        const customText = this.app.galaxy?.customText || {};
        
        return `
            <div class="tab-content" id="tab-toasts">
                <div class="text-group">
                    <h4>Toast Notifications</h4>
                    <div class="text-item">
                        <label>GM Mode Activated</label>
                        <input type="text" id="edit-toasts.gmModeActivated" value="${customText.toasts?.gmModeActivated || 'GM Mode activated'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Player Mode Activated</label>
                        <input type="text" id="edit-toasts.playerModeActivated" value="${customText.toasts?.playerModeActivated || 'Player Mode activated'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>New Galactic Order</label>
                        <input type="text" id="edit-toasts.newGalacticOrder" value="${customText.toasts?.newGalacticOrder || 'New Galactic Order generated!'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Auto-rotation Enabled</label>
                        <input type="text" id="edit-toasts.autoRotationEnabled" value="${customText.toasts?.autoRotationEnabled || 'Auto-rotation enabled'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Auto-rotation Disabled</label>
                        <input type="text" id="edit-toasts.autoRotationDisabled" value="${customText.toasts?.autoRotationDisabled || 'Auto-rotation disabled'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Compass Enabled</label>
                        <input type="text" id="edit-toasts.compassEnabled" value="${customText.toasts?.compassEnabled || 'Compass enabled'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Compass Disabled</label>
                        <input type="text" id="edit-toasts.compassDisabled" value="${customText.toasts?.compassDisabled || 'Compass disabled'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>No Faction Selected</label>
                        <input type="text" id="edit-toasts.noFactionSelected" value="${customText.toasts?.noFactionSelected || 'No faction selected'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Invalid Faction Selected</label>
                        <input type="text" id="edit-toasts.invalidFactionSelected" value="${customText.toasts?.invalidFactionSelected || 'Invalid faction selected'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Planet Updated</label>
                        <input type="text" id="edit-toasts.planetUpdated" value="${customText.toasts?.planetUpdated || 'Planet updated'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>GM Mode Required</label>
                        <input type="text" id="edit-toasts.gmModeRequired" value="${customText.toasts?.gmModeRequired || 'GM mode required'}" maxlength="50">
                    </div>
                    <div class="text-item">
                        <label>Crusade Info Updated</label>
                        <input type="text" id="edit-toasts.crusadeInfoUpdated" value="${customText.toasts?.crusadeInfoUpdated || 'Crusade information updated'}" maxlength="50">
                    </div>
                </div>
            </div>
        `;
    }

    setupUITabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // Update button states
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update content visibility
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-${tabId}`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    saveAllUIText() {
        // Ensure customText exists
        if (!this.app.galaxy.customText) {
            this.app.galaxy.customText = {};
        }
        
        const customText = this.app.galaxy.customText;
        
        // Main Interface
        customText.appTitle = document.getElementById('edit-appTitle').value;
        customText.turnLabel = document.getElementById('edit-turnLabel').value;
        customText.galaxyCenter = document.getElementById('edit-galaxyCenter').value;
        
        // Panel Headers
        customText.planetDetails = document.getElementById('edit-planetDetails').value;
        customText.factionStandings = document.getElementById('edit-factionStandings').value;
        customText.surfaceMap = document.getElementById('edit-surfaceMap').value;
        customText.fleetMovement = document.getElementById('edit-fleetMovement').value;
        customText.editPlanet = document.getElementById('edit-editPlanet').value;
        customText.gmControls = document.getElementById('edit-gmControls').value;
        
        // Ensure uiLabels exists
        if (!customText.uiLabels) {
            customText.uiLabels = {};
        }
        
        // Section Titles
        customText.uiLabels.information = document.getElementById('edit-uiLabels.information').value;
        customText.uiLabels.resources = document.getElementById('edit-uiLabels.resources').value;
        customText.uiLabels.activeEvents = document.getElementById('edit-uiLabels.activeEvents').value;
        customText.uiLabels.fleetsInOrbit = document.getElementById('edit-uiLabels.fleetsInOrbit').value;
        customText.uiLabels.gmActions = document.getElementById('edit-uiLabels.gmActions').value;
        customText.uiLabels.surface = document.getElementById('edit-uiLabels.surface').value;
        
        // Ensure gmSections exists
        if (!customText.gmSections) {
            customText.gmSections = {};
        }
        
        // GM Sections
        customText.gmSections.campaignManagement = document.getElementById('edit-gmSections.campaignManagement').value;
        customText.gmSections.planets = document.getElementById('edit-gmSections.planets').value;
        customText.gmSections.connections = document.getElementById('edit-gmSections.connections').value;
        customText.gmSections.fleets = document.getElementById('edit-gmSections.fleets').value;
        customText.gmSections.events = document.getElementById('edit-gmSections.events').value;
        customText.gmSections.resourcesValues = document.getElementById('edit-gmSections.resourcesValues').value;
        customText.gmSections.galaxy = document.getElementById('edit-gmSections.galaxy').value;
        customText.gmSections.interfaceDisplay = document.getElementById('edit-gmSections.interfaceDisplay').value;
        
        // UI Labels
        customText.uiLabels.loadingTitle = document.getElementById('edit-uiLabels.loadingTitle').value;
        customText.uiLabels.loadingText = document.getElementById('edit-uiLabels.loadingText').value;
        customText.uiLabels.selectPlanet = document.getElementById('edit-uiLabels.selectPlanet').value;
        customText.uiLabels.newCampaign = document.getElementById('edit-uiLabels.newCampaign').value;
        customText.uiLabels.importCampaign = document.getElementById('edit-uiLabels.importCampaign').value;
        customText.uiLabels.manageFactions = document.getElementById('edit-uiLabels.manageFactions').value;
        customText.uiLabels.gmMode = document.getElementById('edit-uiLabels.gmMode').value;
        customText.uiLabels.playerMode = document.getElementById('edit-uiLabels.playerMode').value;
        customText.uiLabels.factionLabel = document.getElementById('edit-uiLabels.factionLabel').value;
        customText.uiLabels.galacticOrder = document.getElementById('edit-uiLabels.galacticOrder').value;
        customText.uiLabels.compass = document.getElementById('edit-uiLabels.compass').value;
        customText.uiLabels.reinforcements = document.getElementById('edit-uiLabels.reinforcements').value;
        
        // Ensure toasts exists
        if (!customText.toasts) {
            customText.toasts = {};
        }
        
        // Toast Notifications
        customText.toasts.gmModeActivated = document.getElementById('edit-toasts.gmModeActivated').value;
        customText.toasts.playerModeActivated = document.getElementById('edit-toasts.playerModeActivated').value;
        customText.toasts.newGalacticOrder = document.getElementById('edit-toasts.newGalacticOrder').value;
        customText.toasts.autoRotationEnabled = document.getElementById('edit-toasts.autoRotationEnabled').value;
        customText.toasts.autoRotationDisabled = document.getElementById('edit-toasts.autoRotationDisabled').value;
        customText.toasts.compassEnabled = document.getElementById('edit-toasts.compassEnabled').value;
        customText.toasts.compassDisabled = document.getElementById('edit-toasts.compassDisabled').value;
        customText.toasts.noFactionSelected = document.getElementById('edit-toasts.noFactionSelected').value;
        customText.toasts.invalidFactionSelected = document.getElementById('edit-toasts.invalidFactionSelected').value;
        customText.toasts.planetUpdated = document.getElementById('edit-toasts.planetUpdated').value;
        customText.toasts.gmModeRequired = document.getElementById('edit-toasts.gmModeRequired').value;
        customText.toasts.crusadeInfoUpdated = document.getElementById('edit-toasts.crusadeInfoUpdated').value;
        
        // Save and apply
        this.applyCustomText();
        this.updatePanelTitles();
        this.updateControlHints();
        this.updateGMPanelSections();
        this.updateLoadingText();
        this.updateMenuText();
        this.updateHeaderText();
        
        // Save the galaxy to persist custom text changes
        this.app.galaxy.save();
        
        this.closeModal();
        this.showToast('All interface text updated successfully!', 'success');
    }

    resetUITextToDefaults() {
        if (!confirm('Are you sure you want to reset all interface text to defaults? This cannot be undone.')) {
            return;
        }
        
        // Reset to default values
        this.app.galaxy.customText = {
            // UI text elements
            appTitle: 'CRUSADE MAP',
            turnLabel: 'TURN',
            planetDetails: 'PLANET DETAILS',
            factionStandings: 'FACTION STANDINGS',
            surfaceMap: 'SURFACE MAP',
            fleetMovement: 'FLEET CONTROL',
            editPlanet: 'EDIT PLANET',
            gmControls: 'GAME MASTER CONTROLS',
            galaxyCenter: 'GALAXY CENTER',
            
            // Faction customizations
            factions: {},
            
            // Sector custom names
            sectorNames: {},
            
            // Event type names
            eventTypes: {},
            
            // GM section headers
            gmSections: {
                campaignManagement: 'Campaign Management',
                planets: 'Planets',
                connections: 'Connections',
                fleets: 'Fleets',
                events: 'Events',
                resourcesValues: 'Resources & Values',
                galaxy: 'Galaxy',
                interfaceDisplay: 'Interface & Display'
            },
            
            // UI labels and buttons
            uiLabels: {
                loadingTitle: 'The INDEX',
                loadingText: 'Initializing Planetary System…',
                selectPlanet: 'Select Planet or Center',
                menu: 'MENU',
                newCampaign: 'New Campaign',
                importCampaign: 'Import Campaign',
                manageFactions: 'Manage Factions',
                settings: 'Settings',
                about: 'About',
                gmControls: 'GAME MASTER CONTROLS',
                playerMode: 'PLAYER',
                gmMode: 'GM MODE',
                factionLabel: 'FACTION:',
                galacticOrder: 'Galactic Order',
                compass: 'Compass',
                help: 'Help',
                autoRotationOn: 'Rotation: AUTO',
                autoRotationOff: 'Rotation: OFF',
                // Section titles
                information: 'INFORMATION',
                resources: 'RESOURCES',
                activeEvents: 'ACTIVE EVENTS',
                fleetsInOrbit: 'FLEETS IN ORBIT',
                gmActions: 'GM ACTIONS',
                surface: 'SURFACE'
            },
            
            // Toast notifications
            toasts: {
                gmModeActivated: 'GM Mode activated',
                playerModeActivated: 'Player Mode activated',
                newGalacticOrder: 'New Galactic Order generated!',
                autoRotationEnabled: 'Auto-rotation enabled',
                autoRotationDisabled: 'Auto-rotation disabled',
                compassEnabled: 'Compass enabled',
                compassDisabled: 'Compass disabled',
                noFactionSelected: 'No faction selected',
                invalidFactionSelected: 'Invalid faction selected',
                planetUpdated: 'Planet updated',
                gmModeRequired: 'GM mode required',
                crusadeInfoUpdated: 'Crusade information updated'
            }
        };
        
        // Save and apply
        this.app.galaxy.save();
        this.applyCustomText();
        this.updatePanelTitles();
        this.updateControlHints();
        this.updateGMPanelSections();
        this.updateLoadingText();
        this.updateMenuText();
        this.updateHeaderText();
        
        this.showToast('All interface text reset to defaults', 'success');
    }

    /**
     * Gets custom text or falls back to default
     */
    getText(key, defaultText = '') {
        const path = key.split('.');
        let target = this.app.galaxy?.customText;
        
        if (!target) return defaultText;
        
        for (const segment of path) {
            if (target[segment] === undefined) return defaultText;
            target = target[segment];
        }
        
        return target || defaultText;
    }

    /**
     * Gets custom toast text or falls back to default, with template replacement
     */
    getToastText(key, defaultText = '', replacements = {}) {
        const text = this.getText(`toasts.${key}`, defaultText);
        
        // Replace template variables like {planet1}, {symbol}, {name}
        return Object.entries(replacements).reduce((result, [placeholder, value]) => {
            return result.replace(new RegExp(`{${placeholder}}`, 'g'), value);
        }, text);
    }

    /**
     * Apply custom text to all UI elements
     */
    applyCustomText() {
        if (!this.app.galaxy?.customText) return;
        
        // Update app title
        const appTitle = document.querySelector('.app-title');
        if (appTitle) {
            appTitle.textContent = this.getText('appTitle', 'The INDEX');
        }
        
        // Update turn label
        const turnLabel = document.querySelector('.turn-label');
        if (turnLabel) {
            turnLabel.textContent = this.getText('turnLabel', 'TURN');
        }
        
        // Update other UI elements
        this.updatePanelTitles();
        this.updateControlHints();
        this.updateGMPanelSections();
        this.updateLoadingText();
        this.updateMenuText();
        this.updateHeaderText();
        
        // Refresh galaxy center details if currently open
        // Check if side panel is showing galaxy center content
        const sidePanel = document.getElementById('sidePanel');
        if (sidePanel && sidePanel.style.display !== 'none') {
            const panelContent = document.getElementById('panelContent');
            if (panelContent && panelContent.querySelector('.planet-type')) {
                // This is likely a galaxy center or planet panel, refresh it
                const planetType = panelContent.querySelector('.planet-type');
                if (planetType && (planetType.textContent.includes('GALAXY CENTER') || 
                    planetType.textContent.includes(this.getText('galaxyCenter', 'GALAXY CENTER')))) {
                    this.showGalaxyCenterDetails();
                }
            }
        }
    }

    /**
     * Update panel titles with custom text
     */
    updatePanelTitles() {
        // Update panel titles with custom text and make them editable
        const panelTitle = document.getElementById('panelTitle');
        if (panelTitle) {
            const titleText = this.getText('planetDetails', 'PLANET DETAILS');
            panelTitle.textContent = titleText;
            
            // Make panel title editable in GM mode
            if (this.isGMMode) {
                this.makeElementEditable(panelTitle, {
                    key: 'planetDetails',
                    type: 'heading',
                    className: 'panel-title-editable',
                    maxLength: 30
                });
            }
        }
        
        const statsTitle = document.querySelector('#statsPanel h3');
        if (statsTitle) {
            const titleText = this.getText('factionStandings', 'FACTION STANDINGS');
            statsTitle.textContent = titleText;
            
            // Make stats title editable in GM mode
            if (this.isGMMode) {
                this.makeElementEditable(statsTitle, {
                    key: 'factionStandings',
                    type: 'heading',
                    className: 'panel-title-editable',
                    maxLength: 30
                });
            }
        }
        
        // Make galaxy center title editable
        const galaxyCenterTitle = document.querySelector('.planet-header h2');
        if (galaxyCenterTitle && galaxyCenterTitle.textContent.includes('GALAXY CENTER')) {
            const titleText = this.getText('galaxyCenter', 'GALAXY CENTER');
            galaxyCenterTitle.textContent = titleText;
            
            if (this.isGMMode) {
                this.makeElementEditable(galaxyCenterTitle, {
                    key: 'galaxyCenter',
                    type: 'heading',
                    className: 'panel-title-editable',
                    maxLength: 30
                });
            }
        }
    }

    updateControlHints() {
        const controlHint = document.querySelector('.control-hint kbd');
        if (controlHint && controlHint.nextSibling) {
            controlHint.nextSibling.textContent = ' ' + this.getText('uiLabels.selectPlanet', 'Select Planet or Center');
        }
    }

    updateGMPanelSections() {
        // Update all GM panel section headers
        const gmSections = [
            { selector: '#gmPanel .gm-section:nth-child(1) h4', key: 'gmSections.campaignManagement', default: 'Campaign Management' },
            { selector: '#gmPanel .gm-section:nth-child(2) h4', key: 'gmSections.planets', default: 'Events' },
            { selector: '#gmPanel .gm-section:nth-child(3) h4', key: 'gmSections.connections', default: 'Connections' },
            { selector: '#gmPanel .gm-section:nth-child(4) h4', key: 'gmSections.fleets', default: 'Fleets' },
            { selector: '#gmPanel .gm-section:nth-child(5) h4', key: 'gmSections.events', default: 'Planets' },
            { selector: '#gmPanel .gm-section:nth-child(6) h4', key: 'gmSections.resourcesValues', default: 'Resources & Values' },
            { selector: '#gmPanel .gm-section:nth-child(7) h4', key: 'gmSections.galaxy', default: 'Galaxy' },
            { selector: '#gmPanel .gm-section:nth-child(8) h4', key: 'gmSections.interfaceDisplay', default: 'Interface & Display' }
        ];

        gmSections.forEach(({ selector, key, default: defaultText }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = this.getText(key, defaultText);
            }
        });

        // Update GM panel header
        const gmPanelHeader = document.querySelector('#gmPanel .gm-panel-header h3');
        if (gmPanelHeader) {
            gmPanelHeader.textContent = this.getText('gmControls', 'GAME MASTER CONTROLS');
        }
    }

    updateLoadingText() {
        // Update loading screen text
        const loadingTitle = document.querySelector('.loading-title');
        if (loadingTitle) {
            loadingTitle.textContent = this.getText('uiLabels.loadingTitle', 'The INDEX');
        }

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = this.getText('uiLabels.loadingText', 'Initializing Planetary System…');
        }
    }

    updateMenuText() {
        // Update menu modal title
        const menuTitle = document.querySelector('#menuModal .modal-header h2');
        if (menuTitle) {
            menuTitle.textContent = this.getText('uiLabels.menu', 'MENU');
        }

        // Update menu button text
        const menuButtons = [
            { selector: '#newCampaignBtn', key: 'uiLabels.newCampaign', default: 'New Campaign' },
            { selector: '#importCampaignBtn', key: 'uiLabels.importCampaign', default: 'Import Campaign' },
            { selector: '#manageFactionsBtn', key: 'uiLabels.manageFactions', default: 'Manage Factions' },
            { selector: '#settingsBtn', key: 'uiLabels.settings', default: 'Settings' }
        ];

        menuButtons.forEach(({ selector, key, default: defaultText }) => {
            const element = document.querySelector(selector);
            if (element) {
                // Keep the icon but update the text
                const icon = element.querySelector('.menu-item-icon');
                const text = this.getText(key, defaultText);
                if (icon) {
                    element.innerHTML = `<span class="menu-item-icon">${icon.textContent}</span> ${text}`;
                } else {
                    element.textContent = text;
                }
            }
        });
    }

    updateHeaderText() {
        // Update header buttons text
        const headerButtons = [
            { selector: '#reinforcementsBtn', key: 'uiLabels.reinforcements', default: 'Reinforcements' },
            { selector: '#ordersBtn', key: 'uiLabels.galacticOrder', default: 'Galactic Order' },
            { selector: '#compassBtn', key: 'uiLabels.compass', default: 'Compass' }
        ];

        headerButtons.forEach(({ selector, key, default: defaultText }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = this.getText(key, defaultText);
            }
        });

        // Update faction label
        const factionLabel = document.querySelector('.faction-label');
        if (factionLabel) {
            factionLabel.textContent = this.getText('uiLabels.factionLabel', 'FACTION:');
        }

        // Update panel headers for other panels
        const surfacePanelTitle = document.querySelector('#surfacePanel .surface-panel-header h3');
        if (surfacePanelTitle) {
            surfacePanelTitle.textContent = this.getText('surfaceMap', 'SURFACE MAP');
        }

        const shipPanelTitle = document.querySelector('#shipPanel .ship-panel-header h3');
        if (shipPanelTitle) {
            shipPanelTitle.textContent = this.getText('fleetMovement', 'FLEET CONTROL');
        }

        const editPlanetPanelTitle = document.querySelector('#editPlanetPanel .edit-planet-panel-header h3');
        if (editPlanetPanelTitle) {
            editPlanetPanelTitle.textContent = '✏️ ' + this.getText('editPlanet', 'EDIT PLANET');
        }
    }

    /**
     * Makes existing elements editable by wrapping them
     */
    makeElementEditable(element, options = {}) {
        const text = element.textContent;
        const editable = this.createEditableText({ text, ...options });
        
        // Copy attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'data-key' && attr.name !== 'data-category') {
                editable.setAttribute(attr.name, attr.value);
            }
        });
        
        // Replace element
        element.parentNode.replaceChild(editable, element);
        
        return editable;
    }

    /**
     * Creates an editable text element that shows as normal text in player mode
     * and becomes editable in GM mode
     */
    createEditableText(options = {}) {
        const {
            text = '',
            type = 'text', // 'text', 'heading', 'title'
            category = 'ui', // 'ui', 'planet', 'faction', 'resource', 'sector', 'event'
            key = null, // customText key path
            className = '',
            onSave = null,
            maxLength = 100
        } = options;

        const container = document.createElement('span');
        container.className = `editable-text ${className}`;
        container.dataset.category = category;
        container.dataset.key = key;
        container.dataset.type = type;
        
        // Display element
        const display = document.createElement('span');
        display.className = 'editable-display';
        display.textContent = text;
        
        // Edit input (hidden by default)
        const input = document.createElement('input');
        input.className = 'editable-input';
        input.type = 'text';
        input.value = text;
        input.maxLength = maxLength;
        input.style.display = 'none';
        
        container.appendChild(display);
        container.appendChild(input);
        
        // Click to edit (GM mode only)
        container.addEventListener('click', (e) => {
            if (!this.isGMMode) return;
            e.stopPropagation();
            this.startEditing(container);
        });
        
        // Save on blur or Enter
        input.addEventListener('blur', () => this.saveEditing(container));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveEditing(container);
            } else if (e.key === 'Escape') {
                this.cancelEditing(container);
            }
        });
        
        return container;
    }

    startEditing(container) {
        const display = container.querySelector('.editable-display');
        const input = container.querySelector('.editable-input');
        
        display.style.display = 'none';
        input.style.display = 'inline-block';
        input.focus();
        input.select();
        
        container.classList.add('editing');
    }

    saveEditing(container) {
        const display = container.querySelector('.editable-display');
        const input = container.querySelector('.editable-input');
        const newText = input.value.trim();
        const oldText = display.textContent;
        
        if (newText && newText !== oldText) {
            display.textContent = newText;
            this.saveCustomText(container, newText);
        }
        
        display.style.display = 'inline-block';
        input.style.display = 'none';
        container.classList.remove('editing');
    }

    cancelEditing(container) {
        const display = container.querySelector('.editable-display');
        const input = container.querySelector('.editable-input');
        
        input.value = display.textContent; // Reset to original
        display.style.display = 'inline-block';
        input.style.display = 'none';
        container.classList.remove('editing');
    }

    saveCustomText(container, text) {
        const category = container.dataset.category;
        const key = container.dataset.key;
        
        if (!key) return;
        
        // Update the custom text in the galaxy
        const path = key.split('.');
        let target = this.app.galaxy.customText;
        
        for (let i = 0; i < path.length - 1; i++) {
            if (!target[path[i]]) target[path[i]] = {};
            target = target[path[i]];
        }
        
        target[path[path.length - 1]] = text;
        
        // Save the campaign
        this.app.galaxy.save();
        
        // Update any other instances of this text
        this.updateAllEditableText(key, text);
        
        this.showToast('Text updated and saved', 'success');
    }

    updateAllEditableText(key, text) {
        // Find all elements with the same key and update them
        document.querySelectorAll(`[data-key="${key}"]`).forEach(element => {
            const display = element.querySelector('.editable-display');
            if (display) display.textContent = text;
        });
    }

    // ── Galactic Orders UI ───────────────────────────────────────────────────────

    showGalacticOrderPanel() {
        const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
        if (!currentOrder) {
            this.showToast('No active Galactic Order', 'info');
            return;
        }
        
        const order = currentOrder;
        
        let descr = order.description
            .replace('{target}', order.target || '')
            .replace('{sector}', order.sector || '')
            .replace('{turns}', order.turns || '')
            .replace('{amount}', order.amount || '')
            .replace('{resource}', order.resource || '')
            .replace('{objective}', order.objective || '');
        
        const progress = order.progress || 0;
        
        let progressHTML = '';
        if (order.type === 'LIBERATION') {
            progressHTML = `<div class="progress-item"><span class="progress-label">Progress:</span><span class="progress-value">${progress} / ${order.target} planets liberated</span></div>`;
        } else if (order.type === 'RESOURCE_GATHERING') {
            progressHTML = `<div class="progress-item"><span class="progress-label">Progress:</span><span class="progress-value">${progress} / ${order.target} resources gathered</span></div>`;
        } else {
            progressHTML = `<div class="progress-item"><span class="progress-label">Progress:</span><span class="progress-value">${progress} / ${order.target}</span></div>`;
        }
        
        // Get resource names for rewards
        const resourceTypes = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
        
        const rewardsHTML = Object.entries(order.reward || {})
            .filter(([res, amt]) => amt > 0)
            .map(([res, amt]) => {
                const resource = resourceTypes.find(r => r.id === res);
                const resourceName = resource ? resource.name : res;
                const resourceIcon = resource ? resource.icon : '📦';
                return `${resourceIcon} ${amt} ${resourceName}`;
            })
            .join('<br>');
        
        const turnsRemaining = Math.max(0, Math.ceil((order.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
        
        this.showModal(
            `${order.icon} ${order.name}`,
            `
            <div class="galactic-order-panel">
                <div class="order-section">
                    <div class="order-title">Objective</div>
                    <div class="order-content">${descr}</div>
                </div>
                
                <div class="order-section">
                    <div class="order-title">Turns Remaining</div>
                    <div class="order-content order-highlight">${turnsRemaining}</div>
                </div>
                
                <div class="order-section">
                    <div class="order-title">Progress</div>
                    <div class="order-content">
                        <div class="progress-item">
                            <span class="progress-label">Current Progress:</span>
                            <span class="progress-value">${progress} / ${order.target}</span>
                            ${this.isGMMode ? `<button id="editProgressBtn" class="modal-btn secondary" style="margin-left: 10px;">Edit Progress</button>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="order-section">
                    <div class="order-title">Reward</div>
                    <div class="order-content reward-content">${rewardsHTML}</div>
                </div>
                
                <div class="order-note">
                    <em>All factions receive rewards upon completion!</em>
                </div>
            </div>
            `
        );
        
        // Add event listener for edit progress button if in GM mode
        if (this.isGMMode) {
            setTimeout(() => {
                const editProgressBtn = document.getElementById('editProgressBtn');
                if (editProgressBtn) {
                    editProgressBtn.addEventListener('click', () => this.showEditProgressModal());
                }
            }, 100);
        }
    }

    showEditProgressModal() {
        const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
        if (!currentOrder) {
            this.showToast('No active order to edit', 'info');
            return;
        }
        
        const modalHTML = `
            <div class="create-order-form">
                <div class="form-row">
                    <label>Current Progress:</label>
                    <div class="progress-display">${currentOrder.progress} / ${currentOrder.target}</div>
                </div>
                <div class="form-row">
                    <label>Set New Progress:</label>
                    <input type="number" id="newProgress" class="modal-input" min="0" max="${currentOrder.target}" value="${currentOrder.progress}">
                </div>
                <div class="form-actions">
                    <button id="confirmProgressEdit" class="modal-btn primary">Update Progress</button>
                    <button id="cancelProgressEdit" class="modal-btn secondary">Cancel</button>
                </div>
            </div>
        `;
        
        this.showModal('Edit Order Progress', modalHTML);
        
        // Add event listeners
        document.getElementById('confirmProgressEdit').addEventListener('click', () => {
            this.updateOrderProgress();
        });
        
        document.getElementById('cancelProgressEdit').addEventListener('click', () => {
            this.closeModal();
        });
    }

    updateOrderProgress() {
        const currentOrder = this.app.galaxy.galacticOrderManager.getCurrentOrder();
        if (!currentOrder) {
            this.showToast('No active order to update', 'error');
            return;
        }
        
        const newProgress = parseInt(document.getElementById('newProgress').value);
        
        if (isNaN(newProgress) || newProgress < 0 || newProgress > currentOrder.target) {
            this.showToast('Invalid progress value', 'warning');
            return;
        }
        
        // Update the order progress
        currentOrder.progress = newProgress;
        this.app.galaxy._lastModified = Date.now();
        this.app.galaxy.save();
        
        // Check if order should be completed
        if (newProgress >= currentOrder.target) {
            this.app.galaxy.galacticOrderManager.completeOrder();
            this.showToast(`⭐ Galactic Order "${currentOrder.name}" completed!`, 'success');
            
            // Distribute rewards to all factions
            const completedOrder = this.app.galaxy.galacticOrderManager.getCompletedOrders().slice(-1)[0];
            if (completedOrder) {
                this.app.factionManager.getAll().forEach(faction => {
                    Object.entries(completedOrder.reward).forEach(([resource, amount]) => {
                        if (amount > 0) {
                            if (!this.app.galaxy.playerResources[faction.id]) {
                                this.app.galaxy.playerResources[faction.id] = {};
                            }
                            this.app.galaxy.playerResources[faction.id][resource] = (this.app.galaxy.playerResources[faction.id][resource] || 0) + amount;
                        }
                    });
                });
                this.updateFactionStats();
                this.updateResourceBar();
            }
        } else {
            this.showToast(`Progress updated to ${newProgress} / ${currentOrder.target}`, 'success');
        }
        
        this.closeModal();
        this.showGalacticOrderPanel();
    }

    // ── Stratagems UI ───────────────────────────────────────────────────────

    showStratagemPanel(factionId) {
        const faction = this.app.factionManager.getById(factionId);
        if (!faction) return;
        
        let html = '<div class="stratagem-grid">';
        
        Object.values(STRATAGEMS).forEach(strat => {
            const onCooldown = this.app.galaxy.isStratagemOnCooldown(factionId, strat.id);
            const cooldownTurns = this.app.galaxy.stratagemCooldowns[factionId]?.[strat.id] || 0;
            const canAffordStratagem = canAfford(this.app.galaxy.playerResources, factionId, strat.cost);
            
            let statusClass = '';
            let statusText = '';
            
            if (onCooldown) {
                statusClass = 'on-cooldown';
                statusText = `Cooldown: ${cooldownTurns} turns`;
            } else if (!canAffordStratagem) {
                statusClass = 'cannot-afford';
                statusText = 'Insufficient resources';
            }
            
            const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
            const costHTML = Object.entries(strat.cost)
                .map(([res, amt]) => {
                    const resource = allResources.find(r => r.id === res);
                    const resourceName = resource ? resource.name : res;
                    const resourceIcon = resource ? resource.icon : '📦';
                    return `${resourceIcon} ${amt} ${resourceName}`;
                })
                .join(', ');
            
            html += `
                <div class="stratagem-item ${statusClass}" data-stratagem-id="${strat.id}">
                    <div class="stratagem-header">
                        <span class="stratagem-icon">${strat.icon}</span>
                        <span class="stratagem-name">${strat.name}</span>
                    </div>
                    <div class="stratagem-description">${strat.description}</div>
                    <div class="stratagem-cost">Cost: ${costHTML}</div>
                    ${statusText ? `<div class="stratagem-status">${statusText}</div>` : ''}
                    ${!onCooldown && canAffordStratagem ? `<button class="use-stratagem-btn" data-id="${strat.id}">Activate</button>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        
        this.showModal(`${faction.symbol} ${faction.name} - Stratagems`, html);
        
        // Add event listeners
        document.querySelectorAll('.use-stratagem-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stratagemId = e.target.dataset.id;
                this.activateStratagem(factionId, stratagemId);
            });
        });
    }

    activateStratagem(factionId, stratagemId) {
        const STRATAGEMS = this.app.galaxy.constructor.STRATAGEMS || {};
        const stratagem = STRATAGEMS[stratagemId];
        
        if (!stratagem) return;
        
        if (stratagem.targetRequired) {
            this.showToast('Select a target planet', 'info');
            this.closeModal();
            // Set up click handler for planet selection
            this.pendingStratagemActivation = { factionId, stratagemId };
            return;
        }
        
        const result = this.app.useStratagem(factionId, stratagemId);
        this.showToast(result.message, result.ok ? 'success' : 'error');
        
        if (result.ok) {
            this.closeModal();
            this.updateResourceBar();
        }
    }

    // ── Auto-Distribution UI ─────────────────────────────────────────────────

    showAutoDistributionSettings() {
        const current = this.app.galaxy.autoDistribution;
        const AUTO_DISTRIBUTION = this.app.galaxy.constructor.AUTO_DISTRIBUTION || {};
        const factions = this.app.factionManager.getAll();
        
        // Get all resource types (default + custom)
        const allResourceTypes = this.app.resourceManager?.getAll() || [];
        
        // Get custom distribution modes (saved in galaxy)
        const customModes = this.app.galaxy.customDistributionModes || {};
        const allModes = { ...AUTO_DISTRIBUTION, ...customModes };
        
        let html = `
            <div class="auto-distribution-settings">
                <label>
                    <input type="checkbox" id="autoDistToggle" ${current.enabled ? 'checked' : ''}>
                    Enable Auto-Distribution
                </label>
                
                <div class="distribution-modes">
                    <h3>Distribution Mode:</h3>
                    <select id="autoDistMode" class="form-select" style="font-size:1.1rem;width:100%;padding:0.6rem;border:1px solid var(--color-border);border-radius:0.25rem;background:var(--color-bg-secondary);color:var(--color-text);">
        `;
        
        Object.entries(allModes).forEach(([key, mode]) => {
            const isCustom = customModes.hasOwnProperty(key);
            const customLabel = isCustom ? ' (Custom)' : '';
            html += `<option value="${key}" ${current.mode === key ? 'selected' : ''}>${mode.icon} ${mode.name}${customLabel}</option>`;
        });
        
        html += `
                    </select>
                    <p class="mode-description" id="modeDescription" style="font-size:1.1rem; margin-bottom:1rem;></p>
                </div>
                
                <div class="manual-distribution-section">
                    <h3>Resource Allocation Preset</h3>
                    <p style="color:var(--color-silver);font-size:1.1rem;margin-bottom:1rem;">
                        Adjust resource amounts for the selected distribution mode.
                    </p>
                    
                    <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                        <input type="text" 
                               id="presetNameInput" 
                               class="form-input"
                               placeholder="Enter new preset name..." 
                               style="flex:1;min-width:200px;padding:0.5rem;font-size:1.3rem;font-style:italic;border:1px solid var(--color-border);border-radius:0.25rem;background:var(--color-bg-secondary);color:var(--color-text);">
                        <button id="saveAsPresetBtn" class="gm-btn">💾 Save</button>
                        <button id="resetAllocationBtn" class="gm-btn">🔄 Reset</button>
                        <button id="deletePresetBtn" class="gm-btn" style="display:none;">🗑️ Delete</button>
                    </div>

                    <div class="resource-allocation-table">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:var(--color-bg-secondary);border-bottom:2px solid var(--color-border);">
                                    <th style="padding:0.75rem;text-align:left;border-bottom:1px solid var(--color-border);color:var(--color-text-bright);font-weight:600;">Faction</th>
                `;
        
        // Add resource type headers
        allResourceTypes.forEach(resource => {
            const color = resource.color || '#888888';
            const icon = resource.icon || '📦';
            html += `<th style="padding:0.75rem;text-align:center;border-bottom:1px solid var(--color-border);color:var(--color-text-bright);font-weight:600;"><span style="color:${color};filter:brightness(1.2);">${icon}</span> ${resource.name}</th>`;
        });
        html += `</tr></thead><tbody>`;
        
        // Add faction rows with input fields
        factions.forEach(faction => {
            html += `
                <tr data-faction-id="${faction.id}" style="border-bottom:1px solid var(--color-border-hover);">
                    <td style="padding:0.75rem;color:${faction.color};border-left:3px solid ${faction.color};padding-left:0.5rem;font-weight:600;filter:brightness(1.1);">
                        ${faction.symbol} ${faction.name}
                    </td>
            `;
            
            allResourceTypes.forEach(resource => {
                // Get current allocation from the selected mode's preset, or manual allocation
                const selectedMode = current.mode;
                const modeAllocation = allModes[selectedMode]?.allocation || {};
                const currentAmount = modeAllocation[faction.id]?.[resource.id] || 
                                   this.app.galaxy.autoDistribution.manualAllocation?.[faction.id]?.[resource.id] || 0;
                
                html += `
                    <td style="padding:0.75rem;text-align:center;">
                        <input type="number" 
                               class="resource-input form-input" 
                               data-faction="${faction.id}" 
                               data-resource="${resource.id}" 
                               value="${currentAmount}" 
                               min="-99" 
                               max="99" 
                               style="width:70px;text-align:center;padding:0.5rem;border:1px solid var(--color-border);border-radius:0.25rem;background:var(--color-bg-secondary);color:var(--color-text-bright);font-weight:500;">
                    </td>
                `;
            });
            
            html += `</tr>`;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.showModal('Auto-Distribution Settings', html);
        
        // Add special class to prevent dimming and enable auto-width for auto-distribution dialog
        setTimeout(() => {
            const modal = this.genericModal;
            if (modal) {
                modal.classList.add('color-theme-modal', 'auto-distribution-modal');
            }
        }, 100);
        
        const updateDescription = () => {
            const mode = document.getElementById('autoDistMode').value;
            const modeData = allModes[mode];
            const desc = modeData?.description || '';
            document.getElementById('modeDescription').textContent = desc;
            
            // Show/hide delete button for custom modes
            const deleteBtn = document.getElementById('deletePresetBtn');
            if (customModes.hasOwnProperty(mode) && modeData) {
                deleteBtn.style.display = 'inline-block';
                deleteBtn.textContent = `🗑️ Delete "${modeData.name}"`;
            } else {
                deleteBtn.style.display = 'none';
            }
        };
        
        const loadPresetValues = () => {
            const selectedMode = document.getElementById('autoDistMode').value;
            const modeAllocation = allModes[selectedMode]?.allocation || {};
            
            document.querySelectorAll('.resource-input').forEach(input => {
                const factionId = input.dataset.faction;
                const resourceId = input.dataset.resource;
                const amount = modeAllocation[factionId]?.[resourceId] || 0;
                input.value = amount;
            });
        };
        
        const autoSaveAllocation = () => {
            const allocation = {};
            
            document.querySelectorAll('.resource-input').forEach(input => {
                const factionId = input.dataset.faction;
                const resourceId = input.dataset.resource;
                const amount = parseInt(input.value) || 0;
                
                if (!allocation[factionId]) allocation[factionId] = {};
                allocation[factionId][resourceId] = amount;
            });
            
            // Save allocation to galaxy
            if (!this.app.galaxy.autoDistribution.manualAllocation) {
                this.app.galaxy.autoDistribution.manualAllocation = {};
            }
            this.app.galaxy.autoDistribution.manualAllocation = allocation;
            
            // Ensure save is called with slight delay to catch rapid input
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = setTimeout(() => {
                this.app.galaxy.save();
            }, 200);
        };
        
        const saveAsPreset = () => {
            const presetName = document.getElementById('presetNameInput').value.trim();
            const currentMode = document.getElementById('autoDistMode').value;
            const customModes = this.app.galaxy.customDistributionModes || {};
            
            // If no name provided, try to overwrite current custom preset
            if (!presetName) {
                if (!customModes.hasOwnProperty(currentMode)) {
                    this.showToast('Please enter a preset name or select a custom preset to overwrite', 'error');
                    return;
                }
                // Overwrite current custom preset
                const allocation = {};
                document.querySelectorAll('.resource-input').forEach(input => {
                    const factionId = input.dataset.faction;
                    const resourceId = input.dataset.resource;
                    const amount = parseInt(input.value) || 0;
                    
                    if (!allocation[factionId]) allocation[factionId] = {};
                    allocation[factionId][resourceId] = amount;
                });
                
                customModes[currentMode].allocation = allocation;
                this.app.galaxy.save();
                
                this.showToast(`Updated "${customModes[currentMode].name}" with current values`, 'success');
                return;
            }
            
            // Create new preset with provided name
            const allocation = {};
            document.querySelectorAll('.resource-input').forEach(input => {
                const factionId = input.dataset.faction;
                const resourceId = input.dataset.resource;
                const amount = parseInt(input.value) || 0;
                
                if (!allocation[factionId]) allocation[factionId] = {};
                allocation[factionId][resourceId] = amount;
            });
            
            const modeId = presetName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            
            if (!this.app.galaxy.customDistributionModes) {
                this.app.galaxy.customDistributionModes = {};
            }
            
            this.app.galaxy.customDistributionModes[modeId] = {
                name: presetName,
                icon: '💾',
                description: 'Custom preset created from current allocation',
                allocation: allocation
            };
            
            // Update the dropdown with the new preset
            const autoDistMode = document.getElementById('autoDistMode');
            const newOption = document.createElement('option');
            newOption.value = modeId;
            newOption.textContent = `💾 ${presetName} (Custom)`;
            newOption.selected = true;
            autoDistMode.appendChild(newOption);
            
            // Update the galaxy state
            this.app.galaxy.setAutoDistribution(this.app.galaxy.autoDistribution.enabled, modeId);
            
            // Ensure save is called with a delay to catch all changes
            setTimeout(() => {
                this.app.galaxy.save();
                this.showToast(`Preset "${presetName}" created and activated!`, 'success');
            }, 100);
            
            // Clear the input and update description
            document.getElementById('presetNameInput').value = '';
            updateDescription();
        };
        
        updateDescription();
        loadPresetValues();
        
        document.getElementById('autoDistMode').addEventListener('change', () => {
            updateDescription();
            loadPresetValues();
            
            const enabled = document.getElementById('autoDistToggle').checked;
            const mode = document.getElementById('autoDistMode').value;
            this.app.galaxy.setAutoDistribution(enabled, mode);
            
            // Ensure all changes are saved with a small delay to catch all modifications
            setTimeout(() => {
                this.app.galaxy.save();
                this.showToast(`Distribution mode: ${allModes[mode].name}`, 'success');
            }, 100);
        });
        
        document.getElementById('autoDistToggle').addEventListener('change', (e) => {
            const enabled = e.target.checked;
            const mode = document.getElementById('autoDistMode').value;
            this.app.galaxy.setAutoDistribution(enabled, mode);
            
            // Ensure all changes are saved with a small delay to catch all modifications
            setTimeout(() => {
                this.app.galaxy.save();
                this.showToast(`Auto-distribution ${enabled ? 'enabled' : 'disabled'}`, 'success');
            }, 100);
        });
        
        // Auto-save on input changes
        document.querySelectorAll('.resource-input').forEach(input => {
            input.addEventListener('input', autoSaveAllocation);
        });
        
        // Preset management
        document.getElementById('saveAsPresetBtn')?.addEventListener('click', saveAsPreset);
        
        // Save on Enter key in preset name input
        document.getElementById('presetNameInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveAsPreset();
            }
        });
        
        document.getElementById('resetAllocationBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.resource-input').forEach(input => {
                input.value = '0';
            });
            autoSaveAllocation();
            this.showToast('Resource allocation reset to zero', 'info');
        });
        
        document.getElementById('deletePresetBtn')?.addEventListener('click', () => {
            const selectedMode = document.getElementById('autoDistMode').value;
            if (customModes.hasOwnProperty(selectedMode)) {
                this.deleteCustomMode(selectedMode);
            }
        });
    }

    deleteCustomMode(modeId) {
        if (!this.app.galaxy.customDistributionModes || !this.app.galaxy.customDistributionModes[modeId]) {
            return;
        }
        
        const modeName = this.app.galaxy.customDistributionModes[modeId].name;
        
        if (confirm(`Are you sure you want to delete the custom mode "${modeName}"?`)) {
            delete this.app.galaxy.customDistributionModes[modeId];
            
            // If the deleted mode was currently selected, switch back to EQUAL
            if (this.app.galaxy.autoDistribution.mode === modeId) {
                this.app.galaxy.setAutoDistribution(this.app.galaxy.autoDistribution.enabled, 'EQUAL');
            }
            
            // Ensure save is called with a delay to catch all changes
            setTimeout(() => {
                this.app.galaxy.save();
                this.showToast(`Custom mode "${modeName}" deleted`, 'info');
                this.closeModal();
                this.showAutoDistributionSettings(); // Refresh
            }, 100);
        }
    }

    // ── Enhanced Shop Display ─────────────────────────────────────────────────

    showShop(factionId) {
        const faction = this.app.factionManager.getById(factionId);
        if (!faction) return;
        
        this.shopFactionId = factionId;
        
        // Generate shop items HTML
        const itemsHTML = SHOP_ITEMS.map(item => {
            const canAffordItem = canAfford(this.app.galaxy.playerResources, factionId, item.cost);
            const disabled = !canAffordItem ? 'disabled' : '';
            const disabledClass = !canAffordItem ? 'disabled' : '';
            const targetRequired = item.targetRequired ? 'data-target-required="true"' : '';
            
            const allResources = this.app.resourceManager?.getAll() || DEFAULT_RESOURCE_TYPES;
            const costHTML = Object.entries(item.cost)
                .map(([res, amt]) => {
                    const resource = allResources.find(r => r.id === res);
                    const resourceName = resource ? resource.name : res;
                    const resourceIcon = resource ? resource.icon : '📦';
                    return `${resourceIcon} ${amt} ${resourceName}`;
                })
                .join(', ');
            
            return `
                <div class="shop-item ${disabledClass}" data-item-id="${item.id}" ${targetRequired}>
                    <div class="shop-item-header">
                        <span class="shop-item-icon">${item.icon}</span>
                        <span class="shop-item-name">${item.name}</span>
                    </div>
                    <div class="shop-item-description">${item.description}</div>
                    <div class="shop-item-cost">Cost: ${costHTML}</div>
                    <button class="shop-buy-btn ${canAffordItem ? 'affordable' : 'unaffordable'}" ${disabled} data-id="${item.id}">PURCHASE</button>
                </div>
            `;
        }).join('');
        
        // Add stratagems tab
        const html = `
            <div class="shop-tabs">
                <button class="shop-tab active" data-tab="items">Requisitions</button>
                <button class="shop-tab" data-tab="stratagems">Stratagems</button>
            </div>
            <div class="shop-content">
                <div class="shop-panel" data-panel="items">
                    <div class="shop-grid">
                        ${itemsHTML}
                    </div>
                </div>
                <div class="shop-panel hidden" data-panel="stratagems">
                    <button class="view-stratagems-btn use-stratagem-btn">VIEW ALL STRATAGEMS</button>
                </div>
            </div>
        `;
        
        this.showModal(`${faction.symbol} ${faction.name} - Reinforcements`, html);
        
        // Add no-backdrop class to remove background darkening
        if (this.currentModal) {
            this.currentModal.classList.add('no-backdrop');
        }
        
        // Add tab switching
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.shop-panel').forEach(p => p.classList.add('hidden'));
                e.target.classList.add('active');
                document.querySelector(`[data-panel="${targetTab}"]`).classList.remove('hidden');
            });
        });
        
        document.querySelector('.view-stratagems-btn')?.addEventListener('click', () => {
            this.closeModal();
            this.showStratagemPanel(factionId);
        });
        
        // Add shop buy button event listeners
        document.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.dataset.id;
                this.handleShopPurchase(itemId);
            });
        });
    }

    // ── Shop Purchase Handler ───────────────────────────────────────────────────

    handleShopPurchase(itemId) {
        if (!this.shopFactionId) return;
        
        // Check if item requires a target planet
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) {
            this.showToast('Unknown item', 'error');
            return;
        }

        if (item.targetRequired && !this.selectedPlanetId) {
            this.showToast('Please select a target planet first', 'warning');
            return;
        }

        // Execute the purchase
        const result = this.app.purchaseItem(this.shopFactionId, itemId, this.selectedPlanetId);
        
        if (result.ok) {
            this.showToast(result.message, 'success');
            // Refresh the shop to update affordability
            this.showShop(this.shopFactionId);
            // Update UI elements
            this.app.ui.updateResourceBar();
            this.app.ui.updateFactionStats();
            if (this.selectedPlanetId) {
                this.showPlanetDetails(this.selectedPlanetId);
            }
        } else {
            this.showToast(result.message, 'error');
        }
    }

    // ── Fleet Management (GM Only) ───────────────────────────────────────────────

    showAddFleetDialog() {
        if (!this.isGMMode) {
            this.showToast('GM mode required', 'error');
            return;
        }

        const factions = this.app.factionManager.getAll();
        const selectedPlanet = this.selectedPlanetId ? this.app.galaxy.getPlanet(this.selectedPlanetId) : null;

        const factionOptions = factions.map(f => 
            `<option value="${f.id}">${f.symbol} ${f.name}</option>`
        ).join('');

        // If there's a selected planet, use it as default and show its info
        let planetSelection = '';
        if (selectedPlanet) {
            const faction = factions.find(f => f.id === selectedPlanet.owner);
            planetSelection = `
                <div class="form-group">
                    <label>Selected Planet:</label>
                    <div style="background: var(--color-iron); border: 1px solid var(--color-gold-dim); padding: var(--space-sm); border-radius: 4px; margin-bottom: var(--space-md);">
                        <strong>${selectedPlanet.name}</strong><br>
                        <small>Owner: ${faction ? faction.symbol + ' ' + faction.name : 'Neutral'}</small><br>
                        <small>Type: ${selectedPlanet.type}</small>
                    </div>
                </div>
            `;
        } else {
            // Show planet selector if no planet is selected
            const planets = this.app.galaxy.planets;
            const planetOptions = planets.map(p => 
                `<option value="${p.id}">${p.name} (${p.owner ? factions.find(f => f.id === p.owner)?.symbol : 'Neutral'})</option>`
            ).join('');
            
            planetSelection = `
                <div class="form-group">
                    <label>Starting Planet:</label>
                    <select id="fleetPlanet" class="form-select">
                        ${planetOptions}
                    </select>
                </div>
            `;
        }

        const html = `
            <div class="form-group">
                <label>Faction:</label>
                <select id="fleetFaction" class="form-select">
                    ${factionOptions}
                </select>
            </div>
            ${planetSelection}
            <div class="form-group">
                <label>Fleet Name:</label>
                <input type="text" id="fleetName" class="form-input" placeholder="Enter fleet name">
            </div>
        `;

        this.showModal('Add New Fleet', html);
        
        // Add buttons after modal is shown
        setTimeout(() => {
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button type="button" class="btn" onclick="window.app.ui.closeModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="window.app.ui.handleAddFleet()">Add Fleet</button>
                `;
            }
        }, 100);
    }

    handleAddFleet() {
        const factionId = document.getElementById('fleetFaction').value;
        const fleetName = document.getElementById('fleetName').value.trim() || 'New Fleet';
        
        // Use selected planet if available, otherwise get from dropdown
        let planetId = this.selectedPlanetId;
        if (!planetId) {
            planetId = document.getElementById('fleetPlanet')?.value;
        }

        if (!factionId || !planetId) {
            this.showToast('Please select faction and planet', 'error');
            return;
        }

        // Add the fleet through the galaxy
        const ship = this.app.galaxy.addShip(factionId, planetId, fleetName);
        
        // Create visual representation
        this.app.renderer.createShipMesh(ship);
        
        // Save the galaxy state
        this.app.galaxy.save();
        
        this.showToast(`Fleet "${fleetName}" added to ${this.app.galaxy.getPlanet(planetId)?.name}`, 'success');
        this.closeModal();
        
        // Update UI
        this.app.ui.updateFactionStats();
    }

    showManageFleetsDialog() {
        if (!this.isGMMode) {
            this.showToast('GM mode required', 'error');
            return;
        }

        const ships = this.app.galaxy.ships;
        const factions = this.app.factionManager.getAll();

        if (ships.length === 0) {
            this.showModal('Manage Fleets', '<p>No fleets currently exist in the galaxy.</p>', [
                { text: 'Close', class: 'btn', action: () => this.closeModal() }
            ]);
            return;
        }

        const shipsHTML = ships.map(ship => {
            const faction = factions.find(f => f.id === ship.factionId);
            const planet = this.app.galaxy.getPlanet(ship.planetId);
            
            return `
                <div class="fleet-item" style="border: 1px solid var(--color-gold-dim); padding: var(--space-md); margin-bottom: var(--space-sm); border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${ship.name}</strong><br>
                            <small>Faction: ${faction ? faction.symbol + ' ' + faction.name : 'Unknown'}</small><br>
                            <small>Location: ${planet ? planet.name : 'Unknown'}</small><br>
                            <small>Created: ${new Date(ship.createdAt).toLocaleDateString()}</small>
                        </div>
                        <button class="btn btn-danger" onclick="window.app.ui.removeFleet('${ship.id}')">Remove</button>
                    </div>
                </div>
            `;
        }).join('');

        const html = `
            <div class="fleets-list">
                ${shipsHTML}
            </div>
        `;

        this.showModal('Manage Fleets', html, [
            { text: 'Close', class: 'btn', action: () => this.closeModal() }
        ]);
    }

    removeFleet(shipId) {
        if (!this.isGMMode) return;

        const ship = this.app.galaxy.shipManager.getById(shipId);
        if (!ship) return;

        // Remove visual representation
        this.app.renderer.removeShipMesh(shipId);
        
        // Remove from galaxy
        this.app.galaxy.shipManager.removeShip(shipId);
        
        // Save state
        this.app.galaxy.save();
        
        this.showToast(`Fleet "${ship.name}" removed`, 'success');
        
        // Refresh the dialog
        this.showManageFleetsDialog();
    }
}
