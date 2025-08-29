import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Search, Plus, FileDown, Filter, RefreshCcw, Truck, Building, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';

const Compras: React.FC = () => {
  const [filterText, setFilterText] = useState('');
  
  // Dados de exemplo de pedidos de compra
  const pedidos = [
    { 
      id: 'PC-0001', 
      fornecedor: 'TechSupplies Inc.', 
      valor: 'R$ 4.500,00',
      emissao: '20/08/2025',
      previsao: '05/09/2025',
      status: 'Aguardando'
    },
    { 
      id: 'PC-0002', 
      fornecedor: 'Hardware Express', 
      valor: 'R$ 2.780,00',
      emissao: '22/08/2025',
      previsao: '10/09/2025',
      status: 'Confirmado'
    },
    { 
      id: 'PC-0003', 
      fornecedor: 'Global Components', 
      valor: 'R$ 6.320,00',
      emissao: '15/08/2025',
      previsao: '25/08/2025',
      status: 'Entregue'
    },
    { 
      id: 'PC-0004', 
      fornecedor: 'BR Eletrônicos', 
      valor: 'R$ 1.980,00',
      emissao: '25/08/2025',
      previsao: '15/09/2025',
      status: 'Em Trânsito'
    },
    { 
      id: 'PC-0005', 
      fornecedor: 'Digital Parts Ltda', 
      valor: 'R$ 3.650,00',
      emissao: '18/08/2025',
      previsao: '01/09/2025',
      status: 'Confirmado'
    },
  ];

  // Dados de exemplo de fornecedores
  const fornecedores = [
    { 
      id: 'F001', 
      nome: 'TechSupplies Inc.', 
      categoria: 'Eletrônicos',
      contato: '(11) 98765-4321',
      email: 'contato@techsupplies.com',
      cidade: 'São Paulo'
    },
    { 
      id: 'F002', 
      nome: 'Hardware Express', 
      categoria: 'Componentes',
      contato: '(21) 98765-4321',
      email: 'vendas@hwexpress.com',
      cidade: 'Rio de Janeiro'
    },
    { 
      id: 'F003', 
      nome: 'Global Components', 
      categoria: 'Diversos',
      contato: '(51) 98765-4321',
      email: 'contato@globalcomp.com',
      cidade: 'Porto Alegre'
    },
    { 
      id: 'F004', 
      nome: 'BR Eletrônicos', 
      categoria: 'Eletrônicos',
      contato: '(31) 98765-4321',
      email: 'vendas@breletronicos.com.br',
      cidade: 'Belo Horizonte'
    },
  ];

  const filteredPedidos = pedidos.filter(pedido => 
    pedido.fornecedor.toLowerCase().includes(filterText.toLowerCase()) ||
    pedido.id.toLowerCase().includes(filterText.toLowerCase()) ||
    pedido.status.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredFornecedores = fornecedores.filter(fornecedor => 
    fornecedor.nome.toLowerCase().includes(filterText.toLowerCase()) ||
    fornecedor.id.toLowerCase().includes(filterText.toLowerCase()) ||
    fornecedor.categoria.toLowerCase().includes(filterText.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Entregue':
        return 'bg-green-100 text-green-800';
      case 'Confirmado':
        return 'bg-blue-100 text-blue-800';
      case 'Em Trânsito':
        return 'bg-indigo-100 text-indigo-800';
      case 'Aguardando':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sistema de Compras</h1>
        <div className="space-x-2">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 md:col-span-1 flex items-center">
          <div className="mr-4 p-3 rounded-full bg-blue-100">
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Aguardando</h3>
            <p className="text-2xl font-bold mt-1">3 pedidos</p>
          </div>
        </Card>
        <Card className="p-6 col-span-1 md:col-span-1 flex items-center">
          <div className="mr-4 p-3 rounded-full bg-indigo-100">
            <Truck className="h-8 w-8 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Em Trânsito</h3>
            <p className="text-2xl font-bold mt-1">1 pedido</p>
          </div>
        </Card>
        <Card className="p-6 col-span-1 md:col-span-1 flex items-center">
          <div className="mr-4 p-3 rounded-full bg-green-100">
            <Building className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Fornecedores</h3>
            <p className="text-2xl font-bold mt-1">4 ativos</p>
          </div>
        </Card>
      </div>
      
      <Card className="p-6">
        <Tabs defaultValue="pedidos" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            </TabsList>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-10 w-64"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <TabsContent value="pedidos" className="mt-0">
            <Table>
              <TableCaption>Lista de pedidos de compra</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Previsão Entrega</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.map((pedido, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{pedido.id}</TableCell>
                    <TableCell>{pedido.fornecedor}</TableCell>
                    <TableCell>{pedido.valor}</TableCell>
                    <TableCell>{pedido.emissao}</TableCell>
                    <TableCell>{pedido.previsao}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(pedido.status)}`}>
                        {pedido.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="fornecedores">
            <Table>
              <TableCaption>Lista de fornecedores</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.map((fornecedor, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{fornecedor.id}</TableCell>
                    <TableCell>{fornecedor.nome}</TableCell>
                    <TableCell>{fornecedor.categoria}</TableCell>
                    <TableCell>{fornecedor.contato}</TableCell>
                    <TableCell>{fornecedor.email}</TableCell>
                    <TableCell>{fornecedor.cidade}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Pedidos Recentes</h3>
          <div className="space-y-4">
            {pedidos.slice(0, 3).map((pedido, index) => (
              <div key={index} className="flex justify-between items-center pb-2 border-b">
                <div>
                  <p className="font-medium">{pedido.id} - {pedido.fornecedor}</p>
                  <p className="text-sm text-gray-500">Emitido em {pedido.emissao}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{pedido.valor}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(pedido.status)}`}>
                    {pedido.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Button variant="link" className="mt-4 p-0 text-sm">
            Ver todos os pedidos →
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <Building className="h-4 w-4" />
              Novo Fornecedor
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <Truck className="h-4 w-4" />
              Registrar Entrega
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <FileDown className="h-4 w-4" />
              Relatório de Compras
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Compras;
