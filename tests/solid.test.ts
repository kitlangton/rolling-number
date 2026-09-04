import { expect, it } from "vitest";
import { createComponent } from "solid-js";
import { renderToString } from "solid-js/web";
import { RollingNumber } from "../src/solid";

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
