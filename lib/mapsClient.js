/**
 * ========================================
 * AIONUS - GOOGLE MAPS CLIENT
 * ========================================
 * Map initialization and location search
 */

import { getEnv, isConfigured } from '../config/env.js';

// Map instance
let mapInstance = null;
let mapsLoaded = false;

// ========================================
// MAPS LOADER
// ========================================

/**
 * Load Google Maps JavaScript API
 * @returns {Promise<boolean>} Whether maps loaded successfully
 */
async function loadMapsAPI() {
    if (mapsLoaded) return true;

    if (!isConfigured('maps')) {
        console.warn('⚠️ Maps API key not configured. Using embedded map fallback.');
        return false;
    }

    const apiKey = getEnv('MAPS_API_KEY');

    return new Promise((resolve) => {
        // Check if already loaded
        if (window.google?.maps) {
            mapsLoaded = true;
            resolve(true);
            return;
        }

        // Create script tag
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;

        // Global callback
        window.initGoogleMaps = () => {
            mapsLoaded = true;
            console.log('✅ Google Maps API loaded');
            resolve(true);
        };

        script.onerror = () => {
            console.error('❌ Failed to load Google Maps API');
            resolve(false);
        };

        document.head.appendChild(script);
    });
}

// ========================================
// MAP INITIALIZATION
// ========================================

/**
 * Initialize Google Map in container
 * @param {HTMLElement|string} container - Container element or ID
 * @param {Object} options - Map options
 * @returns {Object|null} Map instance or null
 */
async function initMap(container, options = {}) {
    const loaded = await loadMapsAPI();

    if (!loaded) {
        console.warn('⚠️ Cannot initialize map - API not loaded');
        return null;
    }

    const containerEl = typeof container === 'string'
        ? document.getElementById(container)
        : container;

    if (!containerEl) {
        console.error('❌ Map container not found');
        return null;
    }

    // Default options (Dubai center)
    const defaultOptions = {
        center: { lat: 25.2048, lng: 55.2708 },
        zoom: 11,
        styles: getMapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true
    };

    const mapOptions = { ...defaultOptions, ...options };

    try {
        mapInstance = new google.maps.Map(containerEl, mapOptions);
        console.log('✅ Map initialized');
        return mapInstance;
    } catch (error) {
        console.error('❌ Map initialization error:', error);
        return null;
    }
}

/**
 * Get current map instance
 */
function getMap() {
    return mapInstance;
}

// ========================================
// MARKERS
// ========================================

/**
 * Add marker to map
 * @param {Object} position - { lat, lng }
 * @param {Object} options - Marker options
 * @returns {Object|null} Marker instance
 */
function addMarker(position, options = {}) {
    if (!mapInstance) {
        console.warn('⚠️ Map not initialized');
        return null;
    }

    const markerOptions = {
        position,
        map: mapInstance,
        title: options.title || '',
        ...options
    };

    return new google.maps.Marker(markerOptions);
}

/**
 * Add property markers to map
 * @param {Array} properties - Array of properties with location data
 * @returns {Array} Array of markers
 */
function addPropertyMarkers(properties) {
    if (!mapInstance) {
        console.warn('⚠️ Map not initialized');
        return [];
    }

    const markers = [];

    // Dubai community coordinates
    const communityCoords = {
        'Palm Jumeirah': { lat: 25.1124, lng: 55.1390 },
        'Downtown Dubai': { lat: 25.1972, lng: 55.2744 },
        'Dubai Marina': { lat: 25.0805, lng: 55.1403 },
        'Emirates Hills': { lat: 25.0657, lng: 55.1713 },
        'Arabian Ranches': { lat: 25.0574, lng: 55.2674 },
        'DAMAC Lagoons': { lat: 25.0123, lng: 55.2341 },
        'Jumeira Bay': { lat: 25.2166, lng: 55.2386 },
        'Dubai Harbour': { lat: 25.0886, lng: 55.1456 },
        'Dubai Creek Harbour': { lat: 25.2001, lng: 55.3379 },
        'Tilal Al Ghaf': { lat: 25.0099, lng: 55.2108 }
    };

    properties.forEach(property => {
        const coords = communityCoords[property.community] || { lat: 25.2048, lng: 55.2708 };

        const marker = addMarker(coords, {
            title: property.title,
            label: {
                text: `$${(property.price / 1000000).toFixed(1)}M`,
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 'bold'
            }
        });

        if (marker) {
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; max-width: 200px;">
                        <h4 style="margin: 0 0 8px; font-size: 14px;">${property.title}</h4>
                        <p style="margin: 0 0 4px; font-size: 12px; color: #666;">${property.community}</p>
                        <p style="margin: 0; font-size: 14px; font-weight: bold; color: #C41E3A;">
                            $${property.price.toLocaleString()}
                        </p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(mapInstance, marker);
            });

            markers.push(marker);
        }
    });

    return markers;
}

