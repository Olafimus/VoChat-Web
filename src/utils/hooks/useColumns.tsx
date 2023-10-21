import { useState, useEffect } from "react";
import { useMediaQuery } from "@mui/material";
export const useColumns = (
  breakOne = "750",
  breakTwo = "1075",
  breakThree = "1400"
) => {
  const [columnCount, setColumnCount] = useState(1);
  const matchesOne = useMediaQuery(`(min-width:${breakOne}px)`);
  const matchesTwo = useMediaQuery(`(min-width:${breakTwo}px)`);
  const matchesThree = useMediaQuery(`(min-width:${breakThree}px)`);
  useEffect(() => {
    if (!matchesOne) {
      return setColumnCount(1);
    }
    if (matchesOne) setColumnCount(2);
    if (matchesTwo) setColumnCount(3);
    if (matchesThree) setColumnCount(4);
  }, [matchesOne, matchesTwo, matchesThree]);
  return [columnCount];
};
