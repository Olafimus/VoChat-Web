// export function setEndFocus(id: string) {
//   var el = document.getElementById(id);
//   if (!el) return;
//   var range = document.createRange();
//   var sel = window.getSelection();
//   if (!sel) return;
//   const nodeI = el.childNodes.length - 1;
//   const textI = 1;
//   range.setStart(el.childNodes[nodeI], textI);
//   range.collapse(true);

//   sel.removeAllRanges();
//   sel.addRange(range);
// }

// export const textHighlightMarker = [
//   ["*", "<b>", "</b>"],
//   ["#", "<i>", "</i>"],
//   ["(e)", "<span class='text-emoji'>", "</span>"],
// ];

// export const emojiShortCuts = [
//   [":)", "😊"],
//   [":-)", "😊"],
//   [":D", "😂"],
//   [":-D", "😂"],
//   [":O", "😮"],
//   [":-O", "😮"],
//   [":(", "☹️"],
//   [":-(", "☹️"],
//   [":'(", "😢"],
//   [":*", "😘"],
//   ["<3", "❤️"],
//   ["(party)", "🎉"],
//   ["(cool)", "😎"],
//   ["(shrug)", "🤷‍♂️"],
//   ["(think)", "🤔"],
//   ["(thumbsup)", "👍"],
//   ["(thumb)", "👍"],
//   ["(seeno)", "🙈"],
//   ["(seenoevil)", "🙈"],
//   ["(devil)", "😈"],
// ];

// export const addEmojis = (string: string, eShorts: string[][]) => {
//   let newString = string;
//   const check = (emoji: string[]) => {
//     if (!newString.includes(emoji[0])) return;
//     newString = newString.replaceAll(emoji[0], `(e)${emoji[1]}(e)&nbsp`);
//   };
//   eShorts.forEach((emoji) => {
//     check(emoji);
//   });
//   return newString;
// };

// export const urlRegex =
//   /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

// export const addURL = (divId: string) => {
//   const textfeld = document.getElementById(divId);
//   if (!textfeld) return;
//   const txt = textfeld.textContent;
//   if (!txt) return;
//   const urls: string[] = [];

//   const wordArr = txt.split(" ");
//   wordArr.forEach((url) => {
//     if (url.match(urlRegex)) urls.push(url);
//   });
//   return urls;
// };

export const dummyyy = 1;
