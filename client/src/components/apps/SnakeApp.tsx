import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export const SnakeApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('win11_snake_high_score');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [isGameOver, setIsGameOver] = useState(false);

  const directionRef = useRef<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT');
  const snakeRef = useRef<{ x: number; y: number }[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const foodRef = useRef<{ x: number; y: number }>({ x: 15, y: 10 });

  const gridSize = 20;
  const tileCount = 20;

  // Persist high score
  useEffect(() => {
    try {
      localStorage.setItem('win11_snake_high_score', highScore.toString());
    } catch {}
  }, [highScore]);

  const resetGame = () => {
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    foodRef.current = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
    setScore(0);
    setIsGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && directionRef.current !== 'DOWN') directionRef.current = 'UP';
      if (e.key === 'ArrowDown' && directionRef.current !== 'UP') directionRef.current = 'DOWN';
      if (e.key === 'ArrowLeft' && directionRef.current !== 'RIGHT') directionRef.current = 'LEFT';
      if (e.key === 'ArrowRight' && directionRef.current !== 'LEFT') directionRef.current = 'RIGHT';
    };
    window.addEventListener('keydown', handleKeyDown);

    const gameInterval = setInterval(() => {
      if (isGameOver) return;

      const head = { ...snakeRef.current[0] };
      if (directionRef.current === 'UP') head.y -= 1;
      if (directionRef.current === 'DOWN') head.y += 1;
      if (directionRef.current === 'LEFT') head.x -= 1;
      if (directionRef.current === 'RIGHT') head.x += 1;

      // Check Collision with Walls
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        setIsGameOver(true);
        return;
      }

      // Check Collision with Self
      for (let segment of snakeRef.current) {
        if (segment.x === head.x && segment.y === head.y) {
          setIsGameOver(true);
          return;
        }
      }

      snakeRef.current.unshift(head);

      // Check Food Collision
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore((s) => {
          const newS = s + 10;
          setHighScore((h) => Math.max(h, newS));
          return newS;
        });
        foodRef.current = {
          x: Math.floor(Math.random() * tileCount),
          y: Math.floor(Math.random() * tileCount),
        };
      } else {
        snakeRef.current.pop();
      }

      // Draw
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Snake
      ctx.fillStyle = '#38bdf8';
      snakeRef.current.forEach((seg, idx) => {
        ctx.fillStyle = idx === 0 ? '#0284c7' : '#38bdf8';
        ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 1, gridSize - 1);
      });

      // Draw Food
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(foodRef.current.x * gridSize, foodRef.current.y * gridSize, gridSize - 1, gridSize - 1);
    }, 120);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(gameInterval);
    };
  }, [isGameOver]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < 20) return;

    if (absX > absY) {
      if (dx > 0 && directionRef.current !== 'LEFT') directionRef.current = 'RIGHT';
      else if (dx < 0 && directionRef.current !== 'RIGHT') directionRef.current = 'LEFT';
    } else {
      if (dy > 0 && directionRef.current !== 'UP') directionRef.current = 'DOWN';
      else if (dy < 0 && directionRef.current !== 'DOWN') directionRef.current = 'UP';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-2 sm:p-4 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white select-none space-y-3 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between w-full max-w-[400px] px-2 text-xs font-bold shrink-0">
        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
          <Sparkles className="w-4 h-4" /> Score: {score}
        </div>
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Trophy className="w-4 h-4" /> High: {highScore}
        </div>
        <button
          className="flex items-center gap-1 px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
          onClick={resetGame}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>

      <div
        className="relative border-4 border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl max-w-[90vw] max-h-[46vh] sm:max-h-[55vh] aspect-square flex items-center justify-center bg-slate-900 dark:bg-slate-950 shrink-0 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} width={400} height={400} className="w-full h-full object-contain" />
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 p-4">
            <h2 className="text-xl font-bold text-rose-500">GAME OVER</h2>
            <p className="text-xs text-slate-300">Final Score: {score}</p>
            <button
              className="px-4 py-2 rounded-xl bg-sky-500 font-bold text-xs hover:bg-sky-400 text-white cursor-pointer shadow-lg"
              onClick={resetGame}
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch D-Pad */}
      <div className="flex flex-col items-center gap-1 sm:hidden select-none shrink-0">
        <button
          className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 active:bg-sky-600 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white shadow transition-colors"
          onClick={() => { if (directionRef.current !== 'DOWN') directionRef.current = 'UP'; }}
          title="Up"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-5">
          <button
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 active:bg-sky-600 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white shadow transition-colors"
            onClick={() => { if (directionRef.current !== 'RIGHT') directionRef.current = 'LEFT'; }}
            title="Left"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 active:bg-sky-600 hover:bg-slate-700 text-slate-800 dark:text-white shadow transition-colors"
            onClick={() => { if (directionRef.current !== 'LEFT') directionRef.current = 'RIGHT'; }}
            title="Right"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button
          className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 active:bg-sky-600 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white shadow transition-colors"
          onClick={() => { if (directionRef.current !== 'UP') directionRef.current = 'DOWN'; }}
          title="Down"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center shrink-0">
        Swipe or use arrow buttons to steer the snake
      </p>
    </div>
  );
};
