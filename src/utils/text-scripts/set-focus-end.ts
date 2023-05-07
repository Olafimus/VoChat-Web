export const setEndFocus = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;
  console.log(el.lastChild);
  if (!el.lastChild) return;
  let textI = el.lastChild?.textContent?.length || 1;
  try {
    range.setStart(el.lastChild, textI);
  } catch {
    console.log("catched nodes: ", el.childNodes.length);
    range.setStart(el.lastChild, 0);
  }
  range.collapse(true);

  sel.removeAllRanges();
  sel.addRange(range);
};
