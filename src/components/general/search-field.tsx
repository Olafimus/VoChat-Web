import { TextField } from "@mui/material";
import * as React from "react";

const SearchParent = () => {
  const [searchTerm, setSearchTerm] = React.useState("");

  return <SearchField setSearchTerm={setSearchTerm} />;
};

const SearchField = ({
  setSearchTerm,
}: {
  setSearchTerm: (str: string) => void;
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
        label="Search vocab"
        value={typeTerm}
        onChange={handleInputChange}
      />
    </div>
  );
};

export default SearchField;
