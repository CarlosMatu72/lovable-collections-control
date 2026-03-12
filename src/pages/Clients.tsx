import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, LayoutGrid, List, Download, Pencil } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type FilterType = "todos" | "vencidos" | "vigentes" | "a_favor";

interface ClientAgg {
  codigo: string;
  nombre: string;
  dias_credito: number;
  tipo_dias: string;
  limite_credito: number;
  estado: string;
  vigente: number;
  vencido: number;
  a_favor: number;
  neto: number;
  pct_vencido: number;
  fact_vencidas: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function Clients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Edit modal state
  const [editClient, setEditClient] = useState<ClientAgg | null>(null);
  const [editName, setEditName] = useState("");
  const [editDias, setEditDias] = useState(45);
  const [editTipoDias, setEditTipoDias] = useState("naturales");
  const [editLimite, setEditLimite] = useState(0);
  const [editEstado, setEditEstado] = useState("activo");

  const { data: clients } = useQuery({
    queryKey: ["clients-full"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("nombre");
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("cliente_codigo, por_cobrar, status")
        .eq("active", true);
      return data ?? [];
    },
  });

  const clientAggs = useMemo((): ClientAgg[] => {
    if (!clients) return [];
    const invMap: Record<string, { vigente: number; vencido: number; a_favor: number; neto: number; fact_vencidas: number }> = {};
    invoices?.forEach((inv) => {
      const c = inv.cliente_codigo;
      if (!invMap[c]) invMap[c] = { vigente: 0, vencido: 0, a_favor: 0, neto: 0, fact_vencidas: 0 };
      const pc = inv.por_cobrar ?? 0;
      invMap[c].neto += pc;
      if (pc < 0) invMap[c].a_favor += Math.abs(pc);
      else if (inv.status === "vencida") { invMap[c].vencido += pc; invMap[c].fact_vencidas++; }
      else if (inv.status === "vigente") invMap[c].vigente += pc;
    });

    return clients.map((cl) => {
      const inv = invMap[cl.codigo] || { vigente: 0, vencido: 0, a_favor: 0, neto: 0, fact_vencidas: 0 };
      return {
        codigo: cl.codigo,
        nombre: cl.nombre,
        dias_credito: cl.dias_credito,
        tipo_dias: cl.tipo_dias,
        limite_credito: cl.limite_credito,
        estado: cl.estado,
        ...inv,
        pct_vencido: inv.neto > 0 ? (inv.vencido / inv.neto) * 100 : 0,
      };
    });
  }, [clients, invoices]);

  const filtered = useMemo(() => {
    let list = clientAggs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
    }
    if (filter === "vencidos") list = list.filter((c) => c.vencido > 0);
    else if (filter === "vigentes") list = list.filter((c) => c.vigente > 0 && c.vencido === 0);
    else if (filter === "a_favor") list = list.filter((c) => c.a_favor > 0);
    return list;
  }, [clientAggs, search, filter]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const updateClient = useMutation({
    mutationFn: async () => {
      if (!editClient) return;
      const { error } = await supabase.from("clients").update({
        nombre: editName,
        dias_credito: editDias,
        tipo_dias: editTipoDias as "naturales" | "habiles",
        limite_credito: editLimite,
        estado: editEstado as "activo" | "inactivo",
      }).eq("codigo", editClient.codigo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-full"] });
      setEditClient(null);
      toast({ title: "✓ Cliente actualizado" });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const openEdit = useCallback((c: ClientAgg, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditClient(c);
    setEditName(c.nombre);
    setEditDias(c.dias_credito);
    setEditTipoDias(c.tipo_dias);
    setEditLimite(c.limite_credito);
    setEditEstado(c.estado);
  }, []);

  const handleExport = useCallback(() => {
    const data = filtered.map((c) => ({
      Código: c.codigo, Nombre: c.nombre, Vigente: c.vigente, Vencido: c.vencido,
      "A Favor": c.a_favor, Neto: c.neto, "% Vencido": +c.pct_vencido.toFixed(1), "Fact. Vencidas": c.fact_vencidas,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filtered]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "vencidos", label: "Solo Vencidos" },
    { key: "vigentes", label: "Solo Vigentes" },
    { key: "a_favor", label: "Saldo a Favor" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clientes</h1>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport} title="Exportar">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Badge
              key={f.key}
              variant={filter === f.key ? "default" : "secondary"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => { setFilter(f.key); setPage(0); }}
            >
              {f.label}
            </Badge>
          ))}
          <span className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} clientes</span>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map((c) => (
            <Card
              key={c.codigo}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/clientes/${c.codigo}`)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{c.codigo}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(c, e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="font-semibold text-sm truncate">{c.nombre}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Vigente</p>
                    <p className="font-mono text-sm text-primary">{fmt(c.vigente)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencido</p>
                    <p className="font-mono text-sm text-destructive">{fmt(c.vencido)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">A Favor: <span className="font-mono" style={{ color: "hsl(var(--info))" }}>{fmt(c.a_favor)}</span></p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">% Vencido</span>
                    <span className="font-mono">{c.pct_vencido.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(c.pct_vencido, 100)} className="h-2" />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Crédito: {c.dias_credito}d ({c.tipo_dias === "naturales" ? "nat." : "háb."})</span>
                  <span>Límite: {fmt(c.limite_credito)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Vigente</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                  <TableHead className="text-right">A Favor</TableHead>
                  <TableHead className="text-right">% Vencido</TableHead>
                  <TableHead className="text-right">Fact. Vencidas</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
                  <TableRow key={c.codigo} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/clientes/${c.codigo}`)}>
                    <TableCell className="font-mono">{c.codigo}</TableCell>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-right font-mono text-primary">{fmt(c.vigente)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{fmt(c.vencido)}</TableCell>
                    <TableCell className="text-right font-mono" style={{ color: "hsl(var(--info))" }}>{fmt(c.a_favor)}</TableCell>
                    <TableCell className="text-right font-mono">{c.pct_vencido.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{c.fact_vencidas}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(c, e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin resultados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input value={editClient?.codigo ?? ""} disabled className="bg-muted font-mono" />
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
                    <RadioGroupItem value="naturales" id="nat" />
                    <Label htmlFor="nat" className="font-normal">Naturales</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="habiles" id="hab" />
                    <Label htmlFor="hab" className="font-normal">Hábiles</Label>
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
                  <RadioGroupItem value="activo" id="act" />
                  <Label htmlFor="act" className="font-normal">Activo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inactivo" id="inact" />
                  <Label htmlFor="inact" className="font-normal">Inactivo</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancelar</Button>
            <Button onClick={() => updateClient.mutate()} disabled={updateClient.isPending}>
              {updateClient.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
