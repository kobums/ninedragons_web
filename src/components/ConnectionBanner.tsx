import './ConnectionBanner.css';

interface ConnectionBannerProps {
  isConnected: boolean;
  opponentDisconnected: boolean;
  isGameActive: boolean;
  // 다인 게임용 문구 오버라이드 (기본: 2인용 "상대방 연결이 끊겼습니다…")
  disconnectText?: string;
}

// 게임 중 연결 상태를 알리는 상단 배너
// - 내 연결이 끊기면 자동 재접속 중임을 알린다
// - 상대방이 끊기면 재접속 대기 중임을 알린다
export function ConnectionBanner({
  isConnected,
  opponentDisconnected,
  isGameActive,
  disconnectText,
}: ConnectionBannerProps) {
  if (!isGameActive) return null;

  if (!isConnected) {
    return (
      <div className="connection-banner error">
        연결이 끊겼습니다. 재접속 중...
      </div>
    );
  }

  if (opponentDisconnected) {
    return (
      <div className="connection-banner warning">
        {disconnectText ?? '상대방 연결이 끊겼습니다. 재접속을 기다리는 중...'}
      </div>
    );
  }

  return null;
}
