import { describe, expect, it } from "vitest";
import { direction, formatValue, model } from "../src/format";

describe("formatting", () => {
  it("preserves Intl output across values, locales and styles", () => {
    const values = [0, -0, 1.005, -0.001, 9.995, -12345678.95, Infinity, -Infinity, NaN, 900719925474099312345n];
    for (const locales of ["en-US", "de-DE", "fr-FR", "hi-IN", "ar-EG", "fa-IR", "bn-BD", "ja-JP"]) {
      for (const format of [{}, { style: "currency", currency: "USD", currencySign: "accounting" }, { style: "percent" }, { notation: "compact" }, { notation: "scientific" }] satisfies Intl.NumberFormatOptions[]) {
        for (const value of values) {
          const result = model(value, { locales, format });
          expect(result.text).toBe(new Intl.NumberFormat(locales, format).format(value));
          if (result.rollable) {
            expect(result.tokens.map((token) => token.text).join("")).toBe(result.text);
            expect(new Set(result.tokens.map((token) => token.key)).size).toBe(result.tokens.length);
          }
        }
      }
    }
  });

  it("keeps place identity through carries and changing fraction lengths", () => {
    for (const [value, units, tenths] of [[99.1, "9", "1"], [100.12, "0", "1"], [9.001, "9", "0"], [12345678.99, "8", "9"]] as const) {
      const result = model(value, { locales: "hi-IN", format: { maximumFractionDigits: 3 } });
      expect(result.tokens.find((token) => token.key === "digit:0")).toMatchObject({ identity: "digit:0", text: units });
      expect(result.tokens.find((token) => token.key === "digit:-1")).toMatchObject({ identity: "digit:-1", text: tenths });
    }
    expect(model(12345678, { locales: "hi-IN" }).tokens.filter((token) => token.key.startsWith("group")).map((token) => token.key)).toEqual(["group:7:,", "group:5:,", "group:3:,"]);
  });

  it("handles negative zero and arbitrary bigint precision without coercion", () => {
    expect(formatValue(-0, { locales: "en-US" })).toBe("-0");
    expect(formatValue(900719925474099312345n, { locales: "en-US", format: { useGrouping: false } })).toBe("900719925474099312345");
    expect(direction(model(-12), model(-11))).toBe(-1);
    expect(direction(model(900719925474099312345n), model(900719925474099312346n))).toBe(1);
    expect(direction(model(1.004), model(1.0041))).toBe(0);
  });

  it("keeps symbol roles stable while giving changed glyphs distinct keys", () => {
    const usd = model(23, { format: { style: "currency", currency: "USD" } }).tokens.find((token) => token.identity === "currency:0")!;
    const gbp = model(23, { format: { style: "currency", currency: "GBP" } }).tokens.find((token) => token.identity === "currency:0")!;
    expect(usd.identity).toBe(gbp.identity);
    expect(usd.key).not.toBe(gbp.key);
    const plus = model(3, { format: { signDisplay: "always" } }).tokens.find((token) => token.identity === "sign:0")!;
    const minus = model(-3, { format: { signDisplay: "always" } }).tokens.find((token) => token.identity === "sign:0")!;
    expect(plus.key).not.toBe(minus.key);
  });

  it("leaves bidi, localized digits and alternate notation intact", () => {
    expect(model(120, { locales: "ar-EG" }).rollable).toBe(false);
    expect(model(120, { locales: "fa-IR" }).rollable).toBe(false);
    expect(model(1200, { format: { notation: "compact" } }).rollable).toBe(false);
    expect(model(Infinity).rollable).toBe(false);
  });

  it("retains native validation errors", () => {
    expect(() => model(1, { format: { style: "currency" } })).toThrow();
    expect(() => model(1, { locales: "invalid_locale" })).toThrow();
  });
});

it("models text as per-character wheels with symbols crossfading in place", async () => {
  const { textModel, FLAP_CHARSET } = await import("../src/format");
  const board = textModel("PARIS 09:15");
  expect(board.rollable).toBe(true);
  expect(board.tokens.map((token) => token.identity)).toEqual(Array.from({ length: 11 }, (_, index) => `char:${index}`));
  expect(board.tokens[0]).toMatchObject({ key: "char:0", text: "P", index: FLAP_CHARSET.indexOf("P") });
  expect(board.tokens[5]).toMatchObject({ text: " ", index: 0 });
  // A glyph outside the charset keeps a glyph-specific key, so it crossfades instead of rolling.
  const emoji = textModel("A→B");
  expect(emoji.tokens[1]).toMatchObject({ key: "char:1:→", identity: "char:1" });
  expect(emoji.tokens[1]).not.toHaveProperty("index");
  expect(textModel("abc", { charset: "abc" }).tokens.every((token) => token.wheel?.length === 3)).toBe(true);
  expect(textModel("שלום").rollable).toBe(false);
});

it("gives each position its own drum when charset is an array", async () => {
  const { textModel } = await import("../src/format");
  const clock = textModel("09:15", { charset: ["0123456789", "0123456789", ":", "0123456789", "0123456789"] });
  expect(clock.tokens.map((token) => token.wheel?.length)).toEqual([10, 10, 1, 10, 10]);
  // Positions beyond the array reuse the last drum.
  expect(textModel("ABC", { charset: ["A", "ABC"] }).tokens.map((token) => token.wheel?.length)).toEqual([1, 3, 3]);
});
