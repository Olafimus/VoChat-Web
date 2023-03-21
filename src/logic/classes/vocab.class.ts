import { VocObj } from "../types/vocab.types";

export class AllVocabs {
  constructor(protected vocs: Vocab[]) {}
}

export class Vocab {
  constructor(protected voc: VocObj) {}
}
