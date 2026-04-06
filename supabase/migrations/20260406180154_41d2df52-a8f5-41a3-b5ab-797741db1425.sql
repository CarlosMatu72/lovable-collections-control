DROP POLICY IF EXISTS "Users can update own profile name" ON public.profiles;

CREATE POLICY "Users can update own profile name"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND NOT public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    auth.uid() = id
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND approved_by IS NOT DISTINCT FROM (SELECT approved_by FROM public.profiles WHERE id = auth.uid())
    AND email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );