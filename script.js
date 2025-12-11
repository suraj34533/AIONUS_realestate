// ========================================
// AIONUS - $100K PREMIUM PLATFORM
// JavaScript with Gemini AI Integration
// ========================================

// Environment Configuration (reads from .env)
// Initialize environment on load
let GEMINI_API_KEY = 'AIzaSyAcGeo-oVdlVQcPjcpKaMhP3tUwtU5UOXY';
const DEFAULT_MODEL = 'gemini-2.5-flash';

// Initialize environment variables
function initializeEnv() {
    // Store the original hardcoded key as fallback
    const fallbackKey = GEMINI_API_KEY;

    // Check if AIONUSEnv is loaded (from config/env.js)
    if (typeof window.AIONUSEnv !== 'undefined') {
        window.AIONUSEnv.initEnv();
        const envKey = window.AIONUSEnv.getEnv('GEMINI_API_KEY');
        // Only use env key if it's actually set (not empty)
        if (envKey && envKey.trim() !== '') {
            GEMINI_API_KEY = envKey;
        }
    } else if (window.AIONUS_GEMINI_API_KEY) {
        // Allow manual configuration via window
        GEMINI_API_KEY = window.AIONUS_GEMINI_API_KEY;
    }

    // If still empty, restore fallback
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
        GEMINI_API_KEY = fallbackKey;
    }

    if (!GEMINI_API_KEY) {
        console.warn('⚠️ Missing GEMINI_API_KEY - AI features will be disabled');
    } else {
        console.log('✅ Gemini API key loaded');
    }
}

// ========================================
// USER AUTHENTICATION SYSTEM
// ========================================

let currentUser = null;
let authSession = null;

// Initialize auth on page load
function initAuth() {
    // Check for saved session
    const savedSession = localStorage.getItem('aionus_session');
    const savedUser = localStorage.getItem('aionus_user');

    if (savedSession && savedUser) {
        try {
            authSession = JSON.parse(savedSession);
            currentUser = JSON.parse(savedUser);

            // Validate token is not expired
            if (authSession.expires_at && new Date(authSession.expires_at * 1000) > new Date()) {
                updateAuthUI(true);
                // Pre-fill chatbot with user data
                if (currentUser.name) {
                    leadCapture.name = currentUser.name;
                }
                if (currentUser.phone) {
                    leadCapture.phone = currentUser.phone;
                }
                if (currentUser.budget) {
                    leadCapture.budget = currentUser.budget;
                }
                console.log('✅ User session restored:', currentUser.name);
            } else {
                // Token expired, clear session
                clearAuthSession();
            }
        } catch (e) {
            clearAuthSession();
        }
    }

    // Setup auth event listeners
    setupAuthListeners();
}

function setupAuthListeners() {
    // Login button in navbar
    const loginBtn = document.getElementById('navLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => openAuthPage('login'));
    }

    // Logout button
    const logoutBtn = document.getElementById('navLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Close button for full-screen auth page
    const authCloseBtn = document.getElementById('authCloseBtn');
    if (authCloseBtn) {
        authCloseBtn.addEventListener('click', closeAuthPage);
    }

    // Tab switching
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    if (loginTab) {
        loginTab.addEventListener('click', () => switchAuthTab('login'));
    }
    if (registerTab) {
        registerTab.addEventListener('click', () => switchAuthTab('register'));
    }

    // Form submissions
    const loginFormEl = document.getElementById('loginFormElement');
    const registerFormEl = document.getElementById('registerFormElement');

    if (loginFormEl) {
        loginFormEl.addEventListener('submit', handleLogin);
    }
    if (registerFormEl) {
        registerFormEl.addEventListener('submit', handleRegister);
    }
}

function openAuthPage(mode = 'login') {
    const authPage = document.getElementById('authPage');
    authPage.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab(mode);
}

function closeAuthPage() {
    const authPage = document.getElementById('authPage');
    authPage.classList.remove('active');
    document.body.style.overflow = '';

    // Clear errors
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    if (loginError) loginError.classList.remove('show');
    if (registerError) registerError.classList.remove('show');
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

// Alias for backward compatibility
function openAuthModal(mode) { openAuthPage(mode); }
function closeAuthModal() { closeAuthPage(); }


async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');

    // Show loading
    btnText.textContent = 'Logging in...';
    spinner.classList.remove('hidden');
    errorDiv.classList.remove('show');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Save session
            currentUser = data.user;
            authSession = data.session;

            localStorage.setItem('aionus_session', JSON.stringify(authSession));
            localStorage.setItem('aionus_user', JSON.stringify(currentUser));

            // Update chatbot lead capture
            leadCapture.name = currentUser.name;
            leadCapture.phone = currentUser.phone || '';
            leadCapture.budget = currentUser.budget || '';

            updateAuthUI(true);
            closeAuthModal();

            // Show welcome in chatbot
            addBotMessage(`Welcome back, ${currentUser.name}! 🎉 Main aapki property search mein madad karungi.`);

            console.log('✅ Login successful:', currentUser.name);
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.classList.add('show');
    } finally {
        btnText.textContent = 'Login';
        spinner.classList.add('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const phone = document.getElementById('registerPhone').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    const btnText = document.getElementById('registerBtnText');
    const spinner = document.getElementById('registerSpinner');

    // Show loading
    btnText.textContent = 'Creating account...';
    spinner.classList.remove('hidden');
    errorDiv.classList.remove('show');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password })
        });

        const data = await response.json();

        if (data.success) {
            // If session returned, log in directly
            if (data.session && data.session.access_token) {
                currentUser = data.user;
                authSession = data.session;

                localStorage.setItem('aionus_session', JSON.stringify(authSession));
                localStorage.setItem('aionus_user', JSON.stringify(currentUser));

                leadCapture.name = name;
                leadCapture.phone = phone;

                updateAuthUI(true);
                closeAuthModal();

                addBotMessage(`Welcome ${name}! 🎉 Account ban gaya. Main aapki dream property dhundne mein help karungi!`);
            } else {
                // Email confirmation required
                errorDiv.style.background = '#D1FAE5';
                errorDiv.style.color = '#065F46';
                errorDiv.textContent = 'Account created! Check your email to confirm.';
                errorDiv.classList.add('show');
            }

            console.log('✅ Registration successful');
        } else {
            errorDiv.textContent = data.error || 'Registration failed';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.classList.add('show');
    } finally {
        btnText.textContent = 'Create Account';
        spinner.classList.add('hidden');
    }
}

