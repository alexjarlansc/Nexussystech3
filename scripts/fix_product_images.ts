/**
 * Script para garantir unicidade de imagens de produtos.
 * Estratégia:
 * 1. Busca produtos com mesma image_url.
 * 2. Para cada ocorrência além da primeira, faz download do arquivo original e reenvia com novo caminho exclusivo,
 *    atualizando o registro.
 * 3. Se download falhar, zera image_url (evita apontar para imagem de outro produto).
 *
 * Executar com: ts-node scripts/fix_product_images.ts (ou ajustar conforme setup).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // precisa de permissões de storage e update

if(!url || !serviceRole){
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

async function main(){
  console.log('Buscando produtos...');
  const { data: products, error } = await supabase.from('products').select('id,image_url');
  if(error){ console.error('Erro carregando produtos', error); process.exit(1); }
  const byUrl: Record<string, string[]> = {};
  for(const p of products||[]){
    if(!p.image_url) continue; byUrl[p.image_url] = byUrl[p.image_url]||[]; byUrl[p.image_url].push(p.id);
  }
  const duplicates = Object.entries(byUrl).filter(([_, ids])=>ids.length>1);
  if(!duplicates.length){ console.log('Nenhuma duplicação encontrada.'); return; }
  console.log('Encontradas duplicações:', duplicates.map(d=>({url:d[0], qtd:d[1].length})));

  for(const [urlRef, ids] of duplicates){
    // manter primeira
    const keep = ids[0];
    const rest = ids.slice(1);
    for(const prodId of rest){
      console.log(`Recriando imagem para produto ${prodId} (base ${urlRef})`);
      try {
        const resp = await fetch(urlRef);
        if(!resp.ok) throw new Error('download status '+resp.status);
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const ext = (blob.type.includes('png')? 'png': blob.type.includes('jpeg')? 'jpg':'bin');
        const rand = Math.random().toString(36).slice(2,8);
        const path = `produtos/${prodId}-${Date.now()}-${rand}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, new File([arrayBuffer], path, { type: blob.type }), { upsert: false });
        if(upErr) throw upErr;
        // tentar signed url
        let finalUrl: string | undefined;
        try {
          const { data: signed } = await supabase.storage.from('product-images').createSignedUrl(path, 60*60*24*30);
          finalUrl = signed?.signedUrl;
        } catch{}
        if(!finalUrl){
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path) as any;
          finalUrl = pub?.publicUrl;
        }
        const { error: updErr } = await supabase.from('products').update({ image_url: finalUrl }).eq('id', prodId);
        if(updErr) throw updErr;
        console.log(' -> nova URL atribuída');
      } catch(err){
        console.warn('Falha ao recriar imagem para', prodId, err);
        const { error: updErr } = await supabase.from('products').update({ image_url: null }).eq('id', prodId);
        if(updErr) console.error('Falha ao limpar image_url', updErr);
      }
    }
  }
  console.log('Concluído.');
}

main();
