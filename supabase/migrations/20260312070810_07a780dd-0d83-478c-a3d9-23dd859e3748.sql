
-- Payment log table
CREATE TABLE public.payment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  referencia VARCHAR(100) NOT NULL,
  cliente_codigo VARCHAR(6) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pago_total', 'abono')),
  monto_original DECIMAL(15,2) NOT NULL,
  monto_aplicado DECIMAL(15,2) NOT NULL,
  saldo_restante DECIMAL(15,2) NOT NULL,
  notas TEXT,
  modified_by_upload BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payment_log_referencia ON public.payment_log(referencia);
CREATE INDEX idx_payment_log_cliente ON public.payment_log(cliente_codigo);

CREATE POLICY "Approved users can view payment_log"
  ON public.payment_log FOR SELECT TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert payment_log"
  ON public.payment_log FOR INSERT TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can update payment_log"
  ON public.payment_log FOR UPDATE TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo VARCHAR(6) NOT NULL,
  referencia VARCHAR(100),
  tipo TEXT NOT NULL CHECK (tipo IN ('general', 'factura')),
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_cliente ON public.comments(cliente_codigo);
CREATE INDEX idx_comments_referencia ON public.comments(referencia);

CREATE POLICY "Approved users can view comments"
  ON public.comments FOR SELECT TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('pago_restaurado', 'limite_excedido', 'usuario_pendiente', 'carga_exitosa')),
  mensaje TEXT NOT NULL,
  referencia VARCHAR(100),
  cliente_codigo VARCHAR(6),
  user_id UUID,
  fecha_alerta TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  visto BOOLEAN DEFAULT false,
  visto_por UUID,
  visto_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alerts_visto ON public.alerts(visto);
CREATE INDEX idx_alerts_tipo ON public.alerts(tipo);

CREATE POLICY "Admins can view all alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert alerts"
  ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
