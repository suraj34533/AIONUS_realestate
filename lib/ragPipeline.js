/**
 * ========================================
 * AIONUS - RAG PIPELINE
 * ========================================
 * Document chunking, vector storage, and similarity search
 */

import { getEnv, isConfigured } from '../config/env.js';
import { generateEmbedding, generateEmbeddings } from './geminiClient.js';
import { getSupabase } from './supabaseClient.js';

// ========================================
// DOCUMENT CHUNKING
// ========================================

/**
 * Chunk text into smaller pieces for embedding
 * @param {string} text - Full document text
 * @param {Object} options - Chunking options
 * @returns {Array<Object>} Array of chunks
 */
function chunkDocument(text, options = {}) {
    const chunkSize = options.chunkSize || 1000;
    const overlap = options.overlap || 200;
    const separator = options.separator || '\n\n';

    // First, split by separator (paragraphs)
    const paragraphs = text.split(separator).filter(p => p.trim());

    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        // If adding this paragraph exceeds chunk size
        if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
            // Save current chunk
            chunks.push({
                id: chunkIndex++,
                content: currentChunk.trim(),
                charStart: text.indexOf(currentChunk),
                charEnd: text.indexOf(currentChunk) + currentChunk.length
            });

            // Start new chunk with overlap
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-Math.floor(overlap / 5));
            currentChunk = overlapWords.join(' ') + ' ' + paragraph;
        } else {
            currentChunk += (currentChunk ? separator : '') + paragraph;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push({
            id: chunkIndex,
            content: currentChunk.trim(),
            charStart: text.indexOf(currentChunk),
            charEnd: text.indexOf(currentChunk) + currentChunk.length
        });
    }

    console.log(`📄 Chunked document into ${chunks.length} pieces`);
    return chunks;
}

/**
 * Extract text from PDF (placeholder)
 * @param {File|Blob} pdfFile - PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPDF(pdfFile) {
    // TODO: Implement PDF extraction using pdf.js or similar
    console.warn('⚠️ PDF extraction not implemented. Please integrate pdf.js.');

    // Placeholder: Return file name as text
    return `[PDF Content from: ${pdfFile.name || 'document.pdf'}]`;
}

// ========================================
// VECTOR STORAGE
// ========================================

/**
 * Store chunks with embeddings in Supabase
 * @param {string} documentId - Parent document ID
 * @param {Array<Object>} chunks - Array of text chunks
 * @returns {Object} Storage result
 */
