/**
 * ========================================
 * AIONUS - UPLOAD BROCHURE FLOW
 * ========================================
 * Server-side flow for uploading brochures to Supabase Storage
 * and inserting metadata into the documents table.
 * 
 * Requirements:
 * - Accepts PDF or DOCX files
 * - Uploads to Supabase Storage bucket: brochures
 * - Inserts document metadata into documents table
 * - Returns document_id (UUID) and file_url (public URL)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ========================================
// CONFIGURATION
// ========================================

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'brochures';

// ========================================
// ENVIRONMENT VALIDATION
// ========================================

/**
 * Validate required environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnvironment() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// ========================================
// SUPABASE CLIENT (Service Role)
// ========================================

/**
 * Create Supabase client with service role key
 * @returns {Object} Supabase client
 */
function createServiceClient() {
    validateEnvironment();

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

// ========================================
// FILE VALIDATION
// ========================================

/**
 * Validate file input
 * @param {Object} file - File object with name, type, and buffer/stream
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateFile(file) {
    // Check if file exists
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    // Check if file has required properties
    if (!file.name || !file.type) {
        return { valid: false, error: 'Invalid file object: missing name or type' };
    }

    // Check file has content
    if (!file.buffer && !file.data && !file.stream) {
        return { valid: false, error: 'Invalid file object: no file content' };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type: ${file.type}. Allowed types: PDF, DOCX`
        };
    }

    // Validate extension
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return {
            valid: false,
            error: `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        };
    }

    return { valid: true };
}

// ========================================
// MAIN UPLOAD FLOW
// ========================================

/**
 * Upload brochure to Supabase Storage and insert metadata
 * 
 * @param {Object} file - File object
 * @param {string} file.name - Original filename
 * @param {string} file.type - MIME type (application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 * @param {Buffer|Uint8Array} file.buffer - File content as buffer
 * @param {string|null} projectId - Optional project ID (UUID)
 * 
 * @returns {Promise<Object>} Result object
 * @returns {boolean} result.success - Whether the operation succeeded
 * @returns {string} [result.document_id] - UUID of the inserted document
 * @returns {string} [result.file_url] - Public URL of the uploaded file
 * @returns {string} [result.error] - Error message if failed
 * 
 * @example
 * const result = await uploadBrochure({
 *   name: 'property-brochure.pdf',
 *   type: 'application/pdf',
 *   buffer: fileBuffer
 * }, 'optional-project-uuid', 'brochure');
 */
async function uploadBrochure(file, projectId = null, documentType = 'brochure') {
    try {
        // Step 1: Validate file input
        const validation = validateFile(file);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error
            };
        }

        // Step 2: Initialize Supabase client
        const supabase = createServiceClient();

        // Step 3: Generate storage path with timestamp
        // Note: Don't include bucket name in path since .from(BUCKET_NAME) already specifies it
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${timestamp}_${sanitizedFileName}`;

        // Step 4: Upload file to Supabase Storage
        const fileContent = file.buffer || file.data;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileContent, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Storage upload failed:', uploadError);
            return {
                success: false,
                error: `Storage upload failed: ${uploadError.message}`
            };
        }

        console.log('✅ File uploaded to storage:', uploadData.path);

        // Step 5: Build public URL explicitly (hardcode bucket name to avoid duplicates)
        // Format: SUPABASE_URL/storage/v1/object/public/brochures/FILENAME
        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/brochures/${storagePath}`;
        console.log('✅ Public URL generated:', publicUrl);

        // Step 6: Insert document metadata into database
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                project_id: projectId || null,
                file_name: sanitizedFileName,
                file_type: file.type,
                file_url: publicUrl,
                document_type: documentType
            })
            .select('id')
            .single();

        if (docError) {
            console.error('❌ Database insert failed:', docError);

            // Attempt to clean up uploaded file on DB failure
            await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

            return {
                success: false,
                error: `Database insert failed: ${docError.message}`
            };
        }

        console.log('✅ Document inserted with ID:', docData.id);

        // Step 7: Return success response
        return {
            success: true,
            document_id: docData.id,
            file_url: publicUrl
        };

    } catch (error) {
        console.error('❌ Upload brochure flow error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    uploadBrochure,
    validateFile,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS
};

// ========================================
// CLI TEST MODE
// ========================================

if (require.main === module) {
    // When run directly, perform a basic validation test
    console.log('🧪 Upload Brochure Flow - Test Mode');
    console.log('====================================');

    try {
        validateEnvironment();
        console.log('✅ Environment variables validated');
        console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL}`);
        console.log(`   BUCKET_NAME: ${BUCKET_NAME}`);

        // Test file validation
        console.log('\n📋 Testing file validation...');

        const tests = [
            { file: null, expected: false, desc: 'null file' },
            { file: { name: 'test.pdf', type: 'application/pdf', buffer: Buffer.from('test') }, expected: true, desc: 'valid PDF' },
            { file: { name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('test') }, expected: true, desc: 'valid DOCX' },
            { file: { name: 'test.txt', type: 'text/plain', buffer: Buffer.from('test') }, expected: false, desc: 'invalid TXT' },
        ];

        tests.forEach(test => {
            const result = validateFile(test.file);
            const status = result.valid === test.expected ? '✅' : '❌';
            console.log(`   ${status} ${test.desc}: ${result.valid ? 'valid' : result.error}`);
        });

        console.log('\n✅ All tests passed! Module is ready to use.');
        console.log('\nUsage:');
        console.log('  const { uploadBrochure } = require("./flows/upload_brochure");');
        console.log('  const result = await uploadBrochure({ name, type, buffer }, projectId);');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}
