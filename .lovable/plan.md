

## Plan: Add 4 KPI Cards to Client Detail

**What changes**: Replace the 3 KPI cards (Por Cobrar, Saldos a Favor, Saldo Neto) with 4 colored KPI cards (Monto Vigente, Monto Vencido, Saldo a Favor, Saldo Neto) in `src/pages/ClientDetail.tsx`.

### Changes

**File: `src/pages/ClientDetail.tsx`**

1. **Update imports** (line 24): Add `AlertTriangle`, `TrendingDown`, `TrendingUp` icons

2. **Expand KPI calculation** (lines 131-140): Add `montoVigente` and `montoVencido` by classifying invoices based on `status`:
   - `vigente` or `abono_parcial` with positive `por_cobrar` → vigente
   - `vencida` with positive `por_cobrar` → vencido

3. **Replace KPI cards grid** (lines 398-417): Change from 3-column plain cards to 4-column colored cards:
   - Monto Vigente: green left border, green icon/text
   - Monto Vencido: red left border, red icon/text  
   - Saldo a Favor: blue left border, blue icon/text
   - Saldo Neto: primary left border, primary icon/text
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

4. **Update skeleton** (lines 349-354): Change from 3 to 4 skeleton cards

No other files are modified. Dashboard, tabs, credit limit card, and all other functionality remain untouched.

