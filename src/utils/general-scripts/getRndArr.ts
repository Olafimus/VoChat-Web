export const getRndArr = (amount: number, arr: any[]) => {
  const indexArr: number[] = [];
  const addNewEl = () => {
    const rndNr = Math.floor(Math.random() * arr.length);
    if (!indexArr.includes(rndNr)) {
      indexArr.push(rndNr);
    } else addNewEl();
  };
  while (indexArr.length < amount) addNewEl();

  const newRndArr: any[] = [];
  indexArr.forEach((i) => newRndArr.push(arr[i]));
  return newRndArr;
};
