-- Alter the default subscription expiration to be +5 years instead of +30 days
ALTER TABLE public.tenants
ALTER COLUMN subscription_expires_at SET DEFAULT (now() + interval '5 years');

-- Update any existing tenants to extend their subscriptions by 5 years
UPDATE public.tenants 
SET subscription_expires_at = (subscription_expires_at + interval '5 years')
WHERE subscription_expires_at IS NOT NULL;
