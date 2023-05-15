import React from "react";
import { Vocab } from "../../../logic/classes/vocab.class";
import VocabCard from "./vocab-card";

const VocabColumnSection = ({
  num,
  max,
  vocabs,
}: {
  num: number;
  max: number;
  vocabs: Vocab[];
}) => {
  let vocMaxCount = vocabs.length; // real vocabs hier einsetzen
  if (vocMaxCount > 60) vocMaxCount = 60;
  const vocPerSection = vocMaxCount / max;
  const start = (num - 1) * vocPerSection;
  const end = start + vocPerSection;

  return (
    <section className="vocab-card-column-section">
      {vocabs.slice(start, end).map((voc) => (
        <VocabCard key={voc.getId()} vocab={voc} />
      ))}
    </section>
  );
};

export default VocabColumnSection;
