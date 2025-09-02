import React, { useMemo, useState } from 'react';
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface ClientPickerProps {
  clients: Client[];
  value?: string | null; // client id
  onSelect: (client: Client) => void;
  onClear?: () => void;
  buttonClassName?: string;
}

function normalize(v: string){
  return (v||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'') // remove acentos
    .toLowerCase();
}

// Versão simplificada para busca: mantém apenas letras, números e espaços únicos
function normalizeSearch(v: string){
  return normalize(v)
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ') // colapsa
    .trim();
}

export const ClientPicker: React.FC<ClientPickerProps> = ({ clients, value, onSelect, onClear, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(()=> clients.find(c=>c.id===value) || null,[clients,value]);

  // Normalização e colapso de espaços para suportar busca por nome completo
  const qNorm = normalizeSearch(query);
  const qDigits = query.replace(/\D/g,'');
  // Simplificação: sempre permitimos substring para qualquer tamanho >0
  const allowNameSubstring = true;
  const allowDigitsSubstring = qDigits.length >= 4;
  const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];

  const filtered = useMemo(()=>{
    if(!qNorm && !qDigits) return clients.slice(0,100);
    const out: Client[] = [];
    const searchFlat = qNorm.replace(/\s+/g,'');
    for(const c of clients){
      const fullName = c.name||'';
      const fullNameNorm = normalizeSearch(fullName);
      const nameFlat = fullNameNorm.replace(/\s+/g,'');
      let nameOk = tokens.length ? tokens.every(t => fullNameNorm.includes(t)) : false;
      // Fallback: usuário digitou nome completo contínuo (comparação sem espaços)
      if(!nameOk && searchFlat.length>3 && nameFlat.includes(searchFlat)) nameOk = true;
      const digits = (c.taxid||'').replace(/\D/g,'');
      const taxOk = qDigits ? (allowDigitsSubstring? digits.includes(qDigits): digits.startsWith(qDigits)) : false;
      if(nameOk || taxOk) out.push(c);
      if(out.length>=200) break;
    }
    if(out.length===0 && qNorm.length>0){
      // DEBUG: log primeiros 5 nomes normalizados para investigação em dev tools
      // eslint-disable-next-line no-console
      console.debug('[ClientPicker][debug] query sem match', { qNorm, tokens, sample: clients.slice(0,5).map(c=> normalizeSearch(c.name||'')) });
    }
    out.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    return out;
  },[clients,qNorm,qDigits,allowDigitsSubstring,tokens]);

  const highlight = (text: string) => {
    if(!tokens.length) return text;
    const normText = normalizeSearch(text);
    let bestPos = -1; let bestLen = 0;
    const pFull = qNorm.length? normText.indexOf(qNorm): -1;
    if(pFull!==-1){ bestPos = pFull; bestLen = qNorm.length; }
    if(bestPos===-1){
      for(const t of tokens){
        const p = normText.indexOf(t);
        if(p!==-1 && (bestPos===-1 || p < bestPos)){ bestPos = p; bestLen = t.length; }
      }
    }
    if(bestPos===-1) return text;
    // Para mapear índice no texto original, reconstruímos procurando case-insensitive
    const lowerOriginal = normalizeSearch(text);
    const before = lowerOriginal.slice(0,bestPos);
    const target = lowerOriginal.slice(bestPos,bestPos+bestLen);
    // Usar comprimento para fatiar string original aproximando
    const origIndex = before.length; // como removemos chars especiais, pode divergir, mas ainda oferece marca simples
    return <>{text.slice(0,origIndex)}<mark>{text.slice(origIndex,origIndex+bestLen)}</mark>{text.slice(origIndex+bestLen)}</>;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className={cn('w-full justify-start', buttonClassName)} onClick={()=>{setQuery(''); setOpen(true);}}>
          {selected ? (
            <div className="flex flex-col items-start text-left">
              <span className="font-medium text-sm leading-tight truncate max-w-full">{selected.name}</span>
              <span className="text-[11px] text-muted-foreground">{selected.taxid || 'Sem documento'}</span>
            </div>
          ): <span className="text-sm text-muted-foreground">Selecionar Cliente</span>}
        </Button>
        {selected && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={()=> { onClear? onClear(): onSelect(selected); /* fallback mantém comportamento */ }}
            title="Limpar seleção"
          >✕</Button>
        )}
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite nome ou CPF/CNPJ" value={query} onValueChange={setQuery} autoFocus />
        <CommandList>
          <CommandEmpty>Nenhum resultado</CommandEmpty>
          <CommandGroup heading={filtered.length? 'Resultados':''}>
            {filtered.map(c=> (
              <CommandItem key={c.id} value={c.id} onSelect={()=>{ onSelect(c); setOpen(false); }} className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium leading-tight">{highlight(c.name)}</span>
                <span className="text-[11px] text-muted-foreground">{c.taxid || 'Sem documento'}{c.email? ' • '+c.email: ''}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};
