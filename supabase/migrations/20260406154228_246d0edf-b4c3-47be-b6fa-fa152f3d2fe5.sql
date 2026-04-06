
-- Update calcular_kpis to include abono_parcial as vigente fallback
CREATE OR REPLACE FUNCTION public.calcular_kpis()
 RETURNS TABLE(vigente numeric, vencido numeric, a_favor numeric, neto numeric, pct_vencido numeric, total_facturas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(SUM(CASE 
      WHEN active = true AND status IN ('vigente', 'abono_parcial') AND por_cobrar >= 0 
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
$function$;

-- Migrate legacy abono_parcial rows to vigente
UPDATE public.invoices SET status = 'vigente' WHERE status = 'abono_parcial' AND active = true;
