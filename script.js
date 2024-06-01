// Configuración de Firebase
var firebaseConfig = {
    apiKey: "AIzaSyCy_wVXTYulJj-nRqWZv-h4mR3DbJjfTjg",
    authDomain: "blanco-e8ad6.firebaseapp.com",
    databaseURL: "https://blanco-e8ad6-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "blanco-e8ad6",
    storageBucket: "blanco-e8ad6.appspot.com",
    messagingSenderId: "845788160191",
    appId: "1:845788160191:web:05354fd6e3a55cdd84660a"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const playersRef = db.ref('players');
const gameRef = db.ref('game');

let playerId = null;
let playerCount = 0;

document.getElementById('ready-button').addEventListener('click', () => {
    const playerNameInput = document.getElementById('player-name');
    const playerName = playerNameInput.value.trim();

    if (!playerName) {
        alert('Por favor, ingresa tu nombre antes de continuar.');
        return;
    }

    if (!playerId) {
        checkAndSetPlayerId(playerName);
    }

    playerNameInput.setAttribute('disabled', 'true');
});

function checkAndSetPlayerId(playerName) {
    playersRef.orderByChild('name').equalTo(playerName).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const suffix = snapshot.numChildren();
            playerId = `${playerName}_${suffix}`;
        } else {
            playerId = playerName;
        }
        playersRef.child(playerId).set({ name: playerName, ready: true, isOut: false });
        // Configurar oyente para mostrar el rol en tiempo real
        displayPlayerRole();
    });
}

playersRef.on('value', (snapshot) => {
    playerCount = snapshot.numChildren();
    document.getElementById('player-count').innerText = `Jugadores: ${playerCount}`;
});

document.getElementById('start-game-button').addEventListener('click', () => {
    if (playerCount > 2) {
        startGame();
    } else {
        alert('Se necesitan al menos 3 jugadores para comenzar la partida.');
    }
});

document.getElementById('reset-game-button').addEventListener('click', () => {
    resetGame();
});

function startGame() {
    // Usar la API de Random Word para obtener una palabra aleatoria
    fetch('https://random-word-api.herokuapp.com/word?lang=es')
      .then(response => response.json())
      .then(data => {
        const theme = data[0];

        playersRef.once('value', (snapshot) => {
            const players = [];
            snapshot.forEach(childSnapshot => {
                players.push({ id: childSnapshot.key, data: childSnapshot.val() });
            });

            const blankPlayerId = players[Math.floor(Math.random() * players.length)].id;

            players.forEach(player => {
                const role = player.id === blankPlayerId ? 'blanco' : theme;
                playersRef.child(player.id).update({ role: role });
            });

            gameRef.set({ status: 'started', blank: blankPlayerId, endTime: Date.now() + 500 });
        });
      })
      .catch(error => console.error('Error al obtener palabra aleatoria:', error));
}


function displayPlayerRole() {
    playersRef.child(playerId).child('role').on('value', (snapshot) => {
        const role = snapshot.val();
        const playerInfo = document.getElementById('player-info');
        playerInfo.innerText = `Tu tema: ${role === 'blanco' ? 'Blanco' : role}`;
    });
}

gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (gameData && gameData.status === 'started') {
        document.getElementById('game-status').innerText = 'La partida ha comenzado. Hable sobre el tema sin decirlo explícitamente.';
        setTimeout(initiateVoting, gameData.endTime - Date.now());
    }
});

function initiateVoting() {
    document.getElementById('game-status').innerHTML = `
        La conversación ha terminado. Vota quién crees que es el blanco:
        <div id="voting-area"></div>
    `;
    playersRef.once('value', (snapshot) => {
        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            const button = document.createElement('button');
            button.innerText = `${player.name}`;
            button.addEventListener('click', () => {
                vote(childSnapshot.key);
            });
            document.getElementById('voting-area').appendChild(button);
        });
    });
}

function vote(votedPlayerId) {
    const playerRef = playersRef.child(votedPlayerId);

    playerRef.transaction(player => {
        if (player) {
            if (!player.votes) {
                player.votes = 1;
            } else {
                player.votes++;
            }
        }
        return player;
    }).then(() => {
        checkVotes();
    });
}

function checkVotes() {
    playersRef.once('value', (snapshot) => {
        const totalPlayers = snapshot.numChildren();
        let totalVotes = 0;

        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            if (player.votes) {
                totalVotes += player.votes;
            }
        });

        if (totalVotes === totalPlayers) {
            determineOutcome();
        } else {
            document.getElementById('game-status').innerHTML = '<div>Esperando votos de jugadores...</div>';
        }
    });
}

function determineOutcome() {
    playersRef.once('value', (snapshot) => {
        let maxVotes = 0;
        let votedOutPlayer = null;
        let tie = false;
        const players = [];

        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            players.push({ id: childSnapshot.key, role: player.role, votes: player.votes || 0 });
        });

        players.forEach(player => {
            if (player.votes > maxVotes) {
                maxVotes = player.votes;
                votedOutPlayer = player;
                tie = false;
            } else if (player.votes === maxVotes) {
                tie = true;
            }
        });

        if (tie) {
            updateGameStatus('Hubo un empate. Nadie es expulsado.');
        } else if (votedOutPlayer) {
            const { id, role } = votedOutPlayer;
            playersRef.child(id).update({ isOut: true }).then(() => {
                updateGameStatus(`El jugador ${id} ha sido expulsado. ${role === 'blanco' ? 'Era el blanco.' : 'No era el blanco.'}`);
            });
        }
    });
}


function updateGameStatus(statusMessage) {
    gameRef.update({ status: statusMessage }).then(() => {
        displayGameStatus();
    });
}

function displayGameStatus() {
    gameRef.child('status').on('value', (snapshot) => {
        const statusMessage = snapshot.val();
        if (statusMessage) {
            document.getElementById('game-status').innerText = statusMessage;
        }
    });
}

// Llamar a displayGameStatus una vez al cargar la página para asegurarse de que todos vean el estado actual
displayGameStatus();

function resetGame() {
    playersRef.remove();
    gameRef.remove();
    document.getElementById('player-count').innerText = 'Jugadores: 0';
    document.getElementById('game-status').innerText = '';
    document.getElementById('voting-area').innerHTML = '';
    document.getElementById('player-info').innerHTML = ''; // Limpiar la información del jugador
    playerId = null;
    playerCount = 0;
}
