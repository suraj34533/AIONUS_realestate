-- ========================================
-- AIONUS - SITE VISITS TABLE
-- ========================================
-- Run this in Supabase SQL Editor to create the site_visits table

CREATE TABLE IF NOT EXISTS site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    visit_time TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS site_visits_status_idx ON site_visits(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON site_visits TO authenticated;
GRANT SELECT, INSERT ON site_visits TO anon;

-- Success message
SELECT 'Site visits table created successfully!' AS status;
