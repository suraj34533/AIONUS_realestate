-- ========================================
-- DOCUMENT TYPES MIGRATION
-- ========================================
-- Add document_type column to documents and document_chunks tables
-- Allowed values: 'brochure', 'faq', 'pricing'

-- Add document_type to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'brochure';

-- Add document_type to document_chunks table  
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'brochure';

-- Create index on document_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_type ON document_chunks(document_type);

-- Add check constraint to ensure valid document types (optional - Supabase specific)
-- Note: If these constraints cause issues, they can be removed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'documents_document_type_check'
    ) THEN
        ALTER TABLE documents
        ADD CONSTRAINT documents_document_type_check
        CHECK (document_type IN ('brochure', 'faq', 'pricing'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'document_chunks_document_type_check'
    ) THEN
        ALTER TABLE document_chunks
        ADD CONSTRAINT document_chunks_document_type_check
        CHECK (document_type IN ('brochure', 'faq', 'pricing'));
    END IF;
END $$;

-- Update existing records to have 'brochure' as default (if null)
UPDATE documents SET document_type = 'brochure' WHERE document_type IS NULL;
UPDATE document_chunks SET document_type = 'brochure' WHERE document_type IS NULL;
