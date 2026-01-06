'use client'

import dynamic from 'next/dynamic';
import { useActionState, useState } from 'react';

const FamilyGraph = dynamic(() => import("./Component/FamilyGraph"), { 
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center">載入中...</div>
});

const placeHolder: FamilyTreeProps = {
  data: {
    nodes: [
      { id: "grandpa", label: "阿公", gender: "male" },
      { id: "grandma", label: "阿罵", gender: "female" },
      { id: "father", label: "爸爸", gender: "male" },
      { id: "me", label: "我", gender: "male" },
      { id:"mother",label:"媽媽",gender:"female"}
    ],
    edges: [
      { source: "grandpa", target: "grandma", label: "夫妻"},
      { source: "grandpa", target: "father", label: "父子" },
      { source: "father", target: "me", label: "父子" },
      { source: "mother", target: "me", label: "母子" }
    ]
  }
};

export default function Home() {
  const [isStarted, setIsStarted] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (prevState: FamilyTreeProps, formData: FormData) => {
      const name = formData.get("name") as string;
      const gender=formData.get("gender") as string;
      const updatedNodes = prevState.data.nodes.map(n=> n.id === "me" ? { ...n, label: name, gender: gender } : n);

    const updatedEdges = prevState.data.edges.map((e) => {
      if (e.source === "father" && e.target === "me") {
        return { 
          ...e, 
          label: gender === "male" ? "父子" : "父女" 
        };
      }
      if (e.source === "mother" && e.target === "me") {
        return { 
          ...e, 
          label: gender === "male" ? "母子" : "母女" 
        };
      }
      return e;
    });

    setIsStarted(true);

    return {
      ...prevState,
      data: {
        nodes: updatedNodes,
        edges: updatedEdges,
      },
    };
  },
  placeHolder
  );

  if (!isStarted) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <form action={formAction} className="bg-white p-10 rounded-2xl shadow-xl">
          <h1 className="text-xl font-bold mb-4">客製化家族樹</h1>
          <input 
            name="name" 
            required 
            placeholder="請輸入您的名字" 
            className="w-full p-2 border rounded mb-4 outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className=' flex justify-between'>
            <label><input type="radio" className='' name="gender" value="male"></input>我是男生</label>
             <label><input type="radio" className='' name="gender" value="female"></input>我是女生</label>
          </div>
          <button 
            type="submit" 
            disabled={isPending}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            進入系統
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative">
      <FamilyGraph data={state.data} />
      <div className="absolute top-4 left-4 bg-white/90 p-4 rounded shadow-md border border-gray-200">
        <h2 className="font-bold">{state.data.nodes.find((n:NodeData) => n.id === "me")?.label} 的家族圖譜</h2>
      </div>
    </div>
  );
}