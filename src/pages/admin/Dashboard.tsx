import React from 'react';
import { Card } from '../../components/ui/card';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Users,
  FileText
} from 'lucide-react';

const Dashboard: React.FC = () => {
  // Dados de exemplo
  const stats = [
    {
      title: 'Vendas Hoje',
      value: 'R$ 4.290,00',
      icon: <ShoppingCart className="h-8 w-8 text-blue-500" />,
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'A Receber',
      value: 'R$ 12.500,00',
      icon: <DollarSign className="h-8 w-8 text-green-500" />,
      change: '+3.4%',
      changeType: 'positive'
    },
    {
      title: 'A Pagar',
      value: 'R$ 7.230,00',
      icon: <FileText className="h-8 w-8 text-red-500" />,
      change: '-2.1%',
      changeType: 'negative'
    },
    {
      title: 'Produtos Baixo Estoque',
      value: '12',
      icon: <AlertTriangle className="h-8 w-8 text-amber-500" />,
      change: '+4',
      changeType: 'negative'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Última atualização: {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <h3 className="text-2xl font-bold mt-2">{stat.value}</h3>
                <div className={`flex items-center mt-2 ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  <span className="text-sm">{stat.change} em 30 dias</span>
                </div>
              </div>
              <div>
                {stat.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Vendas Recentes</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Nexus Tech Pro</p>
                <p className="text-sm text-gray-500">Há 2 horas</p>
              </div>
              <span className="font-medium">R$ 1.250,00</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Digital Solutions Inc</p>
                <p className="text-sm text-gray-500">Há 5 horas</p>
              </div>
              <span className="font-medium">R$ 3.450,00</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Tech Dynamics</p>
                <p className="text-sm text-gray-500">Há 1 dia</p>
              </div>
              <span className="font-medium">R$ 860,00</span>
            </div>
          </div>
          <button className="mt-4 text-sm text-blue-600 hover:text-blue-800">
            Ver todas as vendas →
          </button>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Próximos Vencimentos</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Aluguel Escritório</p>
                <p className="text-sm text-gray-500">Amanhã</p>
              </div>
              <span className="font-medium text-red-600">R$ 2.500,00</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Fornecedor XYZ</p>
                <p className="text-sm text-gray-500">Em 3 dias</p>
              </div>
              <span className="font-medium text-amber-600">R$ 1.780,00</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Internet e Telefonia</p>
                <p className="text-sm text-gray-500">Em 5 dias</p>
              </div>
              <span className="font-medium text-amber-600">R$ 350,00</span>
            </div>
          </div>
          <button className="mt-4 text-sm text-blue-600 hover:text-blue-800">
            Ver todos os vencimentos →
          </button>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
