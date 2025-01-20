// pages/api/socket.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';

export const config = {
  api: {
    bodyParser: false,
  },
};

const games = new Map();
const connections = new Map();

if (!global.wss) {
  global.wss = new WebSocketServer({ noServer: true });
}

const wss = global.wss;

wss.on('connection', (ws, gameId) => {
  const playerId = Math.random().toString(36).substring(7);
  
  // Store connection
  if (!connections.has(gameId)) {
    connections.set(gameId, new Map());
  }
  connections.get(gameId).set(playerId, ws);

  // Initialize game state if needed
  if (!games.has(gameId)) {
    games.set(gameId, {
      players: new Map(),
      food: generateFood(),
    });
  }

  // Send initial game state
  ws.send(JSON.stringify({
    type: 'INIT',
    playerId,
    gameId,
    state: getGameState(gameId),
  }));

  // Broadcast new player to others
  broadcast(gameId, {
    type: 'PLAYER_JOINED',
    playerId,
  }, playerId);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'UPDATE_SNAKE':
          updatePlayerState(gameId, playerId, message.snake);
          broadcast(gameId, {
            type: 'GAME_STATE',
            state: getGameState(gameId),
          });
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    // Remove player
    connections.get(gameId)?.delete(playerId);
    games.get(gameId)?.players.delete(playerId);

    // Broadcast player left
    broadcast(gameId, {
      type: 'PLAYER_LEFT',
      playerId,
    });

    // Clean up empty game
    if (connections.get(gameId)?.size === 0) {
      connections.delete(gameId);
      games.delete(gameId);
    }
  });
});

function generateFood() {
  return {
    x: Math.floor(Math.random() * 20),
    y: Math.floor(Math.random() * 20),
  };
}

function getGameState(gameId) {
  const game = games.get(gameId);
  return {
    players: Array.from(game.players.entries()),
    food: game.food,
  };
}

function updatePlayerState(gameId, playerId, snake) {
  const game = games.get(gameId);
  if (game) {
    game.players.set(playerId, snake);
    
    // Check if snake ate food
    const head = snake[0];
    if (head.x === game.food.x && head.y === game.food.y) {
      game.food = generateFood();
    }
  }
}

function broadcast(gameId, message, excludePlayerId = null) {
  const gameConnections = connections.get(gameId);
  if (gameConnections) {
    for (const [playerId, connection] of gameConnections.entries()) {
      if (playerId !== excludePlayerId) {
        connection.send(JSON.stringify(message));
      }
    }
  }
}

const server = createServer((req, res) => {
  const { pathname } = parse(req.url);
  
  if (pathname === '/api/socket') {
    const gameId = new URLSearchParams(parse(req.url).query).get('gameId');
    
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
      wss.emit('connection', ws, gameId || 'default');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

export default server;