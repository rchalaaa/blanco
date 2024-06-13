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
let countdownTimer;

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
    // **Reiniciar valores de los jugadores**
    playersRef.once('value', (snapshot) => {
        snapshot.forEach(childSnapshot => {
            playersRef.child(childSnapshot.key).update({ isOut: false, votes: 0 });
        });

        // **Obtener palabra aleatoria y asignar roles**
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
                        Array(clownsCount).fill(`Payaso / ${theme}`),
                        Array(blanksCount).fill('Blanco')
                    );

                    playersRef.once('value', (snapshot) => {
                        const players = [];
                        snapshot.forEach(childSnapshot => {
                            players.push({ id: childSnapshot.key, data: childSnapshot.val() });
                        });

                        roles.sort(() => Math.random() - 0.5); // Mezclar roles

                        players.forEach((player, index) => {
                            playersRef.child(player.id).update({ role: roles[index] }); 
                        });

                        const newEndTime = Date.now() + 90000;
                        gameRef.update({ status: 'started', messages: `La partida ha comenzado. Habla sobre el tema`, endTime: newEndTime });

                        // Notificar a todos los jugadores para que reinicien su temporizador
                        gameRef.child('endTime').set(newEndTime);
                    });
                });
            })
            .catch(error => console.error('Error al obtener palabra aleatoria del archivo JSON:', error));
    });
}


function displayPlayerRole() {
    playersRef.child(playerId).child('role').on('value', (snapshot) => {
      const role = snapshot.val();
      const playerInfoElement = document.getElementById('player-info');
      
      if (role === 'Blanco') {
        playerInfoElement.innerText = 'Blanco';
        playerInfoElement.classList.add('blanco');
      } else {
        playerInfoElement.innerText = role;
        playerInfoElement.classList.remove('blanco');
      }
    });
  }

gameRef.child('status').on('value', (snapshot) => {
    const status = snapshot.val();
    if (status) {
        updateFrontend(status);
    }
});

gameRef.child('messages').on('value', (snapshot) => {
    const message = snapshot.val();
    if (message) {
        document.getElementById('game-status').innerText = message;
    }
});

gameRef.child('endTime').on('value', (snapshot) => {
    const endTime = snapshot.val();
    if (endTime) {
        clearInterval(countdownTimer);
        startCountdown(endTime);
    }
});

function updateFrontend(status) {
    clearInterval(countdownTimer); // Clear any existing timers

    if (status === 'started' || status === 'continue') {
        document.getElementById('game-info').style.display = 'block';
        document.getElementById('voting-area').style.display = 'none';
        document.getElementById('timer').style.display = 'block';
    } else if (status === 'voting') {
        document.getElementById('game-info').style.display = 'block';
        document.getElementById('voting-area').style.display = 'flex';
        document.getElementById('timer').style.display = 'none';
        initiateVoting();
    } else if (status === 'reset') {
        document.getElementById('game-info').style.display = 'none';
        document.getElementById('voting-area').style.display = 'none';
        document.getElementById('timer').style.display = 'none';
    }
}

function startCountdown(endTime) {
    countdownTimer = setInterval(() => {
        const now = Date.now();
        const remainingTime = endTime - now;

        if (remainingTime <= 0) {
            clearInterval(countdownTimer);
            gameRef.update({ status: 'voting', messages: 'La conversación ha terminado. Vota quién crees que es el Blanco:' });
        } else {
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            
            document.getElementById('timer').innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    }, 1000);
}

function initiateVoting() {
    document.getElementById('game-status').innerText = 'Han empezado las votaciones';
    playersRef.once('value', (snapshot) => {
        document.getElementById('voting-area').innerHTML = ''; // Clear previous buttons

        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            if (!player.isOut) {
                const button = document.createElement('button');
                button.innerText = `${player.name}`;
                button.addEventListener('click', () => {
                    vote(childSnapshot.key);
                });
                document.getElementById('voting-area').appendChild(button);
            }
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
        document.getElementById('game-status').innerText = 'Esperando votos...';
        document.getElementById('voting-area').style.display = 'none';
    });
}

function checkVotes() {
    playersRef.once('value', (snapshot) => {
        let activePlayers = 0;

        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            if (!player.isOut) {
                activePlayers++;
            }
        });

        let totalVotes = 0;

        snapshot.forEach(childSnapshot => {
            const player = childSnapshot.val();
            if (player.votes) {
                totalVotes += player.votes;
            }
        });

        if (totalVotes === activePlayers) {
            determineOutcome();
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
            gameRef.update({ messages: 'Hubo un empate. Nadie es expulsado.' });
        } else if (votedOutPlayer) {
            const { id, role } = votedOutPlayer;
            playersRef.child(id).update({ isOut: true }).then(() => {
                if (role === 'Blanco') {
                    gameRef.update({ messages: `${id} ha sido expulsado. Era el BLANCO.`, endTime: ""  });
                } else if (role === 'Payaso') {
                    gameRef.update({ messages: `${id} ha sido expulsado. Era el PAYASO 🤡 y ha ganado.`, endTime: "" });
                } else {
                    gameRef.update({ messages: `${id} ha sido expulsado y TENÍA TEMA. Continúa el juego.`, status: 'continue' });
                    playersRef.once('value', (snapshot) => {
                        snapshot.forEach(childSnapshot => {
                            playersRef.child(childSnapshot.key).update({ votes: 0 });
                        });
                    });
                }
            });
        }
    });
}

function resetGame() {
    clearInterval(countdownTimer); // Clear any existing timers

    gameRef.update({ status: 'reset', clowns: 0, blanks: 1, messages: '', endTime: ''});
    playersRef.remove();

    document.getElementById('player-name').removeAttribute('disabled');
    document.getElementById('player-info').innerText = '';
    document.getElementById('game-status').innerText = '';
    document.getElementById('timer').innerHTML = '';
    document.getElementById('voting-area').innerHTML = '';
    document.getElementById('player-count').innerText = '0';
}

const clownsSelect = document.getElementById('clowns');
const blanksSelect = document.getElementById('blanks');

clownsSelect.addEventListener('change', (event) => {
    gameRef.update({ clowns: event.target.value });
});

blanksSelect.addEventListener('change', (event) => {
    gameRef.update({ blanks: event.target.value });
});

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
