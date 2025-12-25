const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// Armazena salas ativas em memória
const activeRooms = new Map();

// Locais possíveis do jogo
const locations = [
  'Aeroporto', 'Banco', 'Praia', 'Casino', 'Cinema', 'Circo', 'Escola',
  'Embaixada', 'Hospital', 'Hotel', 'Restaurante', 'Navio', 'Estação Espacial',
  'Submarino', 'Teatro', 'Universidade', 'Base Militar', 'Parque', 'Shopping',
  'Biblioteca', 'Prisão', 'Spa', 'Trem', 'Museu', 'Supermercado',
  
  // Locais temáticos da serra:
  'Cachoeira', 'Trilha da Montanha', 'Cabana na Serra', 'Mirante', 'Campo de Lavanda',
  'Pousada Rural', 'Feira da Serra', 'Igreja do Pico', 'Plantação de Café', 'Chalé',
  
  // Mais 100 locais diversos:
  'Posto de Gasolina', 'Farmácia', 'Padaria', 'Açougue', 'Floricultura',
  'Pet Shop', 'Lavanderia', 'Barbearia', 'Salão de Beleza', 'Ótica',
  'Loja de Roupas', 'Livraria', 'Papelaria', 'Loja de Eletrônicos', 'Joalheria',
  'Consultório Médico', 'Dentista', 'Laboratório', 'Clínica Veterinária', 'Academia',
  'Piscina', 'Quadra de Tênis', 'Campo de Futebol', 'Ginásio Esportivo', 'Pista de Skate',
  
  'Delegacia', 'Corpo de Bombeiros', 'Prefeitura', 'Cartório', 'Correios',
  'Rodoviária', 'Metro', 'Porto', 'Marina', 'Heliporto',
  'Fazenda', 'Sítio', 'Estábulo', 'Celeiro', 'Apiário',
  'Vineyard', 'Destilaria', 'Cervejaria', 'Padaria Artesanal', 'Queijaria',
  
  'Boate', 'Bar', 'Pub', 'Karaokê', 'Boliche',
  'Parque de Diversões', 'Zoológico', 'Aquário', 'Planetário', 'Observatório',
  'Casa de Shows', 'Estúdio de Gravação', 'Galeria de Arte', 'Ateliê', 'Escola de Dança',
  'Dojo', 'Escola de Música', 'Escola de Idiomas', 'Autoescola', 'Creche',
  
  'Cemitério', 'Capela', 'Mosteiro', 'Sinagoga', 'Mesquita',
  'Templo', 'Casa de Repouso', 'Orfanato', 'Abrigo', 'Centro Comunitário',
  'Mercado Municipal', 'Feira Livre', 'Sacolão', 'Armazém', 'Depósito',
  'Galpão', 'Fábrica', 'Usina', 'Refinaria', 'Construção Civil',
  
  'Escritório', 'Coworking', 'Call Center', 'Agência de Viagens', 'Imobiliária',
  'Laboratório de Informática', 'Lan House', 'Cyber Café', 'Gráfica', 'Editora',
  'Emissora de TV', 'Rádio', 'Jornal', 'Agência de Publicidade', 'Estúdio Fotográfico',
  
  'Castelo', 'Palácio', 'Ruínas', 'Sítio Arqueológico', 'Catedral',
  'Torre', 'Farol', 'Ponte', 'Túnel', 'Viaduto',
  'Ilha', 'Caverna', 'Deserto', 'Vulcão', 'Geleira',
  'Floresta', 'Savana', 'Pântano', 'Oásis', 'Canyon',
  
  'Acampamento', 'Resort', 'Hostel', 'Motel', 'Pousada',
  'Cruzeiro', 'Iate', 'Balsa', 'Teleférico', 'Funicular',
  'Circo de Soleil', 'Parque Aquático', 'Termas', 'Casa de Jogos', 'Escape Room',
  'Simulador', 'Realidade Virtual', 'Kart', 'Paintball', 'Laser Tag',
  
  'Loja de Antiguidades', 'Brechó', 'Casa de Leilões', 'Penhora', 'Casa de Câmbio',
  'Lotérica', 'Tabacaria', 'Conveniência', 'Drive-Thru', 'Food Truck'
];
// Classe para gerenciar uma sala
class Room {
  constructor(code, owner) {
    this.code = code;
    this.owner = owner;
    this.players = new Map();
    this.gameState = 'waiting';
    this.location = null;
    this.spy = null;
    this.currentPlayer = null;
    this.playerOrder = [];
    this.timer = null;
    this.timeLimit = 10; // 300;
    this.timeRemaining = 0;
    this.votes = new Map();
    this.scores = new Map();
    this.locationsCount = 50; // ADICIONAR ESTA LINHA
    this.availableLocations = []; // ADICIONAR ESTA LINHA
    this.deleteTimeout = null; // ADICIONAR ESTA LINHA
  }

