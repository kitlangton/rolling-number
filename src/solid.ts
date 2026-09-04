import { createComponent, createEffect, mergeProps, onCleanup, onMount, splitProps, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createRollingNumber, formatValue, type RollingNumberController, type RollingNumberOptions } from "./index.js";

export type RollingNumberProps = RollingNumberOptions & Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children" | "innerHTML" | "textContent" | "innerText">;

/** Solid owns semantic text; the same DOM core owns only the decorative mount. */
export function RollingNumber(props: RollingNumberProps): JSX.Element {
  const [options, local, attributes] = splitProps(props,
    ["value", "locales", "format", "duration", "animated", "direction", "pauseOffscreen"],
    ["class", "ref"],
  );
  let root: HTMLSpanElement;
  let mount: HTMLSpanElement;
  let controller: RollingNumberController | undefined;
  onMount(() => {
    controller = createRollingNumber(mount, { ...options });
    root.dataset.rnHydrated = "";
  });
  createEffect(() => {
    const next = { ...options }; // Track every option even before the mount effect runs.
    controller?.update(next);
  });
  onCleanup(() => {
    controller?.destroy();
    if (root) delete root.dataset.rnHydrated;
  });
  // Dynamic uses Solid's native browser/SSR implementations. No consumer JSX transform required.
  return createComponent(Dynamic, mergeProps(attributes, {
    component: "span",
    get class() { return ["rn-solid", local.class].filter(Boolean).join(" "); },
    ref(element: HTMLSpanElement) {
      root = element;
      if (typeof local.ref === "function") local.ref(element);
    },
    get children() {
      return [
        createComponent(Dynamic, {
          component: "span",
          class: "rn-semantic",
          get children() { return formatValue(options.value, options); },
        }),
        createComponent(Dynamic, {
          component: "span",
          class: "rn-mount",
          "aria-hidden": "true",
          ref(element: HTMLSpanElement) { mount = element; },
        }),
      ];
    },
  }));
}
