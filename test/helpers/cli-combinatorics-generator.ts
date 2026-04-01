import type { WikiLang } from "../../src/types";

export type WrapperRoutingKind =
  | "default"
  | "translate"
  | "wikipediaLink"
  | "entity"
  | "criteria"
  | "hyphenate";

export interface CliCombinatoricsInput {
  wrapperName: string;
  query: string;
  opts: {
    lang: WikiLang;
    targetLang?: string;
    preferredPos: string;
    props?: Record<string, unknown>;
  };
}

export interface CliCombinatoricsCase extends CliCombinatoricsInput {
  caseId: string;
  expectedArgs: unknown[];
}

function routingKindForWrapper(wrapperName: string): WrapperRoutingKind {
  if (wrapperName === "translate") return "translate";
  if (wrapperName === "wikipediaLink") return "wikipediaLink";
  if (wrapperName === "isInstance" || wrapperName === "isSubclass") return "entity";
  if (wrapperName === "conjugate" || wrapperName === "decline") return "criteria";
  if (wrapperName === "hyphenate") return "hyphenate";
  return "default";
}

function expectedArgsFor(input: CliCombinatoricsInput): unknown[] {
  const kind = routingKindForWrapper(input.wrapperName);
  const { query, opts } = input;
  const props = opts.props;

  if (kind === "translate") {
    const target = String((props as any)?.target ?? opts.targetLang ?? "en");
    return [query, opts.lang, target, props ?? { mode: "gloss" }, opts.preferredPos];
  }
  if (kind === "wikipediaLink") {
    const target = String((props as any)?.target ?? opts.targetLang ?? "en");
    return [query, opts.lang, target, opts.preferredPos];
  }
  if (kind === "entity") {
    return [query, (props as any)?.qid || "Q5", opts.lang];
  }
  if (kind === "criteria") {
    return [query, opts.lang, props || {}];
  }
  if (kind === "hyphenate") {
    return [query, opts.lang, props, opts.preferredPos];
  }
  return [query, opts.lang, opts.preferredPos];
}

export function generateCliCombinatoricsCases(
  wrappers: Array<{ wrapperName: string; query: string }>
): CliCombinatoricsCase[] {
  const variants: CliCombinatoricsInput["opts"][] = [
    { lang: "el", targetLang: "en", preferredPos: "Auto" },
    { lang: "el", targetLang: "en", preferredPos: "noun", props: {} },
    { lang: "el", targetLang: "nl", preferredPos: "verb", props: { target: "de", qid: "Q42", mode: "gloss" } },
  ];

  const out: CliCombinatoricsCase[] = [];
  for (const w of wrappers) {
    for (let i = 0; i < variants.length; i++) {
      const input: CliCombinatoricsInput = {
        wrapperName: w.wrapperName,
        query: w.query,
        opts: variants[i],
      };
      out.push({
        ...input,
        caseId: `${w.wrapperName}#${i + 1}`,
        expectedArgs: expectedArgsFor(input),
      });
    }
  }
  return out;
}

