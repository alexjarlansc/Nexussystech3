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
import { Search, Plus, FileDown, Filter, RefreshCcw, CreditCard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Progress } from '../../../components/ui/progress';

const ContasReceber: React.FC = () => {
  const [filterText, setFilterText] = useState('');
  
  // Dados de exemplo
  const contas = [
    { 
      id: '00001', 
      cliente: 'Empresa ABC Ltda', 
      descricao: 'Serviços de TI',
      valor: 'R$ 3.500,00',
      emissao: '15/08/2025',
      vencimento: '15/09/2025',
      status: 'Em Aberto'
    },
    { 
      id: '00002', 
      cliente: 'Tech Solutions Inc', 
      descricao: 'Assinatura Software',
      valor: 'R$ 1.200,00',
      emissao: '10/08/2025',
      vencimento: '10/09/2025',
      status: 'Em Aberto'
    },
    { 
      id: '00003', 
      cliente: 'Digital Services', 
      descricao: 'Consultoria Técnica',
      valor: 'R$ 2.750,00',
      emissao: '05/08/2025',
      vencimento: '05/09/2025',
      status: 'Atrasado'
    },
    { 
      id: '00004', 
      cliente: 'Nexus Tech Corp', 
      descricao: 'Manutenção Mensal',
      valor: 'R$ 980,00',
      emissao: '01/08/2025',
      vencimento: '01/09/2025',
      status: 'Em Aberto'
    },
    { 
      id: '00005', 
      cliente: 'Inovação Software', 
      descricao: 'Projeto Customizado',
      valor: 'R$ 5.600,00',
      emissao: '25/07/2025',
      vencimento: '25/08/2025',
      status: 'Pago'
    },
  ];

  const filteredContas = contas.filter(conta => 
    conta.cliente.toLowerCase().includes(filterText.toLowerCase()) ||
    conta.id.includes(filterText) ||
    conta.status.toLowerCase().includes(filterText.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Pago':
        return 'bg-green-100 text-green-800';
      case 'Em Aberto':
        return 'bg-blue-100 text-blue-800';
      case 'Atrasado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Resumo financeiro
  const resumo = {
    emAberto: 'R$ 8.430,00',
    atrasado: 'R$ 2.750,00',
    recebidoMes: 'R$ 12.650,00',
    totalReceber: 'R$ 11.180,00',
    percentualRecebido: 65
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas a Receber</h1>
        <div className="space-x-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Cobrança
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Em Aberto</h3>
          <p className="text-2xl font-bold mt-2 text-blue-600">{resumo.emAberto}</p>
          <div className="mt-2 text-sm text-gray-500">Vencendo nos próximos 30 dias</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Atrasado</h3>
          <p className="text-2xl font-bold mt-2 text-red-600">{resumo.atrasado}</p>
          <div className="mt-2 text-sm text-gray-500">Vencimento ultrapassado</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Recebido no Mês</h3>
          <p className="text-2xl font-bold mt-2 text-green-600">{resumo.recebidoMes}</p>
          <div className="mt-2 text-sm text-gray-500">Total recebido este mês</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Total a Receber</h3>
          <p className="text-2xl font-bold mt-2">{resumo.totalReceber}</p>
          <div className="mt-2">
            <div className="flex justify-between mb-1 text-sm">
              <span>Meta Mensal</span>
              <span>{resumo.percentualRecebido}%</span>
            </div>
            <Progress value={resumo.percentualRecebido} className="h-2" />
          </div>
        </Card>
      </div>
      
      <Card className="p-6">
        <Tabs defaultValue="todos" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="emaberto">Em Aberto</TabsTrigger>
              <TabsTrigger value="atrasados">Atrasados</TabsTrigger>
              <TabsTrigger value="pagos">Pagos</TabsTrigger>
            </TabsList>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input 
                  placeholder="Buscar contas..." 
                  className="pl-10 w-64"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <TabsContent value="todos" className="mt-0">
            <Table>
              <TableCaption>Lista de contas a receber</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContas.map((conta, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{conta.id}</TableCell>
                    <TableCell>{conta.cliente}</TableCell>
                    <TableCell>{conta.descricao}</TableCell>
                    <TableCell>{conta.valor}</TableCell>
                    <TableCell>{conta.emissao}</TableCell>
                    <TableCell>{conta.vencimento}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(conta.status)}`}>
                        {conta.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <CreditCard className="h-4 w-4 mr-1" /> Receber
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="emaberto">
            <Table>
              <TableCaption>Contas em aberto</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContas
                  .filter(conta => conta.status === 'Em Aberto')
                  .map((conta, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{conta.id}</TableCell>
                      <TableCell>{conta.cliente}</TableCell>
                      <TableCell>{conta.descricao}</TableCell>
                      <TableCell>{conta.valor}</TableCell>
                      <TableCell>{conta.emissao}</TableCell>
                      <TableCell>{conta.vencimento}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <CreditCard className="h-4 w-4 mr-1" /> Receber
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Outras abas teriam conteúdo semelhante */}
        </Tabs>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Geração Automática de Boletos</h3>
        <p className="text-gray-600 mb-4">
          Configure a geração automática de boletos para otimizar seu fluxo de caixa.
          Boletos podem ser enviados automaticamente por e-mail para seus clientes.
        </p>
        <Button className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Configurar Boletos Automáticos
        </Button>
      </Card>
    </div>
  );
};

export default ContasReceber;
