/**
 * ========================================
 * AIONUS TELEGRAM BOT - WEBHOOK HANDLER
 * ========================================
 * POST /telegram/webhook
 * 
 * Features:
 * - Lead capture funnel (name → phone → budget)
 * - RAG-powered AI responses using Gemini
 * - CRM lead creation
 * - Site visit scheduling
 * - Name sanitization
 * - ADMIN COMMANDS: /stats, /leads_today, /visits_upcoming, /lead <phone>
 */

require('dotenv').config();
const express = require('express');
const router = express.Router();

// ========================================
// CONFIGURATION
// ========================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

// DEBUG: Log token status at startup
console.log('🔧 TELEGRAM CONFIG:', {
    token_set: !!TELEGRAM_BOT_TOKEN,
    token_length: TELEGRAM_BOT_TOKEN?.length || 0,
    token_preview: TELEGRAM_BOT_TOKEN ? `${TELEGRAM_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET'
});

// Admin chat IDs (comma-separated in .env)
const TELEGRAM_ADMIN_CHAT_IDS = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// ========================================
// ADMIN CHECK
// ========================================
function isAdmin(chatId) {
    return TELEGRAM_ADMIN_CHAT_IDS.includes(String(chatId));
}

// ========================================
// IN-MEMORY USER STATE
// ========================================
const userStates = new Map();

function getUserState(chatId) {
    if (!userStates.has(chatId)) {
        userStates.set(chatId, {
            name: null,
            phone: null,
            budget: null,
            waitingForVisitDate: false,
            waitingForLeadConfirm: false,
            pendingLead: null
        });
    }
    return userStates.get(chatId);
}

// ========================================
// NAME SANITIZATION
// ========================================
function sanitizeName(name) {
    const badWords = ["fuck", "fucker", "bc", "mc", "chutiya", "madarchod", "bhosdike", "bsdk",
        "lund", "bhosdi", "bhosdiwale", "gaand", "gandu", "randi", "harami",
        "chut", "lawde", "laude", "behenchod", "behen", "maderchod", "sala",
        "saala", "kutti", "kutta", "kamina", "kamine", "chodu", "tatti",
        "shit", "ass", "bitch", "bastard", "dick", "cunt", "slut", "whore"];

    let clean = name.toLowerCase().trim();

    for (let bad of badWords) {
        if (clean.includes(bad)) {
            console.log('⚠️ Offensive name blocked in Telegram');
            return "Friend";
        }
    }

    clean = clean.replace(/[^a-zA-Z\s]/g, "").trim();
    if (clean.length < 2) return "Friend";

    return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ========================================
// SUPABASE QUERY HELPERS
// ========================================

/**
 * Query Supabase REST API
 */
async function supabaseQuery(table, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('❌ Supabase not configured');
        return { data: null, error: 'Supabase not configured' };
    }

    try {
        let url = `${SUPABASE_URL}/rest/v1/${table}`;
        const params = new URLSearchParams();

        if (options.select) params.append('select', options.select);
        if (options.filter) url += `?${options.filter}`;
        if (options.order) params.append('order', options.order);
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        if (queryString && !options.filter) {
            url += '?' + queryString;
        } else if (queryString) {
            url += '&' + queryString;
        }

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        });

        const data = await response.json();
        const count = response.headers.get('content-range')?.split('/')[1];

        return { data, count: count ? parseInt(count) : data.length, error: null };
    } catch (error) {
        console.error('❌ Supabase query error:', error);
        return { data: null, count: 0, error: error.message };
    }
}

/**
 * Get dashboard stats
 */
async function getStats() {
    const today = new Date().toISOString().split('T')[0];

    // Total leads
    const { count: totalLeads } = await supabaseQuery('leads_crm', { select: 'id', limit: 1 });

    // Leads today
    const { data: leadsToday } = await supabaseQuery('leads_crm', {
        filter: `created_at=gte.${today}T00:00:00`,
        select: 'id'
    });

    // Total site visits
    const { count: totalVisits } = await supabaseQuery('site_visits', { select: 'id', limit: 1 });

    // Upcoming visits
    const { data: upcomingVisits } = await supabaseQuery('site_visits', {
        filter: `visit_date=gte.${today}`,
        select: 'id'
    });

    return {
        totalLeads: totalLeads || 0,
        leadsToday: leadsToday?.length || 0,
        totalVisits: totalVisits || 0,
        upcomingVisits: upcomingVisits?.length || 0
    };
}

/**
 * Get today's leads
 */
async function getLeadsToday() {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabaseQuery('leads_crm', {
        filter: `created_at=gte.${today}T00:00:00`,
        select: 'name,phone,budget,stage,created_at',
        order: 'created_at.desc',
        limit: 20
    });

    return data || [];
}

/**
 * Get upcoming visits
 */
async function getUpcomingVisits() {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabaseQuery('site_visits', {
        filter: `visit_date=gte.${today}`,
        select: 'name,phone,visit_date,visit_time,message',
        order: 'visit_date.asc,visit_time.asc',
        limit: 20
    });

    return data || [];
}

/**
 * Find lead by phone
 */
async function findLeadByPhone(phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const { data } = await supabaseQuery('leads_crm', {
        filter: `phone=ilike.*${cleanPhone}*`,
        select: 'id,name,phone,budget,stage,lead_source,created_at',
        order: 'created_at.desc',
        limit: 5
    });

    return data || [];
}

// ========================================
// TELEGRAM API HELPERS
// ========================================

async function sendTelegramMessage(chatId, text, parseMode = 'HTML') {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN not configured');
        return false;
    }

    console.log(`📤 Sending to Telegram [${chatId}]: ${text.substring(0, 50)}...`);

    try {
        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: parseMode
            })
        });

        const data = await response.json();

        if (!data.ok) {
            console.error('❌ Telegram API error:', JSON.stringify(data));
            return false;
        }

        console.log(`✅ Message sent successfully to ${chatId}`);
        return true;
    } catch (error) {
        console.error('❌ sendTelegramMessage error:', error.message);
        return false;
    }
}

// ========================================
// ADMIN COMMAND HANDLERS
// ========================================

async function handleAdminCommands(chatId, text) {
    const command = text.split(' ')[0].toLowerCase();

    // /help command
    if (command === '/help') {
        if (isAdmin(chatId)) {
            return `🤖 <b>AIONUS Admin Commands</b>

📊 <code>/stats</code> - Dashboard statistics
👥 <code>/leads_today</code> - Aaj ke leads
📅 <code>/visits_upcoming</code> - Upcoming site visits
🔍 <code>/lead 9876543210</code> - Lead search by phone

Normal users ke liye main property search aur site visit booking mein help karta hoon.`;
        } else {
            return `🙏 Main aapko property search, budget planning, aur site visit schedule karne mein help kar sakta hoon!

Simply apna naam bataiye aur shuru karte hain. 🏠`;
        }
    }

    // Admin-only commands below
    if (!isAdmin(chatId)) {
        return `⚠️ Yeh command sirf admin ke liye hai. 🙂`;
    }

    // /stats command
    if (command === '/stats') {
        try {
            const stats = await getStats();
            return `📊 <b>AIONUS Dashboard Stats</b>

👥 Total Leads: <b>${stats.totalLeads}</b>
🔥 Aaj ke Leads: <b>${stats.leadsToday}</b>
📅 Total Site Visits: <b>${stats.totalVisits}</b>
⏰ Upcoming Visits: <b>${stats.upcomingVisits}</b>

💬 Active Telegram Users: ${userStates.size}`;
        } catch (error) {
            return `❌ Stats fetch karne mein error: ${error.message}`;
        }
    }

    // /leads_today command
    if (command === '/leads_today') {
        try {
            const leads = await getLeadsToday();

            if (leads.length === 0) {
                return `📭 Aaj abhi tak koi naya lead nahi aaya.`;
            }

            let msg = `👥 <b>Aaj ke Leads (${leads.length})</b>\n\n`;
            leads.forEach((lead, i) => {
                msg += `${i + 1}. <b>${lead.name || 'N/A'}</b>\n`;
                msg += `   📱 ${lead.phone || 'No phone'}\n`;
                msg += `   💰 ${lead.budget || 'Budget N/A'}\n`;
                msg += `   📍 Stage: ${lead.stage || 'new'}\n\n`;
            });

            return msg;
        } catch (error) {
            return `❌ Leads fetch karne mein error: ${error.message}`;
        }
    }

    // /visits_upcoming command
    if (command === '/visits_upcoming') {
        try {
            const visits = await getUpcomingVisits();

            if (visits.length === 0) {
                return `📭 Koi upcoming site visit scheduled nahi hai.`;
            }

            let msg = `📅 <b>Upcoming Site Visits (${visits.length})</b>\n\n`;
            visits.forEach((visit, i) => {
                msg += `${i + 1}. <b>${visit.visit_date}</b> ${visit.visit_time || ''}\n`;
                msg += `   👤 ${visit.name || 'N/A'}\n`;
                msg += `   📱 ${visit.phone || 'N/A'}\n`;
                if (visit.message) msg += `   💬 "${visit.message}"\n`;
                msg += `\n`;
            });

            return msg;
        } catch (error) {
            return `❌ Visits fetch karne mein error: ${error.message}`;
        }
    }

    // /lead <phone> command
    if (command === '/lead') {
        const phone = text.replace('/lead', '').trim();

        if (!phone) {
            return `⚠️ Phone number dijiye:\n<code>/lead 9876543210</code>`;
        }

        try {
            const leads = await findLeadByPhone(phone);

            if (leads.length === 0) {
                return `❌ Is phone number se koi lead nahi mila: ${phone}`;
            }

            if (leads.length === 1) {
                const lead = leads[0];
                const createdAt = new Date(lead.created_at).toLocaleString('en-IN');

                return `🔍 <b>Lead Details</b>

👤 Name: <b>${lead.name || 'N/A'}</b>
📱 Phone: <b>${lead.phone}</b>
💰 Budget: <b>${lead.budget || 'Not specified'}</b>
📍 Stage: <b>${lead.stage || 'new'}</b>
📣 Source: <b>${lead.lead_source || 'website'}</b>
🕐 Created: <b>${createdAt}</b>`;
            }

            // Multiple matches
            let msg = `🔍 <b>${leads.length} leads mile:</b>\n\n`;
            leads.forEach((lead, i) => {
                msg += `${i + 1}. ${lead.name} - ${lead.phone} (${lead.stage || 'new'})\n`;
            });
            msg += `\n💡 Zyada specific phone number dijiye.`;

            return msg;
        } catch (error) {
            return `❌ Lead search mein error: ${error.message}`;
        }
    }

    return null; // Not an admin command
}

// ========================================
// RAG + GEMINI AI
// ========================================

async function getRagContext(query) {
    try {
        const response = await fetch(`/api/rag?query=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            return data.context || '';
        }
    } catch (error) {
        console.log('⚠️ RAG unavailable');
    }
    return '';
}

