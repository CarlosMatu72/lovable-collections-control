
-- FIX 1: Tighten INSERT policies to prevent user_id spoofing on audit_log, payment_log, comments

-- audit_log (user_id is nullable, allow NULL or own id)
DROP POLICY IF EXISTS "Approved users can insert audit_log" ON public.audit_log;
CREATE POLICY "Approved users can insert audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (get_user_status(auth.uid()) = 'approved' OR has_role(auth.uid(), 'admin'))
  );

-- payment_log (user_id is NOT NULL)
DROP POLICY IF EXISTS "Approved users can insert payment_log" ON public.payment_log;
CREATE POLICY "Approved users can insert payment_log"
  ON public.payment_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (get_user_status(auth.uid()) = 'approved' OR has_role(auth.uid(), 'admin'))
  );

-- comments (user_id is NOT NULL)
DROP POLICY IF EXISTS "Approved users can insert comments" ON public.comments;
CREATE POLICY "Approved users can insert comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (get_user_status(auth.uid()) = 'approved' OR has_role(auth.uid(), 'admin'))
  );

-- FIX 2: Add SELECT policy for approved users to read their own alerts
CREATE POLICY "Approved users can view own alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (
    (get_user_status(auth.uid()) = 'approved' OR has_role(auth.uid(), 'admin'))
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- FIX 3: Scope user_roles SELECT policies to authenticated only
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
