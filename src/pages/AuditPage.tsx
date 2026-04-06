import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";

export default function AuditPage() {
  const { data: logs } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
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

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!logs) return [];
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.accion?.toLowerCase().includes(q) ||
        l.tabla?.toLowerCase().includes(q) ||
        l.registro_id?.toLowerCase().includes(q) ||
        (l.user_id && (profileMap[l.user_id] || "").toLowerCase().includes(q))
    );
  }, [logs, search, profileMap]);

  const handleExport = useCallback(() => {
    if (!logs?.length) return;
    const data = logs.map((l) => ({
      Fecha: new Date(l.created_at).toLocaleString("es-MX"),
      Usuario: l.user_id ? profileMap[l.user_id] || l.user_id : "Sistema",
      Acción: l.accion,
      Tabla: l.tabla,
      Registro: l.registro_id || "",
      Cambios: l.valores_nuevos ? JSON.stringify(l.valores_nuevos) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, `auditoria_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [logs, profileMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!logs?.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por acción, tabla, usuario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Cambios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(l.created_at).toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-sm">{l.user_id ? profileMap[l.user_id] || "—" : "Sistema"}</TableCell>
                  <TableCell className="text-sm">{l.accion}</TableCell>
                  <TableCell className="font-mono text-sm">{l.tabla}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{l.registro_id || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                    {l.valores_nuevos ? JSON.stringify(l.valores_nuevos) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin registros de auditoría</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
