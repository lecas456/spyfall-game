console.log('=== GAME.JS INICIANDO ===');

const socket = io();
let currentRoom = null;
let currentPlayer = null;
let gameState = 'waiting';
let playerNotes = {};
let selectedVote = null;
let eliminatedLocations = new Set(); // Para o espião eliminar locais
let votingConfirmationActive = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado');
    
    // Esconder modais inicialmente
    document.getElementById('voting-modal').style.display = 'none';
    document.getElementById('result-modal').style.display = 'none';
    
    // Extrair código da sala da URL
    const path = window.location.pathname;
    const roomCode = path.split('/')[2];
    console.log('Código da sala:', roomCode);
    
    if (!roomCode) {
        window.location.href = '/';
        return;
    }

    document.getElementById('room-code').textContent = roomCode;

    // Tentar pegar informações dos cookies
    const playerId = getCookie('playerId');
    const playerCode = getCookie('playerCode');
    const playerName = getCookie('playerName');

    console.log('Dados salvos:', { playerId, playerCode, playerName });

    if (!playerName) {
        const name = prompt('Digite seu nome:');
        if (!name) {
            window.location.href = '/';
            return;
        }
        setCookie('playerName', name, 1);
        joinRoom(roomCode, name);
    } else {
        joinRoom(roomCode, playerName, playerId, playerCode);
    }
});

function joinRoom(roomCode, playerName, playerId = null, playerCode = null) {
    console.log('Tentando entrar na sala:', { roomCode, playerName, playerId, playerCode });
    socket.emit('join-room', {
        roomCode,
        playerName,
        playerId,
        playerCode
    });
}

function exitRoom() {
    const confirmExit = confirm('🚪 Tem certeza que deseja sair da sala?');
    
    if (confirmExit) {
        console.log('👋 Saindo da sala...');
        
        // Emitir evento para realmente sair da sala
        socket.emit('exit-room');
        
        // Limpar dados locais
        setCookie('playerId', '', -1);
        setCookie('playerCode', '', -1);
        setCookie('playerName', '', -1);
        
        // Redirecionar para tela inicial
        window.location.href = '/';
    }
}

// Eventos do Socket
socket.on('joined-room', function(data) {
    console.log('Entrou na sala:', data);
    currentRoom = data;
    currentPlayer = data.playerId;
    gameState = data.gameState;
    
    // Garantir que os dados dos jogadores estejam corretos
    console.log('Jogadores na sala:', data.players.map(p => `${p.name} (${p.id})`));
    
    // Salvar informações nos cookies
    setCookie('playerId', data.playerId, 1);
    setCookie('playerCode', data.playerCode, 1);
    
    updatePlayersList(data.players);
    updateGameControls(data.gameState);
    
    // ADICIONAR ESTA SEÇÃO NOVA:
    // Configurar interface baseada no estado do jogo
    if (data.gameState === 'waiting') {
        document.getElementById('game-info').innerHTML = '<p>🎮 Aguardando início do jogo...</p>';
        document.getElementById('notes-area').innerHTML = '<p>📝 As anotações aparecerão quando o jogo começar.</p>';
    } else if (data.gameState === 'playing') {
        console.log('🔄 Reconectando em jogo em andamento, aguardando dados completos...');
        document.getElementById('game-info').innerHTML = '<p>🔄 Carregando informações do jogo...</p>';
        document.getElementById('notes-area').innerHTML = '<p>📝 Carregando anotações...</p>';
    }
    // FIM DA SEÇÃO NOVA
    
    if (data.timeRemaining > 0) {
        updateTimer(data.timeRemaining);
    } else {
        document.getElementById('timer').textContent = '⏱️ --:--';
    }
});

socket.on('player-joined', function(data) {
    console.log('Jogador entrou:', data);
    updatePlayersList(data.players);
    
    // Atualizar currentRoom com nova lista de jogadores
    if (currentRoom) {
        currentRoom.players = data.players;
    }
});

