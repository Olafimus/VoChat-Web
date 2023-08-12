import React from "react";
import { Vocab } from "../../../logic/classes/vocab.class";
import VocabCard from "./vocab-card";
import { useAppSelector } from "../../../app/hooks";

const VocabColumnSection = ({
  num,
  max: maxColumns,
  vocabs,
}: {
  num: number;
  max: number;
  vocabs: Vocab[];
}) => {
  const { vocabScreenSettings } = useAppSelector((state) => state.settings);
  let vocMaxCount = vocabs.length; // real vocabs hier einsetzen
  if (vocMaxCount > vocabScreenSettings.maxVocs)
    vocMaxCount = vocabScreenSettings.maxVocs;
  const vocPerSection = vocMaxCount / maxColumns;
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
