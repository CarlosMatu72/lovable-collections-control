import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuración del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Las opciones de configuración estarán disponibles aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