// ========================================
// LOCATION SEARCH
// ========================================

/**
 * Search for location using Places API
 * @param {string} query - Search query
 * @returns {Object} Search results
 */
async function searchLocation(query) {
    if (!mapsLoaded) {
        const loaded = await loadMapsAPI();
        if (!loaded) {
            return { results: [], error: 'Maps API not loaded' };
        }
    }

    return new Promise((resolve) => {
        const service = new google.maps.places.PlacesService(mapInstance || document.createElement('div'));

        service.textSearch(
            {
                query: `${query} Dubai`,
                type: ['real_estate_agency', 'point_of_interest']
            },
            (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve({
                        results: results.map(place => ({
                            name: place.name,
                            address: place.formatted_address,
                            location: {
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng()
                            },
                            placeId: place.place_id
                        })),
                        error: null
                    });
                } else {
                    resolve({ results: [], error: status });
                }
            }
        );
    });
}

/**
 * Get place details
 * @param {string} placeId - Google Place ID
 * @returns {Object} Place details
 */
async function getPlaceDetails(placeId) {
    if (!mapsLoaded) {
        return { place: null, error: 'Maps API not loaded' };
    }

    return new Promise((resolve) => {
        const service = new google.maps.places.PlacesService(mapInstance || document.createElement('div'));

        service.getDetails(
            {
                placeId,
                fields: ['name', 'formatted_address', 'geometry', 'photos', 'reviews', 'rating']
            },
            (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve({ place, error: null });
                } else {
                    resolve({ place: null, error: status });
                }
            }
        );
    });
}

// ========================================
// GEOCODING
// ========================================

/**
 * Geocode address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Object} Coordinates
 */
async function geocodeAddress(address) {
    if (!mapsLoaded) {
        const loaded = await loadMapsAPI();
        if (!loaded) {
            return { location: null, error: 'Maps API not loaded' };
        }
    }

    return new Promise((resolve) => {
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                resolve({
                    location: {
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng()
                    },
                    formattedAddress: results[0].formatted_address,
                    error: null
                });
            } else {
                resolve({ location: null, error: status });
            }
        });
    });
}

// ========================================
// MAP STYLES (Premium Dark Theme)
// ========================================

function getMapStyles() {
    return [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
        },
        {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#38414e' }]
        },
        {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#212a37' }]
        },
        {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#746855' }]
        },
        {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#17263c' }]
        },
        {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#515c6d' }]
        }
    ];
}

// ========================================
// FALLBACK EMBED
// ========================================

/**
 * Get embedded map iframe (fallback when API not available)
 * @param {Object} options - Embed options
 * @returns {string} Iframe HTML
 */
function getEmbedMapHTML(options = {}) {
    const location = options.location || 'Dubai, UAE';
    const zoom = options.zoom || 11;

    return `
        <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d462560.68279754076!2d54.89782435247474!3d25.076280449498957!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f43496ad9c645%3A0xbde66e5084295162!2sDubai%20-%20United%20Arab%20Emirates!5e0!3m2!1sen!2s!4v1702000000000!5m2!1sen!2s"
            width="100%" 
            height="100%" 
            style="border:0; border-radius: 12px;" 
            allowfullscreen="" 
            loading="lazy" 
            referrerpolicy="no-referrer-when-downgrade">
        </iframe>
    `;
}

// Export all functions
export {
    loadMapsAPI,
    initMap,
    getMap,
    addMarker,
    addPropertyMarkers,
    searchLocation,
    getPlaceDetails,
    geocodeAddress,
    getMapStyles,
    getEmbedMapHTML
};

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadMapsAPI,
        initMap,
        getMap,
        addMarker,
        addPropertyMarkers,
        searchLocation,
        getPlaceDetails,
        geocodeAddress,
        getMapStyles,
        getEmbedMapHTML
    };
}
