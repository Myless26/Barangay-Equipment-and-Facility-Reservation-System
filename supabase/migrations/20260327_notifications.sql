-- Create notifications table for multi-tenant alerts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_roles JSONB DEFAULT '[]'::jsonb,
    read_by JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."notifications"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert access for all users" ON "public"."notifications"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON "public"."notifications"
AS PERMISSIVE FOR UPDATE
TO public
USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
