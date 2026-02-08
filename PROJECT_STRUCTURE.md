# Project Structure

## 📁 Folders

```
fileSystem/
├── 📄 index.html              # Main application entry point
├── 📄 styles.css              # Application styles
├── 📁 assets/                 # Static assets and PWA files
│   ├── favicon.png            # Application favicon
│   ├── icon-192.png           # PWA icon (192x192)
│   ├── icon-512.png           # PWA icon (512x512)
│   ├── manifest.json          # PWA manifest
│   └── service-worker.js      # Service worker for offline functionality
├── 📁 config/                 # Configuration files
│   └── constants.js           # Game constants, planet types, configuration
├── 📁 js/                     # Core JavaScript modules
│   ├── app.js                 # Main application controller and entry point
│   ├── galaxy.js              # Galaxy state management and operations
│   ├── renderer.js            # 3D rendering with Three.js
│   ├── ui.js                  # User interface management and interactions
│   └── planetValues.js        # Planet values and resources
├── 📁 modules/                # Specialized modules
│   ├── EventSystem.js         # Campaign event system
│   ├── FactionSystem.js       # Faction system and management
│   ├── GalacticOrderSystem.js # Galactic Orders system
│   ├── Planet.js              # Planet model and logic
│   ├── ResourceSystem.js      # Resource system
│   ├── ShipSystem.js          # Ship/fleet/station system
│   ├── ShopSystem.js          # Shop system
│   └── StratagemSystem.js     # Stratagem system
├── 📁 services/               # Services
│   └── StorageService.js      # Storage system and localStorage management
├── 📁 utils/                  # Utility functions
│   └── helpers.js             # Helper utilities and functions
```

## 📁 Folders
```
app.js (entry point)
├── galaxy.js
├── renderer.js  
├── ui.js
└── StorageService.js

galaxy.js
├── modules/FactionSystem.js
├── modules/Planet.js
├── modules/ResourceSystem.js
└── services/StorageService.js

ui.js
├── modules/FactionSystem.js
├── modules/ShopSystem.js
├── services/StorageService.js
└── utils/helpers.js

renderer.js
├── config/constants.js
└── modules/Planet.js
```