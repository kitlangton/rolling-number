"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef, type RefCallback } from "react";
import { createRollingNumber, formatValue, type RollingNumberController, type RollingNumberOptions } from "./index.js";

export type RollingNumberProps = RollingNumberOptions & Omit<ComponentPropsWithoutRef<"span">, "children" | "dangerouslySetInnerHTML">;
const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** React owns the accessible text. Only the empty aria-hidden mount is imperative. */
export const RollingNumber = forwardRef<HTMLSpanElement, RollingNumberProps>(function RollingNumber(
  { value, locales, format, duration, animated, motionBlur, direction, pauseOffscreen, className, ...props },
  forwardedRef,
) {
  const root = useRef<HTMLSpanElement>(null);
  const mount = useRef<HTMLSpanElement>(null);
  const controller = useRef<RollingNumberController | null>(null);
  const options = { value, locales, format, duration, animated, motionBlur, direction, pauseOffscreen };
  const setRoot = useCallback((node: HTMLSpanElement | null) => {
    root.current = node;
    if (typeof forwardedRef === "function") {
      // ForwardedRef still declares a void callback; RefCallback includes the
      // cleanup contract accepted by React 19's public ref prop.
      const callback: RefCallback<HTMLSpanElement> = forwardedRef;
      const cleanup = callback(node);
      if (typeof cleanup === "function") return () => {
        root.current = null;
        cleanup();
      };
    }
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  useCommitEffect(() => {
    if (!mount.current || !root.current) return;
    const element = root.current;
    const renderer = createRollingNumber(mount.current, options);
    controller.current = renderer;
    element.dataset.rnHydrated = "";
    return () => {
      renderer.destroy();
      controller.current = null;
      delete element.dataset.rnHydrated;
    };
  }, []);
  useCommitEffect(() => { controller.current?.update(options); });
  return (
    <span {...props} className={["rn-react", className].filter(Boolean).join(" ")} ref={setRoot}>
      <span className="rn-semantic">{formatValue(value, { locales, format })}</span>
      <span className="rn-mount" aria-hidden="true" ref={mount} />
    </span>
  );
});
