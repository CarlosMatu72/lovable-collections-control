import { useMemo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";

interface MiniChartProps {
  data: { mes: string; facturacion: number; cobros: number }[];
  height?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export function MiniChart({ data, height = 80 }: MiniChartProps) {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        Sin datos
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Tooltip
          contentStyle={{ background: "hsl(224 24% 18%)", border: "1px solid hsl(220 13% 26%)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "hsl(215 20% 65%)" }}
          formatter={(value: number) => fmt(value)}
        />
        <Bar dataKey="facturacion" fill="hsl(217 91% 60%)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="cobros" fill="hsl(160 84% 39%)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DetailChartProps {
  data: { mes: string; facturacion: number; cobros: number }[];
}

export function DetailChart({ data }: DetailChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sin datos de facturación
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <Tooltip
          contentStyle={{ background: "hsl(224 24% 18%)", border: "1px solid hsl(220 13% 26%)", borderRadius: 8, fontSize: 12 }}
          formatter={(value: number, name: string) => [fmt(value), name === "facturacion" ? "Facturación" : "Cobros"]}
        />
        <Bar dataKey="facturacion" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} name="Facturación" />
        <Bar dataKey="cobros" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name="Cobros" />
      </BarChart>
    </ResponsiveContainer>
  );
}
