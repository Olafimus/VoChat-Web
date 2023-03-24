export const getFormatedDate = (stamp: number) => {
  const now = new Date()
    .toLocaleString("en-GB", { timeZone: "CET" })
    .slice(0, 10);
  const date = new Date(stamp).toLocaleString("en-GB", {
    timeZone: "CET",
  });
  const rawDate = date.slice(0, 10);
  const clockTime = date.slice(12, 17);
  const day = date.slice(0, 2);
  const month = date.slice(3, 5);
  const year = date.slice(8, 10);

  if (now === rawDate) return clockTime;
  if (now.slice(6, 10) == rawDate.slice(6, 10)) return `${day}.${month}`;
  return `${day}.${month}.${year}`;
};
