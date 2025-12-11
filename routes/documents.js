/**
 * ========================================
 * DOCUMENTS API - EXPRESS ROUTE
 * ========================================
 * GET /api/documents - List documents by type
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

/**
 * Create Supabase client with service role
 */
function createServiceClient() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * GET /api/documents
 * List documents, optionally filtered by type
 * 
 * Query params:
 *   type: 'brochure' | 'faq' | 'pricing' (optional)
 *   limit: number (default 50)
 */
router.get('/', async (req, res) => {
    try {
        const supabase = createServiceClient();
        const { type, limit = 50 } = req.query;

        // Validate type if provided
        const validTypes = ['brochure', 'faq', 'pricing'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid document type. Allowed: ${validTypes.join(', ')}`
            });
        }

        // Build query
        let query = supabase
            .from('documents')
            .select('id, file_name, file_url, document_type, created_at')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        // Filter by type if specified
        if (type) {
            query = query.eq('document_type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Failed to fetch documents:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log(`📄 Fetched ${data.length} documents${type ? ` (type: ${type})` : ''}`);

        res.json({
            success: true,
            documents: data,
            count: data.length
        });

    } catch (error) {
        console.error('❌ Documents API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/documents/stats
 * Get document counts by type
 */
router.get('/stats', async (req, res) => {
    try {
        const supabase = createServiceClient();

        // Get counts for each type
        const types = ['brochure', 'faq', 'pricing'];
        const stats = {};

        for (const type of types) {
            const { count, error } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('document_type', type);

            if (error) throw error;
            stats[type] = count || 0;
        }

        // Get total
        const { count: total } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });

        res.json({
            success: true,
            stats: {
                ...stats,
                total: total || 0
            }
        });

    } catch (error) {
        console.error('❌ Documents Stats Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