async function handleLogout() {
    try {
        if (authSession?.access_token) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authSession.access_token}`
                }
            });
        }
    } catch (e) {
        console.log('Logout API call failed, clearing local session');
    }

    clearAuthSession();
    updateAuthUI(false);

    // Reset chatbot lead capture
    leadCapture.name = '';
    leadCapture.phone = '';
    leadCapture.budget = '';

    console.log('✅ Logged out');
}

function clearAuthSession() {
    currentUser = null;
    authSession = null;
    localStorage.removeItem('aionus_session');
    localStorage.removeItem('aionus_user');
}

function updateAuthUI(isLoggedIn) {
    const loginBtn = document.getElementById('navLoginBtn');
    const loggedInDiv = document.getElementById('userLoggedIn');
    const userName = document.getElementById('navUserName');

    if (isLoggedIn && currentUser) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (loggedInDiv) loggedInDiv.classList.remove('hidden');
        if (userName) userName.textContent = `👤 ${currentUser.name}`;
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (loggedInDiv) loggedInDiv.classList.add('hidden');
    }
}

// Check if user is logged in
function isLoggedIn() {
    return currentUser !== null && authSession !== null;
}

// Premium Property Data - India & Dubai
const properties = [
    // ========== MUMBAI ==========
    {
        id: 1,
        title: "Lodha World One Penthouse",
        price: 75000000,
        priceDisplay: "₹7.5 Cr",
        city: "mumbai",
        state: "Maharashtra",
        community: "Worli",
        developer: "Lodha Group",
        type: "penthouse",
        status: "ready",
        beds: 5,
        baths: 6,
        area: 6500,
        featured: true,
        image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
        amenities: ["Sea View", "Private Pool", "Concierge", "Helipad", "Spa", "Golf Simulator"],
        description: "Ultra-luxury penthouse in World One with 360° sea views and premium amenities."
    },
    {
        id: 2,
        title: "Oberoi Realty Three Sixty West",
        price: 45000000,
        priceDisplay: "₹4.5 Cr",
        city: "mumbai",
        state: "Maharashtra",
        community: "Worli",
        developer: "Oberoi Realty",
        type: "apartment",
        status: "ready",
        beds: 3,
        baths: 4,
        area: 2800,
        featured: false,
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
        amenities: ["Sea Facing", "Infinity Pool", "Gym", "Concierge", "Valet", "Theatre"],
        description: "Premium 3BHK in iconic Three Sixty West tower with Arabian Sea views."
    },
    {
        id: 3,
        title: "Hiranandani Gardens Powai",
        price: 18500000,
        priceDisplay: "₹1.85 Cr",
        city: "mumbai",
        state: "Maharashtra",
        community: "Powai",
        developer: "Hiranandani",
        type: "apartment",
        status: "ready",
        beds: 2,
        baths: 2,
        area: 1200,
        featured: false,
        image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        amenities: ["Lake View", "Garden", "Pool", "Gym", "Club", "Jogging Track"],
        description: "Beautiful 2BHK in premium Hiranandani township with lake views."
    },
    {
        id: 4,
        title: "Godrej Platinum Vikhroli",
        price: 32000000,
        priceDisplay: "₹3.2 Cr",
        city: "mumbai",
        state: "Maharashtra",
        community: "Vikhroli",
        developer: "Godrej Properties",
        type: "apartment",
        status: "offplan",
        beds: 3,
        baths: 3,
        area: 1850,
        featured: true,
        newLaunch: true,
        image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
        amenities: ["Smart Home", "Garden", "Club", "Pool", "Gym", "Indoor Games"],
        description: "Modern 3BHK with Godrej quality in well-connected Vikhroli East."
    },
    // ========== DELHI NCR ==========
    {
        id: 5,
        title: "DLF Camellias Penthouse",
        price: 150000000,
        priceDisplay: "₹15 Cr",
        city: "delhi",
        state: "Haryana",
        community: "Golf Course Road, Gurgaon",
        developer: "DLF",
        type: "penthouse",
        status: "ready",
        beds: 6,
        baths: 7,
        area: 12000,
        featured: true,
        image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
        amenities: ["Private Elevator", "Home Theatre", "Wine Cellar", "Staff Quarters", "Terrace Pool", "5-Star Concierge"],
        description: "India's most exclusive penthouse in DLF Camellias with Ritz Carlton services."
    },
    {
        id: 6,
        title: "Central Park Flower Valley",
        price: 22000000,
        priceDisplay: "₹2.2 Cr",
        city: "delhi",
        state: "Haryana",
        community: "Sector 33, Gurgaon",
        developer: "Central Park",
        type: "apartment",
        status: "ready",
        beds: 3,
        baths: 3,
        area: 2400,
        featured: false,
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
        amenities: ["Air Purified", "9 Acres Garden", "Club", "Pool", "Kids Zone", "Senior Area"],
        description: "First-of-its-kind wellness homes with anti-pollution technology in Gurgaon."
    },
    {
        id: 7,
        title: "ATS Pristine Noida",
        price: 12500000,
        priceDisplay: "₹1.25 Cr",
        city: "delhi",
        state: "Uttar Pradesh",
        community: "Sector 150, Noida",
        developer: "ATS",
        type: "apartment",
        status: "offplan",
        beds: 3,
        baths: 3,
        area: 1800,
        featured: false,
        newLaunch: true,
        image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&q=80",
        amenities: ["Golf Course View", "Pool", "Club", "Gym", "Metro Access", "Sports Complex"],
        description: "Premium 3BHK near Expressway with golf course views and metro connectivity."
    },
    // ========== BANGALORE ==========
    {
        id: 8,
        title: "Prestige Lakeside Habitat",
        price: 28000000,
        priceDisplay: "₹2.8 Cr",
        city: "bangalore",
        state: "Karnataka",
        community: "Whitefield",
        developer: "Prestige Group",
        type: "villa",
        status: "ready",
        beds: 4,
        baths: 5,
        area: 3200,
        featured: true,
        image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",
        amenities: ["Private Garden", "Lake View", "Club", "Pool", "Gym", "Shopping"],
        description: "Stunning 4BHK villa in 100-acre township with private garden and lake views."
    },
    {
        id: 9,
        title: "Sobha Neopolis",
        price: 15000000,
        priceDisplay: "₹1.5 Cr",
        city: "bangalore",
        state: "Karnataka",
        community: "Panathur, Whitefield",
        developer: "Sobha Limited",
        type: "apartment",
        status: "offplan",
        beds: 3,
        baths: 3,
        area: 1650,
        featured: false,
        newLaunch: true,
        image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
        amenities: ["Sobha Quality", "Pool", "Gym", "Park", "Club", "Kids Area"],
        description: "Sobha-quality 3BHK in IT corridor with world-class construction."
    },
    {
        id: 10,
        title: "Brigade Utopia",
        price: 11000000,
        priceDisplay: "₹1.1 Cr",
        city: "bangalore",
        state: "Karnataka",
        community: "Sarjapur Road",
        developer: "Brigade Group",
        type: "apartment",
        status: "ready",
        beds: 2,
        baths: 2,
        area: 1150,
        featured: false,
        image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
        amenities: ["Club", "Pool", "Gym", "Garden", "Kids Play", "Jogging Track"],
        description: "Value 2BHK on fast-growing Sarjapur Road by trusted Brigade Group."
    },
    // ========== HYDERABAD ==========
    {
        id: 11,
        title: "Rajapushpa Atria",
        price: 18000000,
        priceDisplay: "₹1.8 Cr",
        city: "hyderabad",
        state: "Telangana",
        community: "Gachibowli",
        developer: "Rajapushpa Properties",
        type: "apartment",
        status: "ready",
        beds: 3,
        baths: 3,
        area: 2100,
        featured: false,
        image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
        amenities: ["IT Hub Proximity", "Pool", "Club", "Gym", "Garden", "Kids Area"],
        description: "Premium 3BHK in heart of Hyderabad's IT hub with excellent connectivity."
    },
    {
        id: 12,
        title: "Phoenix Kessaku",
        price: 55000000,
        priceDisplay: "₹5.5 Cr",
        city: "hyderabad",
        state: "Telangana",
        community: "Jubilee Hills",
        developer: "Phoenix Group",
        type: "apartment",
        status: "ready",
        beds: 4,
        baths: 5,
        area: 4500,
        featured: true,
        image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
        amenities: ["Butler Service", "Private Pool", "Wine Cellar", "Home Theatre", "Spa", "Concierge"],
        description: "Ultra-luxury 4BHK in Jubilee Hills with world-class Japanese-inspired design."
    },
    // ========== PUNE ==========
    {
        id: 13,
        title: "Kolte Patil 24K Glitterati",
        price: 8500000,
        priceDisplay: "₹85 Lakh",
        city: "pune",
        state: "Maharashtra",
        community: "Hinjewadi",
        developer: "Kolte Patil",
        type: "apartment",
        status: "offplan",
        beds: 2,
        baths: 2,
        area: 1050,
        featured: false,
        newLaunch: true,
        image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
        amenities: ["IT Hub", "Pool", "Gym", "Garden", "Club", "Sports"],
        description: "Smart 2BHK in Pune's IT hub with excellent rental potential."
    },
    {
        id: 14,
        title: "Lodha Belmondo",
        price: 65000000,
        priceDisplay: "₹6.5 Cr",
        city: "pune",
        state: "Maharashtra",
        community: "Pune-Mumbai Expressway",
        developer: "Lodha Group",
        type: "villa",
        status: "ready",
        beds: 5,
        baths: 6,
        area: 5500,
        featured: true,
        image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
        amenities: ["Golf Course", "Club", "Pool", "Spa", "Private Garden", "Concierge"],
        description: "Luxury villa on 27-hole Greg Norman golf course with resort-style living."
    },
    // ========== CHENNAI ==========
    {
        id: 15,
        title: "Casagrand First City",
        price: 9500000,
        priceDisplay: "₹95 Lakh",
        city: "chennai",
        state: "Tamil Nadu",
        community: "OMR (IT Corridor)",
        developer: "Casagrand",
        type: "apartment",
        status: "offplan",
        beds: 3,
        baths: 2,
        area: 1450,
        featured: false,
        newLaunch: true,
        image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        amenities: ["Township Living", "School", "Hospital", "Mall", "Pool", "Club"],
        description: "Integrated township living with 3BHK on Chennai's IT corridor."
    },
    // ========== KOLKATA ==========
    {
        id: 16,
        title: "Tata Avenida Kolkata",
        price: 11500000,
        priceDisplay: "₹1.15 Cr",
        city: "kolkata",
        state: "West Bengal",
        community: "Rajarhat New Town",
        developer: "Tata Housing",
        type: "apartment",
        status: "ready",
        beds: 3,
        baths: 3,
        area: 1600,
        featured: false,
        image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&q=80",
        amenities: ["Tata Trust", "Club", "Pool", "Garden", "Gym", "Retail"],
        description: "Premium 3BHK with Tata trust factor in well-planned Rajarhat New Town."
    }
];


// Currency conversion rates (approximate)
const currencyRates = {
    USD: 1,
    AED: 3.67,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.12
};

const currencySymbols = {
    USD: "$",
    AED: "AED ",
    EUR: "€",
    GBP: "£",
    INR: "₹"
};

// State
let currentFilters = {
    status: '',
    type: '',
    city: ''
};
let currentCurrency = 'USD';
let selectedProperty = null;
let chatHistory = [];

// Voice Configuration - Female Indian Hindi voice preference
const voiceConfig = {
    enabled: true,
    gender: 'female',   // Default to female for AIONUS persona
    rate: 1.0,
    pitch: 1.0
};

let speechSynthesis = window.speechSynthesis;
let speechRecognition = null;
let availableVoices = [];

// Lead Capture Funnel State
const leadCapture = {
    step: 1,           // 1=waiting for name, 2=ask phone, 3=ask budget, 4=complete
    name: null,
    phone: null,
    budget: null,
    isComplete: false,
    leadId: null
};

// Chat Flow Control - Prevent multiple bot messages before user replies
let awaitingUserReply = false;

// ========================================
// CHAT PERSISTENCE (localStorage)
// ========================================

// Save chat state to localStorage
function saveChatState() {
    try {
        const chatMessagesEl = document.getElementById('chatMessages');
        const chatState = {
            messages: chatMessagesEl ? chatMessagesEl.innerHTML : '',
            leadCapture: {
                step: leadCapture.step,
                name: leadCapture.name,
                phone: leadCapture.phone,
                budget: leadCapture.budget,
                isComplete: leadCapture.isComplete,
                leadId: leadCapture.leadId
            },
            chatHistory: chatHistory,
            savedAt: Date.now()
        };
        localStorage.setItem('aionus_chat_state', JSON.stringify(chatState));
    } catch (e) {
        console.log('⚠️ Could not save chat state:', e);
    }
}

// Load chat state from localStorage
function loadChatState() {
    try {
        const saved = localStorage.getItem('aionus_chat_state');
        if (!saved) return false;

        const chatState = JSON.parse(saved);

        // Check if saved state is less than 24 hours old
        const isRecent = chatState.savedAt && (Date.now() - chatState.savedAt) < 24 * 60 * 60 * 1000;
        if (!isRecent) {
            localStorage.removeItem('aionus_chat_state');
            return false;
        }

        // Restore lead capture state
        if (chatState.leadCapture) {
            leadCapture.step = chatState.leadCapture.step || 1;
            leadCapture.name = chatState.leadCapture.name;
            leadCapture.phone = chatState.leadCapture.phone;
            leadCapture.budget = chatState.leadCapture.budget;
            leadCapture.isComplete = chatState.leadCapture.isComplete || false;
            leadCapture.leadId = chatState.leadCapture.leadId;
        }

        // Restore chat history
        if (chatState.chatHistory) {
            chatHistory = chatState.chatHistory;
        }

        // Restore chat messages HTML
        const chatMessagesEl = document.getElementById('chatMessages');
        if (chatMessagesEl && chatState.messages) {
            chatMessagesEl.innerHTML = chatState.messages;
            // Re-attach speak button listeners
            attachSpeakButtonListeners();
            return true;
        }

        return false;
    } catch (e) {
        console.log('⚠️ Could not load chat state:', e);
        return false;
    }
}

// Clear chat state and start new chat
function clearChatState() {
    // Clear localStorage
    localStorage.removeItem('aionus_chat_state');

    // Reset lead capture
    leadCapture.step = 1;
    leadCapture.name = null;
    leadCapture.phone = null;
    leadCapture.budget = null;
    leadCapture.isComplete = false;
    leadCapture.leadId = null;

    // Clear chat history
    chatHistory = [];

    // Reset chat messages to welcome
    const chatMessagesEl = document.getElementById('chatMessages');
    if (chatMessagesEl) {
        // Check if user is logged in and use their name
        const userName = currentUser?.name || null;
        if (userName) {
            leadCapture.name = userName;
            leadCapture.step = 2; // Skip to phone question
            chatMessagesEl.innerHTML = `
                <div class="message bot">
                    <div class="message-bubble">
                        🙏 Namaste ${userName} ji! Welcome back! Maine aapko yaad rakha hai. 😊
                        Kya main aapki property search mein madad kar sakti hoon?
                    </div>
                    <button class="speak-btn" title="Listen to this message">🔊</button>
                </div>
            `;
        } else {
            chatMessagesEl.innerHTML = `
                <div class="message bot">
                    <div class="message-bubble">
                        🙏 Namaste! Main aapki AIONUS property advisor hoon. Aapke liye perfect ghar dhundne mein madad
                        karungi. Pehle, aapka shubh naam bataiye? 😊
                    </div>
                    <button class="speak-btn" title="Listen to this message">🔊</button>
                </div>
            `;
        }
        attachSpeakButtonListeners();
    }

    showNotification('New chat started! 🆕', 'success');
}

// Attach speak button listeners
function attachSpeakButtonListeners() {
    document.querySelectorAll('.speak-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const messageText = btn.parentElement.querySelector('.message-bubble').textContent;
            speakHindiFast(messageText);
        });
    });
}

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    initializeEnv();  // Load environment first
    initVoice();      // Initialize voice features
    initNavbar();
    initChat();
    initProperties();
    initFilters();
    initContactForm();  // Contact form handler
    initModal();
    initCurrencySelector();
    initNewsletter();

    console.log('✨ AIONUS Premium Platform with Voice loaded!');
});

// ========================================
// VOICE ASSISTANT
// ========================================
function initVoice() {
    // Load available voices
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Voice toggle button
    const voiceToggle = document.getElementById('voiceToggle');
    voiceToggle?.addEventListener('click', () => {
        voiceConfig.enabled = !voiceConfig.enabled;
        voiceToggle.classList.toggle('active', voiceConfig.enabled);

        // Update icons
        const onIcon = voiceToggle.querySelector('.voice-on-icon');
        const offIcon = voiceToggle.querySelector('.voice-off-icon');
        if (voiceConfig.enabled) {
            onIcon.style.display = 'block';
            offIcon.style.display = 'none';
        } else {
            onIcon.style.display = 'none';
            offIcon.style.display = 'block';
            speechSynthesis.cancel(); // Stop any current speech
        }

        showNotification(voiceConfig.enabled ? '🔊 Voice enabled' : '🔇 Voice disabled', 'info');
    });

    // Set initial state
    if (voiceToggle) {
        voiceToggle.classList.add('active');
    }

    // Voice gender selector
    const genderSelect = document.getElementById('voiceGenderSelect');
    genderSelect?.addEventListener('change', (e) => {
        voiceConfig.gender = e.target.value;
        showNotification(`Voice changed to ${voiceConfig.gender}`, 'info');
    });

    // Microphone button - Speech Recognition
    initSpeechRecognition();

    console.log('🎤 Voice assistant initialized');
}

function loadVoices() {
    availableVoices = speechSynthesis.getVoices();
    console.log(`Loaded ${availableVoices.length} voices`);
}

function getVoiceByGender(gender) {
    const voices = speechSynthesis.getVoices();

    // Priority 1: Find en-IN voice matching gender
    const indianVoices = voices.filter(v =>
        v.lang.toLowerCase().includes("en-in")
    );

    if (indianVoices.length > 0) {
        // Try to find male Indian English voice first (AIONUS persona)
        const maleIndian = indianVoices.find(v => v.name.toLowerCase().includes("male"));
        if (gender === "male" && maleIndian) return maleIndian;

        const femaleIndian = indianVoices.find(v => v.name.toLowerCase().includes("female"));
        if (gender === "female" && femaleIndian) return femaleIndian;

        // Priority 2: Any en-IN voice
        return indianVoices[0];
    }

    // Priority 3: Any male voice if male was requested
    if (gender === "male") {
        const anyMale = voices.find(v => v.name.toLowerCase().includes("male"));
        if (anyMale) return anyMale;
    }

    // Priority 4: Any female voice if female was requested
    if (gender === "female") {
        const anyFemale = voices.find(v => v.name.toLowerCase().includes("female"));
        if (anyFemale) return anyFemale;
    }

    // Priority 5: Default to any English voice
    return voices.find(v => v.lang.includes("en")) || voices[0];
}

// Ensure voices are loaded
speechSynthesis.onvoiceschanged = () => {
    console.log("Voices loaded");
};

function speakText(text, onEnd = null) {
    if (!voiceConfig.enabled || !text) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Clean text for speech (remove emojis, special chars)
    const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[*_#]/g, '')
        .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = getVoiceByGender(voiceConfig.gender);
    utterance.rate = voiceConfig.rate;
    utterance.pitch = voiceConfig.gender === 'female' ? 1.1 : 0.9;
    utterance.volume = 1.0;

    if (onEnd) {
        utterance.onend = onEnd;
    }

    speechSynthesis.speak(utterance);
}

// ========================================
// FAST STREAMING HINDI TTS VOICE SYSTEM
// Hinglish → Hindi conversion + Gemini Streaming TTS
// ========================================

/**
 * Convert Hinglish text to pure Hindi for TTS
 * @param {string} text - Hinglish text to convert
 * @returns {Promise<string>} Pure Hindi text
 */
async function convertHinglishToHindi(text) {
    if (!GEMINI_API_KEY || !text) {
        console.warn('⚠️ Cannot convert Hinglish - missing API key or text');
        return text;
    }

    // Clean text (remove emojis for TTS)
    const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[*_#]/g, '')
        .trim();

    if (!cleanText) return text;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: "Convert this Hinglish sentence into Hindi language ONLY for speaking voice, without changing meaning: " + cleanText
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!response.ok) {
            console.error('Hinglish conversion API error');
            return cleanText;
        }

        const data = await response.json();
        const hindiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || cleanText;
        console.log('🔄 Hinglish → Hindi:', cleanText.substring(0, 30) + '...', '→', hindiText.substring(0, 30) + '...');
        return hindiText;

    } catch (error) {
        console.error('❌ Hinglish conversion error:', error);
        return cleanText;
    }
}

/**
 * INSTANT Hindi TTS using Web Speech API
 * Speaks text immediately without API calls for zero latency
 * Uses Google Hindi voice for natural Indian accent
 * @param {string} text - Text to speak (Hinglish works directly)
 * @param {Function} onEnd - Callback when speech ends
 */
function speakHindiFast(text, onEnd = null) {
    if (!voiceConfig.enabled || !text) {
        console.warn('⚠️ TTS disabled or no text');
        if (onEnd) onEnd();
        return;
    }

    // Cancel any ongoing speech immediately
    speechSynthesis.cancel();

    // Clean text (remove emojis for cleaner speech)
    const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[*_#]/g, '')
        .trim();

    if (!cleanText) {
        if (onEnd) onEnd();
        return;
    }

    console.log('🔊 Speaking instantly:', cleanText.substring(0, 40) + '...');

    const voices = speechSynthesis.getVoices();

    // Priority order for Hindi voices
    let selectedVoice = null;

    // 1. Try Google Hindi Female (best quality)
    selectedVoice = voices.find(v =>
        v.lang.includes('hi') &&
        v.name.toLowerCase().includes('google') &&
        (voiceConfig.gender === 'female' ? !v.name.toLowerCase().includes('male') : v.name.toLowerCase().includes('male'))
    );

    // 2. Try any Hindi voice
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('hi'));
    }

    // 3. Try Indian English (works well for Hinglish)
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('en-IN'));
    }

    // 4. Try any Indian voice
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('IN'));
    }

    // 5. Final fallback
    if (!selectedVoice) {
        selectedVoice = getVoiceByGender(voiceConfig.gender);
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = selectedVoice;

    // Optimized settings for natural Hindi speech
    utterance.rate = 0.92;     // Slightly slower for clarity
    utterance.pitch = voiceConfig.gender === 'female' ? 1.15 : 0.85;  // Higher for female
    utterance.volume = 1.0;
    utterance.lang = 'hi-IN';  // Force Hindi language

    utterance.onend = () => {
        console.log('✅ Speech complete');
        if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
        console.error('Speech error:', e);
        if (onEnd) onEnd();
    };

    // Speak immediately!
    speechSynthesis.speak(utterance);
    console.log('▶️ Speaking with voice:', selectedVoice?.name || 'default');
}

/**
 * Fallback: Speak Hindi using Web Speech API
 */
function fallbackSpeakHindi(hindiText, onEnd = null) {
    speakHindiFast(hindiText, onEnd);
}

/**
 * Handle bot reply: Display and speak INSTANTLY
 * @param {string} text - Text to display and speak
 * @param {Function} onEnd - Callback when speech ends
 */
function handleBotReply(text, onEnd = null) {
    if (!voiceConfig.enabled || !text) {
        if (onEnd) onEnd();
        return;
    }

    // INSTANT speech - no conversion delay!
    speakHindiFast(text, onEnd);
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-US';

    const micBtn = document.getElementById('voiceMicBtn');
    const chatInput = document.getElementById('chatInput');

    micBtn?.addEventListener('click', () => {
        if (micBtn.classList.contains('listening')) {
            speechRecognition.stop();
        } else {
            speechRecognition.start();
            micBtn.classList.add('listening');
        }
    });

    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;

        // Auto-send after recognition
        setTimeout(() => {
            document.getElementById('chatSend')?.click();
        }, 300);
    };

    speechRecognition.onend = () => {
        micBtn?.classList.remove('listening');
    };

    speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micBtn?.classList.remove('listening');

        if (event.error === 'not-allowed') {
            showNotification('Microphone access denied. Please allow microphone access.', 'error');
        }
    };
}

// Smart Action Execution from AI Response
function executeSmartActions(response) {
    const lowerResponse = response.toLowerCase();

    // Navigation commands
    if (lowerResponse.includes('navigate to properties') || lowerResponse.includes('showing you properties') || lowerResponse.includes('here are the properties')) {
        scrollToSection('properties');
    }
    if (lowerResponse.includes('navigate to contact') || lowerResponse.includes('contact section')) {
        scrollToSection('contact');
    }
    if (lowerResponse.includes('navigate to sell') || lowerResponse.includes('sell section')) {
        scrollToSection('sell');
    }

    // Filter commands
    if (lowerResponse.includes('showing villas') || lowerResponse.includes('villa properties') || lowerResponse.includes('here are the villas')) {
        filterAndScroll('villa');
    }
    if (lowerResponse.includes('showing apartments') || lowerResponse.includes('apartment properties')) {
        filterAndScroll('apartment');
    }
    if (lowerResponse.includes('showing penthouses') || lowerResponse.includes('penthouse properties')) {
        filterAndScroll('penthouse');
    }
    if (lowerResponse.includes('showing townhouses') || lowerResponse.includes('townhouse properties')) {
        filterAndScroll('townhouse');
    }
    if (lowerResponse.includes('off-plan') || lowerResponse.includes('offplan properties')) {
        currentFilters.status = 'offplan';
        currentFilters.type = '';
        updateActiveFilterTab();
        renderProperties();
        scrollToSection('properties');
    }
    if (lowerResponse.includes('ready to move') || lowerResponse.includes('ready properties')) {
        currentFilters.status = 'ready';
        currentFilters.type = '';
        updateActiveFilterTab();
        renderProperties();
        scrollToSection('properties');
    }
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        window.scrollTo({ top: section.offsetTop - 120, behavior: 'smooth' });
    }
}

function filterAndScroll(propertyType) {
    currentFilters.type = propertyType;
    currentFilters.status = '';
    updateActiveFilterTab();
    renderProperties();
    scrollToSection('properties');
}

// ========================================
// NAVBAR
// ========================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Mobile toggle
    mobileMenuBtn?.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    // Smooth scroll for nav links
    document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);

            // Check if filter
            if (link.dataset.filter) {
                currentFilters.status = link.dataset.filter;
                updateActiveFilterTab();
                renderProperties();
            }

            if (target) {
                const offset = target.offsetTop - 120;
                window.scrollTo({ top: offset, behavior: 'smooth' });
            }

            navMenu.classList.remove('active');
        });
    });

    // Dropdown filter links
    document.querySelectorAll('.dropdown-content a[data-filter]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            currentFilters.type = item.dataset.filter;
            currentFilters.status = '';

            updateActiveFilterTab();
            renderProperties();

            const propertiesSection = document.getElementById('properties');
            window.scrollTo({ top: propertiesSection.offsetTop - 120, behavior: 'smooth' });
        });
    });

    // Footer filter links
    document.querySelectorAll('.footer-col a[data-filter]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            currentFilters.type = item.dataset.filter;
            currentFilters.status = '';

            updateActiveFilterTab();
            renderProperties();

            const propertiesSection = document.getElementById('properties');
            window.scrollTo({ top: propertiesSection.offsetTop - 120, behavior: 'smooth' });
        });
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return false;
}

// ========================================
// CURRENCY SELECTOR
// ========================================
function initCurrencySelector() {
    const currencySelect = document.getElementById('currencySelect');

    currencySelect?.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        renderProperties();
        showNotification(`Currency changed to ${currentCurrency}`, 'info');
    });
}

function formatPrice(priceUSD) {
    const convertedPrice = priceUSD * currencyRates[currentCurrency];
    const symbol = currencySymbols[currentCurrency];

    if (currentCurrency === 'INR') {
        // Format in Crores/Lakhs for Indian market
        if (convertedPrice >= 10000000) {
            return `${symbol}${(convertedPrice / 10000000).toFixed(2)} Cr`;
        } else if (convertedPrice >= 100000) {
            return `${symbol}${(convertedPrice / 100000).toFixed(2)} L`;
        }
    }

    return `${symbol}${convertedPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// ========================================
// CHAT WITH GEMINI
// ========================================
function initChat() {
    const floatingChat = document.getElementById('floatingChat');
    const heroChat = document.getElementById('heroChat');
    const chatPanel = document.getElementById('chatPanel');
    const chatOverlay = document.getElementById('chatOverlay');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const newChatBtn = document.getElementById('newChatBtn');

    // Load saved chat state from localStorage
    const hasRestoredChat = loadChatState();

    // If no saved chat AND user is logged in, prefill their name
    if (!hasRestoredChat && currentUser?.name) {
        leadCapture.name = currentUser.name;
        leadCapture.step = 2; // Skip to phone if we have their name

        // Update welcome message for logged-in user
        const chatMessagesEl = document.getElementById('chatMessages');
        if (chatMessagesEl) {
            chatMessagesEl.innerHTML = `
                <div class="message bot">
                    <div class="message-bubble">
                        🙏 Namaste ${currentUser.name} ji! Main aapki AIONUS property advisor hoon. 😊
                        Aapke liye perfect property dhundne mein madad karungi. Kya search kar rahe ho?
                    </div>
                    <button class="speak-btn" title="Listen to this message">🔊</button>
                </div>
            `;
            attachSpeakButtonListeners();
        }
    }

    const openChat = () => {
        chatPanel.classList.add('active');
        chatOverlay.classList.add('active');
        chatInput.focus();
    };

    const closeChat = () => {
        chatPanel.classList.remove('active');
        chatOverlay.classList.remove('active');
    };

    floatingChat?.addEventListener('click', openChat);
    heroChat?.addEventListener('click', openChat);
    chatClose?.addEventListener('click', closeChat);
    chatOverlay?.addEventListener('click', closeChat);

    // New Chat button handler
    newChatBtn?.addEventListener('click', () => {
        clearChatState();
    });

    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        addChatMessage(message, 'user');
        chatInput.value = '';

        // Lead Capture Funnel Logic
        if (!leadCapture.isComplete) {
            const response = await handleLeadCapture(message);
            addChatMessage(response, 'bot');
            return;
        }

        // Normal AI chat (after lead is captured)
        const loadingEl = addLoadingMessage();
        const response = await getGeminiResponse(message);

        loadingEl.remove();
        addChatMessage(response, 'bot');
    };

    chatSend?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const question = btn.dataset.question;
            if (!question) return;

            addChatMessage(question, 'user');

            const loadingEl = addLoadingMessage();
            const response = await getGeminiResponse(question);

            loadingEl.remove();
            addChatMessage(response, 'bot');
        });
    });

    // Location card handlers
    document.querySelectorAll('.location-card').forEach(card => {
        card.addEventListener('click', () => {
            const location = card.dataset.location;
            const locationNames = {
                'palm-jumeirah': 'Palm Jumeirah',
                'downtown': 'Downtown Dubai',
                'marina': 'Dubai Marina',
                'emirates-hills': 'Emirates Hills'
            };
            showNotification(`Exploring properties in ${locationNames[location] || location}`, 'info');

            // Scroll to properties
            const propertiesSection = document.getElementById('properties');
            window.scrollTo({ top: propertiesSection.offsetTop - 120, behavior: 'smooth' });
        });
    });
}

