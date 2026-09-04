import { createComponent, createSignal } from "solid-js";
import { hydrate, render } from "solid-js/web";
import { RollingNumber } from "../src/solid";
import type { RollingNumberOptions } from "../src/index";
import "../src/styles.css";

declare global {
  interface Window {
    solidReady: boolean;
    mountSolid(html?: string): void;
    updateSolid(options: Partial<RollingNumberOptions>): void;
    disposeSolid(): void;
    solidRef: HTMLSpanElement | undefined;
  }
}
const fixture = document.getElementById("fixture")!;
window.mountSolid = (html) => {
  const [options, setOptions] = createSignal<RollingNumberOptions>({ value: 1234.56, locales: "en-US", duration: 800, pauseOffscreen: false });
  window.updateSolid = (next) => setOptions((current) => ({ ...current, ...next }));
  const component = () => createComponent(RollingNumber, {
    get value() { return options().value; },
    get locales() { return options().locales; },
    get format() { return options().format; },
    get duration() { return options().duration; },
    get animated() { return options().animated; },
    get motionBlur() { return options().motionBlur; },
    pauseOffscreen: false,
    id: "solid-number",
    class: "balance",
    style: { "font-size": "64px" },
    ref: (element) => { window.solidRef = element; },
  });
  if (html !== undefined && !fixture.hasChildNodes()) fixture.innerHTML = html;
  window.disposeSolid = html === undefined ? render(component, fixture) : hydrate(component, fixture);
};
window.solidReady = true;
