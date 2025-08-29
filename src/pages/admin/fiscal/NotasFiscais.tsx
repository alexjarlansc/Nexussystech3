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
import { FileText, Download, Eye, Search, Plus } from 'lucide-react';

const NotasFiscais: React.FC = () => {
  const [filterText, setFilterText] = useState('');
  
  // Dados de exemplo
  const notas = [
    { 
      numero: '000001', 
      cliente: 'Empresa ABC Ltda', 
      valor: 'R$ 1.250,00', 
      emissao: '25/08/2025', 
      status: 'Emitida'
    },
    { 
      numero: '000002', 
      cliente: 'Tech Solutions Inc', 
      valor: 'R$ 3.780,00', 
      emissao: '26/08/2025', 
      status: 'Emitida'
    },
    { 
      numero: '000003', 
      cliente: 'Digital Services', 
      valor: 'R$ 950,00', 
      emissao: '27/08/2025', 
      status: 'Cancelada'
    },
    { 
      numero: '000004', 
      cliente: 'Nexus Tech Corp', 
      valor: 'R$ 5.640,00', 
      emissao: '28/08/2025', 
      status: 'Pendente'
    },
    { 
      numero: '000005', 
      cliente: 'Inovação Software', 
      valor: 'R$ 2.340,00', 
      emissao: '29/08/2025', 
      status: 'Emitida'
    },
  ];

  const filteredNotas = notas.filter(nota => 
    nota.cliente.toLowerCase().includes(filterText.toLowerCase()) ||
    nota.numero.includes(filterText) ||
    nota.status.toLowerCase().includes(filterText.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Emitida':
        return 'bg-green-100 text-green-800';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notas Fiscais</h1>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Nota Fiscal
        </Button>
      </div>
      
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por número, cliente ou status..." 
              className="pl-10"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <Button variant="outline">Filtros</Button>
          <Button variant="outline">Exportar</Button>
        </div>
        
        <Table>
          <TableCaption>Lista de notas fiscais</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotas.map((nota, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{nota.numero}</TableCell>
                <TableCell>{nota.cliente}</TableCell>
                <TableCell>{nota.valor}</TableCell>
                <TableCell>{nota.emissao}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(nota.status)}`}>
                    {nota.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Emissão Automática</h3>
        <p className="text-gray-600 mb-4">
          Configure a emissão automática de notas fiscais para agilizar seu processo de vendas.
          Notas podem ser geradas automaticamente a partir de pedidos finalizados.
        </p>
        <Button className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Configurar Emissão Automática
        </Button>
      </Card>
    </div>
  );
};

export default NotasFiscais;
