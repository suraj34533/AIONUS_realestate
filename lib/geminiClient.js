/**
 * ========================================
 * AIONUS - GEMINI AI CLIENT
 * ========================================
 * Text generation, embeddings, and voice agent
 */

import { getEnv, isConfigured } from '../config/env.js';

// ========================================
// TEXT GENERATION
// ========================================

/**
 * Generate text using Gemini API
 * @param {string} prompt - User prompt
 * @param {Object} options - Generation options
 * @returns {Object} Generated text response
 */
async function generateText(prompt, options = {}) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured');
        return {
            text: 'AI assistant is not configured. Please add your Gemini API key to enable AI features.',
            error: 'API key not configured'
        };
    }

    const apiKey = getEnv('GEMINI_API_KEY');
    const model = options.model || 'gemini-2.0-flash';
    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 1024;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature,
                        maxOutputTokens: maxTokens
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return { text, error: null };
    } catch (error) {
        console.error('❌ Gemini API error:', error);
        return { text: '', error: error.message };
    }
}

/**
 * Chat with context (multi-turn conversation)
 * @param {Array} messages - Chat history
 * @param {string} userMessage - New user message
 * @param {Object} options - Generation options
 * @returns {Object} Generated response
 */
async function chat(messages, userMessage, options = {}) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured');
        return {
            text: 'AI assistant is not configured. Please add your Gemini API key.',
            error: 'API key not configured'
        };
    }

    const apiKey = getEnv('GEMINI_API_KEY');
    const model = options.model || 'gemini-2.0-flash';

    // Build conversation history
    const contents = [
        ...messages,
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: options.temperature || 0.7,
                        maxOutputTokens: options.maxTokens || 1024
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return { text, error: null };
    } catch (error) {
        console.error('❌ Chat error:', error);
        return { text: 'Sorry, I encountered an error. Please try again.', error: error.message };
    }
}

// ========================================
// EMBEDDINGS (for RAG)
// ========================================

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Object} Embedding vector
 */
async function generateEmbedding(text) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured for embeddings');
        return { embedding: null, error: 'API key not configured' };
    }

    const apiKey = getEnv('GEMINI_API_KEY');
    const model = getEnv('EMBEDDING_MODEL');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: `models/${model}`,
                    content: { parts: [{ text }] }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Embedding request failed');
        }

        const data = await response.json();
        const embedding = data.embedding?.values || null;

        return { embedding, error: null };
    } catch (error) {
        console.error('❌ Embedding error:', error);
        return { embedding: null, error: error.message };
    }
}

/**
 * Generate embeddings for multiple texts
 * @param {Array<string>} texts - Array of texts
 * @returns {Object} Array of embeddings
 */
async function generateEmbeddings(texts) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured for embeddings');
        return { embeddings: [], error: 'API key not configured' };
    }

    try {
        const embeddings = await Promise.all(
            texts.map(text => generateEmbedding(text))
        );

        return {
            embeddings: embeddings.map(e => e.embedding),
            error: null
        };
    } catch (error) {
        console.error('❌ Batch embedding error:', error);
        return { embeddings: [], error: error.message };
    }
}

// ========================================
// VOICE AGENT (TTS/STT)
// ========================================

/**
 * Text to Speech using Gemini
 * @param {string} text - Text to convert
 * @returns {Object} Audio data
 */
async function textToSpeech(text) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured for TTS');
        return { audio: null, error: 'API key not configured' };
    }

    const apiKey = getEnv('GEMINI_API_KEY');
    const model = getEnv('GEMINI_TTS_MODEL');

    // Placeholder for Gemini TTS implementation
    // Note: Gemini TTS API may have different endpoint/format
    console.log('🔊 TTS requested for:', text.substring(0, 50) + '...');

    try {
        // TODO: Implement actual Gemini TTS when API is available
        // For now, return placeholder
        return {
            audio: null,
            message: 'TTS feature coming soon. Gemini TTS API integration pending.',
            error: null
        };
    } catch (error) {
        console.error('❌ TTS error:', error);
        return { audio: null, error: error.message };
    }
}

/**
 * Speech to Text using Gemini
 * @param {Blob} audioBlob - Audio data
 * @returns {Object} Transcribed text
 */
async function speechToText(audioBlob) {
    if (!isConfigured('gemini')) {
        console.warn('⚠️ Gemini API not configured for STT');
        return { text: '', error: 'API key not configured' };
    }

    const apiKey = getEnv('GEMINI_API_KEY');
    const model = getEnv('GEMINI_STT_MODEL');

    try {
        // Convert blob to base64
        const base64Audio = await blobToBase64(audioBlob);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            inlineData: {
                                mimeType: audioBlob.type || 'audio/webm',
                                data: base64Audio
                            }
                        }, {
                            text: 'Transcribe this audio to text.'
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'STT request failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return { text, error: null };
    } catch (error) {
        console.error('❌ STT error:', error);
        return { text: '', error: error.message };
    }
}

/**
 * Helper: Convert Blob to Base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ========================================
// PROPERTY-SPECIFIC AI
// ========================================

/**
 * Generate property description using AI
 * @param {Object} property - Property data
 * @returns {Object} Generated description
 */
async function generatePropertyDescription(property) {
    const prompt = `Generate a luxury real estate marketing description for this property:
    
Title: ${property.title}
Location: ${property.community}, Dubai
Type: ${property.type}
Bedrooms: ${property.beds}
Bathrooms: ${property.baths}
Area: ${property.area} sqft
Price: ${property.price}
Amenities: ${property.amenities?.join(', ')}

Write a compelling 2-3 paragraph description that highlights the luxury aspects, location benefits, and lifestyle this property offers. Use professional real estate marketing language.`;

    return await generateText(prompt);
}

/**
 * Answer property-related questions
 * @param {string} question - User question
 * @param {Array} properties - Available properties
 * @param {Object} context - Additional context
 * @returns {Object} AI response
 */
async function answerPropertyQuestion(question, properties, context = {}) {
    const propertyList = properties.map(p =>
        `- ${p.title}: ${p.type} in ${p.community}, ${p.beds} beds, ${p.area} sqft, $${p.price.toLocaleString()}`
    ).join('\n');

    const systemPrompt = `You are an AI property advisor for AIONUS, a premium real estate company in Dubai.
You help buyers find luxury properties, answer questions about locations, prices, and amenities.
Be professional, concise, and helpful.

Available Properties:
${propertyList}

${context.currentProperty ? `Currently viewing: ${context.currentProperty.title}` : ''}`;

    const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "I understand. I'm ready to assist with luxury property inquiries." }] }
    ];

    return await chat(messages, question);
}

// Export all functions
export {
    // Text generation
    generateText,
    chat,
    // Embeddings
    generateEmbedding,
    generateEmbeddings,
    // Voice
    textToSpeech,
    speechToText,
    // Property AI
    generatePropertyDescription,
    answerPropertyQuestion
};

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateText,
        chat,
        generateEmbedding,
        generateEmbeddings,
        textToSpeech,
        speechToText,
        generatePropertyDescription,
        answerPropertyQuestion
    };
}
