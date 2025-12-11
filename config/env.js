/**
 * ========================================
 * AIONUS - ENVIRONMENT CONFIGURATION
 * ========================================
 * Central environment loader with validation
 * All services read config from here
 */

// Environment variables with defaults
const ENV = {
    // Supabase
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_BUCKET_NAME: 'brochures',

    // Gemini AI
    GEMINI_API_KEY: '',
    GEMINI_TTS_MODEL: 'gemini-2.0-flash',
    GEMINI_STT_MODEL: 'gemini-2.0-flash',

    // Google Maps
    MAPS_API_KEY: '',

    // RAG Pipeline
    EMBEDDING_MODEL: 'text-embedding-004'
};

/**
 * Load environment from .env file (for Node.js/bundler environments)
 * For browser, these will be injected at build time
 */
function loadEnv() {
    // Check if running in Node.js with process.env
    if (typeof process !== 'undefined' && process.env) {
        ENV.SUPABASE_URL = process.env.SUPABASE_URL || ENV.SUPABASE_URL;
        ENV.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY;
        ENV.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY;
        ENV.SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || ENV.SUPABASE_BUCKET_NAME;
        ENV.GEMINI_API_KEY = process.env.GEMINI_API_KEY || ENV.GEMINI_API_KEY;
        ENV.GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || ENV.GEMINI_TTS_MODEL;
        ENV.GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL || ENV.GEMINI_STT_MODEL;
        ENV.MAPS_API_KEY = process.env.MAPS_API_KEY || ENV.MAPS_API_KEY;
        ENV.EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || ENV.EMBEDDING_MODEL;
    }

    // Check if running in Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        ENV.SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ENV.SUPABASE_URL;
        ENV.SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY;
        ENV.SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY;
        ENV.GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ENV.GEMINI_API_KEY;
        ENV.MAPS_API_KEY = import.meta.env.VITE_MAPS_API_KEY || ENV.MAPS_API_KEY;
    }
}

/**
 * Validate required environment variables
 * Logs warnings for missing keys but doesn't throw
 */
function validateEnv() {
    const warnings = [];

    if (!ENV.GEMINI_API_KEY) {
        warnings.push('⚠️ Missing GEMINI_API_KEY - AI features will be disabled');
    }

    if (!ENV.SUPABASE_URL) {
        warnings.push('⚠️ Missing SUPABASE_URL - Database features will be disabled');
    }

    if (!ENV.SUPABASE_ANON_KEY) {
        warnings.push('⚠️ Missing SUPABASE_ANON_KEY - Database features will be disabled');
    }

    if (!ENV.MAPS_API_KEY) {
        warnings.push('⚠️ Missing MAPS_API_KEY - Using embedded map fallback');
    }

    // Log all warnings to console
    warnings.forEach(warning => console.warn(warning));

    return warnings.length === 0;
}

/**
 * Initialize environment
 */
function initEnv() {
    loadEnv();
    validateEnv();
    console.log('🔧 AIONUS Environment Loaded');
}

/**
 * Get environment variable
 * @param {string} key - Environment variable key
 * @returns {string} - Environment variable value
 */
function getEnv(key) {
    return ENV[key] || '';
}

/**
 * Check if a service is configured
 * @param {string} service - Service name ('supabase', 'gemini', 'maps')
 * @returns {boolean}
 */
function isConfigured(service) {
    switch (service) {
        case 'supabase':
            return !!(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
        case 'gemini':
            return !!ENV.GEMINI_API_KEY;
        case 'maps':
            return !!ENV.MAPS_API_KEY;
        default:
            return false;
    }
}

/**
 * Set environment variable (for runtime configuration)
 * @param {string} key - Environment variable key
 * @param {string} value - Environment variable value
 */
function setEnv(key, value) {
    if (ENV.hasOwnProperty(key)) {
        ENV[key] = value;
    }
}

// Export for ES Modules
export { ENV, initEnv, getEnv, setEnv, validateEnv, isConfigured };

// Export for CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENV, initEnv, getEnv, setEnv, validateEnv, isConfigured };
}

// Auto-initialize for browser
if (typeof window !== 'undefined') {
    window.AIONUSEnv = { ENV, initEnv, getEnv, setEnv, validateEnv, isConfigured };
}
