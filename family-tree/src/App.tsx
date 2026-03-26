// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useWebSocket } from "./Component/Websocket";
import InputInformation from "./Component/InputInformation";
import SelectMode from "./Component/SelectMode";
import Waiting from "./Component/Waiting";
import AnswerField from "./Component/AnswerField";
import Result from "./Component/Result";
import type { GameQuestion, GameAnswer } from "./Utilities/questionType";
import type { AttrsMap } from "./Utilities/familyTreeParser";
import { convertAnswerToRelation } from "./Utilities/answerConverter";
import { extractPersonsFromQuestion } from "./Utilities/questionParser";

type Mode = "create" | "join";
type Screen = "select" | "form" | "waiting" | "playing" | "result";

type Member = { name: string; birthday: string };

// 原始資料
type Data = {
  relation: string;
  a: string;
  b: string;
  answerer: string;
};

const FAKE_DATA: Data[] = [
  { relation: "配偶", a: "爺爺", b: "奶奶", answerer: "System" },
  { relation: "爸爸", a: "爸爸", b: "爺爺", answerer: "System" },
  { relation: "爸爸", a: "叔叔", b: "爺爺", answerer: "System" },
  { relation: "配偶", a: "爸爸", b: "媽媽", answerer: "System" },
  { relation: "配偶", a: "叔叔", b: "嬸嬸", answerer: "System" },
  { relation: "爸爸", a: "我", b: "爸爸", answerer: "System" },
  { relation: "爸爸", a: "妹妹", b: "爸爸", answerer: "System" },
  { relation: "爸爸", a: "堂弟", b: "叔叔", answerer: "System" },
  { relation: "媽媽", a: "我", b: "媽媽", answerer: "System" },
];

const FAKE_ATTRS: AttrsMap = {
  "爺爺": { displayName: "爺爺", birthday: "1945-03-01" },
  "奶奶": { displayName: "奶奶", birthday: "1948-07-12" },
  "爸爸": { displayName: "爸爸", birthday: "1970-05-20" },
  "媽媽": { displayName: "媽媽", birthday: "1972-09-10" },
  "叔叔": { displayName: "叔叔", birthday: "1973-02-14" },
  "嬸嬸": { displayName: "嬸嬸", birthday: "1975-11-30" },
  "我": { displayName: "我", birthday: "2000-01-01" },
  "妹妹": { displayName: "妹妹", birthday: "2003-06-18" },
  "堂弟": { displayName: "堂弟", birthday: "2002-04-22" },
};

