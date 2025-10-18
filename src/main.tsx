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
import Orcamento from "./pages/Orcamento";
import AI from "./pages/AI";
import Configuracoes from "./pages/Configuracoes";
const Erp = lazy(() => import('./pages/Erp'));
// rota de debug para desenvolvimento: renderiza o Inventário sem passar pelo ProtectedRoute
const ErpInventoryDebug = lazy(() => import('./components/erp/ErpInventory'));
import "./index.css";

const queryClient = new QueryClient();

// Mantemos a sessão do Supabase entre recargas; não limpar tokens em beforeunload.

// Escala automática no mobile, com override opcional por VITE_UI_SCALE
// - Se VITE_UI_SCALE estiver definido, usa esse valor (em %)
// - Caso contrário, calcula dinamicamente com base no viewport (largura/altura/DPR)
function computeAutoScale(): number {
  const w = window.innerWidth || document.documentElement.clientWidth || 360;
  const h = window.innerHeight || document.documentElement.clientHeight || 640;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

  // Base por largura (mobile-first)
  let scale = 100;
  if (w <= 340) scale = 78;
  else if (w <= 360) scale = 82;
  else if (w <= 390) scale = 88;
  else if (w <= 430) scale = 92;
  else if (w <= 768) scale = 96;
  else scale = 100;

  // Ajuste por altura muito pequena (teclado/landscape)
  if (h <= 600) scale -= 4;
  if (h <= 520) scale -= 4;

  // Pequeno ajuste para telas muito densas e estreitas
  if (dpr >= 2 && w <= 390) scale += 2;

  // Limites seguros
  scale = Math.max(74, Math.min(102, scale));
  return Math.round(scale);
}

function applyGlobalScale() {
  try {
    const envScaleRaw = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, unknown> })?.env?.VITE_UI_SCALE) as unknown;
    const envScale = Number(envScaleRaw);
    const scale = Number.isFinite(envScale) && envScale > 0 ? envScale : computeAutoScale();
    document.documentElement.style.fontSize = `${scale}%`;
  } catch {/* noop */}
}

applyGlobalScale();

// Atualiza em resize/orientationchange (debounced)
{
  let raf = 0; let last = 0;
  const handler = () => {
    const now = Date.now();
    if (now - last < 50) { // debounce ~50ms
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { last = now; applyGlobalScale(); });
    } else {
      last = now; applyGlobalScale();
    }
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler as EventListener);
}

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
              <Route path="/orcamento" element={
                <ProtectedRoute>
                  <Orcamento />
                </ProtectedRoute>
              } />
              <Route path="/ai" element={
                <ProtectedRoute>
                  <AI />
                </ProtectedRoute>
              } />
              <Route path="/config" element={
                <ProtectedRoute>
                  <Configuracoes />
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
