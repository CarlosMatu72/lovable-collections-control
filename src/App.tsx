import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PendingApproval from "@/pages/PendingApproval";
import Index from "@/pages/Index";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import UploadClients from "@/pages/UploadClients";
import UploadPortfolio from "@/pages/UploadPortfolio";
import AdminUsers from "@/pages/AdminUsers";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";
import AlertsPage from "@/pages/AlertsPage";
import PaymentsReport from "@/pages/PaymentsReport";
import AuditPage from "@/pages/AuditPage";
import NotFound from "@/pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { session, profile, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (role === "admin") return <>{children}</>;

  if (profile?.status === "pending" || profile?.status === "rejected") {
    return <PendingApproval />;
  }

  if (adminOnly) return <Navigate to="/" replace />;

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/registro" element={<Register />} />
    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<Index />} />
      <Route path="/clientes" element={<Clients />} />
      <Route path="/clientes/:codigo" element={<ClientDetail />} />
      <Route path="/cargar-clientes" element={<UploadClients />} />
      <Route path="/cargar-cartera" element={<UploadPortfolio />} />
      <Route path="/usuarios" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/historial" element={<ProtectedRoute adminOnly><HistoryPage /></ProtectedRoute>} />
      <Route path="/alertas" element={<ProtectedRoute adminOnly><AlertsPage /></ProtectedRoute>} />
      <Route path="/pagos" element={<ProtectedRoute adminOnly><PaymentsReport /></ProtectedRoute>} />
      <Route path="/auditoria" element={<ProtectedRoute adminOnly><AuditPage /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
