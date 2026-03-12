
-- Upload log table
CREATE TABLE public.upload_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fecha_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archivo_nombre TEXT NOT NULL,
  facturas_nuevas INT DEFAULT 0,
  facturas_actualizadas INT DEFAULT 0,
  facturas_pagadas INT DEFAULT 0,
  clientes_nuevos INT DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view uploads"
  ON public.upload_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert upload_log"
  ON public.upload_log FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'))
  );

-- Festivos Mexico table
CREATE TABLE public.festivos_mexico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  descripcion TEXT
);

ALTER TABLE public.festivos_mexico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view festivos"
  ON public.festivos_mexico FOR SELECT
  TO authenticated
  USING (true);

-- Insert holidays
INSERT INTO public.festivos_mexico (fecha, descripcion) VALUES
('2025-01-01', 'Año Nuevo'),
('2025-02-03', 'Día de la Constitución'),
('2025-03-17', 'Natalicio de Benito Juárez'),
('2025-05-01', 'Día del Trabajo'),
('2025-09-16', 'Independencia de México'),
('2025-11-17', 'Revolución Mexicana'),
('2025-12-25', 'Navidad'),
('2026-01-01', 'Año Nuevo'),
('2026-02-02', 'Día de la Constitución'),
('2026-03-16', 'Natalicio de Benito Juárez'),
('2026-05-01', 'Día del Trabajo'),
('2026-09-16', 'Independencia de México'),
('2026-11-16', 'Revolución Mexicana'),
('2026-12-25', 'Navidad');

-- Function to calculate due date
CREATE OR REPLACE FUNCTION public.calcular_fecha_vencimiento(
  fecha_inicio DATE,
  dias_credito INT,
  tipo_dias public.dias_tipo
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  fecha_resultado DATE;
  dias_contados INT;
  es_festivo BOOLEAN;
  dia_semana INT;
BEGIN
  IF tipo_dias = 'naturales' THEN
    RETURN fecha_inicio + dias_credito;
  END IF;
  
  fecha_resultado := fecha_inicio;
  dias_contados := 0;
  
  WHILE dias_contados < dias_credito LOOP
    fecha_resultado := fecha_resultado + 1;
    dia_semana := EXTRACT(DOW FROM fecha_resultado);
    
    IF dia_semana != 0 AND dia_semana != 6 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.festivos_mexico 
        WHERE fecha = fecha_resultado
      ) INTO es_festivo;
      
      IF NOT es_festivo THEN
        dias_contados := dias_contados + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN fecha_resultado;
END;
$$;
