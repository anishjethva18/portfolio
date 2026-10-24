import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useOS } from '../../context/OSContext';
import { X, Delete, CornerDownLeft, ArrowBigUp, Minimize2, Space } from 'lucide-react';
import { haptics } from '../../utils/haptics';

export const TouchKeyboard: React.FC = () => {
  const { isTouchKeyboardOpen, closeTouchKeyboard } = useOS();
  const [isShift, setIsShift] = useState(false);
  const [isCaps, setIsCaps] = useState(false);
  const [isCtrl, setIsCtrl] = useState(false);
  const [isAlt, setIsAlt] = useState(false);
  const [symbolMode, setSymbolMode] = useState(false);
  const lastFocusedTargetRef = useRef<HTMLElement | null>(null);

  // Custom Drag State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return; // Only left-click drags
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    draggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { ...position };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      if (e.cancelable) {
        e.preventDefault();
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      setPosition({
        x: positionStartRef.current.x + deltaX,
        y: positionStartRef.current.y + deltaY,
      });
    };

    const handleEnd = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [position]);

  // Handle Dynamic inputmode="none" to block Native OS Keyboard on Mobile
  useEffect(() => {
    if (!isTouchKeyboardOpen) return;

    const applyInputModeNone = (el: HTMLElement) => {
      if (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable ||
        el.getAttribute('contenteditable') === 'true'
      ) {
        if (!el.hasAttribute('data-original-inputmode')) {
          el.setAttribute('data-original-inputmode', el.getAttribute('inputmode') || '');
        }
        el.setAttribute('inputmode', 'none');
      }
    };

    if (document.activeElement) {
      applyInputModeNone(document.activeElement as HTMLElement);
    }

    const handleFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el) {
        applyInputModeNone(el);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el) {
        applyInputModeNone(el);
      }
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('click', handleClick);

      const elements = document.querySelectorAll('input, textarea, [contenteditable="true"]');
      elements.forEach((el) => {
        const input = el as HTMLElement;
        const original = input.getAttribute('data-original-inputmode');
        if (original !== null) {
          if (original === '') {
            input.removeAttribute('inputmode');
          } else {
            input.setAttribute('inputmode', original);
          }
          input.removeAttribute('data-original-inputmode');
        }
      });
    };
  }, [isTouchKeyboardOpen]);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable ||
          el.getAttribute('contenteditable') === 'true')
      ) {
        lastFocusedTargetRef.current = el;
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  if (!isTouchKeyboardOpen) return null;

  const letterRows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  const symbolRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'],
    ['!', '"', "'", ':', ';', '/', '?', ',', '.'],
  ];

  const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  };

  const getTarget = (): HTMLElement | null => {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      active !== document.body &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable ||
        active.getAttribute('contenteditable') === 'true')
    ) {
      return active;
    }
    return lastFocusedTargetRef.current;
  };

  const handleKeyPress = (char: string) => {
    haptics.light();
    const target = getTarget();

    if (isCtrl || isAlt) {
      const key = isShift || isCaps ? char.toUpperCase() : char;
      const code = /^[a-z]$/i.test(char)
        ? `Key${char.toUpperCase()}`
        : /^[0-9]$/.test(char) ? `Digit${char}` : '';
      const event = new KeyboardEvent('keydown', {
        key,
        code,
        ctrlKey: isCtrl,
        altKey: isAlt,
        shiftKey: isShift || isCaps,
        bubbles: true,
        cancelable: true,
      });
      if (target?.isConnected) target.dispatchEvent(event);
      else window.dispatchEvent(event);
      setIsCtrl(false);
      setIsAlt(false);
      if (isShift && !isCaps) setIsShift(false);
      return;
    }

    if (target) {
      target.focus();
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const val = input.value || '';
        const newVal = val.substring(0, start) + char + val.substring(end);
        setNativeValue(input, newVal);
        input.selectionStart = input.selectionEnd = start + char.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !target.contains(sel.anchorNode)) {
          target.focus();
        }
        document.execCommand('insertText', false, char);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true,
        })
      );
    }

    if (isShift && !isCaps) {
      setIsShift(false);
    }
  };

  const handleBackspace = () => {
    haptics.medium();
    const target = getTarget();

    if (target) {
      target.focus();
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const val = input.value || '';
        if (start === end && start > 0) {
          const newVal = val.substring(0, start - 1) + val.substring(end);
          setNativeValue(input, newVal);
          input.selectionStart = input.selectionEnd = start - 1;
        } else if (start !== end) {
          const newVal = val.substring(0, start) + val.substring(end);
          setNativeValue(input, newVal);
          input.selectionStart = input.selectionEnd = start;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        document.execCommand('delete', false);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          code: 'Backspace',
          bubbles: true,
        })
      );
    }
  };

  const handleEnter = () => {
    haptics.medium();
    const target = getTarget();

    if (target) {
      target.focus();
      if (target.tagName === 'TEXTAREA') {
        const input = target as HTMLTextAreaElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const val = input.value || '';
        const newVal = val.substring(0, start) + '\n' + val.substring(end);
        setNativeValue(input, newVal);
        input.selectionStart = input.selectionEnd = start + 1;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (target.tagName === 'INPUT') {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        const form = (target as HTMLInputElement).form;
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      } else if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
        document.execCommand('insertLineBreak');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
        })
      );
    }
  };

  const currentRows = symbolMode ? symbolRows : letterRows;

  return (
    <div
      style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
      className="fixed bottom-14 left-1/2 z-[9999] w-[96vw] max-w-2xl bg-slate-900/95 dark:bg-[#1c1c1e]/98 backdrop-blur-2xl border border-slate-700/60 dark:border-white/15 rounded-2xl shadow-2xl p-2.5 sm:p-3 select-none touch-manipulation animate-in fade-in slide-in-from-bottom-5 duration-200"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Keyboard Header */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className="flex items-center justify-between pb-2 mb-1 border-b border-white/10 text-xs text-slate-400 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold tracking-wide text-slate-200">Windows Touch Keyboard</span>
        </div>
        <div 
          className="flex items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={closeTouchKeyboard}
            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={closeTouchKeyboard}
            className="p-1 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Close Keyboard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Number Row */}
      <div className="grid grid-cols-10 gap-1 sm:gap-1.5 mb-1.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
          <button
            key={num}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleKeyPress(num)}
            className="h-9 sm:h-10 rounded-lg bg-white/5 hover:bg-white/15 active:bg-cyan-500/30 active:scale-95 text-slate-200 font-semibold text-xs sm:text-sm border border-white/5 shadow transition-all cursor-pointer flex items-center justify-center"
          >
            {num}
          </button>
        ))}
      </div>

      {/* Rows */}
      {currentRows.map((row, rIdx) => (
        <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5 mb-1.5">
          {rIdx === 2 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                haptics.medium();
                if (isShift) {
                  setIsCaps(!isCaps);
                } else {
                  setIsShift(true);
                }
              }}
              className={`flex-1 max-w-[60px] h-9 sm:h-10 rounded-lg font-bold text-xs border shadow transition-all cursor-pointer flex items-center justify-center ${
                isShift || isCaps
                  ? 'bg-cyan-500 text-white border-cyan-400 shadow-cyan-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/5'
              }`}
              title="Shift / Caps Lock"
            >
              <ArrowBigUp className="w-4 h-4" />
            </button>
          )}

          {row.map((char) => {
            const displayChar = isShift || isCaps ? char.toUpperCase() : char;
            return (
              <button
                key={char}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleKeyPress(displayChar)}
                className="flex-1 min-w-[28px] max-w-[56px] h-9 sm:h-10 rounded-lg bg-white/10 hover:bg-white/20 active:bg-cyan-500/30 active:scale-95 text-white font-medium text-xs sm:text-sm border border-white/5 shadow transition-all cursor-pointer flex items-center justify-center"
              >
                {displayChar}
              </button>
            );
          })}

          {rIdx === 2 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleBackspace}
              className="flex-1 max-w-[60px] h-9 sm:h-10 rounded-lg bg-white/10 hover:bg-white/20 active:bg-red-500/30 active:scale-95 text-slate-200 text-xs border border-white/5 shadow transition-all cursor-pointer flex items-center justify-center"
              title="Backspace"
            >
              <Delete className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {/* Bottom Control Row */}
      <div className="flex items-center justify-center gap-1 sm:gap-1.5 pt-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsCtrl((active) => !active)}
          aria-label="Ctrl modifier"
          aria-pressed={isCtrl}
          className={`h-9 rounded-lg border px-2.5 text-[10px] font-bold transition-all cursor-pointer sm:h-10 ${
            isCtrl ? 'border-cyan-400 bg-cyan-500 text-white' : 'border-white/5 bg-white/10 text-slate-200 hover:bg-white/20'
          }`}
          title="Ctrl modifier"
        >
          Ctrl
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsAlt((active) => !active)}
          aria-label="Alt modifier"
          aria-pressed={isAlt}
          className={`h-9 rounded-lg border px-2.5 text-[10px] font-bold transition-all cursor-pointer sm:h-10 ${
            isAlt ? 'border-cyan-400 bg-cyan-500 text-white' : 'border-white/5 bg-white/10 text-slate-200 hover:bg-white/20'
          }`}
          title="Alt modifier"
        >
          Alt
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            haptics.medium();
            setSymbolMode(!symbolMode);
          }}
          className="px-3 h-9 sm:h-10 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs border border-white/5 transition-all cursor-pointer"
        >
          {symbolMode ? 'ABC' : '&123'}
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleKeyPress(',')}
          className="w-10 h-9 sm:h-10 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs sm:text-sm font-semibold border border-white/5 cursor-pointer"
        >
          ,
        </button>

        {/* Spacebar */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleKeyPress(' ')}
          className="flex-1 h-9 sm:h-10 rounded-lg bg-white/15 hover:bg-white/25 active:bg-cyan-500/30 active:scale-98 text-slate-400 text-xs border border-white/10 shadow transition-all cursor-pointer flex items-center justify-center gap-1"
        >
          <Space className="w-3.5 h-3.5 opacity-60" />
          <span className="text-[11px] font-medium text-slate-300">Space</span>
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleKeyPress('.')}
          className="w-10 h-9 sm:h-10 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs sm:text-sm font-semibold border border-white/5 cursor-pointer"
        >
          .
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleEnter}
          className="px-4 h-9 sm:h-10 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs border border-cyan-400 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
          title="Enter"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
