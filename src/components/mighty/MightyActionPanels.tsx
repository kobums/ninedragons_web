import { useEffect, useState } from 'react';
import type {
  MTBid,
  MTBidSuit,
  MTCard,
  MTContract,
  MTFriendType,
  MTSuit,
} from '../../types/mighty';
import {
  MAX_BID_COUNT,
  SUIT_NAME_KO,
  SUIT_SYMBOL,
  isRedSuit,
  minBidCount,
  rankLabel,
} from './mightyRules';
import { MightyCard } from './MightyCard';
import './MightyActionPanels.css';

const BID_SUITS: MTBidSuit[] = ['S', 'D', 'C', 'H', 'N'];
const PLAIN_SUITS: MTSuit[] = ['S', 'D', 'C', 'H'];
// A K Q J 10 ... 2
const RANKS_DESC = Array.from({ length: 13 }, (_, i) => 14 - i);

// 문양 버튼 공용 라벨 (♦♥ 빨강)
function SuitLabel({ suit }: { suit: MTBidSuit }) {
  if (suit === 'N') return <span>노기루</span>;
  return (
    <span className={isRedSuit(suit) ? 'mt-suit-red' : ''}>
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

// ---------- 입찰 ----------

interface MightyBidPanelProps {
  best: MTBid | null;
  onBid: (suit: MTBidSuit, count: number) => void;
  onPass: () => void;
}

export function MightyBidPanel({ best, onBid, onPass }: MightyBidPanelProps) {
  const [suit, setSuit] = useState<MTBidSuit>('S');
  const [count, setCount] = useState<number | null>(null);

  const min = minBidCount(suit, best);
  // 문양·직전 공약이 바뀌면 count 를 유효 범위로 스냅
  const effCount =
    min === null ? null : Math.min(MAX_BID_COUNT, Math.max(min, count ?? min));

  useEffect(() => {
    setCount(null);
  }, [best?.suit, best?.count]);

  return (
    <div className="mt-panel">
      <p className="mt-panel-title">내 차례 — 공약을 선언하거나 패스하세요</p>
      <div className="mt-suit-row">
        {BID_SUITS.map((s) => {
          const m = minBidCount(s, best);
          return (
            <button
              key={s}
              type="button"
              className={`mt-suit-button ${suit === s ? 'active' : ''}`}
              disabled={m === null}
              onClick={() => setSuit(s)}
            >
              <SuitLabel suit={s} />
            </button>
          );
        })}
      </div>

      {effCount !== null ? (
        <div className="mt-bid-stepper">
          <button
            type="button"
            className="mt-step-button"
            disabled={effCount <= (min ?? effCount)}
            onClick={() => setCount(effCount - 1)}
          >
            −
          </button>
          <span className="mt-bid-value">
            <SuitLabel suit={suit} /> {effCount}
          </span>
          <button
            type="button"
            className="mt-step-button"
            disabled={effCount >= MAX_BID_COUNT}
            onClick={() => setCount(effCount + 1)}
          >
            +
          </button>
        </div>
      ) : (
        <p className="mt-panel-hint">이 문양으로는 더 높은 공약을 낼 수 없습니다</p>
      )}

      <div className="mt-panel-actions">
        <button
          type="button"
          className="mt-action-button primary"
          disabled={effCount === null}
          onClick={() => effCount !== null && onBid(suit, effCount)}
        >
          공약 선언
        </button>
        <button type="button" className="mt-action-button" onClick={onPass}>
          패스
        </button>
      </div>
    </div>
  );
}

// ---------- 키티 (주공 전용) ----------

interface MightyKittyPanelProps {
  contract: MTContract;
  // 손패에서 고른 버릴 카드 수 (선택은 손패 쪽에서)
  selectedCount: number;
  onSubmit: (suit: MTBidSuit) => void;
}

export function MightyKittyPanel({
  contract,
  selectedCount,
  onSubmit,
}: MightyKittyPanelProps) {
  const [suit, setSuit] = useState<MTBidSuit>(contract.suit);
  const changed = suit !== contract.suit;

  return (
    <div className="mt-panel">
      <p className="mt-panel-title">
        버릴 카드 3장을 손패에서 고르세요 ({selectedCount}/3)
      </p>
      <p className="mt-panel-hint">최종 기루다 선택</p>
      <div className="mt-suit-row">
        {BID_SUITS.map((s) => (
          <button
            key={s}
            type="button"
            className={`mt-suit-button ${suit === s ? 'active' : ''}`}
            onClick={() => setSuit(s)}
          >
            <SuitLabel suit={s} />
          </button>
        ))}
      </div>
      {changed && (
        <p className="mt-panel-warning">
          ⚠ 기루다 변경 — 공약이 {contract.count} → {contract.count + 1}로
          올라갑니다
        </p>
      )}
      <div className="mt-panel-actions">
        <button
          type="button"
          className="mt-action-button primary"
          disabled={selectedCount !== 3}
          onClick={() => onSubmit(suit)}
        >
          {SUIT_NAME_KO[suit]} 기루다로 확정
        </button>
      </div>
    </div>
  );
}

// ---------- 프렌드 지정 (주공 전용) ----------

interface MightyFriendPanelProps {
  onSubmit: (type: MTFriendType, card?: MTCard) => void;
}

export function MightyFriendPanel({ onSubmit }: MightyFriendPanelProps) {
  const [mode, setMode] = useState<MTFriendType>('card');
  const [suit, setSuit] = useState<MTSuit>('S');
  const [rank, setRank] = useState<number>(14);
  const [joker, setJoker] = useState(false);

  const card: MTCard = joker ? 'JK' : `${suit}${rank}`;

  return (
    <div className="mt-panel">
      <p className="mt-panel-title">프렌드를 지정하세요</p>
      <div className="mt-suit-row">
        <button
          type="button"
          className={`mt-suit-button wide ${mode === 'card' ? 'active' : ''}`}
          onClick={() => setMode('card')}
        >
          카드 지정
        </button>
        <button
          type="button"
          className={`mt-suit-button wide ${mode === 'first_trick' ? 'active' : ''}`}
          onClick={() => setMode('first_trick')}
        >
          첫 트릭 승자
        </button>
        <button
          type="button"
          className={`mt-suit-button wide ${mode === 'none' ? 'active' : ''}`}
          onClick={() => setMode('none')}
        >
          노프렌드
        </button>
      </div>

      {mode === 'card' && (
        <div className="mt-friend-card-picker">
          <div className="mt-suit-row">
            {PLAIN_SUITS.map((s) => (
              <button
                key={s}
                type="button"
                className={`mt-suit-button ${!joker && suit === s ? 'active' : ''}`}
                onClick={() => {
                  setJoker(false);
                  setSuit(s);
                }}
              >
                <SuitLabel suit={s} />
              </button>
            ))}
            <button
              type="button"
              className={`mt-suit-button ${joker ? 'active' : ''}`}
              onClick={() => setJoker(true)}
            >
              JK
            </button>
          </div>
          {!joker && (
            <div className="mt-rank-row">
              {RANKS_DESC.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`mt-rank-button ${rank === r ? 'active' : ''}`}
                  onClick={() => setRank(r)}
                >
                  {rankLabel(r)}
                </button>
              ))}
            </div>
          )}
          <div className="mt-friend-preview">
            <MightyCard card={card} size="sm" />
            <span className="mt-panel-hint">
              이 카드를 가진 사람이 프렌드가 됩니다 (내 카드면 노프렌드 처리)
            </span>
          </div>
        </div>
      )}

      {mode === 'first_trick' && (
        <p className="mt-panel-hint">첫 트릭을 이기는 사람이 프렌드가 됩니다</p>
      )}
      {mode === 'none' && (
        <p className="mt-panel-hint">프렌드 없이 혼자 수비팀 4명을 상대합니다</p>
      )}

      <div className="mt-panel-actions">
        <button
          type="button"
          className="mt-action-button primary"
          onClick={() => onSubmit(mode, mode === 'card' ? card : undefined)}
        >
          {mode === 'card' ? '이 카드로 지정' : mode === 'first_trick' ? '첫 트릭 승자로 지정' : '노프렌드 확정'}
        </button>
      </div>
    </div>
  );
}

