import { Card } from '@/components/ui/card';

export function ErpClients() {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-2">Clientes</h2>
      <p className="text-sm text-muted-foreground">Reutiliza tabela existente de clientes. Futuro: filtros, exportação, tags.</p>
    </Card>
  );
}