  addPlayer(playerId, name, socketId) {
    // Limpar nome
    const cleanName = name.trim();
    


    
    // Verificar se já existe alguém com este nome na sala (mas não é o mesmo jogador)
    const existingPlayerWithName = Array.from(this.players.values()).find(
      player => player.name.toLowerCase() === cleanName.toLowerCase() && player.id !== playerId
    );
    
    if (existingPlayerWithName) {
      console.log(`Nome ${cleanName} já existe na sala (pertence a ${existingPlayerWithName.id})`);
      return { error: 'Nome já existe na sala' };
    }
    
    const playerCode = uuidv4().substring(0, 8);
    const playerData = {
      id: playerId,
      name: cleanName,
      socketId,
      code: playerCode,
      isOwner: playerId === this.owner,
      score: 0
    };
    
    this.players.set(playerId, playerData);
    console.log(`Jogador ${cleanName} adicionado à sala ${this.code} com sucesso`);
    console.log('Jogadores na sala agora:', Array.from(this.players.values()).map(p => p.name));
    return { success: true, playerCode };
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  startGame() {
    if (this.players.size < 3) return false;
    
    this.gameState = 'playing';
    this.availableLocations = locations.slice(0, this.locationsCount);
    this.location = this.availableLocations[Math.floor(Math.random() * this.availableLocations.length)];
    
    const playerIds = Array.from(this.players.keys());
    this.spy = playerIds[Math.floor(Math.random() * playerIds.length)];
    
    this.playerOrder = [...playerIds].sort(() => Math.random() - 0.5);
    this.currentPlayer = this.playerOrder[Math.floor(Math.random() * this.playerOrder.length)];
    
    this.timeRemaining = this.timeLimit;
    this.startTimer();
    
    return true;
  }

  scheduleDelete() {
    // Cancelar timeout anterior se existir
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }
    
    // Agendar deleção em 30 segundos
    this.deleteTimeout = setTimeout(() => {
      console.log(`Sala ${this.code} será deletada - vazia por 30 segundos`);
      activeRooms.delete(this.code);
      console.log('Salas ativas restantes:', activeRooms.size);
    }, 30000); // 30 segundos
    
    console.log(`Sala ${this.code} agendada para deleção em 30 segundos`);
  }
  
  cancelDelete() {
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
      console.log(`Deleção da sala ${this.code} cancelada - jogador reconectou`);
    }
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeRemaining--;
      
      if (this.timeRemaining <= 0) {
        console.log(`⏰ Tempo esgotado na sala ${this.code}`);
        // NÃO chamar startVoting aqui, será tratado no timerInterval do start-game
      }
    }, 1000);
   }

  startVoting() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.gameState = 'voting';
    this.votes.clear();
    
    console.log(`🗳️ Votação iniciada na sala ${this.code}`);
    return true; // ADICIONAR RETORNO
  }

  vote(playerId, votedFor) {
    this.votes.set(playerId, votedFor);
    
    if (this.votes.size === this.players.size) {
      this.endGame();
    }
  }

  spyGuessLocation(guess) {
    if (guess.toLowerCase() === this.location.toLowerCase()) {
      this.endGame('spy_wins');
      return true;
    }
    return false;
  }

  endGame(result = null) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    let gameResult = result;
    
    if (!gameResult) {
      const voteCounts = new Map();
      this.votes.forEach(vote => {
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
      });
      
      const mostVoted = Array.from(voteCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      
      if (mostVoted && mostVoted[0] === this.spy) {
        gameResult = 'town_wins';
      } else {
        gameResult = 'spy_wins';
      }
    }

    this.players.forEach(player => {
      if (gameResult === 'spy_wins') {
        if (player.id === this.spy) {
          player.score += result === 'spy_wins' ? 3 : 2;
        }
      } else {
        if (player.id !== this.spy) {
          player.score += 1;
        }
      }
    });

    this.gameState = 'ended';
    this.lastResult = gameResult;
    return { result: gameResult, spy: this.spy, location: this.location };
  }

  resetGame() {
    // Resetar estado do jogo mantendo os jogadores e pontuações
    this.gameState = 'waiting';
    this.location = null;
    this.spy = null;
    this.currentPlayer = null;
    this.playerOrder = [];
    this.timeRemaining = 0;
    this.votes.clear();
    this.lastResult = null;
    
    // Parar timer se estiver rodando
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    console.log(`Sala ${this.code} resetada para novo jogo`);
    return true;
  }
}

