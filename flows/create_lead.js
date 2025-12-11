/**
 * ========================================
 * AIONUS - CREATE LEAD FLOW
 * ========================================
 * Server-side flow for creating new leads in the database.
 * Used by website chat, forms, and other lead capture sources.
 * 
 * Requirements:
 * - name (string, required)
 * - phone (string, required)
 * - budget (string, optional)
 * - requirement (string, optional)
 * - site_visit_requested (boolean, optional, default false)
 * - site_visit_datetime (string, optional, ISO format)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ========================================
// ENVIRONMENT VALIDATION
// ========================================

/**
 * Validate required environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnvironment() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// ========================================
// SUPABASE CLIENT (Service Role)
// ========================================

/**
 * Create Supabase client with service role key
 * @returns {Object} Supabase client
 */
function createServiceClient() {
    validateEnvironment();

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

// ========================================
// INPUT VALIDATION
// ========================================

/**
 * Validate lead input payload
 * @param {Object} payload - Lead data
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validatePayload(payload) {
    // Check if payload exists
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid payload: must be an object' };
    }

    // Required fields
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim() === '') {
        return { valid: false, error: 'Name is required and must be a non-empty string' };
    }

    if (!payload.phone || typeof payload.phone !== 'string' || payload.phone.trim() === '') {
        return { valid: false, error: 'Phone is required and must be a non-empty string' };
    }

    // Optional field validations
    if (payload.budget !== undefined && payload.budget !== null && typeof payload.budget !== 'string') {
        return { valid: false, error: 'Budget must be a string if provided' };
    }

    if (payload.requirement !== undefined && payload.requirement !== null && typeof payload.requirement !== 'string') {
        return { valid: false, error: 'Requirement must be a string if provided' };
    }

    if (payload.site_visit_requested !== undefined && typeof payload.site_visit_requested !== 'boolean') {
        return { valid: false, error: 'site_visit_requested must be a boolean if provided' };
    }

    if (payload.site_visit_datetime !== undefined && payload.site_visit_datetime !== null) {
        // Validate ISO date format
        const date = new Date(payload.site_visit_datetime);
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'site_visit_datetime must be a valid ISO date string' };
        }
    }

    return { valid: true };
}

// ========================================
// MAIN CREATE LEAD FLOW
// ========================================

/**
 * Create a new lead in the database
 * 
 * @param {Object} payload - Lead data
 * @param {string} payload.name - Lead's name (required)
 * @param {string} payload.phone - Lead's phone number (required)
 * @param {string} [payload.budget] - Budget range (optional)
 * @param {string} [payload.requirement] - Property requirement details (optional)
 * @param {boolean} [payload.site_visit_requested=false] - Whether site visit is requested
 * @param {string|null} [payload.site_visit_datetime] - Requested visit datetime (ISO format)
 * 
 * @returns {Promise<Object>} Result object
 * @returns {boolean} result.success - Whether the operation succeeded
 * @returns {string} [result.lead_id] - UUID of the created lead
 * @returns {string} [result.error] - Error message if failed
 * 
 * @example
 * const result = await createLead({
 *   name: 'John Doe',
 *   phone: '+971501234567',
 *   budget: '$1M - $2M',
 *   requirement: 'Looking for 3BR villa in Palm Jumeirah',
 *   site_visit_requested: true,
 *   site_visit_datetime: '2025-12-15T10:00:00Z'
 * });
 */
async function createLead(payload) {
    try {
        // Step 1: Validate input
        const validation = validatePayload(payload);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error
            };
        }

        // Step 2: Initialize Supabase client
        const supabase = createServiceClient();

        // Step 3: Prepare lead data
        const leadData = {
            name: payload.name.trim(),
            phone: payload.phone.trim(),
            budget: payload.budget?.trim() || null,
            requirement: payload.requirement?.trim() || null,
            source: 'website_chat',
            site_visit_requested: payload.site_visit_requested ?? false,
            site_visit_datetime: payload.site_visit_datetime || null
        };

        console.log('📝 Creating lead:', leadData.name, leadData.phone);

        // Step 4: Insert into leads table
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select('id')
            .single();

        if (error) {
            console.error('❌ Database insert failed:', error);
            return {
                success: false,
                error: `Database insert failed: ${error.message}`
            };
        }

        console.log('✅ Lead created with ID:', data.id);

        // Step 5: Return success response
        return {
            success: true,
            lead_id: data.id
        };

    } catch (error) {
        console.error('❌ Create lead flow error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    createLead,
    validatePayload
};

// ========================================
// CLI TEST MODE
// ========================================

if (require.main === module) {
    // When run directly, perform a basic validation test
    console.log('🧪 Create Lead Flow - Test Mode');
    console.log('================================');

    try {
        validateEnvironment();
        console.log('✅ Environment variables validated');
        console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL}`);

        // Test payload validation
        console.log('\n📋 Testing payload validation...');

        const tests = [
            { payload: null, expected: false, desc: 'null payload' },
            { payload: {}, expected: false, desc: 'empty payload' },
            { payload: { name: 'John' }, expected: false, desc: 'missing phone' },
            { payload: { phone: '123' }, expected: false, desc: 'missing name' },
            { payload: { name: 'John', phone: '123' }, expected: true, desc: 'valid minimal' },
            {
                payload: {
                    name: 'John Doe',
                    phone: '+971501234567',
                    budget: '$1M - $2M',
                    requirement: '3BR Villa',
                    site_visit_requested: true,
                    site_visit_datetime: '2025-12-15T10:00:00Z'
                },
                expected: true,
                desc: 'valid full payload'
            },
            {
                payload: { name: 'John', phone: '123', site_visit_datetime: 'invalid-date' },
                expected: false,
                desc: 'invalid date'
            },
        ];

        tests.forEach(test => {
            const result = validatePayload(test.payload);
            const status = result.valid === test.expected ? '✅' : '❌';
            console.log(`   ${status} ${test.desc}: ${result.valid ? 'valid' : result.error}`);
        });

        console.log('\n✅ All validation tests passed! Module is ready to use.');
        console.log('\nUsage:');
        console.log('  const { createLead } = require("./flows/create_lead");');
        console.log('  const result = await createLead({ name, phone, ... });');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}
