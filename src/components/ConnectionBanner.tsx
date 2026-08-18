import type { CSSProperties } from 'react';

interface ConnectionBannerProps {
  isConnected: boolean;
  opponentDisconnected: boolean;
  isGameActive: boolean;
  // 다인 게임용 문구 오버라이드 (기본: 2인용 "상대방 연결이 끊겼습니다…")
  disconnectText?: string;
}

const bannerStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  padding: '10px 16px',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
};

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
      <div style={{ ...bannerStyle, background: '#d9534f' }}>
        연결이 끊겼습니다. 재접속 중...
      </div>
    );
  }

  if (opponentDisconnected) {
    return (
      <div style={{ ...bannerStyle, background: '#f0ad4e' }}>
        {disconnectText ?? '상대방 연결이 끊겼습니다. 재접속을 기다리는 중...'}
      </div>
    );
  }

  return null;
}
