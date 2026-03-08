
-- Usage analytics
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  model TEXT NOT NULL,
  tokens_estimated INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own usage logs"
  ON public.usage_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prompt library
CREATE TABLE public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own prompt templates"
  ON public.prompt_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Shared conversations
CREATE TABLE public.shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own shared conversations"
  ON public.shared_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read access for shared conversations via token
CREATE POLICY "Anyone can read active shared conversations"
  ON public.shared_conversations FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Allow public read of conversations that are shared
CREATE POLICY "Public can read shared conversations"
  ON public.conversations FOR SELECT
  TO anon
  USING (id IN (SELECT conversation_id FROM public.shared_conversations WHERE is_active = true));

-- Allow public read of messages in shared conversations
CREATE POLICY "Public can read messages in shared conversations"
  ON public.messages FOR SELECT
  TO anon
  USING (conversation_id IN (SELECT conversation_id FROM public.shared_conversations WHERE is_active = true));

-- Documents for RAG
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  file_name TEXT,
  file_type TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Full-text search index on documents
ALTER TABLE public.documents ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED;

CREATE INDEX documents_search_idx ON public.documents USING gin(search_vector);