async function getAIResponse(userMessage, userState, ragContext = '') {
    if (!GEMINI_API_KEY) {
        return "AI assistant is not configured.";
    }

    const systemPrompt = `You are AIONUS DIVA – a GENIUS India Real Estate AI Assistant on Telegram.

## 🚫 CRITICAL: INDIA ONLY
- You ONLY know Indian real estate. NO DUBAI. NO UAE. NO FOREIGN PROPERTIES.
- If anyone asks about Dubai, say: "Main sirf India real estate mein specialize karti hoon. India mein amazing properties hain! Kaunsa city - Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai ya Kolkata?"
- ALL PRICES IN ₹ RUPEES (Lakhs and Crores)

## PERSONALITY:
- Premium FEMALE Indian voice (warm, confident, sophisticated)
- Hinglish (60% Hindi + 40% English)
- Keep responses 3-5 lines for Telegram
- Use emojis tastefully
- BE SMART: GIVE DIRECT RECOMMENDATIONS, don't ask unnecessary questions!
- You KNOW user's name and budget - USE IT!

## CURRENT USER INFO:
- Name: ${userState.name || 'Guest'}
- Phone: ${userState.phone || 'Not provided'}
- Budget: ${userState.budget || 'Not specified'}

${ragContext ? `## DOCUMENT CONTEXT:\n${ragContext}\n` : ''}

## 🇮🇳 COMPLETE INDIA KNOWLEDGE:

### CITIES & PRICE RANGES:
- **Mumbai**: Worli (₹5-50Cr sea-facing), Bandra (₹2-8Cr lifestyle), Powai (₹1-3Cr IT), Thane (₹50L-1.5Cr)
- **Delhi NCR**: Golf Course Road (₹5Cr+ luxury), Gurgaon sectors (₹80L-3Cr), Noida (₹50L-2Cr), Greater Noida (₹35-80L)
- **Bangalore**: Koramangala (₹2Cr+ startups), Whitefield (₹70L-2Cr IT), Sarjapur Road (₹60L-1.2Cr growth)
- **Hyderabad**: Jubilee Hills (₹3Cr+ luxury), HITEC City (₹60L-1.5Cr IT), Gachibowli (₹70L-2Cr)
- **Chennai**: Anna Nagar (₹1-2Cr), OMR (₹50L-1Cr IT corridor)
- **Pune**: Koregaon Park (₹1.5Cr+), Hinjewadi (₹50L-1Cr IT), Baner (₹70L-1.5Cr)
- **Kolkata**: Alipore (₹1.5Cr+), Rajarhat (₹40-80L)

### TOP BUILDERS:
Lodha (Mumbai luxury), DLF (Delhi NCR), Godrej Properties (pan-India), Prestige (Bangalore), Sobha (quality), Oberoi Realty (Mumbai premium), Tata Housing (trust), Brigade (Bangalore), Hiranandani (townships)

### BUDGET CATEGORIES:
- ₹30-70L: Thane, Navi Mumbai, Greater Noida, Whitefield outskirts
- ₹70L-1.5Cr: Powai, Gurgaon sectors, HSR Layout, Hinjewadi
- ₹1.5-5Cr: Bandra, South Delhi, Koramangala, Banjara Hills
- ₹5Cr+: Worli, Golf Course Road Gurgaon, Jubilee Hills

## PROPERTY TYPES:
- **Villa**: Standalone luxury homes with garden, ₹2Cr+ in tier-1 cities
- **Apartment**: 1/2/3/4 BHK flats, most common choice, ₹30L-5Cr
- **Penthouse**: Top-floor luxury with terrace, ₹3Cr+
- **Row House**: Attached homes, ₹1-3Cr
- **Farmhouse**: Land + house, outskirts, ₹50L-5Cr

When user asks for "villa" or "apartment" etc, GIVE SPECIFIC OPTIONS with city, area, price range and builder!

## RULES:
1. NEVER ask "which city" or "what type" - GIVE DIRECT RECOMMENDATIONS!
2. When user says "villa" - suggest villas with prices immediately
3. Give specific city and area recommendations based on budget AND property type
4. Quote prices in ₹ Lakhs/Crores
5. ALWAYS provide at least one specific recommendation with builder name
6. Be helpful and smart, not annoying!

Answer in friendly Hinglish:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt }] },
                        { role: 'model', parts: [{ text: 'Samajh gaya! Main help karne ke liye ready hoon. 🏠' }] },
                        { role: 'user', parts: [{ text: userMessage }] }
                    ],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
                })
            }
        );

        if (!response.ok) {
            console.error('Gemini API error');
            return "Kuch technical issue hai. Please thodi der baad try karein.";
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Main samajh nahi paya. Please dobara bataiye.";
    } catch (error) {
        console.error('AI error:', error);
        return "Technical issue. Please try again.";
    }
}

