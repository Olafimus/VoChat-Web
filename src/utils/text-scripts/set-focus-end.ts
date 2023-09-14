export const setEndFocus = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;
  if (!el.lastChild) return;
  let textI = el.lastChild?.textContent?.length || 1;
  try {
    range.setStart(el.lastChild, textI);
  } catch {
    range.setStart(el.lastChild, 0);
  }
  range.collapse(true);

  sel.removeAllRanges();
  sel.addRange(range);
};
