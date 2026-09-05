import { expect, it } from "vitest";
import { createComponent } from "solid-js";
import { renderToString } from "solid-js/web";
import { RollingNumber, RollingText } from "../src/solid";

it("renders accessible Solid SSR text without mounting a DOM renderer", () => {
  const html = renderToString(() => createComponent(RollingNumber, {
    value: 9007199254740993n, locales: "en-US", class: "balance", "aria-label": "Balance", motionBlur: true,
  }));
  expect(html).toContain("9,007,199,254,740,993");
  expect(html).toMatch(/class="rn-solid balance\s*"/u);
  expect(html).toContain('aria-label="Balance"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("data-rn-hydrated");
  expect(html).not.toContain("rn-reel");
  expect(html).not.toContain("motionBlur");
});

it("keeps per-card timing out of Solid DOM attributes", () => {
  const html = renderToString(() => createComponent(RollingText, { text: "FIX CI", mode: "flap", flipDuration: 220 }));
  expect(html).toContain("FIX CI");
  expect(html.toLowerCase()).not.toContain("flipduration");
});

it("renders direct lowercase text without leaking renderer options", () => {
  const html = renderToString(() => createComponent(RollingText, { text: "Hello 🙂", transition: "direct", motionBlur: true }));
  expect(html).toContain("Hello 🙂");
  expect(html).not.toContain("transition=");
  expect(html).not.toContain("motionBlur=");
});
