export const urlRegex =
  /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

export const addURL = (str: string) => {
  const txt = str;
  const urls: string[] = [];
  if (!txt) return [];
  const wordArr = txt.split(" ");
  wordArr.forEach((url) => {
    if (url.match(urlRegex)) urls.push(url);
  });
  return urls;
};
