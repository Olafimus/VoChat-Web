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
    .replaceAll("\n", "-")
    .trim()
    .split("-");
};
