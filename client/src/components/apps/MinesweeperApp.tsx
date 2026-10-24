import React, { useState, useEffect } from 'react';
import { Flag, Bomb, Smile, Frown, Award, RotateCcw } from 'lucide-react';

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export const MinesweeperApp: React.FC = () => {
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(9);
  const [mineCount, setMineCount] = useState(10);

  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameWin, setGameWin] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [flagMode, setFlagMode] = useState(false);

  // Initialize Board
  const initBoard = () => {
    let newGrid: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      let row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        });
      }
      newGrid.push(row);
    }

    // Place Mines
    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
      const rr = Math.floor(Math.random() * rows);
      const cc = Math.floor(Math.random() * cols);
      if (!newGrid[rr][cc].isMine) {
        newGrid[rr][cc].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate Neighbor Mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].isMine) {
                count++;
              }
            }
          }
          newGrid[r][c].neighborMines = count;
        }
      }
    }

    setGrid(newGrid);
    setGameOver(false);
    setGameWin(false);
    setGameStarted(false);
    setTimer(0);
    setFlagsUsed(0);
  };

  useEffect(() => {
    initBoard();
  }, [rows, cols, mineCount]);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameOver || gameWin) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver, gameWin]);

  const revealCell = (r: number, c: number) => {
    if (gameOver || gameWin || grid[r][c].isRevealed || grid[r][c].isFlagged) return;
    setGameStarted(true);

    let newGrid = [...grid.map((row) => [...row])];

    if (newGrid[r][c].isMine) {
      // Game Over! Reveal all mines
      newGrid.forEach((row) =>
        row.forEach((cell) => {
          if (cell.isMine) cell.isRevealed = true;
        })
      );
      setGrid(newGrid);
      setGameOver(true);
      return;
    }

    // Flood fill reveal empty cells
    const queue = [[r, c]];
    while (queue.length > 0) {
      const [currR, currC] = queue.shift()!;
      if (newGrid[currR][currC].isRevealed) continue;
      newGrid[currR][currC].isRevealed = true;

      if (newGrid[currR][currC].neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (
              nr >= 0 &&
              nr < rows &&
              nc >= 0 &&
              nc < cols &&
              !newGrid[nr][nc].isRevealed &&
              !newGrid[nr][nc].isFlagged
            ) {
              queue.push([nr, nc]);
            }
          }
        }
      }
    }

    // Check Win
    let unrevealedNonMines = 0;
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (!newGrid[rr][cc].isMine && !newGrid[rr][cc].isRevealed) {
          unrevealedNonMines++;
        }
      }
    }

    setGrid(newGrid);
    if (unrevealedNonMines === 0) {
      setGameWin(true);
    }
  };

  const toggleFlag = (r: number, c: number, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (gameOver || gameWin || grid[r][c].isRevealed) return;

    let newGrid = [...grid.map((row) => [...row])];
    const target = newGrid[r][c];
    if (target.isFlagged) {
      target.isFlagged = false;
      setFlagsUsed((f) => f - 1);
    } else {
      if (flagsUsed >= mineCount) return;
      target.isFlagged = true;
      setFlagsUsed((f) => f + 1);
    }
    setGrid(newGrid);
  };

  const handleCellClick = (r: number, c: number) => {
    if (flagMode) {
      toggleFlag(r, c);
    } else {
      revealCell(r, c);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-200 dark:bg-slate-900 select-none">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/10 shadow-2xl space-y-4">
        {/* Game Status Header Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 font-mono text-base font-bold text-red-500">
            <Bomb className="w-5 h-5" />
            <span>{String(mineCount - flagsUsed).padStart(3, '0')}</span>
          </div>

          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-slate-900 font-bold shadow-md cursor-pointer transition-transform hover:bg-amber-500 active:scale-95"
            onClick={initBoard}
            title="Restart game"
            aria-label="Restart Minesweeper game"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-xs">Restart</span>
          </button>

          <div className="flex items-center gap-1.5 font-mono text-base font-bold text-blue-500">
            <span>{String(timer).padStart(3, '0')}</span>
          </div>
        </div>

        <div role="status" aria-live="polite" className="flex min-h-8 items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {gameOver ? (
            <><Frown className="h-4 w-4 text-red-600" /> Game over — try again</>
          ) : gameWin ? (
            <><Award className="h-4 w-4 text-emerald-600" /> You cleared the minefield!</>
          ) : (
            <><Smile className="h-4 w-4 text-amber-500" /> {gameStarted ? 'Find the remaining safe squares' : 'Reveal a square to start'}</>
          )}
        </div>

        {/* Flag Mode Toggle Button for Touch/Click */}
        <div className="flex justify-center">
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              flagMode ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
            onClick={() => setFlagMode(!flagMode)}
          >
            <Flag className="w-3.5 h-3.5" /> Flag Mode: {flagMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Minesweeper Grid */}
        <div
          className="grid gap-1 p-2 rounded-xl bg-slate-300 dark:bg-slate-950"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={`Row ${r + 1}, column ${c + 1}${cell.isRevealed ? cell.isMine ? ', mine' : `, ${cell.neighborMines} neighboring mines` : cell.isFlagged ? ', flagged' : ', hidden'}`}
                disabled={gameOver || gameWin}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors cursor-pointer ${
                  cell.isRevealed
                    ? cell.isMine
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-sm border border-slate-300 dark:border-slate-600'
                }`}
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => toggleFlag(r, c, e)}
              >
                {cell.isRevealed ? (
                  cell.isMine ? (
                    <Bomb className="w-4 h-4" />
                  ) : cell.neighborMines > 0 ? (
                    <span
                      style={{
                        color: ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b91c1c', '#0d9488', '#000', '#6b7280'][
                          cell.neighborMines - 1
                        ],
                      }}
                    >
                      {cell.neighborMines}
                    </span>
                  ) : null
                ) : cell.isFlagged ? (
                  <Flag className="w-4 h-4 text-red-500 fill-red-500" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
