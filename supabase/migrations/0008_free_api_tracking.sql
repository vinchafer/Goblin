-- Free API Pool daily usage tracking
CREATE TABLE IF NOT EXISTS free_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  UNIQUE(provider, date)
);

-- Increment usage counter and return current count + limit
CREATE OR REPLACE FUNCTION increment_free_api_usage(p_provider TEXT)
RETURNS TABLE(request_count INTEGER, daily_limit INTEGER) AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  INSERT INTO free_api_usage (provider, date, request_count)
  VALUES (p_provider, CURRENT_DATE, 1)
  ON CONFLICT (provider, date)
  DO UPDATE SET request_count = free_api_usage.request_count + 1
  RETURNING free_api_usage.request_count INTO v_count;
  
  -- Daily limits per provider
  v_limit := CASE p_provider
    WHEN 'gemini' THEN 1500
    WHEN 'groq' THEN 14000
    ELSE 100
  END;
  
  RETURN QUERY SELECT v_count, v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_free_api_usage_provider_date ON free_api_usage(provider, date);