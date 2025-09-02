// debug_stock.mjs - Script para executar diagnósticos de estoque
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Usar as credenciais do Supabase diretamente
const supabaseUrl = "https://zjaqjxqtbwrkhijdlvyo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqYXFqeHF0Yndya2hpamRsdnlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzE4MTAsImV4cCI6MjA3MDUwNzgxMH0.3ShbEcaaAYMt9JTxwKCzw3c6pCCt4Oatdo2FaeYTOkk";

console.log('🔑 Usando credenciais do Supabase');

// Inicializar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugStockOverview() {
  console.log('🔎 Executando diagnóstico de estoque...');
  
  try {
    const { data, error } = await supabase.rpc('debug_stock_overview');
    
    if (error) {
      console.error('❌ Erro ao executar debug_stock_overview:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Diagnóstico concluído com sucesso!');
    
    // Salvar resultado em um arquivo JSON para referência
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `stock_debug_${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`📄 Resultado salvo em ${filename}`);
    
    // Mostrar estatísticas principais
    console.log('\n📊 Estatísticas Principais:');
    console.log(`Movimentos atuais: ${data.inv_movements || 0}`);
    console.log(`Movimentos legado: ${data.legacy_movements || 0}`);
    console.log(`Produtos com movimentos atuais: ${data.products_inv || 0}`);
    console.log(`Produtos com movimentos legado: ${data.products_legacy || 0}`);
    
    // Mostrar colunas da view de estoque
    if (data.product_stock_columns) {
      console.log('\n📋 Colunas na view de estoque:');
      console.log(data.product_stock_columns.join(', '));
    }
    
    // Mostrar amostra de produtos
    if (data.sample && data.sample.length > 0) {
      console.log('\n📦 Amostra de produtos:');
      data.sample.forEach(item => {
        console.log(`Produto: ${item.product_id}, Estoque: ${item.stock}, Reservado: ${item.reserved}, Disponível: ${item.available}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
  }
}

// Executar a função principal
debugStockOverview();
