import { Bell, Search, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { profile, role, signOut } = useAuth();

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-users-count"],
    queryFn: async () => {
      if (role !== "admin") return 0;
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: role === "admin",
    refetchInterval: 30000,
  });

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, factura..."
            className="w-72 pl-9 bg-secondary border-border"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {role === "admin" && pendingCount !== undefined && pendingCount > 0 && (
          <div className="relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive">
              {pendingCount}
            </Badge>
          </div>
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
