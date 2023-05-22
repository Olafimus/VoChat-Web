import { urlRegex } from "./add-url";

export const formatMsg = (txt: string) => {
  const wordArr = txt.split(" ");
  wordArr.forEach((word, i) => {
    if (word.match(urlRegex)) {
      const url = word;
      let txt = word;
      if (word.length > 30) txt = txt.slice(8, 27) + "..."; // TODO usemedia query
      if (word.startsWith("www"))
        wordArr[i] = `<a href="https://${url}" target='_blank' >${txt}</a>`;
      else wordArr[i] = `<a href="${url}" target='_blank' >${txt}</a>`;
    } else if (word.length > 30) wordArr[i] = word.slice(0, 27) + "...";
    if (word.length > 40) wordArr[i] = word.slice(0, 23) + "...";
  });
  return wordArr.join(" ");
};
