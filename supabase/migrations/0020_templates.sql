-- Templates marketplace

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('saas','landing','api','tool','blog','ecommerce')),
  tags TEXT[] DEFAULT '{}',
  preview_url TEXT,
  thumbnail_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  downloads INTEGER NOT NULL DEFAULT 0,
  files JSONB NOT NULL DEFAULT '{}',
  tech_stack TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_official_public_idx ON templates(is_official, is_public);
CREATE INDEX IF NOT EXISTS templates_slug_idx ON templates(slug);
CREATE INDEX IF NOT EXISTS templates_downloads_idx ON templates(downloads DESC);

-- RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Public read for public templates
CREATE POLICY "Public templates are readable by everyone"
  ON templates FOR SELECT
  USING (is_public = true);

-- Authors can update their own templates
CREATE POLICY "Authors can update own templates"
  ON templates FOR UPDATE
  USING (auth.uid() = author_id);

-- Authors can insert their own templates
CREATE POLICY "Authors can insert templates"
  ON templates FOR INSERT
  WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_templates_updated_at();
