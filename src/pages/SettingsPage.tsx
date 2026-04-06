import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, User, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("El nombre no puede estar vacío");
      if (name.length > 100) throw new Error("El nombre es demasiado largo");
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "✓ Perfil actualizado" }),
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error("Ingresa tu contraseña actual");
      if (newPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
      if (newPassword !== confirmPassword) throw new Error("Las contraseñas no coinciden");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile!.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("La contraseña actual es incorrecta");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Contraseña actualizada" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Tabs defaultValue="profile">
        <TabsList className="bg-secondary">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="system">
            <Settings className="h-4 w-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información Personal</CardTitle>
              <CardDescription>Actualiza tu nombre y datos de perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={profile?.email ?? ""} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cambiar Contraseña</CardTitle>
              <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Contraseña actual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Tu contraseña actual"
                />
              </div>
              <div>
                <Label>Nueva contraseña</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirmar contraseña</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button onClick={() => updatePassword.mutate()} disabled={updatePassword.isPending}>
                {updatePassword.isPending ? "Actualizando..." : "Cambiar Contraseña"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuración del Sistema</CardTitle>
              <CardDescription>Parámetros generales del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Zona horaria</Label>
                <Input value="America/Mexico_City" disabled className="bg-muted" />
              </div>
              <div>
                <Label>Formato de moneda</Label>
                <Input value="MXN (Peso Mexicano)" disabled className="bg-muted" />
              </div>
              <div>
                <Label>Idioma</Label>
                <Input value="Español" disabled className="bg-muted" />
              </div>
              <p className="text-xs text-muted-foreground">
                La configuración avanzada del sistema estará disponible en futuras versiones.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
