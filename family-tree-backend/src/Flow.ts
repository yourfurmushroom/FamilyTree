import Room from "./Module/Room";
import type Player from "./Module/Player";
import { Status } from "./Module/Status";
import { generateGraphData } from "./Module/GraphProcessor";
import type { QuestionTemplate } from "./Utilities";
import type { GameAnswer, GameQuestion } from "./Module/questionType";

export type FlowIO = {
  broadcast: (roomCode: string, msg: any) => void;
  sendToPlayer: (playerUUID: string, msg: any) => void;
};

// ─────────────────────────────────────────────
// Helpers: parse a phase-1 answer into relation data
// ─────────────────────────────────────────────
function parsePhase1Answer(
  questionText: string,
  answer: string | number,
  subject: string
): Array<{ relation: string; a: string; b: string }> {
  const ans = String(answer).trim();
  const results: Array<{ relation: string; a: string; b: string }> = [];
  if (!ans || ans === "跳過" || ans === "") return results;
  const t = questionText;
  if (t.includes("爸爸") && (t.includes("是誰") || t.includes("叫什麼"))) { results.push({ relation: "爸爸", a: subject, b: ans }); return results; }
  if (t.includes("媽媽") && (t.includes("是誰") || t.includes("叫什麼"))) { results.push({ relation: "媽媽", a: subject, b: ans }); return results; }
  if ((t.includes("配偶") || t.includes("老公") || t.includes("老婆") || t.includes("丈夫") || t.includes("妻子"))
    && (t.includes("是誰") || t.includes("叫什麼"))) { results.push({ relation: "配偶", a: subject, b: ans }); return results; }
  if (t.includes("爺爺") && t.includes("是誰")) { results.push({ relation: "爺爺", a: subject, b: ans }); return results; }
  if (t.includes("奶奶") && t.includes("是誰")) { results.push({ relation: "奶奶", a: subject, b: ans }); return results; }
  if (t.includes("外公") && t.includes("是誰")) { results.push({ relation: "外公", a: subject, b: ans }); return results; }
  if (t.includes("外婆") && t.includes("是誰")) { results.push({ relation: "外婆", a: subject, b: ans }); return results; }
  return results;
}

type PlayerState = {
  phase: 1 | 2;
  pendingTreeQuestions: GameQuestion[];
  currentQuestion?: GameQuestion;
  answeredCount: number;
};

export default class GameFlow {
  private started = false;
  private ended = false;
  private endAtMs = 0;
  private tickTimer?: NodeJS.Timeout;

  private playerStates = new Map<string, PlayerState>();

  private readonly questionList: QuestionTemplate[];
  private readonly treeQuestionList: QuestionTemplate[];
  private room: Room;
  private io: FlowIO;
  private durationSeconds: number;

