import { getRateLimiter } from "./rate-limiter";
import { getCache } from "./cache";

export async function mwFetchJson(origin: string, params: Record<string, string>) {
    const limiter = getRateLimiter();
    await limiter.throttle();

    const u = new URL(origin);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u.toString(), {
        headers: limiter.getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
}

/**
 * Normalizes one MediaWiki `query.pages[]` object (formatversion=2) into the
 * shape returned by {@link fetchWikitextEnWiktionary}. Used for tests and
 * offline API replay fixtures.
 */
export function normalizeWiktionaryQueryPage(page: any, requestedTitle: string) {
    const wikitext = (page?.revisions?.[0]?.slots?.main?.content ?? "").normalize("NFC");
    const pageprops = page?.pageprops ?? {};
    const categories = (page?.categories ?? []).map((c: any) => c.title.replace(/^Category:/, ""));
    const langlinks = page?.langlinks ?? [];
    const info = {
        last_modified: page?.touched,
        length: page?.length,
        pageid: page?.pageid,
        lastrevid: page?.lastrevid,
    };
    const exists = !page?.missing;
    const normalizedTitle = (page?.title ?? requestedTitle).normalize("NFC");
    return {
        exists,
        title: normalizedTitle,
        wikitext,
        pageprops,
        categories,
        langlinks,
        info,
        pageid: page?.pageid ?? null,
    };
}

export async function fetchWikitextEnWiktionary(title: string) {
    const cacheKey = `wikt:${title}`;
    const cache = getCache();
    const cached = await cache.get<{
        exists: boolean;
        title: string;
        wikitext: string;
        pageprops: Record<string, any>;
        pageid: number | null;
    }>(cacheKey);
    if (cached) return cached;

    const origin = "https://en.wiktionary.org/w/api.php";
    const j = await mwFetchJson(origin, {
        action: "query",
        format: "json",
        formatversion: "2",
        origin: "*",
        prop: "revisions|pageprops|categories|images|langlinks|info",
        rvprop: "content",
        rvslots: "main",
        cllimit: "50",
        imlimit: "20",
        lllimit: "20",
        redirects: "1",
        titles: title,
    });
    const page = j?.query?.pages?.[0];
    const result = normalizeWiktionaryQueryPage(page, title);
    if (result.exists) {
        await cache.set(cacheKey, result);
        if (result.title !== title) {
            await cache.set(`wikt:${result.title}`, result);
        }
    }
    return result;
}

export async function fetchWikidataEntity(qid: string) {
    const cacheKey = `wd:${qid}`;
    const cache = getCache();
    const cached = await cache.get<any>(cacheKey);
    if (cached) return cached;

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
    const result = ent ?? null;
    if (result) await cache.set(cacheKey, result);
    return result;
}