// ========================================
// CONVERSATION LOGGING
// ========================================

async function logConversation(chatId, platform, role, message) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            console.log('⚠️ Supabase not configured for conversation logging');
            return;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                telegram_chat_id: chatId.toString(),
                platform: platform,
                role: role,
                message: message.substring(0, 5000) // Limit message length
            })
        });
        console.log(`📝 Logged ${role} message to conversations`);
    } catch (error) {
        console.error('❌ Conversation logging error:', error.message);
    }
}

// ========================================
// SMART AI RESPONSE (with lead extraction)
// ========================================

async function getSmartAIResponse(userMessage, userState, ragContext, chatId) {
    if (!GEMINI_API_KEY) {
        return "AI assistant is not configured.";
    }

    // Check if user wants to explore properties
    const exploreKeywords = ['explore properties', 'find property', 'search properties', 'property dhundh', 'property chahiye', 'ghar chahiye', 'flat chahiye', 'villa chahiye', 'apartment chahiye'];
    const wantsToExplore = exploreKeywords.some(k => userMessage.toLowerCase().includes(k));

    const systemPrompt = `You are AIONUS DIVA – the SMARTEST India Real Estate AI on Telegram.

## USER INFO:
- Name: ${userState.name || 'User'}
- Phone: ${userState.phone || 'Not provided'}
- Budget: ${userState.budget || 'Not specified'}

## RULES:
1. Be conversational and helpful
2. Keep responses 3-5 lines
3. Use Hinglish (Hindi+English)
4. ALL prices in ₹ Rupees only
5. INDIA ONLY - no Dubai/UAE

${wantsToExplore ? `
## IMPORTANT: User wants to explore properties!
If you don't have their name, phone, or budget yet, ASK them casually:
"Property explore karne ke liye mujhe aapka naam, phone number aur budget chahiye. Please share karein!"

If they provide details in message, EXTRACT them and confirm:
"Let me confirm - Naam: [name], Phone: [phone], Budget: [budget]. Is this correct?"
` : ''}

${ragContext ? `## CONTEXT:\n${ragContext}\n` : ''}

## PROPERTY KNOWLEDGE:
- Mumbai: Worli (₹5-50Cr), Bandra (₹2-8Cr), Powai (₹1-3Cr)
- Delhi NCR: Gurgaon (₹80L-3Cr), Noida (₹50L-2Cr)
- Bangalore: Koramangala (₹2Cr+), Whitefield (₹70L-2Cr)

Respond naturally:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + userMessage }] }
                    ],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 600 }
                })
            }
        );

        if (!response.ok) {
            console.error('Gemini API error');
            return "Kuch technical issue hai. Please thodi der baad try karein.";
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Main samajh nahi paya.";

        // Try to extract lead info from conversation
        if (wantsToExplore) {
            const extractedLead = extractLeadInfo(userMessage);
            if (extractedLead.name && extractedLead.phone) {
                userState.pendingLead = extractedLead;
                userState.waitingForLeadConfirm = true;
                return `📋 Let me confirm your details:

👤 Name: ${extractedLead.name}
📱 Phone: ${extractedLead.phone}
💰 Budget: ${extractedLead.budget || 'Not mentioned'}

Is this correct? (Reply: Yes/Haan)`;
            }
        }

        return aiResponse;
    } catch (error) {
        console.error('AI error:', error);
        return "Technical issue. Please try again.";
    }
}

