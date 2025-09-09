export function formatCurrencyInput(value:string|number){
  try{
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9-]/g,''))/100;
    return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  } catch { return String(value); }
}

export function parseCurrencyInput(raw:string){
  const only = raw.replace(/[^0-9-]/g,'');
  const num = Number(only)/100;
  return isNaN(num)? 0 : num;
}

export function validateCPF(cpf:string){
  cpf = cpf.replace(/[^0-9]/g,'');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0; for (let i=0;i<9;i++) sum += Number(cpf.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11); if (rev === 10 || rev === 11) rev = 0; if (rev !== Number(cpf.charAt(9))) return false;
  sum = 0; for (let i=0;i<10;i++) sum += Number(cpf.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11); if (rev === 10 || rev === 11) rev = 0; return rev === Number(cpf.charAt(10));
}

export function validateCNPJ(cnpj:string){
  cnpj = cnpj.replace(/[^0-9]/g,'');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (t:number) => {
    let sum = 0; let pos = t - 7; for (let i = t; i >= 1; i--) { sum += Number(cnpj.charAt(t - i)) * pos; pos = pos - 1; if (pos < 2) pos = 9; } const res = sum % 11; return res < 2 ? 0 : 11 - res;
  };
  const v1 = calc(12); if (v1 !== Number(cnpj.charAt(12))) return false; const v2 = calc(13); return v2 === Number(cnpj.charAt(13));
}

export function isValidCnpjCpf(v:string){
  const only = v.replace(/[^0-9]/g,'');
  if (only.length===11) return validateCPF(only);
  if (only.length===14) return validateCNPJ(only);
  return false;
}

export function formatTaxId(v:string){
  const only = v.replace(/[^0-9]/g,'');
  if (!only) return '';
  if (only.length <= 11) {
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_,a,b,c,d)=> `${a}.${b}.${c}${d?'-'+d:''}`);
  }
  return only.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_,a,b,c,d,e)=> `${a}.${b}.${c}/${d}${e?'-'+e:''}`);
}

export function formatPhoneBR(v:string){
  const d = v.replace(/[^0-9]/g,'');
  if (d.length<=10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_,a,b,c)=> a? `(${a}) ${b}${c?'-'+c:''}` : d);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_,a,b,c)=> `(${a}) ${b}${c?'-'+c:''}`);
}