socket.on('game-started', function(data) {
    console.log('Jogo iniciado:', data);
    gameState = 'playing';
    updateGameInfo(data);
    updateTimer(data.timeRemaining);
    updateGameControls('playing');
    
    // CORREÇÃO: Sempre criar área de anotações com dados atualizados
    console.log('🗒️ Criando área de anotações para reconexão');
    if (currentRoom && currentRoom.players) {
        createNotesArea(currentRoom.players);
    } else {
        console.log('⚠️ currentRoom.players não disponível, tentando novamente...');
        setTimeout(() => {
            if (currentRoom && currentRoom.players) {
                createNotesArea(currentRoom.players);
            }
        }, 500);
    }
});

socket.on('timer-update', function(data) {
    updateTimer(data.timeRemaining);
});

socket.on('voting-started', function(data) {
    console.log('🗳️ MODAL DE VOTAÇÃO REAL DEVE ABRIR AGORA');
    console.log('Dados da votação:', data);
    gameState = 'voting';
    showVotingModal(data.players);
});

socket.on('game-ended', function(data) {
    console.log('Jogo terminou:', data);
    gameState = 'ended';
    showResultModal(data);
});

socket.on('spy-guessing', function(data) {
    console.log('Espião está chutando:', data.guess);
    
    // Se não for o espião, mostrar modal visual
    const isCurrentPlayerSpy = document.querySelector('.spy-info') !== null;
    if (!isCurrentPlayerSpy) {
        // Fechar qualquer modal que esteja aberto
        closeSpyGuessModal();
        // Mostrar modal visual
        showSpyGuessModal();
        
        // Fechar automaticamente após 3 segundos
        setTimeout(() => {
            closeSpyGuessModal();
        }, 3000);
    }
});

socket.on('error', function(data) {
    console.error('Erro do servidor:', data);
    
    if (data.message === 'Nome já existe na sala') {
        // Caso específico de nome duplicado
        const newName = prompt(`❌ Nome "${getCookie('playerName')}" já existe nesta sala!\n\nDigite um novo nome:`);
        
        if (newName && newName.trim()) {
            // Salvar novo nome e tentar novamente
            setCookie('playerName', newName.trim(), 1);
            
            // Tentar entrar novamente com novo nome
            const path = window.location.pathname;
            const roomCode = path.split('/')[2];
            joinRoom(roomCode, newName.trim());
        } else {
            // Usuário cancelou, voltar para página inicial
            alert('Entrada cancelada');
            window.location.href = '/';
        }
    } else {
        // Outros erros
        alert('Erro: ' + data.message);
        if (data.message === 'Sala não encontrada') {
            window.location.href = '/';
        }
    }
});
// Evento quando um jogador se desconecta (mas não sai da sala)
socket.on('player-disconnected', function(data) {
    console.log('📱 Jogador desconectado:', data.playerName);
    
    // Atualizar lista de jogadores mostrando status de conexão
    // updatePlayersListWithStatus(data.connectedPlayers);
    
    // Se owner desconectou, atualizar controles
    if (data.ownerLeft) {
        console.log('👑 Owner desconectou, atualizando controles');
        updateGameControls(gameState);
        showNotification(`📱 ${data.playerName} (owner) desconectou - qualquer um pode iniciar`, 'warning');
    } else {
        showNotification(`📱 ${data.playerName} desconectou`, 'info');
    }
});
// Evento de reset do jogo
socket.on('game-reset', function(data) {
    console.log('Jogo resetado:', data);
    
    // Atualizar estado local
    currentRoom = data;
    gameState = data.gameState;
    
    // Resetar interface para estado inicial
    updatePlayersList(data.players);
    updateGameControls(data.gameState);
    
    // Limpar informações do jogo
    document.getElementById('game-info').innerHTML = '<p>🎮 Aguardando início do jogo...</p>';
    document.getElementById('notes-area').innerHTML = '<p>📝 As anotações aparecerão quando o jogo começar.</p>';
    document.getElementById('timer').textContent = '⏱️ --:--';
    
    // Fechar todos os modais
    document.getElementById('voting-modal').style.display = 'none';
    document.getElementById('result-modal').style.display = 'none';
    closeSpyGuessModal();
    
    // Limpar anotações salvas
    localStorage.removeItem('spyfall-notes');
    playerNotes = {};
    
    console.log('Interface resetada, pronta para novo jogo');
});