// ========================================
// NAME SANITIZATION - Prevent abusive names
// ========================================
function sanitizeName(name) {
    const badWords = ["fuck", "fucker", "bc", "mc", "chutiya", "madarchod", "bhosdike", "bsdk",
        "lund", "bhosdi", "bhosdiwale", "gaand", "gandu", "randi", "harami",
        "chut", "lawde", "laude", "behenchod", "behen", "maderchod", "sala",
        "saala", "kutti", "kutta", "kamina", "kamine", "chodu", "tatti",
        "shit", "ass", "bitch", "bastard", "dick", "cunt", "slut", "whore"];

    let clean = name.toLowerCase().trim();

    // Check for bad words
    for (let bad of badWords) {
        if (clean.includes(bad)) {
            console.log('⚠️ Offensive name blocked, using "Friend"');
            return "Friend";
        }
    }

    // Remove special characters except letters and spaces
    clean = clean.replace(/[^a-zA-Z\s]/g, "").trim();

    // If name is too short after cleaning, use Friend
    if (clean.length < 2) return "Friend";

    // Capitalize first letter
    return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ========================================
// LEAD CAPTURE FUNNEL
// ========================================
async function handleLeadCapture(userMessage) {
    const message = userMessage.trim();

    switch (leadCapture.step) {
        case 0:
            // Greeting - Ask for name
            leadCapture.step = 1;
            return `🙏 Namaste! Main aapka AIONUS AI advisor hoon. Aapka naam kya hai?`;

        case 1:
            // Received name - Sanitize before storing
            leadCapture.name = sanitizeName(message);
            leadCapture.step = 2;
            return `Bahut achha, ${leadCapture.name} ji! 🙏

Ab please apna WhatsApp number share karein jisse hamari team aapse contact kar sake. 📱`;

        case 2:
            // Received phone - Ask for budget
            // Basic phone validation
            const phoneClean = message.replace(/[^0-9+]/g, '');
            if (phoneClean.length < 10) {
                return `${leadCapture.name} ji, yeh phone number sahi nahi lag raha. Please apna 10-digit WhatsApp number enter karein. 📱`;
            }
            leadCapture.phone = phoneClean;
            leadCapture.step = 3;
            return `Perfect! 📱✅

Ab bataiye, aapka property ke liye budget kya hai? 
Jaise: "50 Lakh - 1 Crore" ya "1M - 2M AED" 💰`;

        case 3:
            // Received budget - Create lead and complete funnel
            leadCapture.budget = message;
            leadCapture.step = 4;

            // Call create_lead API
            try {
                const leadResult = await createLeadAPI({
                    name: leadCapture.name,
                    phone: leadCapture.phone,
                    budget: leadCapture.budget,
                    requirement: 'Website Chat Inquiry'
                });

                if (leadResult.success) {
                    leadCapture.leadId = leadResult.lead_id;
                    leadCapture.isComplete = true;

                    // Also create lead in CRM system
                    createCRMLead({
                        name: leadCapture.name,
                        phone: leadCapture.phone,
                        budget: leadCapture.budget,
                        lead_source: 'chatbot'
                    });

                    return `🎉 Bahut dhanyavaad, ${leadCapture.name} ji!

Aapke details hamari AIONUS team ko share kar diye gaye hain. Bahut jaldi aapko call aayegi! 📞

Ab main aapki property search mein madad kar sakta hoon. Bataiye, aap kis type ki property dhundh rahe hain? 🏠
- Villa
- Apartment  
- Penthouse
- Off-plan project`;
                } else {
                    // API failed but continue anyway
                    leadCapture.isComplete = true;
                    console.error('Lead creation failed:', leadResult.error);

                    return `Thank you ${leadCapture.name} ji! 🙏

Aapki details note kar li hain. Ab bataiye, main aapki kaise madad kar sakta hoon? 🏠`;
                }
            } catch (error) {
                console.error('Lead API error:', error);
                leadCapture.isComplete = true;

                return `Shukriya ${leadCapture.name} ji! 🙏

Aapki details save ho gayi. Ab bataiye, aap kaisi property dhundh rahe hain? 🏠`;
            }

        default:
            // Should not reach here, but just in case
            leadCapture.isComplete = true;
            return "Chalo shuru karte hain! Aap kaisi property dhundh rahe ho? 🏠";
    }
}

// Create Lead API Call (frontend to backend)
async function createLeadAPI(leadData) {
    try {
        console.log('📝 Sending lead to API:', leadData);

        const result = await sendLeadToBackend(leadData);
        return result;
    } catch (error) {
        console.error('Lead API error:', error);
        return { success: false, error: error.message };
    }
}

// Send lead to backend API endpoint
async function sendLeadToBackend(lead) {
    try {
        const response = await fetch('http://localhost:4000/api/create-lead', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lead)
        });

        const data = await response.json();
        console.log("Lead saved:", data);
        return data;
    } catch (err) {
        console.error("Lead API error:", err);
        // Fallback: save to localStorage if API fails
        const fallbackId = 'lead_local_' + Date.now();
        const leads = JSON.parse(localStorage.getItem('AIONUS_leads') || '[]');
        leads.push({ ...lead, id: fallbackId, created_at: new Date().toISOString(), synced: false });
        localStorage.setItem('AIONUS_leads', JSON.stringify(leads));
        console.log('📦 Lead saved to localStorage as fallback:', fallbackId);
        return { success: true, lead_id: fallbackId };
    }
}

