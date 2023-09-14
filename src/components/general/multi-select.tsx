import * as React from "react";
import "./general-components.styles.scss";
import Select from "react-select";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { nanoid } from "@reduxjs/toolkit";
import { addCategory, addWorkbook } from "../../app/slices/vocabs-slice";
import { WorkbookType } from "../../logic/types/vocab.types";

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
  type: "categories" | "workbooks";
};

const MultiSelect = ({
  options,
  placeholder,
  setFunc,
  selection,
  type,
}: SelectProps) => {
  const [input, setInput] = React.useState("");
  const [selOptions, setSelOptions] = React.useState([...options]);
  // const selectBar = document.getElementById("react-select-415-input");
  const { id: uid } = useAppSelector((state) => state.user);
  const { currentLang, nativeLang } = useAppSelector((state) => state.vocabs);
  const dispatch = useAppDispatch();

  const inputHandler = (input: string) => {
    let check = false;
    options.forEach((opt) => {
      if (opt.label.toLowerCase().includes(input.toLowerCase())) check = true;
    });
    if (!check) {
      setInput(input);
    }
  };

  return (
    <div>
      <Select
        isMulti
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const newOption = {
            label: input,
            value: nanoid(),
          };
          const check = selOptions.filter((opt) => opt.label === input);
          if (check.length > 0 || input === "") return;
          if (type === "workbooks") {
            const newWb: WorkbookType = {
              owner: uid,
              name: newOption.label,
              id: newOption.value,
              vocLanguage: currentLang,
              transLanguage: nativeLang,
              score: 0,
              createdAt: Date.now(),
              createdBy: uid,
              lastLearned: 0,
              lastUpdated: 0,
            };
            dispatch(addWorkbook(newWb));
          }
          if (type === "categories")
            dispatch(addCategory({ label: newOption.label }));
          setSelOptions((curOpt) => [...curOpt, newOption]);
          setFunc([...selection, newOption]);
        }}
        onChange={(e) => {
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