// Evento quando um jogador sai
socket.on('player-left', function(data) {
    console.log('Jogador saiu:', data.playerName);
    
    // Atualizar lista de jogadores
    updatePlayersList(data.players);
    
    // NOVA LÓGICA: Se owner saiu, atualizar controles
    if (data.ownerLeft) {
        console.log('Owner saiu da sala! Agora qualquer um pode iniciar o jogo.');
        updateGameControls(gameState);
        showNotification(`👑 ${data.playerName} (owner) saiu - qualquer um pode iniciar o jogo agora!`, 'warning');
    } else if (data.newOwner === currentPlayer) {
        // Se você se tornou o novo dono (caso ainda use a lógica antiga)
        console.log('Você agora é o dono da sala!');
        updateGameControls(gameState);
        showNotification(`Você agora é o dono da sala!`, 'info');
    } else {
        showNotification(`${data.playerName} saiu da sala`, 'info');
    }
});

// Evento quando jogo é cancelado por falta de jogadores
socket.on('game-cancelled', function(data) {
    console.log('Jogo cancelado:', data.message);
    
    // Atualizar interface para estado de espera
    gameState = 'waiting';
    updatePlayersList(data.players);
    updateGameControls('waiting');
    
    // Limpar informações do jogo
    document.getElementById('game-info').innerHTML = '<p>🎮 Aguardando início do jogo...</p>';
    document.getElementById('notes-area').innerHTML = '<p>📝 As anotações aparecerão quando o jogo começar.</p>';
    document.getElementById('timer').textContent = '⏱️ --:--';
    
    // Fechar modais
    document.getElementById('voting-modal').style.display = 'none';
    document.getElementById('result-modal').style.display = 'none';
    closeSpyGuessModal();
    
    // Mostrar notificação
    showNotification(data.message, 'warning');
});

// Evento quando sala é deletada por inatividade
socket.on('room-deleted', function(data) {
    console.log('Sala deletada:', data.message);
    alert(data.message);
    // Redirecionar para página inicial
    window.location.href = '/';
});

// Evento de confirmação de votação
socket.on('voting-confirmation-started', function(data) {
    console.log('Confirmação de votação iniciada por:', data.initiator);
    votingConfirmationActive = true;
    showVotingConfirmationModal(data.initiator, data.timeLimit);
});

socket.on('voting-confirmation-update', function(data) {
    console.log('Update confirmação:', data);
    updateVotingConfirmationModal(data.voted, data.total);
});

socket.on('voting-confirmation-result', function(data) {
    console.log('📊 Resultado da confirmação de votação:', data);
    closeVotingConfirmationModal();
    votingConfirmationActive = false;
    
    if (data.approved) {
        showNotification(`✅ Votação aprovada! (${data.yesVotes} Sim, ${data.noVotes} Não)`, 'success');
        console.log('✅ Aguardando modal de votação real...');
    } else {
        showNotification(`❌ Votação rejeitada (${data.yesVotes} Sim, ${data.noVotes} Não)`, 'warning');
        console.log('❌ Voltando ao jogo normal');
    }
});

