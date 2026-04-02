import React, { useState, useMemo } from 'react';
import { Share2, ZoomIn, ZoomOut, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ButtonSecondary } from '../button-secondary';
import * as ReactFamilyTreeModule from 'react-family-tree';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { parseDataToTree, inferRelationCFG, type AttrsMap, type RawData } from '../../../../Utilities/familyTreeParser';

const FamilyTreeComponent = (ReactFamilyTreeModule as any).default || ReactFamilyTreeModule;

// ── Error Boundary ───────────────────────────────────────────
class TreeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-[#8B2635] p-8">
          <p className="text-xl font-bold">無法顯示家族樹</p>
          <p className="text-sm text-[#8B8278] text-center">資料格式有誤或尚未收集到足夠關係：{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatBirthday(birthday: string): string {
  if (!birthday) return '';
  const parts = birthday.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${y} 年 ${parseInt(m)} 月 ${parseInt(d)} 日`;
  }
  return birthday;
}

// 隱形排版盒子
const BOX_WIDTH = 220;
const BOX_HEIGHT = 140;

interface FamilyTreeResultPageProps {
  dataList: RawData[];
  attrsMap: AttrsMap;
  onShare: () => void;
  onPlayAgain: () => void;
}

export function FamilyTreeResultPage({ dataList, attrsMap, onShare, onPlayAgain }: FamilyTreeResultPageProps) {
  const navigate = useNavigate();
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);

  const rawList: RawData[] = useMemo(
    () => (dataList || [])
      .filter((d: any) => {
        if (!d.a || !d.b) return false;
        if (typeof d.a === 'string' && d.a.startsWith('未知')) return false;
        if (typeof d.b === 'string' && d.b.startsWith('未知')) return false;
        // Filter ghost nodes: pure numbers getting accidentally stored as "person names"
        if (typeof d.a === 'string' && /^\d+$/.test(d.a.trim())) return false;
        if (typeof d.b === 'string' && /^\d+$/.test(d.b.trim())) return false;
        // Filter entries with empty string names
        if (typeof d.a === 'string' && d.a.trim() === '') return false;
        if (typeof d.b === 'string' && d.b.trim() === '') return false;
        // Filter system_cfg entries (backend inference agency)  
        if (d.answerer === 'system_cfg') return false;
        return true;
      })
      .map((d: any) => ({ relation: d.relation, a: d.a, b: d.b })),
    [dataList]
  );

  const { nodes, rootIds, nodesMap } = useMemo(() => {
    try {
      // @ts-ignore
      const result = parseDataToTree(rawList, attrsMap || {});
      const res: any = result;
      // Ensure we have an array of rootIds (fallback if signature is weird)
      const rIds = res.rootIds || (res.rootId ? [res.rootId] : (res.nodes?.length > 0 ? [res.nodes[0].id] : []));
      
      const validRootIds = rIds.filter((id: string) => res.nodes?.some((n: any) => n.id === id));
      return { nodes: res.nodes || [], rootIds: validRootIds, nodesMap: res.nodesMap };
    } catch (e: any) {
      console.error('parseDataToTree error:', e);
      return { nodes: [], rootIds: [], nodesMap: new Map() };
    }
  }, [rawList, attrsMap]);

  // Handle node selection (up to two members)
  const handleMemberClick = (member: any) => {
    setSelectedMembers((prev) => {
      if (prev.find(m => m.id === member.id)) {
        return prev.filter(m => m.id !== member.id);
      }
      if (prev.length === 2) {
        return [prev[0], member];
      }
      return [...prev, member];
    });
  };

  const isSelected = (memberId: string) => selectedMembers.some(m => m.id === memberId);

  // Dynamically find relationship between two nodes based on the graph Shortest Path Context-Free Grammar Engine
  const getBidirectionalRelationship = (person1: any, person2: any): [string, string] => {
    if (!nodesMap) return ['親屬', '親屬'];
    
    const p1ToP2 = inferRelationCFG(person1.id, person2.id, nodesMap);
    const p2ToP1 = inferRelationCFG(person2.id, person1.id, nodesMap);

    return [p1ToP2, p2ToP1];
  };

  return (
    <div className="h-screen bg-[#FAF8F3] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-[#8B2635] text-[#FAF8F3] p-4 flex justify-between items-center border-b-2 border-[#D4AF37] z-30 relative shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/results')}
            className="p-2 hover:bg-[#6B1D28] rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[#FAF8F3] font-bold m-0 border-none outline-none">家族樹</h2>
        </div>
        <button
          onClick={onShare}
          className="p-2 hover:bg-[#6B1D28] rounded-md transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-[#FAF8F3]">
        {nodes.length > 0 && rootIds.length > 0 ? (
          <TransformWrapper initialScale={1} minScale={0.1} maxScale={3} centerOnInit={true} limitToBounds={false}>
            {({ zoomIn, zoomOut }) => (
              <>
                {/* Zoom Controls */}
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                  <button
                    onClick={() => zoomIn(0.2)}
                    className="p-2 bg-[#F5F1E8] border-2 border-[#8B2635] rounded-md hover:bg-[#EAE6DC]"
                  >
                    <ZoomIn className="w-5 h-5 text-[#8B2635]" />
                  </button>
                  <button
                    onClick={() => zoomOut(0.2)}
                    className="p-2 bg-[#F5F1E8] border-2 border-[#8B2635] rounded-md hover:bg-[#EAE6DC]"
                  >
                    <ZoomOut className="w-5 h-5 text-[#8B2635]" />
                  </button>
                </div>

                {/* Family Tree Canvas */}
                <TransformComponent wrapperStyle={{ width: "100%", height: "100%", cursor: 'grab' }}>
                  <div className="p-20 flex flex-col items-center">
                    <TreeErrorBoundary>
                      {rootIds.map((rId: string, index: number) => (
                        <div key={rId} className="relative w-full flex justify-center" style={{ marginTop: index > 0 ? 800 : 0, minHeight: 600 }}>
                          <FamilyTreeComponent
                            nodes={nodes as any}
                            rootId={rId}
                            width={BOX_WIDTH}
                            height={BOX_HEIGHT}
                            renderNode={(node: any) => {
                              const name = node.displayName ?? node.id;
                              const displayBirthday = formatBirthday(node.birthday ?? '');
    
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
                                  className="flex flex-col items-center justify-center pointer-events-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMemberClick({
                                      id: node.id,
                                      name: name,
                                      relation: node.gender === 'male' ? '男性親屬' : '女性親屬',
                                      birthday: displayBirthday,
                                    });
                                  }}
                                >
                                  <div className={`w-20 h-20 bg-[#F5F1E8] border-2 cursor-pointer rounded-full flex items-center justify-center transition-all ${isSelected(node.id)
                                    ? 'border-[#8B2635] shadow-lg scale-110'
                                    : 'border-[#C9A961] hover:border-[#8B2635]'
                                    }`}>
                                    <User className="w-10 h-10 text-[#8B2635]" />
                                  </div>
                                  <div className="text-xs text-center mt-1 text-[#5C2E2E] font-medium whitespace-nowrap bg-[#FAF8F3]/80 px-1 rounded">
                                    {name}
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </div>
                      ))}
                    </TreeErrorBoundary>
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="flex items-center justify-center h-full text-[#8B2635] font-medium">
            目前沒有家族樹資料。若需預覽，請提供假資料。
          </div>
        )}
      </div>

      {/* Bottom Info Panel - Same as user's original design */}
      {selectedMembers.length > 0 && (
        <div className="bg-[#F5F1E8] border-t-2 border-[#C9A961] p-4 sm:p-6 space-y-4 z-30 relative shadow-[0_-4px_15px_rgba(0,0,0,0.05)] overflow-y-auto flex-shrink-0 max-h-[45vh] w-full">
          {selectedMembers.length === 1 ? (
            <div className="space-y-2">
              <h3 className="text-[#5C2E2E] font-bold text-lg">{selectedMembers[0].name}</h3>
              <p className="text-[#8B8278]">{selectedMembers[0].relation}</p>
              {selectedMembers[0].birthday && (
                <p className="text-sm text-[#8B8278]">出生日期：{selectedMembers[0].birthday}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 w-full">
                <div className="w-full sm:flex-1 bg-white border-2 border-[#C9A961] rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#8B2635]/10 border-2 border-[#C9A961] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-[#8B2635]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#5C2E2E] font-bold text-sm truncate">{selectedMembers[0].name}</h4>
                    <p className="text-xs text-[#8B8278] truncate">{selectedMembers[0].relation}</p>
                    {selectedMembers[0].birthday && (
                      <p className="text-xs text-[#8B8278]">{selectedMembers[0].birthday}</p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col justify-center items-center py-2 sm:py-0 w-full sm:w-auto">
                  <div className="flex flex-col gap-2 items-center">
                    <div className="bg-[#8B2635] text-[#FAF8F3] px-3 py-1.5 rounded-full text-xs font-medium shadow-sm flex items-center gap-1">
                      <span className="text-[#D4AF37]">{selectedMembers[0].name}</span>
                      <span>稱呼為</span>
                      <span className="font-bold">{getBidirectionalRelationship(selectedMembers[0], selectedMembers[1])[0]}</span>
                    </div>
                    {/* 隱藏/顯示的垂直或水平線用以裝飾 */}
                    <div className="w-px h-4 bg-[#C9A961] hidden sm:block"></div>
                    <div className="h-px w-4 bg-[#C9A961] sm:hidden block"></div>
                    <div className="bg-[#8B2635] text-[#FAF8F3] px-3 py-1.5 rounded-full text-xs font-medium shadow-sm flex items-center gap-1">
                      <span className="text-[#D4AF37]">{selectedMembers[1].name}</span>
                      <span>稱呼為</span>
                      <span className="font-bold">{getBidirectionalRelationship(selectedMembers[0], selectedMembers[1])[1]}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:flex-1 bg-white border-2 border-[#C9A961] rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#8B2635]/10 border-2 border-[#C9A961] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-[#8B2635]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#5C2E2E] font-bold text-sm truncate">{selectedMembers[1].name}</h4>
                    <p className="text-xs text-[#8B8278] truncate">{selectedMembers[1].relation}</p>
                    {selectedMembers[1].birthday && (
                      <p className="text-xs text-[#8B8278]">{selectedMembers[1].birthday}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <ButtonSecondary fullWidth onClick={onPlayAgain}>
              重新開始遊戲
            </ButtonSecondary>
          </div>
        </div>
      )}
    </div>
  );
}