const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const freqEl = document.getElementById('freq-val');
const micBtn = document.getElementById('mic-btn');
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
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValEl = document.getElementById('sensitivity-val');
const volumeMeter = document.getElementById('volume-meter');

// Nav Elements
const gameNavBtn = document.getElementById('game-nav-btn');
const dashboardNavBtn = document.getElementById('dashboard-nav-btn');
const dashboardContainer = document.getElementById('dashboard-container');
const childGrid = document.getElementById('child-grid');

let practiceMode = false;
let sessionStats = {};
let gameActive = false;
let jumpCooldown = false;
let isPrompting = false; // Prevent prompt double-skipping
let portLocked = false; // Prevent multiple serial port attempts

// Dummy Data
const dummyChildren = [
    { id: 1, name: "Alex Johnson", age: "6", sessions: 12, mastery: 85, color: "#4CAF50" },
    { id: 2, name: "Sia Williams", age: "5", sessions: 8, mastery: 72, color: "#FFC107" },
    { id: 3, name: "Leo Smith", age: "7", sessions: 15, mastery: 94, color: "#E91E63" },
    { id: 4, name: "Emma Davis", age: "4", sessions: 4, mastery: 45, color: "#2196F3" }
];

const ageSettings = {
    arduino: { low: 18, med: 35, high: 55, mega: 80 },
    child: { low: 150, med: 300, high: 450, mega: 600 },
    adult: { low: 80, med: 160, high: 240, mega: 320 },
    toddler: { low: 200, med: 400, high: 600, mega: 800 }
};
const baseAgeSettings = JSON.parse(JSON.stringify(ageSettings));

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

// Hybrid Audio Logic (Mic + Serial)
let audioCtx;
let analyser;
let micStream;
let source;
let pitchDataArray;
let isMicEnabled = false;
let serialPort;
let reader;
let isSerialEnabled = false;

async function initMic() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        pitchDataArray = new Float32Array(analyser.fftSize);
        isMicEnabled = true;
        isSerialEnabled = false; // Disable serial if mic is chosen

        statusDot.className = 'status-dot connected';
        statusText.innerText = 'Mic Active';
        micBtn.style.display = 'none';
        connectBtn.style.display = 'none';

        // Sync slider to current age settings
        sensitivitySlider.value = ageSettings[currentAge].low;
        sensitivityValEl.innerText = sensitivitySlider.value;

        detectPitch();
    } catch (err) {
        console.error("Mic Error:", err);
        statusText.innerText = 'Mic Denied';
    }
}

async function initSerial() {
    if (portLocked) return;
    try {
        portLocked = true;
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        isSerialEnabled = true;
        isMicEnabled = false; // Disable mic if serial is chosen
        currentAge = 'arduino'; // Use hardware thresholds

        statusDot.className = 'status-dot connected';
        statusText.innerText = 'Arduino Active';
        micBtn.style.display = 'none';
        connectBtn.style.display = 'none';

        // Sync slider to current age settings
        sensitivitySlider.value = ageSettings[currentAge].low;
        sensitivityValEl.innerText = sensitivitySlider.value;

        readSerial();
    } catch (err) {
        console.error("Serial Error:", err);
        statusText.innerText = 'Serial Failed';
    }
}

// Pitch Detection (Mic)
function detectPitch() {
    if (!isMicEnabled) return;

    analyser.getFloatTimeDomainData(pitchDataArray);
    const freq = autoCorrelate(pitchDataArray, audioCtx.sampleRate);

    if (freq !== -1 && freq > 50) {
        freqEl.innerText = Math.round(freq);
        handleJump(freq);
        updateVisualizer(freq);
    }

    requestAnimationFrame(detectPitch);
}

// Serial Reader (Arduino)
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
                // Special check for volume debug if you add it to Arduino later
                if (cleanLine.startsWith('FREQ:')) {
                    const freqValue = parseFloat(cleanLine.split(':')[1]);
                    if (!isNaN(freqValue)) {
                        freqEl.innerText = Math.round(freqValue);
                        handleJump(freqValue);
                        updateVisualizer(freqValue);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Serial Read Error:", err);
    }
}

ageSelect.addEventListener('change', (e) => {
    currentAge = e.target.value;
    sensitivitySlider.value = ageSettings[currentAge].low;
    sensitivityValEl.innerText = sensitivitySlider.value;
});

sensitivitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    sensitivityValEl.innerText = val;

    // Dynamically update all thresholds proportionally to maintain jump types
    const settings = ageSettings[currentAge];
    const base = baseAgeSettings[currentAge];
    const ratio = val / base.low;

    settings.low = val;
    settings.med = base.med * ratio;
    settings.high = base.high * ratio;
    settings.mega = base.mega * ratio;

    // Ensure minimum separation for Arduino hardware triggers
    if (currentAge === 'arduino') {
        settings.med = Math.max(settings.low + 5, settings.med);
        settings.high = Math.max(settings.med + 5, settings.high);
        settings.mega = Math.max(settings.high + 5, settings.mega);
    }
});

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.05) return -1; // Increased volume floor from 0.01 to 0.05

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    const c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;
    return sampleRate / T0;
}

function handleJump(freq) {
    // Only allow jump if not already jumping AND either on a platform or near-zero velocity
    if (!gameActive || frog.isJumping || jumpCooldown || Math.abs(frog.vy) > 1.5) return;
    executeJump(freq);
}

function executeJump(freq) {
    if (frog.isJumping) return;

    const settings = ageSettings[currentAge];
    let jumpType = "";

    if (freq < settings.low) return;

    if (freq < settings.med) {
        frog.vy = -14; frog.vx = 11; jumpType = "Small"; // Stronger small jump to reach platforms
    } else if (freq < settings.high) {
        frog.vy = -16; frog.vx = 14; jumpType = "Medium";
    } else if (freq < settings.mega) {
        frog.vy = -19; frog.vx = 18; jumpType = "Long";
    } else {
        frog.vy = -23; frog.vx = 23; jumpType = "Mega";
    }

    frog.isJumping = true;
    frog.jumpType = jumpType;
    playJumpSound();

    if (jumpType === prompts[currentPromptIdx].target && !isPrompting) {
        isPrompting = true;
        promptTextEl.innerText = "Great Job!";
        promptTextEl.classList.add('active-prompt');
        sessionStats[jumpType] = (sessionStats[jumpType] || 0) + 1;

        setTimeout(() => {
            promptTextEl.classList.remove('active-prompt');
            currentPromptIdx = (currentPromptIdx + 1) % prompts.length;
            isPrompting = false;
            updatePrompt();
        }, 1500);
    }
}

function playJumpSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function updatePrompt() {
    promptTextEl.innerText = prompts[currentPromptIdx].text;
}

// Game Physics & Loop
let score = 0;
let frog = { x: 100, y: 0, width: 60, height: 60, vy: 0, vx: 0, gravity: 0.6, isJumping: false };
let platforms = [];
const platformWidth = 130;
const platformHeight = 20;

// Game Visual Effects
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
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0, color: color
        });
    }
}

function resetGame() {
    score = 0;
    scoreEl.innerText = score;
    frog.x = 100;
    frog.y = canvas.height - 150;
    frog.vy = 0; frog.vx = 0;
    platforms = [{ x: 50, y: canvas.height - 100, width: 200, visited: true }];
    for (let i = 0; i < 5; i++) generatePlatform();
}

function generatePlatform() {
    const last = platforms[platforms.length - 1];
    const newX = last.x + 250 + Math.random() * 100;
    const newY = canvas.height - 100 - Math.random() * 100;
    platforms.push({ x: newX, y: newY, width: platformWidth, visited: false });
}

