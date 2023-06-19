import React from "react";
import { Vocab } from "../../../logic/classes/vocab.class";
import WorkbookCard from "./workbook-card/workbook-card";
import { WorkbookType } from "../../../logic/types/vocab.types";

const WorkbookColumnSection = ({
  num,
  max,
  wbs,
}: {
  num: number;
  max: number;
  wbs: WorkbookType[];
}) => {
  let vocMaxCount = wbs.length;
  if (vocMaxCount > 60) vocMaxCount = 60;
  const vocPerSection = vocMaxCount / max;
  const start = (num - 1) * vocPerSection;
  const end = start + vocPerSection;

  return (
    <section className="vocab-card-column-section">
      {wbs.slice(start, end).map((wb) => (
        <WorkbookCard key={wb.id} wb={wb} />
      ))}
    </section>
  );
};

export default WorkbookColumnSection;