// Adicionar após os outros eventos socket
// Evento quando imagens são carregadas
socket.on('images-loaded', function(data) {
    console.log('Imagens carregadas:', data);
    
    // Atualizar apenas a imagem do local (o overlay já está correto)
    const locationContainer = document.getElementById('location-img-container');
    if (locationContainer && data.locationImage) {
        const existingOverlay = locationContainer.querySelector('.location-overlay');
        locationContainer.innerHTML = `
            <img src="${data.locationImage}" alt="${window.currentGameData.location}" class="location-image">
        `;
        // Re-adicionar o overlay existente
        if (existingOverlay) {
            locationContainer.appendChild(existingOverlay);
        }
    }
    
    // Atualizar apenas a imagem da profissão (o overlay já está correto)
    const professionContainer = document.getElementById('profession-img-container');
    if (professionContainer && data.professionImage) {
        const existingOverlay = professionContainer.querySelector('.profession-overlay');
        professionContainer.innerHTML = `
            <img src="${data.professionImage}" alt="${window.currentGameData.profession}" class="profession-image">
        `;
        // Re-adicionar o overlay existente
        if (existingOverlay) {
            professionContainer.appendChild(existingOverlay);
        }
    }
});

// Funções de interface
function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        
        if (player.isOwner) {
            playerDiv.classList.add('owner');
        }
        
        playerDiv.innerHTML = `
            <div class="player-name">${player.name} ${player.isOwner ? '👑' : ''}</div>
            <div class="player-score">Pontos: ${player.score}</div>
        `;
        
        playersList.appendChild(playerDiv);
    });
}

function updateGameInfo(data) {
    console.log('🎮 updateGameInfo recebido:', data);
    console.log('   - isSpy:', data.isSpy);
    console.log('   - location:', data.location);
    console.log('   - profession:', data.profession);
    console.log('   - hasProfessions:', data.hasProfessions);
    
    // ADICIONAR ESTA LINHA:
    window.currentGameData = data;
    
    window.currentGameLocations = data.locations;
    
    const gameInfo = document.getElementById('game-info');
    
    if (data.isSpy) {
        window.isCurrentPlayerSpy = true;
        gameInfo.className = 'game-info spy-info';
        gameInfo.innerHTML = `
            <h4>🕵️ Você é o ESPIÃO!</h4>
            <p>Descubra qual é o local sem se entregar!</p>
            ${data.firstQuestionPlayer ? getFirstQuestionDisplay(data.firstQuestionPlayer) : ''}
            <p><strong>Locais possíveis nesta partida: ${data.locations.length}</strong></p>
            <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 15px;">💡 Clique nos locais para eliminá-los (só você vê)</p>
            <div class="locations-grid spy-locations-grid">
                ${data.locations.map(location => 
                    `<button class="location-item spy-location-btn" data-location="${location}" onclick="toggleLocationElimination('${location}')">${location}</button>`
                ).join('')}
            </div>
        `;
    } else {
        window.isCurrentPlayerSpy = false;
        gameInfo.className = 'game-info';
        
        // CORREÇÃO COMPLETA da lógica de exibição
        let gameContent = '';
        
        console.log('🔍 Verificando modo de exibição:');
        console.log('   - hasProfessions:', data.hasProfessions);
        console.log('   - profession existe:', !!data.profession);
        
        if (data.hasProfessions === true && data.profession) {
            // Modo com profissões - duas colunas
            console.log('✅ Modo com profissões - duas colunas');
            gameContent = `
                <div class="game-images">
                    <div class="location-info">
                        <div class="image-placeholder" id="location-img-container">
                            ${data.locationImage ? 
                              `<img src="${data.locationImage}" alt="${data.location}" class="location-image">` : 
                              '<div class="loading-placeholder">🖼️ Carregando imagem do local...</div>'
                            }
                            <div class="location-overlay">📍 ${data.location}</div>
                        </div>
                    </div>
                    <div class="profession-info">
                        <div class="image-placeholder" id="profession-img-container">
                            ${data.professionImage ? 
                              `<img src="${data.professionImage}" alt="${data.profession}" class="profession-image">` : 
                              '<div class="loading-placeholder">🖼️ Carregando imagem da profissão...</div>'
                            }
                            <div class="profession-overlay">👔 ${data.profession}</div>
                        </div>
                    </div>
                </div>`;
        } else {
            // Modo só local - uma coluna
            console.log('✅ Modo só local - uma coluna');
            gameContent = `
                <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 25px;">
                    <div class="location-info" style="height: 250px;">
                        <div class="image-placeholder" id="location-img-container">
                            ${data.locationImage ? 
                              `<img src="${data.locationImage}" alt="${data.location}" class="location-image">` : 
                              '<div class="loading-placeholder">🖼️ Carregando imagem do local...</div>'
                            }
                            <div class="location-overlay">📍 ${data.location}</div>
                        </div>
                    </div>
                </div>`;
        }
        
        gameInfo.innerHTML = `
            ${gameContent}
            <p>Descubra quem é o espião fazendo perguntas!</p>
            ${data.firstQuestionPlayer ? getFirstQuestionDisplay(data.firstQuestionPlayer) : ''}
            <p><strong>Locais possíveis nesta partida: ${data.locations.length}</strong></p>
            <div class="locations-grid">
                ${data.locations.map(location => 
                    `<div class="location-item">${location}</div>`
                ).join('')}
            </div>
        `;
    }
}