  constructor(
    room: Room,
    io: FlowIO,
    questionList: QuestionTemplate[],
    treeQuestionList: QuestionTemplate[],
    durationSeconds: number = 120
  ) {
    this.room = room;
    this.io = io;
    this.durationSeconds = durationSeconds;
    this.questionList = questionList;
    this.treeQuestionList = treeQuestionList;
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  start() {
    if (this.started) return;
    this.started = true;

    this.room.setStatus(Status.Playing);
    this.endAtMs = Date.now() + this.durationSeconds * 1000;

    this.io.broadcast(this.room.getRoomCode(), {
      action: "game_started",
      durationSeconds: this.durationSeconds,
    });

    const members = this.room.getMembers();
    for (const member of members) {
      this.playerStates.set(member.getUUID(), {
        phase: 1,
        pendingTreeQuestions: this.treeQuestionList.map((t, idx) => ({
          id: t.id || `tree-${idx}-${Date.now()}`,
          text: t.text,
          type: t.type,
          option: t.option ?? [],
          slots: [],
          targetRelation: t.targetRelation,
          attrKey: t.attrKey,
        })),
        answeredCount: 0,
      });
      this.nextQuestionForPlayer(member);
    }

    this.tickTimer = setInterval(() => {
      const remaining = this.getRemainingSeconds();
      this.io.broadcast(this.room.getRoomCode(), {
        action: "tick",
        remainingSeconds: remaining,
      });
      if (remaining <= 0) this.end();
    }, 1000);
  }

  onAnswer(player: Player, payload: any) {
    if (!this.started || this.ended) return;
    if (this.getRemainingSeconds() <= 0) return;

    const state = this.playerStates.get(player.getUUID());
    if (!state || !state.currentQuestion) return;

    const q = state.currentQuestion;
    const ans = payload?.answer as GameAnswer;
    if (!ans) return;

    if (ans.value === "" || String(ans.value) === "跳過") {
      this.handleSkip(player, q);
    } else {
      if (state.phase === 1) {
        this.handlePhase1Answer(player, q, ans, state);
      } else {
        this.handlePhase2Answer(player, q, ans, payload, state);
      }
    }

    state.answeredCount++;
    this.nextQuestionForPlayer(player);
  }

  // ─────────────────────────────────────────────
  // Private Phase Handlers
  // ─────────────────────────────────────────────

  private handleSkip(player: Player, q: GameQuestion) {
    this.io.broadcast(this.room.getRoomCode(), {
      action: "answer_received",
      data: { questionId: q.id, answer: "跳過", answerer: player.getName(), addedData: [] },
    });
  }

  private handlePhase1Answer(player: Player, q: GameQuestion, ans: GameAnswer, state: PlayerState) {
    const rawVal = ans.value;
    const addedData: any[] = [];
    const targetRelation = q.targetRelation || "未知";

    const processFormattedData = (relObj: { relation: string, a: string, b: string }) => {
      const d = { ...relObj, answerer: player.getName() };
      this.room.removeData((old) => old.relation === d.relation && old.a === d.a && typeof old.b === "string" && old.b.startsWith("未知"));
      this.room.addData(d);
      addedData.push(d);
    };

    if (q.targetRelation === "兒子" && q.type === "number") {
      const count = Number(rawVal);
      if (!isNaN(count) && count > 0) {
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i <= count; i++) {
          dynamicQuestions.push({
            id: `tree-child${i}-name-${Date.now()}`,
            text: `排行第${i}的小孩叫什麼名字？`,
            type: "fill", option: [], slots: [],
            targetRelation: "兒子",
            metadata: { trigger: "ask_child_details", rank: i }
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
      }
    } else if (q.id === "gen_parents_children") {
      const count = Number(rawVal);
      if (!isNaN(count) && count > 1) { // >= 2 since 1 is yourself
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i < count; i++) {
          dynamicQuestions.push({
            id: `tree-sibling${i}-name-${Date.now()}`,
            text: `除了您以外，排行第${i}的兄弟姐妹叫什麼名字？`,
            type: "fill", option: [], slots: [],
            targetRelation: "兄弟姐妹",
            metadata: { trigger: "ask_sibling_details" }
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
      }
    } else if (q.id === "gen_inlaw_status" && typeof rawVal === "string") {
      const dynamicQuestions: GameQuestion[] = [];
      if (rawVal.includes("追溯爸爸")) {
        dynamicQuestions.push(
          { id: `tree-gpa-name-${Date.now()}`, text: "爸爸的爸爸 (爺爺) 叫什麼名字？", type: "fill", option: [], slots: [], targetRelation: "爺爺", attrKey: undefined, metadata: { trigger: "ask_gpa_details" } },
          { id: `tree-gma-name-${Date.now()}`, text: "爸爸的媽媽 (奶奶) 叫什麼名字？", type: "fill", option: [], slots: [], targetRelation: "奶奶", attrKey: undefined, metadata: { trigger: "ask_gma_details" } },
          { id: `gen_father_siblings`, text: "請問爸爸總共有幾個兄弟姐妹？(包含爸爸自己)", type: "number", option: [], slots: [] }
        );
      } else if (rawVal.includes("追溯媽媽")) {
        dynamicQuestions.push(
          { id: `tree-mgpa-name-${Date.now()}`, text: "媽媽的爸爸 (外公) 叫什麼名字？", type: "fill", option: [], slots: [], targetRelation: "外公", attrKey: undefined, metadata: { trigger: "ask_mgpa_details" } },
          { id: `tree-mgma-name-${Date.now()}`, text: "媽媽的媽媽 (外婆) 叫什麼名字？", type: "fill", option: [], slots: [], targetRelation: "外婆", attrKey: undefined, metadata: { trigger: "ask_mgma_details" } },
          { id: `gen_mother_siblings`, text: "請問媽媽總共有幾個兄弟姐妹？(包含媽媽自己)", type: "number", option: [], slots: [] }
        );
      }
      state.pendingTreeQuestions.unshift(...dynamicQuestions);
    } else if (q.id === "gen_father_siblings") {
      const count = Number(rawVal);
      if (!isNaN(count) && count > 1) {
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i < count; i++) {
          dynamicQuestions.push({
            id: `tree-uncle${i}-name-${Date.now()}`,
            text: `除了爸爸以外，排行第${i}的爸爸手足 (叔叔/伯伯/姑姑) 叫什麼？`,
            type: "fill", option: [], slots: [],
            targetRelation: "叔伯姑",
            metadata: { trigger: "ask_uncle_details" }
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
      }
    } else if (q.id === "gen_mother_siblings") {
      const count = Number(rawVal);
      if (!isNaN(count) && count > 1) {
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i < count; i++) {
          dynamicQuestions.push({
            id: `tree-aunt${i}-name-${Date.now()}`,
            text: `除了媽媽以外，排行第${i}的媽媽手足 (舅舅/阿姨) 叫什麼？`,
            type: "fill", option: [], slots: [],
            targetRelation: "舅姨",
            metadata: { trigger: "ask_aunt_details" }
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
      }
    } else if (q.targetRelation?.endsWith("小孩數量") && q.type === "number") {
      const parentName = q.metadata?.parentName;
      const count = Number(rawVal);
      if (count > 0 && parentName) {
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i <= count; i++) {
          dynamicQuestions.push({
            id: `tree-cousin${i}-name-${Date.now()}`,
            text: `${parentName}的第${i}個小孩叫什麼名字？`,
            type: "fill", option: [], slots: [],
            targetRelation: "配偶", metadata: { trigger: "ask_cousin_details", parentName }
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
      }
    } else if (q.metadata?.trigger === "ask_cousin_details") {
      const parentName = q.metadata.parentName;
      const cousinName = String(rawVal);
      this.room.addData({ relation: "兒子", a: parentName, b: cousinName, answerer: player.getName() });
      this.room.setAttr(cousinName, "displayName", cousinName);
      state.pendingTreeQuestions.unshift(
        { id: `tree-cousin-date-${Date.now()}`, text: `${cousinName}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: "未知", targetPersonName: cousinName, attrKey: "birthday" },
        { id: `tree-cousin-gender-${Date.now()}`, text: `${cousinName}是男性還是女性？`, type: "select", option: ["男性", "女性"], slots: [], targetRelation: "未知", targetPersonName: cousinName, attrKey: "gender" }
      );
    } else if (q.attrKey) {
      let targetName = q.targetPersonName;
      if (!targetName) {
        const rels = this.room.getAllData().filter(d => d.a === player.getName() && d.relation === q.targetRelation);
        targetName = rels.length > 0 ? rels[rels.length - 1].b : `未知${q.targetRelation}_${player.getName()}`;
      }
      
      let attrValue = String(rawVal);
      if (q.attrKey === "gender") {
        if (attrValue === "男性") attrValue = "male";
        else if (attrValue === "女性") attrValue = "female";
      }
      
      this.room.setAttr(targetName, q.attrKey as any, attrValue);
    } else {
      processFormattedData({ relation: targetRelation, a: player.getName(), b: String(rawVal) });
      this.room.setAttr(String(rawVal), "displayName", String(rawVal));

      // Trigger evaluations to sequentially prompt for subsequent branching
      const safeTrigger = q.metadata?.trigger || (
        q.id === "gen_father_name" ? "ask_father_details" :
        q.id === "gen_mother_name" ? "ask_mother_details" :
        q.id === "gen_spouse_name" ? "ask_spouse_details" : false
      );

      if (safeTrigger === "ask_child_details") {
        this.room.setAttr(String(rawVal), "rank", String(q.metadata?.rank));
        state.pendingTreeQuestions.unshift(
          { id: `tree-child-date-${Date.now()}`, text: `${rawVal}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: "兒子", targetPersonName: String(rawVal), attrKey: "birthday" },
          { id: `tree-child-gender-${Date.now()}`, text: `${rawVal}的性別是男性還是女性？`, type: "select", option: ["男性", "女性"], slots: [], targetRelation: "兒子", targetPersonName: String(rawVal), attrKey: "gender" }
        );
      } else if (safeTrigger === "ask_sibling_details") {
        state.pendingTreeQuestions.unshift(
          { id: `tree-sibling-date-${Date.now()}`, text: `${rawVal}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: "兄弟姐妹", targetPersonName: String(rawVal), attrKey: "birthday" },
          { id: `tree-sibling-gender-${Date.now()}`, text: `${rawVal}的性別是男性還是女性？`, type: "select", option: ["男性", "女性"], slots: [], targetRelation: "兄弟姐妹", targetPersonName: String(rawVal), attrKey: "gender" }
        );
      } else if (safeTrigger === "ask_father_details" || safeTrigger === "ask_mother_details" || safeTrigger === "ask_spouse_details") {
        // Fallback backward-compatibility support for Father/Mother/Spouse birthday
        state.pendingTreeQuestions.unshift(
          { id: `tree-parent-date-${Date.now()}`, text: `${rawVal}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: q.targetRelation, targetPersonName: String(rawVal), attrKey: "birthday" }
        );
      } else if (safeTrigger === "ask_gpa_details" || safeTrigger === "ask_gma_details" || safeTrigger === "ask_mgpa_details" || safeTrigger === "ask_mgma_details") {
        state.pendingTreeQuestions.unshift(
          { id: `tree-gp-date-${Date.now()}`, text: `${rawVal}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: q.targetRelation, targetPersonName: String(rawVal), attrKey: "birthday" }
        );
      } else if (safeTrigger === "ask_uncle_details" || safeTrigger === "ask_aunt_details") {
        state.pendingTreeQuestions.unshift(
          { id: `tree-relative-date-${Date.now()}`, text: `${rawVal}的生日是何時？`, type: "date", option: [], slots: [], targetRelation: q.targetRelation, targetPersonName: String(rawVal), attrKey: "birthday" },
          { id: `tree-relative-gender-${Date.now()}`, text: `${rawVal}的性別是男性還是女性？`, type: "select", option: ["男性", "女性"], slots: [], targetRelation: q.targetRelation, targetPersonName: String(rawVal), attrKey: "gender" },
          { id: `tree-relative-childcount-${Date.now()}`, text: `${rawVal}有幾個小孩？(表/堂兄弟)`, type: "number", option: [], slots: [], targetRelation: q.targetRelation + "小孩數量", metadata: { parentName: String(rawVal) } }
        );
      }
    }

    this.io.broadcast(this.room.getRoomCode(), { action: "new_attr", attrs: this.room.getAttrs() });
    this.io.broadcast(this.room.getRoomCode(), {
      action: "answer_received",
      data: { questionId: q.id, answer: rawVal, answerer: player.getName(), addedData },
    });
    for (const d of addedData) {
      this.io.broadcast(this.room.getRoomCode(), { action: "new_answer", data: d });
    }
  }

  private handlePhase2Answer(player: Player, q: GameQuestion, ans: GameAnswer, payload: any, state: PlayerState) {
    const rawVal = ans.value;
    const addedData: any[] = [];

    if (payload.relations && Array.isArray(payload.relations) && payload.relations.length > 0) {
      for (const data of payload.relations) {
        const formattedData = { ...data, answerer: player.getName() };
        this.room.removeData((d) => (d.relation === data.relation && d.b === data.b && typeof d.a === "string" && d.a.startsWith("未知")) || (d.relation === data.relation && d.a === data.a && typeof d.b === "string" && d.b.startsWith("未知")));
        this.room.addData(formattedData);
        addedData.push(formattedData);
      }
    }

    if ((q.text.includes("幾個小孩") || q.text.includes("幾個孩子") || q.text.includes("生了幾個")) && q.slots && q.slots.length > 0) {
      const parentName = q.slots[0];
      const count = Number(rawVal);
      if (!isNaN(count) && count > 0) {
        const dynamicQuestions: GameQuestion[] = [];
        for (let i = 1; i <= count; i++) {
          const childPlaceholder = `未知小孩_${parentName}_${i}`;
          dynamicQuestions.push({
            id: `p2-child${i}-name-${Date.now()}`,
            text: `${parentName}的排行第${i}小孩叫什麼名字？`,
            type: "fill",
            option: [], slots: [],
            targetRelation: "兒子_temp",
            attrKey: `child_name_${childPlaceholder}`,
          });
          dynamicQuestions.push({
            id: `p2-child${i}-date-${Date.now()}`,
            text: `他/她的生日是何時？`,
            type: "date",
            option: [], slots: [],
            targetRelation: "兒子",
            targetPersonName: childPlaceholder,
            attrKey: "birthday",
          });
          dynamicQuestions.push({
            id: `p2-child${i}-gender-${Date.now()}`,
            text: `性別是男性還是女性？`,
            type: "select",
            option: ["男性", "女性"], slots: [],
            targetRelation: "兒子",
            targetPersonName: childPlaceholder,
            attrKey: "gender",
          });
        }
        state.pendingTreeQuestions.unshift(...dynamicQuestions);
        state.phase = 1; 
      }
    }

    this.io.broadcast(this.room.getRoomCode(), {
      action: "answer_received",
      data: { questionId: q.id, answer: ans, answerer: player.getName(), addedData },
    });
    for (const d of addedData) {
      this.io.broadcast(this.room.getRoomCode(), { action: "new_answer", data: d });
    }
  }

  // ─────────────────────────────────────────────
  // Question Queueing
  // ─────────────────────────────────────────────

  private nextQuestionForPlayer(player: Player) {
    if (this.ended) return;
    const state = this.playerStates.get(player.getUUID());
    if (!state) return;

    if (state.phase === 1) {
      if (state.pendingTreeQuestions.length > 0) {
        state.currentQuestion = state.pendingTreeQuestions.shift();
      } else {
        state.phase = 2; 
        state.currentQuestion = this.makePhase2Question();
      }
    } else {
      state.currentQuestion = this.makePhase2Question();
    }

    this.io.sendToPlayer(player.getUUID(), {
      action: "question",
      question: state.currentQuestion?.text,
      questionObj: state.currentQuestion,
    });
  }

  private knownNames(): string[] {
    const set = new Set<string>();
    for (const p of this.room.getMembers()) set.add(p.getName());
    for (const d of this.room.getAllData()) {
      if (!String(d.a).startsWith("未知")) set.add(d.a);
      if (!String(d.b).startsWith("未知")) set.add(d.b);
    }
    return Array.from(set);
  }

  private pickPeople(n: number): string[] {
    const arr = this.knownNames();
    if (arr.length === 0) return Array.from({ length: n }, (_, i) => `P${i + 1}`);
    const slots: string[] = [];
    while (slots.length < n) {
      const x = arr[Math.floor(Math.random() * arr.length)];
      if (n >= 2 && slots.length === 1 && x === slots[0]) continue;
      slots.push(x);
    }
    return slots;
  }

  private makePhase2Question(): GameQuestion {
    const t = this.questionList[Math.floor(Math.random() * this.questionList.length)];
    const slotCount = (t.text.match(/\[\]/g) || []).length;
    const slots = slotCount > 0 ? this.pickPeople(slotCount) : [];
    return {
      id: `rand-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: t.text,
      type: t.type,
      option: t.option ?? [],
      slots,
    };
  }

  private getRemainingSeconds() {
    const ms = this.endAtMs - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }

  end() {
    if (this.ended) return;
    this.ended = true;

    if (this.tickTimer) clearInterval(this.tickTimer);
    this.room.setStatus(Status.Complete);

    const allData = this.room.getAllData();
    const countByPlayer: Record<string, number> = {};
    for (const member of this.room.getMembers()) {
      countByPlayer[member.getName()] = this.playerStates.get(member.getUUID())?.answeredCount ?? 0;
    }

    const graphData = generateGraphData(allData);
    this.io.broadcast(this.room.getRoomCode(), {
      action: "game_ended",
      data: allData,
      graph: graphData,
      attrs: this.room.getAttrs(),
      stats: { countByPlayer },
    });
  }
}