// ---------- 조커 리드 문양 선택 / 조커콜 선언 ----------

interface MightyJokerSuitPickerProps {
  onPick: (suit: MTSuit) => void;
  onCancel: () => void;
}

export function MightyJokerSuitPicker({ onPick, onCancel }: MightyJokerSuitPickerProps) {
  return (
    <div className="mt-panel">
      <p className="mt-panel-title">조커로 리드 — 문양을 지정하세요</p>
      <div className="mt-suit-row">
        {PLAIN_SUITS.map((s) => (
          <button
            key={s}
            type="button"
            className="mt-suit-button"
            onClick={() => onPick(s)}
          >
            <SuitLabel suit={s} />
          </button>
        ))}
      </div>
      <div className="mt-panel-actions">
        <button type="button" className="mt-action-button" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

interface MightyJokerCallConfirmProps {
  card: MTCard;
  onPlay: (jokerCall: boolean) => void;
  onCancel: () => void;
}

export function MightyJokerCallConfirm({
  card,
  onPlay,
  onCancel,
}: MightyJokerCallConfirmProps) {
  return (
    <div className="mt-panel">
      <div className="mt-friend-preview">
        <MightyCard card={card} size="sm" />
        <span className="mt-panel-title">조커콜 카드입니다 — 조커콜을 선언할까요?</span>
      </div>
      <p className="mt-panel-hint">
        선언하면 조커 소지자는 이번 트릭에 조커를 내야 하며, 그 조커는 최약이 됩니다
      </p>
      <div className="mt-panel-actions">
        <button
          type="button"
          className="mt-action-button primary"
          onClick={() => onPlay(true)}
        >
          조커콜 선언
        </button>
        <button type="button" className="mt-action-button" onClick={() => onPlay(false)}>
          그냥 내기
        </button>
        <button type="button" className="mt-action-button" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
