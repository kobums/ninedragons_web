import { useEffect, useState } from 'react';

// 서버는 게임 종료 후 60초 동안만 재대결 창을 유지한다.
// 게임 종료 화면 마운트 시점부터 1초 간격으로 남은 초를 세고,
// 0초가 되면 만료로 표시하는 공용 카운트다운 훅.
const REMATCH_WINDOW_SECONDS = 60;

export const useRematchCountdown = () => {
  const [secondsLeft, setSecondsLeft] = useState(REMATCH_WINDOW_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // 언마운트 시 타이머 정리
    return () => clearInterval(timer);
  }, []);

  return { secondsLeft, expired: secondsLeft <= 0 };
};
