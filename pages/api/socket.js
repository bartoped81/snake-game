// pages/api/socket.js
export const config = {
  runtime: 'edge',
  regions: ['fra1'], // Choose a region close to your users
};

const games = new Map();
const connections = new Map();

export default async function handler(req) {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected websocket', { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const gameId = new URL(req.url).searchParams.get('gameId') || 'default';
  const playerId = Math.random().toString(36).substring(7);

  // Initialize game state if needed
  if (!games.has(gameId)) {
    games.set(gameId, {
      players: new Map(),
      food: generateFood(),
    });
  }

  // Store connection
  if (!connections.has(gameId)) {
    connections.set(gameId, new Map());
  }
  connections.get(gameId).set(playerId, socket);

  socket.onopen = () => {
    // Send initial game state
    socket.send(JSON.stringify({
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
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
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
  };

  socket.onclose = () => {
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
  };

  return response;
}

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
    for (const [playerId, socket] of gameConnections.entries()) {
      if (playerId !== excludePlayerId) {
        socket.send(JSON.stringify(message));
      }
    }
  }
}