CREATE OR REPLACE FUNCTION increment_request_count(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET monthly_requests_used = monthly_requests_used + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;