const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const freqEl = document.getElementById('freq-val');
const connectBtn = document.getElementById('connect-btn');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('instruction-overlay');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const vizCanvas = document.getElementById('visualizerCanvas');
const vizCtx = vizCanvas.getContext('2d');
const calibEl = document.getElementById('calibration-info');
const ageSelect = document.getElementById('age-select');
const promptTextEl = document.getElementById('prompt-text');
const practiceModeToggle = document.getElementById('practice-mode');
const sessionSummary = document.getElementById('session-summary');
const masteryListEl = document.getElementById('mastery-list');
const diagLog = document.getElementById('diagnostic-log');

function logDiag(msg) {
    if (!diagLog) return;
    diagLog.style.display = 'block';
    const div = document.createElement('div');
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    diagLog.appendChild(div);
    if (diagLog.childNodes.length > 20) diagLog.removeChild(diagLog.childNodes[1]);
    diagLog.scrollTop = diagLog.scrollHeight;
}

let practiceMode = false;
let sessionStats = {};

function resetSessionStats() {
    prompts.forEach(p => sessionStats[p.target] = 0);
}

const ageSettings = {
    toddler: { low: 20, med: 40, high: 60, mega: 80 },
    child: { low: 20, med: 40, high: 60, mega: 80 },
    adult: { low: 20, med: 40, high: 60, mega: 80 }
};

let currentAge = 'child';

const promptSets = {
    Vowels: [
        { text: "Say 'Ahhh' (Deep)", target: 'Small' },
        { text: "Say 'Moo' (Middle)", target: 'Medium' },
        { text: "Say 'Bee' (High)", target: 'Long' },
        { text: "Loud Shout! (Mega)", target: 'Mega' }
    ],
    Words: [
        { text: "Say 'Froggy' (Mid)", target: 'Medium' },
        { text: "Say 'Jump' (High)", target: 'Long' },
        { text: "Say 'Lily' (Small)", target: 'Small' }
    ]
};

let currentSet = 'Vowels';
let prompts = promptSets[currentSet];
let currentPromptIdx = 0;
let jumpsInCurrentPrompt = 0;

const rewards = {
    'Small': { unlocked: false, count: 5, name: 'Sprout', color: '#8BC34A' },
    'Medium': { unlocked: false, count: 5, name: 'Sun Hat', color: '#FFEB3B' },
    'Long': { unlocked: false, count: 10, name: 'Crown', color: '#FFD700' },
    'Mega': { unlocked: false, count: 3, name: 'Star Cap', color: '#E91E63' }
};

let activeHat = null;

function updatePrompt() {
    const prompt = prompts[currentPromptIdx];
    promptTextEl.innerText = prompt.text;
    promptTextEl.style.color = 'white';

    // Flash target zone
    calibEl.innerText = "Listen & Repeat";
    calibEl.style.color = "white";
    setTimeout(() => {
        calibEl.innerText = "Voice Optimized";
        calibEl.style.color = "var(--accent)";
    }, 2000);

    speak(prompt.text);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 1.2;
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// Audio Engine
let audioCtx;
let ambienceAudio;
let jumpSound;
let landSound;

function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        jumpSound = () => playSynthNote(440, 880, 0.1, 'square');
        landSound = () => playSynthNote(220, 110, 0.2, 'sine');
    } catch (e) {
        console.error('Audio initialization failed:', e);
    }
}

function startAmbience() {
    if (!audioCtx) return;
    try {
        const ambience = createPondAmbience();
        ambience.source.start(0);
        ambienceAudio = ambience;
    } catch (e) {
        console.error('Ambience start failed:', e);
    }
}

function createPondAmbience() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.05;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    return { source: noise, gain: gain };
}

