import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Shield, UserX, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ userId: string; name: string; action: "approved" | "rejected" } | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data ?? [];
    },
  });

  const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);
  const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) ?? []);

  const pending = profiles?.filter((p) => p.status === "pending") ?? [];
  const approved = profiles?.filter((p) => p.status === "approved") ?? [];
  const rejected = profiles?.filter((p) => p.status === "rejected") ?? [];

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("profiles").update({
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users-count"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-count"] });
      setConfirmAction(null);
      toast({ title: status === "approved" ? "✓ Usuario aprobado" : "Usuario rechazado" });
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const handleConfirm = () => {
    if (confirmAction) updateStatus.mutate({ userId: confirmAction.userId, status: confirmAction.action });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>

      <Tabs defaultValue="pending">
        <TabsList className="bg-secondary">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" /> Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" /> Aprobados ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" /> Rechazados ({rejected.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending */}
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.created_at).toLocaleDateString("es-MX")}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => setConfirmAction({ userId: p.id, name: p.name, action: "approved" })}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ userId: p.id, name: p.name, action: "rejected" })}>
                          <XCircle className="h-4 w-4 mr-1" /> Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pending.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay usuarios pendientes</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved */}
        <TabsContent value="approved">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha Aprobación</TableHead>
                    <TableHead>Aprobado Por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{roleMap.get(p.id) ?? "normal"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.approved_at ? new Date(p.approved_at).toLocaleDateString("es-MX") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.approved_by ? profileMap.get(p.approved_by) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setConfirmAction({ userId: p.id, name: p.name, action: "rejected" })}
                        >
                          <UserX className="h-4 w-4 mr-1" /> Revocar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {approved.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios aprobados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rejected */}
        <TabsContent value="rejected">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejected.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.created_at).toLocaleDateString("es-MX")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ userId: p.id, name: p.name, action: "approved" })}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Aprobar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rejected.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay usuarios rechazados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "approved" ? "Aprobar Usuario" : "Rechazar / Revocar Usuario"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "approved"
                ? `¿Aprobar acceso a ${confirmAction.name}?`
                : `¿Rechazar acceso a ${confirmAction?.name}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              variant={confirmAction?.action === "approved" ? "default" : "destructive"}
              onClick={handleConfirm}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Procesando..." : confirmAction?.action === "approved" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