function toggleLocationElimination(location) {
    console.log('Toggle eliminação:', location);
    
    if (eliminatedLocations.has(location)) {
        // Reativar local
        eliminatedLocations.delete(location);
    } else {
        // Eliminar local
        eliminatedLocations.add(location);
    }
    
    // Atualizar visual
    updateSpyLocationsVisual();
}

function updateSpyLocationsVisual() {
    const locationBtns = document.querySelectorAll('.spy-location-btn');
    locationBtns.forEach(btn => {
        const location = btn.getAttribute('data-location');
        if (eliminatedLocations.has(location)) {
            btn.classList.add('eliminated');
        } else {
            btn.classList.remove('eliminated');
        }
    });
    
    // Mostrar contador
    const totalLocations = window.currentGameLocations?.length || 0;
    const remainingLocations = totalLocations - eliminatedLocations.size;
    
    // Atualizar ou criar contador
    let counter = document.querySelector('.spy-counter');
    if (!counter && document.querySelector('.spy-locations-grid')) {
        counter = document.createElement('p');
        counter.className = 'spy-counter';
        counter.style.cssText = 'text-align: center; margin: 10px 0; font-weight: bold; color: #dc2626;';
        document.querySelector('.spy-locations-grid').parentNode.insertBefore(counter, document.querySelector('.spy-locations-grid'));
    }
    
    if (counter) {
        counter.textContent = `🎯 Restam ${remainingLocations} locais possíveis (${eliminatedLocations.size} eliminados)`;
    }
}

function showVotingConfirmationModal(initiator, timeLimit) {
    const modal = document.createElement('div');
    modal.id = 'voting-confirmation-modal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content voting-confirmation-content">
            <h3>🗳️ Confirmação de Votação</h3>
            <p><strong>${initiator}</strong> quer iniciar a votação.</p>
            <p>Você concorda?</p>
            
            <div class="voting-confirmation-timer">
                <div class="timer-circle">
                    <span id="confirmation-timer">${timeLimit}</span>
                </div>
            </div>
            
            <div class="voting-confirmation-status">
                <p id="confirmation-status">Aguardando respostas...</p>
            </div>
            
            <div class="voting-confirmation-buttons">
                <button class="vote-confirmation-btn yes-btn" onclick="sendVotingConfirmation('yes')">
                    ✅ Sim, vamos votar
                </button>
                <button class="vote-confirmation-btn no-btn" onclick="sendVotingConfirmation('no')">
                    ❌ Não, continuar jogando
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Timer countdown
    let remaining = timeLimit;
    let userVoted = false; // ADICIONAR controle se usuário já votou
    
    const timerElement = document.getElementById('confirmation-timer');
    const interval = setInterval(() => {
        remaining--;
        if (timerElement) {
            timerElement.textContent = remaining;
            
            // Mudar cor conforme o tempo
            if (remaining <= 3) {
                timerElement.parentElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            } else if (remaining <= 5) {
                timerElement.parentElement.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            }
        }
        
        if (remaining <= 0) {
            clearInterval(interval);
            // CORREÇÃO: Auto-vote "no" apenas se não respondeu
            if (votingConfirmationActive && !userVoted) {
                console.log('⏰ Tempo esgotado, enviando voto automático: NÃO');
                sendVotingConfirmation('no');
            }
        }
    }, 1000);
    
    // Função modificada para marcar que votou
    window.sendVotingConfirmation = function(vote) {
        if (userVoted) return; // Evitar votos duplos
        
        userVoted = true;
        console.log('Enviando confirmação:', vote);
        socket.emit('vote-confirmation', { vote });
        
        // Desabilitar botões
        document.querySelectorAll('.vote-confirmation-btn').forEach(btn => {
            btn.disabled = true;
            if ((vote === 'yes' && btn.classList.contains('yes-btn')) || 
                (vote === 'no' && btn.classList.contains('no-btn'))) {
                btn.style.opacity = '1';
                btn.textContent = vote === 'yes' ? '✅ Você votou SIM' : '❌ Você votou NÃO';
            } else {
                btn.style.opacity = '0.5';
            }
        });
    };
}

