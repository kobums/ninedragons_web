// 관전 UI 공용 배지 — 다인 6종(dv/tc/mt/sf/sp/av) 셸에서 재사용.
// SpectatorBadge: 관전자 본인 화면 상단 고정 "👁 관전 중 · 방 CODE"
// SpectatorCount: 참가자 화면에 관전자 수가 있을 때만 "👁 N"
import './SpectatorBadge.css';

export function SpectatorBadge({ roomCode }: { roomCode: string }) {
  return (
    <div className="spectator-badge">
      👁 관전 중{roomCode ? ` · 방 ${roomCode}` : ''}
    </div>
  );
}

export function SpectatorCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="spectator-count" title={`관전자 ${count}명`}>
      👁 {count}
    </div>
  );
}
