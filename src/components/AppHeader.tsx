import { Bell, Search, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, DollarSign, Users, CheckCircle, Eye } from "lucide-react";

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

export function AppHeader() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: alertsCount } = useQuery({
    queryKey: ["alerts-count"],
    queryFn: async () => {
      if (role !== "admin") return 0;
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("visto", false);
      return count ?? 0;
    },
    enabled: role === "admin",
    refetchInterval: 30000,
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ["alerts-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").eq("visto", false).order("fecha_alerta", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: role === "admin",
    refetchInterval: 30000,
  });

  const markSeen = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("alerts").update({ visto: true, visto_por: user?.id, visto_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-count"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-recent"] });
    },
  });

  const markAllSeen = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("alerts").update({ visto: true, visto_por: user?.id, visto_at: new Date().toISOString() }).eq("visto", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-count"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-recent"] });
    },
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Hace menos de 1 hora";
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente, factura..." className="w-72 pl-9 bg-secondary border-border" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {role === "admin" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {(alertsCount ?? 0) > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive">
                    {alertsCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2 font-semibold text-sm">Notificaciones</div>
              <DropdownMenuSeparator />
              {recentAlerts && recentAlerts.length > 0 ? (
                <>
                  {recentAlerts.map((alert) => {
                    const Icon = alertIcons[alert.tipo] || Bell;
                    const color = alertColors[alert.tipo] || "text-muted-foreground";
                    return (
                      <DropdownMenuItem
                        key={alert.id}
                        className="flex items-start gap-3 py-3 cursor-pointer"
                        onClick={() => markSeen.mutate(alert.id)}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{alert.mensaje}</p>
                          <p className="text-xs text-muted-foreground mt-1">{timeAgo(alert.fecha_alerta)}</p>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-xs text-muted-foreground" onClick={() => markAllSeen.mutate()}>
                    Marcar todas como leídas
                  </DropdownMenuItem>
                  <DropdownMenuItem className="justify-center text-xs text-primary" onClick={() => navigate("/alertas")}>
                    Ver todas →
                  </DropdownMenuItem>
                </>
              ) : (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Sin notificaciones nuevas</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-medium">{profile?.name}</span>
          <span className="text-xs text-muted-foreground capitalize">{role}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
