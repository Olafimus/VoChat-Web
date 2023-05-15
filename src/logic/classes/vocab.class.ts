import { useAppDispatch } from "../../app/hooks";
import { MySelectOptionType } from "../../components/general/multi-select";
import { EditProps } from "../../components/vocabs/add-vocab";

import { VocObj, dummyVocObj, workbookType } from "../types/vocab.types";

export class AllVocabsClass {
  constructor(public vocs: Vocab[]) {}

  addVocab = (voc: Vocab) => {
    this.vocs.push(voc);
  };
  getVocCount() {
    return this.vocs.length;
  }
  getAllVocs = () => {
    return this.vocs;
  };
  getAllLangVocs = (lang: string) => {
    const langVocs: Vocab[] = this.vocs.filter((voc) => {
      if (voc.getLang() === lang) return true;
    });
    return langVocs;
  };

  getFilteredVoc(
    str: string,
    type: "all" | "vocab" | "translation" | "workbook" = "all"
  ) {
    if (type === "all") {
      const filteredVoc = this.vocs.filter((el) =>
        el.getVocabString().includes(str)
      );
      if (filteredVoc === undefined) return [];
      if (filteredVoc) return filteredVoc;
      // return [];
    }
  }

  removeVoc(id: string) {
    const newVocArr = this.vocs.filter((voc) => voc.getId() !== id);
    console.log(newVocArr);
    this.vocs = newVocArr;
    console.log(this.vocs);
  }

  getWbVocs(id: string) {
    const vocArr = this.vocs.filter((voc) => {
      if (voc.getWorkbooks().find((wb) => wb.id === id)) return true;
    });
    return vocArr;
  }

  getNotWbVocs(id: string) {
    const vocArr: Vocab[] = [];
    this.vocs.forEach((voc) => {
      if (!voc.getWorkbooks().find((wb) => wb.id === id)) vocArr.push(voc);
    });
    return vocArr;
  }
  // removeWb(id: string) {
  //   this.vocs.forEach((voc) => voc.removeWb(id));
  // }
}

export class Vocab {
  constructor(public voc: VocObj) {}

  getLang() {
    return this.voc.language;
  }
  getVocObj() {
    return this.voc;
  }
  getVocArr() {
    return this.voc.vocab;
  }

  getVocabString() {
    return this.voc.vocab.join(", ");
  }
  getTranslString() {
    return this.voc.translation.join(", ");
  }
  getVocabSliceString() {
    const vocsFromTwo = [...this.voc.vocab];
    vocsFromTwo.shift();
    return vocsFromTwo.join(", ");
  }
  getTranslSliceString() {
    const translFromTwo = [...this.voc.translation];
    translFromTwo.shift();
    return translFromTwo.join(", ");
  }
  getScore() {
    return this.voc.score;
  }
  getWorkbooks() {
    return this.voc.workbooks;
  }
  getWorkbooksStr() {
    let string = "";
    this.voc.workbooks.forEach((wb) => (string = string + `, ${wb.name}`));
    return string.replace(", ", "");
  }
  getCategories() {
    return this.voc.categories;
  }
  getCategoriesStr() {
    return this.voc.categories.join(", ");
  }
  getPronunc() {
    return this.voc.pronounciation;
  }
  getPronuncStr() {
    return this.voc.pronounciation.join(", ");
  }
  getHints() {
    return this.voc.hints;
  }
  getHintsStr() {
    return this.voc.hints.join(", ");
  }

  getTranslArr() {
    return this.voc.translation;
  }
  getSetImp() {
    return this.voc.setImportance;
  }
  getCalcImp() {
    return this.voc.calcImportance;
  }
  getId() {
    return this.voc.id;
  }
  getEditProps() {
    const categories: MySelectOptionType[] = [];
    this.getCategories().forEach((cat) =>
      categories.push({ label: cat, value: cat })
    );
    const wbs: MySelectOptionType[] = [];
    this.getWorkbooks().forEach((wb) =>
      wbs.push({ label: wb.name, value: wb.id })
    );

    const prop = {
      voc: this.getVocabString(),
      tra: this.getTranslString(),
      pronunc: this.getPronuncStr(),
      hints: this.getHintsStr(),
      categories,
      wbs,
      imp: this.getSetImp(),
    };
    return prop;
  }
  updateVoc(vocObj: VocObj) {
    // this.voc.categories = vocObj.categories
    // this.voc.hints = vocObj.hints
    // this.voc.vocab = vocObj.vocab
    const learnHistory = this.voc.learnHistory;
    const createdAt = this.voc.createdAt;
    const id = this.voc.id;
    const score = this.voc.score;
    this.voc = { ...vocObj, learnHistory, createdAt, id, score };
  }
  removeWb(id: string) {
    const newWb = this.voc.workbooks.filter((wb) => wb.id !== id);
    this.voc = { ...this.voc, workbooks: newWb };
    // console.log(newWb);
  }
  addWb(wb: workbookType) {
    this.voc = { ...this.voc, workbooks: [...this.voc.workbooks, wb] };
  }
}

//export const dummyVoc = new Vocab(dummyVocObj);

//export const allVocDummy = new AllVocabsClass([]//);

// for (let i = 0; i < 10; i++) {
//   allVocDummy.addVocab(dummyVoc);
// }
