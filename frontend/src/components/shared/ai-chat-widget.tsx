'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Check, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiChat, useAiChatHistory } from '@/hooks/use-ai-chat';
import { useCreateAppointment } from '@/hooks/use-appointments';
import { generateId } from '@/lib/utils/id';
import { useAuthStore } from '@/stores/auth.store';
import type { AiChatHistoryMessage, SuggestedSlot, SuggestedSpecialty } from '@/types/ai';
import type { ApiError } from '@/types/api';

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
  suggestedSpecialties?: SuggestedSpecialty[];
  suggestedSlots?: SuggestedSlot[];
}

// Feature 83 business rule: always shown alongside AI replies — chatbot
// never replaces an in-person consultation/diagnosis.
const DISCLAIMER = 'Chatbot không thay thế tư vấn bác sĩ.';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  from: 'bot',
  text: 'Xin chào! Tôi là trợ lý AI của Phòng Khám Đa Khoa Âu Cơ Phú Hà. Bạn cần hỗ trợ thông tin gì?',
};

// Feature 83/84/87/88 — one chip per capability, so a first-time user
// discovers what the chatbot can actually do instead of facing a blank input.
const SUGGESTED_PROMPTS = [
  'Tôi bị đau họng, sốt nhẹ thì nên khám chuyên khoa gì?',
  'Gợi ý giúp tôi giờ khám trống ngày mai',
  'Phòng khám có những dịch vụ gì, giá bao nhiêu?',
  'Thuốc Paracetamol dùng để làm gì?',
];

// Persisted in localStorage (not just component state) so closing the popup
// or reloading the page keeps the same conversation instead of starting a
// fresh session — paired with GET /ai/chat/:sessionId/history below.
const AI_SESSION_STORAGE_KEY = 'clinic-ai-chat-session-id';

function generateSessionId(): string {
  return generateId();
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId();
  const existing = window.localStorage.getItem(AI_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = generateSessionId();
  window.localStorage.setItem(AI_SESSION_STORAGE_KEY, created);
  return created;
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sessionId] = useState(getOrCreateSessionId);
  const chat = useAiChat();
  const history = useAiChatHistory(sessionId);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !history.data) return;
    hydratedRef.current = true;
    if (history.data.length === 0) return;
    setMessages([
      WELCOME_MESSAGE,
      ...history.data.map((entry, index) => ({
        id: `history-${index}`,
        from: entry.from,
        text: entry.text,
      })),
    ]);
  }, [history.data]);

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || chat.isPending) return;

    const history: AiChatHistoryMessage[] = messages
      .filter((message) => message.id !== 'welcome')
      .map((message) => ({ from: message.from === 'user' ? 'user' : 'bot', text: message.text }));

    setMessages((prev) => [...prev, { id: `${Date.now()}-user`, from: 'user', text }]);
    setInput('');

    chat.mutate(
      { sessionId, message: text, history },
      {
        onSuccess: (result) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-bot`,
              from: 'bot',
              text: result.reply,
              suggestedSpecialties: result.suggestedSpecialties,
              suggestedSlots: result.suggestedSlots,
            },
          ]);
        },
        onError: (err: ApiError) => {
          setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-bot-error`, from: 'bot', text: err.message },
          ]);
        },
      },
    );
  };

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:right-6">
          <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Trợ lý AI</p>
                <p className="text-xs text-primary-foreground/80">Luôn sẵn sàng hỗ trợ bạn</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/40 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.from === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    message.from === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-foreground'
                  }`}
                >
                  {message.text}
                </div>
                {message.suggestedSpecialties && message.suggestedSpecialties.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.suggestedSpecialties.map((specialty) => (
                      <Link key={specialty.id} href="/book-appointment">
                        <Button size="sm" variant="secondary">
                          Đặt lịch khám {specialty.name}
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
                {message.suggestedSlots && message.suggestedSlots.length > 0 && (
                  <div className="mt-1.5 flex w-full max-w-[90%] flex-col gap-1.5">
                    {message.suggestedSlots.map((slot) => (
                      <SuggestedSlotCard key={`${slot.doctorId}-${slot.datetime}`} slot={slot} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {chat.isPending && (
              <div className="flex items-start">
                <div className="max-w-[80%] rounded-2xl bg-white px-3.5 py-2 text-sm text-muted-foreground shadow-sm">
                  Đang trả lời...
                </div>
              </div>
            )}
            {messages.length === 1 && !chat.isPending && (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="rounded-full border border-primary/30 bg-white px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="border-t border-border bg-white px-4 py-1.5 text-center text-[11px] text-muted-foreground">
            {DISCLAIMER}
          </p>

          <form
            className="flex items-center gap-2 border-t border-border bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1"
              disabled={chat.isPending}
            />
            <Button type="submit" size="icon" aria-label="Gửi" className="shrink-0" disabled={chat.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 sm:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}

// Auto-booking (theo luồng chuẩn): a logged-in patient can confirm straight
// from the chat, calling the same POST /appointments a manual booking would
// — patientId is derived server-side from the token, no PII needed. A guest
// (not logged in, identity unknown to the chat) instead falls back to the
// real booking form, which is where identity collection belongs — the chat
// popup never collects account/PII fields itself.
function SuggestedSlotCard({ slot }: { slot: SuggestedSlot }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPatient = isAuthenticated && user?.role === 'PATIENT';
  const createAppointment = useCreateAppointment();

  return (
    <div className="rounded-xl border border-border bg-white p-2.5 text-xs shadow-sm">
      <p className="font-semibold text-foreground">
        {slot.doctorName} · {slot.time}
      </p>
      {slot.roomName && <p className="text-muted-foreground">{slot.roomName}</p>}
      <p className="mt-1 text-muted-foreground">{slot.reason}</p>

      {isPatient ? (
        createAppointment.isSuccess ? (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 rounded-md bg-green-50 py-1.5 text-green-700">
            <Check className="h-3.5 w-3.5" /> Đã đặt lịch
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="mt-1.5 w-full"
            disabled={createAppointment.isPending}
            onClick={() =>
              createAppointment.mutate({
                doctorId: slot.doctorId,
                serviceId: slot.serviceId,
                appointmentTime: slot.datetime,
              })
            }
          >
            {createAppointment.isPending ? 'Đang xác nhận...' : 'Xác nhận đặt lịch giờ này'}
          </Button>
        )
      ) : (
        <Link href="/book-appointment" className="mt-1.5 block">
          <Button size="sm" variant="secondary" className="w-full">
            Đặt lịch giờ này
          </Button>
        </Link>
      )}
    </div>
  );
}
