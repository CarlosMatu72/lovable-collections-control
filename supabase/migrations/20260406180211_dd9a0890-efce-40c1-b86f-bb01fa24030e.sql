DROP FUNCTION IF EXISTS public.calcular_kpis();

CREATE OR REPLACE FUNCTION public.calcular_kpis()
RETURNS TABLE (
  vigente NUMERIC,
  vencido NUMERIC,
  a_favor NUMERIC,
  neto NUMERIC,
  pct_vencido NUMERIC,
  total_facturas BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.get_user_status(auth.uid()) = 'approved'
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE
      WHEN active = true AND status IN ('vigente', 'abono_parcial') AND por_cobrar >= 0
      THEN por_cobrar ELSE 0
    END), 0)::NUMERIC AS vigente,

    COALESCE(SUM(CASE
      WHEN active = true AND status = 'vencida'
      THEN por_cobrar ELSE 0
    END), 0)::NUMERIC AS vencido,

    COALESCE(SUM(CASE
      WHEN active = true AND por_cobrar < 0
      THEN ABS(por_cobrar) ELSE 0
    END), 0)::NUMERIC AS a_favor,

    COALESCE(SUM(CASE
      WHEN active = true THEN por_cobrar ELSE 0
    END), 0)::NUMERIC AS neto,

    CASE
      WHEN SUM(CASE WHEN active = true THEN por_cobrar ELSE 0 END) > 0
      THEN (
        SUM(CASE WHEN active = true AND status = 'vencida' THEN por_cobrar ELSE 0 END)
        / SUM(CASE WHEN active = true THEN por_cobrar ELSE 0 END)
      ) * 100
      ELSE 0
    END::NUMERIC AS pct_vencido,

    COUNT(CASE WHEN active = true THEN 1 END)::BIGINT AS total_facturas

  FROM public.invoices;
END;
$$;