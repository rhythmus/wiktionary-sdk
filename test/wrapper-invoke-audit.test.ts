/**
 * Audit §13.11 — every special-case branch in invokeWrapperMethod.
 */
import { describe, it, expect, vi } from "vitest";
import { invokeWrapperMethod } from "../src/convenience/wrapper-invoke";

describe("invokeWrapperMethod audit", () => {
  it("routes translate with target and props mode", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("translate", fn, "word", {
      sourceLang: "el",
      preferredPos: "verb",
      props: { mode: "senses", target: "nl" },
      targetLang: "fr",
    });
    expect(fn).toHaveBeenCalledWith("word", "el", "nl", { mode: "senses", target: "nl" }, "verb");
  });

  it("routes wikipediaLink with target from props", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("wikipediaLink", fn, "word", {
      sourceLang: "de",
      preferredPos: "noun",
      props: { target: "el" },
    });
    expect(fn).toHaveBeenCalledWith("word", "de", "el", "noun");
  });

  it("routes isInstance with qid from props", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("isInstance", fn, "word", {
      sourceLang: "en",
      props: { qid: "Q42" },
    });
    expect(fn).toHaveBeenCalledWith("word", "Q42", "en");
  });

  it("routes isSubclass with qid from props", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("isSubclass", fn, "word", {
      sourceLang: "en",
      props: { qid: "Q5" },
    });
    expect(fn).toHaveBeenCalledWith("word", "Q5", "en");
  });

  it("defaults isInstance qid to Q5 when missing", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("isInstance", fn, "word", { sourceLang: "en", props: {} });
    expect(fn).toHaveBeenCalledWith("word", "Q5", "en");
  });

  it("routes conjugate with criteria object", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("conjugate", fn, "γράφω", {
      sourceLang: "el",
      props: { tense: "present" },
    });
    expect(fn).toHaveBeenCalledWith("γράφω", "el", { tense: "present" });
  });

  it("routes decline with empty props as {}", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("decline", fn, "λόγος", { sourceLang: "el" });
    expect(fn).toHaveBeenCalledWith("λόγος", "el", {});
  });

  it("routes hyphenate with props and preferredPos", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("hyphenate", fn, "gamma", {
      sourceLang: "el",
      preferredPos: "verb",
      props: { dot: true },
    });
    expect(fn).toHaveBeenCalledWith("gamma", "el", { dot: true }, "verb");
  });

  it("default branch passes query, sourceLang, preferredPos", async () => {
    const fn = vi.fn().mockResolvedValue([]);
    await invokeWrapperMethod("stem", fn, "test", { sourceLang: "Auto", preferredPos: "Auto" });
    expect(fn).toHaveBeenCalledWith("test", "Auto", "Auto");
  });
});
