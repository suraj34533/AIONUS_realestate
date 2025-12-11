/**
 * ========================================
 * AIONUS - RAG RETRIEVER
 * ========================================
 * Retrieves relevant context from document chunks
 * using vector similarity search
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-004';
const TOP_K = 5;

/**
 * Create Supabase client
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
 * Generate embedding for a query
 * @param {string} query - User query
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateQueryEmbedding(query) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${EMBEDDING_MODEL}`,
                content: { parts: [{ text: query }] }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Embedding API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.embedding.values;
}

/**
 * Retrieve relevant context for a query
 * @param {string} query - User query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Object>} Context and metadata
 */
async function retrieveContext(query, topK = TOP_K) {
    try {
        console.log(`🔍 RAG: Searching for "${query.substring(0, 50)}..."`);

        // Generate query embedding
        const queryEmbedding = await generateQueryEmbedding(query);

        // Query Supabase with vector similarity
        const supabase = createServiceClient();

        // Using RPC function for vector similarity search
        // If you don't have an RPC function, use the direct query approach
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: topK
        });

        if (error) {
            // Fallback: Direct query if RPC not available
            console.log('⚠️ RPC not available, using fallback query');
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('document_chunks')
                .select('content, document_id')
                .limit(topK);

            if (fallbackError) {
                throw fallbackError;
            }

            const context = fallbackData?.map(d => d.content).join('\n\n---\n\n') || '';
            return {
                context,
                chunks: fallbackData?.length || 0,
                source: 'fallback'
            };
        }

        // Join retrieved chunks into context
        const context = data?.map(d => d.content).join('\n\n---\n\n') || '';

        console.log(`✅ RAG: Retrieved ${data?.length || 0} relevant chunks`);

        return {
            context,
            chunks: data?.length || 0,
            source: 'vector_search'
        };

    } catch (error) {
        console.error('❌ RAG retrieval error:', error.message);
        return {
            context: '',
            chunks: 0,
            error: error.message
        };
    }
}

/**
 * Get simple context without embeddings (fallback)
 * @param {string} query - Search query
 * @returns {Promise<Object>} Context
 */
async function getSimpleContext(query) {
    try {
        const supabase = createServiceClient();

        // Simple text search in content
        const { data, error } = await supabase
            .from('document_chunks')
            .select('content')
            .textSearch('content', query.split(' ').slice(0, 3).join(' | '))
            .limit(5);

        if (error) {
            // If text search fails, get latest chunks
            const { data: latestData } = await supabase
                .from('document_chunks')
                .select('content')
                .order('created_at', { ascending: false })
                .limit(5);

            const context = latestData?.map(d => d.content).join('\n\n') || '';
            return { context, chunks: latestData?.length || 0 };
        }

        const context = data?.map(d => d.content).join('\n\n') || '';
        return { context, chunks: data?.length || 0 };

    } catch (error) {
        console.error('❌ Simple context error:', error.message);
        return { context: '', chunks: 0 };
    }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    retrieveContext,
    getSimpleContext,
    generateQueryEmbedding
};
