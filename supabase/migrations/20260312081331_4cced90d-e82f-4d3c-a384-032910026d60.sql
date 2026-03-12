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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(CASE 
      WHEN active = true AND status = 'vigente' AND por_cobrar >= 0 
      THEN por_cobrar 
      ELSE 0 
    END), 0) AS vigente,

    COALESCE(SUM(CASE 
      WHEN active = true AND status = 'vencida' 
      THEN por_cobrar 
      ELSE 0 
    END), 0) AS vencido,

    COALESCE(SUM(CASE 
      WHEN active = true AND por_cobrar < 0 
      THEN ABS(por_cobrar) 
      ELSE 0 
    END), 0) AS a_favor,

    COALESCE(SUM(CASE 
      WHEN active = true 
      THEN por_cobrar 
      ELSE 0 
    END), 0) AS neto,

    CASE 
      WHEN SUM(CASE WHEN active = true THEN por_cobrar ELSE 0 END) > 0 
      THEN (
        SUM(CASE WHEN active = true AND status = 'vencida' THEN por_cobrar ELSE 0 END)
        /
        SUM(CASE WHEN active = true THEN por_cobrar ELSE 0 END)
      ) * 100
      ELSE 0
    END AS pct_vencido,

    COUNT(CASE WHEN active = true THEN 1 END) AS total_facturas

  FROM public.invoices;
$$;