import { useCallback, useEffect, useState } from 'react';

// 모든 게임 메시지가 만족하는 최소 형태 — 각 게임의 {P}Message 가 그대로 들어온다
interface WireMessage {
  type: string;
  payload?: unknown;
}

// {prefix}_spectate_joined payload — 좌석·세션 없음 (관전은 재접속 미지원 v1)
export interface SpectateInfo {
  gameId: string;
  roomCode: string;
}

// {prefix}_spectate_joined 수신 → 관전 모드 진입.
// 이후 스냅샷은 yourSeat -1 로 오고, 셸은 보드 렌더 + SpectatorBadge 를 띄운다.
// 종료 화면에서 입장 화면으로 돌아갈 때(reset 류)는 clearSpectate 로 해제한다.
export function useSpectate(
  lastMessage: WireMessage | null,
  joinedType: string,
) {
  const [spectate, setSpectate] = useState<SpectateInfo | null>(null);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== joinedType) return;
    const payload = lastMessage.payload as Partial<SpectateInfo> | undefined;
    setSpectate({
      gameId: payload?.gameId ?? '',
      roomCode: payload?.roomCode ?? '',
    });
  }, [lastMessage, joinedType]);

  const clearSpectate = useCallback(() => setSpectate(null), []);

  return { spectate, clearSpectate };
}
