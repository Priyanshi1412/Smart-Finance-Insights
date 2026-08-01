import { useState, useRef, useEffect, useCallback } from 'react';
import { reportAPI } from '../services/api';
import Icon, { icons } from './Icon';

const INITIAL_SUGGESTIONS = [
  { text: 'How much did I spend this month?', icon: '💳' },
  { text: 'What is my financial health score?', icon: '❤️' },
  { text: 'Show my budget status', icon: '📊' },
  { text: 'How are my investments performing?', icon: '📈' },
];

const TYPING_MESSAGES = [
  'Analyzing your financial data...',
  'Crunching the numbers...',
  'Reviewing your accounts...',
  'Preparing your insights...',
  'Calculating recommendations...',
];

function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      const content = line.replace(/\*\*/g, '');
      return <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 10 : 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{content}</div>;
    }

    if (line.match(/^─+$/) || line.match(/^---+$/)) {
      return <div key={i} style={{ borderTop: '1px solid var(--border-light)', margin: '6px 0' }} />;
    }

    if (line.trim() === '') {
      return <div key={i} style={{ height: 4 }} />;
    }

    return (
      <div key={i} style={{
        lineHeight: 1.65,
        paddingLeft: line.startsWith('  • ') || line.startsWith('• ') ? 4 : 0,
      }}>
        {renderInlineFormatting(line)}
      </div>
    );
  });
}

function renderInlineFormatting(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{highlightValues(part)}</span>;
  });
}

