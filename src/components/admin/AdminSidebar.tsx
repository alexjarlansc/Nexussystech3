import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  FileText,
  DollarSign,
  ShoppingCart,
  Layers,
  Box,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type MenuItem = {
  title: string;
  icon: React.ReactNode;
  path: string;
  submenu?: { title: string; path: string }[];
};

const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const menuItems: MenuItem[] = [
    {
      title: 'Dashboard',
      icon: <Home className="w-5 h-5" />,
      path: '/admin/dashboard',
    },
    {
      title: 'Vendas',
      icon: <ShoppingCart className="w-5 h-5" />,
      path: '/admin/vendas',
      submenu: [
        { title: 'Nova Venda', path: '/admin/vendas/nova' },
        { title: 'Histórico', path: '/admin/vendas/historico' },
        { title: 'Metas', path: '/admin/vendas/metas' },
      ],
    },
    {
      title: 'Financeiro',
      icon: <DollarSign className="w-5 h-5" />,
      path: '/admin/financeiro',
      submenu: [
        { title: 'Contas a Receber', path: '/admin/financeiro/receber' },
        { title: 'Contas a Pagar', path: '/admin/financeiro/pagar' },
        { title: 'Fluxo de Caixa', path: '/admin/financeiro/fluxo-caixa' },
        { title: 'Boletos', path: '/admin/financeiro/boletos' },
      ],
    },
    {
      title: 'Fiscal',
      icon: <FileText className="w-5 h-5" />,
      path: '/admin/fiscal',
      submenu: [
        { title: 'Notas Fiscais', path: '/admin/fiscal/notas' },
        { title: 'Configurações', path: '/admin/fiscal/configuracoes' },
      ],
    },
    {
      title: 'Estoque',
      icon: <Package className="w-5 h-5" />,
      path: '/admin/estoque',
      submenu: [
        { title: 'Produtos', path: '/admin/estoque/produtos' },
        { title: 'Entrada', path: '/admin/estoque/entrada' },
        { title: 'Saída', path: '/admin/estoque/saida' },
        { title: 'Inventário', path: '/admin/estoque/inventario' },
      ],
    },
    {
      title: 'Compras',
      icon: <Box className="w-5 h-5" />,
      path: '/admin/compras',
      submenu: [
        { title: 'Pedidos', path: '/admin/compras/pedidos' },
        { title: 'Fornecedores', path: '/admin/compras/fornecedores' },
      ],
    },
    {
      title: 'Clientes',
      icon: <Users className="w-5 h-5" />,
      path: '/admin/clientes',
    },
    {
      title: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      path: '/admin/configuracoes',
    },
  ];

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Nexus ERP</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => (
          <div key={item.title}>
            <div
              className={cn(
                'flex items-center px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors',
                location.pathname === item.path && !item.submenu && 'bg-gray-800'
              )}
              onClick={() => item.submenu && toggleMenu(item.title)}
            >
              <div className="mr-3">{item.icon}</div>
              <span className="flex-1">{item.title}</span>
              {item.submenu && (
                expandedMenus[item.title] 
                  ? <ChevronDown className="w-4 h-4" /> 
                  : <ChevronRight className="w-4 h-4" />
              )}
            </div>
            
            {item.submenu && expandedMenus[item.title] && (
              <div className="bg-gray-800">
                {item.submenu.map((subItem) => (
                  <Link 
                    key={subItem.path} 
                    to={subItem.path}
                    className={cn(
                      'flex items-center pl-12 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors',
                      location.pathname === subItem.path && 'bg-gray-700 text-white'
                    )}
                  >
                    {subItem.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSidebar;