function updateVotingConfirmationModal(voted, total) {
    const status = document.getElementById('confirmation-status');
    if (status) {
        status.textContent = `${voted}/${total} jogadores responderam`;
    }
}

function closeVotingConfirmationModal() {
    const modal = document.getElementById('voting-confirmation-modal');
    if (modal) {
        modal.remove();
    }
}

function sendVotingConfirmation(vote) {
    console.log('Enviando confirmação:', vote);
    socket.emit('vote-confirmation', { vote });
    
    // Desabilitar botões
    document.querySelectorAll('.vote-confirmation-btn').forEach(btn => {
        btn.disabled = true;
        if ((vote === 'yes' && btn.classList.contains('yes-btn')) || 
            (vote === 'no' && btn.classList.contains('no-btn'))) {
            btn.style.opacity = '1';
            btn.textContent = vote === 'yes' ? '✅ Você votou SIM' : '❌ Você votou NÃO';
        } else {
            btn.style.opacity = '0.5';
        }
    });
}

function updateGameControls(state) {
    const gameControls = document.getElementById('game-controls');
    
    // Animação de saída
    gameControls.classList.add('fade-out');
    
    setTimeout(() => {
        if (state === 'waiting') {
            // NOVA LÓGICA: Verificar se há owner na sala
            const players = currentRoom?.players || [];
            const currentPlayerData = players.find(p => p.id === currentPlayer);
            const isOwner = currentPlayerData?.isOwner || false;
            const hasOwner = players.some(p => p.isOwner);
            
            if (isOwner || !hasOwner) {
                // É owner OU não há owner - pode iniciar
                const buttonText = hasOwner ? '🎮 Iniciar Jogo' : '🚀 Iniciar Jogo (Sem Owner)';
                gameControls.innerHTML = `
                    <button onclick="startGame()">${buttonText}</button>
                    <p>Mínimo 3 jogadores para começar</p>
                    ${!hasOwner ? '<p style="color: #f59e0b; font-size: 0.9rem;">⚠️ Owner saiu - qualquer um pode iniciar</p>' : ''}
                `;
            } else {
                // Não é owner e existe owner - aguardar
                gameControls.innerHTML = `
                    <p>⏳ Aguardando o dono da sala iniciar o jogo...</p>
                `;
            }
        } else if (state === 'playing') {
            // Verificar se o jogador atual é espião
            const isCurrentPlayerSpy = gameState === 'playing' && 
                                      document.querySelector('.spy-info') !== null;
        
            if (isCurrentPlayerSpy) {
                // Só botão de chutar para o espião
                gameControls.innerHTML = `
                    <button onclick="showSpyGuessModal()" id="spy-guess-btn">🎯 Chutar Local</button>
                `;
            } else {
                // Só botão de votação para não-espiões
                gameControls.innerHTML = `
                    <button onclick="startVoting()" id="vote-btn">🗳️ Ir para Votação</button>
                `;
            }
        }
        
        gameControls.classList.remove('fade-out');
        gameControls.classList.add('fade-in', 'game-state-transition');
        
        setTimeout(() => {
            gameControls.classList.remove('game-state-transition');
        }, 600);
    }, 300);
}

