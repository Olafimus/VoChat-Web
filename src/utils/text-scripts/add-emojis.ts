export const addEmojis = (string: string, eShorts: string[][]) => {
  let newString = string;
  const check = (emoji: string[]) => {
    if (!newString.includes(emoji[0])) return;
    newString = newString.replaceAll(emoji[0], `${emoji[1]}`);
  };
  eShorts.forEach((emoji) => {
    check(emoji);
  });
  return newString;
};
