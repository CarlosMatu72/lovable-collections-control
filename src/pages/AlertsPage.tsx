import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Bell, AlertTriangle, DollarSign, Users, CheckCircle, Eye, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "@/hooks/use-toast";

const alertIcons: Record<string, typeof AlertTriangle> = {
  limite_excedido: AlertTriangle,
  pago_restaurado: DollarSign,
  usuario_pendiente: Users,
  carga_exitosa: CheckCircle,
};

const alertColors: Record<string, string> = {
  limite_excedido: "text-destructive",
  pago_restaurado: "text-yellow-400",
  usuario_pendiente: "text-blue-400",
  carga_exitosa: "text-primary",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [tab, setTab] = useState("nuevas");

  const { data: alerts } = useQuery({
    queryKey: ["all-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("fecha_alerta", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let list = alerts ?? [];
    if (tab === "nuevas") list = list.filter((a) => !a.visto);
    else if (tab === "archivadas") list = list.filter((a) => a.visto);
    if (tipoFilter !== "todos") list = list.filter((a) => a.tipo === tipoFilter);
    return list;
  }, [alerts, tab, tipoFilter]);

  const markSeen = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("alerts").update({ visto: true, visto_por: user?.id, visto_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-alerts-count"] });
    },
  });

  const markAllSeen = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("alerts").update({ visto: true, visto_por: user?.id, visto_at: new Date().toISOString() }).eq("visto", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-alerts-count"] });
      toast({ title: "✓ Todas las alertas marcadas como leídas" });
    },
  });

  const nuevasCount = alerts?.filter((a) => !a.visto).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alertas</h1>
        {nuevasCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllSeen.mutate()}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList className="bg-secondary">
            <TabsTrigger value="nuevas">Nuevas ({nuevasCount})</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="archivadas">Archivadas</TabsTrigger>
          </TabsList>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-52 bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="limite_excedido">Límite Excedido</SelectItem>
              <SelectItem value="pago_restaurado">Pago Restaurado</SelectItem>
              <SelectItem value="usuario_pendiente">Usuario Pendiente</SelectItem>
              <SelectItem value="carga_exitosa">Carga Exitosa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const Icon = alertIcons[a.tipo] || Bell;
                    const color = alertColors[a.tipo] || "text-muted-foreground";
                    const meta = a.metadata as Record<string, any> | null;
                    return (
                      <TableRow key={a.id} className={!a.visto ? "bg-accent/30" : ""}>
                        <TableCell><Icon className={`h-4 w-4 ${color}`} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {a.tipo.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-md">
                          <div className="truncate">{a.mensaje}</div>
                          {a.tipo === "pago_restaurado" && meta && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1">
                                <ChevronDown className="h-3 w-3" />
                                Ver detalles
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 p-3 bg-muted rounded-md text-xs space-y-1">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  <span className="font-medium">Tipo de pago:</span>
                                  <span>{meta.tipo_pago === "pago_total" ? "Pago Total" : "Abono Parcial"}</span>

                                  <span className="font-medium">Monto aplicado:</span>
                                  <span className="font-mono">{fmt(meta.monto_manual ?? 0)}</span>

                                  <span className="font-medium">Saldo después del pago:</span>
                                  <span className="font-mono">{fmt(meta.saldo_manual ?? 0)}</span>

                                  <span className="font-medium">Saldo en archivo:</span>
                                  <span className="font-mono">{fmt(meta.saldo_archivo ?? 0)}</span>

                                  <span className="font-medium">Diferencia:</span>
                                  <span className="font-mono text-destructive">{fmt(meta.diferencia ?? 0)}</span>

                                  <span className="font-medium">Fecha del pago:</span>
                                  <span>{meta.fecha_pago ? new Date(meta.fecha_pago).toLocaleDateString("es-MX") : "—"}</span>

                                  {meta.notas_originales && (
                                    <>
                                      <span className="font-medium">Notas originales:</span>
                                      <span className="italic">{meta.notas_originales}</span>
                                    </>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(a.fecha_alerta).toLocaleString("es-MX")}
                        </TableCell>
                        <TableCell>
                          {a.visto ? (
                            <Badge variant="secondary" className="text-xs">Leída</Badge>
                          ) : (
                            <Badge className="text-xs">Nueva</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!a.visto && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markSeen.mutate(a.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin alertas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
