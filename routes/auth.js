/**
 * ========================================
 * AIONUS - AUTH ROUTES
 * ========================================
 * Handles user authentication and profile management
 * 
 * Endpoints:
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * POST /api/auth/logout - Logout user
 * GET /api/auth/profile - Get user profile
 * PUT /api/auth/profile - Update user profile
 */

require('dotenv').config();
const express = require('express');
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ========================================
// HELPER FUNCTIONS
// ========================================

async function supabaseAuth(endpoint, body, accessToken = null) {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    return response.json();
}

async function supabaseQuery(table, method, body = null, accessToken = null, filters = '') {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, options);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Database error');
    }

    return response.json();
}

// ========================================
// REGISTER
// ========================================
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Register with Supabase Auth
        const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                data: { name, phone }  // Store in user metadata
            })
        });

        const authData = await authResponse.json();

        if (authData.error) {
            return res.status(400).json({
                success: false,
                error: authData.error.message || 'Registration failed'
            });
        }

        // Update profile with additional info
        if (authData.user && authData.access_token) {
            try {
                await supabaseQuery('user_profiles', 'PATCH',
                    { name, phone },
                    authData.access_token,
                    `?id=eq.${authData.user.id}`
                );
            } catch (e) {
                console.log('Profile update will be done on first login');
            }
        }

        console.log('✅ User registered:', email);

        res.json({
            success: true,
            message: 'Registration successful! Please check your email to confirm.',
            user: {
                id: authData.user?.id,
                email: authData.user?.email,
                name
            },
            session: authData.session
        });

    } catch (error) {
        console.error('❌ Register error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Registration failed'
        });
    }
});

// ========================================
// LOGIN
// ========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Login with Supabase Auth
        const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const authData = await authResponse.json();

        if (authData.error) {
            return res.status(401).json({
                success: false,
                error: authData.error_description || authData.error.message || 'Invalid credentials'
            });
        }

        // Get user profile
        let profile = null;
        try {
            const profiles = await supabaseQuery('user_profiles', 'GET', null,
                authData.access_token,
                `?id=eq.${authData.user.id}`
            );
            profile = profiles[0] || null;
        } catch (e) {
            console.log('No profile found, will create on update');
        }

        console.log('✅ User logged in:', email);

        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                name: profile?.name || authData.user.user_metadata?.name || email.split('@')[0],
                phone: profile?.phone || authData.user.user_metadata?.phone || null,
                budget: profile?.budget || null
            },
            session: {
                access_token: authData.access_token,
                refresh_token: authData.refresh_token,
                expires_at: authData.expires_at
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Login failed'
        });
    }
});

// ========================================
// LOGOUT
// ========================================
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.replace('Bearer ', '');

        if (accessToken) {
            await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
        }

        res.json({ success: true, message: 'Logged out successfully' });

    } catch (error) {
        console.error('❌ Logout error:', error);
        res.json({ success: true, message: 'Logged out' });
    }
});

// ========================================
// GET PROFILE
// ========================================
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Get user from token
        const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userData = await userResponse.json();

        if (userData.error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Get profile data
        let profile = null;
        try {
            const profiles = await supabaseQuery('user_profiles', 'GET', null,
                accessToken,
                `?id=eq.${userData.id}`
            );
            profile = profiles[0] || null;
        } catch (e) {
            profile = null;
        }

        res.json({
            success: true,
            user: {
                id: userData.id,
                email: userData.email,
                name: profile?.name || userData.user_metadata?.name || userData.email.split('@')[0],
                phone: profile?.phone || userData.user_metadata?.phone || null,
                budget: profile?.budget || null,
                preferred_city: profile?.preferred_city || null
            }
        });

    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get profile'
        });
    }
});

// ========================================
// UPDATE PROFILE
// ========================================
router.put('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Get user from token
        const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userData = await userResponse.json();

        if (userData.error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        const { name, phone, budget, preferred_city } = req.body;
        const updateData = {
            name,
            phone,
            budget,
            preferred_city,
            updated_at: new Date().toISOString()
        };

        // Check if profile exists
        const existingProfiles = await supabaseQuery('user_profiles', 'GET', null,
            accessToken,
            `?id=eq.${userData.id}`
        );

        if (existingProfiles.length === 0) {
            // Create profile
            updateData.id = userData.id;
            updateData.email = userData.email;
            await supabaseQuery('user_profiles', 'POST', updateData, accessToken);
        } else {
            // Update profile
            await supabaseQuery('user_profiles', 'PATCH', updateData, accessToken,
                `?id=eq.${userData.id}`
            );
        }

        console.log('✅ Profile updated:', userData.email);

        res.json({
            success: true,
            message: 'Profile updated',
            user: {
                id: userData.id,
                email: userData.email,
                ...updateData
            }
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});

module.exports = router;
