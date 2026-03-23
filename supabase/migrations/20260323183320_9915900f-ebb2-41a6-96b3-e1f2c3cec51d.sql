CREATE POLICY "Approved users can delete invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (
  (get_user_status(auth.uid()) = 'approved'::user_status)
  OR has_role(auth.uid(), 'admin'::app_role)
);