// Extract lead info from natural text
function extractLeadInfo(text) {
    const phoneMatch = text.match(/(\+91|91)?[\s-]?[6-9]\d{9}/);
    const budgetMatch = text.match(/(\d+[\s]*(lakh|lac|l|crore|cr|k))/i);

    // Simple name extraction (first capitalized word that's not a keyword)
    const words = text.split(/[\s,]+/);
    let name = null;
    const skipWords = ['hi', 'hello', 'my', 'name', 'is', 'i', 'am', 'mera', 'naam', 'hai', 'phone', 'number', 'budget'];
    for (const word of words) {
        if (word.length > 2 && /^[A-Z]/.test(word) && !skipWords.includes(word.toLowerCase())) {
            name = word;
            break;
        }
    }

    return {
        name: name,
        phone: phoneMatch ? phoneMatch[0].replace(/[\s-]/g, '') : null,
        budget: budgetMatch ? budgetMatch[0] : null
    };
}

// ========================================
// CRM INTEGRATION
// ========================================

async function createCRMLead(leadData) {
    try {
        const response = await fetch('/api/crm/create-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: leadData.name,
                phone: leadData.phone,
                budget: leadData.budget,
                lead_source: 'telegram'
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log('✅ Telegram lead created:', data.lead_id);
            return true;
        }
    } catch (error) {
        console.error('❌ CRM lead creation failed:', error);
    }
    return false;
}

