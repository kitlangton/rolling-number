import { expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RollingNumber, RollingText } from "../src/react";

it("renders accessible static text without a browser or hydration suppression", () => {
  const html = renderToString(<RollingNumber value={1234.5} locales="en-US" format={{ style: "currency", currency: "USD" }} aria-label="Balance" />);
  expect(html).toContain("$1,234.50");
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("rn-hydrated");
  expect(html).not.toContain("role=\"img\"");
});

it("keeps per-card timing out of DOM attributes", () => {
  const html = renderToString(<RollingText text="FIX CI" mode="flap" flipDuration={220} />);
  expect(html).toContain("FIX CI");
  expect(html.toLowerCase()).not.toContain("flipduration");
});

it("renders direct lowercase text without leaking renderer options", () => {
  const html = renderToString(<RollingText text="Hello 🙂" transition="direct" motionBlur />);
  expect(html).toContain("Hello 🙂");
  expect(html).not.toContain("transition=");
  expect(html).not.toContain("motionBlur=");
});
