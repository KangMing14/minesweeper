import { useEffect, useRef, type RefObject } from 'react';

/**
 * Moves the keyboard focus to an element when a screen appears, so that a screen reader starts at the new
 * screen's heading and a keyboard user does not have to find it again. Give the element `tabIndex={-1}`.
 *
 * @returns A ref for the element.
 * @example
 * ```tsx
 * const heading = useFocusOnMount<HTMLHeadingElement>();
 * return <h2 ref={heading} tabIndex={-1}>Choose a difficulty</h2>;
 * ```
 */
export function useFocusOnMount<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
