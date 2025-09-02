import React, { useState, useEffect, useRef } from "react";
import type { Client } from "@/types";

// Props do componente
interface ClientSearchProps {
  clients: Client[];
  onSelect: (client: Client) => void;
}

export const ClientSearch: React.FC<ClientSearchProps> = ({ clients, onSelect }) => {
  const [query, setQuery] = useState("");               // texto digitado definitivo
  const [results, setResults] = useState<Client[]>([]);  // resultados filtrados
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // índice navegação teclado
  const [tempText, setTempText] = useState<string>("");      // texto temporário ao navegar
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Busca: nome (prefixo; se >=3 letras aceita substring) e CPF/CNPJ (prefixo; se >=4 dígitos aceita substring)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Remove acentos para comparação
    const normalizeStr = (str: string = "") => str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    
    // Extrai apenas dígitos para CPF/CNPJ
    const digitsOnly = (str: string = "") => str.replace(/\D/g, '');
    
  const searchTerm = normalizeStr(query);
  const searchDigits = digitsOnly(query);
  const allowNameSubstring = searchTerm.length >= 3;
  const allowDigitsSubstring = searchDigits.length >= 4;
    
    // Filtra clientes por nome ou CPF/CNPJ conforme regras acima
    const matches = clients.filter(client => {
      const nameWords = (client.name || "").split(/\s+/).filter(Boolean);
      const nameMatch = nameWords.some(word => {
        const nw = normalizeStr(word);
        return allowNameSubstring ? nw.includes(searchTerm) : nw.startsWith(searchTerm);
      });
      
      const taxidDigits = digitsOnly(client.taxid || "");
      let taxMatch = false;
      if (searchDigits.length > 0) {
        taxMatch = allowDigitsSubstring ? taxidDigits.includes(searchDigits) : taxidDigits.startsWith(searchDigits);
      }
      
      return nameMatch || taxMatch;
    });
    
    // Ordena: CPF/CNPJ primeiro, depois nome (ordem alfabética)
    matches.sort((a, b) => {
      const aTaxid = digitsOnly(a.taxid || "");
      const bTaxid = digitsOnly(b.taxid || "");
      
  const aTaxStarts = searchDigits && (allowDigitsSubstring ? aTaxid.includes(searchDigits) : aTaxid.startsWith(searchDigits));
  const bTaxStarts = searchDigits && (allowDigitsSubstring ? bTaxid.includes(searchDigits) : bTaxid.startsWith(searchDigits));
  if (aTaxStarts && !bTaxStarts) return -1;
  if (!aTaxStarts && bTaxStarts) return 1;
      
      return (a.name || "").localeCompare(b.name || "");
    });
    
  setResults(matches.slice(0, 50));
  setActiveIndex(-1); // reset navegação em nova busca
  }, [query, clients, onSelect]);

  // Destaque: prefixo ou substring (seguindo regras). Email não recebe highlight.
  const highlight = (text: string, isTaxId = false) => {
    const raw = query.trim();
    if (!raw) return text;
    const lower = raw.toLowerCase();

    // Para CPF/CNPJ usamos só dígitos
    if (isTaxId) {
      const digitsInput = raw.replace(/\D/g, '');
      if (!digitsInput) return text;
      const digitsText = text.replace(/\D/g, '');
      const allowSubstring = digitsInput.length >= 4;
      const pos = allowSubstring ? digitsText.indexOf(digitsInput) : digitsText.startsWith(digitsInput) ? 0 : -1;
      if (pos === -1) return text;
      // Map posição em digitsText para índices no texto original preservando máscara
      let digitCount = 0;
      let start = -1, end = -1;
      for (let i = 0; i < text.length; i++) {
        if (/\d/.test(text[i])) {
          if (digitCount === pos) start = i;
          if (digitCount === pos + digitsInput.length - 1) { end = i; break; }
          digitCount++;
        }
      }
      if (start === -1 || end === -1) return text;
      return <>{text.slice(0,start)}<mark>{text.slice(start,end+1)}</mark>{text.slice(end+1)}</>;
    }

    // Nome: destacar somente se a palavra começa com o prefixo
    const normQuery = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const allowSub = normQuery.length >= 3;
    const words = text.split(/(\s+)/); // preserva espaços
    return words.map((w, idx) => {
      if (/^\s+$/.test(w)) return w; // espaço
      const norm = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      let pos = -1;
      if (allowSub) pos = norm.indexOf(normQuery);
      else if (norm.startsWith(normQuery)) pos = 0;
      if (pos === -1) return w;
      const end = pos + raw.length;
      return <span key={idx}>{w.slice(0,pos)}<mark>{w.slice(pos,end)}</mark>{w.slice(end)}</span>;
    });
  };

  // Função para selecionar cliente
  const handleSelect = (client: Client) => {
    setQuery(client.name);           // confirma texto
    setTempText("");
    setShowSuggestions(false);
    setActiveIndex(-1);
    onSelect(client);
    inputRef.current?.blur();
  };

  // Teclado: setas navegam, Enter seleciona, Esc fecha/limpa
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => {
        const next = results.length === 0 ? -1 : (i + 1) % results.length;
        setTempText(next >= 0 ? results[next].name : "");
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => {
        const next = results.length === 0 ? -1 : (i <= 0 ? results.length - 1 : i - 1);
        setTempText(next >= 0 ? results[next].name : "");
        return next;
      });
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
      setTempText("");
    }
  };

  return (
    <div className="space-y-2 relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por nome, CPF/CNPJ"
          onChange={e => {
            const val = e.target.value;
            setQuery(val);
            setTempText("");
            setShowSuggestions(!!val.trim());
          }}
          onFocus={() => { 
            if (query.trim()) setShowSuggestions(true);
          }}
          onBlur={() => {
            // Delay para permitir clique em sugestão
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          onKeyDown={handleKeyDown}
          value={tempText || query}
          className="border rounded px-2 py-1 w-full"
        />
      </div>
      
      {/* Resultados em tempo real */}
      {results.length > 0 && showSuggestions && (
        <ul ref={listRef} className="border rounded bg-white max-h-60 overflow-auto absolute z-10 w-full shadow-lg">
          {results.map((client, idx) => {
            const active = idx === activeIndex;
            return (
              <li
                key={client.id}
                className={`p-2 cursor-pointer border-b last:border-b-0 ${active ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                onMouseEnter={() => { setActiveIndex(idx); setTempText(client.name); }}
                onMouseLeave={() => { setActiveIndex(-1); setTempText(""); }}
                onMouseDown={e => { e.preventDefault(); handleSelect(client); }}
              >
                <div className="font-medium">{highlight(client.name)}</div>
                <div className="text-xs text-gray-500">
                  {client.taxid ? highlight(client.taxid, true) : 'Sem documento'}
                  {client.email ? ` | ${client.email}` : ''}
                </div>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="p-2 text-xs text-gray-500">Nenhum cliente</li>
          )}
        </ul>
      )}
    </div>
  );
};
