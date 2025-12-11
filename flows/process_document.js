/**
 * ========================================
 * AIONUS - DOCUMENT PROCESSOR (RAG)
 * ========================================
 * Processes uploaded documents for RAG:
 * 1. Extract text from PDF/DOCX
 * 2. Split into chunks
 * 3. Generate embeddings via Gemini
 * 4. Save to Supabase document_chunks table
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ========================================
// CONFIGURATION
// ========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-004';
const CHUNK_SIZE = 900;      // 800-1000 chars per chunk
const CHUNK_OVERLAP = 100;   // Overlap for context continuity

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

// ========================================
// TEXT EXTRACTION
// ========================================

/**
 * Extract text from PDF or DOCX buffer
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} Extracted text
 */
async function extractText(buffer, mimeType) {
    try {
        if (mimeType === 'application/pdf') {
            // Use pdf-parse for PDF files
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Use mammoth for DOCX files
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }
    } catch (error) {
        console.error('❌ Text extraction failed:', error.message);
        throw error;
    }
}

// ========================================
// TEXT CHUNKING
// ========================================

/**
 * Split text into overlapping chunks
 * @param {string} text - Full document text
 * @param {number} chunkSize - Max characters per chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} Array of text chunks
 */
function splitIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    // Clean the text
    const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

    if (cleanText.length <= chunkSize) {
        return [cleanText];
    }

    const chunks = [];
    let start = 0;

    while (start < cleanText.length) {
        let end = start + chunkSize;

        // Try to break at sentence boundary
        if (end < cleanText.length) {
            const lastPeriod = cleanText.lastIndexOf('.', end);
            const lastNewline = cleanText.lastIndexOf('\n', end);
            const breakPoint = Math.max(lastPeriod, lastNewline);

            if (breakPoint > start + chunkSize / 2) {
                end = breakPoint + 1;
            }
        }

        const chunk = cleanText.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        start = end - overlap;
    }

    return chunks;
}

// ========================================
// EMBEDDING GENERATION
// ========================================

/**
 * Generate embeddings for text chunks using Gemini
 * @param {string[]} chunks - Array of text chunks
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddings(chunks) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for embeddings');
    }

    const embeddings = [];

    for (const chunk of chunks) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: `models/${EMBEDDING_MODEL}`,
                        content: { parts: [{ text: chunk }] }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Embedding API error: ${JSON.stringify(error)}`);
            }

            const data = await response.json();
            embeddings.push(data.embedding.values);

        } catch (error) {
            console.error('❌ Embedding generation failed for chunk:', error.message);
            // Push null embedding for failed chunks
            embeddings.push(null);
        }
    }

    return embeddings;
}

// ========================================
// SAVE TO SUPABASE
// ========================================

/**
 * Save chunks and embeddings to Supabase
 * @param {string[]} chunks - Text chunks
 * @param {number[][]} embeddings - Embedding vectors
 * @param {string} documentId - UUID of parent document
 * @param {string} documentType - Type of document (brochure, faq, pricing)
 * @returns {Promise<number>} Number of chunks saved
 */
async function saveChunksToSupabase(chunks, embeddings, documentId, documentType = 'brochure') {
    const supabase = createServiceClient();
    let savedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        // Skip chunks with failed embeddings
        if (!embedding) {
            console.warn(`⚠️ Skipping chunk ${i + 1} - no embedding`);
            continue;
        }

        try {
            const { error } = await supabase
                .from('document_chunks')
                .insert({
                    document_id: documentId,
                    content: chunk,
                    embedding: embedding,
                    document_type: documentType
                });

            if (error) {
                console.error(`❌ Failed to save chunk ${i + 1}:`, error.message);
            } else {
                savedCount++;
            }
        } catch (error) {
            console.error(`❌ Error saving chunk ${i + 1}:`, error.message);
        }
    }

    return savedCount;
}

// ========================================
// MAIN PROCESS DOCUMENT FUNCTION
// ========================================

/**
 * Process a document for RAG
 * @param {Buffer} buffer - File buffer
 * @param {string} documentId - UUID of document record
 * @param {string} mimeType - File MIME type
 * @param {string} documentType - Type of document (brochure, faq, pricing)
 * @returns {Promise<Object>} Processing result
 */
async function processDocument(buffer, documentId, mimeType, documentType = 'brochure') {
    console.log(`📄 Processing ${documentType}: ${documentId}`);

    try {
        // Step 1: Extract text
        console.log('📝 Extracting text...');
        const text = await extractText(buffer, mimeType);
        console.log(`   Extracted ${text.length} characters`);

        if (!text || text.length < 10) {
            return {
                success: false,
                error: 'Document contains no extractable text',
                chunks_created: 0
            };
        }

        // Step 2: Split into chunks
        console.log('✂️ Splitting into chunks...');
        const chunks = splitIntoChunks(text);
        console.log(`   Created ${chunks.length} chunks`);

        // Step 3: Generate embeddings
        console.log('🧠 Generating embeddings...');
        const embeddings = await generateEmbeddings(chunks);
        const validEmbeddings = embeddings.filter(e => e !== null).length;
        console.log(`   Generated ${validEmbeddings}/${chunks.length} embeddings`);

        // Step 4: Save to Supabase
        console.log('💾 Saving to database...');
        const savedCount = await saveChunksToSupabase(chunks, embeddings, documentId, documentType);
        console.log(`   Saved ${savedCount} chunks`);

        console.log(`✅ Document processed successfully!`);

        return {
            success: true,
            document_id: documentId,
            chunks_created: savedCount,
            total_chunks: chunks.length
        };

    } catch (error) {
        console.error('❌ Document processing failed:', error);
        return {
            success: false,
            error: error.message,
            chunks_created: 0
        };
    }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    processDocument,
    extractText,
    splitIntoChunks,
    generateEmbeddings,
    saveChunksToSupabase
};

// ========================================
// CLI TEST
// ========================================

if (require.main === module) {
    console.log('📄 Document Processor - Test Mode');
    console.log('Use: await processDocument(buffer, documentId, mimeType)');
}
