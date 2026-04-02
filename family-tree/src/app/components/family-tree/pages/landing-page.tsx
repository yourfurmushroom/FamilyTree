import { useState } from 'react';
import { ButtonPrimary } from '../button-primary';
import { ButtonSecondary } from '../button-secondary';

interface LandingPageProps {
  onStart: (duration: number) => void;
  onJoin?: (roomCode: string) => void;
  joinError?: string | null;
  onClearJoinError?: () => void;
}

export function LandingPage({ onStart, onJoin, joinError, onClearJoinError }: LandingPageProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(120);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [checking, setChecking] = useState(false);

  // When joinError arrives (from parent), stop the loading indicator
  // We detect this by watching joinError change to a non-null value
  const isPending = checking && !joinError;

  const handleJoinClick = () => {
    if (!roomCodeInput.trim()) {
      alert('請先輸入房間代碼！');
      return;
    }
    if (onClearJoinError) onClearJoinError();
    setChecking(true);
    if (onJoin) onJoin(roomCodeInput.trim());
  };

  // Once we get a result (error or success), reset loading
  if (joinError && checking) {
    setChecking(false);
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] flex flex-col items-center justify-center p-6">
      {/* 裝飾性雲紋背景 */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#8B2635]/5 to-transparent" />

      <div className="w-full max-w-[390px] flex flex-col items-center gap-8 relative z-10">
        {/* Logo Placeholder */}
        <div className="w-24 h-24 bg-[#8B2635] rounded-full flex items-center justify-center border-4 border-[#D4AF37] shadow-lg">
          <div className="text-4xl text-[#FAF8F3]">族</div>
        </div>

        {/* 主標題 */}
        <div className="text-center space-y-3">
          <h1 className="text-[#5C2E2E]">一起拼出我們的家族樹</h1>
          <p className="text-[#8B8278]">適合家庭聚會・全員一起玩的互動遊戲</p>
        </div>

        {/* Segmented Control */}
        <div className="w-full space-y-3">
          <label className="block text-[#5C2E2E] text-center font-bold">創建新遊戲</label>
          <div className="grid grid-cols-3 gap-3">
            {[120, 180, 240].map((duration) => (
              <button
                key={duration}
                onClick={() => setSelectedDuration(duration)}
                className={`py-3 rounded-md border-2 transition-all ${selectedDuration === duration
                  ? 'bg-[#8B2635] text-[#FAF8F3] border-[#D4AF37]'
                  : 'bg-[#F5F1E8] text-[#8B2635] border-[#8B8278]/30 hover:border-[#8B2635]'
                  }`}
              >
                {duration} 秒
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <ButtonPrimary
          fullWidth
          variant="outline"
          onClick={() => onStart(selectedDuration)}
        >
          創建遊戲房間
        </ButtonPrimary>

        {/* 或是加入朋友的房間 */}
        <div className="w-full space-y-3 pt-6 border-t border-[#8B2635]/20">
          <label className="block text-[#5C2E2E] text-center font-bold">或加入現有遊戲</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="輸入房間代碼 (如: 1)"
              value={roomCodeInput}
              onChange={(e) => {
                setRoomCodeInput(e.target.value);
                if (joinError && onClearJoinError) onClearJoinError();
              }}
              className="flex-1 px-4 py-3 rounded-md border-2 border-[#8B8278]/30 bg-[#F5F1E8] text-[#5C2E2E] focus:outline-none focus:border-[#8B2635]"
            />
            <ButtonSecondary
              onClick={handleJoinClick}
              disabled={isPending}
            >
              {isPending ? '確認中...' : '加入'}
            </ButtonSecondary>
          </div>

          {/* Error message */}
          {joinError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm text-center">
              {joinError}
            </div>
          )}
        </div>

      </div>

      {/* 裝飾性底部 */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#8B2635]/5 to-transparent" />
    </div>
  );
}
