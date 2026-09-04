import { expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RollingNumber } from "../src/react";

it("renders accessible static text without a browser or hydration suppression", () => {
  const html = renderToString(<RollingNumber value={1234.5} locales="en-US" format={{ style: "currency", currency: "USD" }} aria-label="Balance" />);
  expect(html).toContain("$1,234.50");
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("rn-hydrated");
  expect(html).not.toContain("role=\"img\"");
});
