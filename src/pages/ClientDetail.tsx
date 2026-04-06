import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Pencil, CheckCircle, DollarSign, Download, MessageSquare, Search,
  AlertTriangle, TrendingDown, TrendingUp,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { DetailChart } from "@/components/MiniChart";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function ClientDetail() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal states
  const [payModal, setPayModal] = useState<{ ref: string; monto: number } | null>(null);
  const [payNotes, setPayNotes] = useState("");
  const [abonoModal, setAbonoModal] = useState<{ ref: string; saldo: number; prevStatus: "vigente" | "vencida" | "abono_parcial" } | null>(null);
  const [abonoMonto, setAbonoMonto] = useState("");
  const [abonoNotes, setAbonoNotes] = useState("");
  const [commentModal, setCommentModal] = useState(false);
  const [commentType, setCommentType] = useState<"general" | "factura">("general");
  const [commentRef, setCommentRef] = useState("");
  const [commentText, setCommentText] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("todos");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDias, setEditDias] = useState(45);
  const [editTipoDias, setEditTipoDias] = useState("naturales");
  const [editLimite, setEditLimite] = useState(0);
  const [editEstado, setEditEstado] = useState("activo");

  const { data: client } = useQuery({
    queryKey: ["client", codigo],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("codigo", codigo!).single();
      return data;
    },
    enabled: !!codigo,
  });

  const { data: activeInvoices } = useQuery({
    queryKey: ["client-invoices-active", codigo],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("cliente_codigo", codigo!)
        .eq("active", true)
        .order("fecha_emision", { ascending: false });
      return data ?? [];
    },
    enabled: !!codigo,
  });

  const { data: paidInvoices } = useQuery({
    queryKey: ["client-invoices-paid", codigo],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("cliente_codigo", codigo!)
        .eq("active", false)
        .order("paid_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!codigo,
  });

  const { data: comments } = useQuery({
    queryKey: ["client-comments", codigo],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("cliente_codigo", codigo!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!codigo,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles?.forEach((p) => (map[p.id] = p.name));
    return map;
  }, [profiles]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    if (!activeInvoices) return { porCobrar: 0, aFavor: 0, neto: 0, vigente: 0, vencido: 0 };
    let porCobrar = 0, aFavor = 0, vigente = 0, vencido = 0;
    activeInvoices.forEach((inv) => {
      const pc = inv.por_cobrar ?? 0;
      if (pc < 0) {
        aFavor += Math.abs(pc);
      } else {
        porCobrar += pc;
        if (inv.status === "vencida") vencido += pc;
        else vigente += pc;
      }
    });
    return { porCobrar, aFavor, neto: porCobrar - aFavor, vigente, vencido };
  }, [activeInvoices]);

  // Calculate due date for each invoice
  const invoicesWithDue = useMemo(() => {
    if (!activeInvoices || !client) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const calcVencimiento = (fechaEmision: string, diasCredito: number, tipoDias: string): Date => {
      const result = new Date(fechaEmision);
      if (tipoDias === "naturales") {
        result.setDate(result.getDate() + diasCredito);
        return result;
      }
      let counted = 0;
      const cursor = new Date(fechaEmision);
      while (counted < diasCredito) {
        cursor.setDate(cursor.getDate() + 1);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) counted++;
      }
      return cursor;
    };
    return activeInvoices.map((inv) => {
      let vencimiento: Date | null = null;
      let diasVencidos = 0;
      if (inv.fecha_emision) {
        vencimiento = calcVencimiento(inv.fecha_emision, client.dias_credito, client.tipo_dias);
        diasVencidos = Math.floor((today.getTime() - vencimiento.getTime()) / 86400000);
      }
      return { ...inv, vencimiento, diasVencidos };
    });
  }, [activeInvoices, client]);

  const filteredInvoices = useMemo(() => {
    let list = invoicesWithDue;
    if (invoiceFilter === "vencidas") list = list.filter((i) => i.status === "vencida");
    else if (invoiceFilter === "vigentes") list = list.filter((i) => i.status === "vigente");
    else if (invoiceFilter === "abono_parcial") list = list.filter((i) => i.status === "abono_parcial");
    if (invoiceSearch) {
      const q = invoiceSearch.toLowerCase();
      list = list.filter((i) => i.reference.toLowerCase().includes(q));
    }
    return list;
  }, [invoicesWithDue, invoiceFilter, invoiceSearch]);

  const limitUsed = useMemo(() => {
    if (!client || client.limite_credito <= 0) return 0;
    return (kpis.porCobrar / client.limite_credito) * 100;
  }, [kpis, client]);

  // Mutations
  const pagoTotal = useMutation({
    mutationFn: async () => {
      if (!payModal) return;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("payment_log").insert({
        user_id: user!.id,
        referencia: payModal.ref,
        cliente_codigo: codigo!,
        tipo: "pago_total",
        monto_original: payModal.monto,
        monto_aplicado: payModal.monto,
        saldo_restante: 0,
        notas: payNotes || null,
      });
      const { error } = await supabase.from("invoices").update({
        por_cobrar: 0,
        status: "pagada" as const,
        active: false,
        paid_date: new Date().toISOString().split("T")[0],
      }).eq("reference", payModal.ref);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-invoices-active", codigo] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices-paid", codigo] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      queryClient.invalidateQueries({ queryKey: ["clients-full"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-active"] });
      setPayModal(null);
      setPayNotes("");
      toast({ title: "✓ Pago registrado exitosamente" });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const aplicarAbono = useMutation({
    mutationFn: async () => {
      if (!abonoModal) return;
      const monto = parseFloat(abonoMonto);
      if (isNaN(monto) || monto <= 0 || monto > abonoModal.saldo) throw new Error("Monto inválido");
      const saldoRestante = abonoModal.saldo - monto;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("payment_log").insert({
        user_id: user!.id,
        referencia: abonoModal.ref,
        cliente_codigo: codigo!,
        tipo: "abono",
        monto_original: abonoModal.saldo,
        monto_aplicado: monto,
        saldo_restante: saldoRestante,
        notas: abonoNotes || null,
      });
      const { error } = await supabase.from("invoices").update({
        por_cobrar: saldoRestante,
        status: abonoModal.prevStatus,
      }).eq("reference", abonoModal.ref);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-invoices-active", codigo] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      queryClient.invalidateQueries({ queryKey: ["clients-full"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-active"] });
      setAbonoModal(null);
      setAbonoMonto("");
      setAbonoNotes("");
      toast({ title: `✓ Abono de ${fmt(parseFloat(abonoMonto))} aplicado` });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) throw new Error("Comentario vacío");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("comments").insert({
        cliente_codigo: codigo!,
        tipo: commentType,
        referencia: commentType === "factura" ? commentRef : null,
        user_id: user!.id,
        comentario: commentText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-comments", codigo] });
      setCommentModal(false);
      setCommentText("");
      setCommentRef("");
      toast({ title: "✓ Comentario guardado" });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const updateClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").update({
        nombre: editName,
        dias_credito: editDias,
        tipo_dias: editTipoDias as "naturales" | "habiles",
        limite_credito: editLimite,
        estado: editEstado as "activo" | "inactivo",
      }).eq("codigo", codigo!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", codigo] });
      setEditOpen(false);
      toast({ title: "✓ Cliente actualizado" });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const openEditModal = useCallback(() => {
    if (!client) return;
    setEditName(client.nombre);
    setEditDias(client.dias_credito);
    setEditTipoDias(client.tipo_dias);
    setEditLimite(client.limite_credito);
    setEditEstado(client.estado);
    setEditOpen(true);
  }, [client]);

  const exportInvoices = useCallback(() => {
    const data = filteredInvoices.map((i) => ({
      Referencia: i.reference,
      Fecha: i.fecha_emision,
      Vencimiento: i.vencimiento ? i.vencimiento.toISOString().split("T")[0] : "",
      Total: i.total_factura,
      "Por Cobrar": i.por_cobrar,
      Status: i.status,
      "Días Vencido": i.diasVencidos,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    XLSX.writeFile(wb, `${codigo}_facturas.xlsx`);
  }, [filteredInvoices, codigo]);

  // Group comments
  const generalComments = useMemo(() => comments?.filter((c) => c.tipo === "general") ?? [], [comments]);
  const facturaComments = useMemo(() => {
    const grouped: Record<string, typeof comments> = {};
    comments?.filter((c) => c.tipo === "factura").forEach((c) => {
      const ref = c.referencia || "sin-ref";
      if (!grouped[ref]) grouped[ref] = [];
      grouped[ref]!.push(c);
    });
    return grouped;
  }, [comments]);

  // Chart data - 6 months
  const chartData = useMemo(() => {
    if (!activeInvoices) return [];
    const months: Record<string, { facturacion: number; cobros: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { facturacion: 0, cobros: 0 };
    }
    activeInvoices.forEach((inv) => {
      if (!inv.fecha_emision) return;
      const key = inv.fecha_emision.substring(0, 7);
      if (months[key]) {
        months[key].facturacion += inv.total_factura ?? 0;
        months[key].cobros += inv.cobranza ?? 0;
      }
    });
    return Object.entries(months).map(([mes, vals]) => ({
      mes: mes.substring(5),
      ...vals,
    }));
  }, [activeInvoices]);

  if (!client) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary"; label: string }> = {
      vigente: { variant: "default", label: "Vigente" },
      vencida: { variant: "destructive", label: "Vencida" },
      abono_parcial: { variant: "secondary", label: "Abono Parcial" },
      pagada: { variant: "default", label: "Pagada" },
    };
    const v = variants[status] || { variant: "secondary" as const, label: status };
    return (
      <Badge
        variant={v.variant}
        className={status === "abono_parcial" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : status === "pagada" ? "bg-emerald-900/30 text-emerald-400 border-emerald-600/30" : ""}
      >
        {v.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              <span className="font-mono text-muted-foreground">{client.codigo}</span> — {client.nombre}
            </h1>
            <Button variant="ghost" size="icon" onClick={openEditModal}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Monto Vigente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600">{fmt(kpis.vigente)}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas no vencidas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Monto Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-600">{fmt(kpis.vencido)}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas vencidas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-500" />
              Saldo a Favor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600">{fmt(kpis.aFavor)}</div>
            <p className="text-xs text-muted-foreground mt-1">Crédito del cliente</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Saldo Neto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{fmt(kpis.neto)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total a cobrar</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main Column */}
        <Tabs defaultValue="cartera" className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="cartera">Cartera</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
            <TabsTrigger value="honorarios">Honorarios</TabsTrigger>
          </TabsList>

          {/* Tab: Cartera */}
          <TabsContent value="cartera" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                <SelectTrigger className="w-44 bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vencidas">Solo Vencidas</SelectItem>
                  <SelectItem value="vigentes">Solo Vigentes</SelectItem>
                  
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar referencia..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Button variant="outline" size="icon" onClick={exportInvoices} title="Exportar">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Por Cobrar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Días</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.reference}</TableCell>
                        <TableCell className="text-sm">{fmtDate(inv.fecha_emision)}</TableCell>
                        <TableCell className="text-sm">
                          {inv.vencimiento ? fmtDate(inv.vencimiento.toISOString().split("T")[0]) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(inv.total_factura ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(inv.por_cobrar ?? 0)}</TableCell>
                        <TableCell>{statusBadge(inv.status)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {inv.diasVencidos > 0 ? (
                            <span className="text-destructive">{inv.diasVencidos}</span>
                          ) : inv.diasVencidos < 0 ? (
                            <span className="text-primary">{Math.abs(inv.diasVencidos)}</span>
                          ) : "0"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Pago Total"
                              onClick={() => setPayModal({ ref: inv.reference, monto: inv.por_cobrar ?? 0 })}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Aplicar Abono"
                              onClick={() => setAbonoModal({ ref: inv.reference, saldo: inv.por_cobrar ?? 0, prevStatus: inv.status as "vigente" | "vencida" | "abono_parcial" })}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin facturas</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Fecha Emisión</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidInvoices?.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.reference}</TableCell>
                        <TableCell className="text-sm">{fmtDate(inv.fecha_emision)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(inv.paid_date)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(inv.total_factura ?? 0)}</TableCell>
                        <TableCell>{statusBadge("pagada")}</TableCell>
                      </TableRow>
                    ))}
                    {(!paidInvoices || paidInvoices.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin facturas pagadas</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Comentarios */}
          <TabsContent value="comentarios" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Comentarios</h3>
              <Button size="sm" onClick={() => setCommentModal(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Agregar Comentario
              </Button>
            </div>

            {/* General Comments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Comentarios Generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {generalComments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin comentarios generales</p>
                )}
                {generalComments.map((c) => (
                  <div key={c.id} className="border-l-2 border-primary pl-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{profileMap[c.user_id] || "Usuario"}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleString("es-MX")}</span>
                    </div>
                    <p className="text-sm">{c.comentario}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Invoice Comments */}
            {Object.keys(facturaComments).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Comentarios por Factura</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(facturaComments).map(([ref, cmts]) => (
                    <div key={ref} className="space-y-3">
                      <p className="font-mono text-sm font-semibold text-primary">Factura: {ref}</p>
                      {cmts?.map((c) => (
                        <div key={c.id} className="border-l-2 border-muted pl-4 space-y-1 ml-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{profileMap[c.user_id] || "Usuario"}</span>
                            <span>·</span>
                            <span>{new Date(c.created_at).toLocaleString("es-MX")}</span>
                          </div>
                          <p className="text-sm">{c.comentario}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Honorarios */}
          <TabsContent value="honorarios">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Pedimento</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeInvoices?.filter((i) => (i.honorarios ?? 0) > 0).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{fmtDate(inv.fecha_emision)}</TableCell>
                        <TableCell className="font-mono text-sm">{inv.pedimento || "—"}</TableCell>
                        <TableCell>Honorarios</TableCell>
                        <TableCell className="text-right font-mono">{fmt(inv.honorarios ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                    {(!activeInvoices || activeInvoices.filter((i) => (i.honorarios ?? 0) > 0).length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin honorarios registrados</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Límite de Crédito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold font-mono">{fmt(client.limite_credito)}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Usado</span>
                  <span className="font-mono">{limitUsed.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(limitUsed, 100)} className="h-2" />
              </div>
              <p className="text-sm text-muted-foreground">
                {client.dias_credito} días ({client.tipo_dias === "naturales" ? "naturales" : "hábiles"})
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Distribución (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailChart data={chartData} />
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: "hsl(217 91% 60%)" }} /> Facturación
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: "hsl(160 84% 39%)" }} /> Cobros
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pago Total Modal */}
      <Dialog open={!!payModal} onOpenChange={(open) => !open && setPayModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pago Total</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Factura: <span className="font-mono font-semibold">{payModal?.ref}</span></p>
            <p className="text-sm">Monto actual: <span className="font-mono font-bold">{fmt(payModal?.monto ?? 0)}</span></p>
            <p className="text-sm text-muted-foreground">¿Confirmar que esta factura fue pagada en su totalidad?</p>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Agregar notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            <Button onClick={() => pagoTotal.mutate()} disabled={pagoTotal.isPending}>
              {pagoTotal.isPending ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abono Modal */}
      <Dialog open={!!abonoModal} onOpenChange={(open) => !open && setAbonoModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Abono</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Factura: <span className="font-mono font-semibold">{abonoModal?.ref}</span></p>
            <p className="text-sm">Saldo actual: <span className="font-mono font-bold">{fmt(abonoModal?.saldo ?? 0)}</span></p>
            <div>
              <Label>Monto del abono</Label>
              <Input
                type="number"
                value={abonoMonto}
                onChange={(e) => setAbonoMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {abonoMonto && !isNaN(parseFloat(abonoMonto)) && (
              <p className="text-sm">
                Saldo restante: <span className="font-mono font-bold">{fmt((abonoModal?.saldo ?? 0) - parseFloat(abonoMonto))}</span>
              </p>
            )}
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={abonoNotes} onChange={(e) => setAbonoNotes(e.target.value)} placeholder="Agregar notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbonoModal(null)}>Cancelar</Button>
            <Button onClick={() => aplicarAbono.mutate()} disabled={aplicarAbono.isPending}>
              {aplicarAbono.isPending ? "Procesando..." : "Aplicar Abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Modal */}
      <Dialog open={commentModal} onOpenChange={setCommentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Comentario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <RadioGroup value={commentType} onValueChange={(v) => setCommentType(v as "general" | "factura")} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="general" id="cg" />
                  <Label htmlFor="cg" className="font-normal">General del cliente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="factura" id="cf" />
                  <Label htmlFor="cf" className="font-normal">Factura específica</Label>
                </div>
              </RadioGroup>
            </div>
            {commentType === "factura" && (
              <div>
                <Label>Factura</Label>
                <Select value={commentRef} onValueChange={setCommentRef}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Seleccionar factura..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeInvoices?.map((inv) => (
                      <SelectItem key={inv.id} value={inv.reference}>{inv.reference}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Comentario</Label>
              <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={4} placeholder="Escribe tu comentario..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentModal(false)}>Cancelar</Button>
            <Button onClick={() => addComment.mutate()} disabled={addComment.isPending}>
              {addComment.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input value={codigo ?? ""} disabled className="bg-muted font-mono" />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Días de crédito</Label>
                <Input type="number" value={editDias} onChange={(e) => setEditDias(+e.target.value)} />
              </div>
              <div>
                <Label>Tipo</Label>
                <RadioGroup value={editTipoDias} onValueChange={setEditTipoDias} className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="naturales" id="en" />
                    <Label htmlFor="en" className="font-normal">Nat.</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="habiles" id="eh" />
                    <Label htmlFor="eh" className="font-normal">Háb.</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div>
              <Label>Límite de crédito</Label>
              <Input type="number" value={editLimite} onChange={(e) => setEditLimite(+e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <RadioGroup value={editEstado} onValueChange={setEditEstado} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="activo" id="ea" />
                  <Label htmlFor="ea" className="font-normal">Activo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inactivo" id="ei" />
                  <Label htmlFor="ei" className="font-normal">Inactivo</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateClient.mutate()} disabled={updateClient.isPending}>
              {updateClient.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