function updateTimer(timeRemaining) {
    const timer = document.getElementById('timer');
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    timer.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    timer.className = timeRemaining <= 30 ? 'timer warning' : 'timer';
}

function createNotesArea(players) {
    const notesArea = document.getElementById('notes-area');
    
    if (!players || players.length === 0) {
        console.log('⚠️ Nenhum jogador fornecido para criar anotações');
        notesArea.innerHTML = '<p>📝 Aguardando lista de jogadores...</p>';
        return;
    }
    
    console.log('🗒️ Criando anotações para:', players.map(p => p.name));
    notesArea.innerHTML = '';
    
    players.forEach(player => {
        if (player.id !== currentPlayer) {
            const noteDiv = document.createElement('div');
            noteDiv.innerHTML = `
                <label><strong>${player.name}:</strong></label>
                <textarea class="note-input" data-player="${player.id}" 
                          placeholder="Suas anotações sobre ${player.name}..."></textarea>
            `;
            notesArea.appendChild(noteDiv);
        }
    });
    
    console.log('✅ Anotações criadas com sucesso');
}

function startGame() {
    console.log('Iniciando jogo...');
    socket.emit('start-game');
}

function startVoting() {
    console.log('startVoting chamado, enviando para servidor...');
    socket.emit('start-voting');
}

function showVotingModal(players) {
    const modal = document.getElementById('voting-modal');
    const votingOptions = document.getElementById('voting-options');
    
    votingOptions.innerHTML = '';
    
    players.forEach(player => {
        if (player.id !== currentPlayer) {
            const option = document.createElement('button');
            option.className = 'vote-option';
            option.textContent = player.name;
            option.onclick = () => selectVote(player.id, option);
            votingOptions.appendChild(option);
        }
    });
    
    modal.style.display = 'block';
}

function selectVote(playerId, element) {
    document.querySelectorAll('.vote-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedVote = playerId;
    document.getElementById('confirm-vote').disabled = false;
}

function showResultModal(result) {
    const modal = document.getElementById('result-modal');
    const content = document.getElementById('result-content');
    
    let resultText = '';
    if (result.result === 'spy_wins') {
        resultText = `🕵️ <strong>O espião venceu!</strong><br><br>Local era: <strong>${result.location}</strong>`;
    } else {
        resultText = `🏆 <strong>A cidade venceu!</strong><br><br>Local era: <strong>${result.location}</strong>`;
    }
    
    content.innerHTML = resultText;
    
    // NOVA FUNCIONALIDADE: Delay no botão para o espião
    const playAgainBtn = document.getElementById('play-again');
    const wasSpyWhoGuessed = window.isCurrentPlayerSpy && result.result; // Se é espião e jogo acabou
    
    if (wasSpyWhoGuessed) {
        // Espião - desabilitar botão por 8 segundos
        playAgainBtn.disabled = true;
        playAgainBtn.style.opacity = '0.5';
        playAgainBtn.style.cursor = 'not-allowed';
        
        let countdown = 4;
        playAgainBtn.textContent = `🎮 Jogar Novamente (${countdown}s)`;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            playAgainBtn.textContent = `🎮 Jogar Novamente (${countdown}s)`;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                playAgainBtn.disabled = false;
                playAgainBtn.style.opacity = '1';
                playAgainBtn.style.cursor = 'pointer';
                playAgainBtn.textContent = '🎮 Jogar Novamente';
            }
        }, 1000);
    } else {
        // Não-espião - botão normal
        playAgainBtn.disabled = false;
        playAgainBtn.style.opacity = '1';
        playAgainBtn.style.cursor = 'pointer';
        playAgainBtn.textContent = '🎮 Jogar Novamente';
    }
    
    modal.style.display = 'block';
}

