document.addEventListener('DOMContentLoaded', function() {
    const createRoomForm = document.getElementById('create-room-form');
    const joinRoomForm = document.getElementById('join-room-form');

    createRoomForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const playerName = document.getElementById('player-name').value;
        const timeLimit = parseInt(document.getElementById('time-limit').value);
	const locationsCount = parseInt(document.getElementById('locations-count').value); // ADICIONAR	

        try {
            const response = await fetch('/create-room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ playerName, timeLimit, locationsCount })
            });

            const data = await response.json();
            
            if (data.success) {
                // Salvar informações nos cookies
                setCookie('playerId', data.playerId, 1);
                setCookie('playerCode', data.playerCode, 1);
                setCookie('playerName', playerName, 1);
                
                // Redirecionar para a sala
                window.location.href = `/room/${data.roomCode}`;
            } else {
                alert('Erro: ' + (data.message || 'Erro ao criar sala'));
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao criar sala');
        }
    });

    joinRoomForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const playerName = document.getElementById('join-name').value;
        const roomCode = document.getElementById('room-code').value.toUpperCase();

        // Salvar nome nos cookies
        setCookie('playerName', playerName, 1);
        
        // Redirecionar para a sala
        window.location.href = `/room/${roomCode}`;
    });
});

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