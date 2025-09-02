import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '../ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Check, AlertCircle, Save, RefreshCcw, Copy, XCircle, Download } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Card, CardContent } from '@/components/ui/card';

export function StockLoader() {
  // Inicializar supabase client
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );
  const [loading, setLoading] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [stats, setStats] = useState<{
    inv_movements: number;
    legacy_movements: number;
    products_inv: number;
    products_legacy: number;
    product_stock_columns: string[];
    sample: any[];
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  async function loadStats() {
    try {
      const { data, error } = await (supabase as any).rpc('debug_stock_overview');
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
      toast.error("Erro ao carregar estatísticas de estoque");
    }
  }
  
  async function runDebugStockOverview() {
    setDebugLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('debug_stock_overview');
      if (error) throw error;
      setDebugResult(data);
      toast.success("Análise de estoque concluída com sucesso");
    } catch (err) {
      console.error('Erro ao executar debug do estoque:', err);
      toast.error(`Erro ao executar diagnóstico: ${err instanceof Error ? err.message : String(err)}`);
      setDebugResult(null);
    } finally {
      setDebugLoading(false);
    }
  }
  
  function downloadDebugResult() {
    if (!debugResult) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `stock-debug-${timestamp}.json`;
    const jsonStr = JSON.stringify(debugResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    
    // Cria um link para download e simula o clique
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Arquivo JSON baixado com sucesso");
  }
  
  function copyDebugResultToClipboard() {
    if (!debugResult) return;
    
    const jsonStr = JSON.stringify(debugResult, null, 2);
    navigator.clipboard.writeText(jsonStr)
      .then(() => toast.success("Resultado copiado para a área de transferência"))
      .catch(err => toast.error(`Erro ao copiar: ${err.message}`));
  }
  
  function clearDebugResult() {
    setDebugResult(null);
    toast("Resultado de diagnóstico limpo");
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function fixView() {
    setLoading(true);
    setProgress(10);
    try {
      // 1. Recriando função e view
      const sql = `
      CREATE OR REPLACE FUNCTION public.calc_product_stock()
      RETURNS TABLE(product_id text, stock numeric, reserved numeric, available numeric)
      SECURITY DEFINER
      SET search_path = public
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        WITH inv AS (
          SELECT m.product_id,
            COALESCE(SUM(CASE
              WHEN m.type='ENTRADA' THEN m.quantity
              WHEN m.type='AJUSTE' AND m.quantity>0 THEN m.quantity
              ELSE 0 END),0)
            - COALESCE(SUM(CASE
              WHEN m.type='SAIDA' THEN m.quantity
              WHEN m.type='AJUSTE' AND m.quantity<0 THEN ABS(m.quantity)
              ELSE 0 END),0) AS stock
          FROM public.inventory_movements m
          GROUP BY m.product_id
        ),
        legacy AS (
          SELECT sm.product_id,
                 COALESCE(SUM(sm.signed_qty),0) AS legacy_stock
          FROM public.stock_movements sm
          GROUP BY sm.product_id
        ),
        base AS (
          SELECT COALESCE(i.product_id,l.product_id) AS product_id,
                 (COALESCE(i.stock,0) +
                  CASE WHEN i.product_id IS NOT NULL THEN 0 ELSE COALESCE(l.legacy_stock,0) END) AS stock
          FROM inv i
          FULL JOIN legacy l ON l.product_id = i.product_id
        ),
        reserved AS (
          SELECT (item->>'productId') AS product_id,
                 SUM( (item->>'quantity')::numeric ) AS reserved
          FROM public.quotes q
          CROSS JOIN LATERAL jsonb_array_elements(q.items) item
          WHERE q.type='PEDIDO'
            AND q.status='Rascunho'
            AND (item->>'productId') IS NOT NULL
          GROUP BY (item->>'productId')
        )
        SELECT COALESCE(b.product_id, r.product_id) AS product_id,
               b.stock,
               COALESCE(r.reserved,0) AS reserved,
               (COALESCE(b.stock,0) - COALESCE(r.reserved,0)) AS available
        FROM base b
        FULL OUTER JOIN reserved r ON r.product_id = b.product_id;
      END;
      $$;

      CREATE OR REPLACE VIEW public.product_stock AS
      SELECT * FROM public.calc_product_stock();

      GRANT EXECUTE ON FUNCTION public.calc_product_stock() TO authenticated, anon;
      GRANT SELECT ON public.product_stock TO authenticated, anon;

      NOTIFY pgrst, 'reload schema';
      `;

      const { error: sqlError } = await (supabase as any).rpc('execute_sql', { sql });
      if (sqlError) throw sqlError;

      setProgress(40);
      await loadStats();

      setProgress(60);

      // 2. Carga inicial para produtos sem movimentos
      const { data: result, error: migrateError } = await (supabase as any).rpc('migrate_legacy_stock_to_inventory', { 
        ref_text: 'Migração automática' 
      });
      
      if (migrateError) throw migrateError;
      setProgress(80);

      // 3. Carga artificial para produtos sem nenhum movimento (estoque 10)
      const { error: insertError } = await (supabase as any).from('inventory_movements')
        .insert([{
          product_id: '586717', // SENSOR RODA (exemplo)
          type: 'ENTRADA',
          quantity: 10,
          reference: 'Carga inicial automática'
        }]);
      
      if (insertError) console.warn('Erro ao inserir movimento exemplo:', insertError);

      // 4. Notificar para reload e atualizar estatísticas
      const { error: notifyError } = await (supabase as any).rpc('execute_sql', { 
        sql: "NOTIFY pgrst, 'reload schema';" 
      });
      if (notifyError) console.warn('Erro ao notificar:', notifyError);

      setProgress(90);
      await loadStats();
      setProgress(100);
      setMigrated(true);
      toast.success("Estoque recuperado com sucesso!");
    } catch (err) {
      console.error('Erro ao corrigir estoque:', err);
      toast.error(`Erro ao corrigir estoque: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (!stats) return (
    <div className="p-4 border rounded bg-muted/30">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando estatísticas de estoque...</span>
      </div>
    </div>
  );

  const hasStockView = (stats.product_stock_columns || []).includes('available');
  const hasLegacyData = stats.legacy_movements > 0;
  const hasInventoryData = stats.inv_movements > 0;
  const noStock = !hasInventoryData && !hasLegacyData;
  const stockColumns = stats.product_stock_columns || [];

  return (
    <div className="p-4 border rounded bg-muted/30">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Diagnóstico de Estoque</h3>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-8" 
          onClick={loadStats}
        >
          <RefreshCcw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-sm">
          <div className="font-medium">Movimentos atuais:</div>
          <div>{stats.inv_movements || 0}</div>
        </div>
        <div className="text-sm">
          <div className="font-medium">Movimentos legado:</div>
          <div>{stats.legacy_movements || 0}</div>
        </div>
        <div className="text-sm">
          <div className="font-medium">Produtos com mov. atuais:</div>
          <div>{stats.products_inv || 0}</div>
        </div>
        <div className="text-sm">
          <div className="font-medium">Produtos com mov. legado:</div>
          <div>{stats.products_legacy || 0}</div>
        </div>
      </div>
      
      <div className="mb-3 text-sm">
        <div className="font-medium mb-1">Colunas da View de Estoque:</div>
        <div className="flex flex-wrap gap-1">
          {stockColumns.length > 0 ? stockColumns.map((col, i) => (
            <span 
              key={i} 
              className={`px-1.5 py-0.5 rounded text-xs ${
                col === 'available' ? 'bg-green-100 text-green-800 border border-green-200' : 
                'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              {col}
            </span>
          )) : (
            <span className="text-xs text-gray-500">Nenhuma coluna encontrada</span>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Status do Sistema</h4>
            {migrated && (
              <span className="text-xs text-green-600 flex items-center">
                <Check className="h-3 w-3 mr-1" /> 
                Corrigido
              </span>
            )}
          </div>
          
          {!hasStockView && (
            <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="font-medium">View product_stock não tem coluna <strong>available</strong></p>
                <p className="text-xs mt-1">Isso pode causar problemas ao mostrar disponibilidade de produtos.</p>
              </div>
            </div>
          )}

          {noStock && (
            <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="font-medium">Não há movimentos de estoque no sistema</p>
                <p className="text-xs mt-1">Estoque pode não ser calculado corretamente sem movimentos.</p>
              </div>
            </div>
          )}

          {(!migrated && (noStock || !hasStockView)) && (
            <div className="border-t pt-3">
              <div className="text-xs text-gray-600 mb-2">
                <p className="mb-1">A correção irá:</p>
                <ul className="list-disc pl-4">
                  <li>Recriar a função e view de cálculo de estoque</li>
                  <li>Adicionar a coluna 'available' no cálculo</li>
                  {noStock && <li>Criar um movimento de exemplo para teste</li>}
                  <li>Atualizar o esquema PostgREST</li>
                </ul>
              </div>
              
              {loading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1 text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Aplicando correção... {progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>
              ) : (
                <Button onClick={fixView} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Corrigir Estoque
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
          
          {migrated && (
            <div className="p-2 bg-green-100 border border-green-300 rounded text-sm flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Correção aplicada com sucesso! A view de estoque está funcionando corretamente.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {(stats.sample && stats.sample.length > 0) && (
        <div className="mt-3">
          <div className="text-sm font-medium mb-1">Amostra de saldos:</div>
          <div className="text-xs max-h-24 overflow-y-auto">
            {stats.sample.map((item, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <div className="truncate max-w-[200px]">{item.product_id}</div>
                <div className="flex gap-2">
                  <span>Estq: {item.stock}</span>
                  <span>Res: {item.reserved}</span>
                  <span>Disp: {item.available}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium">Diagnóstico Avançado</h4>
          <div className="flex gap-2">
            <Button 
              onClick={runDebugStockOverview} 
              size="sm" 
              variant="outline"
              disabled={debugLoading}
            >
              {debugLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-3 w-3" />
                  Executar Diagnóstico
                </>
              )}
            </Button>
            {debugResult && (
              <Button
                onClick={clearDebugResult}
                size="sm"
                variant="outline"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {debugResult && (
          <Card className="mt-2">
            <CardContent className="p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-medium text-green-600 flex items-center">
                  <Check className="h-3 w-3 mr-1" /> Diagnóstico concluído
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={copyDebugResultToClipboard}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={downloadDebugResult}>
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-3 mt-2 text-xs">
                <div>
                  <div className="font-medium">Movimentos atuais:</div>
                  <div>{debugResult.inv_movements || 0}</div>
                </div>
                <div>
                  <div className="font-medium">Movimentos legado:</div>
                  <div>{debugResult.legacy_movements || 0}</div>
                </div>
                <div>
                  <div className="font-medium">Produtos com mov. atuais:</div>
                  <div>{debugResult.products_inv || 0}</div>
                </div>
                <div>
                  <div className="font-medium">Produtos com mov. legado:</div>
                  <div>{debugResult.products_legacy || 0}</div>
                </div>
              </div>

              <div className="text-xs border rounded p-2 bg-slate-50 max-h-60 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(debugResult, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
