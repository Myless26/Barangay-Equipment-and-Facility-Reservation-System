-- EMAIL NOTIFICATION TRIGGER SYSTEM
-- This allows real-time emails via Supabase Webhooks or Edge Functions

-- 1. Create a log table for Email Notifications
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_type TEXT NOT NULL, -- 'AccountApproval', 'AccountCreated', 'PlanApproval'
    body TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view email logs" ON public.email_logs FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('Barangay Admin', 'Super Admin')
));

-- 2. Trigger for NEW ACCOUNT REGISTRATION
CREATE OR REPLACE FUNCTION public.on_user_registered_email()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.email_logs (tenant_id, recipient_email, subject, template_type, body)
  VALUES (
    NEW.tenant_id,
    NEW.email,
    'Welcome to the Barangay Portal!',
    'AccountCreated',
    'Congratulations ' || NEW.full_name || '! Your account has been successfully created. We have forwarded your credentials to your Barangay Admin for final security approval.'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_user_registered_email
AFTER INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.on_user_registered_email();

-- 3. Trigger for ACCOUNT APPROVAL
CREATE OR REPLACE FUNCTION public.on_user_approved_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if status changed to 'Approved'
  IF (OLD.status = 'Pending Approval' AND NEW.status = 'Approved') THEN
    INSERT INTO public.email_logs (tenant_id, recipient_email, subject, template_type, body)
    VALUES (
      NEW.tenant_id,
      NEW.email,
      'Identity Verified: Access Granted!',
      'AccountApproval',
      'Greetings ' || NEW.full_name || '. Your identity has been verified by the Barangay Office. You can now log in and access all digital services and benefit plans.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_user_approved_email
AFTER UPDATE OF status ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.on_user_approved_email();

-- 4. Trigger for PLAN APPROVAL
CREATE OR REPLACE FUNCTION public.on_plan_approved_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_plan_name TEXT;
BEGIN
  -- Only trigger if status changed to 'Approved'
  IF (OLD.status = 'Pending' AND NEW.status = 'Approved') THEN
    -- Get user email and plan name
    SELECT email, full_name INTO v_user_email, v_user_name FROM public.user_profiles WHERE id = NEW.user_id;
    SELECT name INTO v_plan_name FROM public.plans WHERE id = NEW.plan_id;

    INSERT INTO public.email_logs (tenant_id, recipient_email, subject, template_type, body)
    VALUES (
      NEW.tenant_id,
      v_user_email,
      'Benefit Plan Activated: ' || v_plan_name,
      'PlanApproval',
      'Congratulations ' || v_user_name || '! Your application for the ' || v_plan_name || ' Benefit Plan has been approved. You can now view your digital entitlement pass on the dashboard.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_plan_approved_email
AFTER UPDATE OF status ON public.resident_plans
FOR EACH ROW EXECUTE FUNCTION public.on_plan_approved_email();
