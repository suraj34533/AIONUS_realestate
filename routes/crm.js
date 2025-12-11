/**
 * CRM API Routes
 * Advanced CRM System for AIONUS
 */

const express = require('express');
const router = express.Router();

// ========================================
// POST /api/crm/create-lead
// Create a new lead in CRM
// ========================================
router.post('/create-lead', async (req, res) => {
    try {
        const { name, phone, budget, lead_source = 'chatbot' } = req.body;

        // Validation
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Name and phone are required'
            });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('❌ Supabase credentials missing');
            return res.status(500).json({
                success: false,
                error: 'CRM database not configured'
            });
        }

        // Insert lead into Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/leads_crm`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name,
                phone,
                budget: budget || null,
                lead_source,
                stage: 'new'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Supabase error:', errorData);
            return res.status(500).json({
                success: false,
                error: 'Failed to create lead'
            });
        }

        const data = await response.json();
        console.log('✅ CRM Lead created:', data[0]?.id);

        res.json({
            success: true,
            lead_id: data[0]?.id,
            message: 'Lead created successfully'
        });

    } catch (error) {
        console.error('❌ CRM create-lead error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// POST /api/crm/update-stage
// Update lead stage
// ========================================
router.post('/update-stage', async (req, res) => {
    try {
        const { id, new_stage } = req.body;

        // Validation
        if (!id || !new_stage) {
            return res.status(400).json({
                success: false,
                error: 'ID and new_stage are required'
            });
        }

        const validStages = ['new', 'contacted', 'interested', 'hot', 'closed'];
        if (!validStages.includes(new_stage)) {
            return res.status(400).json({
                success: false,
                error: `Invalid stage. Must be one of: ${validStages.join(', ')}`
            });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return res.status(500).json({
                success: false,
                error: 'CRM database not configured'
            });
        }

        // Update lead in Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/leads_crm?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                stage: new_stage
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Supabase error:', errorData);
            return res.status(500).json({
                success: false,
                error: 'Failed to update lead stage'
            });
        }

        const data = await response.json();
        console.log('✅ CRM Lead stage updated:', id, '→', new_stage);

        res.json({
            success: true,
            lead: data[0],
            message: 'Stage updated successfully'
        });

    } catch (error) {
        console.error('❌ CRM update-stage error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// GET /api/crm/get-leads
// Get leads with optional filters
// ========================================
router.get('/get-leads', async (req, res) => {
    try {
        const { stage, search } = req.query;

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return res.status(500).json({
                success: false,
                error: 'CRM database not configured'
            });
        }

        // Build query URL
        let queryUrl = `${SUPABASE_URL}/rest/v1/leads_crm?select=*&order=created_at.desc`;

        // Filter by stage
        if (stage && stage !== 'all') {
            queryUrl += `&stage=eq.${stage}`;
        }

        // Search by name or phone
        if (search) {
            queryUrl += `&or=(name.ilike.*${search}*,phone.ilike.*${search}*)`;
        }

        const response = await fetch(queryUrl, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Supabase error:', errorData);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch leads'
            });
        }

        const data = await response.json();
        console.log(`📋 CRM: Fetched ${data.length} leads`);

        res.json({
            success: true,
            leads: data,
            count: data.length
        });

    } catch (error) {
        console.error('❌ CRM get-leads error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// POST /api/crm/update-stage-by-phone
// Update lead stage by phone number (for site visit integration)
// ========================================
router.post('/update-stage-by-phone', async (req, res) => {
    try {
        const { phone, new_stage } = req.body;

        if (!phone || !new_stage) {
            return res.status(400).json({
                success: false,
                error: 'Phone and new_stage are required'
            });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return res.status(500).json({
                success: false,
                error: 'CRM database not configured'
            });
        }

        // Update lead by phone
        const response = await fetch(`${SUPABASE_URL}/rest/v1/leads_crm?phone=eq.${phone}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                stage: new_stage
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Supabase error:', errorData);
            return res.status(500).json({
                success: false,
                error: 'Failed to update lead stage'
            });
        }

        const data = await response.json();
        console.log('✅ CRM Lead stage updated by phone:', phone, '→', new_stage);

        res.json({
            success: true,
            updated: data.length,
            message: 'Stage updated successfully'
        });

    } catch (error) {
        console.error('❌ CRM update-stage-by-phone error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
