/**
 * ========================================
 * AIONUS - SUPABASE CLIENT
 * ========================================
 * Database, Storage, and ERP operations
 */

import { getEnv, isConfigured } from '../config/env.js';

// Supabase client instance
let supabaseClient = null;

/**
 * Initialize Supabase client
 * @returns {Object|null} Supabase client or null if not configured
 */
async function initSupabase() {
    if (!isConfigured('supabase')) {
        console.warn('⚠️ Supabase not configured. Database features disabled.');
        return null;
    }

    try {
        // Dynamic import of Supabase SDK
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

        supabaseClient = createClient(
            getEnv('SUPABASE_URL'),
            getEnv('SUPABASE_ANON_KEY')
        );

        console.log('✅ Supabase client initialized');
        return supabaseClient;
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
        return null;
    }
}

/**
 * Get Supabase client (lazy initialization)
 */
async function getSupabase() {
    if (!supabaseClient) {
        await initSupabase();
    }
    return supabaseClient;
}

// ========================================
// STORAGE OPERATIONS
// ========================================

/**
 * Upload file to Supabase storage bucket
 * @param {File} file - File to upload
 * @param {string} path - Storage path (e.g., 'brochures/property-123.pdf')
 * @returns {Object} Upload result with publicUrl
 */
async function uploadToBucket(file, path) {
    const client = await getSupabase();

    if (!client) {
        console.warn('⚠️ Cannot upload - Supabase not configured');
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const bucketName = getEnv('SUPABASE_BUCKET_NAME');

        const { data, error } = await client.storage
            .from(bucketName)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = client.storage
            .from(bucketName)
            .getPublicUrl(path);

        return {
            data: {
                path: data.path,
                publicUrl: urlData.publicUrl
            },
            error: null
        };
    } catch (error) {
        console.error('❌ Upload failed:', error);
        return { data: null, error: error.message };
    }
}

// ========================================
// DOCUMENT METADATA OPERATIONS
// ========================================

/**
 * Insert document metadata into database
 * @param {Object} doc - Document metadata
 * @returns {Object} Insert result
 */
async function insertDocumentMetadata(doc) {
    const client = await getSupabase();

    if (!client) {
        console.warn('⚠️ Cannot insert - Supabase not configured');
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const { data, error } = await client
            .from('documents')
            .insert({
                title: doc.title,
                description: doc.description,
                file_url: doc.fileUrl,
                file_type: doc.fileType,
                property_id: doc.propertyId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Insert document failed:', error);
        return { data: null, error: error.message };
    }
}

/**
 * Get documents for a property
 * @param {string} propertyId - Property ID
 * @returns {Object} Query result
 */
async function getDocumentsByProperty(propertyId) {
    const client = await getSupabase();

    if (!client) {
        return { data: [], error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Get documents failed:', error);
        return { data: [], error: error.message };
    }
}

// ========================================
// ERP OPERATIONS - LEADS
// ========================================

/**
 * Insert new lead into CRM
 * @param {Object} lead - Lead data
 * @returns {Object} Insert result
 */
async function insertLead(lead) {
    const client = await getSupabase();

    if (!client) {
        console.warn('⚠️ Cannot insert lead - Supabase not configured');
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const { data, error } = await client
            .from('leads')
            .insert({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                source: lead.source || 'website',
                property_id: lead.propertyId,
                message: lead.message,
                interest: lead.interest,
                status: 'new',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Lead inserted:', data.id);
        return { data, error: null };
    } catch (error) {
        console.error('❌ Insert lead failed:', error);
        return { data: null, error: error.message };
    }
}

/**
 * Update lead status
 * @param {string} leadId - Lead ID
 * @param {string} status - New status
 * @returns {Object} Update result
 */
async function updateLeadStatus(leadId, status) {
    const client = await getSupabase();

    if (!client) {
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const { data, error } = await client
            .from('leads')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', leadId)
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Update lead failed:', error);
        return { data: null, error: error.message };
    }
}

/**
 * Get all leads with filters
 * @param {Object} filters - Filter options
 * @returns {Object} Query result
 */
async function getLeads(filters = {}) {
    const client = await getSupabase();

    if (!client) {
        return { data: [], error: 'Supabase not configured' };
    }

    try {
        let query = client.from('leads').select('*');

        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        if (filters.source) {
            query = query.eq('source', filters.source);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Get leads failed:', error);
        return { data: [], error: error.message };
    }
}

// ========================================
// ERP OPERATIONS - INTERACTIONS
// ========================================

/**
 * Log user interaction
 * @param {Object} interaction - Interaction data
 * @returns {Object} Insert result
 */
async function insertInteraction(interaction) {
    const client = await getSupabase();

    if (!client) {
        console.warn('⚠️ Cannot log interaction - Supabase not configured');
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const { data, error } = await client
            .from('interactions')
            .insert({
                lead_id: interaction.leadId,
                type: interaction.type, // 'chat', 'call', 'email', 'viewing'
                content: interaction.content,
                property_id: interaction.propertyId,
                agent_id: interaction.agentId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Insert interaction failed:', error);
        return { data: null, error: error.message };
    }
}

/**
 * Get interactions for a lead
 * @param {string} leadId - Lead ID
 * @returns {Object} Query result
 */
async function getInteractionsByLead(leadId) {
    const client = await getSupabase();

    if (!client) {
        return { data: [], error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await client
            .from('interactions')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('❌ Get interactions failed:', error);
        return { data: [], error: error.message };
    }
}

// ========================================
// ANALYTICS
// ========================================

/**
 * Get lead analytics
 * @returns {Object} Analytics data
 */
async function getLeadAnalytics() {
    const client = await getSupabase();

    if (!client) {
        return { data: null, error: 'Supabase not configured' };
    }

    try {
        // Count leads by status
        const { data: statusCounts, error: statusError } = await client
            .from('leads')
            .select('status')
            .then(res => {
                const counts = {};
                res.data?.forEach(lead => {
                    counts[lead.status] = (counts[lead.status] || 0) + 1;
                });
                return { data: counts, error: res.error };
            });

        // Count leads by source
        const { data: sourceCounts, error: sourceError } = await client
            .from('leads')
            .select('source')
            .then(res => {
                const counts = {};
                res.data?.forEach(lead => {
                    counts[lead.source] = (counts[lead.source] || 0) + 1;
                });
                return { data: counts, error: res.error };
            });

        return {
            data: {
                byStatus: statusCounts,
                bySource: sourceCounts,
                total: Object.values(statusCounts || {}).reduce((a, b) => a + b, 0)
            },
            error: null
        };
    } catch (error) {
        console.error('❌ Get analytics failed:', error);
        return { data: null, error: error.message };
    }
}

// Export all functions
export {
    initSupabase,
    getSupabase,
    // Storage
    uploadToBucket,
    // Documents
    insertDocumentMetadata,
    getDocumentsByProperty,
    // Leads
    insertLead,
    updateLeadStatus,
    getLeads,
    // Interactions
    insertInteraction,
    getInteractionsByLead,
    // Analytics
    getLeadAnalytics
};

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabase,
        uploadToBucket,
        insertDocumentMetadata,
        getDocumentsByProperty,
        insertLead,
        updateLeadStatus,
        getLeads,
        insertInteraction,
        getInteractionsByLead,
        getLeadAnalytics
    };
}
