import { useEffect } from 'react';
import './ErrorToast.css';

interface ErrorToastProps {
  error: string | null;
  onClear: () => void;
}

// 서버 에러를 비차단 토스트로 잠깐 보여준다.
// alert() 는 페이지 JS 전체를 멈춰 게임 상태 갱신까지 얼리므로 쓰지 않는다.
export function ErrorToast({ error, onClear }: ErrorToastProps) {
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onClear, 2500);
    return () => clearTimeout(timer);
  }, [error, onClear]);

  if (!error) return null;
  return <div className="error-toast">{error}</div>;
}
