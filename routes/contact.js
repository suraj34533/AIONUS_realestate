/**
 * ========================================
 * CONTACT FORM - EXPRESS ROUTE
 * ========================================
 * POST /api/contact
 * Saves contact form submissions to Supabase
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
 * POST /api/contact
 * Save contact form message to database
 * 
 * Body: { name, email, phone, interest, message }
 */
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, interest, message } = req.body;

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        if (!phone || phone.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Phone is required'
            });
        }

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        console.log('📧 Contact form submission:', name, email);

        // Insert into Supabase
        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from('contact_messages')
            .insert({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                interest: interest?.trim() || null,
                message: message.trim()
            })
            .select('id')
            .single();

        if (error) {
            console.error('❌ Database insert failed:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to save message'
            });
        }

        console.log('✅ Contact message saved:', data.id);

        res.json({
            success: true,
            message_id: data.id
        });

    } catch (error) {
        console.error('❌ Contact API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
