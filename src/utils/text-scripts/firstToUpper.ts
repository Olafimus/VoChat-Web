export const firstToUpper = (str: string) => {
  const firstletter = str[0].toUpperCase();
  return firstletter + str.slice(1, str.length);
};
