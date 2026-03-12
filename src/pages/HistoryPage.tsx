import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial de Cargas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">El historial de cargas se mostrará aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
