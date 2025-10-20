import { supabase } from '@/integrations/supabase/client';

type FxResult<T=unknown> = { ok: true; data: T } | { ok: false; status?: number; error: string; detail?: unknown };

function extractEdgeError(err: unknown): string | null {
  try {
    if (err && typeof err === 'object') {
      const any = err as Record<string, unknown> & { context?: unknown; message?: string };
      const ctx = any.context as unknown;
      if (ctx) {
        if (typeof ctx === 'string' && ctx.trim()) return ctx as string;
        if (typeof ctx === 'object') {
          const c = ctx as Record<string, unknown>;
          if (typeof c.error === 'string' && c.error) return c.error;
          if (typeof c.message === 'string' && c.message) return c.message;
          if (typeof c.body === 'string' && c.body) {
            try { const parsed = JSON.parse(c.body); if (parsed && typeof parsed.error === 'string') return parsed.error; } catch { /* ignore */ }
          }
        }
      }
      if (typeof any.message === 'string' && any.message) return any.message;
    }
  } catch { /* ignore */ }
  return null;
}

export async function invokeFunction<T=unknown>(name: string, opts?: { body?: unknown, method?: 'POST'|'GET'|'OPTIONS', verbose?: boolean }) : Promise<FxResult<T>> {
  const verbose = !!opts?.verbose;
  try {
    if (verbose) console.debug('[invokeFunction] calling', name, 'body=', opts?.body);
    const res = await supabase.functions.invoke(name, { body: opts?.body });
    // supabase-js returns { data, error }
    // If error present, extract details
    const { data, error } = res as { data?: unknown; error?: unknown };
    if (error) {
      const extracted = extractEdgeError(error) || String((error as unknown && (error as Record<string, unknown>).message) || error);
      if (verbose) console.warn('[invokeFunction] function error', name, { extracted, raw: error });
      // try to get status from known shapes
  let status: number | undefined = undefined;
  try { const maybe = error as unknown as Record<string, unknown>; if (typeof maybe.status === 'number') status = maybe.status as number; } catch {/* noop */}
      return { ok: false, status, error: extracted, detail: error };
    }
    if (verbose) console.debug('[invokeFunction] function ok', name, { data });
    return { ok: true, data: data as T };
  } catch (e: unknown) {
    const extracted = extractEdgeError(e) || String((e as Record<string, unknown>)?.message || e);
    if (verbose) console.error('[invokeFunction] unexpected error', name, { extracted, raw: e });
    return { ok: false, error: extracted, detail: e };
  }
}

export default invokeFunction;
