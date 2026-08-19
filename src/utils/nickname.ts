// 닉네임 기억 — 게임을 오갈 때마다 다시 입력하지 않게 localStorage 에 저장.
// 게임별 키가 아니라 플랫폼 공용 키 하나를 쓴다.
const KEY = 'nd_nickname';

export function loadNickname(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) window.localStorage.setItem(KEY, trimmed);
  } catch {
    // 사생활 모드 등 저장 불가 환경은 조용히 무시
  }
}