function playSynthNote(startFreq, endFreq, duration, type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Game Physics & State
// NOTE: All frequency data is received EXCLUSIVELY via the Web Serial API from the Arduino.
// The browser's microphone (getUserMedia) is NOT used to avoid latency and interference.
let score = 0;
let gameActive = false;
let serialPort;
let reader;
let frog = { x: 100, y: 0, width: 60, height: 60, vy: 0, vx: 0, gravity: 0.6, isJumping: false };
let platforms = [];
const platformWidth = 130;
const platformHeight = 20;

function init() {
    resize();
    resetGame();
    animate();
}

function resize() {
    canvas.width = Math.max(canvas.offsetWidth, 800);
    canvas.height = Math.max(canvas.offsetHeight, 600);
    vizCanvas.width = 200;
    vizCanvas.height = 100;
    frog.y = canvas.height - 150;
}

function resetGame() {
    score = 0;
    scoreEl.innerText = score;
    frog.x = 100;
    frog.y = canvas.height - 150;
    frog.vy = 0;
    frog.vx = 0;
    platforms = [{ x: 50, y: canvas.height - 100, width: 200, visited: true }];
    for (let i = 0; i < 5; i++) {
        generatePlatform();
    }
}

function generatePlatform() {
    const last = platforms[platforms.length - 1];
    const minGap = 200 + Math.min(score * 5, 150);
    const newX = last.x + minGap + Math.random() * 150;
    const minY = canvas.height - 300;
    const maxY = canvas.height - 100;
    const newY = Math.max(minY, Math.min(maxY, last.y + (Math.random() - 0.5) * 150));
    platforms.push({ x: newX, y: newY, width: platformWidth, visited: false });
}

async function connectSerial() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 }); // High speed for better frequency sampling
        statusDot.classList.add('connected');
        statusText.innerText = 'Connected';
        connectBtn.style.display = 'none';
        serialPort.addEventListener('disconnect', () => handleDisconnect());

        // Initial Sync
        setTimeout(sendThresholds, 1000);

        readSerial();
    } catch (e) {
        console.error('Serial error:', e);
        statusText.innerText = 'Connection Failed';
    }
}

async function sendThresholds() {
    if (!serialPort || !serialPort.writable) return;
    const settings = ageSettings[currentAge];
    const msg = `T:${settings.low},${settings.med},${settings.high},${settings.mega}\n`;
    const encoder = new TextEncoder();
    const writer = serialPort.writable.getWriter();
    await writer.write(encoder.encode(msg));
    writer.releaseLock();
}

function handleDisconnect() {
    serialPort = null;
    statusDot.classList.remove('connected');
    statusText.innerText = 'Disconnected';
    connectBtn.style.display = 'block';
    gameActive = false;
    overlay.style.display = 'flex';
    overlay.querySelector('h2').innerText = 'Hardware Disconnected';
}

async function readSerial() {
    try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();
        let buffer = '';
        while (serialPort && serialPort.readable) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                const cleanLine = line.trim();
                // Check for crossings/frequency data from Arduino
                if (cleanLine.startsWith('FREQ:')) {
                    const freqValue = parseFloat(cleanLine.split(':')[1]);
                    if (!isNaN(freqValue)) {
                        freqEl.innerText = Math.round(freqValue);
                        handleJump(freqValue);
                        updateVisualizer(freqValue);
                    }
                } else if (cleanLine.startsWith('PTP:')) {
                    const ptpValue = cleanLine.split(':')[1];
                    console.log(`Hardware Signal Strength (PTP): ${ptpValue}`);
                    if (parseInt(ptpValue) < 5) logDiag("Weak Signal: Check Mic");
                } else if (cleanLine.startsWith('INFO:')) {
                    logDiag(cleanLine);
                } else if (cleanLine.length > 0) {
                    logDiag(`RAW: ${cleanLine}`);
                }
            }
        }
    } catch (e) {
        if (serialPort) handleDisconnect();
    }
}

let freqHistory = new Array(20).fill(0);
let calibrationFrames = 0;
let minFreq = 20; // 200 Hz
let maxFreq = 80; // 800 Hz

