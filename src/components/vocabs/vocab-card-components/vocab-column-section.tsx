import React from "react";
import { Vocab } from "../../../logic/classes/vocab.class";
import VocabCard from "./vocab-card";
import { useAppSelector } from "../../../app/hooks";
import {
  Box,
  Card,
  CircularProgress,
  IconButton,
  Skeleton,
  Typography,
} from "@mui/material";

const VocabColumnSection = ({
  num,
  max: maxColumns,
  vocabs,
  loading,
}: {
  num: number;
  max: number;
  vocabs: Vocab[];
  loading: boolean;
}) => {
  const { vocabScreenSettings } = useAppSelector((state) => state.settings);
  let vocMaxCount = vocabs.length; // real vocabs hier einsetzen
  if (vocMaxCount > vocabScreenSettings.maxVocs)
    vocMaxCount = vocabScreenSettings.maxVocs;
  const vocPerSection = vocMaxCount / maxColumns;
  const start = (num - 1) * vocPerSection;
  const end = start + vocPerSection;

  const SkeletonCard = () => (
    <Box display="flex" justifyContent="center">
      <Card variant="outlined" sx={{ maxWidth: 500, flex: 1 }}>
        <Box display="flex" justifyContent="space-between">
          <Box>
            <Skeleton
              variant="rectangular"
              width={140}
              height="2em"
              sx={{ m: 1, borderRadius: 2 }}
            />
            <Skeleton
              variant="rectangular"
              width={100}
              height="1.5em"
              sx={{ m: 1, mt: 0.5, borderRadius: 2, float: "left" }}
            />
          </Box>
          <Box>
            <Skeleton
              variant="rectangular"
              width={120}
              height="2em"
              sx={{ m: 1, borderRadius: 2 }}
            />
            <Skeleton
              variant="rectangular"
              width={100}
              height="1.5em"
              sx={{ m: 1, mt: 0.5, borderRadius: 2, float: "right" }}
            />
          </Box>
        </Box>
        <Box display="flex" ml={1} my={1}>
          <Skeleton
            variant="circular"
            width={25}
            height={25}
            sx={{ mr: 0.5 }}
          />
          <Skeleton
            variant="circular"
            width={25}
            height={25}
            sx={{ mr: 0.5 }}
          />
          <Skeleton
            variant="circular"
            width={25}
            height={25}
            sx={{ mr: 0.5 }}
          />
          <Skeleton
            variant="circular"
            width={25}
            height={25}
            sx={{ mr: 0.5 }}
          />
          <Skeleton
            variant="circular"
            width={25}
            height={25}
            sx={{ mr: 0.5 }}
          />
        </Box>
      </Card>
    </Box>
  );
  return (
    <section className="vocab-card-column-section">
      {vocabScreenSettings.loading || loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        vocabs
          .slice(start, end)
          .map((voc) => <VocabCard key={voc.getId()} vocab={voc} />)
      )}
    </section>
  );
};

export default VocabColumnSection;
