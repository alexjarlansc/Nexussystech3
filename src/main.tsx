import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SystemDialogProvider from '@/components/SystemDialogProvider';
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PDV from "./pages/PDV";
const Erp = lazy(() => import('./pages/Erp'));
// rota de debug para desenvolvimento: renderiza o Inventário sem passar pelo ProtectedRoute
const ErpInventoryDebug = lazy(() => import('./components/erp/ErpInventory'));
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SystemDialogProvider>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/pdv" element={
                <ProtectedRoute>
                  <PDV />
                </ProtectedRoute>
              } />
              <Route path="/erp" element={
                <ProtectedRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<div className='p-6 text-sm text-slate-500'>Carregando ERP...</div>}>
                      <Erp />
                    </Suspense>
                  </RouteErrorBoundary>
                </ProtectedRoute>
              } />
              {/* rota temporária de debug - remove antes de commit final se necessário */}
              <Route path="/debug-inventory" element={
                <RouteErrorBoundary>
                  <Suspense fallback={<div className='p-6 text-sm text-slate-500'>Carregando Inventário...</div>}>
                    <ErpInventoryDebug initialRows={[
                      { id:1, code:'P001', description:'Produto A', unit:'UND', cost: 10.45, qty_system: 20, qty_physical: 18 },
                      { id:2, code:'P002', description:'Produto B', unit:'UND', cost: 5.50, qty_system: 5, qty_physical: 8 },
                      { id:3, code:'P003', description:'Produto C', unit:'UND', cost: 2.00, qty_system: -2, qty_physical: 1 },
                    ]} />
                  </Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/erp/*" element={
                <ProtectedRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<div className='p-6 text-sm text-slate-500'>Carregando ERP...</div>}>
                      <Erp />
                    </Suspense>
                  </RouteErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SystemDialogProvider>
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
