/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';

interface ProductRow { id:string; code?:string|null; name?:string|null; sale_price?:any; }
interface Preset { id:string; name:string; label_width_mm:number; label_height_mm:number; font_scale:number; price_source:string; manual_price?:string|null; include_qr:boolean; layout:string; columns:number; }
interface Job { id:string; created_at:string; total_labels:number; preset_snapshot:any; params:any; }

export default function ErpProductLabels(){
  const [tab,setTab]=useState<'select'|'history'|'presets'>('select');
  const [products,setProducts]=useState<ProductRow[]>([]); const [search,setSearch]=useState(''); const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [presets,setPresets]=useState<Preset[]>([]); const [jobs,setJobs]=useState<Job[]>([]);
  const [presetId,setPresetId]=useState<string|undefined>();
  const [showPresetEditor,setShowPresetEditor]=useState(false);
  const [presetForm,setPresetForm]=useState<Partial<Preset>>({ name:'Padrão 80x40', label_width_mm:80, label_height_mm:40, font_scale:1, price_source:'sale_price', include_qr:false, layout:'single', columns:1 });
  const [previewHtml,setPreviewHtml]=useState<string>(''); const [showPreview,setShowPreview]=useState(false);

  // Carregar produtos
  useEffect(()=>{(async()=>{ setLoading(true); try { let q=(supabase as any).from('products').select('id,code,name,sale_price').order('name').limit(300); if(search) q=q.ilike('name','%'+search+'%'); const { data, error } = await q; if(error) throw error; setProducts(data||[]);} catch(e:any){ toast.error(e.message);} finally{ setLoading(false);} })();},[search]);
  // Carrega presets & history
  const loadMeta = useCallback(async()=>{ try { const { data:pr } = await (supabase as any).from('label_print_presets').select('*').order('created_at',{ascending:false}); setPresets(pr||[]); const { data:jb } = await (supabase as any).from('label_print_jobs').select('*').order('created_at',{ascending:false}).limit(50); setJobs(jb||[]);} catch{ /* ignore */ } },[]);
  useEffect(()=>{ loadMeta(); },[loadMeta]);

  function toggle(p:ProductRow){ setSelected(s=>{ const n={...s}; if(n[p.id]) delete n[p.id]; else n[p.id]=1; return n;}); }
  function adjustQty(id:string,delta:number){ setSelected(s=>{ const q=(s[id]||0)+delta; const n={...s}; if(q<=0) delete n[id]; else n[id]=q; return n;}); }
  const selectedProducts = products.filter(p=> selected[p.id]);
  const activePreset = presets.find(p=>p.id===presetId) || (presetId? undefined : undefined);
  const effectivePreset: any = { ...presetForm, ...(activePreset||{}) };

  function buildHtml(preset: any){
    const { label_width_mm:w, label_height_mm:h, font_scale:fs, price_source, manual_price, include_qr, layout, columns } = preset;
    const mmPx=(mm:number)=>mm*3.78; const wPx=mmPx(w); const hPx=mmPx(h);
    const priceFmt=(v:number)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const items:string[]=[];
    selectedProducts.forEach(prod=>{
      const qty=selected[prod.id];
      const priceValue = price_source==='manual'? manual_price : (prod.sale_price!=null? priceFmt(Number(prod.sale_price)):'');
      const code = prod.code || prod.id.replace(/-/g,'').slice(0,12).padEnd(12,'0');
      for(let i=0;i<qty;i++){
        items.push(`<div class="lbl"><div class="top"><div class="name">${(prod.name||'').toUpperCase()}</div><div class="price">${priceValue}</div></div><div class="code">${code}</div><div class="barcode"><img src="https://api-bwipjs.metafloor.com/?bcid=ean13&text=${code}&scale=2&includetext=0" /></div>${ include_qr? `<div class='qr'><img src='https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(code)}' /></div>`:''}</div>`);
      }
    });
    const sheetCss = layout==='sheet'? `.sheet{display:grid;grid-template-columns:repeat(${columns},${wPx}px);gap:4px;}` : '.sheet{display:flex;flex-wrap:wrap;gap:4px;}';
    const css=`@page{size:${w}mm ${h}mm;margin:2mm;}body{font-family:Arial,sans-serif;} .lbl{width:${wPx}px;height:${hPx}px;border:1px solid #000;box-sizing:border-box;padding:4px 6px;display:flex;flex-direction:column;justify-content:space-between;} .name{font-size:${12*fs}px;font-weight:600;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .price{font-size:${24*fs}px;font-weight:700;text-align:right;} .code{font-size:${10*fs}px;letter-spacing:1px;} .barcode img{height:32px;max-width:100%;object-fit:contain;} .qr img{height:60px;} ${sheetCss}`;
    return `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Etiquetas</title><style>${css}</style></head><body onload="window.print()"><div class='sheet'>${items.join('')}</div></body></html>`;
  }

  async function savePreset(){
    try {
      if(!presetForm.name) { toast.warning('Nome obrigatório'); return; }
      const payload = { name:presetForm.name, label_width_mm:presetForm.label_width_mm, label_height_mm:presetForm.label_height_mm, font_scale:presetForm.font_scale, price_source:presetForm.price_source, manual_price:presetForm.manual_price, include_qr:presetForm.include_qr, layout:presetForm.layout, columns:presetForm.columns };
      const company_id = await fetchCompanyId(); if(!company_id) { toast.error('Empresa não encontrada'); return; }
      const { error } = await (supabase as any).from('label_print_presets').insert([{ ...payload, company_id }]);
      if(error) throw error; toast.success('Preset salvo'); setShowPresetEditor(false); loadMeta();
    } catch(e:any){ toast.error(e.message); }
  }

  async function fetchCompanyId(){
    const { data, error } = await (supabase as any).from('profiles').select('company_id').limit(1).maybeSingle();
    if(error) return null; return data?.company_id;
  }

  async function recordJob(html:string){
    try {
      const company_id = await fetchCompanyId(); if(!company_id) return;
      const total = Object.values(selected).reduce((a,b)=>a+b,0);
      const presetSnapshot = activePreset || presetForm;
      const params = { selected, presetId };
      const { data: job, error } = await (supabase as any).from('label_print_jobs').insert([{ company_id, total_labels: total, preset_snapshot: presetSnapshot, params }]).select('id').single();
      if(error) throw error;
      const rows:any[]=[]; selectedProducts.forEach(p=>{ rows.push({ job_id: job.id, product_id: p.id, qty: selected[p.id], price: p.sale_price? Number(p.sale_price):null, code: p.code, name: p.name }); });
      if(rows.length){ await (supabase as any).from('label_print_job_items').insert(rows); }
      loadMeta();
    } catch{ /* ignore */ }
  }

  function preview(){
    if(!selectedProducts.length){ toast.warning('Selecione produtos'); return; }
    const html = buildHtml(effectivePreset);
    setPreviewHtml(html); setShowPreview(true);
  }
  function printNow(){
    if(!previewHtml) return; const w = window.open('','_blank','width=900,height=700'); if(w){ w.document.write(previewHtml); w.document.close(); recordJob(previewHtml);} setShowPreview(false);
  }

  return <Card className="p-6 space-y-5">
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <h2 className="text-xl font-semibold">Etiquetas / Códigos</h2>
        <p className="text-sm text-muted-foreground">Gerar, salvar presets e histórico de impressões.</p>
      </div>
      <div className="flex gap-2 ml-auto items-center text-xs">
        <Input placeholder="Buscar" value={search} onChange={e=>setSearch(e.target.value)} className="h-8 w-44" />
        <select value={tab} onChange={e=>setTab(e.target.value as any)} className="h-8 border rounded px-2">
          <option value="select">Selecionar</option>
          <option value="presets">Presets</option>
          <option value="history">Histórico</option>
        </select>
        {tab==='select' && <Button size="sm" onClick={preview} disabled={!Object.keys(selected).length}>Pré-visualizar ({Object.values(selected).reduce((a,b)=>a+b,0)})</Button>}
        {tab==='presets' && <Button size="sm" onClick={()=>{setPresetForm({ name:'Novo Preset', label_width_mm:80, label_height_mm:40, font_scale:1, price_source:'sale_price', include_qr:false, layout:'single', columns:1 }); setShowPresetEditor(true);}}>Novo Preset</Button>}
      </div>
    </div>
    {tab==='select' && <div className="border rounded overflow-hidden">
      <table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-2 py-1">Sel</th><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1 text-right">Preço</th><th className="px-2 py-1 text-center">Qtd</th></tr></thead><tbody>
        {loading && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Carregando...</td></tr>}
        {!loading && products.map(p=>{ const q=selected[p.id]||0; return <tr key={p.id} className="border-t hover:bg-muted/40"><td className="px-2 py-1"><input type="checkbox" checked={!!q} onChange={()=>toggle(p)} /></td><td className="px-2 py-1 font-mono text-[10px]">{p.code||'-'}</td><td className="px-2 py-1 truncate max-w-[260px]" title={p.name||''}>{p.name}</td><td className="px-2 py-1 text-right">{p.sale_price!=null? Number(p.sale_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-'}</td><td className="px-2 py-1 text-center">{q? <div className="inline-flex items-center gap-1"><button className="px-2 border rounded" onClick={()=>adjustQty(p.id,-1)}>-</button><input value={q} onChange={e=>{const v=Number(e.target.value)||0; setSelected(s=>({...s,[p.id]:v}));}} className="w-10 h-6 text-center border rounded" /><button className="px-2 border rounded" onClick={()=>adjustQty(p.id,1)}>+</button></div>: <button className="text-primary underline" onClick={()=>adjustQty(p.id,1)}>Add</button>}</td></tr>; })}
        {!loading && !products.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum produto</td></tr>}
      </tbody></table>
    </div>}
    {tab==='presets' && <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map(p=> <div key={p.id} className="border rounded p-3 text-xs space-y-1 bg-white">
          <div className="font-medium flex justify-between items-center"><span>{p.name}</span><Button size="sm" variant="outline" onClick={()=>{setPresetId(p.id); toast.success('Preset aplicado'); setTab('select');}}>Usar</Button></div>
          <div>{p.label_width_mm}x{p.label_height_mm}mm • fonte {p.font_scale}</div>
          <div>{p.price_source==='manual'? 'Preço fixo '+(p.manual_price||''): 'Preço produto'}</div>
          <div>{p.include_qr? 'QR incluso':''}</div>
        </div>)}
        {!presets.length && <div className="text-xs text-muted-foreground">Nenhum preset salvo.</div>}
      </div>
    </div>}
    {tab==='history' && <div className="space-y-3 text-xs">
      {jobs.map(j=> <div key={j.id} className="border p-3 rounded bg-white flex flex-col gap-1">
        <div className="flex justify-between"><span className="font-medium">{new Date(j.created_at).toLocaleString()}</span><span>{j.total_labels} etiquetas</span></div>
        <div className="truncate">Preset: {(j.preset_snapshot?.name)||'-'}</div>
      </div>)}
      {!jobs.length && <div className="text-muted-foreground">Sem histórico.</div>}
    </div>}

    {/* Editor de Preset */}
    {showPresetEditor && <Dialog open={showPresetEditor} onOpenChange={setShowPresetEditor}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo Preset</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 text-xs">
      <label className="space-y-1 col-span-2"><span>Nome</span><Input value={presetForm.name||''} onChange={e=>setPresetForm(f=>({...f,name:e.target.value}))} /></label>
      <label className="space-y-1"><span>Largura (mm)</span><Input type="number" value={presetForm.label_width_mm||0} onChange={e=>setPresetForm(f=>({...f,label_width_mm:Number(e.target.value)||1}))} /></label>
      <label className="space-y-1"><span>Altura (mm)</span><Input type="number" value={presetForm.label_height_mm||0} onChange={e=>setPresetForm(f=>({...f,label_height_mm:Number(e.target.value)||1}))} /></label>
      <label className="space-y-1"><span>Escala Fonte</span><Input type="number" step="0.1" value={presetForm.font_scale||1} onChange={e=>setPresetForm(f=>({...f,font_scale:Number(e.target.value)||1}))} /></label>
      <label className="space-y-1"><span>Layout</span><select className="border rounded h-8 px-2" value={presetForm.layout} onChange={e=>setPresetForm(f=>({...f,layout:e.target.value as any}))}><option value="single">Rolinho</option><option value="sheet">Folha</option></select></label>
      <label className="space-y-1"><span>Colunas</span><Input disabled={presetForm.layout!=='sheet'} type="number" value={presetForm.columns||1} onChange={e=>setPresetForm(f=>({...f,columns:Number(e.target.value)||1}))} /></label>
      <label className="space-y-1"><span>Fonte Preço</span><select className="border rounded h-8 px-2" value={presetForm.price_source} onChange={e=>setPresetForm(f=>({...f,price_source:e.target.value as any}))}><option value="sale_price">Produto</option><option value="manual">Manual</option></select></label>
      <label className="space-y-1"><span>Preço Manual</span><Input disabled={presetForm.price_source!=='manual'} value={presetForm.manual_price||''} onChange={e=>setPresetForm(f=>({...f,manual_price:e.target.value}))} /></label>
      <label className="flex items-center gap-2 col-span-2 mt-2"><input type="checkbox" checked={!!presetForm.include_qr} onChange={e=>setPresetForm(f=>({...f,include_qr:e.target.checked}))} /> Incluir QR code</label>
    </div><DialogFooter><Button size="sm" variant="outline" onClick={()=>setShowPresetEditor(false)}>Cancelar</Button><Button size="sm" onClick={savePreset}>Salvar</Button></DialogFooter></DialogContent></Dialog>}

    {/* Preview */}
    {showPreview && <Dialog open={showPreview} onOpenChange={setShowPreview}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader><div className="border max-h-[65vh] overflow-auto"><iframe title="preview" style={{width:'100%',height:'500px'}} srcDoc={previewHtml} /></div><DialogFooter><Button size="sm" variant="outline" onClick={()=>setShowPreview(false)}>Fechar</Button><Button size="sm" onClick={printNow}>Imprimir</Button></DialogFooter></DialogContent></Dialog>}
  </Card>;
}