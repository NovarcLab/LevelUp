import type { ReactElement, ReactNode } from 'react';
import type { MockMessage } from '@/lib/mock';
import type { CardPayload } from '@levelup/shared';
import InlineCard from './InlineCard';

interface MessageListProps {
  messages: MockMessage[];
  card?: CardPayload | undefined;
}

export default function MessageList({
  messages,
  card,
}: MessageListProps): ReactElement {
  const nodes: ReactNode[] = [];
  for (const m of messages) {
    if (m.timestamp) {
      nodes.push(
        <div key={`${m.id}-ts`} className="timestamp">
          {m.timestamp}
        </div>,
      );
    }
    if (m.content === '__CARD__' && card) {
      nodes.push(<InlineCard key={m.id} card={card} />);
      continue;
    }
    if (m.role === 'assistant') {
      nodes.push(
        <div key={m.id} className="msg-ai">
          {m.content}
        </div>,
      );
    } else {
      nodes.push(
        <div key={m.id} className="msg-user">
          <div className="msg-user-text">{m.content}</div>
          <div className="msg-user-line" />
        </div>,
      );
    }
  }
  return (
    <div className="msg-area">
      <div className="msg-col">{nodes}</div>
    </div>
  );
}
