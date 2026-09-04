export type Value = number | bigint;
export type Locales = string | string[];

export interface FormatOptions {
  locales?: Locales | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}

export interface Token {
  key: string;
  identity: string;
  text: string;
  digit?: number;
  place?: number;
}

export interface Model {
  text: string;
  tokens: Token[];
  rollable: boolean;
  signature: string;
  magnitude: string;
}

// A bounded cache shared by many counters; no cache keyed by values.
const formatters = new Map<string, Intl.NumberFormat>();
const bidi = /[\u0590-\u08ff\u200e\u200f\u202a-\u202e\u2066-\u2069\ufb1d-\ufeff]/u;

export function formatter(options: FormatOptions = {}): Intl.NumberFormat {
  const locales = Intl.getCanonicalLocales(options.locales);
  const format = Object.fromEntries(Object.entries(options.format ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  const key = JSON.stringify([locales, format]);
  let result = formatters.get(key);
  if (!result) {
    result = new Intl.NumberFormat(locales, format);
    const oldest = formatters.keys().next().value;
    if (formatters.size >= 64 && oldest !== undefined) formatters.delete(oldest);
    formatters.set(key, result);
  }
  return result;
}

export function formatValue(value: Value, options: FormatOptions = {}): string {
  return formatter(options).format(value);
}

export function model(value: Value, options: FormatOptions = {}): Model {
  const nf = formatter(options);
  const parts = nf.formatToParts(value);
  const text = parts.map((part) => part.value).join("");
  const resolved = nf.resolvedOptions();
  const rollable = resolved.numberingSystem === "latn" && resolved.notation === "standard" &&
    !bidi.test(text) && !parts.some((part) => part.type === "nan" || part.type === "infinity");
  const signature = JSON.stringify(resolved);
  if (!rollable) return { text, tokens: [], rollable, signature, magnitude: "" };
  let integerPlace = parts.filter((part) => part.type === "integer").reduce((sum, part) => sum + part.value.length, 0);
  let fractionPlace = -1;
  const occurrences = new Map<string, number>();
  const tokens: Token[] = [];
  let integer = "";
  let fraction = "";
  for (const part of parts) {
    if (part.type === "integer" || part.type === "fraction") {
      if (part.type === "integer") integer += part.value;
      else fraction += part.value;
      for (const digit of part.value) {
        const place = part.type === "integer" ? --integerPlace : fractionPlace--;
        const identity = `digit:${place}`;
        tokens.push({ key: identity, identity, text: digit, digit: Number(digit), place });
      }
    } else if (part.type === "group") {
      const identity = `group:${integerPlace}`;
      tokens.push({ key: `${identity}:${part.value}`, identity, text: part.value });
    } else {
      const occurrence = occurrences.get(part.type) ?? 0;
      occurrences.set(part.type, occurrence + 1);
      const role = part.type === "plusSign" || part.type === "minusSign" ? "sign" : part.type;
      tokens.push({ key: `${part.type}:${occurrence}:${part.value}`, identity: `${role}:${occurrence}`, text: part.value });
    }
  }
  return { text, tokens, rollable, signature, magnitude: `${integer.replace(/^0+(?=\d)/u, "")}.${fraction}` };
}

/** Compare displayed magnitudes without precision loss or parsing localized strings. */
export function direction(previous: Model, next: Model): -1 | 0 | 1 {
  const [a = "", af = ""] = previous.magnitude.split(".");
  const [b = "", bf = ""] = next.magnitude.split(".");
  if (a.length !== b.length) return b.length > a.length ? 1 : -1;
  if (a !== b) return b > a ? 1 : -1;
  const length = Math.max(af.length, bf.length);
  const left = af.padEnd(length, "0");
  const right = bf.padEnd(length, "0");
  return right === left ? 0 : right > left ? 1 : -1;
}
