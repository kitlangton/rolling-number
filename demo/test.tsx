import { StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRollingNumber, type RollingNumberController, type RollingNumberOptions } from "../src/index";
import { RollingNumber } from "../src/react";
import "../src/styles.css";

declare global {
  interface Window {
    testNumber: RollingNumberController;
    mountNumber(options: RollingNumberOptions): void;
    reactNumber(options: RollingNumberOptions, hydrate?: boolean): void;
    unmountReact(): void;
    mountRefProbe(): void;
    refProbe: { mounted: number; cleaned: number; nullCalls: number };
    ready: boolean;
  }
}
const fixture = document.getElementById("fixture")!;
let react: Root | undefined;
window.mountNumber = (options) => {
  window.testNumber?.destroy();
  fixture.replaceChildren();
  const span = document.createElement("span");
  span.id = "number";
  span.style.cssText = "font: 64px/1.2 Georgia,serif; font-variant-numeric:tabular-nums";
  fixture.append(span);
  window.testNumber = createRollingNumber(span, { pauseOffscreen: false, ...options });
};
window.reactNumber = (options, hydrate = false) => {
  const element = <StrictMode><RollingNumber {...options} id="react-number" style={{ fontSize: 64 }} /></StrictMode>;
  if (!react) {
    if (hydrate) {
      fixture.innerHTML = renderToString(element);
      react = hydrateRoot(fixture, element);
    } else react = createRoot(fixture);
  }
  if (!hydrate) react.render(element);
};
window.unmountReact = () => { react?.unmount(); react = undefined; };
window.refProbe = { mounted: 0, cleaned: 0, nullCalls: 0 };
window.mountRefProbe = () => {
  react = createRoot(fixture);
  react.render(<StrictMode><RollingNumber value={1} ref={(node) => {
    if (!node) { window.refProbe.nullCalls++; return; }
    window.refProbe.mounted++;
    return () => { window.refProbe.cleaned++; };
  }} /></StrictMode>);
};
window.ready = true;