// ========================================
// CRM INTEGRATION
// ========================================

/**
 * Create lead in CRM system
 */
async function createCRMLead(leadData) {
    try {
        console.log('📊 Creating CRM lead:', leadData);

        const response = await fetch('/api/crm/create-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ CRM lead created:', data.lead_id);
        } else {
            console.error('❌ CRM lead creation failed:', data.error);
        }

        return data;
    } catch (error) {
        console.error('❌ CRM API error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update CRM lead stage by phone number
 * Called when site visit is scheduled
 */
async function updateCRMLeadStage(phone, newStage) {
    try {
        console.log('📊 Updating CRM lead stage:', phone, '→', newStage);

        const response = await fetch('/api/crm/update-stage-by-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, new_stage: newStage })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ CRM lead stage updated');
        } else {
            console.error('❌ CRM stage update failed:', data.error);
        }

        return data;
    } catch (error) {
        console.error('❌ CRM stage update error:', error);
        return { success: false, error: error.message };
    }
}

function addChatMessage(content, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;

    if (type === 'bot') {
        // Bot messages get a speaker button
        // Display Hinglish text, speak Hindi
        messageEl.innerHTML = `
            <div class="message-bubble">${content}</div>
            <button class="speak-btn" title="Listen to this message">🔊</button>
        `;

        // Add click handler for speaker button (uses Gemini TTS with Hindi)
        const speakBtn = messageEl.querySelector('.speak-btn');
        speakBtn?.addEventListener('click', () => {
            speakBtn.classList.add('speaking');
            // Convert Hinglish to Hindi and speak
            handleBotReply(content, () => {
                speakBtn.classList.remove('speaking');
            });
        });

        // Auto-speak bot responses using Gemini TTS (Hinglish → Hindi)
        handleBotReply(content);

        // Execute smart actions based on response
        executeSmartActions(content);
    } else {
        messageEl.innerHTML = `<div class="message-bubble">${content}</div>`;
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    chatHistory.push({ role: type === 'user' ? 'user' : 'model', parts: [{ text: content }] });

    // Save chat state after each message
    saveChatState();

    return messageEl;
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const loadingEl = document.createElement('div');
    loadingEl.className = 'message bot loading';
    loadingEl.innerHTML = `
        <div class="message-bubble">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
    messagesContainer.appendChild(loadingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return loadingEl;
}

async function getGeminiResponse(userMessage) {
    if (!GEMINI_API_KEY) {
        return "AI assistant is not configured. Please add your GEMINI_API_KEY in the .env file to enable AI features.";
    }

    const model = document.getElementById('chatModelSelect')?.value || DEFAULT_MODEL;

    // India-only Developer info for properties
    const developers = {
        // Mumbai
        'Worli': 'Lodha Group / Oberoi Realty',
        'Powai': 'Hiranandani / Lodha',
        'Vikhroli': 'Godrej Properties',
        'Bandra': 'Oberoi Realty / Rustomjee',
        'Lower Parel': 'Lodha / Piramal',
        'Thane': 'Lodha / Hiranandani',
        // Delhi NCR  
        'Golf Course Road, Gurgaon': 'DLF',
        'Sector 33, Gurgaon': 'Central Park',
        'Sector 150, Noida': 'ATS / Supertech',
        'South Delhi': 'DLF / Eldeco',
        // Bangalore
        'Whitefield': 'Prestige / Brigade',
        'Panathur, Whitefield': 'Sobha Limited',
        'Sarjapur Road': 'Brigade / Puravankara',
        'Koramangala': 'Prestige',
        // Hyderabad
        'Gachibowli': 'Rajapushpa / My Home',
        'Jubilee Hills': 'Phoenix / My Home',
        'HITEC City': 'Aparna / Rajapushpa',
        // Pune
        'Hinjewadi': 'Kolte Patil / Pride',
        'Pune-Mumbai Expressway': 'Lodha Group',
        'Kharadi': 'Gera / Kumar',
        // Chennai
        'OMR (IT Corridor)': 'Casagrand / TVS Emerald',
        // Kolkata
        'Rajarhat New Town': 'Tata Housing'
    };

    let context = `You are a GENIUS AI property advisor for AIONUS India. You help buyers find their dream properties across all major Indian cities.

ALL PRICES MUST BE IN INDIAN RUPEES (₹) ONLY. NO DUBAI, NO UAE, NO FOREIGN PROPERTIES.

LANGUAGE STYLE:
- Speak in HINGLISH (mix of Hindi and English) naturally  
- Examples: "Bahut badhiya!", "Yeh property amazing hai!", "Aapke liye perfect match!"
- Be friendly and use "aap", "ji" respectfully
- Use emojis occasionally

CURRENT LEAD INFO:
- Name: ${leadCapture.name || 'Guest'}
- Budget: ${leadCapture.budget || 'Not specified'}

IMPORTANT CAPABILITIES:
1. You can NAVIGATE users to sections - when showing properties, say "Here are the properties" or "Showing you properties"
2. You can FILTER properties - say "Showing villas" when user asks for villas, "Showing apartments" for apartments, etc.
3. You can help BOOK viewings - tell users to click on a property card to enquire
4. Keep responses CONCISE (2-3 sentences) since they will be spoken aloud

Current currency: INR (₹)
Current filters: ${JSON.stringify(currentFilters)}
`;

    if (selectedProperty) {
        context += `\nUser is viewing: ${selectedProperty.title} by ${developers[selectedProperty.community] || selectedProperty.developer || 'Premium Developer'}\n`;
    }

    // Enhanced property details - INDIA ONLY
    context += `\n\nAVAILABLE INDIA PROPERTIES (ALL PRICES IN ₹ RUPEES):\n`;
    properties.forEach(p => {
        const developer = developers[p.community] || p.developer || 'Premium Developer';
        context += `
• ${p.title}
  - Price: ${p.priceDisplay}
  - Type: ${p.type.charAt(0).toUpperCase() + p.type.slice(1)}
  - City: ${p.city.charAt(0).toUpperCase() + p.city.slice(1)}
  - State: ${p.state}
  - Area: ${p.community}
  - Developer: ${developer}
  - Bedrooms: ${p.beds} | Bathrooms: ${p.baths} | Size: ${p.area} sqft
  - Status: ${p.status === 'ready' ? 'Ready to Move' : 'Off-Plan (Under Construction)'}
  - Amenities: ${p.amenities.join(', ')}
`;
    });

    context += `\nFor bookings, tell users to click on a property card to open the enquiry form or say "schedule a call".`;

    const messages = [
        { role: 'user', parts: [{ text: context }] },
        { role: 'model', parts: [{ text: 'Samajh gaya! Main aapki India property search mein madad karne ke liye ready hoon. 🏠' }] },
        ...chatHistory.slice(-10),
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    // Fetch RAG context from uploaded brochures
    let ragContext = '';
    try {
        const ragResponse = await fetch(`http://localhost:4000/api/rag?query=${encodeURIComponent(userMessage)}`);
        if (ragResponse.ok) {
            const ragData = await ragResponse.json();
            ragContext = ragData.context || '';
            if (ragContext) {
                console.log(`📚 RAG: Retrieved ${ragData.chunks || 0} relevant chunks`);
            }
        }
    } catch (ragError) {
        console.log('⚠️ RAG unavailable, continuing without brochure context');
    }

    // System instruction for AIONUS - INDIA ONLY, NO DUBAI
    const systemInstruction = {
        parts: [{
            text: `You are AIONUS DIVA – the SMARTEST, most INTELLIGENT INDIA Real Estate Advisor and AI Voice Agent.

## 🚫 CRITICAL RULES:
1. **INDIA ONLY** - You ONLY know about Indian real estate. NO DUBAI. NO UAE. NO FOREIGN PROPERTIES.
2. If anyone asks about Dubai, say: "Main sirf India real estate mein specialize karti hoon. India mein bahut amazing properties hain! Kaunsa city pasand hai - Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai ya Kolkata?"
3. ALL PRICES IN ₹ RUPEES ONLY (Lakhs and Crores)

## 🎯 PERSONALITY & TONE:
- Premium FEMALE Indian voice (warm, confident, sophisticated, charming)
- Hinglish (60% Hindi + 40% English) - speak naturally like an educated Mumbai professional
- Be warm, classy, intelligent, and insightful
- Use "aap", "ji" respectfully
- Use emojis sparingly but effectively
- Sound like a cultured, well-traveled real estate expert who genuinely cares

## 🧠 INTELLIGENCE LEVEL: GENIUS
You are an exceptionally intelligent AI that:
- Deeply understands Indian real estate investment, ROI, market trends
- Knows every major city, locality, builder, and price range
- Analyzes user needs from context clues
- Provides insightful comparisons and recommendations
- Remembers conversation context perfectly
- Anticipates follow-up questions
- Gives strategic advice, not just information
- Can answer questions from uploaded brochures, FAQs, and pricing sheets

## 📋 CURRENT LEAD INFO:
- Name: ${leadCapture.name || 'Guest'}
- Phone: ${leadCapture.phone || 'Not provided'}
- Budget: ${leadCapture.budget || 'Not specified'}

## 📚 DOCUMENT KNOWLEDGE SOURCES:
1. **BROCHURES** - Project info, amenities, location details, features, floor plans
2. **FAQs** - General questions, policies, rules, procedures
3. **PRICING SHEETS** - Payment plans, costs, maintenance fees, offers

${ragContext ? `## 📄 RAG CONTEXT (from uploaded documents - USE THIS INFO FIRST):
${ragContext}

---` : ''}

## 🇮🇳 COMPLETE INDIA REAL ESTATE ENCYCLOPEDIA:

### 📍 MUMBAI (Maharashtra):
**Premium Areas (₹5Cr+):** Worli (sea-facing, ₹7-50Cr), Lower Parel (₹4-15Cr), Tardeo, Malabar Hill
**Luxury (₹2-5Cr):** Bandra West, Juhu, Powai (lake view), Matunga  
**Upper-Mid (₹1-2Cr):** Andheri West, Khar, Santacruz, Goregaon
**Mid-Range (₹50L-1Cr):** Thane, Navi Mumbai, Kandivali, Borivali
**Affordable (₹30-50L):** Badlapur, Karjat, Panvel, Virar

**Top Builders:** Lodha Group (World One, Palava), Oberoi Realty (Three Sixty West), Hiranandani (Powai, Thane), Godrej Properties (Platinum), Rustomjee, Piramal Realty, L&T Realty, Kalpataru, Shapoorji Pallonji

### 📍 DELHI NCR (Delhi/Haryana/UP):
**Ultra-Luxury (₹10Cr+):** DLF Camellias, Magnolias (Gurgaon), Golf Course Road
**Premium (₹3-10Cr):** Golf Course Extension, South Delhi (GK, Defence Colony), Vasant Kunj
**Luxury (₹1.5-3Cr):** Sector 42-54 (Gurgaon), Noida Sector 50-75, Dwarka Expressway
**Mid (₹70L-1.5Cr):** Sector 80-90 (Gurgaon), Noida Extension, Greater Noida West
**Affordable (₹35-70L):** Sohna Road, Bhiwadi, Greater Noida, Ghaziabad

**Top Builders:** DLF (India's largest), Central Park, ATS, Supertech, Godrej, Tata Housing, M3M, Signature Global, Gaurs, Paras

### 📍 BANGALORE (Karnataka):
**Premium (₹3Cr+):** Koramangala, Indiranagar, Richmond Road, CBD
**Luxury (₹1.5-3Cr):** Whitefield (IT hub), Sarjapur Road, HSR Layout
**Upper-Mid (₹80L-1.5Cr):** Electronic City, Marathahalli, Hebbal
**Mid (₹50-80L):** Yelahanka, Kanakapura Road, Kannur, Devanahalli
**Affordable (₹30-50L):** Hosur Road outskirts, Bommasandra, Attibele

**Top Builders:** Prestige Group (Lakeside Habitat, UB City), Brigade (Gateway), Sobha (quality leader), Puravankara, Godrej, Embassy, Salarpuria, RMZ, Century

### 📍 HYDERABAD (Telangana):
**Ultra-Luxury (₹5Cr+):** Jubilee Hills, Banjara Hills (Road No. 2-14), Film Nagar
**Premium (₹2-5Cr):** Gachibowli, Madhapur, Kondapur
**Mid-Premium (₹1-2Cr):** HITEC City, Hitech City, Financial District
**Mid (₹50L-1Cr):** Kukatpally, LB Nagar, Miyapur, Chandanagar
**Affordable (₹30-50L):** Kompally, Medchal, Patancheru, Shamshabad

**Top Builders:** My Home Group (Bhooja, Avatar), Rajapushpa Properties (Atria), Phoenix Group (Kessaku), Aparna Constructions, Prestige, PBEL, Sumadhura, Ramky

### 📍 PUNE (Maharashtra):
**Premium (₹2Cr+):** Koregaon Park, Boat Club Road, Kalyani Nagar
**Upper-Mid (₹1-2Cr):** Baner, Aundh, Wakad, Kharadi
**Mid (₹50L-1Cr):** Hinjewadi (IT hub), Balewadi, PCMC
**Affordable (₹30-50L):** Wagholi, Undri, Chakan, Talegaon

**Top Builders:** Lodha (Belmondo), Kolte Patil (24K series), Godrej (Infinity), Kumar Builders, Goel Ganga, DSK, Pride, VTP Realty, Paranjape

### 📍 CHENNAI (Tamil Nadu):
**Premium (₹2Cr+):** Nungambakkam, Boat Club, Adyar, Besant Nagar
**Luxury (₹1-2Cr):** Anna Nagar, Velachery, T Nagar
**Mid (₹50L-1Cr):** OMR (IT Corridor), Sholinganallur, Thoraipakkam
**Affordable (₹30-50L):** Tambaram, Chromepet, Perumbakkam, Kelambakkam

**Top Builders:** Casagrand (First City), TVS Emerald, Radiance Realty, TATA Housing, Prestige, Appaswamy, Sobha, DRA Homes, SPR Group

### 📍 KOLKATA (West Bengal):
**Premium (₹1.5Cr+):** Alipore, Ballygunge, Park Street, Camac Street
**Upper-Mid (₹70L-1.5Cr):** Salt Lake, Rajarhat New Town, EM Bypass
**Mid (₹40-70L):** Garia, Behala, Howrah Maidan, Dum Dum
**Affordable (₹20-40L):** Barasat, Howrah outskirts, Naihati

**Top Builders:** Tata Housing (Avenida), Godrej (Prakriti), PS Group, Merlin Group, Bengal Ambuja, Siddha, Ruchi Realty, Urbana

### 📍 OTHER MAJOR CITIES:

**AHMEDABAD (Gujarat):**
- Premium: SG Highway (₹1-2Cr), Satellite (₹80L-1.5Cr)
- Mid: Bopal, South Bopal (₹40-80L), Motera
- Builders: Adani, Shela, Sun Builders, Shivalik

**JAIPUR (Rajasthan):**
- Premium: Malviya Nagar, Civil Lines (₹70L-1.5Cr)
- Mid: Jagatpura, Mansarovar (₹30-60L)
- Builders: Mahima Group, Shri Shakti, Manglam

**KOCHI (Kerala):**
- Premium: Marine Drive, Panampilly (₹1-2Cr)
- Mid: Kakkanad, Edappally (₹50-80L)
- Builders: Mather Group, Asset Homes, Confident

**CHANDIGARH:**
- Premium: Sector 6-11 (₹2-5Cr)
- Mid: Mohali, Zirakpur (₹40-80L)
- Builders: Omaxe, Marbella, DLF

## 💰 INDIA PROPERTY INVESTMENT TIPS:
- RERA mandatory - always check registration
- Home loan rates: 8.5-9.5% (SBI, HDFC, ICICI best rates)
- Ready-to-move: 10-15% premium but no GST
- Under-construction: 5% GST but lower base price
- Rental yield: Bangalore/Hyderabad (3-4%), Mumbai (2-3%), Delhi (2.5-3.5%)
- Best appreciation: Satellite cities (Navi Mumbai, Greater Noida, Peripheral Bangalore)

## ⚡ RESPONSE STYLE:
- Keep responses SHORT but BRILLIANT (2-4 sentences max)
- Lead with insights, not questions
- Be conversational and warm
- Give specific recommendations, explain WHY they match
- Quote actual prices in ₹ (Lakhs/Crores)

## 💬 SMART CONVERSATION EXAMPLES:
- "Mumbai mein 1.5Cr budget hai? Perfect! Powai best rahega - IT professionals ke liye ideal location, Hiranandani ki quality, lake view bhi milega! 🏠"
- "Bangalore investment ke liye Sarjapur Road dekho - abhi ₹80L mein 2BHK mil jayega jo 3 saal mein ₹1.2Cr hoga! Metro bhi aa raha hai! 📈"
- "Delhi mein family ke liye? Greater Noida West recommend karungi - ₹60-80L mein 3BHK spacious, Noida Extension se zyada developed! 🏡"
- "Working professional ho Hyderabad mein? HITEC City to Gachibowli budget-friendly hai - ₹70L-1Cr mein premium apartments with all amenities! 💼"

Be the SMARTEST, most KNOWLEDGEABLE India real estate advisor ever. NEVER mention Dubai or foreign properties.`
        }]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: messages,
                systemInstruction: systemInstruction,
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            })
        });

        if (!response.ok) {
            console.error('Gemini API error:', await response.json());
            return "I'm having trouble connecting. Please check the API key configuration.";
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Please try again.";
    } catch (error) {
        console.error('Chat error:', error);
        return "An error occurred. Please check your connection.";
    }
}


