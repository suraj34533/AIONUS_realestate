/**
 * ========================================
 * AIONUS - EXPRESS BACKEND SERVER
 * ========================================
 * Main server file with Express, API routing, and static file hosting.
 * 
 * Run: npm start
 * Dev: npm run dev (live-server for frontend only)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ========================================
// ENVIRONMENT VARIABLE DEBUG (CRITICAL)
// ========================================
console.log('========================================');
console.log('🔧 ENVIRONMENT VARIABLES CHECK:');
console.log('========================================');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? `✅ SET (${process.env.TELEGRAM_BOT_TOKEN.length} chars, starts: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 8)}...)` : '❌ NOT SET');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `✅ SET (${process.env.GEMINI_API_KEY.length} chars)` : '❌ NOT SET');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
console.log('========================================');

// Critical warning for Telegram bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('⚠️ ⚠️ ⚠️  WARNING: TELEGRAM_BOT_TOKEN is NOT SET!');
    console.error('The Telegram bot WILL NOT WORK without this variable.');
    console.error('In Railway: Go to Variables tab and add TELEGRAM_BOT_TOKEN');
    console.error('⚠️ ⚠️ ⚠️');
}

const app = express();
const PORT = process.env.PORT || 8080;

// ========================================
// MIDDLEWARE
// ========================================

// Enable CORS for all origins
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
});

// ========================================
// API ROUTES
// ========================================

// Import route handlers
const createLeadRoute = require('./routes/create-lead');
const uploadBrochureRoute = require('./routes/upload-brochure');
const ragRoute = require('./routes/rag');
const contactRoute = require('./routes/contact');
const scheduleVisitRoute = require('./routes/schedule-visit');
const crmRoute = require('./routes/crm');
const documentsRoute = require('./routes/documents');
const telegramRoute = require('./routes/telegram');
const authRoute = require('./routes/auth');

// Mount API routes
app.use('/api/create-lead', createLeadRoute);
app.use('/api/upload-brochure', uploadBrochureRoute);
app.use('/api/rag', ragRoute);
app.use('/api/contact', contactRoute);
app.use('/api/schedule-visit', scheduleVisitRoute);
app.use('/api/crm', crmRoute);
app.use('/api/documents', documentsRoute);
app.use('/api/auth', authRoute);
app.use('/telegram', telegramRoute);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Secure Gemini Chat API Proxy (keeps API key on server, not exposed to frontend)
app.post('/api/chat', async (req, res) => {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    try {
        const { messages, systemInstruction, model = 'gemini-2.5-flash' } = req.body;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages,
                    systemInstruction: systemInstruction,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', data);
            return res.status(response.status).json({ error: data.error?.message || 'API error' });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that.";
        res.json({ text });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// STATIC FILE HOSTING (Frontend)
// ========================================

// Serve static files from root directory
app.use(express.static(path.join(__dirname)));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🏠 AIONUS SERVER');
    console.log('========================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   POST /api/create-lead`);
    console.log(`   POST /api/upload-brochure`);
    console.log(`   POST /telegram/webhook`);
    console.log(`   GET  /api/health`);
    console.log('========================================');
});

module.exports = app;
