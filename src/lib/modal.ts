/** Keeps keyboard focus within an open modal and restores it on close. */
export function modal(node: HTMLElement) {
  const previous = document.activeElement as HTMLElement | null;
  const selector = 'button:not(:disabled), input, textarea, select, a[href], [tabindex="0"]';
  const frame = requestAnimationFrame(() =>
    (node.querySelector<HTMLElement>(selector) ?? node).focus(),
  );
  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(node.querySelectorAll<HTMLElement>(selector));
    const first = controls[0],
      last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      node.focus();
      return;
    }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  node.addEventListener('keydown', keydown);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener('keydown', keydown);
      previous?.focus();
    },
  };
}
