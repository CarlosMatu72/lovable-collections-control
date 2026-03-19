
-- Drop old cuenta+cliente unique constraint
DROP INDEX IF EXISTS invoices_cuenta_cliente_active_unique;

-- Create new unique constraint on reference where active
CREATE UNIQUE INDEX IF NOT EXISTS invoices_reference_active_unique 
ON public.invoices (reference) 
WHERE active = true;
