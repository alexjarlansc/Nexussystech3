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
import { Search, Plus, FileDown, Filter, RefreshCcw } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

const Produtos: React.FC = () => {
  const [filterText, setFilterText] = useState('');
  
  // Dados de exemplo
  const produtos = [
    { 
      codigo: 'PRD001', 
      nome: 'Notebook Nexus Pro', 
      categoria: 'Eletrônicos',
      estoque: 15, 
      minimo: 5,
      preco: 'R$ 3.599,00',
      status: 'Normal'
    },
    { 
      codigo: 'PRD002', 
      nome: 'Monitor 27" UltraWide', 
      categoria: 'Eletrônicos',
      estoque: 8, 
      minimo: 10,
      preco: 'R$ 1.299,00',
      status: 'Baixo'
    },
    { 
      codigo: 'PRD003', 
      nome: 'Teclado Mecânico RGB', 
      categoria: 'Periféricos',
      estoque: 30, 
      minimo: 15,
      preco: 'R$ 259,90',
      status: 'Normal'
    },
    { 
      codigo: 'PRD004', 
      nome: 'Mouse Wireless Pro', 
      categoria: 'Periféricos',
      estoque: 25, 
      minimo: 10,
      preco: 'R$ 129,90',
      status: 'Normal'
    },
    { 
      codigo: 'PRD005', 
      nome: 'SSD 1TB NVMe', 
      categoria: 'Componentes',
      estoque: 3, 
      minimo: 8,
      preco: 'R$ 599,90',
      status: 'Crítico'
    },
  ];

  const filteredProdutos = produtos.filter(produto => 
    produto.nome.toLowerCase().includes(filterText.toLowerCase()) ||
    produto.codigo.toLowerCase().includes(filterText.toLowerCase()) ||
    produto.categoria.toLowerCase().includes(filterText.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Normal':
        return 'bg-green-100 text-green-800';
      case 'Baixo':
        return 'bg-yellow-100 text-yellow-800';
      case 'Crítico':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const resumoEstoque = {
    total: 81,
    baixo: 8,
    critico: 3,
    categorias: 3
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciamento de Estoque</h1>
        <div className="space-x-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Total de Produtos</h3>
          <p className="text-2xl font-bold mt-2">{resumoEstoque.total}</p>
          <div className="mt-2 text-sm text-gray-500">Em todas as categorias</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Estoque Baixo</h3>
          <p className="text-2xl font-bold mt-2 text-yellow-600">{resumoEstoque.baixo}</p>
          <div className="mt-2 text-sm text-gray-500">Produtos abaixo do mínimo</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Estoque Crítico</h3>
          <p className="text-2xl font-bold mt-2 text-red-600">{resumoEstoque.critico}</p>
          <div className="mt-2 text-sm text-gray-500">Produtos em nível crítico</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Categorias</h3>
          <p className="text-2xl font-bold mt-2">{resumoEstoque.categorias}</p>
          <div className="mt-2 text-sm text-gray-500">Total de categorias</div>
        </Card>
      </div>
      
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar produtos..." 
              className="pl-10"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex items-center gap-1">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" className="flex items-center gap-1">
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
        
        <Table>
          <TableCaption>Inventário de produtos</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Estoque</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProdutos.map((produto, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{produto.codigo}</TableCell>
                <TableCell>{produto.nome}</TableCell>
                <TableCell>
                  <Badge variant="outline">{produto.categoria}</Badge>
                </TableCell>
                <TableCell className="text-center">{produto.estoque}</TableCell>
                <TableCell>{produto.minimo}</TableCell>
                <TableCell>{produto.preco}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(produto.status)}`}>
                    {produto.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Movimentações Recentes</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Entrada: SSD 1TB NVMe</p>
                <p className="text-sm text-gray-500">Há 2 horas · +3 unidades</p>
              </div>
              <Badge variant="outline" className="bg-green-50">Entrada</Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Saída: Notebook Nexus Pro</p>
                <p className="text-sm text-gray-500">Há 3 horas · -2 unidades</p>
              </div>
              <Badge variant="outline" className="bg-blue-50">Saída</Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <p className="font-medium">Ajuste: Teclado Mecânico RGB</p>
                <p className="text-sm text-gray-500">Há 1 dia · -1 unidade</p>
              </div>
              <Badge variant="outline" className="bg-yellow-50">Ajuste</Badge>
            </div>
          </div>
          <Button variant="link" className="mt-4 p-0 text-sm">
            Ver todas as movimentações →
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <Plus className="h-4 w-4" />
              Nova Entrada
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <FileDown className="h-4 w-4" />
              Nova Saída
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <RefreshCcw className="h-4 w-4" />
              Ajuste de Estoque
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 h-auto py-4">
              <Filter className="h-4 w-4" />
              Inventário
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Produtos;
