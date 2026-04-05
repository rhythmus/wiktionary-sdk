import type { WikiLang } from "../types";

export interface InvokeWrapperOptions {
  sourceLang: WikiLang;
  preferredPos?: string;
  props?: Record<string, unknown>;
  targetLang?: string;
}

export async function invokeWrapperMethod(
  methodName: string,
  fn: (...args: any[]) => Promise<any>,
  query: string,
  opts: InvokeWrapperOptions
) {
  const sourceLang = opts.sourceLang;
  const preferredPos = opts.preferredPos ?? "Auto";
  const props = opts.props;

  let args: any[] = [];
  if (methodName === "translate") {
    const target = String((props as any)?.target ?? opts.targetLang ?? "en");
    args = [query, sourceLang, target, props ?? { mode: "gloss" }, preferredPos];
  } else if (methodName === "wikipediaLink") {
    const target = String((props as any)?.target ?? opts.targetLang ?? "en");
    args = [query, sourceLang, target, preferredPos];
  } else if (["isInstance", "isSubclass"].includes(methodName)) {
    args = [query, (props as any)?.qid || "Q5", sourceLang];
  } else if (["conjugate", "decline"].includes(methodName)) {
    args = [query, sourceLang, props || {}];
  } else if (methodName === "hyphenate") {
    args = [query, sourceLang, props, preferredPos];
  } else {
    args = [query, sourceLang, preferredPos];
  }

  return await fn(...args);
}