// ========================================
// SITE VISIT SCHEDULING
// ========================================

async function scheduleSiteVisit(name, phone, dateTime) {
    try {
        const [date, time] = dateTime.split(' ');

        const response = await fetch('/api/schedule-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                phone: phone,
                date: date,
                time: time || '10:00',
                message: 'Booked via Telegram'
            })
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('❌ Site visit scheduling failed:', error);
        return false;
    }
}

function isSiteVisitRequest(text) {
    const keywords = ['schedule visit', 'book visit', 'site visit', 'visit tomorrow',
        'property visit', 'dekho property', 'dekhna hai', 'visit karna',
        'schedule a visit', 'book a visit', 'ghar dekhna'];
    const lower = text.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
}

// ========================================
// LEAD CAPTURE FLOW
// ========================================

async function handleLeadCapture(chatId, message, state) {
    const text = message.trim();

    switch (state.step) {
        case 0:
            state.step = 1;
            return `🙏 Namaste! Main aapki AIONUS property advisor hoon.

India mein aapke liye perfect property dhundne mein madad karungi! 🏠 Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai, Kolkata - sabhi cities mein!

Pehle, aapka shubh naam bataiye?`;

        case 1:
            state.name = sanitizeName(text);
            state.step = 2;
            return `Bahut achha, ${state.name} ji! 🙏

Ab please apna WhatsApp number share karein 📱`;

        case 2:
            const phoneClean = text.replace(/[^0-9+]/g, '');
            if (phoneClean.length < 10) {
                return `${state.name} ji, yeh phone number sahi nahi lag raha. Please 10-digit number enter karein 📱`;
            }
            state.phone = phoneClean;
            state.step = 3;
            return `Perfect! ✅

Aapka property ke liye budget kya hai?
Jaise: "50 Lakh", "1 Crore", ya "2-3 Crore" 💰`;

        case 3:
            state.budget = text;
            state.step = 4;
            state.isComplete = true;

            await createCRMLead({
                name: state.name,
                phone: state.phone,
                budget: state.budget
            });

            return `🎉 Shukriya ${state.name} ji!

Aapki details hamari team ko share ho gayi hain. Jaldi call aayegi! 📞

Ab main property search mein help kar sakta hoon. Kya dhundh rahe ho?
🏠 Villa
🏢 Apartment
🌟 Penthouse
📋 Off-plan project`;

        default:
            return null;
    }
}

