import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useWebSocket } from '../../Component/Websocket';

type Member = { name: string; birthday: string };

interface GameContextType {
    connected: boolean;
    mode: 'create' | 'join';
    setMode: (mode: 'create' | 'join') => void;
    roomCode: string;
    setRoomCode: (code: string) => void;
    userName: string;
    setUserName: (name: string) => void;
    isHost: boolean;
    members: Member[];
    duration: number;
    setDuration: (d: number) => void;
    gameStarted: boolean;
    remainingTime: number;
    question: any;
    dataList: any[];
    attrsMap: any;
    graph: any;
    lastError: string | null;
    clearError: () => void;
    roomCheckResult: { ok: boolean; reason?: string; roomCode?: string } | null;
    clearRoomCheck: () => void;
    sendMsg: (data: any) => void;
}

const GameContext = createContext<GameContextType | null>(null);

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:8888`;

export function GameProvider({ children }: { children: React.ReactNode }) {
    const { connected, subscribe, send } = useWebSocket(WS_URL);

    const [mode, setMode] = useState<'create' | 'join'>('create');
    const [roomCode, setRoomCode] = useState('');
    const [userName, setUserName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [duration, setDuration] = useState(120);
    const [gameStarted, setGameStarted] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);
    const [question, setQuestion] = useState<any>(null);
    const [dataList, setDataList] = useState<any[]>([]);
    const [attrsMap, setAttrsMap] = useState<any>({});
    const [graph, setGraph] = useState<any>({});
    const [lastError, setLastError] = useState<string | null>(null);
    const clearError = () => setLastError(null);
    const [roomCheckResult, setRoomCheckResult] = useState<{ ok: boolean; reason?: string; roomCode?: string } | null>(null);
    const clearRoomCheck = () => setRoomCheckResult(null);

    const userNameRef = useRef(userName);
    useEffect(() => {
        userNameRef.current = userName;
    }, [userName]);

    useEffect(() => {
        const handleMessage = (raw: string) => {
            let msg: any;
            try {
                msg = JSON.parse(raw);
            } catch { return; }

            switch (msg.action) {
                case "room_created":
                    setRoomCode(msg.roomCode);
                    setIsHost(true);
                    setMembers((msg.members ?? []).map((n: any) => ({
                        name: typeof n === "string" ? n : n.name,
                        birthday: typeof n === "string" ? "" : (n.birthday ?? "")
                    })));
                    break;
                case "joined_room":
                    setRoomCode(msg.roomCode);
                    setIsHost(false);
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
                    setGameStarted(true);
                    break;
                case "question":
                    console.log("GameContext Received Question:", msg.questionObj ?? msg.question);
                    setQuestion(msg.questionObj ?? msg.question ?? "");
                    break;
                case "tick":
                    setRemainingTime(msg.remainingSeconds);
                    break;
                case "game_ended":
                    setGameStarted(false);
                    setDataList(msg.data || []);
                    setAttrsMap(msg.attrs || {});
                    setGraph(msg.graph || {});
                    break;
                case "data_update":
                    if (Array.isArray(msg.data)) setDataList(msg.data);
                    break;
                case "new_answer":
                    if (msg.data) {
                        setDataList(prev => [...prev, msg.data]);
                    }
                    break;
                case "new_attr":
                    if (msg.attrs) {
                        setAttrsMap(prev => {
                            const updated = { ...prev };
                            for (const [person, newPersonAttrs] of Object.entries(msg.attrs)) {
                                updated[person] = { ...(updated[person] || {}), ...(newPersonAttrs as any) };
                            }
                            return updated;
                        });
                    }
                    break;
                case "error":
                    setLastError(msg.message ?? '發生未知錯誤');
                    break;
                case "room_check_result":
                    setRoomCheckResult({ ok: msg.ok, reason: msg.reason, roomCode: msg.roomCode });
                    break;
            }
        };

        const unsubscribe = subscribe(handleMessage);
        return () => unsubscribe();
    }, [subscribe]);

    return (
        <GameContext.Provider value={{
            connected, mode, setMode, roomCode, setRoomCode, userName, setUserName,
            isHost, members, duration, setDuration, gameStarted, remainingTime,
            question, dataList, attrsMap, graph, lastError, clearError, roomCheckResult, clearRoomCheck, sendMsg: send
        }}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error("useGame must be used within GameProvider");
    return ctx;
}
