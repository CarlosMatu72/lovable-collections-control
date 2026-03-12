import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function UploadPortfolio() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Cargar Cartera</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Carga de Cartera Semanal
          </CardTitle>
          <CardDescription>
            Sube el archivo Excel con la cartera actualizada. El sistema sincronizará automáticamente las facturas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-10 text-center">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Funcionalidad de carga de cartera disponible próximamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
