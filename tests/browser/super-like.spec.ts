import { expect, test } from "@playwright/test";

test("hold charges one Super Like, releases a bounded burst, and never stacks effects", async ({ page }) => {
  await page.goto("/");
  const like = page.getByRole("button", { name: "Like", exact: true });
  await like.scrollIntoViewIfNeeded();
  await like.click();
  await expect(page.locator(".likes-app .rn-semantic")).toHaveText("1,205");
  await like.hover();
  await page.mouse.down();
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "charging");
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "ready");
  const effects = await like.locator("svg").evaluate((node) => node.getAnimations().length);
  expect(effects).toBe(1);
  await page.mouse.up();
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "idle");
  const text = await page.locator(".likes-app .rn-semantic").textContent();
  const added = Number(text!.replace(/,/g, "")) - 1205;
  expect(added).toBeGreaterThanOrEqual(200);
  expect(added).toBeLessThanOrEqual(500);
  await expect(page.locator("#like-hint")).toHaveText(`SUPER LIKE +${added}`);
  await expect.poll(() => like.locator("svg").evaluate((node) => node.getAnimations().length)).toBe(0);
  await like.press("Enter");
  await expect(page.locator(".likes-app .rn-semantic")).toHaveText(new Intl.NumberFormat("en-US").format(1206 + added));
  expect(await like.locator("svg").evaluate((node) => node.getAnimations().length)).toBe(0);
});

test("canceling a hold awards nothing; reduced motion has no shake", async ({ page }) => {
  await page.goto("/");
  const like = page.getByRole("button", { name: "Like", exact: true });
  await like.scrollIntoViewIfNeeded();
  await like.hover(); await page.mouse.down();
  await like.dispatchEvent("pointercancel");
  await page.mouse.up();
  await expect(page.locator(".likes-app .rn-semantic")).toHaveText("1,204");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".likes-app .rn-root")).not.toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); });
  await like.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "ready");
  expect(await like.locator("svg").evaluate((node) => node.getAnimations().length)).toBe(0);
  await page.keyboard.up("Space");
  await expect(page.locator("#like-hint")).toHaveText(/SUPER LIKE \+\d+/);
  expect(await page.locator(".likes-app").evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test("changing blur during a keyboard hold cancels the charge and its pending release", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  const like = page.getByRole("button", { name: "Like", exact: true });
  await like.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "charging");
  await page.getByRole("checkbox", { name: "Motion blur", exact: true }).evaluate((node) => (node as HTMLInputElement).click());
  await expect(page.locator(".likes-app")).toHaveAttribute("data-charge", "idle");
  await page.keyboard.up("Space");
  await expect(page.locator(".likes-app .rn-semantic")).toHaveText("1,204");
  expect(await like.locator("svg").evaluate((node) => node.getAnimations().length)).toBe(0);
});
