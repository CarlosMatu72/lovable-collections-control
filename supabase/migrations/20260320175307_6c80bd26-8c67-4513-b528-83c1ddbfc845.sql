
-- Add metadata JSONB column to alerts for reconciliation details
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index on tipo for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_tipo ON public.alerts(tipo);

-- Add modified_at column to payment_log
ALTER TABLE public.payment_log ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN alerts.metadata IS 'Additional alert details (JSON)';
COMMENT ON COLUMN payment_log.modified_at IS 'Date when overridden by portfolio upload';
