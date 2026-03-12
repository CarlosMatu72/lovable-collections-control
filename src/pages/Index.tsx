import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search, Download, AlertTriangle, DollarSign, CreditCard, BarChart3, Users, Clock, Bell, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  const { role } = useAuth();
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

  // Admin queries
  const { data: pendingCount } = useQuery({
    queryKey: ["admin-pending-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    enabled: role === "admin",
  });

  const { data: lastUpload } = useQuery({
    queryKey: ["admin-last-upload"],
    queryFn: async () => {
      const { data } = await supabase.from("upload_log").select("*").order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
    enabled: role === "admin",
  });

  const { data: uploadProfiles } = useQuery({
    queryKey: ["profiles-map-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name");
      return data ?? [];
    },
    enabled: role === "admin",
  });

  const { data: alertsCount } = useQuery({
    queryKey: ["admin-alerts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("visto", false);
      return count ?? 0;
    },
    enabled: role === "admin",
  });

  const profileMapDash = useMemo(() => {
    const map: Record<string, string> = {};
    uploadProfiles?.forEach((p) => (map[p.id] = p.name));
    return map;
  }, [uploadProfiles]);

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

  const topVencidos = useMemo(() =>
    [...clientSummaries].sort((a, b) => b.vencido - a.vencido).slice(0, 10),
  [clientSummaries]);

  const topAFavor = useMemo(() =>
    [...clientSummaries].filter((c) => c.a_favor > 0).sort((a, b) => b.a_favor - a.a_favor).slice(0, 10),
  [clientSummaries]);

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
      Código: c.cliente_codigo, Nombre: c.nombre, Vigente: c.vigente, Vencido: c.vencido,
      "A Favor": c.a_favor, "Saldo Neto": c.neto, "% Vencido": +c.pct_vencido.toFixed(1),
      "Fact. Vencidas": c.fact_vencidas, "Días Prom.": c.dias_prom,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filtered]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Hace menos de 1 hora";
    if (hours < 24) return `Hace ${hours} hora${hours > 1 ? "s" : ""}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days > 1 ? "s" : ""}`;
  };

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo a Favor</CardTitle>
            <CreditCard className="h-5 w-5" style={{ color: "hsl(var(--info))" }} />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" style={{ color: "hsl(var(--info))" }}>{fmt(kpis?.a_favor ?? 0)}</p>
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
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">% Cartera Vencida</span>
          <Progress value={kpis?.pctVencido ?? 0} className="flex-1" />
          <span className="text-lg font-bold font-mono">{(kpis?.pctVencido ?? 0).toFixed(1)}%</span>
        </CardContent>
      </Card>

      {/* Admin Panel */}
      {role === "admin" && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Panel Administrativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Pending users + Last upload + Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Usuarios Pendientes</p>
                    <p className="text-2xl font-bold font-mono">{pendingCount ?? 0}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/usuarios")}>Ver →</Button>
              </div>

              <div className="rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Última Carga</p>
                </div>
                {lastUpload ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(lastUpload.created_at)} por {profileMapDash[lastUpload.user_id] || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(lastUpload.facturas_nuevas ?? 0) + (lastUpload.facturas_actualizadas ?? 0) + (lastUpload.facturas_pagadas ?? 0)} facturas procesadas
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin cargas</p>
                )}
                <Button variant="ghost" size="sm" className="mt-1 -ml-3" onClick={() => navigate("/historial")}>Ver Historial →</Button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Alertas Activas</p>
                    <p className="text-2xl font-bold font-mono">{alertsCount ?? 0}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/alertas")}>Ver Todas →</Button>
              </div>
            </div>

            {/* Row 2: Top 10s */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold">Top 10 — Mayor Deuda Vencida</p>
                </div>
                <div className="space-y-2">
                  {topVencidos.map((c, i) => (
                    <div
                      key={c.cliente_codigo}
                      className="flex items-center justify-between text-sm cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/clientes/${c.cliente_codigo}`)}
                    >
                      <span className="truncate">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {c.nombre}
                      </span>
                      <span className="font-mono text-destructive shrink-0 ml-2">{fmt(c.vencido)}</span>
                    </div>
                  ))}
                  {topVencidos.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
                </div>
              </div>

              <div className="rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--info))" }} />
                  <p className="text-sm font-semibold">Top 10 — Saldos a Favor</p>
                </div>
                <div className="space-y-2">
                  {topAFavor.map((c, i) => (
                    <div
                      key={c.cliente_codigo}
                      className="flex items-center justify-between text-sm cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/clientes/${c.cliente_codigo}`)}
                    >
                      <span className="truncate">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {c.nombre}
                      </span>
                      <span className="font-mono shrink-0 ml-2" style={{ color: "hsl(var(--info))" }}>{fmt(c.a_favor)}</span>
                    </div>
                  ))}
                  {topAFavor.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableCell className="text-right font-mono" style={{ color: "hsl(var(--info))" }}>{fmt(c.a_favor)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmt(c.neto)}</TableCell>
                  <TableCell className="text-right font-mono">{c.pct_vencido.toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono">{c.fact_vencidas}</TableCell>
                  <TableCell className="text-right font-mono">{c.dias_prom}</TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No se encontraron clientes</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages} ({filtered.length} clientes)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
