// src/types/game.ts
export type QuestionType = "select" | "fill" | "number" | "date";

// 你要的題型
export type GameQuestion = {
  id?: string;
  text: string;          // "[]是[]的誰？"
  type: QuestionType;    // select/fill/number/date
  option: string[];      // select 的選項；其他可空陣列
  slots: string[];       // 依序填進 [] 的人物，例如 ["小明","大明"]
  targetRelation?: string; // Phase 1 tree building relation
  attrKey?: string;        // Attribute to store the answer (e.g. birthday)
  targetPersonName?: string;
};

// 前端送回 server 的通用答案
export type GameAnswer =
  | { type: "select"; value: string }
  | { type: "fill"; value: string; genderHint?: "male" | "female" }
  | { type: "number"; value: number | "" }
  | { type: "date"; value: string };
