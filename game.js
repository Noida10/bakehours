// Game State
let gameState = {
    currentPlayer: 1,
    scores: { player1: 0, player2: 0 },
    targetLetter: '',
    winningScore: 10,
    isGameActive: true,
    shuffleTimer: null,
    canInteract: true
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Audio Context for sound generation
let audioContext = null;

// Initialize Audio Context
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play sound for a letter with unique frequency
function playLetterSound(letter, isCorrect = null) {
    initAudio();

    // Resume audio context if it's suspended (browser policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Calculate frequency based on letter position (A=0, Z=25)
    const letterIndex = letter.charCodeAt(0) - 65;

    if (isCorrect === true) {
        // Success sound - happy chord
        const baseFreq = 523.25; // C5
        oscillator.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
    } else if (isCorrect === false) {
        // Wrong answer sound
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } else {
        // Letter sound - each letter has a unique frequency
        // Map A-Z to musical scale (200Hz to 800Hz range)
        const baseFrequency = 200;
        const frequency = baseFrequency + (letterIndex * 25);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

// DOM Elements
const targetLetterEl = document.getElementById('target-letter');
const letterOptionsEl = document.getElementById('letter-options');
const player1ScoreEl = document.getElementById('player1-score');
const player2ScoreEl = document.getElementById('player2-score');
const turnIndicatorEl = document.getElementById('turn-indicator');
const feedbackEl = document.getElementById('feedback');
const newGameBtn = document.getElementById('new-game-btn');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

// Initialize Game
function initGame() {
    gameState = {
        currentPlayer: 1,
        scores: { player1: 0, player2: 0 },
        targetLetter: '',
        winningScore: 10,
        isGameActive: true,
        shuffleTimer: null,
        canInteract: true
    };

    // Clear any existing shuffle timer
    if (gameState.shuffleTimer) {
        clearInterval(gameState.shuffleTimer);
    }

    updateScores();
    updateTurnIndicator();
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    nextRound();
}

// Generate a random letter
function getRandomLetter() {
    return alphabet[Math.floor(Math.random() * alphabet.length)];
}

// Shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Create next round
function nextRound() {
    if (!gameState.isGameActive) return;

    // Clear any existing shuffle timer
    if (gameState.shuffleTimer) {
        clearInterval(gameState.shuffleTimer);
    }

    gameState.canInteract = true;

    // Clear feedback after a short delay
    setTimeout(() => {
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
    }, 500);

    // Generate new target letter
    gameState.targetLetter = getRandomLetter();
    targetLetterEl.textContent = gameState.targetLetter;

    // Play sound for target letter
    setTimeout(() => playLetterSound(gameState.targetLetter), 100);

    // Animate target letter
    targetLetterEl.style.animation = 'none';
    setTimeout(() => {
        targetLetterEl.style.animation = 'bounce 1s ease-in-out';
    }, 10);

    // Display all 26 letters (shuffled)
    const shuffledAlphabet = shuffleArray(alphabet);
    renderLetterOptions(shuffledAlphabet);

    // Start auto-shuffle timer (every 3 seconds)
    gameState.shuffleTimer = setInterval(() => {
        if (gameState.isGameActive && gameState.canInteract) {
            shuffleLetterOptions();
        }
    }, 3000);
}

// Shuffle the displayed letter options
function shuffleLetterOptions() {
    letterOptionsEl.classList.add('shuffling');

    setTimeout(() => {
        const shuffledAlphabet = shuffleArray(alphabet);
        renderLetterOptions(shuffledAlphabet);
        letterOptionsEl.classList.remove('shuffling');
    }, 250);
}

// Render letter option buttons
function renderLetterOptions(letters) {
    letterOptionsEl.innerHTML = '';

    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;
        btn.dataset.letter = letter;
        btn.addEventListener('click', () => handleLetterClick(letter, btn));

        // Add hover sound effect
        btn.addEventListener('mouseenter', () => {
            if (gameState.canInteract) {
                playLetterSound(letter);
            }
        });

        letterOptionsEl.appendChild(btn);
    });
}

// Handle letter selection (from click or keyboard)
function handleLetterClick(letter, btnElement) {
    if (!gameState.isGameActive || !gameState.canInteract) return;

    gameState.canInteract = false;

    // Clear shuffle timer
    if (gameState.shuffleTimer) {
        clearInterval(gameState.shuffleTimer);
    }

    // Disable all buttons temporarily
    const allButtons = document.querySelectorAll('.letter-btn');
    allButtons.forEach(btn => btn.style.pointerEvents = 'none');

    if (letter === gameState.targetLetter) {
        // Correct answer!
        btnElement.classList.add('correct');
        playLetterSound(letter, true);
        showFeedback('Awesome! 🎉', 'correct');

        // Add point to current player
        const playerKey = `player${gameState.currentPlayer}`;
        gameState.scores[playerKey]++;
        updateScores();

        // Check for winner
        if (gameState.scores[playerKey] >= gameState.winningScore) {
            setTimeout(() => announceWinner(), 1000);
        } else {
            // Switch player
            switchPlayer();
            setTimeout(() => {
                nextRound();
                allButtons.forEach(btn => btn.style.pointerEvents = 'auto');
            }, 1500);
        }
    } else {
        // Wrong answer
        btnElement.classList.add('wrong');
        playLetterSound(letter, false);
        showFeedback('Oops! Try again! 💪', 'wrong');

        // Switch player (miss your turn if wrong)
        switchPlayer();
        setTimeout(() => {
            nextRound();
            allButtons.forEach(btn => btn.style.pointerEvents = 'auto');
        }, 1500);
    }
}

// Show feedback message
function showFeedback(message, type) {
    feedbackEl.textContent = message;
    feedbackEl.className = `feedback ${type}`;
}

// Switch to next player
function switchPlayer() {
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    updateTurnIndicator();
}

// Update turn indicator
function updateTurnIndicator() {
    const player1Card = document.querySelector('.player1-card');
    const player2Card = document.querySelector('.player2-card');

    if (gameState.currentPlayer === 1) {
        turnIndicatorEl.textContent = '🌟 Player 1\'s Turn! 🌟';
        turnIndicatorEl.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        turnIndicatorEl.style.color = 'white';
        player1Card.classList.add('active');
        player2Card.classList.remove('active');
    } else {
        turnIndicatorEl.textContent = '⭐ Player 2\'s Turn! ⭐';
        turnIndicatorEl.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        turnIndicatorEl.style.color = 'white';
        player2Card.classList.add('active');
        player1Card.classList.remove('active');
    }
}

// Update score display
function updateScores() {
    player1ScoreEl.textContent = `Score: ${gameState.scores.player1}`;
    player2ScoreEl.textContent = `Score: ${gameState.scores.player2}`;
}

// Announce winner
function announceWinner() {
    gameState.isGameActive = false;

    // Clear shuffle timer
    if (gameState.shuffleTimer) {
        clearInterval(gameState.shuffleTimer);
    }

    const winner = gameState.currentPlayer;

    feedbackEl.innerHTML = `
        <div class="winner-announcement">
            🏆 Player ${winner} Wins! 🏆<br>
            <span style="font-size: 1.5rem;">Amazing job! 🎉</span>
        </div>
    `;
    feedbackEl.className = 'feedback correct';

    // Hide letter options
    letterOptionsEl.innerHTML = '<p style="font-size: 1.5rem; text-align: center; padding: 40px; color: #667eea;">Click "New Game" to play again!</p>';
}

// Keyboard input handling
function handleKeyPress(event) {
    if (!gameState.isGameActive || !gameState.canInteract) return;

    const key = event.key.toUpperCase();

    // Check if it's a valid letter (A-Z)
    if (key.length === 1 && key >= 'A' && key <= 'Z') {
        // Find the button for this letter
        const btn = document.querySelector(`.letter-btn[data-letter="${key}"]`);

        if (btn) {
            // Highlight the button briefly
            btn.classList.add('keyboard-highlight');
            setTimeout(() => btn.classList.remove('keyboard-highlight'), 200);

            // Trigger the letter click
            handleLetterClick(key, btn);
        }
    }
}

// Event Listeners
newGameBtn.addEventListener('click', initGame);

helpBtn.addEventListener('click', () => {
    helpModal.classList.add('show');
});

closeModalBtn.addEventListener('click', () => {
    helpModal.classList.remove('show');
});

helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.remove('show');
    }
});

// Keyboard event listener
document.addEventListener('keydown', handleKeyPress);

// Initialize audio context on first user interaction
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

// Start the game when page loads
window.addEventListener('load', initGame);
