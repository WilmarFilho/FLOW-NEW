-- ============================================
-- Migration: Conhecimentos (Knowledge Base) Module
-- Enables vector extension, expands conhecimentos table,
-- creates chunks/messages tables, and storage bucket.
-- ============================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Expand existing 'conhecimentos' table
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'building';
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS resumo TEXT;
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS total_chunks INT DEFAULT 0;
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Create knowledge chunk table with vector embeddings (text-embedding-3-large = 3072 dims)
CREATE TABLE IF NOT EXISTS conhecimento_chunks (
  id BIGSERIAL PRIMARY KEY,
  conhecimento_id UUID REFERENCES conhecimentos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding extensions.vector(3072),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conhecimento_chunks_conhecimento_id
  ON conhecimento_chunks(conhecimento_id);

-- 4. Create chat message history table
CREATE TABLE IF NOT EXISTS conhecimento_messages (
  id BIGSERIAL PRIMARY KEY,
  conhecimento_id UUID REFERENCES conhecimentos(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conhecimento_messages_conhecimento_id
  ON conhecimento_messages(conhecimento_id);

-- 5. Similarity search function
CREATE OR REPLACE FUNCTION match_conhecimento_chunks(
  query_embedding extensions.vector(3072),
  p_conhecimento_id UUID,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.content,
    cc.metadata,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM conhecimento_chunks cc
  WHERE cc.conhecimento_id = p_conhecimento_id
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public)
VALUES ('conhecimento-files', 'conhecimento-files', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policy: users can upload to their own folder
CREATE POLICY "Users can upload conhecimento files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'conhecimento-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own conhecimento files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'conhecimento-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own conhecimento files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'conhecimento-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 8. RLS for new tables
ALTER TABLE conhecimento_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conhecimento_messages ENABLE ROW LEVEL SECURITY;

-- Service role bypass (NestJS uses service role key)
CREATE POLICY "Service role full access chunks"
  ON conhecimento_chunks FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access messages"
  ON conhecimento_messages FOR ALL
  USING (true)
  WITH CHECK (true);


ALTER TABLE conhecimentos ADD COLUMN IF NOT EXISTS percentual_conclusao INT DEFAULT 0;
