// import type { WikiLang } from "./types";

export async function mwFetchJson(origin: string, params: Record<string, string>) {
    const u = new URL(origin);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u.toString(), {
        headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
}

export async function fetchWikitextEnWiktionary(title: string) {
    const origin = "https://en.wiktionary.org/w/api.php";
    const j = await mwFetchJson(origin, {
        action: "query",
        format: "json",
        formatversion: "2",
        origin: "*",
        prop: "revisions|pageprops",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
        titles: title,
    });
    const page = j?.query?.pages?.[0];
    const wikitext = page?.revisions?.[0]?.slots?.main?.content ?? "";
    const pageprops = page?.pageprops ?? {};
    const exists = !page?.missing;
    const normalizedTitle = page?.title ?? title;
    return {
        exists,
        title: normalizedTitle,
        wikitext,
        pageprops,
        pageid: page?.pageid ?? null,
    };
}

export async function fetchWikidataEntity(qid: string) {
    const origin = "https://www.wikidata.org/w/api.php";
    const j = await mwFetchJson(origin, {
        action: "wbgetentities",
        format: "json",
        formatversion: "2",
        origin: "*",
        ids: qid,
        props: "labels|descriptions|claims|sitelinks",
    });
    const ent = j?.entities?.[qid];
    return ent ?? null;
}