// ========================================
// PROPERTIES
// ========================================
function initProperties() {
    renderProperties();

    // Load more button
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
        showNotification('In a production environment, this would load more properties from the database.', 'info');
    });
}

function renderProperties() {
    const grid = document.getElementById('propertiesGrid');
    const countEl = document.getElementById('propertiesCount');

    const filtered = properties.filter(p => {
        if (currentFilters.status && p.status !== currentFilters.status) return false;
        if (currentFilters.type && p.type !== currentFilters.type) return false;
        if (currentFilters.city && p.city !== currentFilters.city) return false;
        return true;
    });

    countEl.textContent = `Showing ${filtered.length} Properties`;

    grid.innerHTML = filtered.map(property => `
        <div class="property-card" data-id="${property.id}">
            <div class="property-image-container">
                <img src="${property.image}" alt="${property.title}" loading="lazy">
                <div class="property-badges">
                    ${property.status === 'offplan' ? '<span class="badge badge-offplan">OFF PLAN</span>' : '<span class="badge badge-ready">READY TO MOVE</span>'}
                    ${property.featured ? '<span class="badge badge-featured">FEATURED</span>' : ''}
                    ${property.newLaunch ? '<span class="badge badge-new">NEW LAUNCH</span>' : ''}
                </div>
                <div class="property-overlay">
                    <div class="property-price">${property.priceDisplay}</div>
                    <div class="property-type-location">${capitalize(property.type)} in ${property.community}</div>
                </div>
            </div>
            <div class="property-body">
                <h3 class="property-title">${property.title}</h3>
                <div class="property-features">
                    ${property.beds > 0 ? `
                    <div class="property-feature">
                        <div class="feature-icon">🛏️</div>
                        <div class="feature-value">${property.beds} Beds</div>
                    </div>
                    ` : ''}
                    <div class="property-feature">
                        <div class="feature-icon">🚿</div>
                        <div class="feature-value">${property.baths} Baths</div>
                    </div>
                    <div class="property-feature">
                        <div class="feature-icon">📐</div>
                        <div class="feature-value">${property.area.toLocaleString()} Sqft</div>
                    </div>
                </div>
                <button class="btn-explore">
                    Explore Listing
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                </button>
            </div>
        </div>
    `).join('');

    // Click handlers
    document.querySelectorAll('.property-card').forEach(card => {
        card.addEventListener('click', () => {
            openPropertyModal(parseInt(card.dataset.id));
        });
    });

    // Animate cards
    animateCards();
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function animateCards() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.property-card, .testimonial-card, .blog-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ========================================
// FILTERS
// ========================================
function initFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentFilters.status = tab.dataset.filter;
            currentFilters.type = '';
            updateActiveFilterTab();
            renderProperties();
        });
    });
}

