import React, { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/notify';

interface SupportMessage {
  id: string;
  sender: 'cliente' | 'admin';
  body: string;
  created_at: string;
}

export const Soporte: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as SupportMessage[]);
  };

  useEffect(() => {
    loadMessages();
    // Refresca cada 5s para ver respuestas que el admin mande desde Telegram.
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from('support_messages')
        .insert([{ user_id: profile.id, sender: 'cliente', body: text.trim() }])
        .select()
        .single();

      if (error) throw error;

      setText('');
      await loadMessages();

      const result = await notify({
        channel: 'support',
        text: `💬 <b>Soporte — ${profile.full_name}</b> (${profile.email})\n\n${inserted.body}`
      });

      if (result.message_id) {
        await supabase.from('support_messages').update({ telegram_message_id: result.message_id }).eq('id', inserted.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-blue-400" />
          <span>Soporte</span>
        </h1>
        <p className="text-xs text-slate-400">
          Escríbenos aquí. Te responderemos directamente en esta conversación.
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-96 overflow-y-auto flex flex-col gap-2">
          {messages.length === 0 && (
            <p className="text-xs text-slate-500 text-center my-auto">Todavía no has escrito a soporte.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
              m.sender === 'cliente'
                ? 'self-end bg-blue-600 text-white rounded-br-sm'
                : 'self-start bg-slate-800 text-slate-100 rounded-bl-sm'
            }`}>
              {m.body}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            placeholder="Escribe tu mensaje..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
