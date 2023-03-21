import { Friend } from "../types/user.types";
import { VocObj } from "../types/vocab.types";

export class UserClass {
  constructor(
    public name: string,
    readonly email: string,
    readonly id: string,
    public lastActive: number,
    readonly createdAt: number,
    public conversations: string[],
    public teachLanguages: string[],
    public learnLanguages: string[],
    public friends: Friend[],
    public allVocabs: VocObj[]
  ) {}

  addLearnLang(lang: string) {
    this.learnLanguages.push(lang);
  }
  addTeachLang(lang: string) {
    this.teachLanguages.push(lang);
  }
}
