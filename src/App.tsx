import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Importações de layouts
import AdminLayout from "./layouts/AdminLayout";

// Importações de páginas de administração/ERP
import Dashboard from "./pages/admin/Dashboard";
import NotasFiscais from "./pages/admin/fiscal/NotasFiscais";
import Produtos from "./pages/admin/estoque/Produtos";
import ContasReceber from "./pages/admin/financeiro/ContasReceber";
import Compras from "./pages/admin/compras/Compras";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Rotas do Sistema ERP/Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Fiscal */}
            <Route path="fiscal/notas" element={<NotasFiscais />} />
            
            {/* Estoque */}
            <Route path="estoque/produtos" element={<Produtos />} />
            
            {/* Financeiro */}
            <Route path="financeiro/receber" element={<ContasReceber />} />
            
            {/* Compras */}
            <Route path="compras" element={<Compras />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
