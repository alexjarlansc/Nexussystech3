import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

type KPI = { label: string; value: string };
type SimpleRow = { amount?: number | string; status?: string; due_date?: string };
type ReceivableRow = SimpleRow & { issue_date?: string };
type PayableRow = SimpleRow & { issue_date?: string; category?: string };
type RpcCashflowResult = { data?: { day: string; balance: number }[] | null };
type ClientRankingResult = { data?: { client_id:string; client_name:string; total_received:number }[] | null };

export default function FinanceDashboard(){
  const [period, setPeriod] = useState<'today'|'week'|'month'|'quarter'>('month');
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState<number>(0);
  const [payablesTotal, setPayablesTotal] = useState<number>(0);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [overdueReceivables, setOverdueReceivables] = useState<number>(0);
  const [upcomingPayables, setUpcomingPayables] = useState<number>(0);
  const [expensesByCategory, setExpensesByCategory] = useState<{ category: string; value: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; receitas: number; despesas: number }[]>([]);
  const [cashSeries, setCashSeries] = useState<{ date: string; balance: number }[]>([]);

  type SupaLike = { rpc: (fn:string, params:unknown)=>Promise<unknown>; from: (table:string)=>{ select: (s:string)=>{ limit: (n:number)=>Promise<unknown> } } };

  const PIE_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6'];

  const loadKpis = useCallback(async ()=>{
    try{
      const sb = supabase as unknown as SupaLike;
  const recv = await sb.from('receivables').select('amount, status, due_date') as unknown as { data: SimpleRow[] | null };
  const pay = await sb.from('payables').select('amount, status, due_date') as unknown as { data: SimpleRow[] | null };

  const recvList = recv.data || [];
  const payList = pay.data || [];

      const totalRecv = recvList.reduce((s, r)=> s + (Number(r.amount)||0), 0);
      const totalPay = payList.reduce((s, p)=> s + (Number(p.amount)||0), 0);

      const overdue = recvList.filter(r=> r.status !== 'pago' && new Date(r.due_date) < new Date()).length;
      const upcoming = payList.filter(p=> p.status !== 'pago' && new Date(p.due_date) > new Date()).length;

      setReceivablesTotal(totalRecv);
      setPayablesTotal(totalPay);
      setOverdueReceivables(overdue);
      setUpcomingPayables(upcoming);

      const balance = totalRecv - totalPay;
      setCashBalance(balance);

      setKpis([
        { label: 'Saldo em Caixa', value: balance.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) },
        { label: 'Receitas (período)', value: totalRecv.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) },
        { label: 'Despesas (período)', value: totalPay.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) },
        { label: 'Recebíveis em atraso', value: String(overdue) },
        { label: 'Pagamentos próximos', value: String(upcoming) },
      ]);

  // montar despesas por categoria (simplificado: agrupa por 'category' campo em payables)
  const byCat: Record<string, number> = {};
  for (const p of payList){ const pp = p as PayableRow; const cat = pp.category || 'Outros'; byCat[cat] = (byCat[cat]||0) + Number(pp.amount||0); }
  setExpensesByCategory(Object.entries(byCat).map(([category,value])=>({ category, value })));

  // montar monthlyData (últimos 6 meses simplificado)
  const now = new Date();
  const months: { month: string; receitas: number; despesas: number }[] = [];
  for (let i=5;i>=0;i--){ const d = new Date(now.getFullYear(), now.getMonth()-i,1); const key = d.toLocaleString('pt-BR',{month:'short', year:'2-digit'}); months.push({ month: key, receitas: 0, despesas: 0 }); }
  const monthIndex = (dateStr?: string)=>{ if (!dateStr) return -1; const d=new Date(dateStr); const key = d.toLocaleString('pt-BR',{month:'short', year:'2-digit'}); return months.findIndex(m=>m.month===key); };
  for (const r of recvList){ const rr = r as ReceivableRow; const idx = monthIndex(rr.issue_date || rr.due_date); if (idx>=0) months[idx].receitas += Number(rr.amount||0); }
  for (const p of payList){ const pp = p as PayableRow; const idx = monthIndex(pp.issue_date || pp.due_date); if (idx>=0) months[idx].despesas += Number(pp.amount||0); }
  setMonthlyData(months);

      // tentar carregar série de caixa via RPC finance_cashflow (prefere servidor)
      try{
        const sb = supabase as unknown as SupaLike;
        const end = new Date(); const start = new Date(); start.setDate(end.getDate()-13);
        const rpc = await sb.rpc('finance_cashflow', { start_date: start.toISOString().slice(0,10), end_date: end.toISOString().slice(0,10) }) as unknown as RpcCashflowResult;
  if (rpc?.data){ setCashSeries(rpc.data.map(d=>({ date: new Date(d.day).toLocaleDateString('pt-BR'), balance: Number(d.balance || 0) }))); }
        else {
          // fallback simples: manter cálculo local (últimos 14 dias)
          const days: { date: string; balance: number }[] = [];
          for (let i=13;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push({ date: d.toLocaleDateString('pt-BR'), balance: 0 }); }
          for (const r of recvList){ const rr = r as ReceivableRow; const dateKey = new Date(rr.issue_date || rr.due_date || '').toLocaleDateString('pt-BR'); const idx = days.findIndex(x=>x.date=== dateKey); if (idx>=0) days[idx].balance += Number(rr.amount||0); }
          for (const p of payList){ const pp = p as PayableRow; const dateKey = new Date(pp.issue_date || pp.due_date || '').toLocaleDateString('pt-BR'); const idx = days.findIndex(x=>x.date=== dateKey); if (idx>=0) days[idx].balance -= Number(pp.amount||0); }
          let acc = 0; for (const d of days){ acc += d.balance; d.balance = acc; }
          setCashSeries(days);
        }
      } catch(_){ /* fallback local se RPC falhar */
        const days: { date: string; balance: number }[] = [];
        for (let i=13;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push({ date: d.toLocaleDateString('pt-BR'), balance: 0 }); }
        for (const r of recvList){ const rr = r as ReceivableRow; const dateKey = new Date(rr.issue_date || rr.due_date || '').toLocaleDateString('pt-BR'); const idx = days.findIndex(x=>x.date=== dateKey); if (idx>=0) days[idx].balance += Number(rr.amount||0); }
        for (const p of payList){ const pp = p as PayableRow; const dateKey = new Date(pp.issue_date || pp.due_date || '').toLocaleDateString('pt-BR'); const idx = days.findIndex(x=>x.date=== dateKey); if (idx>=0) days[idx].balance -= Number(pp.amount||0); }
        let acc = 0; for (const d of days){ acc += d.balance; d.balance = acc; }
        setCashSeries(days);
      }

      // tentar carregar ranking de clientes via view clients_received_ranking
      try{
    const cr = await sb.from('clients_received_ranking').select('*').limit(10) as unknown as ClientRankingResult;
        if (cr?.data){ /* hoje só usamos nos gráficos; futuro: exibir tabela */ }
      } catch(_){ /* ignore */ }
    }catch(e){ console.error(e); toast.error('Falha ao carregar KPIs'); }
  },[]);

  useEffect(()=>{ loadKpis(); },[loadKpis]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Dashboard Financeiro</h2>
        <div className="ml-auto flex gap-2">
    <select value={period} onChange={e=>setPeriod(e.target.value as 'today'|'week'|'month'|'quarter')} className="h-8 border rounded px-2">
            <option value="today">Hoje</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="quarter">Trimestre</option>
          </select>
          <Button onClick={loadKpis}>Atualizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k=> (
          <Card key={k.label} className="p-3">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="text-xl font-semibold">{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Recebíveis</h3>
          <div className="text-sm">Total a receber: <strong>{receivablesTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
          <div className="text-sm">Inadimplentes: <strong>{overdueReceivables}</strong></div>
          <div className="mt-2 h-36 bg-muted/30">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="receitas" fill="#16a34a" />
                <Bar dataKey="despesas" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Despesas</h3>
          <div className="text-sm">Total pendente: <strong>{payablesTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
          <div className="text-sm">Vencidas: <strong>{upcomingPayables}</strong></div>
          <div className="mt-2 h-36 bg-muted/30">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={expensesByCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={50} label />
                {expensesByCategory.map((entry, idx)=> <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                <ReTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Fluxo de Caixa</h3>
          <div className="text-sm">Saldo projetado: <strong>{cashBalance.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
          <div className="mt-2 h-36 bg-muted/30">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={cashSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ReTooltip />
                <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Alertas</h3>
        <ul className="list-disc pl-5">
          <li>Contas vencendo nos próximos dias: <strong>{upcomingPayables}</strong></li>
          <li>Recebimentos atrasados: <strong>{overdueReceivables}</strong></li>
          <li>Saldo abaixo do mínimo operacional: <strong>{cashBalance < 0 ? 'SIM' : 'OK'}</strong></li>
        </ul>
      </Card>
    </div>
  );
}
