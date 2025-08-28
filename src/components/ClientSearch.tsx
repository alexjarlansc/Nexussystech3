import React, { useState, useEffect, useMemo } from "react";
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
  keys: ["name", "taxId", "email"],
  threshold: 0.3, // tolerância a erros de digitação
};

export const ClientSearch: React.FC<ClientSearchProps> = ({ clients, onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  // Filtros dinâmicos (ajustados para os campos reais)
  const [filters, setFilters] = useState<{ data: string }>({ data: "" });

  // Filtros dinâmicos
  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      (!filters.data || (c as any).dataCadastro?.startsWith(filters.data))
    );
  }, [clients, filters]);

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

  // Destaque visual do termo buscado
  const highlight = (text: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        />
        {/* Filtro por data de cadastro, se existir */}
        <input
          type="date"
          value={filters.data}
          onChange={e => setFilters(f => ({ ...f, data: e.target.value }))}
        />
      </div>
      {/* Resultados em tempo real */}
      {results.length > 0 && (
        <ul className="border rounded bg-white max-h-60 overflow-auto">
          {results.map(client => (
            <li
              key={client.id}
              className="p-2 hover:bg-blue-100 cursor-pointer"
              onClick={() => onSelect(client)}
            >
              <div><b>{highlight(client.name)}</b></div>
              <div className="text-xs text-gray-500">{highlight(client.taxId || "")} | {highlight(client.email || "")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
