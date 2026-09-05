import { expect, test, type Locator, type Page } from "@playwright/test";
import type {} from "../../demo/test";
import type {} from "../../demo/solid-test";

async function select(page: Page, root: Locator) {
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  return page.evaluate(() => window.getSelection()?.toString());
}

for (const adapter of ["dom", "react", "solid"] as const) {
  test(`${adapter} lets a pointer select the value once, before and after updates`, async ({ page }) => {
    await page.goto(adapter === "solid" ? "/solid.html" : "/test.html");
    if (adapter === "solid") {
      await page.waitForFunction(() => window.solidReady);
      await page.evaluate(() => window.mountSolid());
    } else {
      await page.waitForFunction(() => window.ready);
      await page.evaluate((adapter) => {
        const options = { value: 1234.56, locales: "en-US", duration: 200 };
        if (adapter === "dom") window.mountNumber(options);
        else window.reactNumber(options, true);
      }, adapter);
    }
    const root = page.locator(adapter === "dom" ? "#number" : adapter === "react" ? "#react-number" : "#solid-number");
    await expect(page.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
    expect(await select(page, root)).toBe("1,234.56");
    await page.evaluate((adapter) => {
      window.getSelection()?.removeAllRanges();
      if (adapter === "dom") window.testNumber.update({ value: 9876.54 });
      else if (adapter === "react") window.reactNumber({ value: 9876.54, locales: "en-US", duration: 200 });
      else window.updateSolid({ value: 9876.54, duration: 200 });
    }, adapter);
    await expect.poll(() => root.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await select(page, root)).toBe("9,876.54");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".rn-root")).not.toHaveAttribute("data-rn-ready", "");
    expect(await select(page, root)).toBe("9,876.54");
  });
}
