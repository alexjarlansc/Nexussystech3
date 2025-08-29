import React, { useState, useEffect, useMemo, useRef } from "react";
import debounce from "lodash.debounce";
// Importe fuse.js para fuzzy search
import Fuse from "fuse.js";

import type { Client } from "@/types";

// Props do componente
interface ClientSearchProps {
  clients: Client[];
  onSelect: (client: Client) => void;
}

const fuseOptions = {
  keys: ["name", "taxid", "email"],
  threshold: 0.3, // tolerância a erros de digitação
};

export const ClientSearch: React.FC<ClientSearchProps> = ({ clients, onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  // Filtros removidos (não há mais filtro de data)

  // Não há mais filtro de data
  const filteredClients = clients;

  // Fuzzy search com debounce
  const doSearch = useMemo(() => debounce((q: string) => {
    if (!q) {
      setResults([]);
      return;
    }
    const fuse = new Fuse(filteredClients, fuseOptions);
    setResults(fuse.search(q).map(r => r.item));
  }, 300), [filteredClients]);

  useEffect(() => {
    doSearch(query);
    return () => { doSearch.cancel(); };
  }, [query, doSearch]);

  // Seleciona automaticamente o primeiro cliente encontrado se só houver um resultado
  useEffect(() => {
    if (results.length === 1) {
      onSelect(results[0]);
    }
  }, [results, onSelect]);

  // Destaque visual do termo buscado
  const highlight = (text: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  // Novo estado para controlar se sugestões devem aparecer
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quando query muda, sempre mostra sugestões
  useEffect(() => {
    if (hasSelected) {
      setShowSuggestions(false);
      return;
    }
    if (query) setShowSuggestions(true);
    else setShowSuggestions(false);
  }, [query, hasSelected]);

  // Função para selecionar cliente, preencher input e ocultar sugestões imediatamente
  const handleSelect = (client: Client) => {
    setHasSelected(true);
    setShowSuggestions(false);
    setQuery(client.name);
    setTimeout(() => {
      onSelect(client);
      inputRef.current?.blur();
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
          value={query}
          onChange={e => { setQuery(e.target.value); setHasSelected(false); }}
          onFocus={() => { if (query && !hasSelected) setShowSuggestions(true); }}
          className="border rounded px-2 py-1 w-full"
        />
      </div>
      {/* Resultados em tempo real */}
      {results.length > 0 && showSuggestions && (
        <ul className="border rounded bg-white max-h-60 overflow-auto">
          {results.map(client => (
            <li
              key={client.id}
              className="p-2 hover:bg-blue-100 cursor-pointer"
              onMouseDown={e => { e.preventDefault(); handleSelect(client); }}
            >
              <div><b>{highlight(client.name)}</b></div>
              <div className="text-xs text-gray-500">{highlight(client.taxid || "")} | {highlight(client.email || "")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
