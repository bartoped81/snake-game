// pages/index.js
import React, { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE_LENGTH = 3;
const GAME_SPEED = 100;

const directions = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const playerColors = [
  'bg-green-500 border-green-600',
  'bg-blue-500 border-blue-600',
  'bg-purple-500 border-purple-600',
  'bg-yellow-500 border-yellow-600',
  'bg-pink-500 border-pink-600',
];

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState(new Map());
  const [food, setFood] = useState(null);
  const [direction, setDirection] = useState(directions.UP);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const wsRef = useRef(null);

  const initializeGame = useCallback(() => {
    const centerX = Math.floor(Math.random() * GRID_SIZE);
    const centerY = Math.floor(Math.random() * GRID_SIZE);
    return Array(INITIAL_SNAKE_LENGTH).fill().map((_, i) => ({
      x: centerX,
      y: centerY + i,
    }));
  }, []);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY
    });
  };

  const handleTouchMove = (e) => {
    if (!touchStart.x || !touchStart.y) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    const minSwipeDistance = 30;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0 && direction !== directions.LEFT) {
          setDirection(directions.RIGHT);
        } else if (deltaX < 0 && direction !== directions.RIGHT) {
          setDirection(directions.LEFT);
        }
      }
    } else {
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0 && direction !== directions.UP) {
          setDirection(directions.DOWN);
        } else if (deltaY < 0 && direction !== directions.DOWN) {
          setDirection(directions.UP);
        }
      }
    }
    
    setTouchStart({ x: 0, y: 0 });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId') || Math.random().toString(36).substr(2, 9);
    setGameId(gameIdFromUrl);

    // Update URL with gameId for sharing
    if (!urlParams.get('gameId')) {
      window.history.replaceState({}, '', `?gameId=${gameIdFromUrl}`);
    }

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/socket?gameId=${gameIdFromUrl}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'INIT':
          setPlayerId(message.playerId);
          setPlayers(new Map(message.state.players));
          setFood(message.state.food);
          if (!players.has(message.playerId)) {
            ws.send(JSON.stringify({
              type: 'UPDATE_SNAKE',
              snake: initializeGame(),
            }));
          }
          break;
          
        case 'GAME_STATE':
          setPlayers(new Map(message.state.players));
          setFood(message.state.food);
          break;
          
        case 'PLAYER_LEFT':
          setPlayers(prev => {
            const next = new Map(prev);
            next.delete(message.playerId);
            return next;
          });
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [initializeGame]);

  const moveSnake = useCallback(() => {
    if (!playerId || !players.has(playerId)) return;

    const mySnake = players.get(playerId);
    const head = {
      x: mySnake[0].x + direction.x,
      y: mySnake[0].y + direction.y,
    };

    // Check collisions with walls and other snakes
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setGameOver(true);
      return;
    }

    for (const [pid, snake] of players.entries()) {
      if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        if (pid === playerId) {
          // Self collision (not with head)
          if (snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)) {
            setGameOver(true);
            return;
          }
        } else {
          // Collision with other player
          setGameOver(true);
          return;
        }
      }
    }

    const newSnake = [head, ...mySnake];
    if (food && head.x === food.x && head.y === food.y) {
      setScore(prev => prev + 1);
    } else {
      newSnake.pop();
    }

    wsRef.current?.send(JSON.stringify({
      type: 'UPDATE_SNAKE',
      snake: newSnake,
    }));
  }, [direction, food, playerId, players]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction !== directions.DOWN) setDirection(directions.UP);
          break;
        case 'ArrowDown':
          if (direction !== directions.UP) setDirection(directions.DOWN);
          break;
        case 'ArrowLeft':
          if (direction !== directions.RIGHT) setDirection(directions.LEFT);
          break;
        case 'ArrowRight':
          if (direction !== directions.LEFT) setDirection(directions.RIGHT);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    const gameInterval = setInterval(moveSnake, GAME_SPEED);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearInterval(gameInterval);
    };
  }, [direction, moveSnake]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="mb-4 text-xl font-bold">
        Game ID: {gameId} | Players: {players.size} | Score: {score}
      </div>

      <button
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Copy Game Link
      </button>
      
      <div 
        className="relative bg-white border-2 border-gray-300 rounded-lg shadow-lg touch-none"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
        }}
        onTouchStart={(e) => handleTouchStart(e)}
        onTouchMove={(e) => handleTouchMove(e)}
      >
        {/* Food */}
        {food && (
          <div
            className="absolute bg-red-500 rounded-full"
            style={{
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              left: food.x * CELL_SIZE,
              top: food.y * CELL_SIZE,
            }}
          />
        )}

        {/* All Snakes */}
        {Array.from(players.entries()).map(([pid, snake], playerIndex) => (
          snake.map((segment, segmentIndex) => (
            <div
              key={`${pid}-${segmentIndex}`}
              className={`absolute border ${playerColors[playerIndex % playerColors.length]}`}
              style={{
                width: CELL_SIZE - 2,
                height: CELL_SIZE - 2,
                left: segment.x * CELL_SIZE,
                top: segment.y * CELL_SIZE,
                borderRadius: segmentIndex === 0 ? '4px' : '0',
              }}
            />
          ))
        ))}
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 md:hidden">
        <button
          className="p-4 bg-gray-200 rounded"
          onClick={() => direction !== directions.RIGHT && setDirection(directions.LEFT)}
        >
          ←
        </button>
        <div className="grid grid-rows-2 gap-2">
          <button
            className="p-4 bg-gray-200 rounded"
            onClick={() => direction !== directions.DOWN && setDirection(directions.UP)}
          >
            ↑
          </button>
          <button
            className="p-4 bg-gray-200 rounded"
            onClick={() => direction !== directions.UP && setDirection(directions.DOWN)}
          >
            ↓
          </button>
        </div>
        <button
          className="p-4 bg-gray-200 rounded"
          onClick={() => direction !== directions.LEFT && setDirection(directions.RIGHT)}
        >
          →
        </button>
      </div>

      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg text-center">
            <h2 className="text-xl font-bold mb-4">Game Over!</h2>
            <p className="mb-4">Final Score: {score}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}