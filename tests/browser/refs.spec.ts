import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

for (const kind of ["number", "text"] as const) {
  test(`${kind} forwards object and changing callback refs without losing lifecycle cleanup`, async ({ page }) => {
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate((kind) => window.mountRefProbe(kind, "object"), kind);
    const wrapper = page.locator(".rn-react");
    await expect(wrapper).toHaveAttribute("data-rn-hydrated", "");
    const element = await wrapper.elementHandle();
    expect(await page.evaluate(() => window.refObject.current === document.querySelector(".rn-react"))).toBe(true);

    await page.evaluate((kind) => window.mountRefProbe(kind), kind);
    await expect.poll(() => page.evaluate(() => window.refProbe.mounted)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.refObject.current)).toBeNull();
    const before = await page.evaluate(() => ({ ...window.refProbe }));
    // The next render supplies a different callback. React owns detaching the old
    // ref and attaching the new one, including React 19 callback cleanup.
    await page.evaluate((kind) => window.mountRefProbe(kind), kind);
    await expect.poll(() => page.evaluate(() => window.refProbe.mounted)).toBeGreaterThan(before.mounted);
    expect(await page.evaluate(() => window.refProbe.cleaned)).toBeGreaterThan(before.cleaned);

    await page.evaluate((kind) => window.mountRefProbe(kind, "object"), kind);
    await expect.poll(() => page.evaluate(() => window.refObject.current === document.querySelector(".rn-react"))).toBe(true);
    const after = await page.evaluate(() => ({ ...window.refProbe }));
    expect(after.cleaned).toBe(after.mounted);
    expect(after.nullCalls).toBe(0);
    await expect(wrapper).toHaveAttribute("data-rn-hydrated", "");

    await page.evaluate((kind) => window.mountRefProbe(kind, "object", true), kind);
    await expect(wrapper.locator(".rn-semantic")).toHaveText(kind === "text" ? "B" : "8");
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await page.evaluate(() => window.unmountReact());
    expect(await page.evaluate(() => window.refObject.current)).toBeNull();
    expect(await element!.evaluate((node) => node.hasAttribute("data-rn-hydrated"))).toBe(false);
    await expect(page.locator("#fixture")).toBeEmpty();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
}