// ========================================
// MAIN WEBHOOK HANDLER
// ========================================

router.post('/webhook', async (req, res) => {
    // CRITICAL: Always return 200 OK immediately to Telegram
    res.status(200).json({ ok: true });

    console.log('🔔 WEBHOOK RECEIVED:', JSON.stringify(req.body).substring(0, 200));

    try {
        const update = req.body;

        if (!update) {
            console.log('❌ Empty update received');
            return;
        }

        const message = update.message;

        if (!message) {
            console.log('⚠️ No message in update - might be callback/edit');
            return;
        }

        if (!message.text) {
            console.log('⚠️ No text in message - might be media');
            return;
        }

        const chatId = message.chat.id;
        const text = message.text.trim();
        const userName = message.from?.first_name || 'User';

        console.log(`📱 [CHAT ${chatId}] From: ${userName} | Message: ${text}`);

        // ==========================================
        // STEP 1: Handle commands FIRST
        // ==========================================
        if (text.startsWith('/')) {
            // Handle /start separately (resets user state)
            if (text === '/start') {
                const state = getUserState(chatId);
                state.name = userName; // Use Telegram username
                state.waitingForVisitDate = false;
                state.waitingForLeadConfirm = false;

                const reply = `🙏 Namaste ${userName}! Welcome to AIONUS Real Estate.

Main aapki AI property advisor hoon 🏠

India mein luxury properties dhundhne mein aapki madad karungi - Mumbai, Delhi, Bangalore, Hyderabad, Pune!

Kaise madad kar sakti hoon aaj? 😊`;

                // Log conversation
                await logConversation(chatId, 'telegram', 'assistant', reply);
                await sendTelegramMessage(chatId, reply);
                return;
            }

            // Handle admin/help commands
            const adminReply = await handleAdminCommands(chatId, text);
            if (adminReply) {
                await sendTelegramMessage(chatId, adminReply);
                return;
            }
        }

        // ==========================================
        // STEP 2: Normal conversation flow
        // ==========================================
        const state = getUserState(chatId);
        let reply = '';

        // Handle site visit date input
        if (state.waitingForVisitDate) {
            state.waitingForVisitDate = false;

            const dateRegex = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2})?$/;
            if (dateRegex.test(text)) {
                const success = await scheduleSiteVisit(state.name || userName, state.phone || 'N/A', text);
                if (success) {
                    reply = `✅ Site visit scheduled for ${text}!

Hamari team aapse contact karegi. 📞`;
                } else {
                    reply = `❌ Visit schedule karne mein problem hui. Please dubara try karein.`;
                }
            } else {
                reply = `⚠️ Please date is format mein bhejein: 
<code>2024-12-15 10:00</code>`;
            }
        }
        // Handle lead confirmation
        else if (state.waitingForLeadConfirm && state.pendingLead) {
            const confirmWords = ['yes', 'haan', 'ha', 'right', 'correct', 'sahi', 'theek'];
            if (confirmWords.some(w => text.toLowerCase().includes(w))) {
                // Save lead to database
                await createCRMLead(state.pendingLead);
                state.waitingForLeadConfirm = false;
                state.pendingLead = null;
                reply = `🎉 Congratulations! Aapki details save ho gayi hain!

Hamari team jaldi aapse contact karegi. 📞`;
            } else {
                state.waitingForLeadConfirm = false;
                state.pendingLead = null;
                reply = `Koi baat nahi! Agar details galat hain toh dubara bataiye. 😊`;
            }
        }
        // Handle site visit request
        else if (isSiteVisitRequest(text)) {
            state.waitingForVisitDate = true;
            reply = `📅 Site visit book karna chahte hain? Great!

Please apni preferred date aur time bhejein:
<code>YYYY-MM-DD HH:MM</code>

Example: <code>2024-12-15 10:00</code>`;
        }
        // Smart AI response for everything else
        else {
            // Log user message
            await logConversation(chatId, 'telegram', 'user', text);

            const ragContext = await getRagContext(text);
            reply = await getSmartAIResponse(text, state, ragContext, chatId);

            // Log bot response
            await logConversation(chatId, 'telegram', 'assistant', reply);
        }

        if (reply) {
            await sendTelegramMessage(chatId, reply);
        }

    } catch (error) {
        console.error('❌ Telegram webhook error:', error);
    }
});

// ========================================
// HEALTH CHECK
// ========================================
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        bot_configured: !!TELEGRAM_BOT_TOKEN,
        admins_configured: TELEGRAM_ADMIN_CHAT_IDS.length,
        active_users: userStates.size
    });
});

// ========================================
// SET WEBHOOK
// ========================================
router.post('/set-webhook', async (req, res) => {
    const { webhook_url } = req.body;

    if (!webhook_url) {
        return res.status(400).json({ error: 'webhook_url required' });
    }

    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    try {
        const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhook_url })
        });

        const data = await response.json();
        console.log('📡 Webhook set result:', data);
        res.json(data);
    } catch (error) {
        console.error('❌ Set webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
