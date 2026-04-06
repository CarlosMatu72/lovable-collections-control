import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  total_facturas: number;
  total_monto: number;
  clientes_unicos: number;
  clientesNuevos: string[];
}

interface ProcessResult {
  facturas_cargadas: number;
  total_por_cobrar: number;
  clientes_procesados: number;
  clientesNuevos: number;
  tiempo_procesamiento: number;
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
  const queryClient = useQueryClient();

  const parseNumber = (val: unknown): number => {
    if (val == null || val === "") return 0;
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const parseDate = (val: unknown): string | null => {
    if (!val) return null;
    if (typeof val === "number") {
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
    clientesInfo.forEach((c) => { clientMap[c.codigo] = c; });

    const calcVencimiento = (fechaEmision: string, diasCredito: number, tipoDias: string): Date => {
      if (tipoDias === "naturales") {
        const d = new Date(fechaEmision);
        d.setDate(d.getDate() + diasCredito);
        return d;
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

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const updates: { id: string; status: "vigente" | "vencida" }[] = [];

    for (const f of facturas) {
      if (!f.fecha_emision) continue;
      const client = clientMap[f.cliente_codigo];
      if (!client) continue;

      const fechaVenc = calcVencimiento(f.fecha_emision, client.dias_credito, client.tipo_dias);
      const nuevoStatus: "vigente" | "vencida" = fechaVenc < hoy ? "vencida" : "vigente";

      if (f.status !== nuevoStatus) {
        updates.push({ id: f.id, status: nuevoStatus });
      }
    }

    if (updates.length === 0) return;

    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      for (const u of batch) {
        await supabase.from("invoices").update({ status: u.status }).eq("id", u.id);
      }
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const headers = Object.keys(rows[0] || {});
      const missing = REQUIRED_COLUMNS.filter(c => !headers.some(h => h.trim() === c));
      if (missing.length > 0) {
        setErrorMsg(`Columnas faltantes: ${missing.join(", ")}`);
        setStep("error");
        return;
      }

      setProgress(30);
      setProgressMsg("Procesando filas...");

      const valid: ParsedRow[] = rows
        .filter(r => r["Cliente"] && r["Cuenta"] && r["Referencia"])
        .map(r => {
          const clienteStr = String(r["Cliente"] || "");
          const cuentaNorm = String(Math.floor(parseFloat(String(r["Cuenta"] || "0"))));
          const matchCodigo = clienteStr.match(/^([A-Z0-9]+)\s+(.*)/i);
          const cliente_codigo = matchCodigo ? matchCodigo[1].substring(0, 20).toUpperCase() : clienteStr.substring(0, 20).trim().toUpperCase();
          const cliente_nombre = matchCodigo ? matchCodigo[2].trim() : "";
          return {
            cliente_codigo,
            cliente_nombre,
            cuenta: cuentaNorm,
            reference: String(r["Referencia"] || "").trim().toUpperCase(),
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

      // Deduplicar por reference
      const uniqueMap = new Map<string, ParsedRow>();
      valid.forEach(row => uniqueMap.set(row.reference, row));
      const deduplicated = Array.from(uniqueMap.values());
      if (deduplicated.length < valid.length) {
        const dupes = valid.length - deduplicated.length;
        toast.warning(`Se encontraron ${dupes} facturas duplicadas y se usó la última versión`);
      }

      if (deduplicated.length === 0) {
        setErrorMsg("No se encontraron filas válidas en el archivo");
        setStep("error");
        return;
      }

      setParsedRows(deduplicated);
      setProgress(50);
      setProgressMsg("Analizando archivo...");

      const totalMonto = deduplicated.reduce((sum, row) => sum + row.por_cobrar, 0);
      const clientesUnicos = [...new Set(deduplicated.map(row => row.cliente_codigo))];

      // Detectar clientes nuevos
      const { data: clientesExistentes } = await supabase
        .from("clients")
        .select("codigo")
        .in("codigo", clientesUnicos);

      const codigosEnBD = new Set(clientesExistentes?.map(c => c.codigo) || []);
      const clientesNuevos = clientesUnicos.filter(c => !codigosEnBD.has(c));

      if (clientesNuevos.length > 0) {
        toast.warning("Clientes nuevos detectados", {
          description: `Se crearán ${clientesNuevos.length} clientes: ${clientesNuevos.slice(0, 3).join(", ")}${clientesNuevos.length > 3 ? "..." : ""}`,
        });
      }

      setStats({
        total_facturas: deduplicated.length,
        total_monto: totalMonto,
        clientes_unicos: clientesUnicos.length,
        clientesNuevos,
      });
      setStep("preview");
      setProgress(100);
    } catch (err) {
      setErrorMsg(`Error leyendo archivo: ${err instanceof Error ? err.message : String(err)}`);
      setStep("error");
    }

    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!stats) return;

    const tiempoInicio = Date.now();
    setStep("processing");
    setProgress(0);
    setProgressDetail({ actual: 0, total: parsedRows.length, porcentaje: 0 });

    const res: ProcessResult = {
      facturas_cargadas: 0,
      total_por_cobrar: 0,
      clientes_procesados: 0,
      clientesNuevos: 0,
      tiempo_procesamiento: 0,
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      console.log('🚀 INICIANDO CARGA DE CARTERA');

      // PASO 1: Crear clientes nuevos
      if (stats.clientesNuevos.length > 0) {
        setProgressMsg(`Creando ${stats.clientesNuevos.length} clientes nuevos...`);
        setProgress(5);

        const clientesData = stats.clientesNuevos.map(codigo => {
          const fila = parsedRows.find(r => r.cliente_codigo === codigo);
          return {
            codigo,
            nombre: fila?.cliente_nombre || codigo,
            dias_credito: 45,
            tipo_dias: "naturales" as const,
            limite_credito: 0,
            estado: "activo" as const,
          };
        });

        const { error } = await supabase.from("clients").insert(clientesData);
        if (error) throw error;
        res.clientesNuevos = stats.clientesNuevos.length;
      }

      // PASO 2: BORRAR todas las facturas anteriores
      setProgressMsg("Limpiando facturas anteriores...");
      setProgress(10);

      const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) throw deleteError;

      // PASO 3: INSERTAR todas las facturas del archivo
      setProgressMsg("Cargando facturas del archivo...");
      setProgress(20);

      const BATCH_SIZE = 500;

      for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        const batch = parsedRows.slice(i, i + BATCH_SIZE);
        const procesadas = i + batch.length;
        const porcentaje = Math.round((procesadas / parsedRows.length) * 100);

        setProgressMsg(`Cargando ${procesadas} de ${parsedRows.length} facturas...`);
        setProgressDetail({ actual: procesadas, total: parsedRows.length, porcentaje });
        setProgress(20 + Math.round((procesadas / parsedRows.length) * 70));

        const invoicesData = batch.map(row => ({
          cliente_codigo: row.cliente_codigo,
          cuenta: String(Math.floor(parseFloat(row.cuenta))),
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

        const { error } = await supabase.from("invoices").insert(invoicesData);
        if (error) {
          throw new Error(`Error insertando facturas: ${error.message}`);
        }

        res.facturas_cargadas += batch.length;
        res.total_por_cobrar += batch.reduce((sum, row) => sum + row.por_cobrar, 0);
      }

      res.clientes_procesados = stats.clientes_unicos;

      // PASO 4: Registrar la carga
      setProgressMsg("Registrando carga...");
      setProgress(95);

      const tiempoTotal = Math.round((Date.now() - tiempoInicio) / 1000);

      await supabase.from("upload_log").insert({
        user_id: user.id,
        archivo_nombre: fileName,
        facturas_nuevas: res.facturas_cargadas,
        facturas_actualizadas: null,
        facturas_pagadas: null,
        clientes_nuevos: res.clientesNuevos,
        status: "success",
        error_message: null,
      });

      await supabase.from("alerts").insert({
        tipo: "carga_exitosa",
        mensaje: `Cartera actualizada: ${res.facturas_cargadas} facturas cargadas (${fmt(res.total_por_cobrar)})`,
        referencia: fileName,
      });

      // ============================================================
      // PASO 5: Actualizar status de vencimientos
      // ============================================================
      setProgressMsg("Calculando vencimientos...");
      setProgress(96);

      try {
        await actualizarStatusVencimientos();
        console.log('✅ Vencimientos actualizados correctamente');
      } catch (vencErr) {
        console.warn("⚠️ Error actualizando vencimientos:", vencErr);
      }

      const tiempoFinal = Math.round((Date.now() - tiempoInicio) / 1000);
      res.tiempo_procesamiento = tiempoFinal;

      console.log('✅ CARGA COMPLETADA en', tiempoFinal, 'segundos');

      setProgress(100);
      setResult(res);
      setStep("done");

      toast.success("Cartera actualizada", {
        description: `${res.facturas_cargadas} facturas cargadas en ${tiempoFinal}s`,
      });

      // Refrescar dashboard
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      queryClient.invalidateQueries({ queryKey: ["clients-full"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-active"] });
      queryClient.invalidateQueries({ queryKey: ["admin-last-upload"] });
      queryClient.invalidateQueries({ queryKey: ["upload-logs"] });

    } catch (err: any) {
      console.error("❌ ERROR EN CARGA:", err);
      setErrorMsg(err.message || String(err));
      setStep("error");
      toast.error("Error al cargar cartera", {
        description: err.message || "Error desconocido",
      });
    }
  }, [stats, parsedRows, fileName, queryClient, actualizarStatusVencimientos]);

  const reset = () => {
    setStep("idle");
    setFileName("");
    setParsedRows([]);
    setStats(null);
    setProgress(0);
    setProgressMsg("");
    setProgressDetail({ actual: 0, total: 0, porcentaje: 0 });
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
              Sube el archivo Excel con la cartera actualizada. El sistema reemplazará todas las facturas con el contenido del archivo.
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
            <Progress value={progressDetail.total > 0 ? progressDetail.porcentaje : progress} className="w-full max-w-md" />
            {progressDetail.total > 0 ? (
              <p className="text-sm text-muted-foreground">
                Procesando {progressDetail.actual} de {progressDetail.total} facturas...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">{progress}%</p>
            )}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-primary">
                    {stats.total_facturas}
                  </p>
                  <p className="text-xs text-muted-foreground">Facturas a cargar</p>
                </div>
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-xl font-bold font-mono">
                    {fmt(stats.total_monto)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total por cobrar</p>
                </div>
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-2xl font-bold font-mono">
                    {stats.clientes_unicos}
                  </p>
                  <p className="text-xs text-muted-foreground">Clientes únicos</p>
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
            <h3 className="text-xl font-semibold">Cartera Actualizada</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-primary">
                  {result.facturas_cargadas}
                </p>
                <p className="text-xs text-muted-foreground">Facturas cargadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono">
                  {fmt(result.total_por_cobrar)}
                </p>
                <p className="text-xs text-muted-foreground">Total por cobrar</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono">
                  {result.clientes_procesados}
                </p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono">
                  {result.tiempo_procesamiento}s
                </p>
                <p className="text-xs text-muted-foreground">Tiempo</p>
              </div>
            </div>

            {result.clientesNuevos > 0 && (
              <Alert className="max-w-lg">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Clientes nuevos</AlertTitle>
                <AlertDescription>
                  Se crearon {result.clientesNuevos} cliente(s) nuevo(s)
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={reset} variant="outline">
              Nueva Carga
            </Button>
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
