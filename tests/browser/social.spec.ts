import { expect, test } from "@playwright/test";

test("social crawlers get a static large-image card with a real 1200 × 630 PNG", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain('property="og:image" content="https://rolling.kitlangton.dev/og-rolling-number.png"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  expect(html).toContain('property="og:image:alt"');
  const image = await request.get("/og-rolling-number.png");
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/png");
  const png = await image.body();
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