// Rotas
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/room/:code', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

// Rota de debug (remover em produção)
// app.get('/debug/rooms', (req, res) => {
//   const roomsData = Array.from(activeRooms.entries()).map(([code, room]) => ({
//     code,
//     players: Array.from(room.players.values()).map(p => ({
//       id: p.id,
//       name: p.name,
//       socketId: p.socketId,
//       isOwner: p.isOwner
//     })),
//     gameState: room.gameState
//   }));
//   
//   res.json({
//     totalRooms: activeRooms.size,
//     rooms: roomsData
//   });
// });

app.post('/create-room', (req, res) => {
  const { playerName, timeLimit, locationsCount} = req.body;
  
  // Validar nome
  if (!playerName || playerName.trim().length === 0) {
    return res.json({ success: false, message: 'Nome é obrigatório' });
  }
  
  if (playerName.trim().length > 20) {
    return res.json({ success: false, message: 'Nome muito longo (máximo 20 caracteres)' });
  }
  
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const playerId = uuidv4();
  
  const room = new Room(roomCode, playerId);
  room.timeLimit = timeLimit || 300;
  room.locationsCount = locationsCount || 50;
  
  const result = room.addPlayer(playerId, playerName.trim(), null);
  
  if (result.error) {
    return res.json({ success: false, message: result.error });
  }
  
  activeRooms.set(roomCode, room);
  
  res.json({ 
    roomCode, 
    playerId, 
    playerCode: result.playerCode,
    success: true 
  });
});

// Configurações do Socket.io para detectar desconexões mais rapidamente
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req, err.code, err.message, err.context);
});

// Configurar timeout de ping
io.engine.pingTimeout = 5000; // 5 segundos
io.engine.pingInterval = 3000; // 3 segundos

