import { expect, test } from "@playwright/test";
import { createComponent } from "solid-js";
import { generateHydrationScript, renderToString } from "solid-js/web";
import { RollingNumber } from "../../src/solid";
import type {} from "../../demo/solid-test";

for (const ssr of [false, true]) {
  test(`Solid ${ssr ? "hydrates" : "mounts"}, updates reactive options and disposes during motion`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/solid.html");
    await page.waitForFunction(() => window.solidReady);
    const html = ssr ? renderToString(() => createComponent(RollingNumber, {
      value: 1234.56, locales: "en-US", duration: 800, pauseOffscreen: false,
      id: "solid-number", class: "balance", style: { "font-size": "64px" },
    })) : undefined;
    if (ssr) {
      const script = generateHydrationScript().match(/<script[^>]*>([\s\S]*?)<\/script>/u)![1]!;
      await page.addScriptTag({ content: script });
      await page.locator("#fixture").evaluate((element, html) => { element.innerHTML = html!; }, html);
      await expect(page.locator(".rn-semantic")).toBeVisible();
      await expect(page.locator(".rn-semantic")).toHaveText("1,234.56");
    }
    const original = ssr ? await page.locator("#solid-number").elementHandle() : null;
    // Keep the server nodes when hydrating, so identity proves adoption rather than replacement.
    await page.evaluate((html) => window.mountSolid(html), html);
    const root = page.locator("#solid-number");
    await expect(root).toHaveAttribute("data-rn-hydrated", "");
    await expect(root.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
    if (original) expect(await original.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.evaluate(() => window.solidRef === document.getElementById("solid-number"))).toBe(true);
    expect(await root.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.evaluate(() => window.updateSolid({ value: 99999.12, format: { style: "currency", currency: "USD" } }));
    await expect(root.locator(".rn-semantic")).toHaveText("$99,999.12");
    await expect.poll(() => root.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.updateSolid({ value: 7 }));
    await expect(root.locator(".rn-semantic")).toHaveText("$7.00");
    expect(await root.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(root.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
    await page.evaluate(() => window.updateSolid({ value: 4321 }));
    await expect.poll(() => root.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    await page.evaluate(() => window.disposeSolid());
    await expect(root).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(errors).toEqual([]);
  });
}