// Event listeners para botões dos modais
document.getElementById('confirm-vote').addEventListener('click', function() {
    if (selectedVote) {
        socket.emit('vote', { votedFor: selectedVote });
        document.getElementById('voting-modal').style.display = 'none';
    }
});

document.getElementById('play-again').addEventListener('click', function() {
    console.log('Resetando jogo...');
    socket.emit('reset-game');
    
    // Fechar modal de resultado
    document.getElementById('result-modal').style.display = 'none';
});

function showSpyGuessModal() {
    // Usar locais da variável global ao invés do DOM
    const locations = window.currentGameLocations || [];
    
    if (locations.length === 0) {
        alert('Erro: locais não encontrados');
        return;
    }
    
    // Verificar se é o espião
    const isCurrentPlayerSpy = document.querySelector('.spy-info') !== null;
    
    let modalContent;
    if (isCurrentPlayerSpy) {
        // Modal para o espião (botões clicáveis)
        modalContent = `
            <div id="spy-guess-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <button onclick="closeSpyGuessModal()" class="cancel-btn-top">❌ Cancelar</button>
                    </div>
                    
                    <h3>🎯 Escolha o Local</h3>
                    <p>⚠️ <strong>Atenção:</strong> Se você errar, perde imediatamente!</p>
                    
                    <div class="locations-grid">
                        ${locations.map(location => 
                            `<button class="location-guess-btn" onclick="makeSpyGuess('${location}')">${location}</button>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    } else {
        // Modal para não-espiões (apenas visual)
        modalContent = `
            <div id="spy-guess-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="spy-guessing-message">
                        🕵️ O espião está tentando adivinhar o local!
                    </div>
                    <h3>🎯 Locais Possíveis</h3>
                    <div class="locations-grid">
                        ${locations.map(location => 
                            `<button class="location-guess-btn" disabled>${location}</button>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Adicionar o modal ao body
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function makeSpyGuess(location) {
    console.log('Espião chutou:', location);
    socket.emit('spy-guess', { guess: location });
    closeSpyGuessModal();
}

function closeSpyGuessModal() {
    const modal = document.getElementById('spy-guess-modal');
    if (modal) {
        modal.remove();
    }
}

function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Cores baseadas no tipo
    switch(type) {
        case 'warning':
            notification.style.background = '#f59e0b';
            break;
        case 'error':
            notification.style.background = '#ef4444';
            break;
        default:
            notification.style.background = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remover após 4 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function getFirstQuestionDisplay(firstQuestionPlayerId, gameData = null) {
    // Tentar primeiro usar dados do jogo atual
    let playerName = null;
    
    if (gameData && gameData.playerOrder && gameData.firstQuestionPlayer) {
        // Usar dados do currentRoom se disponível
        const players = currentRoom?.players || [];
        const firstPlayer = players.find(p => p.id === firstQuestionPlayerId);
        playerName = firstPlayer?.name;
    }
    
    // Se não encontrou, tentar usar dados globais salvos
    if (!playerName && window.currentGameData && currentRoom?.players) {
        const firstPlayer = currentRoom.players.find(p => p.id === firstQuestionPlayerId);
        playerName = firstPlayer?.name;
    }
    
    // Fallback final
    if (!playerName) {
        playerName = 'Um Jogador';
    }
    
    const isMe = firstQuestionPlayerId === currentPlayer;
    
    if (isMe) {
        return `<div style="background: #10b981; color: white; padding: 10px 15px; border-radius: 8px; margin: 10px 0; text-align: center; font-weight: bold;">
            🎯 É SUA VEZ! Faça a primeira pergunta
        </div>`;
    } else {
        return `<div style="background: #3b82f6; color: white; padding: 10px 15px; border-radius: 8px; margin: 10px 0; text-align: center;">
            🎤 <strong>${playerName}</strong> fará a primeira pergunta
        </div>`;
    }
}

// Funções de cookie
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}





