function isGameQuestion(x: any): x is GameQuestion {
  return x && typeof x === "object" && typeof x.text === "string" && typeof x.type === "string" && Array.isArray(x.option);
}

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:8888`;

function App() {
  const { connected, lastMessage, send } = useWebSocket(WS_URL);

  const [screen, setScreen] = useState<Screen>("result");
  const [mode, setMode] = useState<Mode>("create");

  const [userName, setUserName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [isHost, setIsHost] = useState<boolean>(false);

  // question 改成可以是 string 或 GameQuestion
  const [question, setQuestion] = useState<string | GameQuestion>("");
  const [remainingTime, setRemainingTime] = useState<number>(0);

  const [dataList, setDataList] = useState<Data[]>(FAKE_DATA);
  const [serverAttrs, setServerAttrs] = useState<AttrsMap>(FAKE_ATTRS);
  
  const attrsMap: AttrsMap = useMemo(() => {
    const m: AttrsMap = { ...serverAttrs };
    for (const mem of members) {
      if (!m[mem.name]) m[mem.name] = {};
      m[mem.name].displayName = mem.name;
      if (mem.birthday) m[mem.name].birthday = mem.birthday;
    }
    return m;
  }, [members, serverAttrs]);

  useEffect(() => {
    if (!lastMessage) return;

    let msg: any;
    try {
      msg = JSON.parse(lastMessage);
    } catch {
      return;
    }

    switch (msg.action) {
      case "room_created":
        setRoomCode(msg.roomCode);
        setIsHost(true);
        setMembers((msg.members ?? []).map((n: any) => ({
          name: typeof n === "string" ? n : n.name,
          birthday: typeof n === "string" ? "" : (n.birthday ?? "")
        })));
        setScreen("waiting");
        break;

      case "joined_room":
        setRoomCode(msg.roomCode);
        setIsHost(false);
        setScreen("waiting");
        break;

      case "member_update":
        if (Array.isArray(msg.members)) {
          setMembers(prev => {
            const prevMap = new Map(prev.map(p => [p.name, p.birthday]));
            return msg.members.map((n: any) => {
              const name = typeof n === "string" ? n : n.name;
              const birthday = typeof n === "string" ? (prevMap.get(name) ?? "") : (n.birthday ?? prevMap.get(name) ?? "");
              return { name, birthday };
            });
          });
        }
        break;

      case "host_change":
        if (msg.newHostName === userName) {
          setIsHost(true);
        }
        break;

      case "game_started":
        setScreen("playing");
        break;

      case "question":
        setQuestion(msg.questionObj ?? msg.question ?? "");
        break;

      case "tick":
        setRemainingTime(msg.remainingSeconds);
        break;

      case "game_ended":
        setScreen("result");
        setDataList(msg.data || []);
        setServerAttrs(msg.attrs || {});
        break;

      case "data_update":
        if (Array.isArray(msg.data)) setDataList(msg.data);
        break;

      case "new_answer":
        if (msg.data) setDataList(prev => [...prev, msg.data]);
        break;

      case "new_attr":
        if (msg.attrs) setServerAttrs(msg.attrs);
        break;

      case "error":
        alert(msg.message);
        if (screen !== "form") setScreen("select");
        break;
    }
  }, [lastMessage, screen, userName]);

  function reset() {
    setScreen("select");
    setMode("create");
    setUserName("");
    setRoomCode("");
    setMembers([]);
    setIsHost(false);
    setQuestion("");
    setDataList([]);
  }

  const knownNames = useMemo(() => {
    const s = new Set<string>();
    members.forEach(m => s.add(m.name));
    dataList.forEach(d => {
      if (d.a && !d.a.startsWith("未知")) s.add(d.a);
      if (d.b && !d.b.startsWith("未知")) s.add(d.b);
    });
    Object.keys(serverAttrs).forEach(k => {
      if (!k.startsWith("未知")) s.add(k);
      if (serverAttrs[k].displayName && !serverAttrs[k].displayName?.startsWith("未知")) s.add(serverAttrs[k].displayName!);
    });
    return Array.from(s).filter(Boolean);
  }, [members, dataList, serverAttrs]);

  return (
    // 使用 bg-slate-100 讓整個網頁有淺灰底色，並確保最小高度填滿螢幕
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        
        {/* Header 頂部狀態列 */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200 gap-4">
          <div className="flex items-center flex-wrap gap-4 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Status</span>
              <span className={`px-3 py-1 rounded-full font-bold text-sm ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {connected ? "● Connected" : "○ Disconnected"}
              </span>
            </div>
            
            {screen !== 'select' && (
              <div className="flex items-center gap-2 border-l-2 border-slate-200 pl-4">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">User</span>
                <span className="font-bold text-indigo-600">{userName}</span>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => location.reload()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-sm shadow-sm"
          >
            Reset App
          </button>
        </div>

        {/* 畫面渲染區塊：如果不是 Result 畫面，就幫它們包一層好看的白底卡片 */}
        {screen !== "result" ? (
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
            {screen === "select" && (
              <SelectMode
                onCreate={() => { setMode("create"); setScreen("form"); }}
                onJoin={() => { setMode("join"); setScreen("form"); }}
              />
            )}

            {screen === "form" && (
              <InputInformation
                mode={mode}
                onBack={() => setScreen("select")}
                onSubmit={(payload) => {
                  setUserName(payload.name);
                  setMembers(prev => {
                    const exists = prev.find(p => p.name === payload.name);
                    if (exists) return prev.map(p => p.name === payload.name ? { ...p, birthday: payload.birthday } : p);
                    return [...prev, { name: payload.name, birthday: payload.birthday }];
                  });

                  if (payload.mode === "create") {
                    send({ action: "create_room", name: payload.name, birthday: payload.birthday });
                  } else {
                    send({ action: "join_room", roomCode: payload.roomCode, name: payload.name, birthday: payload.birthday });
                  }
                }}
              />
            )}

            {screen === "waiting" && (
              <Waiting
                roomCode={roomCode}
                members={members}
                isHost={isHost}
                onLeave={() => location.reload()}
                onStart={() => { send({ action: "start_game", roomCode }); }}
              />
            )}

            {screen === "playing" && (
              <div className="flex flex-col gap-4">
                <div className="self-end px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg border border-red-100 shadow-sm animate-pulse">
                  ⏳ Time: {remainingTime}s
                </div>

                <AnswerField
                  knownNames={knownNames}
                  question={question || "Loading..."}
                  onSubmit={(ans:any) => {
                    if (typeof question === 'object' && 'text' in question) {
                      const { relations, attrs } = convertAnswerToRelation(
                        question,
                        ans,
                        extractPersonsFromQuestion(question.text)
                      );

                      send({
                        action: "answer",
                        roomCode,
                        answer: ans,
                        relations,
                        attrs
                      });

                      setDataList(prev => [...prev, ...relations.map(r => ({ ...r, answerer: userName }))]);
                    } else {
                      send({ action: "answer", roomCode, answer: ans });
                    }
                  }}
                  onFinish={() => { }}
                />
              </div>
            )}
          </div>
        ) : (
          /* Result 畫面已經在裡面處理了白底與框線，直接渲染即可 */
          <div className="w-full">
            <Result
              roomCode={roomCode}
              dataList={dataList}
              attrsMap={attrsMap}
              onHome={reset}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;