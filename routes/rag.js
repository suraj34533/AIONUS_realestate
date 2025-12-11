/**
 * ========================================
 * RAG CONTEXT - EXPRESS ROUTE
 * ========================================
 * GET /api/rag?query=...
 * Retrieves relevant document context for a query
 */

const express = require('express');
const router = express.Router();
const { retrieveContext, getSimpleContext } = require('../lib/rag');

/**
 * GET /api/rag
 * Retrieve RAG context for a query
 * 
 * Query params:
 *   query: string - The search query
 */
router.get('/', async (req, res) => {
    try {
        const query = req.query.query;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                context: '',
                error: 'Query parameter is required'
            });
        }

        console.log(`🔍 RAG API: "${query.substring(0, 50)}..."`);

        // Try vector search first, fallback to simple search
        let result;
        try {
            result = await retrieveContext(query);
        } catch (error) {
            console.log('⚠️ Vector search failed, using simple search');
            result = await getSimpleContext(query);
        }

        res.json({
            context: result.context || '',
            chunks: result.chunks || 0,
            source: result.source || 'unknown'
        });

    } catch (error) {
        console.error('❌ RAG API Error:', error);
        res.status(500).json({
            context: '',
            error: error.message
        });
    }
});

module.exports = router;
