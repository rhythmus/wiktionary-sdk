import { format } from '@engine/present/formatter';
import { invokeWrapperMethod as defaultInvoke } from '@engine/index';
import type { WikiLang } from '@engine/types';

export type PlaygroundApiExecuteDeps = {
  apiMethod: string;
  apiPropsRaw: string;
  query: string;
  lang: WikiLang;
  prefPos: string;
  apiMethods: Record<string, (...args: any[]) => Promise<any>>;
  /** Injected for tests */
  invokeWrapper?: typeof defaultInvoke;
};

export type PlaygroundApiExecuteOutcome =
  | { ok: false; error: 'invalid_json' }
  | { ok: true; result: unknown; formatted: string | null }
  | {
      ok: false;
      error: 'invoke';
      message: string;
      result: { error: string };
      formatted: string;
    };

/**
 * Core logic for the Live API Playground execute button (mirrors App `handleApiExecute`).
 */
export async function runPlaygroundApiExecute(deps: PlaygroundApiExecuteDeps): Promise<PlaygroundApiExecuteOutcome> {
  const invoke = deps.invokeWrapper ?? defaultInvoke;
  let propsObj: Record<string, unknown> | undefined;
  if (deps.apiPropsRaw.trim()) {
    try {
      propsObj = JSON.parse(deps.apiPropsRaw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
  }

  const fn = deps.apiMethods[deps.apiMethod];
  try {
    const res = await invoke(deps.apiMethod, fn, deps.query, {
      sourceLang: deps.lang,
      preferredPos: deps.prefPos,
      props: propsObj,
    });
    let formatted: string | null = null;
    try {
      formatted = format(res, { mode: 'terminal-html' });
    } catch {
      formatted = null;
    }
    return { ok: true, result: res, formatted };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: 'invoke',
      message: msg,
      result: { error: msg },
      formatted: `<span style="color:#f87171">Error: ${msg}</span>`,
    };
  }
}
