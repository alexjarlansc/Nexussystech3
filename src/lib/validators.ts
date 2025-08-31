// Utilitários de validação e formatação de documentos brasileiros
// Fonte dos algoritmos: regras públicas conhecidas para CPF/CNPJ (implementação própria)

export function onlyDigits(v:string){ return (v||'').replace(/\D+/g,''); }

export function validateCPF(cpfRaw:string): boolean {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0; for (let i=0;i<9;i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  sum = 0; for (let i=0;i<10;i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d1 === parseInt(cpf[9]) && d2 === parseInt(cpf[10]);
}

export function validateCNPJ(cnpjRaw:string): boolean {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len:number) => {
  const numbers = cnpj.substring(0, len);
  let pos = len - 7; let sum = 0;
    for (let i = len; i >= 1; i--) { sum += parseInt(numbers[len - i]) * pos--; if (pos < 2) pos = 9; }
  const result = 11 - (sum % 11); return result > 9 ? 0 : result;
  };
  const d1 = calc(12); const d2 = calc(13);
  return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}

export function validateTaxId(doc:string): { ok:boolean; type?:'CPF'|'CNPJ'; message?:string } {
  const digits = onlyDigits(doc);
  if (!digits) return { ok:true }; // opcional
  if (digits.length <= 11){
    const ok = validateCPF(digits);
    return ok? { ok:true, type:'CPF' } : { ok:false, message:'CPF inválido' };
  } else {
    const ok = validateCNPJ(digits);
    return ok? { ok:true, type:'CNPJ' } : { ok:false, message:'CNPJ inválido' };
  }
}

export function formatCPF(cpfRaw:string){ const d = onlyDigits(cpfRaw).slice(0,11); if(d.length<=3) return d; if(d.length<=6) return d.replace(/(\d{3})(\d+)/,'$1.$2'); if(d.length<=9) return d.replace(/(\d{3})(\d{3})(\d+)/,'$1.$2.$3'); return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, '$1.$2.$3-$4'); }
export function formatCNPJ(cnpjRaw:string){ const d = onlyDigits(cnpjRaw).slice(0,14); return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, '$1.$2.$3/$4-$5'); }
export function formatTaxId(doc:string){ const digits = onlyDigits(doc); if (digits.length>11) return formatCNPJ(doc); return formatCPF(doc); }

export function validateCEP(raw:string){ const d = onlyDigits(raw); return d.length===0 || d.length===8; }
export function formatCEP(raw:string){ const d = onlyDigits(raw).slice(0,8); if(d.length<=5) return d; return d.replace(/(\d{5})(\d{0,3}).*/, '$1-$2'); }
