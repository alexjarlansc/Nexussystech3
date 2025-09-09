import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StorageKeys } from '@/utils/storage';
import Barcode from 'react-barcode';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Product = { id: string; name?: string; code?: string; price?: number | null };

type LabelType = 'sale' | 'simple';

function PriceDisplay({ price }: { price?: number }){
  if (price == null) return null;
  return <div className="text-2xl font-bold">R${price.toFixed(2).replace('.', ',')}</div>;
}

export default function ProductLabels(){
  const { company } = useAuth();
  const [localCompany, setLocalCompany] = useState<Record<string, unknown> | null>(null);
  const [productLoaded, setProductLoaded] = useState(false);
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(StorageKeys.company);
      if (raw) setLocalCompany(JSON.parse(raw));
    } catch(_) { /* ignore */ }
  },[]);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [priceInput, setPriceInput] = useState<string>('');

  function formatCurrencyInput(value: string){
    // Remove non digits
    let digits = value.replace(/[^0-9]/g, '');
    if (digits.length === 0) return '';
    // Ensure at least 3 chars for cents
    if (digits.length === 1) digits = '0' + digits;
    if (digits.length === 2) digits = '0' + digits;
    const cents = digits.slice(-2);
    let integer = digits.slice(0, -2);
    integer = integer.replace(/^0+/, '') || '0';
    // add thousands
    integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${integer},${cents}`;
  }
  const [type, setType] = useState<LabelType>('sale');

  // Autocomplete
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const previewRef = useRef<HTMLDivElement | null>(null);

  function selectSuggestion(p: Product){
    setCode(p.code || '');
    setDescription(p.name || '');
  setPrice(p.price != null ? Number(p.price) : undefined);
  setPriceInput(p.price != null ? `R$ ${Number(p.price).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '');
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setProductLoaded(true);
  }

  // se o usuário alterar o código ou descrição manualmente, resetar productLoaded
  useEffect(()=>{
    if (!code && !description) setProductLoaded(false);
  },[code, description]);

  function printLabel(){
    try {
      const previewEl = previewRef.current;
      if (!previewEl) {
        window.print();
        return;
      }
      // try to extract barcode svg or canvas and serialize it; build a minimal HTML
      let barcodeHtml = '';
      const svg = previewEl.querySelector('svg');
      if (svg && svg.outerHTML) {
        barcodeHtml = svg.outerHTML;
      } else {
        const canvas = previewEl.querySelector('canvas');
        if (canvas && (canvas as HTMLCanvasElement).toDataURL) {
          try { barcodeHtml = `<img src="${(canvas as HTMLCanvasElement).toDataURL()}"/>`; } catch(e) { barcodeHtml = ''; }
        }
      }
  // extract company logo if present
  const logoImg = previewEl.querySelector('img');
  const logoSrc = logoImg && (logoImg as HTMLImageElement).src ? (logoImg as HTMLImageElement).src : '';

      const descText = previewEl.querySelector('.font-bold')?.textContent || '';
      const priceText = previewEl.querySelector('.font-extrabold')?.textContent || previewEl.querySelector('.text-4xl')?.textContent || '';

  // Print layout: fixed width/height to match preview, larger logo moved closer to corner
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Imprimir etiqueta</title><style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; padding:10px;} .label{border:1px solid #ddd; padding:8px; width:420px; height:200px; box-sizing:border-box; position:relative; background:#fff;} .desc{font-weight:700; font-size:16px; margin-bottom:8px;} .price{font-weight:800; font-size:32px; text-align:right} .barcode{margin-top:6px} .logo{position:absolute; right:6px; bottom:6px; width:140px; height:80px;} .logo img{width:100%; height:100%; object-fit:contain; background:#fff; border-radius:3px; padding:2px;}</style></head><body><div class="label"><div class="desc">${descText}</div><div class="barcode">${barcodeHtml}</div><div class="price">${priceText}</div>${logoSrc?`<div class="logo"><img src="${logoSrc}" alt="Logo"/></div>`:''}</div></body></html>`;

      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) { window.print(); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      // Wait for resources to render, then print
      w.focus();
  setTimeout(()=>{
        w.print();
        // Optionally close window after printing
        // w.close();
      }, 800);
    } catch (err) {
      // fallback
      window.print();
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2">Etiquetas / Códigos</h2>
      <p className="text-sm text-muted-foreground mb-4">Geração de códigos de barras e QR. Escolha o tipo de etiqueta e preencha os dados do produto.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground">Tipo de etiqueta</label>
          <Select value={type} onValueChange={(v)=>setType(v as LabelType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">Venda (com preço)</SelectItem>
              <SelectItem value="simple">Simples (descrição + código)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Código de barras</label>
          <Input value={code} onChange={e=>setCode(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Descrição</label>
          <Input value={description} onChange={e=>setDescription(e.target.value)} />
        </div>
      </div>

      <div className="mb-4 relative">
        <label className="text-xs text-muted-foreground">Buscar produto (nome ou código)</label>
        <Input
          value={query}
          onChange={e=>{
          const v = e.target.value;
          setQuery(v);
          setShowSuggestions(true);
          setSelectedIndex(-1);
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(async ()=>{
            const s = v.trim();
            if (!s) { setSuggestions([]); return; }
            // Buscar no supabase: name ou code
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any).from('products')
              .select('id,name,code,price').or(`name.ilike.%${s}%,code.ilike.%${s}%`).limit(10);
            if (!error && data) setSuggestions(data as Product[]);
          }, 300) as unknown as number;

        }} onFocus={()=>setShowSuggestions(true)} onKeyDown={(e)=>{
          if (!showSuggestions) return;
          if (e.key === 'ArrowDown'){
            e.preventDefault();
            setSelectedIndex(i=>Math.min(i+1, suggestions.length-1));
          } else if (e.key === 'ArrowUp'){
            e.preventDefault();
            setSelectedIndex(i=>Math.max(i-1, 0));
          } else if (e.key === 'Enter'){
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]){
              const p = suggestions[selectedIndex];
              selectSuggestion(p);
            }
          } else if (e.key === 'Escape'){
            setShowSuggestions(false);
            setSelectedIndex(-1);
          }
        }} />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 bg-white border w-full mt-1 max-h-60 overflow-auto">
            {suggestions.map((p, idx)=> (
              <div
                key={p.id}
                className={cn('p-2 cursor-pointer', selectedIndex === idx ? 'bg-muted' : 'hover:bg-muted')}
                onMouseDown={()=>{
                  // onMouseDown para evitar blur antes do click
                  selectSuggestion(p);
                }}
                onClick={()=>selectSuggestion(p)}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.code} {p.price != null ? ` - R$ ${Number(p.price).toFixed(2).replace('.',',')}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {type === 'sale' && (
        <div className="mb-4">
          <label className="text-xs text-muted-foreground">Preço</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</div>
                <Input
                  className="pl-10"
                  value={priceInput}
                  onChange={e=>{
                    const v = e.target.value;
                    // accept digits only and format
                    const formatted = formatCurrencyInput(v);
                    setPriceInput(formatted);
                    // parse numeric value
                    const numeric = parseFloat(formatted.replace(/[^0-9]/g, '').replace(/(\d+)(\d{2})$/, '$1.$2'));
                    setPrice(Number.isFinite(numeric) ? numeric : undefined);
                  }}
                  onBlur={()=>{
                    if (price != null){
                      setPriceInput(`R$ ${price.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
                    } else {
                      setPriceInput('');
                    }
                  }}
                />
              </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Button size="sm" onClick={printLabel}>Imprimir</Button>
        <Button size="sm" variant="outline" onClick={()=>{navigator.clipboard?.writeText(code);}}>Copiar Código</Button>
      </div>

  <div ref={previewRef} className="border p-4 inline-block bg-white" style={{width:420}}>
        <div style={{display:'flex', flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between'}}>
          <div style={{flex:1, paddingRight:12}}>
            <div className="font-bold text-lg leading-tight" style={{maxWidth:300, display:'block'}}>{description}</div>
            <div style={{marginTop:8}}>
              {code ? (
                (()=>{
                  const digits = (code || '').toString().replace(/[^0-9]/g, '');
                  const isEan13 = digits.length === 13;
                  const fmt = isEan13 ? 'EAN13' : 'CODE128';
                  const value = isEan13 ? digits : code;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return <Barcode value={value} format={fmt as any} width={1.4} height={52} displayValue={true} />
                })()
              ) : (
                <div className="text-xs text-muted-foreground">Código de barras não informado</div>
              )}
            </div>
          </div>
          {type === 'sale' && (
            <div style={{minWidth:140, display:'flex', alignItems:'flex-start', justifyContent:'flex-end'}}>
              <div style={{textAlign:'right'}}>
                <div className="text-sm text-muted-foreground">Valor</div>
                <div className="text-4xl font-extrabold" style={{lineHeight:1}}>{price != null ? `R$ ${price.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : ''}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{position:'relative'}}>
          {/* Logo da empresa no canto inferior direito do preview, se existir */}
          { productLoaded && (company?.logo_url || (localCompany && localCompany.logoDataUrl)) && (
            <img src={company?.logo_url || String(localCompany?.logoDataUrl)} alt={company?.name || 'Logo'} style={{position:'absolute', right:6, bottom:6, width:140, height:80, objectFit:'contain', borderRadius:3, background:'#fff', padding:3}} />
          )}
        </div>
      </div>
    </Card>
  );
}
