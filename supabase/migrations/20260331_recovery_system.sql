-- Add recovery_email to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS recovery_email TEXT;

-- Create security_tokens table for password reset tokens
CREATE TABLE IF NOT EXISTS security_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('password_reset', 'email_verification')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_tokens ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed for tokens as they are managed via service role or internal logic, 
-- but let's add one so the user can't read others' tokens.
CREATE POLICY token_lookup ON security_tokens 
    FOR SELECT USING (false); -- Only backend should touch this
