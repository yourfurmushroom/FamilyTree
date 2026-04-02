// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { useWebSocket } from "./Component/Websocket";
import InputInformation from "./Component/InputInformation";
import SelectMode from "./Component/SelectMode";
import Waiting from "./Component/Waiting";
import AnswerField from "./Component/AnswerField";
import Result from "./Component/Result";
import type { GameQuestion } from "./Utilities/questionType";
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


const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:8888`;

function App() {
  const { connected, send, subscribe } = useWebSocket(WS_URL);

  const [screen, setScreen] = useState<Screen>("select");
  const [mode, setMode] = useState<Mode>("create");

  const [userName, setUserName] = useState<string>("");
  const userNameRef = useRef<string>("");
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  const [roomCode, setRoomCode] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [isHost, setIsHost] = useState<boolean>(false);

  const [question, setQuestion] = useState<string | GameQuestion>("");
  const [remainingTime, setRemainingTime] = useState<number>(0);

  const [dataList, setDataList] = useState<Data[]>([]);
  const [serverAttrs, setServerAttrs] = useState<AttrsMap>({});
  
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
    const unsubscribe = subscribe((raw: string) => {
      let msg: any;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.action) {
        case "room_created":
          setRoomCode(msg.roomCode);
          setIsHost(true);
          setMembers(prev => {
            const prevMap = new Map(prev.map(p => [p.name, p.birthday]));
            return (msg.members ?? []).map((n: any) => {
              const name = typeof n === "string" ? n : n.name;
              const birthday = typeof n === "string"
                ? (prevMap.get(name) ?? "")
                : (n.birthday ?? prevMap.get(name) ?? "");
              return { name, birthday };
            });
          });
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
          if (msg.newHostName === userNameRef.current) setIsHost(true);
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
          setScreen(prev => prev !== "form" ? "select" : prev);
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

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

                      // If a gender follow-up was answered, inject it into attrs
                      if (ans.type === 'fill' && ans.genderHint && ans.value && ans.value !== '跳過') {
                        const personName = String(ans.value);
                        if (!attrs[personName]) attrs[personName] = {};
                        (attrs[personName] as any).gender = ans.genderHint;
                        (attrs[personName] as any).displayName = personName;
                      }

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