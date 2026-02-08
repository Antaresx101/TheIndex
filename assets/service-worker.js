// service-worker.js - PWA offline functionality

const CACHE_NAME = 'the-index-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/assets/manifest.json',
    '/js/app.js',
    '/js/galaxy.js',
    '/js/renderer.js',
    '/js/ui.js',
    '/js/planetValues.js',
    '/config/constants.js',
    '/modules/EventSystem.js',
    '/modules/FactionSystem.js',
    '/modules/GalacticOrderSystem.js',
    '/modules/Planet.js',
    '/modules/ResourceSystem.js',
    '/modules/ShipSystem.js',
    '/modules/ShopSystem.js',
    '/modules/StratagemSystem.js',
    '/services/StorageService.js',
    '/utils/helpers.js',
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache)
                    .catch((error) => {
                        console.warn('Failed to cache some resources:', error);
                        // Try to cache essential files individually
                        return Promise.allSettled(
                            urlsToCache.map(url => {
                                return cache.add(url).catch(err => {
                                    console.warn(`Failed to cache ${url}:`, err);
                                });
                            })
                        );
                    });
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone response
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
