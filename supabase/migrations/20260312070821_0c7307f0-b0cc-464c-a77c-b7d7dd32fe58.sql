
-- Fix alerts insert policy to be more restrictive
DROP POLICY "Authenticated can insert alerts" ON public.alerts;
CREATE POLICY "Approved users can insert alerts"
  ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));