function update() {
    if (!gameActive) return;
    frog.vy += frog.gravity;
    frog.y += frog.vy;
    frog.x += frog.vx;
    frog.vx *= 0.985;

    // Camera follow & Parallax
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

    // Update Ripple & Particles
    ripples = ripples.filter(r => r.alpha > 0);
    ripples.forEach(r => { r.radius += 2; r.alpha -= 0.02; });
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02;
    });
    particles = particles.filter(p => p.life > 0);

    // Collision (Refined)
    platforms.forEach(p => {
        const frogBottom = frog.y + frog.height;
        const prevFrogBottom = frogBottom - frog.vy;

        // AABB check + Velocity interpolation to prevent "fast fall" glitches
        if (frog.vy >= 0 &&
            frog.x + frog.width * 0.8 > p.x &&
            frog.x + frog.width * 0.2 < p.x + p.width &&
            prevFrogBottom <= p.y + 5 &&
            frogBottom >= p.y) {

            if (frog.isJumping) {
                ripples.push({ x: p.x + p.width / 2, y: p.y, radius: 10, alpha: 1 });
                spawnParticles(p.x + p.width / 2, p.y, '#FFC107');
            }

            frog.y = p.y - 60;
            frog.vy = 0;
            frog.vx = 0;
            if (frog.isJumping) {
                frog.isJumping = false;
                // Add a small cooldown before the next jump is allowed
                jumpCooldown = true;
                setTimeout(() => { jumpCooldown = false; }, 150); // Shorter cooldown for better responsiveness
            }
            if (!p.visited) {
                p.visited = true; score++; scoreEl.innerText = score; generatePlatform();
            }
        }
    });

    if (frog.y > canvas.height) resetGame();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
    });

    // Background Pond (Gradient)
    const grad = ctx.createLinearGradient(0, canvas.height - 200, 0, canvas.height);
    grad.addColorStop(0, '#1b263b');
    grad.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height - 200, canvas.width, 200);

    // Ripples
    ripples.forEach(r => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    });

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Platforms
    platforms.forEach(p => {
        const cx = p.x + p.width / 2;
        ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.ellipse(cx, p.y + 5, p.width / 2, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F06292';
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 12, p.y - 5 + Math.sin(a) * 3, 10, 5, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(cx, p.y - 5, 6, 0, Math.PI * 2); ctx.fill();
    });

    // Detailed Frog
    const fx = frog.x + 30; const fy = frog.y + 30;
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.ellipse(fx, fy + 5, 25, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.arc(fx - 12, fy - 10, 10, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 10, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(fx - 12, fy - 12, 6, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 12, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(fx - 12, fy - 13, 3, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 13, 3, 0, Math.PI * 2); ctx.fill();
}

function updateVisualizer(freq) {
    vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
    vizCtx.beginPath();
    vizCtx.moveTo(0, vizCanvas.height / 2);
    vizCtx.lineTo(vizCanvas.width, vizCanvas.height / 2);
    vizCtx.stroke();

    const x = (freq / (isSerialEnabled ? 100 : 1000)) * vizCanvas.width;
    vizCtx.beginPath();
    vizCtx.strokeStyle = '#FFC107';
    vizCtx.lineWidth = 3;
    vizCtx.moveTo(x, 0);
    vizCtx.lineTo(x, vizCanvas.height);
    vizCtx.stroke();
    vizCtx.lineWidth = 1;
    calibEl.innerText = isSerialEnabled ? 'Hardware Active' : 'Mic Active';

    // Update Volume Meter
    const max = isSerialEnabled ? 100 : 1000;
    const percent = Math.min((freq / max) * 100, 100);
    volumeMeter.style.width = percent + '%';
    if (freq > ageSettings[currentAge].low) {
        volumeMeter.style.background = '#FF5722'; // Flash red when jumping
    } else {
        volumeMeter.style.background = 'linear-gradient(90deg, #4CAF50, #FFC107)';
    }
}

function animate() {
    update();
    draw();
    requestAnimationFrame(animate);
}

// Dashboard
const childSearchInput = document.getElementById('child-search');
function renderDashboard(filter = "") {
    childGrid.innerHTML = '';
    dummyChildren.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).forEach(child => {
        const card = document.createElement('div');
        card.className = 'child-card';
        card.innerHTML = `<div class="child-name" style="color: ${child.color}">${child.name}</div><div class="stat-pill">Age: ${child.age}</div><div class="child-stats"><span class="stat-pill">Sessions: ${child.sessions}</span><span class="stat-pill">Mastery: ${child.mastery}%</span></div><div class="progress-bar-container"><div class="progress-bar" style="width: ${child.mastery}%"></div></div>`;
        childGrid.appendChild(card);
    });
}

childSearchInput.addEventListener('input', (e) => renderDashboard(e.target.value));

gameNavBtn.addEventListener('click', () => {
    gameNavBtn.classList.add('active'); dashboardNavBtn.classList.remove('active');
    dashboardContainer.style.display = 'none'; canvas.style.display = 'block';
});

dashboardNavBtn.addEventListener('click', () => {
    dashboardNavBtn.classList.add('active'); gameNavBtn.classList.remove('active');
    dashboardContainer.style.display = 'block'; canvas.style.display = 'none'; renderDashboard();
});

micBtn.addEventListener('click', initMic);
connectBtn.addEventListener('click', initSerial);
startBtn.addEventListener('click', () => {
    gameActive = true; overlay.style.display = 'none'; resetGame(); updatePrompt();
});

window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
});

canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
animate();
renderDashboard();
