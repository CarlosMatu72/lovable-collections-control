import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ParsedRow {
  cliente_codigo: string;
  cliente_nombre: string;
  cuenta: string;
  reference: string;
  fecha_emision: string | null;
  pedimento: string | null;
  honorarios: number;
  total_factura: number;
  anticipos: number;
  saldo: number;
  cobranza: number;
  por_cobrar: number;
}

interface PreviewStats {
  total: number;
  nuevas: number;
  existentes: number;
  pagadas: number;
  clientesNuevos: string[];
}

interface ProcessResult {
  nuevas: number;
  actualizadas: number;
  pagadas: number;
  clientesNuevos: number;
  errores: string[];
}

type Step = "idle" | "preview" | "processing" | "done" | "error";

const REQUIRED_COLUMNS = ["Cliente", "Cuenta", "Referencia", "Fecha", "Honorarios", "Total Factura", "Anticipos", "Saldo", "Cobranza", "Por Cobrar"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function UploadPortfolio() {
  const [step, setStep] = useState<Step>("idle");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressDetail, setProgressDetail] = useState({ actual: 0, total: 0, porcentaje: 0 });
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseNumber = (val: unknown): number => {
    if (val == null || val === "") return 0;
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const parseDate = (val: unknown): string | null => {
    if (!val) return null;
    if (typeof val === "number") {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      return null;
    }
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  };

  const actualizarStatusVencimientos = useCallback(async () => {
    const { data: facturas } = await supabase
      .from("invoices")
      .select("id, fecha_emision, status, cliente_codigo")
      .eq("active", true);

    const { data: clientesInfo } = await supabase
      .from("clients")
      .select("codigo, dias_credito, tipo_dias");

    if (!facturas || !clientesInfo) return;

    const clientMap: Record<string, { dias_credito: number; tipo_dias: string }> = {};
    clientesInfo.forEach((c) => {
      clientMap[c.codigo] = c;
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const updates: { id: string; status: "vigente" | "vencida" }[] = [];

    for (const f of facturas) {
      if (!f.fecha_emision) continue;
      const client = clientMap[f.cliente_codigo];
      if (!client) continue;

      const fechaVenc = new Date(f.fecha_emision);
      fechaVenc.setDate(fechaVenc.getDate() + client.dias_credito);
      const nuevoStatus: "vigente" | "vencida" = fechaVenc < hoy ? "vencida" : "vigente";

      if (f.status !== nuevoStatus) {
        updates.push({ id: f.id, status: nuevoStatus });
      }
    }

    for (const u of updates) {
      await supabase.from("invoices").update({ status: u.status }).eq("id", u.id);
    }
  }, []);

    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setErrorMsg("Solo se aceptan archivos .xlsx o .xls");
      setStep("error");
      return;
    }

    setFileName(file.name);
    setProgress(10);
    setProgressMsg("Leyendo archivo...");
    setStep("processing");

    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      // Validate columns
      const headers = Object.keys(rows[0] || {});
      const missing = REQUIRED_COLUMNS.filter(c => !headers.some(h => h.trim() === c));
      if (missing.length > 0) {
        setErrorMsg(`Columnas faltantes: ${missing.join(", ")}`);
        setStep("error");
        return;
      }

      setProgress(30);
      setProgressMsg("Procesando filas...");

      // Filter valid rows (skip subtotals)
      const valid: ParsedRow[] = rows
        .filter(r => r["Cliente"] && r["Cuenta"] && r["Referencia"])
        .map(r => {
          const clienteStr = String(r["Cliente"] || "");
          return {
            cliente_codigo: clienteStr.substring(0, 7).trim().toUpperCase(),
            cliente_nombre: clienteStr.substring(7).trim(),
            cuenta: String(r["Cuenta"] || ""),
            reference: String(r["Referencia"] || ""),
            fecha_emision: parseDate(r["Fecha"]),
            pedimento: r["Pedimento"] ? String(r["Pedimento"]) : null,
            honorarios: parseNumber(r["Honorarios"]),
            total_factura: parseNumber(r["Total Factura"]),
            anticipos: parseNumber(r["Anticipos"]),
            saldo: parseNumber(r["Saldo"]),
            cobranza: parseNumber(r["Cobranza"]),
            por_cobrar: parseNumber(r["Por Cobrar"]),
          };
        });

      if (valid.length === 0) {
        setErrorMsg("No se encontraron filas válidas en el archivo");
        setStep("error");
        return;
      }

      setParsedRows(valid);
      setProgress(50);
      setProgressMsg("Comparando con base de datos...");

      // Get current active refs
      const refsArchivo = new Set(valid.map(r => r.reference));
      const { data: facturasActuales } = await supabase
        .from("invoices")
        .select("reference")
        .eq("active", true);
      const refsActuales = new Set(facturasActuales?.map(f => f.reference) || []);

      const nuevas = [...refsArchivo].filter(r => !refsActuales.has(r)).length;
      const existentes = [...refsArchivo].filter(r => refsActuales.has(r)).length;
      const pagadas = [...refsActuales].filter(r => !refsArchivo.has(r)).length;

      const codigosArchivo = [...new Set(valid.map((row) => row.cliente_codigo))];
      const { data: clientesExistentes } = await supabase
        .from("clients")
        .select("codigo")
        .in("codigo", codigosArchivo);

      const codigosEnBD = new Set(clientesExistentes?.map((c) => c.codigo) || []);
      const clientesNuevos = codigosArchivo.filter((c) => !codigosEnBD.has(c));

      if (clientesNuevos.length > 0) {
        console.warn(
          `Se detectaron ${clientesNuevos.length} clientes que no estaban en el catálogo. Se crearán automáticamente con configuración por defecto.`,
          clientesNuevos
        );
        toast.warning("Clientes nuevos detectados", {
          description: `${clientesNuevos.length} clientes se agregarán automáticamente: ${clientesNuevos.slice(0, 5).join(", ")}${clientesNuevos.length > 5 ? "..." : ""}`,
        });
      }

      setStats({ total: valid.length, nuevas, existentes, pagadas, clientesNuevos });
      setStep("preview");
      setProgress(100);
    } catch (err) {
      setErrorMsg(`Error leyendo archivo: ${err instanceof Error ? err.message : String(err)}`);
      setStep("error");
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!stats) return;
    setStep("processing");
    setProgress(0);
    setProgressDetail({ actual: 0, total: parsedRows.length, porcentaje: 0 });

    const res: ProcessResult = { nuevas: 0, actualizadas: 0, pagadas: 0, clientesNuevos: 0, errores: [] };

    try {
      // 1. Create new clients
      if (stats.clientesNuevos.length > 0) {
        setProgressMsg("Creando clientes nuevos...");
        setProgress(5);
        const clientesData = stats.clientesNuevos.map(codigo => {
          const fila = parsedRows.find(r => r.cliente_codigo === codigo);
          return {
            codigo,
            nombre: fila?.cliente_nombre || codigo,
            dias_credito: 45,
            limite_credito: 0,
            estado: "activo" as const,
          };
        });
        const { error } = await supabase.from("clients").insert(clientesData);
        if (error) throw error;
        res.clientesNuevos = stats.clientesNuevos.length;
      }

      // 2. Mark absent invoices as paid
      setProgressMsg("Marcando facturas pagadas...");
      setProgress(15);
      const refsArchivo = new Set(parsedRows.map(r => r.reference));
      const { data: facturasActuales } = await supabase
        .from("invoices")
        .select("reference")
        .eq("active", true);
      const refsPagadas = (facturasActuales || [])
        .map(f => f.reference)
        .filter(r => !refsArchivo.has(r));

      if (refsPagadas.length > 0) {
        // Process in chunks of 500 for the IN clause
        for (let i = 0; i < refsPagadas.length; i += 500) {
          const chunk = refsPagadas.slice(i, i + 500);
          const { error } = await supabase
            .from("invoices")
            .update({ active: false, status: "pagada" as const, paid_date: new Date().toISOString().split("T")[0] })
            .in("reference", chunk);
          if (error) throw error;
        }
        res.pagadas = refsPagadas.length;
      }

      const BATCH_SIZE = 1000;

      // Track which are new vs existing
      const refsActualesSet = new Set(facturasActuales?.map(f => f.reference) || []);

      for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        const batch = parsedRows.slice(i, i + BATCH_SIZE);
        const procesadas = i + batch.length;
        const porcentaje = Math.round((procesadas / parsedRows.length) * 100);

        setProgressMsg(`Procesando ${procesadas} de ${parsedRows.length} facturas...`);
        setProgressDetail({ actual: procesadas, total: parsedRows.length, porcentaje });
        setProgress(20 + Math.round((procesadas / parsedRows.length) * 60));

        const invoicesData = batch.map(row => ({
          cliente_codigo: row.cliente_codigo,
          cuenta: row.cuenta,
          reference: row.reference,
          fecha_emision: row.fecha_emision,
          pedimento: row.pedimento,
          honorarios: row.honorarios,
          total_factura: row.total_factura,
          anticipos: row.anticipos,
          saldo: row.saldo,
          cobranza: row.cobranza,
          por_cobrar: row.por_cobrar,
          active: true,
          status: "vigente" as const,
        }));

        const { error } = await supabase
          .from("invoices")
          .upsert(invoicesData, { onConflict: "reference", ignoreDuplicates: false });

        if (error) throw error;

        batch.forEach(r => {
          if (refsActualesSet.has(r.reference)) res.actualizadas++;
          else res.nuevas++;
        });
      }

      // 3.5 Reconcile manual payments
      setProgressMsg("Reconciliando pagos manuales...");
      setProgress(82);
      try {
        const { data: pagosM } = await supabase
          .from("payment_log")
          .select("referencia, saldo_restante, tipo")
          .eq("modified_by_upload", false);

        if (pagosM?.length) {
          const pagosPorRef: Record<string, { saldo_restante: number }> = {};
          pagosM.forEach((p) => (pagosPorRef[p.referencia] = p));

          const alertas: { tipo: string; mensaje: string; referencia: string }[] = [];

          for (const row of parsedRows) {
            if (pagosPorRef[row.reference]) {
              const esperado = pagosPorRef[row.reference].saldo_restante;
              if (Math.abs(row.por_cobrar - esperado) > 1) {
                await supabase.from("invoices").update({ por_cobrar: row.por_cobrar }).eq("reference", row.reference);
                await supabase.from("payment_log").update({ modified_by_upload: true }).eq("referencia", row.reference);
                alertas.push({
                  tipo: "pago_restaurado",
                  mensaje: `Factura ${row.reference} fue modificada manualmente pero el archivo la restauró`,
                  referencia: row.reference,
                });
              }
            }
          }

          if (alertas.length > 0) {
            await supabase.from("alerts").insert(alertas);
            res.errores.push(`${alertas.length} pago(s) manual(es) fueron sobreescritos por el archivo`);
          }
        }
      } catch (reconcileErr) {
        console.warn("Reconciliation warning:", reconcileErr);
      }

      // 4. Programar actualización de vencimientos en background (post-carga)
      setProgressMsg("Finalizando carga...");
      setProgress(85);

      // 5. Log upload
      setProgressMsg("Registrando carga...");
      setProgress(95);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("upload_log").insert({
          user_id: user.id,
          archivo_nombre: fileName,
          facturas_nuevas: res.nuevas,
          facturas_actualizadas: res.actualizadas,
          facturas_pagadas: res.pagadas,
          clientes_nuevos: res.clientesNuevos,
          status: res.errores.length > 0 ? "warning" : "success",
          error_message: res.errores.length > 0 ? res.errores.join("; ") : null,
        });

        // 6. Generate alerts
        // 6a. Carga exitosa alert
        await supabase.from("alerts").insert({
          tipo: "carga_exitosa",
          mensaje: `Carga completada: ${res.nuevas} nuevas, ${res.actualizadas} actualizadas, ${res.pagadas} pagadas`,
          user_id: user.id,
        });

        // 6b. Detect credit limit exceeded
        const { data: clientesConLimite } = await supabase
          .from("clients")
          .select("codigo, nombre, limite_credito")
          .gt("limite_credito", 0);

        if (clientesConLimite) {
          for (const cliente of clientesConLimite) {
            const { data: facs } = await supabase
              .from("invoices")
              .select("por_cobrar")
              .eq("cliente_codigo", cliente.codigo)
              .eq("active", true);
            const total = facs?.reduce((sum, f) => sum + (f.por_cobrar ?? 0), 0) ?? 0;
            if (total > cliente.limite_credito) {
              await supabase.from("alerts").insert({
                tipo: "limite_excedido",
                mensaje: `${cliente.nombre} excedió su límite: $${total.toFixed(2)} de $${cliente.limite_credito.toFixed(2)}`,
                cliente_codigo: cliente.codigo,
              });
            }
          }
        }
      }

      setResult(res);
      setProgress(100);
      setStep("done");
    } catch (err) {
      setErrorMsg(`Error en la carga: ${err instanceof Error ? err.message : String(err)}`);
      setStep("error");
    }
  }, [parsedRows, stats, fileName]);

  const reset = () => {
    setStep("idle");
    setFileName("");
    setParsedRows([]);
    setStats(null);
    setProgress(0);
    setProgressMsg("");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Cargar Cartera</h1>

      {/* Step: Idle */}
      {step === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Carga de Cartera Semanal
            </CardTitle>
            <CardDescription>
              Sube el archivo Excel con la cartera actualizada. El sistema sincronizará automáticamente las facturas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Arrastra o haz clic para seleccionar archivo Excel (.xlsx, .xls)</p>
              <Button variant="outline">Seleccionar Archivo</Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Step: Processing */}
      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{progressMsg}</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-xs text-muted-foreground font-mono">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && stats && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen de Carga</CardTitle>
              <CardDescription>Archivo: {fileName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Facturas totales</p>
                </div>
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-primary">{stats.nuevas}</p>
                  <p className="text-xs text-muted-foreground">Nuevas</p>
                </div>
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono" style={{ color: "hsl(217 91% 60%)" }}>{stats.existentes}</p>
                  <p className="text-xs text-muted-foreground">Actualizar</p>
                </div>
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-destructive">{stats.pagadas}</p>
                  <p className="text-xs text-muted-foreground">Marcar pagadas</p>
                </div>
              </div>
              {stats.clientesNuevos.length > 0 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Clientes nuevos detectados</AlertTitle>
                  <AlertDescription>
                    Se crearán {stats.clientesNuevos.length} cliente(s): {stats.clientesNuevos.join(", ")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vista Previa (primeros 10)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Por Cobrar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium">{r.cliente_nombre || r.cliente_codigo}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.cliente_codigo}</p>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                      <TableCell className="text-sm">{r.fecha_emision || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.total_factura)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.por_cobrar)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 10 && (
                <p className="p-4 text-sm text-muted-foreground text-center border-t border-border">
                  ...y {parsedRows.length - 10} filas más
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>Cancelar</Button>
            <Button onClick={handleConfirm}>
              <Upload className="h-4 w-4 mr-2" />
              Confirmar Carga
            </Button>
          </div>
        </>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h3 className="text-xl font-semibold">Carga Completada</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-lg">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-primary">{result.nuevas}</p>
                <p className="text-xs text-muted-foreground">Nuevas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono" style={{ color: "hsl(217 91% 60%)" }}>{result.actualizadas}</p>
                <p className="text-xs text-muted-foreground">Actualizadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-destructive">{result.pagadas}</p>
                <p className="text-xs text-muted-foreground">Pagadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono">{result.clientesNuevos}</p>
                <p className="text-xs text-muted-foreground">Clientes nuevos</p>
              </div>
            </div>
            {result.errores.length > 0 && (
              <Alert variant="destructive" className="max-w-lg">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {result.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={reset} variant="outline">Nueva Carga</Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
          <Button onClick={reset} variant="outline" size="sm" className="mt-3">
            Intentar de nuevo
          </Button>
        </Alert>
      )}
    </div>
  );
}
