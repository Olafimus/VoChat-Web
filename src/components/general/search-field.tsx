import { TextField } from "@mui/material";
import * as React from "react";

const SearchField = ({
  setSearchTerm,
  label = "Search Vocab",
  autoFocus,
  size,
  onKeyDown,
  onBlur,
}: {
  setSearchTerm: (str: string) => void;
  label?: string;
  autoFocus?: boolean;
  size?: "small" | "medium";
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur?: () => void;
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
      />
    </div>
  );
};

export default SearchField;
