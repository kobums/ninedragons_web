interface ConnectingScreenProps {
  // 게임 무드 — 셸 밖(return 이전)에서 렌더되므로 셸의 mood 클래스를
  // 물려받지 못한다. 호출부(각 게임 App)가 직접 넘긴다.
  mood?: 'dark' | 'cream';
}

// 게임 시작 전 서버 연결 대기 화면 (전 게임 공용)
export function ConnectingScreen({ mood = 'cream' }: ConnectingScreenProps) {
  return (
    <div className={`app mood-${mood}`}>
      <div className="connecting">서버에 연결 중...</div>
    </div>
  );
}
