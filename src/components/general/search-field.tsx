import { TextField } from "@mui/material";
import * as React from "react";

const SearchField = ({
  setSearchTerm,
  label = "Search Vocab",
  autoFocus,
  size,
  onKeyDown,
  onBlur,
  ref,
  focus = false,
}: {
  setSearchTerm: (str: string) => void;
  label?: string;
  autoFocus?: boolean;
  size?: "small" | "medium";
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur?: () => void;
  ref?: React.RefObject<HTMLInputElement>;
  focus?: boolean;
}) => {
  const [typeTerm, setTypeTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState([]);

  React.useEffect(() => {
    // debounce algorithm - only search when user stops typing for 500ms
    const debounce = setTimeout(() => {
      setSearchTerm(typeTerm);
    }, 500);

    return () => clearTimeout(debounce);
  }, [typeTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypeTerm(e.currentTarget.value);
  };

  return (
    <div>
      <TextField
        type="text"
        variant="standard"
        label={label}
        value={typeTerm}
        onChange={handleInputChange}
        ref={ref}
        autoFocus={focus}
        onBlur={onBlur}
      />
    </div>
  );
};

export default SearchField;
