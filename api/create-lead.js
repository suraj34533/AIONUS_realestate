/**
 * ========================================
 * AIONUS - CREATE LEAD API ENDPOINT
 * ========================================
 * API endpoint for creating new leads via POST request.
 * Calls the createLead flow from flows/create_lead.js
 * 
 * Usage: POST /api/create-lead.js
 * Body: { name, phone, budget, requirement, site_visit_requested, site_visit_datetime }
 */

const { createLead } = require('../flows/create_lead.js');

/**
 * Handle incoming HTTP request
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    // Validate method
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        }));
        return;
    }

    try {
        // Parse request body
        let body = '';

        // For environments where body is already parsed
        if (req.body) {
            body = req.body;
        } else {
            // Manually parse body for raw HTTP
            await new Promise((resolve, reject) => {
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', resolve);
                req.on('error', reject);
            });
            body = JSON.parse(body);
        }

        // Extract fields from body
        const {
            name,
            phone,
            budget,
            requirement,
            site_visit_requested,
            site_visit_datetime
        } = body;

        console.log('📞 API: Creating lead for:', name, phone);

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
            res.statusCode = 200;
            res.end(JSON.stringify({
                success: true,
                lead_id: result.lead_id
            }));
        } else {
            res.statusCode = 400;
            res.end(JSON.stringify({
                success: false,
                error: result.error
            }));
        }

    } catch (error) {
        console.error('❌ API Error:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({
            success: false,
            error: error.message || 'Internal server error'
        }));
    }
}

// Export for different environments
module.exports = handler;
module.exports.default = handler;

// For Express.js style middleware
module.exports.handler = handler;
