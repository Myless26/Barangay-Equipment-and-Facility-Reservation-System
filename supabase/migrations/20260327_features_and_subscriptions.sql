-- Add features JSONB and subscription_expires_at columns to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"analytics":true,"custom_branding":false}'::jsonb,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- Update existing rows (if any)
UPDATE tenants
SET features = '{"analytics":true,"custom_branding":false}'::jsonb,
    subscription_expires_at = (now() + interval '30 days')
WHERE features IS NULL;
