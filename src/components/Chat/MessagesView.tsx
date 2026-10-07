import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { UserProfile, ChatMessage } from '../../services/types';
import { Send, Info } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

export const MessagesView: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // The ID of the person we are chatting with
  const { user, profile } = useApp();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [activeContact, setActiveContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Contacts (People we follow, or who follow us)
  useEffect(() => {
    const fetchContacts = async () => {
      if (!user || !profile) return;
      setLoadingContacts(true);
      try {
        const following = profile.following || [];
        const followers = profile.followers || [];
        const contactIds = Array.from(new Set([...following, ...followers]));
        
        const fetchedContacts: UserProfile[] = [];
        for (const cid of contactIds) {
          const p = await databaseService.getProfile(cid);
          if (p) fetchedContacts.push(p);
        }
        setContacts(fetchedContacts);

        if (id) {
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
  }, [user, profile, id, navigate]);

  // Load Messages for active contact
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !activeContact) return;
      setLoadingMessages(true);
      try {
        const msgs = await databaseService.getChatMessages(user.id, activeContact.id);
        setMessages(msgs);
        scrollToBottom();
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();

    // Simulated realtime polling
    const interval = setInterval(() => {
      if (user && activeContact) {
        databaseService.getChatMessages(user.id, activeContact.id).then(msgs => {
          setMessages(prev => {
            if (prev.length !== msgs.length) {
              setTimeout(scrollToBottom, 100);
              return msgs;
            }
            return prev;
          });
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, activeContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeContact) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      const msg = await databaseService.sendChatMessage(user.id, activeContact.id, content);
      setMessages(prev => [...prev, msg]);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleContactClick = (contactId: string) => {
    navigate(`/messages/${contactId}`);
  };

  if (!user) {
    return (
      <div className="studio-view">
        <div className="page">
          <EmptyState icon="users" title="Sign in to message authors" text="Messages are for authors you follow in the Public Library." />
        </div>
      </div>
    );
  }

  return (
    <div className="messages">
      <section className="contacts" aria-label="Conversations">
        <div className="contacts-head">
          <h1>Messages</h1>
          <p>Authors you follow</p>
        </div>
        {loadingContacts ? (
          <p className="meta" style={{ padding: '18px 22px' }}>Loading conversations…</p>
        ) : contacts.length === 0 ? (
          <p className="meta" style={{ padding: '18px 22px', lineHeight: 1.7 }}>
            You aren't following anyone yet. Find authors in the Public Library to connect.
          </p>
        ) : (
          contacts.map((c) => (
            <button
              key={c.id}
              className="contact"
              aria-current={activeContact?.id === c.id ? 'true' : undefined}
              onClick={() => handleContactClick(c.id)}
            >
              <span className="avatar">{(c.display_name || 'A')[0].toUpperCase()}</span>
              <span>
                <strong>{c.display_name || 'Anonymous'}</strong>
                <small>{c.bio || 'Author'}</small>
              </span>
            </button>
          ))
        )}
      </section>

      <section className="chat" aria-label="Conversation">
        {activeContact ? (
          <>
            <div className="chat-head">
              <span className="avatar">{(activeContact.display_name || 'A')[0].toUpperCase()}</span>
              <strong
                style={{ font: '24px var(--serif)', fontWeight: 400, cursor: 'pointer' }}
                onClick={() => navigate(`/library/author/${activeContact.id}`)}
              >
                {activeContact.display_name || 'Anonymous'}
              </strong>
            </div>
            <p className="chat-notice">
              <Info style={{ display: 'inline', width: 13, height: 13, verticalAlign: '-2px' }} /> Messages in this chat are temporary and are deleted after 14 days.
            </p>
            <div className="chat-log" role="log" aria-live="polite">
              {loadingMessages ? (
                <p className="meta">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="meta" style={{ textAlign: 'center' }}>Say hello. This is the start of your conversation.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`bubble${m.sender_id === user.id ? ' me' : ''}`}>
                    {m.content}
                    <small>{formatTime(m.created_at)}</small>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-form" onSubmit={handleSendMessage}>
              <label className="sr-only" htmlFor="chat-input">Message</label>
              <input className="input" id="chat-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message…" autoComplete="off" />
              <button className="small-btn is-primary" disabled={!newMessage.trim()}>
                <Send /> Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', padding: 30 }}>
            <EmptyState icon="users" title="Your messages" text="Select a conversation, or find authors in the Public Library to connect." />
          </div>
        )}
      </section>
    </div>
  );
};