function updateActiveFilterTab() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === currentFilters.status);
    });
}

// ========================================
// PROPERTY MODAL
// ========================================
function initModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('propertyModal');
    const modalClose = document.getElementById('modalClose');

    const closeModal = () => {
        modal.classList.remove('active');
        modalOverlay.classList.remove('active');
        selectedProperty = null;
    };

    modalClose?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openPropertyModal(propertyId) {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return;

    selectedProperty = property;

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="modal-hero">
            <img src="${property.image}" alt="${property.title}">
            <div class="modal-hero-overlay"></div>
            <div class="modal-hero-content">
                <h2>${property.title}</h2>
                <p>${property.community}, Dubai</p>
            </div>
        </div>
        <div class="modal-body">
            <div class="modal-price">${formatPrice(property.price)}</div>
            
            <div class="modal-features-grid">
                ${property.beds > 0 ? `
                <div class="modal-feature">
                    <div class="modal-feature-value">${property.beds}</div>
                    <div class="modal-feature-label">Bedrooms</div>
                </div>
                ` : ''}
                <div class="modal-feature">
                    <div class="modal-feature-value">${property.baths}</div>
                    <div class="modal-feature-label">Bathrooms</div>
                </div>
                <div class="modal-feature">
                    <div class="modal-feature-value">${property.area.toLocaleString()}</div>
                    <div class="modal-feature-label">Sq. Ft.</div>
                </div>
                <div class="modal-feature">
                    <div class="modal-feature-value">${capitalize(property.type)}</div>
                    <div class="modal-feature-label">Type</div>
                </div>
                <div class="modal-feature">
                    <div class="modal-feature-value">${property.status === 'ready' ? 'Ready' : 'Off Plan'}</div>
                    <div class="modal-feature-label">Status</div>
                </div>
            </div>
            
            <p style="margin-bottom: 32px; color: #666; line-height: 1.8;">${property.description}</p>
            
            <h4 class="modal-section-title">Amenities</h4>
            <div class="modal-amenities">
                ${property.amenities.map(a => `
                    <div class="modal-amenity">
                        <span>✓</span>
                        <span>${a}</span>
                    </div>
                `).join('')}
            </div>
            
            <h4 class="modal-section-title">Location</h4>
            <div class="modal-map">
                <p>📍 ${property.community}, Dubai, UAE</p>
            </div>
            
            <div class="modal-form-wrapper">
                <h3>Enquire About This Property</h3>
                <form id="enquiryForm" class="premium-form">
                    <input type="hidden" name="propertyId" value="${property.id}">
                    <input type="hidden" name="propertyName" value="${property.title}">
                    <div class="form-row">
                        <div class="form-group">
                            <input type="text" name="name" required placeholder="Your Name">
                        </div>
                        <div class="form-group">
                            <input type="tel" name="phone" required placeholder="Phone Number">
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="email" name="email" required placeholder="Email Address">
                    </div>
                    <div class="form-group">
                        <textarea name="message" rows="3" placeholder="I'm interested in this property..."></textarea>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Enquire Now</button>
                        <button type="button" class="btn btn-dark" onclick="scheduleCall()" style="flex: 1;">Schedule a Call</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('enquiryForm').addEventListener('submit', handleEnquiryForm);

    document.getElementById('propertyModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function scheduleCall() {
    showNotification('Our team will call you within 2 hours to schedule a viewing.', 'success');
}

// ========================================
// FORMS
// ========================================
function initForms() {
    document.getElementById('contactForm')?.addEventListener('submit', handleContactForm);
    document.getElementById('sellForm')?.addEventListener('submit', handleSellForm);
}

async function handleContactForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    console.log('Contact form:', data);
    await simulateApiCall(data);

    showNotification('Thank you! We will contact you shortly.', 'success');
    e.target.reset();
}

