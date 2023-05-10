import { VocObj } from "../types/vocab.types";

export class AllVocabsClass {
  constructor(protected vocs: Vocab[]) {}

  addVocab = (voc: Vocab) => {
    this.vocs.push(voc);
  };

  getAllVocs = () => {
    return this.vocs;
  };
  getAllLangVocs = (lang: string) => {
    const langVocs: Vocab[] = this.vocs.filter((voc) => {
      if (voc.getLang() === lang) return true;
    });
    return langVocs;
  };
}

export class Vocab {
  constructor(protected voc: VocObj) {}

  getLang() {
    return this.voc.language;
  }
}
