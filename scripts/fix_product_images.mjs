#!/usr/bin/env node
/**
 * Script de correção de imagens de produtos.
 * Ações:
 * 1. Garante existência dos buckets "product-images" e "logos" (ignora se já existem).
 * 2. Varre tabela products buscando image_url.
 *    - Se image_url for signed URL (contém ?token= ou &token=), extrai o path relativo se possível.
 *    - Se for data URL (data:...), opcionalmente envia para bucket (flag --upload-inline) e substitui por path.
 *    - Se for URL pública https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path> converte para somente <path>.
 * 3. Aplica atualização em lote mínima (apenas quando altera valor).
 *
 * Uso:
 *  node scripts/fix_product_images.mjs --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY> [--upload-inline]
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { url: '', key: '', uploadInline: false };
  for(let i=0;i<args.length;i++){
    const a = args[i];
    if(a==='--url') out.url = args[++i]||'';
    else if(a==='--key') out.key = args[++i]||'';
    else if(a==='--upload-inline') out.uploadInline = true;
  }
  if(!out.url||!out.key){
    console.error('Uso: node scripts/fix_product_images.mjs --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY> [--upload-inline]');
    process.exit(1);
  }
  return out;
}

const { url, key, uploadInline } = parseArgs();
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function ensureBucket(name){
  const { data: list } = await supabase.storage.listBuckets();
  if(list && list.some(b=>b.name===name)){
    console.log(`Bucket '${name}' já existe.`); return;
  }
  const { error } = await supabase.storage.createBucket(name, { public: true });
  if(error){
    console.warn(`Falha ao criar bucket ${name}:`, error.message);
  } else console.log(`Bucket '${name}' criado.`);
}

function extractPathFromPublicUrl(u){
  // Ex: https://xyz.supabase.co/storage/v1/object/public/product-images/produtos/uuid/file.png
  const m = u.match(/\/object\/public\/(?:product-images|logos)\/(.+)$/);
  return m? m[1]: null;
}

function isSigned(u){ return /[?&]token=/.test(u); }
function isDataUrl(u){ return /^data:/.test(u); }

async function listProducts(){
  const { data, error } = await supabase.from('products').select('id,image_url').limit(5000);
  if(error) throw error;
  return data || [];
}

async function uploadDataUrl(productId, dataUrl){
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if(!m) throw new Error('Data URL inválida');
  const mime = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64,'base64');
  const ext = mime.includes('png')? 'png': mime.includes('jpeg')? 'jpg': 'bin';
  const path = `produtos/${productId}/main-fix-${Date.now()}.${ext}`;
  const tryBuckets = ['product-images','logos'];
  for(const b of tryBuckets){
    const { data, error } = await supabase.storage.from(b).upload(path, buf, { contentType: mime, upsert: true });
    if(!error){
      return path;
    }
    if(error.message && error.message.toLowerCase().includes('bucket')) continue; // tenta próximo
    throw error;
  }
  // se nenhum bucket aceitar, retorna original data URL para não perder
  return dataUrl;
}

async function run(){
  console.log('Garantindo buckets...');
  await ensureBucket('product-images');
  await ensureBucket('logos');

  console.log('Buscando produtos...');
  const products = await listProducts();
  let updates = 0;
  for(const p of products){
    const orig = p.image_url;
    if(!orig) continue;
    let next = orig;
    if(isDataUrl(orig)){
      if(uploadInline){
        try { next = await uploadDataUrl(p.id, orig); } catch(e){ console.warn('Falha upload inline', p.id, e.message); continue; }
      } else continue; // pula se não vamos subir inline
    } else if(isSigned(orig)){
      // tentar extrair path após último '%2F' ou após bucket/public
      const decoded = decodeURIComponent(orig);
      const publicPath = extractPathFromPublicUrl(decoded);
      if(publicPath) next = publicPath; else {
        // fallback: tentar achar '/produtos/'
        const idx = decoded.lastIndexOf('/produtos/');
        if(idx!==-1) next = decoded.slice(idx+1); // remove primeira barra
      }
    } else if(orig.startsWith('http://') || orig.startsWith('https://')){
      const decoded = decodeURIComponent(orig);
      const publicPath = extractPathFromPublicUrl(decoded);
      if(publicPath) next = publicPath;
    }
    if(next !== orig){
      const { error } = await supabase.from('products').update({ image_url: next }).eq('id', p.id);
      if(!error) { updates++; console.log(`Atualizado produto ${p.id}`); }
      else console.warn('Falha update', p.id, error.message);
    }
  }
  console.log(`Concluído. Atualizações aplicadas: ${updates}`);
}

run().catch(e=>{ console.error('Erro geral', e); process.exit(1); });
