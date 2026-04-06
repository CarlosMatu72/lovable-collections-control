DROP POLICY IF EXISTS "Approved users can insert alerts" ON public.alerts;

CREATE POLICY "Approved users can insert alerts"
  ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (
    (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'))
    AND (user_id IS NULL OR user_id = auth.uid())
  );