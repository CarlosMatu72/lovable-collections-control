import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { History, Download, Eye, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

export default function HistoryPage() {
  const [detailLog, setDetailLog] = useState<any>(null);

  const { data: logs } = useQuery({
    queryKey: ["upload-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("upload_log").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
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

  const exportLog = useCallback((log: any) => {
    const data = [{
      Fecha: new Date(log.created_at).toLocaleString("es-MX"),
      Usuario: profileMap[log.user_id] || log.user_id,
      Archivo: log.archivo_nombre,
      "Facturas Nuevas": log.facturas_nuevas,
      "Clientes Nuevos": log.clientes_nuevos,
      "Clientes Nuevos": log.clientes_nuevos,
      Estado: log.status,
      Errores: log.error_message || "",
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen");
    const fecha = new Date(log.created_at).toISOString().split("T")[0];
    XLSX.writeFile(wb, `resumen_carga_${fecha}.xlsx`);
  }, [profileMap]);

  const statusIcon = (status: string | null) => {
    if (status === "success") return <CheckCircle className="h-4 w-4 text-primary" />;
    if (status === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial de Cargas</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead className="text-right">Nuevas</TableHead>
                <TableHead className="text-right">Actual.</TableHead>
                <TableHead className="text-right">Pagadas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="text-sm">{profileMap[log.user_id] || "—"}</TableCell>
                  <TableCell className="text-sm max-w-32 truncate" title={log.archivo_nombre}>{log.archivo_nombre}</TableCell>
                  <TableCell className="text-right font-mono">{log.facturas_nuevas ?? 0}</TableCell>
                  <TableCell className="text-right font-mono">{log.facturas_actualizadas ?? 0}</TableCell>
                  <TableCell className="text-right font-mono">{log.facturas_pagadas ?? 0}</TableCell>
                  <TableCell>{statusIcon(log.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailLog(log)} title="Ver detalles">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportLog(log)} title="Descargar">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin cargas registradas</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de Carga</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{new Date(detailLog.created_at).toLocaleString("es-MX")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium">{profileMap[detailLog.user_id] || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Archivo</p>
                  <p className="font-medium">{detailLog.archivo_nombre}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-xl font-bold font-mono text-primary">{detailLog.facturas_nuevas ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Nuevas</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-xl font-bold font-mono" style={{ color: "hsl(var(--info))" }}>{detailLog.facturas_actualizadas ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Actualizadas</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-xl font-bold font-mono text-destructive">{detailLog.facturas_pagadas ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Pagadas</p>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-xl font-bold font-mono">{detailLog.clientes_nuevos ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Clientes Nuevos</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Badge variant={detailLog.status === "success" ? "default" : detailLog.status === "warning" ? "secondary" : "destructive"}>
                  {detailLog.status === "success" ? "Exitosa ✓" : detailLog.status === "warning" ? "Con advertencias" : "Error"}
                </Badge>
              </div>

              {detailLog.error_message && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">{detailLog.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
