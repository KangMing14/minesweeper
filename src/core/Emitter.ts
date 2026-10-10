export type Unsubscribe = () => void;

interface Subscription {
  readonly listener: (payload: never) => void;
}

export class Emitter<E extends object> {
  readonly #subscriptions = new Map<keyof E, Set<Subscription>>();

  constructor(
    private readonly onListenerError: (error: unknown) => void = () => {},
  ) {}

  on<K extends keyof E>(
    event: K,
    listener: (payload: E[K]) => void,
  ): Unsubscribe {
    const set = this.#subscriptions.get(event) ?? new Set<Subscription>();
    this.#subscriptions.set(event, set);
    const subscription: Subscription = { listener };
    set.add(subscription);
    return () => {
      set.delete(subscription);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.#subscriptions.get(event);
    if (set === undefined) return;
    for (const subscription of [...set]) {
      if (!set.has(subscription)) continue;
      try {
        (subscription.listener as (payload: E[K]) => void)(payload);
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }

  listenerCount(event: keyof E): number {
    return this.#subscriptions.get(event)?.size ?? 0;
  }
}
