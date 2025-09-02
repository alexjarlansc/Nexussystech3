import React, { useMemo, useState } from 'react';
import type { Client } from '@/types';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AdvancedClientSelectProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Normaliza texto removendo acentos e lower-case
function norm(v: string) {
  return (v||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
}

export const AdvancedClientSelect: React.FC<AdvancedClientSelectProps> = ({ clients, onSelect, placeholder='Buscar cliente por nome ou CPF/CNPJ', disabled }) => {
  const [query, setQuery] = useState('');
  const qNorm = norm(query.trim());
  const qDigits = query.replace(/\D/g,'');
  const allowNameSubstring = qNorm.length >= 3;
  const allowDigitsSubstring = qDigits.length >= 4;

  const filtered = useMemo(() => {
    if (!qNorm && !qDigits) return clients.slice(0,50);
    const out: Client[] = [];
    for (const c of clients) {
      const taxDigits = (c.taxid||'').replace(/\D/g,'');
      let taxOk = false;
      if (qDigits) taxOk = allowDigitsSubstring ? taxDigits.includes(qDigits) : taxDigits.startsWith(qDigits);
      const words = (c.name||'').split(/\s+/);
      const nameOk = words.some(w => {
        const wn = norm(w);
        return allowNameSubstring ? wn.includes(qNorm) : wn.startsWith(qNorm);
      });
      if (nameOk || taxOk) out.push(c);
      if (out.length>=80) break; // limite
    }
    // ranking simples
    out.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    return out;
  },[clients,qNorm,qDigits,allowNameSubstring,allowDigitsSubstring]);

  const highlight = (text: string) => {
    if (!qNorm) return text;
    const original = text;
    const ntext = norm(text);
    const needle = qNorm;
    let pos = -1;
    if (allowNameSubstring) pos = ntext.indexOf(needle); else pos = ntext.startsWith(needle)?0:-1;
    if (pos===-1) return original;
    return <>{original.slice(0,pos)}<mark>{original.slice(pos,pos+query.trim().length)}</mark>{original.slice(pos+query.trim().length)}</>;
  };

  return (
    <div className={cn('border rounded-md bg-white')}> 
      <Command shouldFilter={false} className="rounded-md">
        <CommandInput
          disabled={disabled}
          value={query}
            onValueChange={(val)=>setQuery(val)}
            placeholder={placeholder}
            className="text-sm"
        />
        <CommandList>
          <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
          <CommandGroup heading={filtered.length? 'Resultados':''}>
            <ScrollArea className="max-h-72">
              {filtered.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => onSelect(c)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium leading-tight">{highlight(c.name)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {(c.taxid||'Sem documento')}{c.email? ' • '+c.email: ''}
                  </span>
                </CommandItem>
              ))}
            </ScrollArea>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
};
