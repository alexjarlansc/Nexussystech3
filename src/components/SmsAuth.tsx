import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

export default function SmsAuth() {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    try {
      const p = phone.trim();
      if (!p.startsWith('+')) {
        toast.error('Use formato internacional. Ex.: +5511999999999');
        return;
      }
      if (!firstName.trim()) {
        toast.error('Informe seu nome');
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        phone: p,
        options: {
          channel: 'sms',
          data: { first_name: firstName.trim() },
        },
      });
      if (error) {
        toast.error(error.message || 'Falha ao enviar SMS');
        return;
      }
      setCodeSent(true);
      toast.success('Código enviado por SMS');
    } catch (e) {
      toast.error('Erro inesperado ao enviar SMS');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      if (!otp.trim()) {
        toast.error('Informe o código recebido');
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otp.trim(),
        type: 'sms',
      });
      if (error) {
        toast.error(error.message || 'Código inválido');
        return;
      }
      // Atualiza metadados do usuário com primeiro nome
  try { await supabase.auth.updateUser({ data: { first_name: firstName.trim() } }); } catch (e) { if (import.meta.env.DEV) console.warn('updateUser metadata failed', e); }

      // Garante profile e aplica invite se existir
  try { await (supabase as unknown as { rpc: (name: string) => Promise<unknown> }).rpc('ensure_profile'); } catch (e) { if (import.meta.env.DEV) console.warn('ensure_profile rpc failed', e); }
      if (inviteCode.trim()) {
        // Tenta RPC validate_invite primeiro
        try {
          const rpc = await (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }> }).rpc('validate_invite', { inv_code: inviteCode.trim() });
          const inv = (rpc && (rpc as { data?: unknown }).data && (Array.isArray((rpc as { data?: unknown }).data) ? (rpc as { data?: unknown }).data[0] : (rpc as { data?: unknown }).data)) || null;
          if (!inv) throw new Error('Código de convite inválido ou expirado');
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes?.user?.id;
          if (uid) {
            const upd: Record<string, unknown> = { first_name: firstName.trim() };
            if (inv.role === 'admin') upd.role = 'admin';
            if (inv.company_id) upd.company_id = inv.company_id;
            await supabase.from('profiles').update(upd).eq('user_id', uid);
            await supabase.from('invite_codes').update({ used_by: uid, used_at: new Date().toISOString() }).eq('code', inv.code);
          }
        } catch (e) {
          // fallback simples: ignora se RPC indisponível; o usuário ainda está autenticado
          if (import.meta.env.DEV) console.warn('Falha ao validar convite via RPC', e);
        }
      }
      toast.success('Login por SMS confirmado!');
    } catch (e) {
      toast.error('Erro ao confirmar SMS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sms-phone">Telefone (E.164) *</Label>
        <Input id="sms-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" disabled={codeSent || loading} />
        <p className="text-xs text-muted-foreground mt-1">Ative Phone Auth e configure o provedor SMS no Supabase (Authentication → Providers → Phone).</p>
      </div>
      <div>
        <Label htmlFor="sms-first-name">Nome *</Label>
        <Input id="sms-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Seu nome" disabled={codeSent} />
      </div>
      <div>
        <Label htmlFor="sms-invite">Código de Convite (opcional, obrigatório para Admin)</Label>
        <Input id="sms-invite" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Ex.: ABCD1234" disabled={codeSent} />
      </div>

      {!codeSent ? (
        <Button type="button" className="w-full" onClick={sendOtp} disabled={loading}>
          {loading ? 'Enviando código...' : 'Enviar código por SMS'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="sms-otp">Código recebido por SMS</Label>
            <Input id="sms-otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 dígitos" />
          </div>
          <div className="flex gap-2">
            <Button type="button" className="w-full" onClick={verifyOtp} disabled={loading}>
              {loading ? 'Verificando...' : 'Confirmar código'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setCodeSent(false); setOtp(''); }}>
              Trocar telefone
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
