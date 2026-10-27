import React, { useState, useEffect } from 'react';
import {
  Menu,
  History,
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import { useOS } from '../../context/OSContext';

type CalcMode = 'standard' | 'scientific';

interface HistoryItem {
  equation: string;
  result: string;
}

export const CalculatorApp: React.FC = () => {
  const { windows, updateWindowSize } = useOS();
  const [mode, setMode] = useState<CalcMode>('standard');
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [memory, setMemory] = useState<number>(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [isRad, setIsRad] = useState(false); // false = DEG, true = RAD
  const [isFe, setIsFe] = useState(false); // Scientific notation toggle
  const [isSecond, setIsSecond] = useState(false); // 2nd functions toggle
  const [showTrigMenu, setShowTrigMenu] = useState(false);
  const [showFuncMenu, setShowFuncMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Persistent Calculator History
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('win11_calculator_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [newInput, setNewInput] = useState(true);
  const [openParentheses, setOpenParentheses] = useState(0);

  // Sync History to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('win11_calculator_history', JSON.stringify(historyList));
    } catch {}
  }, [historyList]);

  // Handle Mode Change and dynamically resize Calculator Window
  const handleModeSwitch = (newMode: CalcMode) => {
    setMode(newMode);
    const calcWindow = windows.find((w) => w.appId === 'calculator');
    if (calcWindow && !calcWindow.isMaximized) {
      if (newMode === 'scientific') {
        updateWindowSize(calcWindow.id, {
          width: Math.max(500, calcWindow.size.width),
          height: Math.max(580, calcWindow.size.height),
        });
      } else {
        updateWindowSize(calcWindow.id, {
          width: 350,
          height: 520,
        });
      }
    }
  };

  // High Precision Mathematical Expression Evaluator
  const evaluateMathExpression = (expr: string, angleInRad: boolean): number => {
    try {
      let sanitized = expr.trim();
      const openCount = (sanitized.match(/\(/g) || []).length;
      const closeCount = (sanitized.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        sanitized += ')'.repeat(openCount - closeCount);
      }

      sanitized = sanitized
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/mod/g, '%')
        .replace(/\bπ\b/g, `(${Math.PI})`)
        .replace(/\be\b/g, `(${Math.E})`);

      sanitized = sanitized.replace(/(\d+(\.\d+)?)!/g, (_, num) => {
        const n = Math.floor(parseFloat(num));
        if (n < 0) return 'NaN';
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return `(${res})`;
      });

      sanitized = sanitized.replace(/\^/g, '**');

      const radFactor = angleInRad ? 1 : Math.PI / 180;
      const invRadFactor = angleInRad ? 1 : 180 / Math.PI;

      const scope = {
        sin: (x: number) => Math.sin(x * radFactor),
        cos: (x: number) => Math.cos(x * radFactor),
        tan: (x: number) => Math.tan(x * radFactor),
        asin: (x: number) => Math.asin(x) * invRadFactor,
        acos: (x: number) => Math.acos(x) * invRadFactor,
        atan: (x: number) => Math.atan(x) * invRadFactor,
        sinh: (x: number) => Math.sinh(x),
        cosh: (x: number) => Math.cosh(x),
        tanh: (x: number) => Math.tanh(x),
        sqrt: (x: number) => Math.sqrt(x),
        cbrt: (x: number) => Math.cbrt(x),
        log: (x: number) => Math.log10(x),
        ln: (x: number) => Math.log(x),
        abs: (x: number) => Math.abs(x),
        floor: (x: number) => Math.floor(x),
        ceil: (x: number) => Math.ceil(x),
        exp: (x: number) => Math.exp(x),
      };

      const keys = Object.keys(scope);
      const values = Object.values(scope);
      const func = new Function(...keys, `"use strict"; return (${sanitized});`);
      const result = func(...values);

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return NaN;
      }
      return result;
    } catch (e) {
      return NaN;
    }
  };

  const formatNumberResult = (val: number): string => {
    if (isNaN(val)) return 'Invalid input';
    if (!isFinite(val)) return 'Cannot divide by zero';

    if (isFe) {
      return val.toExponential(8).replace('e+', 'e');
    }

    const str = val.toString();
    if (str.includes('e')) {
      return str;
    }
    if (str.includes('.')) {
      const precisionClean = parseFloat(val.toPrecision(15)).toString();
      return precisionClean;
    }
    return str;
  };

  const handleDigit = (digit: string) => {
    if (newInput || display === '0' || display === 'Invalid input' || display === 'Cannot divide by zero') {
      setDisplay(digit);
      setNewInput(false);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleDecimal = () => {
    if (newInput || display === 'Invalid input' || display === 'Cannot divide by zero') {
      setDisplay('0.');
      setNewInput(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperator = (op: string) => {
    if (equation && newInput) {
      setEquation(equation.replace(/ [+\-×÷^mod] $/g, ` ${op} `));
      return;
    }

    if (equation) {
      const fullExpr = equation + display;
      const intermediate = evaluateMathExpression(fullExpr, isRad);
      if (!isNaN(intermediate)) {
        setDisplay(formatNumberResult(intermediate));
      }
    }

    setEquation(`${equation}${display} ${op} `);
    setNewInput(true);
  };

  const handleParenthesis = (p: '(' | ')') => {
    if (p === '(') {
      setEquation((prev) => `${prev}(`);
      setOpenParentheses((c) => c + 1);
      setNewInput(true);
    } else if (p === ')' && openParentheses > 0) {
      setEquation((prev) => `${prev}${display}) `);
      setOpenParentheses((c) => Math.max(0, c - 1));
      setNewInput(true);
    }
  };

  const handleEquals = () => {
    if (!equation && newInput) return;
    const fullExpr = (equation + (newInput ? '' : display)).trim();
    if (!fullExpr) return;
    const val = evaluateMathExpression(fullExpr, isRad);

    const formatted = formatNumberResult(val);
    // Display preview without trailing equals sign (e.g. "5 × 9" instead of "5 × 9 =")
    const completedEquation = fullExpr;
    setEquation(completedEquation);
    setDisplay(formatted);
    setHistoryList((prev) => [
      { equation: completedEquation, result: formatted },
      ...prev,
    ]);
    setOpenParentheses(0);
    setNewInput(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setOpenParentheses(0);
    setNewInput(true);
  };

  const handleClearEntry = () => {
    setDisplay('0');
    setNewInput(true);
  };

  const handleBackspace = () => {
    if (newInput) return;
    if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
      setNewInput(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleNegate = () => {
    if (display === '0' || display === 'Invalid input') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  // Immediate Unary Operations
  const handleUnaryOp = (type: string) => {
    const val = parseFloat(display);
    if (isNaN(val)) return;

    let res = 0;
    let label = '';
    const radFactor = isRad ? 1 : Math.PI / 180;
    const invRadFactor = isRad ? 1 : 180 / Math.PI;

    switch (type) {
      case 'sqr':
        res = val * val;
        label = `sqr(${val})`;
        break;
      case 'cube':
        res = val * val * val;
        label = `cube(${val})`;
        break;
      case 'sqrt':
        res = Math.sqrt(val);
        label = `√(${val})`;
        break;
      case 'cbrt':
        res = Math.cbrt(val);
        label = `∛(${val})`;
        break;
      case 'recip':
        res = 1 / val;
        label = `1/(${val})`;
        break;
      case 'pct':
        res = val / 100;
        label = `${val}%`;
        break;
      case 'abs':
        res = Math.abs(val);
        label = `abs(${val})`;
        break;
      case 'exp10':
        res = Math.pow(10, val);
        label = `10^(${val})`;
        break;
      case 'exp2':
        res = Math.pow(2, val);
        label = `2^(${val})`;
        break;
      case 'log':
        res = Math.log10(val);
        label = `log(${val})`;
        break;
      case 'ln':
        res = Math.log(val);
        label = `ln(${val})`;
        break;
      case 'exp':
        res = Math.exp(val);
        label = `e^(${val})`;
        break;
      case 'fact':
        let f = 1;
        const n = Math.floor(val);
        if (n < 0) {
          setDisplay('Invalid input');
          return;
        }
        for (let i = 2; i <= n; i++) f *= i;
        res = f;
        label = `fact(${val})`;
        break;
      case 'sin':
        res = isSecond ? Math.asin(val) * invRadFactor : Math.sin(val * radFactor);
        label = isSecond ? `asin(${val})` : `sin(${val})`;
        break;
      case 'cos':
        res = isSecond ? Math.acos(val) * invRadFactor : Math.cos(val * radFactor);
        label = isSecond ? `acos(${val})` : `cos(${val})`;
        break;
      case 'tan':
        res = isSecond ? Math.atan(val) * invRadFactor : Math.tan(val * radFactor);
        label = isSecond ? `atan(${val})` : `tan(${val})`;
        break;
      case 'sinh':
        res = Math.sinh(val);
        label = `sinh(${val})`;
        break;
      case 'cosh':
        res = Math.cosh(val);
        label = `cosh(${val})`;
        break;
      case 'tanh':
        res = Math.tanh(val);
        label = `tanh(${val})`;
        break;
      default:
        return;
    }

    const formatted = formatNumberResult(res);
    setEquation(label);
    setDisplay(formatted);
    setHistoryList((prev) => [{ equation: label, result: formatted }, ...prev]);
    setNewInput(true);
  };

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === '.') handleDecimal();
      if (e.key === '+') handleOperator('+');
      if (e.key === '-') handleOperator('-');
      if (e.key === '*') handleOperator('×');
      if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      }
      if (e.key === '%') handleUnaryOp('pct');
      if (e.key === '(') handleParenthesis('(');
      if (e.key === ')') handleParenthesis(')');
      if (e.key === '^') handleOperator('^');
      if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      }
      if (e.key === 'Backspace') handleBackspace();
      if (e.key === 'Escape') {
        if (showHistory) {
          setShowHistory(false);
        } else {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, equation, newInput, openParentheses, isRad, isFe, isSecond, showHistory]);

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#202020] text-slate-800 dark:text-white font-sans select-none relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-200/80 dark:bg-[#1f1f1f] border-b border-slate-300 dark:border-white/10 text-xs shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <button
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-300/50 dark:hover:bg-white/10 font-bold text-sm tracking-wide transition-colors cursor-pointer text-slate-900 dark:text-white"
            onClick={() => handleModeSwitch(mode === 'standard' ? 'scientific' : 'standard')}
          >
            <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{mode === 'standard' ? 'Standard' : 'Scientific'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`p-1.5 rounded-lg hover:bg-slate-300/50 dark:hover:bg-white/10 transition-colors cursor-pointer ${
              showHistory ? 'text-cyan-600 dark:text-cyan-400 bg-slate-300/60 dark:bg-white/10' : 'text-slate-500 dark:text-slate-400'
            }`}
            onClick={() => setShowHistory(!showHistory)}
            title="Calculation History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Display Box: Input equation on top, Answer below */}
      <div className="p-4 flex flex-col justify-end items-end min-h-[90px] bg-white dark:bg-[#181818] border-b border-slate-200 dark:border-white/10 shrink-0">
        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono h-5 text-right truncate w-full pr-1">
          {equation}
        </div>
        <div className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight text-right w-full truncate font-sans break-all select-all">
          {display}
        </div>
      </div>

      {/* Scientific Sub-Bar (DEG/RAD, F-E) */}
      {mode === 'scientific' && (
        <div className="flex items-center gap-4 px-3 py-1 bg-slate-100 dark:bg-[#181818] border-b border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 font-semibold shrink-0">
          <button
            className={`hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer px-1 py-0.5 rounded ${
              !isRad ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
            onClick={() => setIsRad(!isRad)}
          >
            {isRad ? 'RAD' : 'DEG'}
          </button>
          <button
            className={`hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer px-1 py-0.5 rounded ${
              isFe ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
            onClick={() => setIsFe(!isFe)}
          >
            F-E
          </button>
        </div>
      )}

      {/* Memory Bar */}
      <div className="grid grid-cols-6 gap-1 px-3 py-1 bg-slate-100 dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-white/5 text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
        <button
          className="hover:bg-white/10 py-1 rounded text-center disabled:opacity-30 cursor-pointer"
          disabled={!hasMemory}
          onClick={() => {
            setMemory(0);
            setHasMemory(false);
          }}
        >
          MC
        </button>
        <button
          className="hover:bg-white/10 py-1 rounded text-center disabled:opacity-30 cursor-pointer"
          disabled={!hasMemory}
          onClick={() => {
            setDisplay(formatNumberResult(memory));
            setNewInput(true);
          }}
        >
          MR
        </button>
        <button
          className="hover:bg-white/10 py-1 rounded text-center cursor-pointer"
          onClick={() => {
            const val = parseFloat(display);
            if (!isNaN(val)) {
              setMemory((m) => m + val);
              setHasMemory(true);
            }
          }}
        >
          M+
        </button>
        <button
          className="hover:bg-white/10 py-1 rounded text-center cursor-pointer"
          onClick={() => {
            const val = parseFloat(display);
            if (!isNaN(val)) {
              setMemory((m) => m - val);
              setHasMemory(true);
            }
          }}
        >
          M-
        </button>
        <button
          className="hover:bg-white/10 py-1 rounded text-center cursor-pointer"
          onClick={() => {
            const val = parseFloat(display);
            if (!isNaN(val)) {
              setMemory(val);
              setHasMemory(true);
            }
          }}
        >
          MS
        </button>
        <button
          className="hover:bg-white/10 py-1 rounded text-center disabled:opacity-30 cursor-pointer"
          disabled={!hasMemory}
          onClick={() => setShowHistory(true)}
        >
          M▾
        </button>
      </div>

      {/* Calculator Buttons Grid */}
      <div className="flex-1 p-2 bg-slate-100 dark:bg-[#202020] text-slate-800 dark:text-white overflow-y-auto flex flex-col">
        {mode === 'standard' ? (
          /* STANDARD MODE 4-COLUMN GRID */
          <div className="grid grid-cols-4 gap-1.5 flex-1 h-full min-h-[260px]">
            {/* Row 1 */}
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleUnaryOp('pct')}>%</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={handleClearEntry}>CE</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={handleClear}>C</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={handleBackspace}>⌫</button>

            {/* Row 2 */}
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleUnaryOp('recip')}>1/x</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleUnaryOp('sqr')}>x²</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleUnaryOp('sqrt')}>²√x</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-base font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleOperator('÷')}>÷</button>

            {/* Row 3 */}
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('7')}>7</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('8')}>8</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('9')}>9</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-base font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleOperator('×')}>×</button>

            {/* Row 4 */}
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('4')}>4</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('5')}>5</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('6')}>6</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-base font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleOperator('-')}>-</button>

            {/* Row 5 */}
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('1')}>1</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('2')}>2</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('3')}>3</button>
            <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-base font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleOperator('+')}>+</button>

            {/* Row 6 */}
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-xs font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={handleNegate}>+/-</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={() => handleDigit('0')}>0</button>
            <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-base font-semibold cursor-pointer h-full min-h-[38px] flex items-center justify-center transition-colors" onClick={handleDecimal}>.</button>
            <button
              className="bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold text-xl rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center h-full min-h-[38px]"
              onClick={handleEquals}
            >
              =
            </button>
          </div>
        ) : (
          /* SCIENTIFIC MODE 5-COLUMN GRID */
          <div className="flex flex-col flex-1 h-full gap-1.5">
            {/* Scientific Trig / Function Menus */}
            <div className="flex items-center gap-2 pb-1 shrink-0">
              <div className="relative">
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white font-semibold text-[11px] cursor-pointer"
                  onClick={() => setShowTrigMenu(!showTrigMenu)}
                >
                  <span>Trigonometry</span>
                  <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                </button>
                {showTrigMenu && (
                  <div className="absolute top-8 left-0 z-30 w-44 bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl p-1.5 grid grid-cols-3 gap-1 text-slate-800 dark:text-slate-200">
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('sin'); setShowTrigMenu(false); }}>sin</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('cos'); setShowTrigMenu(false); }}>cos</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('tan'); setShowTrigMenu(false); }}>tan</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('sinh'); setShowTrigMenu(false); }}>sinh</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('cosh'); setShowTrigMenu(false); }}>cosh</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('tanh'); setShowTrigMenu(false); }}>tanh</button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white font-semibold text-[11px] cursor-pointer"
                  onClick={() => setShowFuncMenu(!showFuncMenu)}
                >
                  <span>Function</span>
                  <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                </button>
                {showFuncMenu && (
                  <div className="absolute top-8 left-0 z-30 w-40 bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl p-1.5 grid grid-cols-2 gap-1 text-slate-800 dark:text-slate-200">
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('abs'); setShowFuncMenu(false); }}>|x|</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('floor'); setShowFuncMenu(false); }}>floor</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('ceil'); setShowFuncMenu(false); }}>ceil</button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-center text-xs" onClick={() => { handleUnaryOp('fact'); setShowFuncMenu(false); }}>n!</button>
                  </div>
                )}
              </div>
            </div>

            {/* Scientific 5-Column Grid with Proportional Heights */}
            <div className="grid grid-cols-5 gap-1.5 flex-1 h-full text-xs">
              {/* Row 1 */}
              <button
                className={`rounded-lg font-bold cursor-pointer transition-colors flex items-center justify-center min-h-[34px] ${
                  isSecond ? 'bg-cyan-600 text-white' : 'bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white'
                }`}
                onClick={() => setIsSecond(!isSecond)}
              >
                2ⁿᵈ
              </button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit(Math.PI.toString())}>π</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit(Math.E.toString())}>e</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={handleClear}>C</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={handleBackspace}>⌫</button>

              {/* Row 2 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp(isSecond ? 'cube' : 'sqr')}>
                {isSecond ? 'x³' : 'x²'}
              </button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp('recip')}>1/x</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp('abs')}>|x|</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp('exp')}>exp</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('mod')}>mod</button>

              {/* Row 3 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp(isSecond ? 'cbrt' : 'sqrt')}>
                {isSecond ? '³√x' : '²√x'}
              </button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer font-mono flex items-center justify-center min-h-[34px]" onClick={() => handleParenthesis('(')}>(</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer font-mono flex items-center justify-center min-h-[34px]" onClick={() => handleParenthesis(')')}>)</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp('fact')}>n!</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('÷')}>÷</button>

              {/* Row 4 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('^')}>
                {isSecond ? 'ʸ√x' : 'xʸ'}
              </button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('7')}>7</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('8')}>8</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('9')}>9</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('×')}>×</button>

              {/* Row 5 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp(isSecond ? 'exp2' : 'exp10')}>
                {isSecond ? '2ˣ' : '10ˣ'}
              </button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('4')}>4</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('5')}>5</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('6')}>6</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('-')}>-</button>

              {/* Row 6 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp('log')}>log</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('1')}>1</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('2')}>2</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('3')}>3</button>
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleOperator('+')}>+</button>

              {/* Row 7 */}
              <button className="bg-slate-200 hover:bg-slate-300 dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-slate-800 dark:text-white rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleUnaryOp(isSecond ? 'exp' : 'ln')}>
                {isSecond ? 'eˣ' : 'ln'}
              </button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg cursor-pointer flex items-center justify-center min-h-[34px]" onClick={handleNegate}>+/-</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={() => handleDigit('0')}>0</button>
              <button className="bg-white hover:bg-slate-50 dark:bg-[#3b3b3b] dark:hover:bg-[#484848] text-slate-900 dark:text-white shadow-xs rounded-lg text-sm cursor-pointer flex items-center justify-center min-h-[34px]" onClick={handleDecimal}>.</button>
              <button
                className="bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold text-lg rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center min-h-[34px]"
                onClick={handleEquals}
              >
                =
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Drawer Overlay */}
      {showHistory && (
        <div
          className="absolute inset-0 bg-black/40 z-30"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="absolute inset-y-0 right-0 w-64 bg-white dark:bg-[#1f1f1f] border-l border-slate-200 dark:border-white/10 p-4 flex flex-col z-40 animate-in slide-in-from-right duration-150 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10 mb-3">
              <span className="font-bold text-xs text-slate-900 dark:text-white">Calculation History</span>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  onClick={() => setHistoryList([])}
                  title="Clear History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  onClick={() => setShowHistory(false)}
                  title="Close History"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No calculation history yet
                </div>
              ) : (
                historyList.map((item, idx) => (
                  <div
                    key={idx}
                    className="group relative p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-right border border-slate-200 dark:border-white/5 space-y-0.5"
                    onClick={() => {
                      setDisplay(item.result);
                      setEquation(item.equation);
                      setNewInput(true);
                      setShowHistory(false);
                    }}
                  >
                    <button
                      className="absolute top-2 left-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistoryList((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      title="Delete entry"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono pl-6 truncate">{item.equation}</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{item.result}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
