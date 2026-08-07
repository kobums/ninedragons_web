// 재접속용 세션 ID 저장소
// sessionStorage를 쓰는 이유: 탭 단위로 격리되어 같은 브라우저의 두 탭으로
// 각각 접속해도 세션이 섞이지 않고, 앱 전환 후 복귀해도 값이 유지된다.

export const ND_SESSION_KEY = 'ninedragons_session_id';
export const NC_SESSION_KEY = 'numberchange_session_id';
export const DV_SESSION_KEY = 'davinci_session_id';

export const getSessionId = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const saveSessionId = (key: string, sessionId: string) => {
  try {
    sessionStorage.setItem(key, sessionId);
  } catch {
    // 저장 실패 시 재접속 복구만 안 될 뿐 게임 진행에는 지장 없다
  }
};

export const clearSessionId = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};