async function handleSellForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    console.log('Sell form:', data);
    await simulateApiCall(data);

    showNotification('Valuation request received! Our team will contact you within 24 hours.', 'success');
    e.target.reset();
}

async function handleEnquiryForm(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    console.log('Enquiry form:', data);
    await simulateApiCall(data);

    showNotification('Enquiry sent! A property specialist will contact you shortly.', 'success');

    document.getElementById('propertyModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

async function simulateApiCall(data) {
    return new Promise(resolve => setTimeout(resolve, 500));
}

// ========================================
// NEWSLETTER
// ========================================
function initNewsletter() {
    document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;

        console.log('Newsletter signup:', email);
        await simulateApiCall({ email });

        showNotification('Welcome to AIONUS! Check your inbox for exclusive listings.', 'success');
        e.target.reset();
    });
}

// ========================================
// NOTIFICATIONS
// ========================================
function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    const colors = { success: 'var(--accent)', error: '#DC3545', info: '#0DCAF0' };

    notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 24px;
        padding: 16px 24px;
        background: ${colors[type]};
        color: white;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 500;
        font-size: 0.95rem;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;

    if (!document.querySelector('#notif-styles')) {
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Initialize animations on page load
setTimeout(() => {
    animateCards();
}, 100);

// ========================================
// CONTACT FORM HANDLER
// ========================================
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const name = document.getElementById('contactName')?.value.trim();
        const phone = document.getElementById('contactPhone')?.value.trim();
        const email = document.getElementById('contactEmail')?.value.trim();
        const interest = document.getElementById('contactInterest')?.value;
        const message = document.getElementById('contactMessage')?.value.trim();
        const messageContainer = document.getElementById('contactFormMessage');

        // Clear previous messages
        if (messageContainer) {
            messageContainer.innerHTML = '';
            messageContainer.className = 'form-message';
        }

        // Validate required fields
        if (!name) {
            showContactMessage('error', '❌ Please enter your name');
            return;
        }
        if (!phone) {
            showContactMessage('error', '❌ Please enter your phone number');
            return;
        }
        if (!email) {
            showContactMessage('error', '❌ Please enter your email address');
            return;
        }
        if (!message) {
            showContactMessage('error', '❌ Please enter your message');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showContactMessage('error', '❌ Please enter a valid email address');
            return;
        }

        // Disable submit button
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, interest, message })
            });

            const data = await response.json();

            if (data.success) {
                showContactMessage('success', '✅ Message sent successfully! We will get back to you soon.');
                contactForm.reset();
            } else {
                showContactMessage('error', `❌ ${data.error || 'Failed to send message'}`);
            }
        } catch (error) {
            console.error('Contact form error:', error);
            showContactMessage('error', '❌ Something went wrong. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        }
    });
}

