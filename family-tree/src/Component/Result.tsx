// src/Result.tsx
import React, { useMemo, useState } from 'react';
import * as ReactFamilyTreeModule from 'react-family-tree';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { parseDataToTree, type AttrsMap, type RawData } from '../Utilities/familyTreeParser';

const FamilyTreeComponent = (ReactFamilyTreeModule as any).default || ReactFamilyTreeModule;

const BOX_WIDTH = 220;
const BOX_HEIGHT = 170;
const CARD_WIDTH = 170;
const CARD_HEIGHT = 105;

type ResultProps = {
  roomCode: string;
  dataList: Array<{ relation: string; a: string; b: string; answerer?: string }>;
  attrsMap: AttrsMap;
  onHome: () => void;
};

function formatBirthday(birthday: string): string {
  const parts = birthday.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${y} 年 ${parseInt(m)} 月 ${parseInt(d)} 日`;
  }
  return birthday;
}

export default function Result({ roomCode, dataList, attrsMap, onHome }: ResultProps) {
  const rawList: RawData[] = useMemo(
    () => dataList.map(d => ({ relation: d.relation, a: d.a, b: d.b })),
    [dataList]
  );

  const { nodes, rootIds } = useMemo(() => {
    return parseDataToTree(rawList, attrsMap);
  }, [rawList, attrsMap]);
  const rootId = rootIds?.[0] ?? (nodes.length > 0 ? nodes[0].id : '');

  const [selectedNode, setSelectedNode] = useState<{ id: string; displayName?: string; birthday?: string; gender?: string } | null>(null);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-3 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">Family Tree - Room: {roomCode}</h3>
        <button
          onClick={onHome}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
        >
          Back Home
        </button>
      </div>

      <div className="w-full h-[520px] border border-gray-300 rounded-xl overflow-hidden bg-slate-50 relative shadow-inner">
        {nodes.length > 0 && rootId ? (
          <TransformWrapper initialScale={1} minScale={0.1} maxScale={3} centerOnInit={true} limitToBounds={false}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <React.Fragment>
                <div className="absolute top-3 right-3 z-[100] flex gap-2">
                  <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-gray-600 font-bold" onClick={() => zoomIn()}>+</button>
                  <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-gray-600 font-bold" onClick={() => zoomOut()}>-</button>
                  <button className="px-3 h-8 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-gray-600 text-sm font-medium" onClick={() => resetTransform()}>Reset</button>
                </div>

                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                  <div className="p-10 md:p-20">
                    <FamilyTreeComponent
                      nodes={nodes as any}
                      rootId={rootId}
                      width={BOX_WIDTH}
                      height={BOX_HEIGHT}
                      renderNode={(node: any) => {
                        const label = node.displayName ?? node.id;
                        const isMale = node.gender === 'male';
                        const isSelected = selectedNode?.id === node.id;
                        const genderClasses = isMale
                          ? 'bg-blue-100 border-blue-500 text-slate-700'
                          : 'bg-pink-100 border-pink-500 text-slate-700';

                        return (
                          <div
                            key={node.id}
                            style={{
                              width: BOX_WIDTH,
                              height: BOX_HEIGHT,
                              transform: `translate(${node.left * (BOX_WIDTH / 2)}px, ${node.top * (BOX_HEIGHT / 2)}px)`,
                              position: 'absolute',
                              left: 0,
                              top: 0,
                            }}
                            className="flex items-center justify-center"
                          >
                            <div
                              style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                              className={`flex flex-col items-center justify-center border-2 rounded-[10px] font-bold text-[13px] shadow-sm cursor-pointer p-1.5 text-center gap-0.5 transition-all ${genderClasses} ${isSelected ? 'ring-2 ring-offset-1 ring-yellow-400 scale-110 shadow-lg' : 'hover:shadow-md'}`}
                              onClick={() => setSelectedNode(isSelected ? null : node)}
                            >
                              <div className="truncate w-full">{label}</div>
                              {node.birthday && (
                                <div className="font-medium text-[11px] opacity-70 leading-tight">
                                  🎂 {formatBirthday(node.birthday)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </div>
                </TransformComponent>
              </React.Fragment>
            )}
          </TransformWrapper>
        ) : (
          <div className="p-5 text-gray-500 flex items-center justify-center h-full">
            No family data available.
          </div>
        )}
      </div>

      {/* 點擊節點後的詳細資訊面板 */}
      {selectedNode ? (
        <div className="mt-3 px-5 py-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${selectedNode.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
            {selectedNode.gender === 'male' ? '👨' : '👩'}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-base font-bold text-gray-800">
              {selectedNode.displayName ?? selectedNode.id}
              {selectedNode.displayName && selectedNode.displayName !== selectedNode.id && (
                <span className="ml-2 text-xs text-gray-400 font-normal">({selectedNode.id})</span>
              )}
            </div>
            {selectedNode.birthday ? (
              <div className="text-sm text-gray-600">
                🎂 生日：<span className="font-semibold">{formatBirthday(selectedNode.birthday)}</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">生日未知</div>
            )}
          </div>
          <button className="ml-auto text-gray-400 hover:text-gray-600 text-lg" onClick={() => setSelectedNode(null)}>✕</button>
        </div>
      ) : (
        <div className="mt-3 px-5 py-3 text-sm text-gray-400 text-center select-none">
          點擊節點可查看該成員的詳細資訊
        </div>
      )}
    </div>
  );
}