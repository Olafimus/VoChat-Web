import { useState, useLayoutEffect } from "react";
import { AllVocabsClass, Vocab } from "../../logic/classes/vocab.class";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { changePageNumber } from "../../app/slices/settings-slice";

export const useVocFilter = (
  allVocs: AllVocabsClass,
  dataVocs: AllVocabsClass | null,
  searchString: string,
  render: boolean
): [Vocab[], boolean] => {
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState(allVocs.getAllVocs());
  const [check, setCheck] = useState(false);
  const {
    catFilter,
    wbFilter,
    filterByCreator,
    filterByLang,
    onlyNew,
    onlyUnlearned,
    timeRange,
    maxVocs,
  } = useAppSelector((state) => state.settings.vocabScreenSettings);
  const { friends, id: uid, name } = useAppSelector((state) => state.user);

  useLayoutEffect(() => {
    if (allVocs.getVocCount() > 0 || dataVocs) setCheck(true);
    const vocArr = dataVocs
      ? dataVocs.getFilteredVoc(searchString)
      : allVocs.getFilteredVoc(searchString);
    if (!vocArr) return;
    if (dataVocs) {
      const filVocs = vocArr.filter((voc) => {
        const checkCat =
          catFilter.length > 0
            ? catFilter.map((cat) => voc.getCategories().includes(cat))
            : [true];
        if (checkCat.some((ele) => ele === true)) return true;
      });
      const maxPage = Math.ceil(filVocs.length / maxVocs) || 1;
      dispatch(changePageNumber(maxPage));
      setFilter(filVocs);
      return;
    }
    const filteredVocs = vocArr.filter((voc) => {
      const wbIds = voc.getWorkbooks().map((wb) => wb.id);
      const creatorIds = filterByCreator.map((creator) => {
        const id =
          name === creator
            ? uid
            : friends.find((fr) => fr.name === creator)?.id || "";
        return id;
      });
      const checkWb =
        wbFilter.length > 0 ? wbFilter.map((wb) => wbIds.includes(wb)) : [true];
      const checkCat =
        catFilter.length > 0
          ? catFilter.map((cat) => voc.getCategories().includes(cat))
          : [true];
      const checkLang =
        filterByLang.length > 0
          ? filterByLang.map((lang) => voc.getVocLang() === lang)
          : [true];
      const checkOwn =
        filterByCreator.length > 0
          ? creatorIds.map((creator) => voc.getOwner() === creator)
          : [true];
      const newCheck = onlyNew && Date.now() - voc.getCreatedAt() > timeRange;
      const unlearnedCheck = onlyUnlearned && voc.getLearnHis().length > 0;

      if (
        checkWb.some((ele) => ele === true) &&
        checkCat.some((ele) => ele === true) &&
        checkLang.some((ele) => ele === true) &&
        checkOwn.some((ele) => ele === true) &&
        !newCheck &&
        !unlearnedCheck
      )
        return true;
      else return false;
    });
    const maxPage = Math.ceil(filteredVocs.length / maxVocs) || 1;
    dispatch(changePageNumber(maxPage));
    setFilter(filteredVocs);
  }, [
    searchString,
    render,
    allVocs.getVocCount(),
    dataVocs,
    catFilter,
    wbFilter,
    onlyNew,
    timeRange,
    onlyUnlearned,
    filterByCreator,
    filterByLang,
    maxVocs,
  ]);

  return [filter, check];
};
