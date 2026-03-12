import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Download, AlertTriangle, DollarSign, CreditCard, BarChart3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

interface ClientSummary {
  cliente_codigo: string;
  nombre: string;
  vigente: number;
  vencido: number;
  a_favor: number;
  neto: number;
  pct_vencido: number;
  fact_vencidas: number;
  dias_prom: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["dashboard-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("cliente_codigo, por_cobrar, status, active, fecha_emision")
        .eq("active", true);
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("codigo, nombre");
      return data ?? [];
    },
  });

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients?.forEach((c) => (map[c.codigo] = c.nombre));
    return map;
  }, [clients]);

  const kpis = useMemo(() => {
    if (!invoices?.length) return null;
    let vigente = 0, vencido = 0, a_favor = 0, neto = 0;
    invoices.forEach((inv) => {
      const pc = inv.por_cobrar ?? 0;
      neto += pc;
      if (pc < 0) a_favor += Math.abs(pc);
      else if (inv.status === "vencida") vencido += pc;
      else if (inv.status === "vigente") vigente += pc;
    });
    const pctVencido = neto > 0 ? (vencido / neto) * 100 : 0;
    return { vigente, vencido, a_favor, neto, pctVencido };
  }, [invoices]);

  const clientSummaries = useMemo(() => {
    if (!invoices?.length) return [];
    const map: Record<string, ClientSummary> = {};
    const today = new Date();

    invoices.forEach((inv) => {
      const code = inv.cliente_codigo;
      if (!map[code]) {
        map[code] = {
          cliente_codigo: code,
          nombre: clientMap[code] || code,
          vigente: 0, vencido: 0, a_favor: 0, neto: 0,
          pct_vencido: 0, fact_vencidas: 0, dias_prom: 0,
        };
      }
      const s = map[code];
      const pc = inv.por_cobrar ?? 0;
      s.neto += pc;
      if (pc < 0) s.a_favor += Math.abs(pc);
      else if (inv.status === "vencida") {
        s.vencido += pc;
        s.fact_vencidas++;
        if (inv.fecha_emision) {
          const diff = Math.floor((today.getTime() - new Date(inv.fecha_emision).getTime()) / 86400000);
          s.dias_prom += diff;
        }
      } else if (inv.status === "vigente") {
        s.vigente += pc;
      }
    });

    return Object.values(map).map((s) => {
      s.pct_vencido = s.neto > 0 ? (s.vencido / s.neto) * 100 : 0;
      if (s.fact_vencidas > 0) s.dias_prom = Math.round(s.dias_prom / s.fact_vencidas);
      return s;
    });
  }, [invoices, clientMap]);

  const filtered = useMemo(() => {
    if (!search) return clientSummaries;
    const q = search.toLowerCase();
    return clientSummaries.filter(
      (c) => c.cliente_codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    );
  }, [clientSummaries, search]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  const handleExport = useCallback(() => {
    const data = filtered.map(c => ({
      Código: c.cliente_codigo,
      Nombre: c.nombre,
      Vigente: c.vigente,
      Vencido: c.vencido,
      "A Favor": c.a_favor,
      "Saldo Neto": c.neto,
      "% Vencido": +c.pct_vencido.toFixed(1),
      "Fact. Vencidas": c.fact_vencidas,
      "Días Prom.": c.dias_prom,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `clientes_${fecha}.xlsx`);
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!invoices?.length) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-center gap-4 p-6">
          <AlertTriangle className="h-8 w-8 shrink-0" style={{ color: "hsl(38 92% 50%)" }} />
          <div>
            <h3 className="font-semibold text-lg">Atención</h3>
            <p className="text-muted-foreground">
              No se ha realizado ninguna carga de cartera.{" "}
              <Link to="/cargar-cartera" className="text-primary hover:underline font-medium">
                Actualizar ahora →
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monto Vigente</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{fmt(kpis?.vigente ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              {invoices.filter((i) => i.status === "vigente").length} facturas vigentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monto Vencido</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-destructive">{fmt(kpis?.vencido ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              {invoices.filter((i) => i.status === "vencida").length} facturas vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-info/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo a Favor</CardTitle>
            <CreditCard className="h-5 w-5" style={{ color: "hsl(217 91% 60%)" }} />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" style={{ color: "hsl(217 91% 60%)" }}>
              {fmt(kpis?.a_favor ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Pendientes de aplicar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Neto</CardTitle>
            <BarChart3 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{fmt(kpis?.neto ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Total de cartera</p>
          </CardContent>
        </Card>
      </div>

      {/* % Cartera Vencida */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            % Cartera Vencida
          </span>
          <Progress value={kpis?.pctVencido ?? 0} className="flex-1" />
          <span className="text-lg font-bold font-mono">{(kpis?.pctVencido ?? 0).toFixed(1)}%</span>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle>Clientes con Saldo</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código o nombre..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 bg-secondary border-border w-full sm:w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleExport} title="Exportar a Excel">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Vigente</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="text-right">A Favor</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">% Vencido</TableHead>
                <TableHead className="text-right">Fact. Vencidas</TableHead>
                <TableHead className="text-right">Días Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c) => (
                <TableRow
                  key={c.cliente_codigo}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/clientes/${c.cliente_codigo}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.cliente_codigo}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary">{fmt(c.vigente)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmt(c.vencido)}</TableCell>
                  <TableCell className="text-right font-mono" style={{ color: "hsl(217 91% 60%)" }}>{fmt(c.a_favor)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmt(c.neto)}</TableCell>
                  <TableCell className="text-right font-mono">{c.pct_vencido.toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono">{c.fact_vencidas}</TableCell>
                  <TableCell className="text-right font-mono">{c.dias_prom}</TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages} ({filtered.length} clientes)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
