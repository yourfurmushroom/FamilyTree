import { useMemo, useState, useEffect } from "react";
import type { GameAnswer, GameQuestion } from "../Utilities/questionType";

export default function AnswerField(props: {
  question: string | GameQuestion;
  knownNames: string[];
  onSubmit: (ans: GameAnswer | { relation: string; a: string; b: string }) => void;
  onFinish: () => void;
}) {
  const isStructured = typeof props.question !== "string";
  const q = props.question as GameQuestion;

  const [selectVal, setSelectVal] = useState("");
  const [textVal, setTextVal] = useState("");
  const [numVal, setNumVal] = useState<number | "">("");
  const [dateVal, setDateVal] = useState("");

  // Gender follow-up state: set when a new name was entered
  const [genderFollowUp, setGenderFollowUp] = useState<{ name: string } | null>(null);

  useEffect(() => {
    setSelectVal("");
    setTextVal("");
    setNumVal("");
    setDateVal("");
    setRelation("");
    setA("");
    setB("");
    setGenderFollowUp(null);
  }, [props.question]);

  const renderedText = useMemo(() => {
    if (!isStructured) return props.question as string;
    let i = 0;
    return q.text.replace(/\[\]/g, () => q.slots?.[i++] ?? "[]");
  }, [props.question, isStructured]);

  const [relation, setRelation] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const submitStructured = () => {
    if (!isStructured) return;

    if (q.type === "select") {
      if (!selectVal) return alert("請選擇");
      props.onSubmit({ type: "select", value: selectVal });
      setSelectVal("");
      return;
    }
    if (q.type === "fill") {
      const name = textVal.trim();
      if (!name) return alert("請輸入");
      // If the entered name is new (not in knownNames), ask gender first
      if (!props.knownNames.includes(name)) {
        setGenderFollowUp({ name });
        return;
      }
      props.onSubmit({ type: "fill", value: name });
      setTextVal("");
      return;
    }
    if (q.type === "number") {
      if (numVal === "" || Number.isNaN(numVal)) return alert("請輸入數字");
      props.onSubmit({ type: "number", value: numVal });
      setNumVal("");
      return;
    }
    if (q.type === "date") {
      if (!dateVal) return alert("請選日期");
      props.onSubmit({ type: "date", value: dateVal });
      setDateVal("");
      return;
    }
  };

  const submitGender = (gender: "male" | "female") => {
    if (!genderFollowUp) return;
    props.onSubmit({ type: "fill", value: genderFollowUp.name, genderHint: gender });
    setGenderFollowUp(null);
    setTextVal("");
  };

  const submitLegacy = () => {
    if (isStructured) return;
    if (!relation.trim() || !a.trim() || !b.trim()) return alert("relation/a/b 都要填");
    props.onSubmit({ relation: relation.trim(), a: a.trim(), b: b.trim() });
    setRelation("");
    setA("");
    setB("");
  };

  // ── Gender follow-up screen ─────────────────────────
  if (genderFollowUp) {
    return (
      <div>
        <h3>追加問題</h3>
        <div style={{ marginBottom: 12 }}>
          <b>{genderFollowUp.name}</b> 是男生還是女生？
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-sm transition-colors"
            onClick={() => submitGender("male")}
          >
            👨 男生
          </button>
          <button
            className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg shadow-sm transition-colors"
            onClick={() => submitGender("female")}
          >
            👩 女生
          </button>
          <button
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg transition-colors"
            onClick={() => {
              // Skip gender, just submit the name without hint
              props.onSubmit({ type: "fill", value: genderFollowUp.name });
              setGenderFollowUp(null);
              setTextVal("");
            }}
          >
            略過
          </button>
        </div>
      </div>
    );
  }

  // ── Normal question screen ──────────────────────────
  return (
    <div>
      <h3>Answer</h3>

      <div style={{ marginBottom: 8 }}>
        Question: <b>{renderedText}</b>
      </div>

      {isStructured ? (
        <>
          {q.type === "select" && (
            <select value={selectVal} onChange={(e) => setSelectVal(e.target.value)}>
              <option value="">請選擇</option>
              {q.option.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          )}

          {q.type === "fill" && (
            <>
              <input
                key={`fill-${q.id}`}
                list="known-names-list"
                autoComplete="off"
                className="border border-slate-300 px-3 py-2 rounded-lg w-full shadow-sm focus:ring-2 focus:ring-blue-200 transition-all text-slate-800 font-medium"
                placeholder="請輸入答案"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
              />
              <datalist id="known-names-list">
                {props.knownNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          )}

          {q.type === "number" && (
            <input
              key={`num-${q.id}`}
              type="number"
              className="border border-slate-300 px-3 py-2 rounded-lg w-[120px] shadow-sm focus:ring-2 focus:ring-blue-200 transition-all text-center font-bold"
              placeholder="請輸入數字"
              value={numVal}
              onChange={(e) => setNumVal(e.target.value === "" ? "" : Number(e.target.value))}
            />
          )}

          {q.type === "date" && (
            <input
              key={`date-${q.id}`}
              type="date"
              className="border border-slate-300 px-3 py-2 rounded-lg cursor-pointer min-w-[200px] shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-700"
              value={dateVal}
              onClick={(e) => {
                if ('showPicker' in HTMLInputElement.prototype) {
                  try { (e.target as any).showPicker(); } catch (err) { }
                }
              }}
              onChange={(e) => setDateVal(e.target.value)}
            />
          )}

          <div style={{ marginTop: 12 }}>
            <button
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors"
              onClick={submitStructured}
            >
              送出
            </button>
            <button
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg transition-colors ml-2"
              onClick={() => {
                setTextVal(""); setNumVal(""); setDateVal(""); setSelectVal("");
                props.onSubmit({ type: "fill", value: "跳過" });
              }}
            >
              沒有此對應人 (跳過)
            </button>
          </div>
        </>
      ) : (
        <>
          <input placeholder="relation" value={relation} onChange={(e) => setRelation(e.target.value)} />
          <input placeholder="a" value={a} onChange={(e) => setA(e.target.value)} />
          <input placeholder="b" value={b} onChange={(e) => setB(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <button onClick={submitLegacy}>Submit</button>
            <button onClick={props.onFinish} style={{ marginLeft: 8 }}>Finish (test)</button>
          </div>
        </>
      )}
    </div>
  );
}
