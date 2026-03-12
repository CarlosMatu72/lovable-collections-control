
CREATE OR REPLACE FUNCTION public.calcular_kpis()
RETURNS TABLE (
  vigente NUMERIC,
  vencido NUMERIC,
  a_favor NUMERIC,
  neto NUMERIC,
  pct_vencido NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN status IN ('vigente', 'abono_parcial') AND por_cobrar >= 0 THEN por_cobrar ELSE 0 END), 0) as vigente,
    COALESCE(SUM(CASE WHEN status = 'vencida' AND por_cobrar >= 0 THEN por_cobrar ELSE 0 END), 0) as vencido,
    COALESCE(SUM(CASE WHEN por_cobrar < 0 THEN ABS(por_cobrar) ELSE 0 END), 0) as a_favor,
    COALESCE(SUM(por_cobrar), 0) as neto,
    CASE 
      WHEN COALESCE(SUM(CASE WHEN por_cobrar > 0 THEN por_cobrar ELSE 0 END), 0) > 0 
      THEN (COALESCE(SUM(CASE WHEN status = 'vencida' AND por_cobrar > 0 THEN por_cobrar ELSE 0 END), 0) / SUM(CASE WHEN por_cobrar > 0 THEN por_cobrar ELSE 0 END)) * 100
      ELSE 0
    END as pct_vencido
  FROM public.invoices
  WHERE active = true;
$$;
