-- =============================================
-- LEADS CRM TABLE
-- Advanced CRM System for AIONUS
-- =============================================

-- Create leads_crm table
CREATE TABLE IF NOT EXISTS leads_crm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    budget TEXT,
    lead_source TEXT DEFAULT 'chatbot',
    stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'interested', 'hot', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on stage for fast filtering
CREATE INDEX IF NOT EXISTS idx_leads_crm_stage ON leads_crm(stage);

-- Index on phone for search/lookup
CREATE INDEX IF NOT EXISTS idx_leads_crm_phone ON leads_crm(phone);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_leads_crm_created_at ON leads_crm(created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_leads_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_crm_updated_at ON leads_crm;
CREATE TRIGGER trigger_leads_crm_updated_at
    BEFORE UPDATE ON leads_crm
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_crm_updated_at();

-- Enable Row Level Security
ALTER TABLE leads_crm ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous select
CREATE POLICY "Allow anonymous select on leads_crm"
    ON leads_crm FOR SELECT
    TO anon
    USING (true);

-- Policy: Allow anonymous insert
CREATE POLICY "Allow anonymous insert on leads_crm"
    ON leads_crm FOR INSERT
    TO anon
    WITH CHECK (true);

-- Policy: Allow anonymous update (for stage changes)
CREATE POLICY "Allow anonymous update on leads_crm"
    ON leads_crm FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON leads_crm TO anon;
GRANT SELECT, INSERT, UPDATE ON leads_crm TO authenticated;
