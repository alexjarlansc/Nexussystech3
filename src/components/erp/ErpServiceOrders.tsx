import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/sonner';

interface ClientSnapshot {
  name?: string;
  company_name?: string;
  [k: string]: unknown;
}

import type { Tables } from '../../integrations/supabase/types';
type ServiceOrder = Tables<'service_orders'>;

const statusColors: Record<string, string> = {
  ABERTA: 'bg-blue-500',
  EM_EXECUCAO: 'bg-amber-500',
  CONCLUIDA: 'bg-green-600',
  CANCELADA: 'bg-red-600'
};

export const ErpServiceOrders: React.FC = () => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [missingTable, setMissingTable] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase.from('service_orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (search) {
        query = query.ilike('number', `%${search}%`);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
  setOrders((data || []) as ServiceOrder[]);
      setTotal(count || 0);
    } catch (e: unknown) {
      let message = 'Erro inesperado';
      const errObj = (e && typeof e === 'object') ? e as Record<string, unknown> : null;
      if (errObj && typeof errObj.message === 'string') message = errObj.message;
      const code = errObj && typeof errObj.code === 'string' ? errObj.code : undefined;
      if (code === '42P01' || (/service_orders/i.test(message) && /não existe|does not exist/i.test(message))) {
        message = 'Tabela service_orders não encontrada. Aplique a migration 20250830180000_create_service_orders.sql no Supabase.';
        setMissingTable(true);
      } else {
        setMissingTable(false);
      }
      if (code === '42501' || /permission/i.test(message)) {
        message += ' Verifique políticas RLS e roles.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const channel = supabase.channel('realtime-service-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">Ordens de Serviço</CardTitle>
          <div className="flex gap-2 items-center">
            <Button size="sm" onClick={()=>setCreateOpen(true)}>Nova OS</Button>
            <Input placeholder="Buscar nº" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} className="h-8 w-40" />
            <select className="h-8 text-sm border rounded px-2" value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }}>
              <option value="">Status</option>
              <option value="ABERTA">Aberta</option>
              <option value="EM_EXECUCAO">Em Execução</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}>Limpar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-sm text-red-500 mb-2">{error}</div>}
          {!missingTable && <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Nº</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Descrição</th>
                  <th className="text-left p-2">Subtotal</th>
                  <th className="text-left p-2">Desconto</th>
                  <th className="text-left p-2">Total</th>
                  <th className="text-left p-2">Criada</th>
                  <th className="text-left p-2">Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhuma OS encontrada.</td></tr>
                )}
                {!loading && orders.map(o => {
                  let clientName = '-';
                  if (o.client_snapshot && typeof o.client_snapshot === 'object' && !Array.isArray(o.client_snapshot)) {
                    const snap = o.client_snapshot as Record<string, unknown>;
                    clientName = (typeof snap.name === 'string' && snap.name) || (typeof snap.company_name === 'string' && snap.company_name) || '-';
                  }
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 font-mono text-xs">{o.number}</td>
                      <td className="p-2">
                        <span className={cn('text-white text-[10px] px-2 py-1 rounded', statusColors[o.status] || 'bg-gray-500')}>{o.status}</span>
                      </td>
                      <td className="p-2 max-w-[160px] truncate" title={clientName}>{clientName}</td>
                      <td className="p-2 max-w-[220px] truncate" title={o.description || ''}>{o.description}</td>
                      <td className="p-2 text-right tabular-nums">{o.subtotal?.toFixed(2) || '-'}</td>
                      <td className="p-2 text-right tabular-nums">{o.discount?.toFixed(2) || '-'}</td>
                      <td className="p-2 text-right font-semibold tabular-nums">{o.total?.toFixed(2) || '-'}</td>
                      <td className="p-2 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="p-2 text-xs">{new Date(o.updated_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
          {missingTable && (
            <div className="p-4 border rounded bg-amber-50 text-amber-800 text-xs leading-relaxed space-y-2">
              <p><strong>Tabela ausente:</strong> A tabela <code>service_orders</code> ainda não existe no seu projeto Supabase.</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Instale CLI (se preciso): <code>npm install -g supabase</code></li>
                <li>Faça login: <code>supabase login</code></li>
                <li>Link com o projeto: <code>supabase link --project-ref zjaqjxqtbwrkhijdlvyo</code></li>
                <li>Aplicar migrations: <code>supabase db push</code></li>
              </ol>
              <p>Ou copie o SQL do arquivo <code>20250830180000_create_service_orders.sql</code> no editor SQL do painel Supabase e execute.</p>
              <p>Depois recarregue esta página.</p>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <div>Página {page} de {totalPages} • {total} registros</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p => Math.max(1, p-1))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page===totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={createOpen} onOpenChange={o=>{ if(!creating) setCreateOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Input placeholder="ID Cliente (opcional)" value={newClientId} onChange={e=>setNewClientId(e.target.value)} />
            <Textarea rows={4} placeholder="Descrição / Problema / Escopo" value={newDesc} onChange={e=>setNewDesc(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Número será gerado automaticamente.</p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" disabled={creating} onClick={()=>setCreateOpen(false)}>Cancelar</Button>
            <Button disabled={creating} onClick={async()=>{
              if(!newDesc.trim()) { toast.error('Informe descrição'); return; }
              setCreating(true);
              try {
                // gera número via função
                // Chamada tipada com cast para evitar erro de tipos quando a função ainda não está declarada em types.ts
                // Chamada RPC sem tipagem estrita para evitar bloqueio caso types gerados não estejam atualizados
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: numData, error: numErr } = await (supabase as any).rpc('next_service_order_number');
                let number: string = typeof numData === 'string' ? numData : '';
                if (numErr || !number) {
                  const stamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(2,10); // YYMMDDHH
                  const rand = Math.random().toString().slice(2,7);
                  number = 'OS' + stamp + rand; // fallback
                }
                const insertPayload = {
                  number,
                  status: 'ABERTA',
                  description: newDesc.trim(),
                  client_id: newClientId || null,
                  client_snapshot: newClientId ? { id: newClientId } : null,
                  items: [],
                  subtotal: null,
                  discount: null,
                  total: null,
                };
                const { error: insErr } = await supabase.from('service_orders').insert(insertPayload);
                if (insErr) throw insErr;
                toast.success('OS criada: '+number);
                setCreateOpen(false);
                setNewDesc(''); setNewClientId('');
                fetchOrders();
              } catch(err: unknown) {
                let msg = 'Falha ao criar';
                if (err && typeof err === 'object') {
                  const maybe = err as { message?: unknown };
                  if (typeof maybe.message === 'string') msg = maybe.message;
                }
                toast.error(msg);
              } finally { setCreating(false); }
            }}>{creating?'Criando...':'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErpServiceOrders;