import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { Lexeme } from "@engine/model";
import { format } from "@engine/present/formatter";

export const PlainLexemeHtmlBlock: React.FC<{ lexeme: Lexeme }> = ({ lexeme }) => {
  const rendered = useMemo(() => {
    try {
      return { html: format(lexeme, { mode: "html-fragment" }), error: null as string | null };
    } catch (e) {
      console.error("Format error:", e);
      return {
        html: "",
        error: e instanceof Error ? e.message : "Unknown formatter error",
      };
    }
  }, [lexeme]);

  if (rendered.error) {
    return (
      <div className="dict-merged-lexeme-block">
        <div className="app-error-banner" style={{ margin: 0 }}>
          <AlertCircle size={16} />
          Unable to render this lexeme block: {rendered.error}
        </div>
      </div>
    );
  }

  return <div className="dict-merged-lexeme-block" dangerouslySetInnerHTML={{ __html: rendered.html }} />;
};
