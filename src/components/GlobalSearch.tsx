import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Users, FileText } from "lucide-react";

interface ClientResult {
  codigo: string;
  nombre: string;
}

interface InvoiceResult {
  reference: string;
  cliente_codigo: string;
  por_cobrar: number | null;
  status: string;
  
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [invoices, setInvoices] = useState<InvoiceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setClients([]);
      setInvoices([]);
      return;
    }
    setLoading(true);
    const [cRes, iRes] = await Promise.all([
      supabase
        .from("clients")
        .select("codigo, nombre")
        .or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%`)
        .limit(8),
      supabase
        .from("invoices")
        .select("reference, cliente_codigo, por_cobrar, status")
        .or(`reference.ilike.%${q}%,pedimento.ilike.%${q}%`)
        .eq("active", true)
        .limit(8),
    ]);
    setClients(cRes.data ?? []);
    setInvoices(iRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (type: "client" | "invoice", code: string) => {
    setOpen(false);
    setQuery("");
    if (type === "client") navigate(`/clientes/${code}`);
    else navigate(`/clientes/${code}`);
  };

  const statusLabel: Record<string, string> = {
    vigente: "Vigente",
    vencida: "Vencida",
    abono_parcial: "Abono Parcial",
    pagada: "Pagada",
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar clientes, facturas, referencias..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Buscando..." : query.length < 2 ? "Escribe al menos 2 caracteres..." : "Sin resultados"}
        </CommandEmpty>
        {clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.map((c) => (
              <CommandItem
                key={c.codigo}
                onSelect={() => handleSelect("client", c.codigo)}
                className="cursor-pointer"
              >
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs mr-2">{c.codigo}</span>
                <span>{c.nombre}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {invoices.length > 0 && (
          <CommandGroup heading="Facturas">
            {invoices.map((inv) => (
              <CommandItem
                key={inv.reference}
                onSelect={() => handleSelect("invoice", inv.cliente_codigo)}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs">{inv.reference}</span>
                    <span className="text-xs text-muted-foreground ml-2">{inv.cliente_codigo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{fmt(inv.por_cobrar ?? 0)}</span>
                    <span className={`text-xs ${inv.status === "vencida" ? "text-destructive" : "text-primary"}`}>
                      {statusLabel[inv.status] || inv.status}
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
