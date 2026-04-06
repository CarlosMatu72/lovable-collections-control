import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientRow {
  codigo: string;
  nombre: string;
  dias_credito: number;
  limite_credito: number;
  estado: "activo" | "inactivo";
  error?: string;
}

export default function UploadClients() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ new: number; update: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const validateRow = (row: any, idx: number): ClientRow | null => {
    const errs: string[] = [];
    const codigo = String(row["Código"] || row["codigo"] || row["CODIGO"] || "").trim();
    const nombre = String(row["Nombre"] || row["nombre"] || row["NOMBRE"] || "").trim();
    const dias = Number(row["Días de crédito"] || row["dias_credito"] || row["DIAS DE CREDITO"] || 45);
    const limite = Number(row["Límite de crédito"] || row["limite_credito"] || row["LIMITE DE CREDITO"] || 0);
    const estadoRaw = String(row["Estado"] || row["estado"] || row["ESTADO"] || "activo").toLowerCase().trim();

    if (!codigo || !/^[a-zA-Z0-9]{1,6}$/.test(codigo)) errs.push(`Fila ${idx + 1}: Código inválido "${codigo}" (máximo 6 caracteres alfanuméricos)`);
    if (!nombre || nombre.length > 200) errs.push(`Fila ${idx + 1}: Nombre inválido`);
    if (isNaN(dias) || dias < 0) errs.push(`Fila ${idx + 1}: Días de crédito inválido`);
    if (isNaN(limite) || limite < 0) errs.push(`Fila ${idx + 1}: Límite de crédito inválido`);
    if (!["activo", "inactivo"].includes(estadoRaw)) errs.push(`Fila ${idx + 1}: Estado inválido "${estadoRaw}"`);

    if (errs.length > 0) {
      setErrors((prev) => [...prev, ...errs]);
      return null;
    }

    return {
      codigo: codigo.toUpperCase(),
      nombre,
      dias_credito: dias,
      limite_credito: limite,
      estado: estadoRaw as "activo" | "inactivo",
    };
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrors([]);
    setDone(false);
    setResultMsg("");
    setSummary(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);

      const parsed: ClientRow[] = [];
      const newErrors: string[] = [];
      setErrors([]);

      json.forEach((row: any, idx: number) => {
        const validated = validateRow(row, idx);
        if (validated) parsed.push(validated);
      });

      setRows(parsed);

      // Check existing codes
      const codes = parsed.map((r) => r.codigo);
      const { data: existing } = await supabase
        .from("clients")
        .select("codigo")
        .in("codigo", codes);

      const existingCodes = new Set(existing?.map((e) => e.codigo) ?? []);
      const newCount = parsed.filter((r) => !existingCodes.has(r.codigo)).length;
      const updateCount = parsed.filter((r) => existingCodes.has(r.codigo)).length;

      setSummary({ new: newCount, update: updateCount });
    };
    reader.readAsBinaryString(f);
  }, []);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setProgress(0);

    const batchSize = 100;
    let imported = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("clients").upsert(
        batch.map((r) => ({
          codigo: r.codigo,
          nombre: r.nombre,
          dias_credito: r.dias_credito,
          limite_credito: r.limite_credito,
          estado: r.estado,
        })),
        { onConflict: "codigo" }
      );

      if (error) {
        errorCount += batch.length;
        toast.error(`Error en batch ${Math.floor(i / batchSize) + 1}`, { description: error.message });
      } else {
        imported += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / rows.length) * 100));
    }

    setImporting(false);
    setDone(true);
    setResultMsg(`✓ Importados ${imported} clientes exitosamente${errorCount > 0 ? `. ${errorCount} con errores.` : ""}`);
    toast.success("Importación completada", { description: `${imported} clientes procesados` });
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setErrors([]);
    setSummary(null);
    setDone(false);
    setResultMsg("");
    setProgress(0);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Cargar Clientes</h1>

      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar desde Excel
          </CardTitle>
          <CardDescription>
            El archivo debe contener las columnas: Código, Nombre, Días de crédito, Límite de crédito, Estado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!file ? (
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Selecciona un archivo .xlsx o .xls
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  Cambiar archivo
                </Button>
              </div>

              {errors.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Errores de validación
                    </p>
                    {errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{err}</p>
                    ))}
                    {errors.length > 10 && (
                      <p className="text-xs text-muted-foreground">...y {errors.length - 10} errores más</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {summary && (
                <div className="flex gap-4">
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {summary.new} nuevos
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {summary.update} a actualizar
                  </Badge>
                </div>
              )}

              {/* Preview Table */}
              {rows.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Días Crédito</TableHead>
                        <TableHead className="text-right">Límite Crédito</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{r.codigo}</TableCell>
                          <TableCell>{r.nombre}</TableCell>
                          <TableCell className="text-right font-mono">{r.dias_credito}</TableCell>
                          <TableCell className="text-right font-mono">
                            {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(r.limite_credito)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.estado === "activo" ? "default" : "secondary"}>
                              {r.estado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 10 && (
                    <p className="text-xs text-muted-foreground p-3 border-t">
                      Mostrando 10 de {rows.length} registros
                    </p>
                  )}
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground text-center">{progress}%</p>
                </div>
              )}

              {done && (
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{resultMsg}</span>
                </div>
              )}

              {!done && rows.length > 0 && (
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? "Importando..." : `Confirmar Importación (${rows.length} registros)`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
