import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useLive } from '../../context/LiveContext';
import { databaseService } from '../../services/database';
import type { UserProfile, ChatMessage } from '../../services/types';
import { Send, Info, Ban } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ReportButton } from '../Safety/ReportDialog';
import { useToast } from '../ui/toastContext';
import { createBroadcast, onLocalChange, watchTable, type BroadcastLine } from '../../lib/live';
import { loadPeerRead } from '../../lib/chat';
import { fmtTime, useT } from '../../i18n';

/** Add messages to a conversation without doubling any, oldest first. */
const mergeMessages = (prev: ChatMessage[], more: ChatMessage[]): ChatMessage[] => {
  const byId = new Map(prev.map((m) => [m.id, m]));
  let changed = false;
  for (const m of more) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
      changed = true;
    }
  }
  if (!changed && prev.length === more.length) return prev;
  return [...byId.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};

const TYPING_SHOWN_MS = 4500;
const TYPING_SEND_EVERY_MS = 2000;

export const MessagesView: React.FC = () => {
  const t = useT();
  const { id } = useParams<{ id: string }>(); // The ID of the person we are chatting with
  const { user, profile, isGuest, blockedIds, blockUser } = useApp();
  const { onIncoming, setActiveChat, markChatRead, unreadMessagesBy } = useLive();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [activeContact, setActiveContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  // Which conversation's messages have arrived. Loading is "the open one has not arrived yet", so it needs no state of its own.
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  const [sendError, setSendError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerReadUntil, setPeerReadUntil] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingLine = useRef<BroadcastLine | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<number | undefined>(undefined);
  const lastMarked = useRef('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load Contacts (People we follow, or who follow us)
  useEffect(() => {
    const fetchContacts = async () => {
      if (!user || !profile) return;
      setLoadingContacts(true);
      try {
        const following = profile.following || [];
        const followers = profile.followers || [];
        // People you have blocked are not in your list, and cannot be opened by address either
        const contactIds = Array.from(new Set([...following, ...followers])).filter((cid) => !blockedIds.includes(cid));

        const fetchedContacts: UserProfile[] = [];
        for (const cid of contactIds) {
          const p = await databaseService.getProfile(cid);
          if (p) fetchedContacts.push(p);
        }
        setContacts(fetchedContacts);

        if (id && blockedIds.includes(id)) {
          setActiveContact(null);
        } else if (id) {
          const target = await databaseService.getProfile(id);
          if (target) setActiveContact(target);
        } else if (fetchedContacts.length > 0) {
          navigate(`/messages/${fetchedContacts[0].id}`);
        }
      } catch (err) {
        console.error('Failed to load contacts', err);
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [user, profile, id, navigate, blockedIds]);

  const contactId = activeContact?.id;
  const userId = user?.id;
  const loadingMessages = !!contactId && loadedFor !== contactId;

  // Opening another conversation starts from a clean screen. Done while drawing, as React advises, not in an effect.
  const [shownFor, setShownFor] = useState(contactId);
  if (shownFor !== contactId) {
    setShownFor(contactId);
    setMessages([]);
    setPeerTyping(false);
    setPeerReadUntil(null);
  }

  // The app needs to know which conversation is on screen: what arrives in it is read, not counted as unread
  useEffect(() => {
    setActiveChat(contactId ?? null);
    lastMarked.current = '';
    return () => setActiveChat(null);
  }, [contactId, setActiveChat]);

  // Open a conversation: load it, then keep it up to date as messages arrive. `open` says whether this conversation is
  // still the one on screen, so a slow answer for one person never lands in another person's conversation.
  useEffect(() => {
    let open = true;
    const load = (quiet: boolean) => {
      if (!userId || !contactId) return;
      databaseService.getChatMessages(userId, contactId).then(
        (msgs) => {
          if (!open) return;
          setMessages((prev) => {
            const next = quiet ? mergeMessages(prev, msgs) : msgs;
            if (next !== prev && next.length !== prev.length) setTimeout(scrollToBottom, 100);
            return next;
          });
          if (!quiet) scrollToBottom();
          setLoadedFor(contactId);
        },
        (err) => {
          console.error('Failed to load messages', err);
          if (open) setLoadedFor(contactId);
        }
      );
    };
    load(false);
    const off = onIncoming((message) => {
      if (message && message.sender_id === contactId) {
        setMessages((prev) => mergeMessages(prev, [message]));
        setPeerTyping(false);
        setTimeout(scrollToBottom, 100);
      } else if (!message) {
        load(true);
      }
    });
    return () => {
      open = false;
      off();
    };
  }, [userId, contactId, onIncoming, scrollToBottom]);

  // What has been read is told to the server (and to this device) once it has been on screen
  useEffect(() => {
    if (!userId || !contactId || document.visibilityState !== 'visible') return;
    const newest = [...messages].reverse().find((m) => m.sender_id === contactId);
    if (newest && newest.created_at > lastMarked.current) {
      lastMarked.current = newest.created_at;
      void markChatRead(contactId, newest.created_at);
    }
  }, [messages, userId, contactId, markChatRead]);

  // "Seen": when the other person has read what was sent
  useEffect(() => {
    if (!userId || !contactId) return;
    let live = true;
    const load = () => {
      void loadPeerRead(userId, contactId).then((until) => {
        if (live && until) setPeerReadUntil((prev) => (!prev || until > prev ? until : prev));
      });
    };
    load();
    const offCloud = watchTable<{ read_until: string }>({
      name: `reads:${userId}:${contactId}`,
      table: 'message_reads',
      filter: `user_id=eq.${contactId}`,
      onEvent: (e) => {
        const until = e.row?.read_until;
        if (live && until) setPeerReadUntil((prev) => (!prev || until > prev ? until : prev));
      },
    });
    const offLocal = onLocalChange(['novel_chat_reads_'], load);
    return () => {
      live = false;
      offCloud();
      offLocal();
    };
  }, [userId, contactId]);

  // "is typing…": a light signal between the two people, never stored
  useEffect(() => {
    if (!userId || !contactId) return;
    const line = createBroadcast(`typing:${[userId, contactId].sort().join('_')}`);
    line.on<{ from: string }>('typing', (payload) => {
      if (payload?.from !== contactId) return;
      setPeerTyping(true);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPeerTyping(false), TYPING_SHOWN_MS);
    });
    line.open();
    typingLine.current = line;
    return () => {
      window.clearTimeout(typingTimer.current);
      line.close();
      typingLine.current = null;
    };
  }, [userId, contactId]);

  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!value.trim() || !user) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_EVERY_MS) return;
    lastTypingSent.current = now;
    typingLine.current?.send('typing', { from: user.id });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeContact) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSendError(null);

    try {
      const msg = await databaseService.sendChatMessage(user.id, activeContact.id, content);
      setMessages((prev) => mergeMessages(prev, [msg]));
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send message', err);
      // Put the text back so it is not lost, and say why
      setNewMessage(content);
      const reason = (err as { message?: unknown } | null)?.message;
      setSendError(typeof reason === 'string' && reason ? reason : t('That message could not be sent. Please try again.'));
    }
  };

  const handleBlockContact = async () => {
    if (!activeContact) return;
    const name = activeContact.display_name || t('this person');
    if (!window.confirm(t('Block {name}? You will not see what they write, and neither of you can message the other. You can unblock them in Preferences.', { name }))) return;
    const { saved } = await blockUser(activeContact.id);
    setActiveContact(null);
    setMessages([]);
    navigate('/messages');
    toast({ message: saved === 'saved' ? t('{name} is blocked.', { name }) : t('{name} is blocked on this device. It could not be saved to your account right now.', { name }) });
  };

  const handleContactClick = (contactId: string) => {
    navigate(`/messages/${contactId}`);
  };

  if (!user) {
    return (
      <div className="studio-view">
        <div className="page">
          <EmptyState icon="users" title={t('Sign in to message authors')} text={t('Messages are for authors you follow in the Public Library.')} />
        </div>
      </div>
    );
  }

  const visible = messages.filter((m) => !blockedIds.includes(m.sender_id));
  const lastMine = [...visible].reverse().find((m) => m.sender_id === user.id);
  const seenLastMine = !!lastMine && !!peerReadUntil && peerReadUntil >= lastMine.created_at;

  return (
    <div className="messages">
      <section className="contacts" aria-label={t('Conversations')}>
        <div className="contacts-head">
          <h1>{t('Messages')}</h1>
          <p>{t('Authors you follow')}</p>
        </div>
        {loadingContacts ? (
          <p className="meta" style={{ padding: '18px 22px' }}>{t('Loading conversations…')}</p>
        ) : contacts.length === 0 ? (
          <p className="meta" style={{ padding: '18px 22px', lineHeight: 1.7 }}>
            {t("You aren't following anyone yet. Find authors in the Public Library to connect.")}
          </p>
        ) : (
          contacts.map((c) => {
            const unread = unreadMessagesBy[c.id] ?? 0;
            return (
              <button key={c.id} className="contact" aria-current={activeContact?.id === c.id ? 'true' : undefined} onClick={() => handleContactClick(c.id)}>
                <span className="avatar">{(c.display_name || 'A')[0].toUpperCase()}</span>
                <span>
                  <strong>{c.display_name || t('Anonymous')}</strong>
                  <small>{c.bio || t('Author')}</small>
                </span>
                {unread > 0 && (
                  <span className="unread-dot" aria-label={t('{n} unread', { n: unread })}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </section>

      <section className="chat" aria-label={t('Conversation')}>
        {activeContact ? (
          <>
            <div className="chat-head">
              <span className="avatar">{(activeContact.display_name || 'A')[0].toUpperCase()}</span>
              <strong style={{ font: '24px var(--serif)', fontWeight: 400, cursor: 'pointer' }} onClick={() => navigate(`/library/author/${activeContact.id}`)}>
                {activeContact.display_name || t('Anonymous')}
              </strong>
              {!isGuest && (
                <button className="small-btn" style={{ marginLeft: 'auto' }} onClick={handleBlockContact}>
                  <Ban /> {t('Block')}
                </button>
              )}
            </div>
            <p className="chat-notice">
              <Info style={{ display: 'inline', width: 13, height: 13, verticalAlign: '-2px' }} /> {t('Messages in this chat are temporary and are deleted after 14 days.')}
            </p>
            <div className="chat-log" role="log" aria-live="polite">
              {loadingMessages ? (
                <p className="meta">{t('Loading messages…')}</p>
              ) : visible.length === 0 ? (
                <p className="meta" style={{ textAlign: 'center' }}>{t('Say hello. This is the start of your conversation.')}</p>
              ) : (
                visible.map((m) => (
                  <div key={m.id} className={`bubble${m.sender_id === user.id ? ' me' : ''}`}>
                    {m.content}
                    <small>
                      {fmtTime(m.created_at, { hour: '2-digit', minute: '2-digit' })}
                      {m.sender_id !== user.id && (
                        <>
                          {' · '}
                          <ReportButton subject={{ type: 'message', targetId: m.id, authorId: m.sender_id, authorName: activeContact.display_name, excerpt: m.content }} />
                        </>
                      )}
                      {m.id === lastMine?.id && seenLastMine && <span className="seen">{' · '}{t('Seen')}</span>}
                    </small>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <p className="typing-note" role="status" aria-live="polite">
              {peerTyping ? t('{name} is typing…', { name: activeContact.display_name || t('Anonymous') }) : ''}
            </p>
            {sendError && <p className="chat-notice" role="alert" style={{ color: 'var(--danger)' }}>{sendError}</p>}
            <form className="chat-form" onSubmit={handleSendMessage}>
              <label className="sr-only" htmlFor="chat-input">{t('Message')}</label>
              <input className="input" id="chat-input" value={newMessage} onChange={(e) => handleTyping(e.target.value)} placeholder={t('Type a message…')} autoComplete="off" />
              <button className="small-btn is-primary" disabled={!newMessage.trim()}>
                <Send /> {t('Send')}
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', padding: 30 }}>
            <EmptyState icon="users" title={t('Your messages')} text={t('Select a conversation, or find authors in the Public Library to connect.')} />
          </div>
        )}
      </section>
    </div>
  );
};