// Socket.io eventos - ÚNICO BLOCO
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);
  
  // Configurar timeout específico para este socket
  socket.conn.on('close', (reason) => {
    console.log('Socket closed:', socket.id, 'Reason:', reason);
  });

  socket.on('join-room', async (data) => {
    const { roomCode, playerName, playerId, playerCode } = data;
    const room = activeRooms.get(roomCode);
    
    if (!room) {
      socket.emit('error', { message: 'Sala não encontrada' });
      return;
    }

    let currentPlayerId = playerId;
    let currentPlayerCode = playerCode;

    // Verificar se é reconexão NESTA SALA ESPECÍFICA
    if (playerId && playerCode) {
      const existingPlayer = Array.from(room.players.values()).find(
        p => p.id === playerId && p.code === playerCode
      );
  
      if (existingPlayer) {
        // Jogador existe NESTA SALA - reconectar
        existingPlayer.socketId = socket.id;
        socket.join(roomCode);
        socket.playerId = playerId;
        socket.roomCode = roomCode;
        console.log(`🔗 Reconexão: Socket ${socket.id} associado: playerId=${playerId}, roomCode=${roomCode}`);
        console.log(`Jogador ${playerName} reconectou à sala ${roomCode}`);
      } else {
        // Jogador NÃO existe NESTA SALA - LIMPAR cookies e criar novo
        console.log(`Jogador ${playerName} não existe na sala ${roomCode}, limpando dados e criando novo`);
        
        // Gerar novos IDs
        const newPlayerId = uuidv4();
        const result = room.addPlayer(newPlayerId, playerName, socket.id);
        
        if (result.error) {
          socket.emit('error', { message: result.error });
          return;
        }
        
        currentPlayerId = newPlayerId; // USAR O MESMO ID
        currentPlayerCode = result.playerCode;
        socket.join(roomCode);
        socket.playerId = currentPlayerId;
        socket.roomCode = roomCode;
        console.log(`Novo jogador ${playerName} criado na sala ${roomCode} com ID ${currentPlayerId}`);
      }
    } else {
      // Nova entrada sem dados salvos
      currentPlayerId = uuidv4();
      const result = room.addPlayer(currentPlayerId, playerName, socket.id);
      
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      
      currentPlayerCode = result.playerCode;
      socket.join(roomCode);
      socket.playerId = currentPlayerId;
      socket.roomCode = roomCode;
      console.log(`Novo jogador ${playerName} criado na sala ${roomCode}`);
    }
    
    // Cancelar deleção se estava agendada
    room.cancelDelete();
    
    socket.emit('joined-room', {
      roomCode,
      playerId: currentPlayerId,
      playerCode: currentPlayerCode,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isOwner: p.isOwner,
        score: p.score
      })),
      gameState: room.gameState,
      timeRemaining: room.timeRemaining,
      currentPlayer: room.currentPlayer,
      playerOrder: room.playerOrder
    });
    
    // Enviar informações específicas do jogo se estiver em andamento
    if (room.gameState === 'playing') {
      const player = room.players.get(currentPlayerId);
      if (player.id === room.spy) {
        // Reenviar informações completas para o espião
        socket.emit('game-started', {
          isSpy: true,
          locations: room.availableLocations,
          currentPlayer: room.currentPlayer,
          playerOrder: room.playerOrder,
          timeRemaining: room.timeRemaining
        });
      } else {
        // Reenviar informações completas para jogador normal
        socket.emit('game-started', {
          isSpy: false,
          location: room.location,
          locations: room.availableLocations,
          currentPlayer: room.currentPlayer,
          playerOrder: room.playerOrder,
          timeRemaining: room.timeRemaining
        });
      }
    } else if (room.gameState === 'voting') {
      // Se estiver em votação, mostrar modal de votação
      socket.emit('voting-started', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name
        }))
      });
    } else if (room.gameState === 'ended') {
      // Se jogo terminou, mostrar resultado
      socket.emit('game-ended', {
        result: room.lastResult || 'spy_wins',
        spy: room.spy,
        location: room.location
      });
    }

    socket.to(roomCode).emit('player-joined', {
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isOwner: p.isOwner,
        score: p.score
      }))
    });
  });

  socket.on('start-game', () => {
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    
    if (!room || !room.players.get(socket.playerId)?.isOwner) {
      return;
    }

    if (room.startGame()) {
      room.players.forEach((player) => {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          // ADICIONAR ESTAS LINHAS: Garantir que os dados do socket estão corretos
          playerSocket.playerId = player.id;
          playerSocket.roomCode = roomCode;
          console.log(`🔄 Socket ${playerSocket.id} atualizado: playerId=${player.id}, roomCode=${roomCode}`);
          
          if (player.id === room.spy) {
            playerSocket.emit('game-started', {
              isSpy: true,
              locations: room.availableLocations,
              currentPlayer: room.currentPlayer,
              playerOrder: room.playerOrder,
              timeRemaining: room.timeRemaining
            });
          } else {
            playerSocket.emit('game-started', {
              isSpy: false,
              location: room.location,
              locations: room.availableLocations,
              currentPlayer: room.currentPlayer,
              playerOrder: room.playerOrder,
              timeRemaining: room.timeRemaining
            });
          }
        }
      });

      const timerInterval = setInterval(() => {
         if (room.gameState !== 'playing') {
           clearInterval(timerInterval);
           return;
         }
    
         io.to(roomCode).emit('timer-update', {
           timeRemaining: room.timeRemaining
         });
         
         if (room.timeRemaining <= 0) {
           clearInterval(timerInterval);
           
           // ADICIONAR ESTA PARTE: Iniciar votação quando tempo acaba
           console.log(`⏰ Tempo esgotado na sala ${roomCode}, iniciando votação`);
           if (room.startVoting()) {
             io.to(roomCode).emit('voting-started', {
               players: Array.from(room.players.values()).map(p => ({
                 id: p.id,
                 name: p.name
               }))
             });
           }
         }
       }, 1000);
    }
  });

  socket.on('start-voting', () => {
    console.log('Recebido start-voting de:', socket.playerId);
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player || room.gameState !== 'playing') {
      console.log('Bloqueado: sala não encontrada ou estado inválido');
      return;
    }

    // CORRIGIR ESTA LÓGICA: verificar apenas se não é espião
    if (player.id !== room.spy) {
      console.log(`Jogador ${player.name} (não-espião) iniciou votação`);
      room.startVoting();
      io.to(roomCode).emit('voting-started', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name
        }))
      });
    } else {
      console.log(`Jogador ${player.name} é espião - não pode iniciar votação`);
    }
  });

  socket.on('spy-guess', (data) => {
    console.log('Recebido spy-guess:', data, 'de:', socket.playerId);
    const { guess } = data;
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player || player.id !== room.spy) {
      return;
    }

    // Notificar todos que o espião está chutando
    io.to(roomCode).emit('spy-guessing', { guess });

    if (room.spyGuessLocation(guess)) {
      // Espião acertou - ganha o jogo
      const result = room.endGame('spy_wins');
      io.to(roomCode).emit('game-ended', result);
    } else {
      // Espião errou - perde o jogo imediatamente
      console.log('Espião errou o local, cidade vence');
      const result = room.endGame('town_wins');
      io.to(roomCode).emit('game-ended', result);
    }
  });

  socket.on('vote', (data) => {
    console.log('Recebido vote:', data, 'de:', socket.playerId);
    const { votedFor } = data;
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    
    if (!room || room.gameState !== 'voting') {
      return;
    }

    room.vote(socket.playerId, votedFor);
    
    // Verificar se todos votaram
    if (room.votes.size === room.players.size) {
      const result = room.endGame();
      io.to(roomCode).emit('game-ended', result);
    } else {
      io.to(roomCode).emit('vote-cast', {
        votesCount: room.votes.size,
        totalPlayers: room.players.size
      });
    }
  });

  socket.on('reset-game', () => {
    console.log('Recebido reset-game de:', socket.playerId);
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player) {
      return;
    }

    // Qualquer jogador pode resetar (ou apenas owner se preferir)
    if (room.resetGame()) {
      // Enviar estado resetado para todos na sala
      room.players.forEach((p) => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit('game-reset', {
            roomCode,
            players: Array.from(room.players.values()).map(player => ({
              id: player.id,
              name: player.name,
              isOwner: player.isOwner,
              score: player.score
            })),
            gameState: room.gameState
          });
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
    
    const roomCode = socket.roomCode;
    const playerId = socket.playerId;
    
    if (roomCode && playerId) {
      const room = activeRooms.get(roomCode);
      
      if (room) {
        if (room.players.has(playerId)) {
          const player = room.players.get(playerId);
          const wasOwner = player.isOwner;
          room.removePlayer(playerId);
          
          // Se ainda tem jogadores na sala
          if (room.players.size > 0) {
            // Cancelar deleção se estava agendada
            room.cancelDelete();
            
            // Se o dono saiu, fazer o próximo jogador virar dono
            if (wasOwner) {
              const newOwner = Array.from(room.players.values())[0];
              newOwner.isOwner = true;
              room.owner = newOwner.id;
            }
            
            // Notificar outros jogadores sobre a saída
            const updatedPlayers = Array.from(room.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              isOwner: p.isOwner,
              score: p.score
            }));
            
            io.to(roomCode).emit('player-left', {
              playerId: playerId,
              playerName: player.name,
              players: updatedPlayers,
              newOwner: wasOwner ? Array.from(room.players.values())[0]?.id : null
            });
            
            // Se estava jogando e agora tem menos de 3 jogadores, cancelar jogo
            if (room.gameState === 'playing' && room.players.size < 3) {
              room.resetGame();
              room.players.forEach((p) => {
                const playerSocket = io.sockets.sockets.get(p.socketId);
                if (playerSocket) {
                  playerSocket.emit('game-cancelled', {
                    message: 'Jogo cancelado - poucos jogadores',
                    players: updatedPlayers,
                    gameState: 'waiting'
                  });
                }
              });
            }
            
          } else {
            // Sala vazia - AGENDAR deleção em 30 segundos ao invés de deletar imediatamente
            console.log(`Sala ${roomCode} ficou vazia, agendando deleção em 30 segundos`);
            room.scheduleDelete();
          }
        }
      }
    }
  });

}); // <-- ESTA chave fecha o io.on('connection')

const PORT = process.env.PORT || 7842;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

});

