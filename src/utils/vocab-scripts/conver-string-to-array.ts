export const createArrFromString = (el: string) => {
  return el
    .replaceAll("  ", " ")
    .replaceAll(" , ", "-")
    .replaceAll(", ", "-")
    .replaceAll(" ,", "-")
    .replaceAll(" ; ", "-")
    .replaceAll("; ", "-")
    .replaceAll(" ;", "-")
    .replaceAll(",", "-")
    .trim()
    .split("-");
};

console.log(createArrFromString("test ,it, like ; its , hot"));
