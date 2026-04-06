import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign } from "lucide-react";
import { useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function PaymentsReport() {
  const { data: payments } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_log").select("*").order("created_at", { ascending: false }).limit(500);
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

  const handleExport = useCallback(() => {
    if (!payments?.length) return;
    const data = payments.map((p) => ({
      Fecha: new Date(p.created_at).toLocaleString("es-MX"),
      Usuario: profileMap[p.user_id] || p.user_id,
      Cliente: p.cliente_codigo,
      Referencia: p.referencia,
      Tipo: p.tipo === "pago_total" ? "Pago Total" : "Abono",
      "Monto Original": p.monto_original,
      "Monto Aplicado": p.monto_aplicado,
      "Saldo Restante": p.saldo_restante,
      Notas: p.notas || "",
      "Modificado por Carga": p.modified_by_upload ? "Sí" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, `pagos_manuales_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [payments, profileMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagos Manuales</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!payments?.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Aplicado</TableHead>
                <TableHead className="text-right">Restante</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments?.map((p) => (
                <TableRow key={p.id} className={p.modified_by_upload ? "opacity-60" : ""}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(p.created_at).toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-sm">{profileMap[p.user_id] || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{p.cliente_codigo}</TableCell>
                  <TableCell className="font-mono text-sm">{p.referencia}</TableCell>
                  <TableCell>
                    <Badge variant={p.tipo === "pago_total" ? "default" : "secondary"}>
                      {p.tipo === "pago_total" ? "Total" : "Abono"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(p.monto_original))}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(p.monto_aplicado))}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(p.saldo_restante))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-32 truncate">{p.notas || "—"}</TableCell>
                </TableRow>
              ))}
              {(!payments || payments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground text-center py-3 border-t border-border">
            Mostrando los últimos 500 registros. Usa Exportar para ver el historial completo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
