/**
 * ========================================
 * UPLOAD BROCHURE - EXPRESS ROUTE
 * ========================================
 * POST /api/upload-brochure
 * Handles file uploads for brochures (PDF/DOCX)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadBrochure } = require('../flows/upload_brochure');
const { processDocument } = require('../flows/process_document');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and DOCX are allowed.'));
        }
    }
});

/**
 * POST /api/upload-brochure
 * Upload a brochure file to storage and process for RAG
 * 
 * Body (multipart/form-data):
 *   file: File (required) - PDF or DOCX
 *   project_id: string (optional) - UUID of associated project
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const file = {
            name: req.file.originalname,
            type: req.file.mimetype,
            buffer: req.file.buffer
        };

        const projectId = req.body.project_id || null;

        // Get and validate document type
        const validDocTypes = ['brochure', 'faq', 'pricing'];
        const documentType = validDocTypes.includes(req.body.document_type)
            ? req.body.document_type
            : 'brochure';

        console.log(`📄 Uploading ${documentType}:`, file.name);

        // Step 1: Upload to storage
        const uploadResult = await uploadBrochure(file, projectId, documentType);

        if (!uploadResult.success) {
            console.error('❌ Upload failed:', uploadResult.error);
            return res.status(400).json({
                success: false,
                error: uploadResult.error
            });
        }

        console.log(`✅ ${documentType} uploaded:`, uploadResult.document_id);

        // Step 2: Process document for RAG (async)
        console.log('🔄 Processing document for RAG...');
        let chunksCreated = 0;

        try {
            const processResult = await processDocument(
                req.file.buffer,
                uploadResult.document_id,
                req.file.mimetype,
                documentType
            );
            chunksCreated = processResult.chunks_created || 0;
            console.log(`✅ RAG processing complete: ${chunksCreated} chunks created`);
        } catch (processError) {
            console.error('⚠️ RAG processing failed (non-blocking):', processError.message);
            // Continue - upload was still successful
        }

        res.status(200).json({
            success: true,
            document_id: uploadResult.document_id,
            file_url: uploadResult.file_url,
            chunks_created: chunksCreated
        });

    } catch (error) {
        console.error('❌ Route Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Handle multer errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
    next();
});

module.exports = router;
