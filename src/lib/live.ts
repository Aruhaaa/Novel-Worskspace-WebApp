import type { RealtimeChannel } from '@supabase/supabase-js';
import { cloud } from './cloud';

/**
 * Things that happen while the app is open, delivered as they happen.
 *  - With the cloud database: Supabase Realtime.
 *  - Without it (local mode): the browser tells every other tab of the same browser when saved data changes.
 * Nothing here is needed for correctness. Every screen that uses it also checks again now and then, so a missed
 * message only means it shows up a little later.
 */

export interface LiveEvent<T> {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  row: T;
  old: Partial<T>;
}

/** Listen for changes to rows of a table. Returns the function that stops listening. Quiet without a cloud database. */
export const watchTable = <T extends object>(options: {
  /** A name for the connection; it only has to be unique among open ones */
  name: string;
  table: string;
  /** For example `receiver_id=eq.<id>`, so only this person's rows are sent */
  filter?: string;
  onEvent: (event: LiveEvent<T>) => void;
  /** True once connected, false when the connection is lost or cannot be made */
  onStatus?: (connected: boolean) => void;
}): (() => void) => {
  const client = cloud();
  if (!client) {
    options.onStatus?.(false);
    return () => undefined;
  }
  const channel: RealtimeChannel = client
    .channel(options.name)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: options.table, ...(options.filter ? { filter: options.filter } : {}) },
      (payload) => options.onEvent({ event: payload.eventType as LiveEvent<T>['event'], row: payload.new as T, old: payload.old as Partial<T> })
    )
    .subscribe((status) => options.onStatus?.(status === 'SUBSCRIBED'));
  return () => {
    void client.removeChannel(channel);
  };
};

/** Run `onChange` when another tab of this browser changes any of these saved keys. For local mode. */
export const onLocalChange = (keys: string[], onChange: () => void): (() => void) => {
  const handler = (e: StorageEvent) => {
    if (e.key === null || keys.some((k) => e.key === k || e.key?.startsWith(k))) onChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

/**
 * A line that small messages travel along between everyone who has it open: "is typing", who is on a project.
 * Messages are not stored anywhere. In the cloud a line can be private, so only people the database allows can join it.
 */
export interface BroadcastLine {
  send: (event: string, payload: unknown) => void;
  on: <T>(event: string, listener: (payload: T) => void) => void;
  /** Start listening. Call after every `on`. */
  open: (onStatus?: (connected: boolean) => void) => void;
  /** Stop. In the cloud this takes a moment; a new line on the same name should wait for the returned promise. */
  close: () => Promise<void> | void;
}

export const createBroadcast = (name: string, options: { private?: boolean } = {}): BroadcastLine => {
  const client = cloud();
  const listeners = new Map<string, ((payload: unknown) => void)[]>();

  if (client) {
    const channel = client.channel(name, { config: { broadcast: { self: false }, private: !!options.private } });
    return {
      send: (event, payload) => {
        void channel.send({ type: 'broadcast', event, payload });
      },
      on: (event, listener) => {
        channel.on('broadcast', { event }, (message) => (listener as (p: unknown) => void)(message.payload));
      },
      open: (onStatus) => {
        channel.subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
      },
      close: () => client.removeChannel(channel).then(() => undefined),
    };
  }

  // Local mode: the same browser's other tabs
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(name) : null;
  if (bc) {
    bc.onmessage = (message: MessageEvent<{ event: string; payload: unknown }>) => {
      for (const fn of listeners.get(message.data?.event) ?? []) fn(message.data.payload);
    };
  }
  return {
    send: (event, payload) => bc?.postMessage({ event, payload }),
    on: (event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener as (p: unknown) => void]);
    },
    open: (onStatus) => onStatus?.(!!bc),
    close: () => bc?.close(),
  };
};
