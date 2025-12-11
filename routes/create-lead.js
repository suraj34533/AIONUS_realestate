/**
 * ========================================
 * CREATE LEAD - EXPRESS ROUTE
 * ========================================
 * POST /api/create-lead
 * Creates a new lead in Supabase
 */

const express = require('express');
const router = express.Router();
const { createLead } = require('../flows/create_lead');

/**
 * POST /api/create-lead
 * Creates a new lead in the database
 * 
 * Body: {
 *   name: string (required),
 *   phone: string (required),
 *   budget: string (optional),
 *   requirement: string (optional),
 *   site_visit_requested: boolean (optional),
 *   site_visit_datetime: string (optional, ISO format)
 * }
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            phone,
            budget,
            requirement,
            site_visit_requested,
            site_visit_datetime
        } = req.body;

        console.log('📞 Creating lead:', name, phone);

        // Call the createLead flow
        const result = await createLead({
            name,
            phone,
            budget,
            requirement,
            site_visit_requested: site_visit_requested || false,
            site_visit_datetime: site_visit_datetime || null
        });

        // Return result
        if (result.success) {
            console.log('✅ Lead created:', result.lead_id);
            res.status(200).json({
                success: true,
                lead_id: result.lead_id
            });
        } else {
            console.error('❌ Lead creation failed:', result.error);
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Route Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Method not allowed for non-POST
router.all('/', (req, res) => {
    res.status(405).json({
        success: false,
        error: 'Method not allowed'
    });
});

module.exports = router;
