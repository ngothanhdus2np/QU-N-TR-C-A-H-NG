import React, { useState, useRef } from 'react';
import { BrainCircuit, X, Minus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ChatInterface from './ChatInterface';
import type { AppData, ChatMessage } from '../types';

interface Props {
  data: AppData;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const FloatingCFOChat: React.FC<Props> = ({ data, messages, setMessages }) => {
  const [open, setOpen] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  return (
    // Full-screen transparent overlay — pointer-events-none so clicks pass through to the page
    <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => { dragging.current = true; }}
        onDragEnd={() => { setTimeout(() => { dragging.current = false; }, 80); }}
        // Re-enable pointer events only on the draggable island
        className="absolute bottom-6 left-6 pointer-events-auto flex flex-col items-start gap-3"
        style={{ width: 56, userSelect: 'none' }}
      >
        {/* Popup — opens above the button */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 shrink-0 bg-white">
                <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-none">CFO AI</p>
                  <p className="text-xs text-slate-400 mt-0.5">Trợ lý tài chính</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>

              {/* Chat area */}
              <div className="flex-1 min-h-0">
                <ChatInterface
                  data={data}
                  messages={messages}
                  setMessages={setMessages}
                  isCFOReady={true}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Draggable button */}
        <motion.button
          onClick={() => { if (!dragging.current) setOpen(v => !v); }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="w-14 h-14 bg-slate-900 rounded-full shadow-xl flex items-center justify-center text-white relative cursor-grab active:cursor-grabbing"
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="brain"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <BrainCircuit className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Blue dot khi có lịch sử chat và popup đang đóng */}
          {messages.length > 0 && !open && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default FloatingCFOChat;
