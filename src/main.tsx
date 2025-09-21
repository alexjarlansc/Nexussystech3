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
