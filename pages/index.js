import React, { useState, useEffect, useCallback } from 'react';

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

const generateFood = (snake) => {
  let food;
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
  return food;
};

export default function Home() {
  const [snake, setSnake] = useState(() => {
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    return Array(INITIAL_SNAKE_LENGTH).fill().map((_, i) => ({
      x: centerX,
      y: centerY + i,
    }));
  });
  
  const [direction, setDirection] = useState(directions.UP);
  const [food, setFood] = useState(() => generateFood(snake));
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  const checkCollision = useCallback((head) => {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true;
    }
    return snake.some(segment => segment.x === head.x && segment.y === head.y);
  }, [snake]);

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    setSnake(prevSnake => {
      const head = {
        x: prevSnake[0].x + direction.x,
        y: prevSnake[0].y + direction.y,
      };

      if (checkCollision(head)) {
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];
      
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 1);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, checkCollision]);

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

  const resetGame = () => {
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    setSnake(Array(INITIAL_SNAKE_LENGTH).fill().map((_, i) => ({
      x: centerX,
      y: centerY + i,
    })));
    setDirection(directions.UP);
    setFood(generateFood(snake));
    setGameOver(false);
    setScore(0);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="mb-4 text-xl font-bold">
        Score: {score}
      </div>
      
      <div 
        className="relative bg-white border-2 border-gray-300 rounded-lg shadow-lg touch-none"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full"
          style={{
            width: CELL_SIZE - 2,
            height: CELL_SIZE - 2,
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
          }}
        />

        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className="absolute bg-green-500 border border-green-600"
            style={{
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              borderRadius: index === 0 ? '4px' : '0',
            }}
          />
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

      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg text-center">
            <h2 className="text-xl font-bold mb-4">Game Over!</h2>
            <p className="mb-4">Final Score: {score}</p>
            <button
              onClick={resetGame}
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