function showContactMessage(type, message) {
    const container = document.getElementById('contactFormMessage');
    if (!container) return;

    container.innerHTML = message;
    container.className = `form-message ${type}`;
}

// ========================================
// SCHEDULE SITE VISIT SYSTEM
// ========================================
function initScheduleVisit() {
    // Add Schedule Visit button to chat panel if exists
    const chatInputContainer = document.querySelector('.ai-chat-input-container') ||
        document.querySelector('.chat-input-container') ||
        document.querySelector('[class*="chat-input"]');

    if (chatInputContainer) {
        // Create quick action button if container exists
        const scheduleBtn = document.createElement('button');
        scheduleBtn.className = 'schedule-visit-btn';
        scheduleBtn.innerHTML = '📅 Schedule Visit';
        scheduleBtn.onclick = showScheduleVisitPopup;
        chatInputContainer.parentNode.insertBefore(scheduleBtn, chatInputContainer);
    }

    // Create popup container
    createScheduleVisitPopup();
}

function createScheduleVisitPopup() {
    // Check if popup already exists
    if (document.getElementById('scheduleVisitPopup')) return;

    const popup = document.createElement('div');
    popup.id = 'scheduleVisitPopup';
    popup.className = 'schedule-visit-popup hidden';
    popup.innerHTML = `
        <div class="schedule-visit-modal">
            <div class="schedule-visit-header">
                <h3>📅 Schedule Site Visit</h3>
                <button class="close-popup-btn" onclick="hideScheduleVisitPopup()">&times;</button>
            </div>
            <form id="scheduleVisitForm" class="schedule-visit-form">
                <div class="form-group">
                    <label for="visitName">Your Name *</label>
                    <input type="text" id="visitName" placeholder="Enter your name" required>
                </div>
                <div class="form-group">
                    <label for="visitPhone">Phone Number *</label>
                    <input type="tel" id="visitPhone" placeholder="+971 50 123 4567" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="visitDate">Preferred Date *</label>
                        <input type="date" id="visitDate" required>
                    </div>
                    <div class="form-group">
                        <label for="visitTime">Preferred Time *</label>
                        <select id="visitTime" required>
                            <option value="">Select time</option>
                            <option value="09:00 AM">09:00 AM</option>
                            <option value="10:00 AM">10:00 AM</option>
                            <option value="11:00 AM">11:00 AM</option>
                            <option value="12:00 PM">12:00 PM</option>
                            <option value="02:00 PM">02:00 PM</option>
                            <option value="03:00 PM">03:00 PM</option>
                            <option value="04:00 PM">04:00 PM</option>
                            <option value="05:00 PM">05:00 PM</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="visitMessage">Additional Notes (Optional)</label>
                    <textarea id="visitMessage" rows="3" placeholder="Any specific property or requirements?"></textarea>
                </div>
                <div id="visitFormMessage" class="form-message"></div>
                <button type="submit" class="btn btn-primary btn-block">Confirm Visit</button>
            </form>
        </div>
    `;
    document.body.appendChild(popup);

    // Add form submit handler
    const form = document.getElementById('scheduleVisitForm');
    form.addEventListener('submit', handleScheduleVisitSubmit);

    // Set minimum date to today
    const dateInput = document.getElementById('visitDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    // Add popup styles
    addScheduleVisitStyles();
}

function showScheduleVisitPopup() {
    const popup = document.getElementById('scheduleVisitPopup');
    if (!popup) {
        createScheduleVisitPopup();
    }

    // Auto-fill from lead data
    if (leadCapture.name) {
        document.getElementById('visitName').value = leadCapture.name;
    }
    if (leadCapture.phone) {
        document.getElementById('visitPhone').value = leadCapture.phone;
    }

    document.getElementById('scheduleVisitPopup').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideScheduleVisitPopup() {
    document.getElementById('scheduleVisitPopup').classList.add('hidden');
    document.body.style.overflow = '';

    // Clear message
    const msgContainer = document.getElementById('visitFormMessage');
    if (msgContainer) {
        msgContainer.innerHTML = '';
        msgContainer.className = 'form-message';
    }
}

async function handleScheduleVisitSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('visitName').value.trim();
    const phone = document.getElementById('visitPhone').value.trim();
    const date = document.getElementById('visitDate').value;
    const time = document.getElementById('visitTime').value;
    const message = document.getElementById('visitMessage').value.trim();
    const msgContainer = document.getElementById('visitFormMessage');

    // Clear previous message
    if (msgContainer) {
        msgContainer.innerHTML = '';
        msgContainer.className = 'form-message';
    }

    // Validate
    if (!name || !phone || !date || !time) {
        showVisitMessage('error', '❌ Please fill all required fields');
        return;
    }

    // Disable submit button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Scheduling...';
    }

    try {
        const response = await fetch('/api/schedule-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, date, time, message })
        });

        const data = await response.json();

        if (data.success) {
            showVisitMessage('success', '✅ Site visit scheduled successfully!');

            // Update CRM lead stage to 'interested'
            if (phone && typeof updateCRMLeadStage === 'function') {
                updateCRMLeadStage(phone, 'interested');
            }

            // Add confirmation to chatbot
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });

            const confirmationMsg = `🎉 Your site visit has been scheduled for ${formattedDate} at ${time}. Our team will contact you shortly to confirm!`;

            // If there's an appendBotMessage function, use it
            if (typeof appendBotMessage === 'function') {
                appendBotMessage(confirmationMsg);
            }

            // Show notification
            showNotification(confirmationMsg, 'success');

            // Open WhatsApp link with confirmation
            const whatsappMsg = encodeURIComponent(`Hi! I just scheduled a site visit for ${formattedDate} at ${time}. Looking forward to it!`);
            setTimeout(() => {
                window.open(`https://wa.me/971412345678?text=${whatsappMsg}`, '_blank');
            }, 2000);

            // Close popup after delay
            setTimeout(() => {
                hideScheduleVisitPopup();
                document.getElementById('scheduleVisitForm').reset();
            }, 3000);
        } else {
            showVisitMessage('error', `❌ ${data.error || 'Failed to schedule visit'}`);
        }
    } catch (error) {
        console.error('Schedule visit error:', error);
        showVisitMessage('error', '❌ Something went wrong. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Visit';
        }
    }
}

function showVisitMessage(type, message) {
    const container = document.getElementById('visitFormMessage');
    if (!container) return;
    container.innerHTML = message;
    container.className = `form-message ${type}`;
}

function addScheduleVisitStyles() {
    if (document.getElementById('schedule-visit-styles')) return;

    const style = document.createElement('style');
    style.id = 'schedule-visit-styles';
    style.textContent = `
        .schedule-visit-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(8px);
        }
        .schedule-visit-popup.hidden {
            display: none;
        }
        .schedule-visit-modal {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px;
            width: 90%;
            max-width: 480px;
            padding: 0;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 215, 0, 0.1);
            animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .schedule-visit-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 215, 0, 0.2);
        }
        .schedule-visit-header h3 {
            margin: 0;
            color: #ffd700;
            font-size: 1.25rem;
        }
        .close-popup-btn {
            background: none;
            border: none;
            color: #999;
            font-size: 28px;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            transition: color 0.2s;
        }
        .close-popup-btn:hover {
            color: #fff;
        }
        .schedule-visit-form {
            padding: 24px;
        }
        .schedule-visit-form .form-group {
            margin-bottom: 16px;
        }
        .schedule-visit-form label {
            display: block;
            color: #ccc;
            font-size: 0.9rem;
            margin-bottom: 6px;
        }
        .schedule-visit-form input,
        .schedule-visit-form select,
        .schedule-visit-form textarea {
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            transition: border-color 0.2s, background 0.2s;
        }
        .schedule-visit-form input:focus,
        .schedule-visit-form select:focus,
        .schedule-visit-form textarea:focus {
            outline: none;
            border-color: #ffd700;
            background: rgba(255, 215, 0, 0.05);
        }
        .schedule-visit-form .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .schedule-visit-form .btn-block {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #ffd700 0%, #ffb800 100%);
            border: none;
            border-radius: 8px;
            color: #1a1a2e;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .schedule-visit-form .btn-block:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(255, 215, 0, 0.3);
        }
        .schedule-visit-form .btn-block:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }
        .schedule-visit-form .form-message {
            margin: 16px 0;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            display: none;
        }
        .schedule-visit-form .form-message.success {
            display: block;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid #10B981;
            color: #10B981;
        }
        .schedule-visit-form .form-message.error {
            display: block;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid #EF4444;
            color: #EF4444;
        }
        .schedule-visit-btn {
            background: linear-gradient(135deg, #ffd700 0%, #ffb800 100%);
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            color: #1a1a2e;
            font-weight: 600;
            cursor: pointer;
            margin: 8px;
            font-size: 0.9rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .schedule-visit-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
        }
        @media (max-width: 480px) {
            .schedule-visit-form .form-row {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
}

// Global function to trigger schedule visit from anywhere
window.scheduleVisit = showScheduleVisitPopup;

// Initialize on load
document.addEventListener('DOMContentLoaded', function () {
    initializeEnv();
    initAuth();
    initScheduleVisit();
});

console.log('🏢 AIONUS $100K Premium Platform Ready!');


