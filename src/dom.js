export function setText(selector, text, root = document) {
  const element = root.querySelector(selector);
  if (!element) {
    console.warn(`Missing DOM selector: ${selector}`);
    return false;
  }
  element.textContent = text;
  return true;
}

export function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing DOM selector: ${selector}`);
  return element;
}
