import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type SysConfirmDetail = {
  id?: string;
  title?: string;
  message: string;
  forwardEvent?: string;
  forwardPayload?: unknown;
};
type SysMessageDetail = {
  title?: string;
  message: string;
  durationMs?: number;
};

export default function SystemDialogProvider({ children }: { children: React.ReactNode }){
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SysConfirmDetail | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgPending, setMsgPending] = useState<SysMessageDetail | null>(null);

  useEffect(()=>{
    function handler(e: Event){
      const ce = e as CustomEvent<SysConfirmDetail>;
      console.debug('[SystemDialogProvider] received system:confirm', ce.detail);
      setPending(ce.detail);
      setOpen(true);
    }
    window.addEventListener('system:confirm', handler as EventListener);
    function msgHandler(e: Event){
      const ce = e as CustomEvent<SysMessageDetail>;
      console.debug('[SystemDialogProvider] received system:message', ce.detail);
      // If a confirm dialog is currently open, defer showing the message until after it closes
      if(open){
        console.debug('[SystemDialogProvider] deferring system:message until confirm closed');
        setMsgPending(ce.detail);
        // show shortly after confirm is closed to avoid z-index/portal conflicts
        setTimeout(()=>{
          setMsgOpen(true);
          // auto-close if duration provided
          if(ce.detail?.durationMs && typeof ce.detail.durationMs === 'number'){
            setTimeout(()=>{ setMsgOpen(false); setMsgPending(null); }, ce.detail.durationMs);
          }
        }, 180);
        return;
      }
      setMsgPending(ce.detail);
      setMsgOpen(true);
      // auto-close if duration provided
      if(ce.detail?.durationMs && typeof ce.detail.durationMs === 'number'){
        setTimeout(()=>{ setMsgOpen(false); setMsgPending(null); }, ce.detail.durationMs);
      }
    }
    window.addEventListener('system:message', msgHandler as EventListener);
    return ()=>{
      window.removeEventListener('system:confirm', handler as EventListener);
      window.removeEventListener('system:message', msgHandler as EventListener);
    };
  },[open]);

  function reply(result: boolean){
    console.debug('[SystemDialogProvider] reply', { id: pending?.id, ok: result });
    if(pending && pending.id){
      window.dispatchEvent(new CustomEvent('system:confirm:reply', { detail: { id: pending.id, ok: result } }));
    }
    // if caller provided a forward event, dispatch it when confirmed
    if(result && pending?.forwardEvent){
      try{
        console.debug('[SystemDialogProvider] forwarding event', pending.forwardEvent, pending.forwardPayload);
        window.dispatchEvent(new CustomEvent(pending.forwardEvent, { detail: pending.forwardPayload }));
      }catch(e){ console.debug('[SystemDialogProvider] forward dispatch failed', e); }
    }
    setOpen(false);
    setPending(null);
  }

  function closeMessage(){
    console.debug('[SystemDialogProvider] closing message', msgPending);
    if(msgPending && msgPending.message){
      // fire ack event for message consumers if needed
      try{ window.dispatchEvent(new CustomEvent('system:message:ack', { detail: { message: msgPending.message } })); }catch(e){/*noop*/}
    }
    setMsgOpen(false);
    setMsgPending(null);
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
              <Button autoFocus size="sm" variant="default" onClick={()=>reply(true)}>OK</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* simple informational message dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{msgPending?.title ?? 'Sistema'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p>{msgPending?.message}</p>
          </div>
          <DialogFooter>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="default" onClick={closeMessage}>OK</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Fallback modal (plain HTML) in case Radix portal/dialog doesn't render */}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[99999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={()=>reply(false)} />
          <div className="bg-white rounded-lg p-6 z-[100000] max-w-lg w-[90%] shadow-lg">
            <h3 className="text-lg font-semibold mb-2">{pending?.title ?? 'Confirmação'}</h3>
            <p className="mb-4">{pending?.message}</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={()=>reply(false)}>Cancelar</Button>
              <Button size="sm" variant="default" onClick={()=>reply(true)}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
