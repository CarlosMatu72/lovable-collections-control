-- Ampliar columna reference de VARCHAR(6) a VARCHAR(50)
ALTER TABLE public.invoices 
ALTER COLUMN reference TYPE VARCHAR(50);

-- Ampliar columna referencia en payment_log también
ALTER TABLE public.payment_log 
ALTER COLUMN referencia TYPE VARCHAR(50);

-- Ampliar columna referencia en comments
ALTER TABLE public.comments 
ALTER COLUMN referencia TYPE VARCHAR(50);

-- Ampliar columna referencia en alerts
ALTER TABLE public.alerts 
ALTER COLUMN referencia TYPE VARCHAR(50);

-- Verificar cambios
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('invoices', 'payment_log', 'comments', 'alerts')
  AND column_name IN ('reference', 'referencia')
ORDER BY table_name, column_name;