// ═══════════════════════════════════════════════════════════════════════
// Three.js 3D rendering
// ═══════════════════════════════════════════════════════════════════════

import { PLANET_TYPES, GALAXY_CENTER_TYPES, CONFIG, BATTLE_STATUS } from '../config/constants.js';
import { hexToRgb } from '../utils/helpers.js';

export class GalaxyRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.app = null; // Will be set later

        this.planetMeshes    = new Map();   // planetId  → mesh
        this.connectionLines = new Map();   // key       → line
        this.eventParticles  = new Map();   // eventId   → [ring …]
        this.shipMeshes      = new Map();   // shipId    → { group, bobPhase }

        // Galaxy-center objects
        this.centerGroup     = null;
        this.centerLight     = null;

        // Sector visuals
        this.sectorRings     = [];          // { ring, label, sectorId }
        this.highlightedSector = null;      // sectorId currently highlighted

        // Move-target highlight rings (transient)
        this.moveTargetRings = [];

        // Connection-editor highlight (two selected planets for link toggle)
        this.connEditorHighlights = [];

        // Connection visibility state
        this.connectionsVisible = true;
        this.connectionThickness = 3; // Default thickness, adjustable by GM
        this.connectionColor = 0xC8A546; // Default RGB 200/165/70, adjustable by GM
        this.galaxyCenterBrightness = 100; // Default brightness

        this.selectedPlanet  = null;
        this.selectedGalaxyCenter = false;
        this.raycaster       = new THREE.Raycaster();
        this.mouse           = new THREE.Vector2();

        this.isDragging      = false;
        this.previousMouse   = { x: 0, y: 0 };
        this.cameraRotation  = { x: 0, y: 0 };
        this.cameraDistance   = 150;
        this.cameraPosition  = { x: 0, y: 0, z: 0 };
        this.dragMode        = null;
        this.autoRotate      = true;

        this.init();
        this.setupEventListeners();
        // Ensure proper initial sizing
        this.ensureProperSize();
        this.animate();
    }

    ensureProperSize() {
        // Function to check and apply proper size
        const attemptResize = () => {
            const w = this.canvas.parentElement.clientWidth;
            const h = this.canvas.parentElement.clientHeight;
            
            // Only proceed if we have valid dimensions
            if (w > 0 && h > 0) {
                this.onResize();
                this.updateCameraPosition();
                // Force an immediate render
                if (this.renderer && this.scene && this.camera) {
                    this.renderer.render(this.scene, this.camera);
                }
                return true;
            }
            return false;
        };

        // Try immediately on next frame
        requestAnimationFrame(() => {
            if (attemptResize()) return;
            
            // Use MutationObserver to watch for visibility
            const observer = new MutationObserver(() => {
                if (attemptResize()) {
                    observer.disconnect();
                }
            });
            
            // Watch for style changes on app container
            const appContainer = document.getElementById('app');
            if (appContainer) {
                observer.observe(appContainer, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }
            
            // Fallback
            setTimeout(() => {
                if (attemptResize()) {
                    observer.disconnect();
                }
            }, 100);
        });
    }

    // ── Initialisation ───────────────────────────────────────────────────

    /**
     * Initialize Three.js scene, camera, renderer, and lighting
     */
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 200, 400);

        this.camera = new THREE.PerspectiveCamera(
            60,
            this.canvas.parentElement.clientWidth / this.canvas.parentElement.clientHeight,
            1, 1000
        );
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setSize(this.canvas.parentElement.clientWidth, this.canvas.parentElement.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.scene.add(new THREE.AmbientLight(0x404040, 1));

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 100, 50);
        this.scene.add(dirLight);

        this.centerLight = new THREE.PointLight(0xd4af37, 0.5, 300);
        this.centerLight.position.set(0, 0, 0);
        this.scene.add(this.centerLight);

        this.centerGroup = new THREE.Group();
        this.scene.add(this.centerGroup);

        this.createStarfield();
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Create background starfield with random particle positions
     */
    createStarfield() {
        const geo = new THREE.BufferGeometry();
        const verts = [];
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            verts.push((Math.random()-0.5)*500, (Math.random()-0.5)*500, (Math.random()-0.5)*500);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true, opacity: 0.8 })));
    }

    // ── Galaxy center ────────────────────────────────────────────────────

    updateGalaxyCenter(centerType) {
        while (this.centerGroup.children.length) this.centerGroup.remove(this.centerGroup.children[0]);
        const info = GALAXY_CENTER_TYPES[centerType] || GALAXY_CENTER_TYPES.EMPTY;
        this.centerLight.color.setHex(info.lightColor);
        // Preserve current brightness setting instead of overwriting with default
        const currentIntensity = this.centerLight.intensity;
        this.centerLight.intensity = currentIntensity || (this.galaxyCenterBrightness / 100) * 1.0;
        this.centerLight.distance  = 350;
        if (centerType === 'EMPTY') return;
        if (centerType === 'BLACK_HOLE') this._buildBlackHole(info);
        else if (centerType === 'GAS_GIANT') this._buildGasGiant(info);
        else this._buildStar(info);
    }

    _buildStar(info) {
        const core = new THREE.Mesh(new THREE.SphereGeometry(info.radius, 32, 32), new THREE.MeshBasicMaterial({ color: info.color }));
        this.centerGroup.add(core);
        this.centerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(info.radius*1.6,32,32), new THREE.MeshBasicMaterial({ color:info.emissiveColor, transparent:true, opacity:0.25, side:THREE.BackSide })));
        this.centerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(info.radius*2.8,32,32), new THREE.MeshBasicMaterial({ color:info.color, transparent:true, opacity:0.07, side:THREE.BackSide })));
    }

    _buildGasGiant(info) {
        this.centerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(info.radius,48,48), new THREE.MeshStandardMaterial({ color:info.color, emissive:info.emissiveColor, emissiveIntensity:0.15, roughness:0.9, metalness:0.1 })));
        const band = new THREE.Mesh(new THREE.TorusGeometry(info.radius*1.15, info.radius*0.08, 16, 64), new THREE.MeshBasicMaterial({ color:0xddaa88, transparent:true, opacity:0.35, side:THREE.DoubleSide }));
        band.rotation.x = Math.PI / 2;
        this.centerGroup.add(band);
        this.centerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(info.radius*1.18,32,32), new THREE.MeshBasicMaterial({ color:0xffaa66, transparent:true, opacity:0.08, side:THREE.BackSide })));
    }

    _buildBlackHole(info) {
        this.centerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(info.radius,32,32), new THREE.MeshBasicMaterial({ color:0x020202 })));
        const disc = new THREE.Mesh(new THREE.RingGeometry(info.radius*1.1, info.radius*2.8, 64), new THREE.MeshBasicMaterial({ color:0x9933ff, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
        disc.rotation.x = Math.PI / 2.3;
        this.centerGroup.add(disc);
        this.centerGroup.userData = { accretionDisc: disc };
        const innerDisc = new THREE.Mesh(new THREE.RingGeometry(info.radius*1.05, info.radius*1.4, 64), new THREE.MeshBasicMaterial({ color:0xddbbff, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
        innerDisc.rotation.x = Math.PI / 2.3;
        this.centerGroup.add(innerDisc);
    }

    // ── Sector rings & labels ────────────────────────────────────────────

    /**
     * Draw thin ring and floating label for each sector.
     * Called once after planets are placed.
     */
    buildSectorVisuals(sectors) {
        this.clearSectorVisuals();
        if (!sectors || !sectors.length) return;

        const numSectors = sectors.length;
        const angleStep  = (Math.PI * 2) / numSectors;

        sectors.forEach((sector, i) => {
            const centerAngle = i * angleStep;

            // ── Sector boundary arc (drawn as a thin ring segment using a line) ──
            const arcPoints = [];
            const segments  = 40;
            const wedge     = angleStep * 0.92;
            const startA    = centerAngle - wedge / 2;
            for (let s = 0; s <= segments; s++) {
                const a = startA + (s / segments) * wedge;
                arcPoints.push(new THREE.Vector3(
                    Math.cos(a) * CONFIG.SECTOR_INNER_RADIUS * 0.82,
                    -1,
                    Math.sin(a) * CONFIG.SECTOR_INNER_RADIUS * 0.82
                ));
            }
            // Outer arc
            const outerArc = [];
            for (let s = 0; s <= segments; s++) {
                const a = startA + (s / segments) * wedge;
                outerArc.push(new THREE.Vector3(
                    Math.cos(a) * (CONFIG.SECTOR_OUTER_RADIUS + 10),
                    -1,
                    Math.sin(a) * (CONFIG.SECTOR_OUTER_RADIUS + 10)
                ));
            }

            const lineMat = new THREE.LineBasicMaterial({ color: 0x8b7520, transparent: true, opacity: 0.18 });
            const innerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints), lineMat);
            const outerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outerArc), lineMat);

            // Side lines connecting inner and outer at wedge edges
            const sideLine1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                arcPoints[0], outerArc[0]
            ]), lineMat);
            const sideLine2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                arcPoints[arcPoints.length-1], outerArc[outerArc.length-1]
            ]), lineMat);

            const group = new THREE.Group();
            group.add(innerLine, outerLine, sideLine1, sideLine2);
            group.userData = { sectorId: sector.id };
            this.scene.add(group);

            // ── Sector label (sprite at mid-radius, at the wedge center angle) ──
            const labelRadius = CONFIG.SECTOR_INNER_RADIUS * 0.72;
            const label = this._makeSectorLabel(sector.name);
            label.position.set(
                Math.cos(centerAngle) * labelRadius,
                2,
                Math.sin(centerAngle) * labelRadius
            );
            this.scene.add(label);

            this.sectorRings.push({ group, label, sectorId: sector.id });
        });
    }

    _makeSectorLabel(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(212,175,55,0.85)';
        ctx.font = 'bold 22px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            depthWrite: false
        }));
        sprite.scale.set(18, 4.5, 1);
        return sprite;
    }

    clearSectorVisuals() {
        this.sectorRings.forEach(({ group, label }) => {
            this.scene.remove(group);
            this.scene.remove(label);
        });
        this.sectorRings = [];
    }

    /** Highlight one sector's boundary lines (brighten + thicken) */
    setSectorHighlight(sectorId) {
        this.sectorRings.forEach(({ group, sectorId: sid }) => {
            const isActive = sid === sectorId;
            group.children.forEach(child => {
                if (child.material) {
                    child.material.opacity = isActive ? 0.55 : 0.18;
                    child.material.color.setHex(isActive ? 0xd4af37 : 0x8b7520);
                }
            });
        });
        this.highlightedSector = sectorId;
    }

    clearSectorHighlight() {
        this.setSectorHighlight(null);
    }

    // ── Planets ──────────────────────────────────────────────────────────

    createPlanetMesh(planet) {
        const typeInfo = PLANET_TYPES[planet.type];
        let geometry, material;

        if (planet.type === 'DESTROYED') {
            geometry = new THREE.DodecahedronGeometry(2.2, 0);
            material = new THREE.MeshStandardMaterial({ color:typeInfo.color, emissive:0x220000, emissiveIntensity:0.3, roughness:0.95, metalness:0.1 });
        } else {
            geometry = new THREE.SphereGeometry(3, 32, 32);
            material = new THREE.MeshStandardMaterial({ color:typeInfo.color, emissive:typeInfo.color, emissiveIntensity:0.2, roughness:0.7, metalness:0.3 });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(planet.position.x, planet.position.y, planet.position.z);
        mesh.userData = { planetId: planet.id };

        // Glow sphere
        mesh.add(new THREE.Mesh(
            new THREE.SphereGeometry(planet.type === 'DESTROYED' ? 3.0 : 3.5, 32, 32),
            new THREE.MeshBasicMaterial({ color: typeInfo.color, transparent: true, opacity: 0.2, side: THREE.BackSide })
        ));

        if (planet.type === 'DESTROYED') this._addDebrisCloud(mesh);

        if (planet.owner && window.app?.factionManager) {
            const faction = window.app.factionManager.getById(planet.owner);
            if (faction) this.addFactionSymbol(mesh, faction);
        }

        if (planet.battleStatus !== BATTLE_STATUS.NONE) this.addBattleIndicator(mesh, planet.battleStatus);

        this.scene.add(mesh);
        this.planetMeshes.set(planet.id, mesh);
        return mesh;
    }

    _addDebrisCloud(parentMesh) {
        const geo = new THREE.BufferGeometry();
        const verts = [];
        for (let i = 0; i < 60; i++) {
            const r = 2.5 + Math.random() * 2.5;
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            verts.push(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi));
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        parentMesh.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:0x887766, size:0.7, transparent:true, opacity:0.7 })));
    }

    addFactionSymbol(planetMesh, faction) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Add glow effect
        ctx.shadowColor = faction.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = faction.color;
        ctx.font = 'bold 140px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(faction.symbol, 128, 128);
        
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
        sprite.scale.set(8, 8, 1);
        sprite.position.y = 6;
        planetMesh.add(sprite);
    }

    addBattleIndicator(planetMesh, status) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(4, 5, 32),
            new THREE.MeshBasicMaterial({ color: status === BATTLE_STATUS.SIEGE ? 0xff0000 : 0xff8c00, transparent:true, opacity:0.6, side:THREE.DoubleSide })
        );
        ring.rotation.x = Math.PI / 2;
        planetMesh.add(ring);
        planetMesh.userData.battleRing = ring;
    }

    updatePlanetMesh(planet) {
        const mesh = this.planetMeshes.get(planet.id);
        if (!mesh) return;
        while (mesh.children.length > 1) mesh.remove(mesh.children[mesh.children.length - 1]);
        if (planet.type === 'DESTROYED') this._addDebrisCloud(mesh);
        if (planet.owner && window.app?.factionManager) {
            const f = window.app.factionManager.getById(planet.owner);
            if (f) this.addFactionSymbol(mesh, f);
        }
        if (planet.battleStatus !== BATTLE_STATUS.NONE) this.addBattleIndicator(mesh, planet.battleStatus);
    }

    removePlanetMesh(planetId) {
        const mesh = this.planetMeshes.get(planetId);
        if (mesh) { this.scene.remove(mesh); this.planetMeshes.delete(planetId); }
    }

    // ── Connections ──────────────────────────────────────────────────────

    createConnectionLine(planet1, planet2, isWormhole = false) {
        const key = this.getConnectionKey(planet1.id, planet2.id);
        
        const points = [
            new THREE.Vector3(planet1.position.x, planet1.position.y, planet1.position.z),
            new THREE.Vector3(planet2.position.x, planet2.position.y, planet2.position.z)
        ];
        
        // Create curve and tube geometry for thickness
        const curve = new THREE.LineCurve3(points[0], points[1]);
        const geometry = new THREE.TubeGeometry(curve, 1, this.connectionThickness * 0.1, 8, false);
        
        const mat = new THREE.MeshBasicMaterial({
            color: isWormhole ? 0x00ffff : this.connectionColor,
            transparent: true,
            opacity: isWormhole ? 0.8 : 0.4
        });
        
        const line = new THREE.Mesh(geometry, mat);
        line.visible = this.connectionsVisible;
        line.userData = { isWormhole }; // Store flag for color updates
        this.scene.add(line);
        this.connectionLines.set(key, line);
        return line;
    }

    removeConnectionLine(id1, id2) {
        const key = this.getConnectionKey(id1, id2);
        const line = this.connectionLines.get(key);
        if (line) { this.scene.remove(line); this.connectionLines.delete(key); }
    }

    getConnectionKey(a, b) { return [a, b].sort().join('-'); }

    /** Toggle visibility of all connection lines */
    setConnectionsVisible(visible) {
        this.connectionsVisible = visible;
        this.connectionLines.forEach(line => { line.visible = visible; });
    }

    /** Set app reference after initialization */
    setApp(app) {
        this.app = app;
    }

    /** Update connection line thickness */
    setConnectionThickness(thickness) {
        const newThickness = Math.max(1, Math.min(10, thickness));
        
        // If thickness hasn't changed, don't recreate
        if (this.connectionThickness === newThickness) {
            return;
        }
        
        this.connectionThickness = newThickness;
        
        // Safety check for galaxy render
        if (!this.app || !this.app.galaxy) {
            if (window.DEBUG) {
                console.warn('Galaxy not available for connection thickness update');
            }
            return;
        }
        
        // Clear all existing connection lines
        this.connectionLines.forEach((line) => {
            if (line && line.geometry) {
                line.geometry.dispose();
            }
            if (line && line.material) {
                line.material.dispose();
            }
            this.scene.remove(line);
        });
        this.connectionLines.clear();
        
        // Recreate all connection lines with new thickness
        this.app.galaxy.planets.forEach(planet => {
            planet.connections.forEach(connectedId => {
                const connectedPlanet = this.app.galaxy.getPlanet(connectedId);
                if (connectedPlanet && planet.id < connectedId) { // Avoid duplicates
                    this.createConnectionLine(planet, connectedPlanet);
                }
            });
        });
        
        // Recreate wormhole connections
        if (this.app.galaxy.eventManager) {
            this.app.galaxy.eventManager.getByEffect('creates_route').forEach(wormhole => {
                const planet1 = this.app.galaxy.getPlanet(wormhole.planetId);
                const planet2 = this.app.galaxy.getPlanet(wormhole.targetPlanetId);
                if (planet1 && planet2) {
                    this.createConnectionLine(planet1, planet2, true);
                }
            });
        }
    }

    /** Update galaxy center brightness */
    setGalaxyCenterBrightness(brightness) {
        const newBrightness = Math.max(0, Math.min(1000, brightness));
        
        // If brightness hasn't changed, don't update
        if (this.galaxyCenterBrightness === newBrightness) {
            return;
        }
        
        this.galaxyCenterBrightness = newBrightness;
        
        // Update the center light intensity if it exists
        if (this.centerLight) {
            const intensity = (newBrightness / 100) * 1.0;
            this.centerLight.intensity = intensity;
        }
    }

    /** Update connection line color */
    setConnectionColor(color) {
        // Convert hex color to integer
        const colorInt = parseInt(color.replace('#', '0x'), 16);
        
        // If color hasn't changed, don't update
        if (this.connectionColor === colorInt) {
            return;
        }
        
        this.connectionColor = colorInt;
        
        // Recreate all connection lines with new color
        this._updateConnectionColors();
    }

    /** Update all connection line colors */
    _updateConnectionColors() {
        this.connectionLines.forEach((line, key) => {
            if (line && line.material) {
                if (line.userData && line.userData.isWormhole) {
                    line.material.color.setHex(0x00ffff);
                } else {
                    // Update regular connection with GM color
                    line.material.color.setHex(this.connectionColor);
                }
                line.material.needsUpdate = true;
            }
        });
    }

    // ── Connection editor highlights ────────────────────────────────────

    /** Show a pulsing ring around a planet during connection-edit mode */
    addConnEditorHighlight(planetId) {
        const mesh = this.planetMeshes.get(planetId);
        if (!mesh) return;
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(4.5, 5.2, 32),
            new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
        );
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2;
        ring.userData = { connEditorRing: true, planetId };
        this.scene.add(ring);
        this.connEditorHighlights.push(ring);
    }

    clearConnEditorHighlights() {
        this.connEditorHighlights.forEach(r => this.scene.remove(r));
        this.connEditorHighlights = [];
    }

    // ── Event rings ──────────────────────────────────────────────────────

    createEventRing(event, planet) {
        const typeInfo = event.getTypeInfo();
        const rgb = hexToRgb(typeInfo.color);
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(5, 6, 32),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(rgb.r/255, rgb.g/255, rgb.b/255),
                transparent: true, opacity: 0.7, side: THREE.DoubleSide
            })
        );
        ring.position.set(planet.position.x, planet.position.y, planet.position.z);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
        if (!this.eventParticles.has(event.id)) this.eventParticles.set(event.id, []);
        this.eventParticles.get(event.id).push(ring);
        return ring;
    }

    removeEventRing(eventId) {
        const rings = this.eventParticles.get(eventId);
        if (rings) {
            (Array.isArray(rings) ? rings : [rings]).forEach(r => { if (r) this.scene.remove(r); });
            this.eventParticles.delete(eventId);
        }
    }

    // ── Ships ────────────────────────────────────────────────────────────

    createShipMesh(ship) {
        const faction = window.app?.factionManager?.getById(ship.factionId);
        const color   = faction ? parseInt(faction.color.replace('#',''), 16) : 0xaaaaaa;
        const shape   = ship.shape || 'octahedron'; // Default to octahedron

        // Create geometry based on ship shape
        let geometry;
        let additionalParts = [];
        
        // Placeholder for future additional parts
        //const placeholderGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        //additionalParts.push({ geometry: cubeCornerGeo, position: [1.2, 1.2, 1.2], scale: [1, 1, 1] });
        
        switch (shape) {
            case 'tetrahedron':
                geometry = new THREE.TetrahedronGeometry(1.5, 0);
                break;
            case 'cube':
                geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(1.2, 0);
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(1.0, 0);
                break;
            case 'icosahedron':
                geometry = new THREE.IcosahedronGeometry(1.2, 0);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(1.2, 16, 12);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(1.0, 2.0, 8);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(1.2, 0.4, 8, 16);
                break;
            case 'capsule':
                geometry = new THREE.CapsuleGeometry(0.8, 1.5, 4, 8);
                break;
            case 'pyramid':
                geometry = new THREE.ConeGeometry(1.2, 2.0, 4); // Square base pyramid
                break;
            case 'prism':
                geometry = new THREE.BoxGeometry(1.0, 2.0, 1.5); // Rectangular prism
                break;
            case 'ring':
                geometry = new THREE.TorusGeometry(1.5, 0.2, 8, 16); // Thin ring
                break;
            case 'tube':
                geometry = new THREE.CylinderGeometry(0.6, 0.6, 3.0, 12); // Long tube
                break;
            default:
                geometry = new THREE.OctahedronGeometry(1.2, 0);
                break;
        }
        
        const mat = new THREE.MeshStandardMaterial({ 
            color, 
            emissive: color, 
            emissiveIntensity: 0.6, 
            roughness: 0.2, 
            metalness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, mat);
        
        // Apply rotation if specified
        const rotationY = (ship.rotationY || 0) * Math.PI / 180;
        mesh.rotation.y = rotationY;
        
        // Apply size scaling if specified
        const size = ship.size || 1;
        mesh.scale.set(size, size, size);
        
        // Create additional parts
        additionalParts.forEach(part => {
            const partMesh = new THREE.Mesh(part.geometry, mat);
            partMesh.position.set(...part.position);
            partMesh.scale.set(...part.scale);
            mesh.add(partMesh);
        });
        
        // Add faction symbol as small sprite positioned above
        const symbolCanvas = document.createElement('canvas');
        symbolCanvas.width = 32; symbolCanvas.height = 32;
        const ctx = symbolCanvas.getContext('2d');
        ctx.fillStyle = faction ? faction.color : '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(faction?.symbol || '⚔', 16, 16);
        
        const symbol = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(symbolCanvas), 
            transparent: true
        }));
        symbol.scale.set(3, 3, 1);
        symbol.position.y = 2.0; // Position above ship
        mesh.add(symbol);

        // Engine glow effect
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 64; glowCanvas.height = 64;
        const glowCtx = glowCanvas.getContext('2d');
        const grad = glowCtx.createRadialGradient(32,32,0,32,32,32);
        grad.addColorStop(0, 'rgba(255,200,100,0.9)');
        grad.addColorStop(0.5, 'rgba(255,150,50,0.5)');
        grad.addColorStop(1, 'rgba(255,100,0,0)');
        glowCtx.fillStyle = grad;
        glowCtx.fillRect(0,0,64,64);
        
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(glowCanvas), 
            transparent: true 
        }));
        glow.scale.set(1.8, 1.8, 1);
        glow.position.y = -1.0;
        mesh.add(glow);

        const group = new THREE.Group();
        group.add(mesh);
        group.userData = { shipId: ship.id };
        this.scene.add(group);
        this.shipMeshes.set(ship.id, { group, bobPhase: Math.random() * Math.PI * 2 });
        this._positionShipMesh(ship);
        return group;
    }

    _positionShipMesh(ship) {
        const entry = this.shipMeshes.get(ship.id);
        if (!entry) return;
        const planet = window.app?.galaxy?.getPlanet(ship.planetId);
        if (!planet) return;
        
        const shipsOnPlanet = (window.app?.galaxy?.ships || []).filter(s => s.planetId === ship.planetId);
        const idx = shipsOnPlanet.findIndex(s => s.id === ship.id);
        
        // Position ships in a circle around the planet
        const angle = (idx / Math.max(shipsOnPlanet.length, 1)) * Math.PI * 2;
        const radius = 10.0 + (idx % 2) * 6; // Alternate between inner and outer ring
        
        const offsetX = Math.cos(angle) * radius;
        const offsetZ = Math.sin(angle) * radius;
        const offsetY = 2.0 + (idx % 2) * 1.0; // Height variation
        
        entry.group.position.set(
            planet.position.x + offsetX, 
            planet.position.y + offsetY, 
            planet.position.z + offsetZ
        );
        
        // Make ships face outward from planet
        entry.group.lookAt(
            planet.position.x + offsetX * 2,
            planet.position.y + offsetY,
            planet.position.z + offsetZ * 2
        );
    }

    updateShipMesh(ship) {
        // Remove existing mesh and recreate with new shape
        const entry = this.shipMeshes.get(ship.id);
        if (entry) {
            this.scene.remove(entry.group);
            this.shipMeshes.delete(ship.id);
        }
        
        // Create new mesh with current shape
        this.createShipMesh(ship);
    }

    removeShipMesh(shipId) {
        const entry = this.shipMeshes.get(shipId);
        if (entry) { this.scene.remove(entry.group); this.shipMeshes.delete(shipId); }
    }

    highlightMoveTargets(targetPlanetIds, useGreen = true) {
        this.clearMoveTargetHighlights();
        targetPlanetIds.forEach(id => {
            const mesh = this.planetMeshes.get(id);
            if (!mesh) return;
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(4.5, 5.2, 32),
                new THREE.MeshBasicMaterial({ 
                    color: useGreen ? 0x00ff00 : 0x0088ff, 
                    transparent: true, 
                    opacity: 0.6, 
                    side: THREE.DoubleSide 
                })
            );
            ring.position.copy(mesh.position);
            ring.rotation.x = Math.PI / 2;
            ring.userData = { planetId: id, isTarget: true };
            this.scene.add(ring);
            this.moveTargetRings.push(ring);
        });
    }

    updateTargetHighlight(planetId, isGreen) {
        // Find the ring for specific planet
        const ring = this.moveTargetRings.find(r => r.userData.planetId === planetId);
        if (ring && ring.material) {
            ring.material.color.set(isGreen ? 0x00ff00 : 0x0088ff);
        }
    }

    clearMoveTargetHighlights() {
        this.moveTargetRings.forEach(r => this.scene.remove(r));
        this.moveTargetRings = [];
    }

    // ── Camera ───────────────────────────────────────────────────────────

    updateCameraPosition() {
        let center = { x: 0, y: 0, z: 0 };
        if (this.selectedPlanet) {
            const m = this.planetMeshes.get(this.selectedPlanet);
            if (m) center = { x: m.position.x, y: m.position.y, z: m.position.z };
        } else if (this.selectedGalaxyCenter) {
            // Galaxy center
            center = { x: 0, y: 0, z: 0 };
        }
        const x = this.cameraDistance * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
        const y = this.cameraDistance * Math.sin(this.cameraRotation.x);
        const z = this.cameraDistance * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
        this.camera.position.set(x + center.x + this.cameraPosition.x, y + center.y + this.cameraPosition.y, z + center.z + this.cameraPosition.x * 0.5);
        this.camera.lookAt(center.x, center.y, center.z);
    }

    // ── Input ────────────────────────────────────────────────────────────
    setupEventListeners() {
        this.canvas.addEventListener('mousedown',  e => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove',  e => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup',    () => this.onMouseUp());
        this.canvas.addEventListener('wheel',      e => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('click',      e => this.onClick(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.previousMouse = { x: e.clientX, y: e.clientY };
        this.dragMode = e.button === 2 ? 'rotate' : null;
    }
    onMouseMove(e) {
        if (!this.isDragging || !this.dragMode) return;
        const dx = e.clientX - this.previousMouse.x;
        const dy = e.clientY - this.previousMouse.y;
        if (this.dragMode === 'rotate') {
            this.cameraRotation.y += dx * 0.005;
            this.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotation.x + dy * 0.005));
        }
        this.updateCameraPosition();
        this.previousMouse = { x: e.clientX, y: e.clientY };
    }
    onMouseUp() { this.isDragging = false; this.dragMode = null; }
    onWheel(e) {
        e.preventDefault();
        this.cameraDistance = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, this.cameraDistance + e.deltaY * CONFIG.ZOOM_SPEED));
        this.updateCameraPosition();
    }

    onClick(e) {
        if (this.isDragging) return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Check galaxy center
        const centerMeshes = this.centerGroup ? this.centerGroup.children.filter(child => child.geometry) : [];
        const centerHits = this.raycaster.intersectObjects(centerMeshes);
        if (centerHits.length > 0) {
            this.selectGalaxyCenter();
            return;
        }

        // Check planets
        const meshes = Array.from(this.planetMeshes.values());
        const hits = this.raycaster.intersectObjects(meshes);
        if (hits.length > 0) {
            const planetId = hits[0].object.userData.planetId;
            this.selectPlanet(planetId);

            // Connection editor intercept
            if (window.app?.ui?.connectionEditorActive) {
                window.app.ui.handleConnEditorClick(planetId);
                return;
            }

            // Ship move intercept
            if (window.app?.ui?.selectedShipId) {
                const targets = window.app.galaxy.getValidMoveTargets(window.app.ui.selectedShipId);
                if (targets.includes(planetId)) {
                    window.app.ui.executeShipMove(planetId);
                    return;
                }
            }
        } else {
            // Click on empty space -> deselect and center on galaxy center
            this.deselectAll();
        }
    }

    toggleAutoRotation() { this.autoRotate = !this.autoRotate; return this.autoRotate; }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }
    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - this.previousMouse.x;
        const dy = e.touches[0].clientY - this.previousMouse.y;
        this.cameraRotation.y += dx * 0.005;
        this.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotation.x + dy * 0.005));
        this.updateCameraPosition();
        this.previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    onTouchEnd() { this.isDragging = false; }

    selectPlanet(planetId) {
        this.selectedPlanet = planetId;
        this.selectedGalaxyCenter = false;
        this.planetMeshes.forEach((mesh, id) => mesh.scale.set(id === planetId ? 1.3 : 1, id === planetId ? 1.3 : 1, id === planetId ? 1.3 : 1));
        // Reset galaxy center scale
        if (this.centerGroup) {
            this.centerGroup.scale.set(1, 1, 1);
        }
        window.dispatchEvent(new CustomEvent('planetSelected', { detail: { planetId } }));
    }

    selectGalaxyCenter() {
        this.selectedPlanet = null;
        this.selectedGalaxyCenter = true;
        // Reset all planet scales
        this.planetMeshes.forEach(mesh => mesh.scale.set(1, 1, 1));
        // Scale up galaxy center
        if (this.centerGroup) {
            this.centerGroup.scale.set(1.2, 1.2, 1.2);
        }
        window.dispatchEvent(new CustomEvent('galaxyCenterSelected', { detail: {} }));
    }

    deselectAll() {
        this.selectedPlanet = null;
        this.selectedGalaxyCenter = false;
        // Reset all scales
        this.planetMeshes.forEach(mesh => mesh.scale.set(1, 1, 1));
        if (this.centerGroup) {
            this.centerGroup.scale.set(1, 1, 1);
        }
        window.dispatchEvent(new CustomEvent('deselectedAll', { detail: {} }));
    }

    onResize() {
        const w = this.canvas.parentElement.clientWidth;
        const h = this.canvas.parentElement.clientHeight;
        
        // Only resize with valid dimensions
        if (w > 0 && h > 0) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            
            // Force render after resize
            if (this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    // Force resize and render
    forceResize() {
        this.onResize();
        this.updateCameraPosition();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // ── Animation loop ──────────────────────────────────────────────────

    animate() {
        requestAnimationFrame(() => this.animate());
        const t = Date.now();

        if (!this.isDragging && this.autoRotate) {
            this.cameraRotation.y += CONFIG.CAMERA_ROTATION_SPEED;
            this.updateCameraPosition();
        }

        // Battle-ring pulse
        this.planetMeshes.forEach(mesh => {
            if (mesh.userData.battleRing) {
                mesh.userData.battleRing.rotation.z += 0.01;
                mesh.userData.battleRing.material.opacity = 0.3 + Math.sin(t * 0.003) * 0.3;
            }
        });

        // Event-ring spin
        this.eventParticles.forEach(rings => {
            (Array.isArray(rings) ? rings : [rings]).forEach(r => {
                if (r) { r.rotation.z += 0.005; r.material.opacity = 0.4 + Math.sin(t * 0.002) * 0.3; }
            });
        });

        // Ship orbital animation around planets
        const tSec = t / 1000;
        this.shipMeshes.forEach(({ group, bobPhase }) => {
            // Get the ship data to find its planet
            const shipId = group.userData.shipId;
            const ship = window.app?.galaxy?.ships?.find(s => s.id === shipId);
            if (!ship) return;
            
            const planet = window.app?.galaxy?.getPlanet(ship.planetId);
            if (!planet) return;
            
            const shipsOnPlanet = (window.app?.galaxy?.ships || []).filter(s => s.planetId === ship.planetId);
            const idx = shipsOnPlanet.findIndex(s => s.id === shipId);
            
            // Calculate orbital position
            const orbitRadius = 6 + (idx % 2) * 3.5; // Match positioning radius
            const orbitSpeed = 0.2 + (idx % 3) * 0.1; // Different speeds
            const angle = (tSec * orbitSpeed + bobPhase) % (Math.PI * 2);
            
            const offsetX = Math.cos(angle) * orbitRadius;
            const offsetZ = Math.sin(angle) * orbitRadius;
            const offsetY = 2.0 + (idx % 2) * 1.0;
            
            // Update position to orbit around planet
            group.position.set(
                planet.position.x + offsetX,
                planet.position.y + offsetY,
                planet.position.z + offsetZ
            );
            
            // Make ship face direction of movement
            group.lookAt(
                planet.position.x + Math.cos(angle + 0.1) * orbitRadius * 2,
                planet.position.y + offsetY,
                planet.position.z + Math.sin(angle + 0.1) * orbitRadius * 2
            );
            
            // Pulse engine glow
            const glow = group.children[0]?.children.find(child => child instanceof THREE.Sprite);
            if (glow && glow.material) {
                const pulseIntensity = 0.8 + Math.sin((tSec * 2 + bobPhase) * Math.PI * 2) * 0.2;
                glow.material.opacity = pulseIntensity;
            }
        });

        // Black-hole accretion disc spin
        if (this.centerGroup.userData?.accretionDisc) {
            this.centerGroup.userData.accretionDisc.rotation.z = tSec * 0.3;
        }

        // Move-target ring pulse
        this.moveTargetRings.forEach(r => { r.material.opacity = 0.5 + Math.sin(t * 0.005) * 0.25; });

        // Conn-editor ring pulse
        this.connEditorHighlights.forEach(r => { r.material.opacity = 0.5 + Math.sin(t * 0.008) * 0.3; });

        // Update compass for GM
        if (window.app?.ui?.updateCompass) {
            window.app.ui.updateCompass();
        }

        this.renderer.render(this.scene, this.camera);
    }

    // ── Clear ────────────────────────────────────────────────────────────
    clear() {
        this.planetMeshes.forEach(m => this.scene.remove(m));
        this.planetMeshes.clear();
        this.connectionLines.forEach(l => this.scene.remove(l));
        this.connectionLines.clear();
        this.eventParticles.forEach(rings => (Array.isArray(rings)?rings:[rings]).forEach(r => { if(r) this.scene.remove(r); }));
        this.eventParticles.clear();
        this.shipMeshes.forEach(({ group }) => this.scene.remove(group));
        this.shipMeshes.clear();
        this.clearMoveTargetHighlights();
        this.clearConnEditorHighlights();
        this.clearSectorVisuals();
    }
}
