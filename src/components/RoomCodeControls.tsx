// 방 코드·초대 링크 공통 컨트롤 — 다인 게임 대기실 5곳에서 재사용.
// 와이어 계약: join payload 의 room 은 '' = 공용 로비, 'NEW' = 새 사설 방,
// 4자 코드 = 해당 사설 방 (없으면 서버가 그 코드로 새로 만든다).
import { useMemo, useRef, useState } from 'react';
import './RoomCodeControls.css';

export type RoomJoinMode = 'public' | 'new' | 'code';

export const ROOM_CODE_LENGTH = 4;

// 서버 코드 알파벳 (혼동 문자 I/O/0/1 제외) 외의 입력은 버린다
const NOT_CODE_CHARS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(NOT_CODE_CHARS, '').slice(0, ROOM_CODE_LENGTH);
}

// URL 쿼리 ?room=AB12 → 초대 코드. 형식이 안 맞으면 무시하고 공용 입장.
export function readInviteRoomCode(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get('room') ?? '';
    const code = normalizeRoomCode(raw);
    return code.length === ROOM_CODE_LENGTH ? code : '';
  } catch {
    return '';
  }
}

export interface RoomJoinState {
  /** URL 로 들어온 초대 코드 ('' 이면 초대 아님) */
  inviteCode: string;
  mode: RoomJoinMode;
  setMode: (mode: RoomJoinMode) => void;
  code: string;
  setCode: (code: string) => void;
  /** join payload 에 넣을 room 값 ('' = 공용) */
  room: string;
  /** 코드 입장인데 아직 4자가 안 찼으면 false — 입장 버튼 잠금용 */
  roomReady: boolean;
}

// 입장 폼의 방 선택 상태. ?room=CODE 로 들어오면 자동으로 그 방 입장 모드.
export function useRoomJoin(): RoomJoinState {
  const inviteCode = useMemo(readInviteRoomCode, []);
  const [mode, setMode] = useState<RoomJoinMode>(inviteCode ? 'code' : 'public');
  const [code, setCodeRaw] = useState(inviteCode);

  const room = mode === 'new' ? 'NEW' : mode === 'code' ? code : '';
  const roomReady = mode !== 'code' || code.length === ROOM_CODE_LENGTH;

  return {
    inviteCode,
    mode,
    setMode,
    code,
    setCode: (c: string) => setCodeRaw(normalizeRoomCode(c)),
    room,
    roomReady,
  };
}

const MODE_LABELS: Record<RoomJoinMode, string> = {
  public: '공용 로비',
  new: '새 방 만들기',
  code: '코드 입장',
};

interface RoomJoinControlsProps {
  join: RoomJoinState;
  /** 대기실 배경 톤 — 크림(light, 기본) / 다크 */
  tone?: 'light' | 'dark';
  /** input id 충돌 방지용 게임 접두어 (dv, tc, mt, sf, sp) */
  idPrefix: string;
}

// 입장 폼 아래에 붙는 [공용 로비 | 새 방 만들기 | 코드 입장] 세그먼트.
export function RoomJoinControls({ join, tone = 'light', idPrefix }: RoomJoinControlsProps) {
  const { inviteCode, mode, setMode, code, setCode } = join;

  return (
    <div className={`rc-controls ${tone === 'dark' ? 'rc-dark' : ''}`}>
      {inviteCode !== '' && mode === 'code' && code === inviteCode && (
        <p className="rc-invite-note">
          ✉️ 초대 방 <strong className="rc-invite-code">{inviteCode}</strong>
          {' — 입장하면 친구 방으로 들어갑니다'}
        </p>
      )}

      <div className="rc-segment" role="group" aria-label="입장 방식 선택">
        {(Object.keys(MODE_LABELS) as RoomJoinMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`rc-segment-option ${mode === m ? 'active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === 'code' && (
        <input
          type="text"
          id={`${idPrefix}RoomCode`}
          className="rc-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD"
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="방 코드 (4자)"
        />
      )}
      {mode === 'new' && (
        <p className="rc-hint">새 사설 방을 만들어요 — 입장 후 초대 링크를 복사해 친구에게 보내세요</p>
      )}
    </div>
  );
}

interface RoomCodeBadgeProps {
  /** 스냅샷의 roomCode — 없거나 '' (공용 로비)면 아무것도 그리지 않는다 */
  code?: string;
  tone?: 'light' | 'dark';
}

// 입장 후 대기실 상단의 방 코드 뱃지 + 초대 링크 복사 버튼.
export function RoomCodeBadge({ code, tone = 'light' }: RoomCodeBadgeProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!code) return null;

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드를 못 쓰는 환경(비보안 컨텍스트 등)은 수동 복사로 대체
      window.prompt('아래 링크를 복사하세요', inviteUrl);
    }
  };

  return (
    <div className={`rc-room-line ${tone === 'dark' ? 'rc-dark' : ''}`}>
      <span className="rc-room-badge" title="방 코드">
        방 <strong className="rc-room-code">{code}</strong>
      </span>
      <button
        type="button"
        className={`rc-copy-button ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? '✓ 복사됨' : '초대 링크 복사'}
      </button>
    </div>
  );
}
