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
        console.log(playerId)
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
        displayPlayerRole();
    });
}

playersRef.on('value', (snapshot) => {
    playerCount = snapshot.numChildren();
    document.getElementById('player-count').innerText = `${playerCount}`;
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
    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            const words = data.words;
            const randomIndex = Math.floor(Math.random() * words.length);
            const theme = words[randomIndex];

            gameRef.once('value', (snapshot) => {
                const gameData = snapshot.val();
                const clownsCount = parseInt(gameData.clowns, 10);
                const blanksCount = parseInt(gameData.blanks, 10);
                const roles = Array(playerCount - clownsCount - blanksCount).fill(theme).concat(
                    Array(clownsCount).fill('Payaso'),
                    Array(blanksCount).fill('Blanco')
                );

                playersRef.once('value', (snapshot) => {
                    const players = [];
                    snapshot.forEach(childSnapshot => {
                        players.push({ id: childSnapshot.key, data: childSnapshot.val() });
                    });

                    roles.sort(() => Math.random() - 0.5); // Mezclar roles

                    players.forEach((player, index) => {
                        playersRef.child(player.id).update({ role: roles[index], votes: 0 }); // Reiniciar votos a 0
                    });

                    gameRef.update({ status: 'started', endTime: Date.now() + 500 });
                });
            });
        })
        .catch(error => console.error('Error al obtener palabra aleatoria del archivo JSON:', error));
}
function displayPlayerRole() {
    playersRef.child(playerId).child('role').on('value', (snapshot) => {
        const role = snapshot.val();
        const playerInfo = document.getElementById('player-info');
        playerInfo.innerText = `${role === 'Blanco' ? 'Blanco' : role}`;
    });
}

gameRef.child('status').on('value', (snapshot) => {
    const statusMessage = snapshot.val();
    if (statusMessage) {
        document.getElementById('game-status').innerText = statusMessage;
        if (statusMessage === 'reset') {
            document.getElementById('game-info').style.display = 'none';
        } else {
            document.getElementById('game-info').style.display = 'block';
        }
    }
});

gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (gameData && gameData.status === 'started') {
        document.getElementById('game-status').innerText = 'La partida ha comenzado. Habla sobre el tema sin decirlo explícitamente.';
        setTimeout(initiateVoting, gameData.endTime - Date.now());

        // Cambiar display de game-info a block
        document.getElementById('game-info').style.display = 'block';
       
    }
});

function initiateVoting() {
    document.getElementById('game-status').innerHTML = `
        La conversación ha terminado. Vota quién crees que es el Blanco:
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
                if (role === 'Blanco') {
                    updateGameStatus(`${id} ha sido expulsado. Era el Blanco.`);
                } else if (role === 'Payaso') {
                    updateGameStatus(`${id} ha sido expulsado. Era el payaso y ha ganado la partida.`);
                } else {
                    updateGameStatus(`${id} ha sido expulsado. Tenía tema.`);
                }
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

displayGameStatus();

function resetGame() {
    playersRef.remove();
    gameRef.remove().then(() => {
        // Después de borrar el gameRef, establecer valores por defecto de clowns, blanks y reset
        gameRef.set({ clowns: 0, blanks: 1, status:'reset' });
    });
    document.getElementById('player-count').innerText = '0';
    document.getElementById('game-status').innerText = '';
    document.getElementById('voting-area').innerHTML = '';
    document.getElementById('player-info').innerHTML = ''; 
    playerId = null;
    playerCount = 0;
}

// Actualización en tiempo real de clowns y blanks
const clownsSelect = document.getElementById('clowns');
const blanksSelect = document.getElementById('blanks');

clownsSelect.addEventListener('change', (event) => {
    gameRef.update({ clowns: event.target.value });
});

blanksSelect.addEventListener('change', (event) => {
    gameRef.update({ blanks: event.target.value });
});

// Inicializar valores de clowns y blanks en el frontend
gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (gameData) {
        if (gameData.clowns !== undefined) {
            clownsSelect.value = gameData.clowns;
        }
        if (gameData.blanks !== undefined) {
            blanksSelect.value = gameData.blanks;
        }
    }
});