function highlightValues(text) {
  if (!text) return text;
  const parts = text.split(/(₹[\d,]+(?:\.\d+)?|[\d.]+%|\d{4}-\d{2}-\d{2})/g);
  return parts.map((part, i) => {
    if (part.match(/^₹[\d,]+(?:\.\d+)?$/)) {
      return (
        <span key={i} style={{
          color: 'var(--accent-light, #60a5fa)',
          fontWeight: 600,
        }}>
          {part}
        </span>
      );
    }
    if (part.match(/^[\d.]+%$/)) {
      return <span key={i} style={{ color: 'var(--purple, #a78bfa)', fontWeight: 600 }}>{part}</span>;
    }
    return part;
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function TypingIndicator({ message }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-light)',
        maxWidth: '80%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s infinite 0.2s' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s infinite 0.4s' }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {message}
        </div>
      </div>
    </div>
  );
}

export default function JARVISAssistant({ embedded = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm **JARVIS**, your AI-powered financial assistant. I analyze your real financial data to provide intelligent insights.\n\nAsk me anything about your spending, savings, investments, or goals — I understand natural language.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [typingMessage, setTypingMessage] = useState(TYPING_MESSAGES[0]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const loadingIntervalRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (loading) {
      let idx = 0;
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % TYPING_MESSAGES.length;
        setTypingMessage(TYPING_MESSAGES[idx]);
      }, 2000);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [loading]);

  const handleSend = useCallback(async (text) => {
    const query = text || input.trim();
    if (!query || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: query, timestamp: Date.now() }]);
    setInput('');
    setLoading(true);
    setLastQuery(query);
    setTypingMessage(TYPING_MESSAGES[Math.floor(Math.random() * TYPING_MESSAGES.length)]);

    try {
      const res = await reportAPI.askJARVIS(query);
      const responseText = res.data?.response || 'I received an empty response. Please try again.';
      const serverSuggestions = res.data?.suggestions || [];

      setMessages(prev => [...prev, { role: 'assistant', text: responseText, timestamp: Date.now() }]);

      if (serverSuggestions.length > 0) {
        setSuggestions(serverSuggestions);
      }
    } catch (err) {
      let displayMsg;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        displayMsg = 'Request timed out. The server took too long to respond. Please try again.';
      } else if (!err.response) {
        displayMsg = 'Cannot connect to the server. Please make sure the backend is running on port 4000.';
      } else {
        const serverMsg = err.response?.data?.error || err.response?.data?.response;
        displayMsg = serverMsg
          ? `I couldn't process that request: ${serverMsg}`
          : `Server error (${err.response.status}). Please try again.`;
      }
      setMessages(prev => [...prev, { role: 'assistant', text: displayMsg, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleRetry = useCallback(() => {
    if (lastQuery && !loading) {
      handleSend(lastQuery);
    }
  }, [lastQuery, loading, handleSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSuggestionClick = useCallback((text) => {
    handleSend(text);
  }, [handleSend]);

  if (embedded) {
    return (
      <div style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon path={icons.brain} size={16} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>JARVIS Assistant</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI-powered financial insights</div>
          </div>
        </div>
        <EmbeddedChat
          messages={messages}
          input={input}
          setInput={setInput}
          loading={loading}
          handleSend={handleSend}
          handleKeyDown={handleKeyDown}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          suggestions={suggestions}
          lastQuery={lastQuery}
          handleRetry={handleRetry}
          typingMessage={typingMessage}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
          zIndex: 1000,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.3)';
        }}
        title="JARVIS Financial Assistant"
      >
        <Icon path={isOpen ? 'M18 6L6 18M6 6l12 12' : icons.brain} size={24} style={{ color: '#fff' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24,
          width: 400, maxWidth: 'calc(100vw - 48px)',
          height: 580, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 1000,
          animation: 'slideUp 0.3s ease-out',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon path={icons.brain} size={18} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>JARVIS</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--success-light, #34d399)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success, #10b981)', display: 'inline-block' }} />
                  Online
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon path="M18 6L6 18M6 6l12 12" size={18} />
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeIn 0.3s ease-out',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, marginLeft: 2,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon path={icons.brain} size={10} style={{ color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>JARVIS</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user'
                    ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)'
                    : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-glass)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: '0.83rem',
                  lineHeight: 1.5,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  {msg.role === 'assistant' ? renderFormattedText(msg.text) : msg.text}
                </div>
                {msg.timestamp && (
                  <div style={{
                    fontSize: '0.62rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                    paddingLeft: msg.role === 'assistant' ? 24 : 0,
                    paddingRight: msg.role === 'user' ? 4 : 0,
                    opacity: 0.7,
                  }}>
                    {formatTime(msg.timestamp)}
                  </div>
                )}
              </div>
            ))}

            {loading && <TypingIndicator message={typingMessage} />}

            {!loading && messages.length > 1 && messages[messages.length - 1].role === 'assistant' && lastQuery && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleRetry}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-glow, rgba(59,130,246,0.1))';
                    e.currentTarget.style.color = 'var(--accent-light, #60a5fa)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-glass)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={12} />
                  Retry
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && !loading && (
            <div style={{
              padding: '0 16px 12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              {suggestions.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(q.text)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-glow, rgba(59,130,246,0.1))';
                    e.currentTarget.style.color = 'var(--accent-light, #60a5fa)';
                    e.currentTarget.style.borderColor = 'var(--accent-light, #60a5fa)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-glass)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                  }}
                >
                  <span>{q.icon}</span>
                  {q.text}
                </button>
              ))}
            </div>
          )}

          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex', gap: '8px',
            background: 'var(--bg-glass)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask JARVIS anything about your finances..."
              disabled={loading}
              style={{
                flex: 1, padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: input.trim() ? 'var(--accent)' : 'var(--bg-input)',
                border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon path={icons.trendingUp} size={18} style={{ color: input.trim() ? '#fff' : 'var(--text-muted)' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EmbeddedChat({ messages, input, setInput, loading, handleSend, handleKeyDown, inputRef, messagesEndRef, suggestions, lastQuery, handleRetry, typingMessage, onSuggestionClick }) {
  return (
    <>
      <div style={{
        height: 300, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user'
                ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)'
                : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? renderFormattedText(msg.text) : msg.text}
            </div>
            {msg.timestamp && (
              <div style={{
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                marginTop: 2,
                opacity: 0.7,
              }}>
                {formatTime(msg.timestamp)}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite 0.2s' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite 0.4s' }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 4, fontStyle: 'italic' }}>{typingMessage}</span>
            </div>
          </div>
        )}
        {!loading && messages.length > 1 && messages[messages.length - 1].role === 'assistant' && lastQuery && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-muted)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '3px',
              }}
            >
              <Icon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={11} />
              Retry
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {suggestions.length > 0 && !loading && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {suggestions.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(q.text)}
              style={{
                padding: '5px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <span>{q.icon}</span>
              {q.text}
            </button>
          ))}
        </div>
      )}

      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex', gap: '8px',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask JARVIS anything about your finances..."
          disabled={loading}
          style={{
            flex: 1, padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: input.trim() ? 'var(--accent)' : 'var(--bg-input)',
            border: 'none',
            color: input.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Send
        </button>
      </div>
    </>
  );
}
