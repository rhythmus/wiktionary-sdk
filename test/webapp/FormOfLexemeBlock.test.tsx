/** @vitest-environment jsdom */
/**
 * Audit §13.12 — FormOfLexemeBlock lemma fetch + effect cleanup (no setState after unmount).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import type { Lexeme } from "../../src/model";

const wiktionary = vi.fn();

vi.mock("@engine/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/index")>();
  return {
    ...actual,
    wiktionary: (...args: unknown[]) => wiktionary(...args),
  };
});

import { FormOfLexemeBlock } from "../../webapp/src/FormOfLexemeBlock";

function inflectedLexeme(over: Partial<Lexeme> = {}): Lexeme {
  return {
    id: "en:runs#E1#verb#INFLECTED_FORM",
    language: "en",
    query: "runs",
    type: "INFLECTED_FORM",
    form: "runs",
    etymology_index: 1,
    part_of_speech_heading: "Verb",
    lexicographic_section: "verb",
    lexicographic_family: "pos",
    part_of_speech: "verb",
    templates: {},
    source: {
      wiktionary: {
        site: "en.wiktionary.org",
        title: "runs",
        language_section: "English",
        etymology_index: 1,
        pos_heading: "Verb",
      },
    },
    form_of: {
      template: "inflection of",
      lemma: "run",
      lang: "en",
      tags: ["1", "s", "pres", "ind", "act"],
      label: "test",
      named: {},
      subclass: "infl",
    },
    senses: [{ id: "S1", gloss: "running" }],
    ...over,
  } as Lexeme;
}

describe("FormOfLexemeBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading then lemma content when wiktionary resolves", async () => {
    wiktionary.mockResolvedValue({
      schema_version: "3.0.0",
      rawLanguageBlock: "",
      notes: [],
      lexemes: [
        {
          id: "en:run#1#verb#LEXEME",
          language: "en",
          query: "run",
          type: "LEXEME",
          form: "run",
          etymology_index: 1,
          part_of_speech_heading: "Verb",
          lexicographic_section: "verb",
          lexicographic_family: "pos",
          part_of_speech: "verb",
          templates: {},
          source: {
            wiktionary: {
              site: "en.wiktionary.org",
              title: "run",
              language_section: "English",
              etymology_index: 1,
              pos_heading: "Verb",
            },
          },
          senses: [{ id: "S1", gloss: "to move fast" }],
        } as Lexeme,
      ],
    });

    render(<FormOfLexemeBlock lexeme={inflectedLexeme()} debugMode={false} matchMode="strict" />);

    expect(screen.getByText(/Loading lemma/)).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(/Loading lemma/)).not.toBeInTheDocument();
    expect(wiktionary).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "run",
        lang: "en",
        pos: "Auto",
        matchMode: "strict",
      }),
    );
  });

  it("does not warn when wiktionary resolves after unmount (cancelled effect)", async () => {
    let resolveFetch: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolveFetch = r as (v: unknown) => void;
    });
    wiktionary.mockReturnValue(pending);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(
      <FormOfLexemeBlock lexeme={inflectedLexeme()} debugMode={false} matchMode="strict" />,
    );

    expect(screen.getByText(/Loading lemma/)).toBeInTheDocument();

    unmount();

    await act(async () => {
      resolveFetch!({
        schema_version: "3.0.0",
        rawLanguageBlock: "",
        notes: [],
        lexemes: [],
      });
      await Promise.resolve();
    });

    const reactActWarning = consoleError.mock.calls.some(
      (c) =>
        typeof c[0] === "string" &&
        (c[0].includes("not mounted") || c[0].includes("unmounted") || c[0].includes("Can't perform")),
    );
    expect(reactActWarning).toBe(false);

    consoleError.mockRestore();
  });
});
