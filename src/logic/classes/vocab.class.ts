import { useAppDispatch } from "../../app/hooks";
import { MySelectOptionType } from "../../components/general/multi-select";
import { EditProps } from "../../components/vocabs/add-vocab";

import { VocObj, WorkbookType } from "../types/vocab.types";

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
      if (voc.getVocLang() === lang) return true;
    });
    return langVocs;
  };

  getLearnVocs() {}

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
    this.vocs = newVocArr;
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

  getDefaultVocs(num: number, timeRef = 10, reThrowMistakes = false) {
    // timeRef describes the threshold in minutes for vocabs to be excluded in the next learn run. If timeRef = 10, than all vocabs which were learned in the last 10 minutes will be excluded
    // reThrowMistakes deaktiviert die timeRef für Vokabeln die zuletzt falsch beantwortet wurden
    const sortedVocs = this.vocs
      .sort((a, b) => b.getCalcImp() - a.getCalcImp())
      .slice(0, num * 2 + 10);
    sortedVocs.forEach((voc) => console.log(voc.getCalcImp()));
    const newDefaultVocs: Vocab[] = [];
    sortedVocs.forEach((voc) => {
      const learnHis = voc.getRecentHis(timeRef);
      if (learnHis.length === 0) newDefaultVocs.push(voc);
      if (!reThrowMistakes) return;

      const recentResults = learnHis.map((his) => his.result);
      if (!recentResults.every((res) => res === true)) newDefaultVocs.push(voc);
    });
    return newDefaultVocs.slice(0, num);
  }
}

export class Vocab {
  constructor(
    protected voc: VocObj,
    protected checked = false,
    protected result = false,
    protected lastAnswer = ""
  ) {}

  getVocLang() {
    return this.voc.vocLanguage;
  }
  getOwner() {
    return this.voc.owner;
  }
  getTransLang() {
    return this.voc.transLanguage;
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
  getChecked() {
    return this.checked;
  }
  getLastAnswer() {
    return this.lastAnswer;
  }
  getResult() {
    return this.result;
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
  addWb(wb: WorkbookType) {
    this.voc = { ...this.voc, workbooks: [...this.voc.workbooks, wb] };
  }
  addLearnHis(result: boolean) {
    const learnHistory = [...this.voc.learnHistory];
    learnHistory.push({ timeStamp: Date.now(), result });
    this.voc = { ...this.voc, learnHistory };
    return this;
  }
  calcScore(result: boolean) {
    let score = this.voc.score;
    if (score === 0) score = 5;
    if (result && score < 10) score = score + 1;
    if (!result && score > 1) score = score - 1;
    this.voc = { ...this.voc, score };
    return this;
  }

  calcImp(timeRef: number) {
    const now = Date.now();
    const timeWindow = 30 * 24 * 60 * 60 * 1000; // Zeitfenster von 30 Tagen
    const inactivityThreshold = 7 * 24 * 60 * 60 * 1000; // Inaktivitätsschwelle von 7 Tagen
    const longInactivityThreshold = inactivityThreshold * 4; // Inaktivitätsschwelle von 28 Tagen
    const inactivityBoost = 1; // Erhöhungsfaktor für Inaktivität bei letztem falschen Ergebnis
    const lastEntriesTimeWindow = 5 * 60 * 1000; // Zeitfenster für die letzten Einträge (5 Minuten)

    // Filtern der learnHistory-Einträge innerhalb des Zeitfensters
    const recentLearnHistory = this.getRecentHis(timeRef);
    // this.voc.learnHistory.filter(
    //  entry => now - entry.timeStamp <= timeWindow
    // );

    // Prüfung, ob die Vokabel seit einer bestimmten Zeit nicht mehr gelernt wurde
    const lastLearnedTimestamp =
      recentLearnHistory.length > 0
        ? recentLearnHistory[recentLearnHistory.length - 1].timeStamp
        : 0;
    const isInactive = now - lastLearnedTimestamp >= inactivityThreshold;
    const isLongInactive =
      now - lastLearnedTimestamp >= longInactivityThreshold;

    // Prüfung, ob das letzte Ergebnis "false" war innerhalb des letzten Eintragszeitfensters
    const lastResultWasFalse = recentLearnHistory.some(
      (entry) =>
        now - entry.timeStamp <= lastEntriesTimeWindow && entry.result === false
    );

    // Berechnung der Häufigkeit der falschen Antworten innerhalb des Zeitfensters
    const incorrectCount = recentLearnHistory.reduce(
      (count, entry) => count + (entry.result === false ? 1 : 0),
      0
    );

    console.log(incorrectCount, "recent: ", recentLearnHistory.length);

    let failFactor = incorrectCount / recentLearnHistory.length;
    if (!failFactor) failFactor = 1;

    console.log(failFactor);

    // Berechnung der Importance mit zusätzlicher Berücksichtigung der Inaktivität und des letzten falschen Ergebnisses
    let calcImportance = this.voc.setImportance * failFactor;

    if (isInactive && lastResultWasFalse) {
      calcImportance += inactivityBoost; // Stärkere Erhöhung der Importance bei Inaktivität nach letztem falschen Ergebnis
      if (isLongInactive) calcImportance += inactivityBoost;
    }
    this.voc = { ...this.voc, calcImportance };
    return this;
  }
  setChecked(val: boolean) {
    this.checked = val;
  }
  setResult(val: boolean) {
    this.result = val;
  }
  setlastAnswer(val: string) {
    this.lastAnswer = val;
  }
  resetStatus() {
    this.result = false;
    this.checked = false;
    this.lastAnswer = "";
  }
  getRecentHis(timeRef: number) {
    const recentHis = [];
    const now = Date.now();
    const threshold = timeRef * 60 * 1000; // convertes timeRef (minutes) in milliseconds
    for (let i = this.voc.learnHistory.length - 1; i > -1; i--) {
      if (now - this.voc.learnHistory[i].timeStamp < threshold) {
        recentHis.push(this.voc.learnHistory[i]);
      } else break;
    }
    return recentHis;
  }
}
