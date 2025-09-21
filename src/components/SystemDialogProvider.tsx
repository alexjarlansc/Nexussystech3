import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type SysConfirmDetail = {
  id?: string;
  title?: string;
  message: string;
};

export default function SystemDialogProvider({ children }: { children: React.ReactNode }){
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SysConfirmDetail | null>(null);

  useEffect(()=>{
    function handler(e: Event){
      const ce = e as CustomEvent<SysConfirmDetail>;
      setPending(ce.detail);
      setOpen(true);
    }
    window.addEventListener('system:confirm', handler as EventListener);
    return ()=> window.removeEventListener('system:confirm', handler as EventListener);
  },[]);

  function reply(result: boolean){
    if(pending && pending.id){
      window.dispatchEvent(new CustomEvent('system:confirm:reply', { detail: { id: pending.id, ok: result } }));
    }
    setOpen(false);
    setPending(null);
  }

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.title ?? 'Confirmação'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p>{pending?.message}</p>
          </div>
          <DialogFooter>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={()=>reply(false)}>Cancelar</Button>
              <Button size="sm" variant="default" onClick={()=>reply(true)}>OK</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
