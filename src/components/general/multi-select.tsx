import * as React from "react";
import "./general-components.styles.scss";
import Select from "react-select";
import { useAppSelector } from "../../app/hooks";
import { nanoid } from "@reduxjs/toolkit";

export type MySelectOptionType = {
  label: string;
  value: string;
  color?: string;
  isFixed?: boolean;
  isDisabled?: boolean;
};

type SelectProps = {
  options: MySelectOptionType[];
  placeholder?: string;
  selection: MySelectOptionType[];
  setFunc: (val: MySelectOptionType[]) => void;
};

const MultiSelect = ({
  options,
  placeholder,
  setFunc,
  selection,
}: SelectProps) => {
  const [input, setInput] = React.useState("");
  const [selOptions, setSelOptions] = React.useState([...options]);
  const selectBar = document.getElementById("react-select-415-input");
  const { theme } = useAppSelector((state) => state.settings);

  const inputHandler = (input: string) => {
    let check = false;
    options.forEach((opt) => {
      if (opt.label.toLowerCase().includes(input.toLowerCase())) check = true;
    });
    const newBtn = document.getElementById("new-option-button");
    // if (!newBtn) return;
    if (!check) {
      // newBtn.style.display = "block";
      setInput(input);
    } else {
      // setTimeout(() => (newBtn.style.display = "none"), 200);
    }
  };

  const newSelOption = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    const newBtn = document.getElementById("new-option-button");
    if (!newBtn) return;
    const newOption = {
      label: input,
      value: nanoid(),
    };
    console.log("option: ", newOption);
    setSelOptions((curOpt) => [...curOpt, newOption]);
    setFunc([...selection, newOption]);
    newBtn.style.display = "none";
    console.log(selectBar);
    //setTimeout(() => selectBar.focus(), 1000)
  };

  return (
    <div>
      {/* <span
        id="new-option-button"
        onClick={newSelOption}
        style={{ display: "none", width: "100%" }}
      >
        Add: {input}
      </span> */}
      <Select
        isMulti
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const newOption = {
            label: input,
            value: nanoid(),
          };
          const check = selOptions.filter((opt) => opt.label === input);
          console.log(input);
          if (check.length > 0 || input === "") return;
          setSelOptions((curOpt) => [...curOpt, newOption]);
          setFunc([...selection, newOption]);
        }}
        onChange={(e) => {
          console.log(e);
          const newOption = {
            label: input,
            value: nanoid(),
          };
          setFunc([...e]);
        }}
        onInputChange={inputHandler}
        name="workbooks"
        maxMenuHeight={250}
        options={selOptions}
        className="basic-multi-select"
        classNamePrefix="select"
        placeholder={placeholder ? placeholder : "Select"}
        value={selection}
        id="multiselect-bar"
      />
    </div>
  );
};

export default MultiSelect;
