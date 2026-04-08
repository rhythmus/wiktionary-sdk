import { useMemo, type FC } from "react";
import { AlertCircle } from "lucide-react";
import type { Lexeme } from "@engine/model";
import { formatHomonymGroupHtml } from "@engine/present/formatter";

/**
 * Renders multiple LEXEME entries sharing the same headword+PoS but with
 * different etymologies as a single merged homonym-group HTML block.
 */
export const HomonymGroupBlock: FC<{ lexemes: Lexeme[] }> = ({ lexemes }) => {
  const rendered = useMemo(() => {
    try {
      return { html: formatHomonymGroupHtml(lexemes, { mode: "html-fragment" }), error: null as string | null };
    } catch (e) {
      console.error("Homonym group format error:", e);
      return { html: "", error: e instanceof Error ? e.message : "Unknown formatter error" };
    }
  }, [lexemes]);

  if (rendered.error) {
    return (
      <div className="dict-merged-lexeme-block">
        <div className="app-error-banner" style={{ margin: 0 }}>
          <AlertCircle size={16} />
          Unable to render this homonym group: {rendered.error}
        </div>
      </div>
    );
  }

  return <div className="dict-merged-lexeme-block" dangerouslySetInnerHTML={{ __html: rendered.html }} />;
};
