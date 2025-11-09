// Game State
let gameState = {
    currentPlayer: 1,
    scores: { player1: 0, player2: 0 },
    targetLetter: '',
    winningScore: 10,
    isGameActive: true
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
        isGameActive: true
    };
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

// Get random letters for options (including the target)
function getLetterOptions(targetLetter, count = 6) {
    const options = new Set([targetLetter]);

    while (options.size < count) {
        options.add(getRandomLetter());
    }

    // Convert to array and shuffle
    return Array.from(options).sort(() => Math.random() - 0.5);
}

// Create next round
function nextRound() {
    if (!gameState.isGameActive) return;

    // Clear feedback after a short delay
    setTimeout(() => {
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
    }, 500);

    // Generate new target letter
    gameState.targetLetter = getRandomLetter();
    targetLetterEl.textContent = gameState.targetLetter;

    // Animate target letter
    targetLetterEl.style.animation = 'none';
    setTimeout(() => {
        targetLetterEl.style.animation = 'bounce 1s ease-in-out';
    }, 10);

    // Generate options
    const options = getLetterOptions(gameState.targetLetter);
    renderLetterOptions(options);
}

// Render letter option buttons
function renderLetterOptions(letters) {
    letterOptionsEl.innerHTML = '';

    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;
        btn.addEventListener('click', () => handleLetterClick(letter, btn));
        letterOptionsEl.appendChild(btn);
    });
}

// Handle letter button click
function handleLetterClick(letter, btnElement) {
    if (!gameState.isGameActive) return;

    // Disable all buttons temporarily
    const allButtons = document.querySelectorAll('.letter-btn');
    allButtons.forEach(btn => btn.style.pointerEvents = 'none');

    if (letter === gameState.targetLetter) {
        // Correct answer!
        btnElement.classList.add('correct');
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

// Start the game when page loads
window.addEventListener('load', initGame);