async function storeVectors(documentId, chunks) {
    if (!isConfigured('supabase') || !isConfigured('gemini')) {
        console.warn('⚠️ Cannot store vectors - Supabase or Gemini not configured');
        return { success: false, error: 'Services not configured' };
    }

    try {
        // Generate embeddings for all chunks
        const texts = chunks.map(c => c.content);
        const { embeddings, error: embError } = await generateEmbeddings(texts);

        if (embError) {
            throw new Error(`Embedding error: ${embError}`);
        }

        const client = await getSupabase();
        if (!client) {
            throw new Error('Supabase client not available');
        }

        // Prepare rows for insertion
        const rows = chunks.map((chunk, index) => ({
            document_id: documentId,
            chunk_index: chunk.id,
            content: chunk.content,
            embedding: embeddings[index],
            char_start: chunk.charStart,
            char_end: chunk.charEnd,
            created_at: new Date().toISOString()
        }));

        // Insert into embeddings table
        const { data, error } = await client
            .from('embeddings')
            .insert(rows)
            .select();

        if (error) throw error;

        console.log(`✅ Stored ${data.length} vectors`);
        return { success: true, count: data.length, error: null };
    } catch (error) {
        console.error('❌ Vector storage error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Insert single embedding
 * @param {Object} data - Embedding data
 * @returns {Object} Insert result
 */
async function insertEmbedding(data) {
    const client = await getSupabase();

    if (!client) {
        return { error: 'Supabase not configured', data: null };
    }

    try {
        const { data: result, error } = await client
            .from('embeddings')
            .insert({
                document_id: data.documentId,
                chunk_index: data.chunkIndex || 0,
                content: data.content,
                embedding: data.embedding,
                metadata: data.metadata || {},
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return { data: result, error: null };
    } catch (error) {
        console.error('❌ Insert embedding failed:', error);
        return { data: null, error: error.message };
    }
}

// ========================================
// SIMILARITY SEARCH
// ========================================

/**
 * Search for similar documents using vector similarity
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchSimilar(query, options = {}) {
    const topK = options.topK || 5;
    const threshold = options.threshold || 0.7;
    const documentId = options.documentId; // Optional: filter by document

    if (!isConfigured('supabase') || !isConfigured('gemini')) {
        console.warn('⚠️ Cannot search - Supabase or Gemini not configured');
        return { results: [], error: 'Services not configured' };
    }

    try {
        // Generate query embedding
        const { embedding: queryEmbedding, error: embError } = await generateEmbedding(query);

        if (embError) {
            throw new Error(`Embedding error: ${embError}`);
        }

        const client = await getSupabase();
        if (!client) {
            throw new Error('Supabase client not available');
        }

        // Use Supabase pgvector similarity search
        // Requires: CREATE EXTENSION vector; in Supabase
        // And a match_embeddings function
        const { data, error } = await client.rpc('match_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: topK,
            filter_document_id: documentId || null
        });

        if (error) throw error;

        console.log(`🔍 Found ${data?.length || 0} similar results`);
        return { results: data || [], error: null };
    } catch (error) {
        console.error('❌ Similarity search error:', error);
        return { results: [], error: error.message };
    }
}

/**
 * Query embeddings (simpler interface)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Object} Query results
 */
async function queryEmbeddings(query, limit = 5) {
    return await searchSimilar(query, { topK: limit });
}

// ========================================
// RAG QUERY
// ========================================

/**
 * Full RAG query: search + generate answer
 * @param {string} question - User question
 * @param {Object} options - Query options
 * @returns {Object} Answer with sources
 */
async function ragQuery(question, options = {}) {
    if (!isConfigured('gemini')) {
        return {
            answer: 'AI services not configured. Please add your Gemini API key.',
            sources: [],
            error: 'API key not configured'
        };
    }

    try {
        // Step 1: Search for relevant chunks
        const { results: chunks, error: searchError } = await searchSimilar(question, {
            topK: options.topK || 5,
            documentId: options.documentId
        });

        if (searchError) {
            throw new Error(`Search error: ${searchError}`);
        }

        if (chunks.length === 0) {
            return {
                answer: 'I couldn\'t find relevant information to answer your question.',
                sources: [],
                error: null
            };
        }

        // Step 2: Build context from chunks
        const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

        // Step 3: Generate answer with context
        const prompt = `You are an AI assistant for AIONUS, a premium real estate company.
Answer the question based ONLY on the following context. If the context doesn't contain relevant information, say so.

Context:
${context}

Question: ${question}

Instructions:
- Answer concisely and professionally
- Cite sources using [1], [2], etc.
- If information isn't in the context, say "I don't have that information"

Answer:`;

        const { text, error: genError } = await import('./geminiClient.js')
            .then(m => m.generateText(prompt));

        if (genError) {
            throw new Error(`Generation error: ${genError}`);
        }

        return {
            answer: text,
            sources: chunks.map(c => ({
                content: c.content.substring(0, 200) + '...',
                documentId: c.document_id,
                similarity: c.similarity
            })),
            error: null
        };
    } catch (error) {
        console.error('❌ RAG query error:', error);
        return {
            answer: 'Sorry, I encountered an error processing your question.',
            sources: [],
            error: error.message
        };
    }
}

// ========================================
// DOCUMENT PROCESSING PIPELINE
// ========================================

/**
 * Full document processing pipeline
 * @param {Object} document - Document to process
 * @returns {Object} Processing result
 */
async function processDocument(document) {
    console.log(`📄 Processing document: ${document.title}`);

    try {
        // Step 1: Extract text (if PDF)
        let text = document.content;
        if (document.file && document.file.type === 'application/pdf') {
            text = await extractTextFromPDF(document.file);
        }

        // Step 2: Chunk the text
        const chunks = chunkDocument(text, {
            chunkSize: document.chunkSize || 1000,
            overlap: document.overlap || 200
        });

        // Step 3: Store vectors
        const { success, count, error } = await storeVectors(document.id, chunks);

        if (!success) {
            throw new Error(error);
        }

        console.log(`✅ Document processed: ${count} vectors stored`);
        return { success: true, chunksProcessed: count, error: null };
    } catch (error) {
        console.error('❌ Document processing error:', error);
        return { success: false, chunksProcessed: 0, error: error.message };
    }
}

// Export all functions
export {
    // Chunking
    chunkDocument,
    extractTextFromPDF,
    // Vector storage
    storeVectors,
    insertEmbedding,
    // Search
    searchSimilar,
    queryEmbeddings,
    // RAG
    ragQuery,
    // Pipeline
    processDocument
};

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        chunkDocument,
        extractTextFromPDF,
        storeVectors,
        insertEmbedding,
        searchSimilar,
        queryEmbeddings,
        ragQuery,
        processDocument
    };
}
