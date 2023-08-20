import { addEmojis } from "./add-emojis";
import {
  emojiShortCuts,
  textHighlightMarker,
} from "./emoji-and-chat-highlighter";

export const formatInnerHTML = (
  txt: string,
  urls: string[] = [],
  params = textHighlightMarker
) => {
  let render = false;
  let newTxt = addEmojis(txt, emojiShortCuts);
  if (newTxt !== txt) render = true;
  params.forEach((para) => {
    const check = () => {
      const firstIndex = newTxt.indexOf(para[0]);
      const lastIndex = newTxt.lastIndexOf(para[0]);
      if (lastIndex > firstIndex + 1) {
        newTxt = newTxt
          .replace(para[0], para[1])
          .replace(para[0], `${para[2]}&nbsp;`);
        render = true;
        if (newTxt.includes(para[0])) check();
      }
    };

    if (newTxt.includes(para[0])) check();
  });
  if (urls.length > 0) {
    urls.forEach((url) => {
      newTxt = newTxt.replace(
        url,
        `<a href="${url}" target='_blank'>${url}</a></>`
      );
    });
    render = true;
  }
  if (render) {
    return newTxt.replaceAll("&nbsp;&nbsp;", "&nbsp;");
  }
};

export const reformatHTMLtoTxt = (
  str: string,
  params = textHighlightMarker
) => {
  let newStr = str;
  if (!newStr) return str;
  params.forEach((para) => {
    newStr = newStr.replaceAll(para[1], para[0]).replaceAll(para[2], para[0]);
  });
  return newStr;
};
