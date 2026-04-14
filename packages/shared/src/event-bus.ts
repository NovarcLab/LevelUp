/**
 * Typed in-process event bus for cross-module communication.
 * Keeps packages decoupled: goal-tree emits, card/conversation subscribe.
 */

export interface EventMap {
  'milestone.completed': { userId: string; goalId: string; milestoneId: string };
  'goal.created': { userId: string; goalId: string };
  'goal.archived': { userId: string; goalId: string; reason?: string };
  'action.done': { userId: string; actionId: string; milestoneId: string };
  'action.skipped': { userId: string; actionId: string; consecutiveFails: number };
  'digest.written': { userId: string; conversationId: string };
  'intention.failed': { userId: string; intentionId: string; failCount: number };
  'silence.detected': { userId: string; lastMessageAt: string };
}

type Handler<T> = (payload: T) => void | Promise<void>;

const listeners = new Map<string, Set<Handler<unknown>>>();

export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try {
      void fn(payload);
    } catch {
      // fire-and-forget — individual handler errors don't propagate
    }
  }
}

export function on<K extends keyof EventMap>(
  event: K,
  handler: Handler<EventMap[K]>,
): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler as Handler<unknown>);
  return () => { set!.delete(handler as Handler<unknown>); };
}

export function once<K extends keyof EventMap>(
  event: K,
  handler: Handler<EventMap[K]>,
): () => void {
  const unsub = on(event, (payload) => {
    unsub();
    return handler(payload);
  });
  return unsub;
}

/** Remove all listeners — mainly for tests. */
export function clearAll(): void {
  listeners.clear();
}
