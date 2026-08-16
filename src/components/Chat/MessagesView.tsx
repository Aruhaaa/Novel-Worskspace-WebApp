import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { UserProfile, ChatMessage } from '../../services/types';
import { MessageSquare, Send, Clock, User as UserIcon, Loader2, ArrowLeft } from 'lucide-react';

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
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 h-full">
        <MessageSquare className="w-16 h-16 text-slate-700 mb-4" />
        <h3 className="text-xl font-bold mb-2">Sign in to message authors</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-slate-950 text-slate-200 overflow-hidden">
      
      {/* Sidebar: Contacts List */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            Messages
          </h2>
          <p className="text-xs text-slate-500 mt-1">Connections from your network</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {loadingContacts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center p-8 text-sm text-slate-500 font-sans">
              You aren't following anyone yet. Find authors in the Public Library to connect!
            </div>
          ) : (
            contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleContactClick(contact.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-1 ${activeContact?.id === contact.id ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300' : 'hover:bg-slate-800 text-slate-300 border border-transparent'}`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold shrink-0">
                  {contact.display_name?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate text-white">{contact.display_name || 'Anonymous'}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {profile?.following?.includes(contact.id) && profile?.followers?.includes(contact.id) 
                      ? 'Mutual Connection' 
                      : profile?.following?.includes(contact.id) ? 'You Follow Them' : 'Follows You'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        {/* Mobile Back Button & Header */}
        {activeContact ? (
          <>
            <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center px-4 shrink-0 z-10 sticky top-0">
              <button 
                onClick={() => navigate('/messages')} 
                className="md:hidden mr-4 p-2 text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div 
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold mr-3 cursor-pointer hover:ring-2 ring-indigo-500 transition-all"
                onClick={() => navigate(`/library/author/${activeContact.id}`)}
              >
                {activeContact.display_name?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
              </div>
              <div>
                <h3 
                  className="font-bold text-white cursor-pointer hover:underline"
                  onClick={() => navigate(`/library/author/${activeContact.id}`)}
                >
                  {activeContact.display_name || 'Anonymous'}
                </h3>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-amber-500/80">
              <Clock className="w-3.5 h-3.5" />
              Messages in this chat are temporary and will be permanently deleted after 14 days.
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col font-sans relative">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/5 to-transparent pointer-events-none" />
              
              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                  <p>Say hello to {activeContact.display_name || 'Anonymous'}!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user.id;
                  const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString();
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                            {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`px-4 py-2.5 rounded-2xl text-sm ${
                              isMe 
                                ? 'bg-indigo-600 text-white rounded-br-sm shadow-md shadow-indigo-600/20' 
                                : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/50'
                            }`}
                            style={{ wordBreak: 'break-word' }}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 font-medium px-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/80 backdrop-blur border-t border-slate-800 shrink-0">
              <div className="flex items-center gap-2 relative">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-full pl-5 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="absolute right-2 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-slate-700 hover:bg-indigo-500 transition-colors"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 md:hidden p-8 text-center">
            <MessageSquare className="w-16 h-16 text-slate-800 mb-6" />
            <h2 className="text-xl font-bold text-slate-300 mb-2">Your Messages</h2>
            <p className="text-sm font-sans mb-8">Select a conversation from the sidebar or find authors in the public library to connect.</p>
            
            <div className="w-full flex flex-col gap-2 max-w-sm">
              {contacts.map(c => (
                <button 
                  key={c.id}
                  onClick={() => navigate(`/messages/${c.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold">
                    {c.display_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-slate-300">{c.display_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