function updateVisualizer(freq) {
    if (calibrationFrames < 50) {
        calibrationFrames++;
        if (freq > 0) {
            minFreq = Math.min(minFreq, freq);
            maxFreq = Math.max(maxFreq, freq);
        }
        calibEl.innerText = `Calibrating: ${Math.round((calibrationFrames / 50) * 100)}%`;
    } else {
        calibEl.innerText = 'Voice Optimized';
    }

    freqHistory.push(freq);
    freqHistory.shift();

    vizCtx.stroke();

    // Draw Target Zone for current prompt
    const settings = ageSettings[currentAge];
    const target = prompts[currentPromptIdx].target;
    let targetVal = 0;
    if (target === 'Small') targetVal = (settings.low + settings.med) / 2;
    if (target === 'Medium') targetVal = (settings.med + settings.high) / 2;
    if (target === 'Long') targetVal = (settings.high + settings.mega) / 2;
    if (target === 'Mega') targetVal = settings.mega + 10;

    const targetY = vizCanvas.height - (targetVal / 100) * vizCanvas.height;
    vizCtx.setLineDash([5, 5]);
    vizCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    vizCtx.beginPath();
    vizCtx.moveTo(0, targetY);
    vizCtx.lineTo(vizCanvas.width, targetY);
    vizCtx.stroke();
    vizCtx.setLineDash([]);
}

function handleJump(freq) {
    // Lowered floor to 5 to be extremely sensitive for debugging
    if (!gameActive || frog.isJumping || freq < 5) return;
    executeJump(freq);
}

function executeJump(freq) {
    freqEl.innerText = Math.round(freq);
    if (jumpSound) jumpSound();
    frog.isJumping = true;

    const settings = ageSettings[currentAge];

    if (freq < settings.low) return; // Noise floor

    if (freq < settings.med) {
        frog.vy = -12;
        frog.vx = 8;
        frog.jumpType = "Small";
    } else if (freq < settings.high) {
        frog.vy = -15;
        frog.vx = 12;
        frog.jumpType = "Medium";
    } else if (freq < settings.mega) {
        frog.vy = -18;
        frog.vx = 16;
        frog.jumpType = "Long";
    } else {
        frog.vy = -22;
        frog.vx = 22;
        frog.jumpType = "Mega";
    }

    // Reinforcement Logic
    if (frog.jumpType === prompts[currentPromptIdx].target) {
        promptTextEl.innerText = "Great Job!";
        promptTextEl.style.color = '#4CAF50';
        jumpsInCurrentPrompt++;
        sessionStats[frog.jumpType]++;

        // Check for Rewards
        const reward = rewards[frog.jumpType];
        if (reward && !reward.unlocked && sessionStats[frog.jumpType] >= reward.count) {
            reward.unlocked = true;
            activeHat = reward;
            speak(`You unlocked the ${reward.name}!`);
        }

        // Visual Feedback: Change frog eye color
        frog.eyeColor = '#4CAF50';
        setTimeout(() => frog.eyeColor = 'white', 1000);

        if (jumpsInCurrentPrompt >= 2) {
            jumpsInCurrentPrompt = 0;
            currentPromptIdx = (currentPromptIdx + 1) % prompts.length;
            setTimeout(updatePrompt, 1500);
        }
    }
}

let ripples = [];
let particles = [];
let stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * 2000,
    y: Math.random() * 600,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 0.5 + 0.2
}));

function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color
        });
    }
}

