import QuoteBuilder from "@/components/QuoteBuilder";
import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen gradient-hero">
      <NexusProtectedHeader />
      <QuoteBuilder />
      
      {/* Botão para acessar o painel administrativo */}
      <div className="fixed bottom-4 right-4">
        <Link 
          to="/admin/dashboard" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
          Acessar Sistema ERP
        </Link>
      </div>
    </div>
  );
}
