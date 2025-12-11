/**
 * ========================================
 * SCHEDULE SITE VISIT - EXPRESS ROUTE
 * ========================================
 * POST /api/schedule-visit
 * Saves site visit requests to Supabase
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
 * POST /api/schedule-visit
 * Schedule a site visit
 * 
 * Body: { name, phone, date, time, message }
 */
router.post('/', async (req, res) => {
    try {
        const { name, phone, date, time, message } = req.body;

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        if (!phone || phone.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Phone is required'
            });
        }

        if (!date || date.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Preferred date is required'
            });
        }

        if (!time || time.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Preferred time is required'
            });
        }

        console.log('📅 Site visit request:', name, phone, date, time);

        // Insert into Supabase
        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from('site_visits')
            .insert({
                name: name.trim(),
                phone: phone.trim(),
                visit_date: date.trim(),
                visit_time: time.trim(),
                message: message?.trim() || null
            })
            .select('id')
            .single();

        if (error) {
            console.error('❌ Database insert failed:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to schedule visit'
            });
        }

        console.log('✅ Site visit scheduled:', data.id);

        // Format date for response
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        res.json({
            success: true,
            visit_id: data.id,
            formatted_date: formattedDate,
            time: time
        });

    } catch (error) {
        console.error('❌ Schedule Visit API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

/**
 * GET /api/schedule-visit
 * Get all site visits for admin dashboard
 */
router.get('/', async (req, res) => {
    try {
        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from('site_visits')
            .select('*')
            .order('visit_date', { ascending: true });

        if (error) {
            console.error('❌ Failed to load visits:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log(`📅 Loaded ${data.length} site visits`);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ Get Visits API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
