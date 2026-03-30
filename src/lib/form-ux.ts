export function getSmartPlaceholder(label?: string, fallback = "Isi nilai") {
  if (!label) return fallback;
  const plain = label.replace("*", "").trim();
  if (!plain) return fallback;
  return `Masukkan ${plain.toLowerCase()}`;
}

export function getSmartHelperText(label?: string, required?: boolean) {
  if (!label) return undefined;
  if (required) return `Field ${label.replace("*", "").trim()} wajib diisi`;
  return undefined;
}

export function moveToNextField(currentElement: HTMLElement) {
  const form = currentElement.closest("form");
  if (!form) return;
  const selector = [
    "input:not([type=hidden]):not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const focusables = Array.from(form.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.offsetParent !== null
  );
  const currentIndex = focusables.findIndex((element) => element === currentElement);
  if (currentIndex < 0) return;
  const next = focusables[currentIndex + 1];
  next?.focus();
}
