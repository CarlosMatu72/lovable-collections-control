
ALTER TABLE public.clients ALTER COLUMN codigo TYPE VARCHAR(20);
ALTER TABLE public.invoices ALTER COLUMN cliente_codigo TYPE VARCHAR(20);
ALTER TABLE public.payment_log ALTER COLUMN cliente_codigo TYPE VARCHAR(20);
ALTER TABLE public.comments ALTER COLUMN cliente_codigo TYPE VARCHAR(20);
ALTER TABLE public.alerts ALTER COLUMN cliente_codigo TYPE VARCHAR(20);
