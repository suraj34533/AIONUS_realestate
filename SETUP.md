# AIONUS - Environment Setup Guide

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`:**
   ```env
   GEMINI_API_KEY=your-gemini-api-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   MAPS_API_KEY=your-maps-api-key
   ```

3. **For Static HTML (no bundler):**
   
   Add this script BEFORE `script.js` in your HTML:
   ```html
   <script>
       // Manually set API keys for static HTML sites
       window.AIONUS_GEMINI_API_KEY = "your-gemini-api-key";
   </script>
   <script src="script.js"></script>
   ```

4. **For Node.js/Vite/Next.js:**
   
   Install dotenv:
   ```bash
   npm install dotenv
   ```
   
   For Vite, prefix with `VITE_`:
   ```env
   VITE_GEMINI_API_KEY=your-key
   VITE_SUPABASE_URL=your-url
   ```

---

## API Key Sources

| Service | Where to Get Key |
|---------|-----------------|
| Gemini AI | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| Supabase | [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → API |
| Google Maps | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |

---

## Project Structure

```
/config
  └── env.js         # Environment loader

/lib
  ├── supabaseClient.js  # Database, storage, ERP
  ├── geminiClient.js    # AI, embeddings, voice
  ├── mapsClient.js      # Maps, markers, search
  └── ragPipeline.js     # Document RAG

/.env                # Your API keys (DO NOT COMMIT)
/.env.example        # Template for reference
```

---

## Supabase Database Setup

Create these tables in Supabase:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  property_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings table for RAG
CREATE TABLE embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  chunk_index INTEGER,
  content TEXT,
  embedding vector(768),
  char_start INTEGER,
  char_end INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads CRM table
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'website',
  property_id TEXT,
  message TEXT,
  interest TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Interactions table
CREATE TABLE interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  type TEXT,
  content TEXT,
  property_id TEXT,
  agent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match embeddings function for similarity search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_document_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    embeddings.id,
    embeddings.document_id,
    embeddings.content,
    1 - (embeddings.embedding <=> query_embedding) AS similarity
  FROM embeddings
  WHERE 
    1 - (embeddings.embedding <=> query_embedding) > match_threshold
    AND (filter_document_id IS NULL OR embeddings.document_id = filter_document_id)
  ORDER BY embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Security Notes

⚠️ **NEVER commit `.env` to version control!**

- `.env` is in `.gitignore`
- For production, use environment variables in your hosting platform
- For Supabase, use Row Level Security (RLS) policies
