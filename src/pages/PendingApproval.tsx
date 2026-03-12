import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, XCircle } from "lucide-react";

export default function PendingApproval() {
  const { profile, signOut } = useAuth();
  const rejected = profile?.status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl" style={{
            backgroundColor: rejected ? "hsl(0 84% 60% / 0.1)" : "hsl(38 92% 50% / 0.1)"
          }}>
            {rejected ? (
              <XCircle className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7" style={{ color: "hsl(38 92% 50%)" }} />
            )}
          </div>
          <CardTitle className="text-xl">
            {rejected ? "Acceso Denegado" : "Esperando Aprobación"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {rejected
              ? "Tu solicitud de acceso ha sido rechazada. Contacta al administrador del sistema."
              : "Tu cuenta está pendiente de aprobación por un administrador. Recibirás acceso una vez que sea aprobada."}
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">
            Cerrar Sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