function update() {
    if (!gameActive) return;
    frog.vy += frog.gravity;
    frog.y += frog.vy;
    frog.x += frog.vx;
    frog.vx *= 0.985;
    if (Math.abs(frog.vx) < 0.1) frog.vx = 0;

    if (frog.x > canvas.width / 2) {
        const diff = frog.x - canvas.width / 2;
        frog.x = canvas.width / 2;
        platforms.forEach(p => p.x -= diff);
        ripples.forEach(r => r.x -= diff);
        particles.forEach(p => p.x -= diff);
        stars.forEach(s => s.x -= diff * s.speed);
    }

    stars.forEach(s => {
        if (s.x < -100) s.x = canvas.width + 100;
        if (s.x > canvas.width + 100) s.x = -100;
    });

    ripples = ripples.filter(r => r.alpha > 0);
    ripples.forEach(r => { r.radius += 2; r.alpha -= 0.02; });

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity for particles
        p.life -= 0.02;
    });
    particles = particles.filter(p => p.life > 0);

    platforms.forEach(p => {
        if (frog.vy > 0 && frog.x + frog.width > p.x && frog.x < p.x + p.width &&
            frog.y + frog.height > p.y && frog.y + frog.height < p.y + platformHeight + frog.vy) {
            if (frog.isJumping) {
                ripples.push({ x: p.x + p.width / 2, y: p.y, radius: 10, alpha: 1 });
                spawnParticles(p.x + p.width / 2, p.y, '#FFC107');
                if (landSound) landSound();
            }
            frog.y = p.y - frog.height;
            frog.vy = 0; frog.vx = 0; frog.isJumping = false;
            if (!p.visited) {
                p.visited = true; score++; scoreEl.innerText = score; generatePlatform();
                const high = localStorage.getItem('frogScore') || 0;
                if (score > high) localStorage.setItem('frogScore', score);
            }
        }
    });

    if (frog.y > canvas.height) {
        if (practiceMode) {
            frog.y = -50; // Respawn above
            frog.vy = 0;
            frog.x = platforms[0].x + 20;
        } else {
            showGameOver();
        }
    }
}

function showGameOver() {
    gameActive = false;
    overlay.style.display = 'flex';
    document.getElementById('overlay-title').innerText = 'Session Finished!';
    document.getElementById('overlay-msg').style.display = 'none';
    sessionSummary.style.display = 'block';

    masteryListEl.innerHTML = '';
    Object.keys(sessionStats).forEach(key => {
        const item = document.createElement('div');
        item.className = 'mastery-item';
        item.innerHTML = `${key} Jumps <span class="mastery-count">${sessionStats[key]}</span>`;
        masteryListEl.appendChild(item);
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Stars/Bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    const grad = ctx.createLinearGradient(0, canvas.height - 200, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0, 210, 255, 0.2)');
    grad.addColorStop(1, 'rgba(26, 42, 108, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height - 200, canvas.width, 200);

    ripples.forEach(r => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    });

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    platforms.forEach(p => {
        const cx = p.x + p.width / 2; const cy = p.y;
        ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.ellipse(cx, cy + 5, p.width / 2, p.width * 0.2, 0, 0, Math.PI * 1.8); ctx.lineTo(cx, cy + 5); ctx.fill();
        ctx.fillStyle = '#F06292';
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 15, cy - 10 + Math.sin(a) * 5, 12, 6, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(cx, cy - 10, 8, 0, Math.PI * 2); ctx.fill();
    });

    const fx = frog.x + frog.width / 2; const fy = frog.y + frog.height / 2;

    // Draw Hat if unlocked
    if (activeHat) {
        ctx.fillStyle = activeHat.color;
        ctx.beginPath();
        ctx.moveTo(fx - 20, fy - 15);
        ctx.lineTo(fx + 20, fy - 15);
        ctx.lineTo(fx, fy - 35);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.ellipse(fx, fy + 5, 25, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.arc(fx - 12, fy - 10, 10, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 10, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = frog.eyeColor || 'white'; ctx.beginPath(); ctx.arc(fx - 12, fy - 12, 6, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 12, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(fx - 12, fy - 13, 3, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 13, 3, 0, Math.PI * 2); ctx.fill();
}

function animate() { isAnimating = true; update(); draw(); requestAnimationFrame(animate); }
connectBtn.addEventListener('click', connectSerial);
startBtn.addEventListener('click', () => {
    gameActive = true;
    overlay.style.display = 'none';
    sessionSummary.style.display = 'none';
    document.getElementById('overlay-msg').style.display = 'block';
    resetGame();
    resetSessionStats();
    initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startAmbience();
    updatePrompt();
});
practiceModeToggle.addEventListener('change', (e) => {
    practiceMode = e.target.checked;
});
window.addEventListener('resize', resize);
window.addEventListener('load', () => { if (!isAnimating) init(); });
