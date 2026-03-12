
-- 1. Drop existing unique constraint on reference
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_reference_key;

-- 2. Set cuenta NOT NULL (with default for any existing nulls)
UPDATE public.invoices SET cuenta = reference WHERE cuenta IS NULL;
ALTER TABLE public.invoices ALTER COLUMN cuenta SET NOT NULL;

-- 3. Create composite unique index on cuenta+cliente_codigo for active invoices
CREATE UNIQUE INDEX IF NOT EXISTS invoices_cuenta_cliente_active_unique 
ON public.invoices (cuenta, cliente_codigo) 
WHERE active = true;

-- 4. Index on cuenta for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoices_cuenta ON public.invoices(cuenta);
