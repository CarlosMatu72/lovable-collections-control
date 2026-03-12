
-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  accion TEXT NOT NULL,
  tabla TEXT NOT NULL,
  registro_id TEXT,
  valores_anteriores JSONB,
  valores_nuevos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_tabla ON public.audit_log(tabla);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

CREATE POLICY "Admins can view audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));
