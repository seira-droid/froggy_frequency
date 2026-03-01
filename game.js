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
const categorySelect = document.getElementById('category-select');
const promptTextEl = document.getElementById('prompt-text');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValEl = document.getElementById('sensitivity-val');
const volumeMeter = document.getElementById('volume-meter');
const stabilityMeter = document.getElementById('stability-meter');
const breathBar = document.getElementById('breath-bar');
const worldNameEl = document.getElementById('world-name');
const levelValEl = document.getElementById('level-val');
const sysLog = document.getElementById('diagnostic-log');

// --- AI ADAPTIVE INTELLIGENCE ---
class AdaptiveIntelligence {
    constructor() {
        this.pitchHistory = [];
        this.loudnessHistory = [];
        this.maxHistory = 100;
        this.movingAvgPitch = 0;
        this.rollingVarianceLoudness = 0;
        this.fatigueDetected = false;
        this.sessionStartTime = Date.now();
        this.lastCalibrationUpdate = Date.now();
    }

    pushData(pitch, loudness) {
        this.pitchHistory.push(pitch);
        this.loudnessHistory.push(loudness);
        if (this.pitchHistory.length > this.maxHistory) {
            this.pitchHistory.shift();
            this.loudnessHistory.shift();
        }
        this.calculateMetrics();
        this.autoAdjustThresholds();
    }

    calculateMetrics() {
        if (this.pitchHistory.length < 10) return;

        // Moving Average Pitch
        const sum = this.pitchHistory.reduce((a, b) => a + b, 0);
        this.movingAvgPitch = sum / this.pitchHistory.length;

        // Rolling Variance of Loudness (Stability)
        const avgL = this.loudnessHistory.reduce((a, b) => a + b, 0) / this.loudnessHistory.length;
        this.rollingVarianceLoudness = this.loudnessHistory.reduce((v, l) => v + Math.pow(l - avgL, 2), 0) / this.loudnessHistory.length;

        // Update Stability UI
        const stability = Math.max(0, 100 - (this.rollingVarianceLoudness * 500));
        stabilityMeter.style.width = stability + '%';
        stabilityMeter.style.background = stability > 70 ? '#4caf50' : (stability > 40 ? '#FFC107' : '#ff5252');
    }

    autoAdjustThresholds() {
        // Only adjust every 5 seconds to avoid jitter
        if (Date.now() - this.lastCalibrationUpdate < 5000) return;
        this.lastCalibrationUpdate = Date.now();

        if (this.pitchHistory.length < 50) return;

        const currentSett = ageSettings[currentAge];
        // If the user is consistently hitting above current mega, raise the floor slightly
        if (this.movingAvgPitch > currentSett.high) {
            currentSett.low += 2;
            currentSett.mega += 5;
            console.log("AI: Adjusting thresholds UP based on performance.");
        } else if (this.movingAvgPitch < currentSett.low + 50 && this.movingAvgPitch > 50) {
            currentSett.low -= 5;
            console.log("AI: Adjusting thresholds DOWN to help user.");
        }

        // Limit range
        currentSett.low = Math.max(50, Math.min(400, currentSett.low));
        sensitivitySlider.value = currentSett.low;
        sensitivityValEl.innerText = Math.round(currentSett.low);
    }

    predictImprovement() {
        if (this.pitchHistory.length < 50) return { trend: 'neutral', message: 'Collecting data...' };

        // Simple linear regression to check trend
        const n = this.pitchHistory.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += this.pitchHistory[i];
            sumXY += i * this.pitchHistory[i];
            sumXX += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        if (slope > 0.5) return { trend: 'improving', message: 'Steady Improvement!' };
        if (slope < -0.5) return { trend: 'fatigue', message: 'Fatigue Detected - Take a break?' };
        return { trend: 'plateau', message: 'Consistent Mastery' };
    }
}

const ai = new AdaptiveIntelligence();

// --- NARRATIVE SYSTEM ---
const worlds = [
    { name: "The Foggy Pond", color: "#1b263b", unlockScore: 0 },
    { name: "Crystal Caverns", color: "#2d1b3b", unlockScore: 50 },
    { name: "Neon Rainforest", color: "#003b1b", unlockScore: 150 },
    { name: "Starry Summit", color: "#16003b", unlockScore: 300 }
];
let currentWorldIdx = 0;
let playerLevel = 1;
let levelExp = 0;

// --- DATA & STATE ---
let selectedChild = null;
let gameActive = false;
let isPrompting = false;
let soundBufferFrames = 0;
const NOISE_GATE_THRESHOLD = 2; // Standardized
let portLocked = false;
let profileDatabase = [];
try {
    const saved = localStorage.getItem('froggy_profiles');
    profileDatabase = saved ? JSON.parse(saved) : [];

    // Force default profiles if empty
    if (profileDatabase.length === 0) {
        profileDatabase = [
            { id: 1, name: "Alex (Student)", age: "6", sessions: 12, mastery: 85, color: "#4CAF50", highFreq: 600, lowFreq: 220, sessionHistory: [] },
            { id: 2, name: "Sia (Student)", age: "5", sessions: 8, mastery: 72, color: "#FFC107", highFreq: 650, lowFreq: 250, sessionHistory: [] }
        ];
        localStorage.setItem('froggy_profiles', JSON.stringify(profileDatabase));
    }
} catch (e) {
    console.warn("Resetting corrupt profile database");
    profileDatabase = [
        { id: 1, name: "Alex (Student)", age: "6", sessions: 12, mastery: 85, color: "#4CAF50", highFreq: 600, lowFreq: 220, sessionHistory: [] }
    ];
}

const saveProfiles = () => {
    try {
        localStorage.setItem('froggy_profiles', JSON.stringify(profileDatabase));
    } catch (e) { console.error("Save failed", e); }
};

// Navigation Elements (Updated)
const gameNavBtn = document.getElementById('game-nav-btn');
const trainerBtn = document.getElementById('trainer-access-btn');
const trainerPortal = document.getElementById('trainer-portal');
const exitTrainerBtn = document.getElementById('exit-trainer-btn');
const profileModal = document.getElementById('profile-modal');
const profileGrid = document.getElementById('profile-grid');
const addProfileBtn = document.getElementById('add-profile-btn');
const detailModal = document.getElementById('student-detail-modal');
const detailContent = document.getElementById('student-detail-content');
const closeDetailBtn = document.getElementById('close-detail-btn');
const currentViewingChildEl = document.getElementById('current-viewing-child');
const childGrid = document.getElementById('child-grid');


const ageSettings = {
    arduino: { low: 4, med: 12, high: 25, mega: 40 },
    child: { low: 180, med: 320, high: 480, mega: 650 }, // Calibrated for higher pitch children's voices
    adult: { low: 80, med: 160, high: 240, mega: 320 },
    toddler: { low: 220, med: 400, high: 550, mega: 750 }
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
    ],
    Jetpack: [
        { text: "Vowel Contrast: 'EE' (High) ↔️ 'AH' (Low)", target: 'Jetpack' },
        { text: "Minimal Pair: 'KEY' 🔑 vs 'TEA' ☕", target: 'Jetpack' },
        { text: "Minimal Pair: 'FAN' 🌬️ vs 'PAN' 🍳", target: 'Jetpack' },
        { text: "Lip Rounding: 'EE' (Smile) ↔️ 'OO' (Round)", target: 'Jetpack' },
        { text: "Nasal Contrast: 'MA' 👃 vs 'BA' 👄", target: 'Jetpack' }
    ]
};

let currentSet = 'Vowels'; // Changed default from 'Jetpack' to 'Vowels' for strict tasking
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
let isJetpackMode = false;
let jetpackActive = false;
let jetpackFuel = 0;
let bubbles = [];
let lanternGoal = { x: 0, y: -2000, active: false, size: 40 };
let ambientLanterns = [];
let sustainedTime = 0;
let fireflies = Array.from({ length: 30 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 1,
    vy: (Math.random() - 0.5) * 1,
    phase: Math.random() * Math.PI * 2
}));
let frogTrail = [];
let currentFreq = 0; // Global track for aura scaling
let freqStabilityBuffer = []; // Tracking consistent phonation
let sessionStats = { Small: 0, Medium: 0, Long: 0, Mega: 0 }; // Initialize missing tracking data

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

        // Force switch away from Arduino settings if currently selected
        if (currentAge === 'arduino') {
            currentAge = 'child';
            ageSelect.value = 'child';
        }

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
    // Force reset state to allow clean retry
    portLocked = false;
    if (serialPort) {
        try { await serialPort.forget(); } catch (e) { }
        serialPort = null;
    }

    try {
        portLocked = true;
        statusText.innerText = 'Connecting...';

        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        isSerialEnabled = true;
        isMicEnabled = false;
        currentAge = 'arduino';

        statusDot.className = 'status-dot connected';
        statusText.innerText = 'Arduino Linked';
        micBtn.style.display = 'none';
        connectBtn.style.display = 'none';

        sensitivitySlider.value = ageSettings[currentAge].low;
        sensitivityValEl.innerText = sensitivitySlider.value;

        readSerial();
        console.log("Hardware Handshake Successful.");
    } catch (err) {
        console.error("Connection Detailed Error:", err);
        portLocked = false;
        serialPort = null;
        statusText.innerText = 'Conn Failed';
        alert("🚨 CONNECTION BLOCKED\n\nThe Arduino board is currently 'Busy'.\n\n1. Close the Serial Monitor in Arduino IDE\n2. Close the Serial Plotter in Arduino IDE\n3. Unplug and Re-plug the USB cable\n\nThen try clicking 'Connect Arduino' again.");
    }
}

// Pitch Detection (Mic)
function detectPitch() {
    if (!isMicEnabled) return;

    analyser.getFloatTimeDomainData(pitchDataArray);

    // Get RMS (Loudness) for Volume Meter and AI
    const rms = Math.sqrt(pitchDataArray.reduce((acc, val) => acc + val * val, 0) / pitchDataArray.length);

    // Update Volume Meter (Actual loudness now, not frequency)
    const volPercent = Math.min(100, rms * 500);
    volumeMeter.style.width = volPercent + '%';
    volumeMeter.style.background = rms > 0.01 ? '#00ff88' : '#555';

    const freq = autoCorrelate(pitchDataArray, audioCtx.sampleRate);

    // VOICE SPECIFICITY FIX: Only respond if frequency is within human vocal range (40Hz - 1200Hz)
    // AND check for Pitch Stability (Noise is erratic, Vowels are steady)
    if (freq !== -1 && freq > 40 && freq < 1200) {
        freqStabilityBuffer.push(freq);
        if (freqStabilityBuffer.length > 4) freqStabilityBuffer.shift();

        const maxDiff = Math.max(...freqStabilityBuffer) - Math.min(...freqStabilityBuffer);
        const isSteady = freqStabilityBuffer.length >= 3 && maxDiff < (freq * 0.25); // 25% jitter allowed

        if (isSteady) {
            currentFreq = freq;
            freqEl.innerText = Math.round(freq);
            statusText.innerText = 'Voice Detected';
            statusDot.classList.add('pulse');

            ai.pushData(freq, rms);
            handleJump(freq);
            updateVisualizer(freq);

            const breathPercent = Math.min(100, rms * 400);
            breathBar.style.width = breathPercent + '%';
        } else {
            statusText.innerText = 'Analyzing Voice...';
        }
    } else {
        // REMOVED 'Basic Sound Detected' fallback to prevent non-vocal jumps
        currentFreq = 0;
        breathBar.style.width = '0%';
        if (gameActive) {
            statusText.innerText = 'Awaiting Voice...';
            statusDot.classList.remove('pulse');
        }
        handleJump(0);
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

                    // DIAGNOSTIC LOGGING
                    const log = document.getElementById('diagnostic-log');
                    if (log) {
                        log.style.display = 'block';
                        const entry = document.createElement('div');
                        entry.innerText = `[${new Date().toLocaleTimeString()}] Arduino Sig: ${freqValue}`;
                        log.prepend(entry);
                        if (log.childNodes.length > 10) log.removeChild(log.lastChild);
                    }

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

categorySelect.addEventListener('change', (e) => {
    currentSet = e.target.value;
    prompts = promptSets[currentSet];
    currentPromptIdx = 0;
    updatePrompt();
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
});

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.015) return -1; // Increased noise floor (was 0.002) to filter background hum

    // Standard Autocorrelation with simpler peak detection
    let correlations = new Float32Array(SIZE);
    for (let offset = 0; offset < SIZE; offset++) {
        for (let i = 0; i < SIZE - offset; i++) {
            correlations[offset] += buf[i] * buf[i + offset];
        }
    }

    // Skip initial peak
    let d = 0;
    while (correlations[d] > correlations[d + 1] && d < SIZE / 2) d++;

    // Find next peak
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE / 2; i++) {
        if (correlations[i] > maxval) {
            maxval = correlations[i];
            maxpos = i;
        }
    }

    if (maxpos !== -1) return sampleRate / maxpos;
    return -1;
}

function handleJump(freq) {
    const log = document.getElementById('diagnostic-log');

    // Only allow jump if not already jumping AND either on a platform or near-zero velocity
    if (!gameActive) {
        soundBufferFrames = 0;
        return;
    }

    if (freq > 20) {
        soundBufferFrames++;
    } else {
        soundBufferFrames = 0;
    }

    if (soundBufferFrames < 3) return; // Robust filter: Requires 3 frames (~50ms) of sustained voice

    const targetCat = prompts[currentPromptIdx].target;
    // Skip target check in Jetpack mode as it's continuous contrast
    if (currentSet === 'Jetpack') {
        handleJetpack(freq);
        return;
    }

    const settings = ageSettings[currentAge];
    const ranges = {
        'Small': [settings.low, settings.med],
        'Medium': [settings.med, settings.high],
        'Long': [settings.high, settings.mega],
        'Mega': [settings.mega, Infinity]
    };

    const targetRange = ranges[targetCat];
    if (!targetRange) {
        executeJump(freq, true); // Fallback for undefined targets
        return;
    }

    const isCorrect = freq >= targetRange[0] && (targetRange[1] === Infinity || freq < targetRange[1]);

    if (isCorrect) {
        executeJump(freq, true);
    }

    soundBufferFrames = 0; // Reset after attempt
}

function executeJump(freq, isCorrect) {
    if (frog.isJumping) return;

    const settings = ageSettings[currentAge];

    if (!isCorrect) {
        // --- WRONG SOUND: STAY IN PLACE (NO MOVEMENT) ---
        statusText.innerText = "❌ Speak '" + prompts[currentPromptIdx].target + "' Pitch!";
        statusText.style.color = "#ff5252";

        // Brief shock/shake visual without displacement
        spawnParticles(frog.x + 30, frog.y + 30, '#ff5252');

        // Reset state so it's not "jumping"
        frog.vx = 0;
        frog.vy = 0;
        frog.isJumping = false;

        if (sysLog) {
            const entry = document.createElement('div');
            entry.innerText = `[REJECTED] Freq: ${Math.round(freq)}Hz | Must reach ${prompts[currentPromptIdx].target}`;
            entry.style.color = '#ff5252';
            sysLog.prepend(entry);
        }
        return;
    }

    // --- LINEAR PROPORTIONAL JUMP ENGINE ---
    const minF = settings.low;
    const maxF = settings.mega * 1.5;
    let power = (freq - minF) / (maxF - minF);
    power = Math.max(0.1, Math.min(1.3, power)); // Minimum jump power 0.1

    // Update Power UI
    document.getElementById('power-val').innerText = Math.round(power * 100) + '%';

    // Calculate precise physics based on power
    frog.vy = -14 - (power * 14); // Dynamic Height
    frog.vx = 12 + (power * 20);  // Dynamic Distance

    // Determine Jump Type
    let jumpType = "Small";
    if (power > 0.3) jumpType = "Medium";
    if (power > 0.6) jumpType = "Long";
    if (power > 0.9) jumpType = "Mega";

    // DIAGNOSTIC LOG
    if (sysLog) {
        const entry = document.createElement('div');
        entry.innerText = `[SUCCESS] Freq: ${Math.round(freq)}Hz | ${jumpType} Jump!`;
        entry.style.color = '#4CAF50';
        sysLog.prepend(entry);
    }

    frog.isJumping = true;
    frog.jumpType = jumpType;
    playJumpSound();

    // Trigger perfect match feedback
    isPrompting = true;
    promptTextEl.innerText = "Perfect Match!";
    promptTextEl.classList.add('active-prompt');

    setTimeout(() => {
        promptTextEl.classList.remove('active-prompt');
        currentPromptIdx = (currentPromptIdx + 1) % prompts.length;
        isPrompting = false;
        updatePrompt();
    }, 1500);
}

function handleJetpack(freq) {
    const settings = ageSettings[currentAge];
    if (freq > settings.low) {
        jetpackActive = true;
        sustainedTime++;

        // Lift physics: apply upward force
        const power = Math.min(1, (freq - settings.low) / (settings.mega - settings.low));
        frog.vy -= 1.2 + (power * 1.5);
        if (frog.vy < -15) frog.vy = -15; // Cap vertical speed

        // Spawn bubbles
        spawnBubbles();

        // Update visualizer/log
        if (sustainedTime % 10 === 0) {
            const log = document.getElementById('diagnostic-log');
            if (log) {
                const entry = document.createElement('div');
                entry.innerText = `[JETPACK] Sustained: ${Math.round(sustainedTime / 60)}s | Power: ${Math.round(power * 100)}%`;
                entry.style.color = `hsl(${sustainedTime % 360}, 70%, 60%)`;
                log.prepend(entry);
            }
        }

        // Cycle through Contrast Prompts while flying (every ~3 seconds)
        if (sustainedTime > 0 && sustainedTime % 180 === 0) {
            currentPromptIdx = (currentPromptIdx + 1) % prompts.length;
            updatePrompt();

            // Visual feedback for prompt change
            promptTextEl.style.transform = 'scale(1.2)';
            setTimeout(() => promptTextEl.style.transform = 'scale(1)', 300);
        }
    } else {
        jetpackActive = false;
        sustainedTime = 0;
    }
}

function spawnBubbles() {
    const hue = sustainedTime % 360;
    for (let i = 0; i < 3; i++) {
        bubbles.push({
            x: frog.x + 10 + (Math.random() * 40),
            y: frog.y + frog.height - 10,
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 4,
            radius: 5 + Math.random() * 10,
            life: 1.0,
            color: `hsla(${hue}, 80%, 60%, 0.8)`
        });
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

    // Ensure canvas dimensions are captured
    const h = canvas.height || canvas.offsetHeight || 600;

    platforms = [{ x: 50, y: h - 100, width: 200, visited: true }];
    for (let i = 0; i < 5; i++) generatePlatform();

    frog.x = 100;
    frog.y = platforms[0].y - frog.height; // Position EXACTLY on top of the first platform
    frog.vy = 0;
    frog.vx = 0;
    frog.isJumping = false;
    jumpCooldown = false;

    if (currentSet === 'Jetpack') {
        platforms = [{ x: canvas.width / 2 - 100, y: canvas.height - 100, width: 200, visited: true }];
        frog.x = canvas.width / 2 - 30;
        frog.y = platforms[0].y - frog.height;
        lanternGoal.active = true;
        lanternGoal.x = canvas.width / 2;
        lanternGoal.y = -2000; // High above

        // Setup ambient lanterns
        ambientLanterns = Array.from({ length: 15 }, () => ({
            x: Math.random() * canvas.width,
            y: -Math.random() * 3000,
            size: 15 + Math.random() * 15,
            speedY: -0.2 - Math.random() * 0.3,
            driftX: (Math.random() - 0.5) * 0.2,
            hue: 30 + Math.random() * 20 // Warm orange/yellow
        }));
    } else {
        lanternGoal.active = false;
        ambientLanterns = [];
    }
}

function generatePlatform() {
    const last = platforms[platforms.length - 1];
    const h = canvas.height || 600;

    // PROGRESSIVE DENSITY: Platforms get more frequent as you go
    const spacingReduction = Math.min(100, score * 2);
    const newX = last.x + (220 - spacingReduction) + Math.random() * 80;
    const newY = Math.max(150, Math.min(h - 100, last.y + (Math.random() * 160 - 80)));

    const isGoal = (score >= 45 && !platforms.some(p => p.isGoal)); // Target appears near 50
    platforms.push({ x: newX, y: newY, width: platformWidth, visited: false, isGoal: isGoal });

    // Spawn extra "Branch" platforms to make the pond look fuller
    if (score > 10 && Math.random() > 0.6) {
        platforms.push({
            x: newX + 150,
            y: newY + (Math.random() * 100 - 50),
            width: platformWidth * 0.8,
            visited: false,
            extra: true
        });
    }
}

function update() {
    if (!gameActive) return;

    // Reset gravity if jetpack is pushing hard enough
    if (jetpackActive) {
        frog.vy += frog.gravity * 0.4; // Reduced gravity while jetpack is active
    } else {
        frog.vy += frog.gravity;
    }

    frog.y += frog.vy;
    frog.x += frog.vx;

    if (currentSet === 'Jetpack') {
        // In jetpack mode, move camera horizontally to keep frog centered
        // but allow vertical movement (scrolling up)
        if (frog.y < canvas.height / 3) {
            const diff = canvas.height / 3 - frog.y;
            frog.y = canvas.height / 3;
            platforms.forEach(p => p.y += diff);
            ripples.forEach(r => r.y += diff);
            particles.forEach(p => p.y += diff);
            bubbles.forEach(b => b.y += diff);
            lanternGoal.y += diff;
            ambientLanterns.forEach(al => al.y += diff);
            stars.forEach(s => s.y += diff * 0.1);
        }
    } else {
        frog.vx *= 0.985;
    }

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

    // Update Bubbles
    bubbles.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.life -= 0.01;
    });
    bubbles = bubbles.filter(b => b.life > 0);

    // Update Ambient Lanterns
    ambientLanterns.forEach(al => {
        al.y += al.speedY;
        al.x += al.driftX + Math.sin(Date.now() / 1000) * 0.1;
    });

    // Update Fireflies
    fireflies.forEach(f => {
        f.phase += 0.02;
        f.x += f.vx + Math.sin(f.phase) * 0.5;
        f.y += f.vy + Math.cos(f.phase) * 0.5;
        if (f.x < 0) f.x = canvas.width;
        if (f.x > canvas.width) f.x = 0;
        if (f.y < 0) f.y = canvas.height;
        if (f.y > canvas.height) f.y = 0;
    });

    // Update Frog Trail
    if (frog.isJumping || jetpackActive) {
        frogTrail.unshift({ x: frog.x + 30, y: frog.y + 30, alpha: 0.5, hue: (currentFreq % 360) });
    }
    if (frogTrail.length > 20) frogTrail.pop();
    frogTrail.forEach(t => t.alpha -= 0.02);
    frogTrail = frogTrail.filter(t => t.alpha > 0);

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

            frog.y = p.y - frog.height; // Position EXACTLY on top of the platform
            frog.vy = 0;
            frog.vx = 0;
            if (frog.isJumping) {
                frog.isJumping = false;
                jumpCooldown = true;
                setTimeout(() => { jumpCooldown = false; }, 150);
            }
            if (!p.visited) {
                p.visited = true;
                score++;
                scoreEl.innerText = score;
                generatePlatform();

                // CHECK FOR VICTORY TARGET (Score 50)
                if (score >= 50 && p.isGoal) {
                    gameActive = false;
                    promptTextEl.innerText = "🏆 TARGET REACHED! YOU WIN!";
                    spawnParticles(frog.x + 30, frog.y, '#FFD700');
                    setTimeout(() => { if (confirm("Goal Surpassed! Restart Adventure?")) resetGame(); }, 1500);
                }
            }
        }
    });

    // Lantern Goal Collision
    if (lanternGoal.active) {
        const dx = (frog.x + frog.width / 2) - lanternGoal.x;
        const dy = (frog.y + frog.height / 2) - lanternGoal.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
            spawnParticles(lanternGoal.x, lanternGoal.y, '#FFA000');
            lanternGoal.active = false;
            score += 15;
            scoreEl.innerText = score;
            promptTextEl.innerText = "LANTERN CAPTURED!";
            setTimeout(() => {
                resetGame();
                updatePrompt();
            }, 2000);
        }
    }

    // Check for level up & World progression
    if (score > levelExp + (playerLevel * 20)) {
        levelExp = score;
        playerLevel++;
        levelValEl.innerText = playerLevel;
        spawnParticles(frog.x, frog.y, '#FFD700');
        playLevelUpSound();
    }

    if (currentWorldIdx < worlds.length - 1 && score >= worlds[currentWorldIdx + 1].unlockScore) {
        currentWorldIdx++;
        worldNameEl.innerText = worlds[currentWorldIdx].name;
        document.getElementById('game-container').style.background = `radial-gradient(circle at center, ${worlds[currentWorldIdx].color} 0%, #050a0f 100%)`;
        promptTextEl.innerText = `Welcome to ${worlds[currentWorldIdx].name}!`;
    }

    if (frog.y > canvas.height + 500) resetGame();

    // PERIODIC DIAGNOSTIC
    if (Date.now() % 1000 < 20 && sysLog) {
        const entry = document.createElement('div');
        entry.innerText = `[ENGINE] Pos: ${Math.round(frog.x)},${Math.round(frog.y)} | VY: ${frog.vy.toFixed(1)}`;
        entry.style.fontSize = '9px';
        entry.style.opacity = '0.5';
        sysLog.prepend(entry);
    }
}

function playLevelUpSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fx = frog.x + 30;
    const fy = frog.y + 30;
    const auraHue = currentFreq > 0 ? (currentFreq % 360) : 120;

    // Fireflies
    fireflies.forEach(f => {
        const glow = Math.abs(Math.sin(f.phase)) * 2;
        ctx.fillStyle = `rgba(180, 255, 100, ${0.3 + glow * 0.3})`;
        ctx.shadowBlur = 5 + glow * 5;
        ctx.shadowColor = '#b4ff64';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Frog Trail
    frogTrail.forEach(t => {
        ctx.fillStyle = `hsla(${t.hue}, 80%, 60%, ${t.alpha})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, 15 * t.alpha, 0, Math.PI * 2); ctx.fill();
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

    // Bubbles
    bubbles.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.globalAlpha = b.life;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.stroke();
    });
    ctx.globalAlpha = 1.0;

    // Ambient Sky Lanterns
    ambientLanterns.forEach(al => {
        const flicker = Math.sin(Date.now() / 200) * 5;
        ctx.shadowBlur = 10 + flicker;
        ctx.shadowColor = `hsl(${al.hue}, 100%, 50%)`;
        ctx.fillStyle = `hsl(${al.hue}, 100%, 40%)`;
        ctx.fillRect(al.x - al.size / 2, al.y - al.size / 2, al.size, al.size * 1.2);

        // Glow inside
        ctx.fillStyle = `hsl(${al.hue}, 100%, 70%)`;
        ctx.fillRect(al.x - al.size / 4, al.y - al.size / 3, al.size / 2, al.size / 2);
        ctx.shadowBlur = 0;
    });

    // Lantern Goal
    if (lanternGoal.active) {
        const lx = lanternGoal.x;
        const ly = lanternGoal.y;
        const flicker = Math.sin(Date.now() / 150) * 10;

        // Outer Glow
        ctx.shadowBlur = 30 + flicker;
        ctx.shadowColor = '#FFA000';

        // Lantern Body
        ctx.fillStyle = '#E65100'; // Dark Orange
        ctx.fillRect(lx - 25, ly - 35, 50, 60);

        // Bright Center
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(lx - 15, ly - 20, 30, 40);

        // Top and Bottom Trim
        ctx.fillStyle = '#212121';
        ctx.fillRect(lx - 28, ly - 38, 56, 8);
        ctx.fillRect(lx - 28, ly + 25, 56, 8);

        ctx.shadowBlur = 0;
    }

    // Platforms
    platforms.forEach(p => {
        const cx = p.x + p.width / 2;
        // Goal Platform looks different
        if (p.isGoal) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#FFD700";
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.ellipse(cx, p.y + 5, p.width / 2, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // Draw a tiny flag
            ctx.fillStyle = "#ff5252";
            ctx.fillRect(cx - 2, p.y - 40, 4, 40);
            ctx.beginPath(); ctx.moveTo(cx + 2, p.y - 40); ctx.lineTo(cx + 20, p.y - 30); ctx.lineTo(cx + 2, p.y - 20); ctx.fill();
        } else {
            ctx.fillStyle = p.extra ? '#1B5E20' : '#2E7D32'; // Extra platforms are darker
            ctx.beginPath(); ctx.ellipse(cx, p.y + 5, p.width / 2, 10, 0, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = '#F06292';
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 12, p.y - 5 + Math.sin(a) * 3, 10, 5, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(cx, p.y - 5, 6, 0, Math.PI * 2); ctx.fill();
    });

    // Vowel Contrast Rings & Zones
    if (currentFreq > 0) {
        ctx.save();
        ctx.translate(fx, fy);

        // Stability Rings
        const stability = 100 - (ai.rollingVarianceLoudness * 500);
        const ringCount = 3 + Math.floor(stability / 20);
        for (let i = 0; i < ringCount; i++) {
            ctx.beginPath();
            const radius = 80 + (i * 15) + Math.sin(Date.now() / 200 + i) * 5;
            ctx.strokeStyle = `hsla(${(currentFreq % 360)}, 100%, 70%, ${0.5 / (i + 1)})`;
            ctx.lineWidth = 2;
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Vowel Target Wedges (UI)
        const vowelZones = [
            { name: 'EE', freq: 600, color: '#00d4ff' },
            { name: 'AH', freq: 300, color: '#ffb300' },
            { name: 'OO', freq: 150, color: '#ff5252' }
        ];

        vowelZones.forEach((zone, idx) => {
            const isActive = Math.abs(currentFreq - zone.freq) < 50;
            ctx.fillStyle = isActive ? zone.color : 'rgba(255,255,255,0.1)';
            ctx.font = 'bold 10px Outfit';
            ctx.textAlign = 'center';
            const angle = (idx * Math.PI * 2) / 3 - Math.PI / 2;
            const tx = Math.cos(angle) * 150;
            const ty = Math.sin(angle) * 150;
            ctx.fillText(zone.name, tx, ty);
            if (isActive) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = zone.color;
                ctx.beginPath();
                ctx.arc(tx, ty - 5, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        ctx.restore();
    }

    // Detailed Frog
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.ellipse(fx, fy + 5, 25, 20, 0, 0, Math.PI * 2); ctx.fill();

    // Glowing Emotional Center (reacts to voice)
    const heartSize = 5 + (currentFreq > 0 ? currentFreq / 50 : 0);
    ctx.fillStyle = `hsla(${auraHue}, 100%, 80%, 0.8)`;
    ctx.shadowBlur = heartSize * 2;
    ctx.shadowColor = `hsla(${auraHue}, 100%, 60%, 1)`;
    ctx.beginPath(); ctx.arc(fx, fy + 5, heartSize, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.arc(fx - 12, fy - 10, 10, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 10, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(fx - 12, fy - 12, 6, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 12, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(fx - 12, fy - 13, 3, 0, Math.PI * 2); ctx.arc(fx + 12, fy - 13, 3, 0, Math.PI * 2); ctx.fill();

    // Jetpack Backpack
    if (currentSet === 'Jetpack') {
        ctx.fillStyle = '#444';
        ctx.fillRect(frog.x + 10, frog.y + 20, 40, 30);
        ctx.fillStyle = '#666';
        ctx.fillRect(frog.x + 15, frog.y + 25, 30, 20);
        if (jetpackActive) {
            const hue = sustainedTime % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.beginPath();
            ctx.moveTo(frog.x + 15, frog.y + 50);
            ctx.lineTo(frog.x + 45, frog.y + 50);
            ctx.lineTo(frog.x + 30, frog.y + 70 + Math.random() * 10);
            ctx.fill();
        }
    }
}

function updateVisualizer(freq) {
    vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
    vizCtx.beginPath();
    vizCtx.moveTo(0, vizCanvas.height / 2);
    vizCtx.lineTo(vizCanvas.width, vizCanvas.height / 2);
    vizCtx.stroke();

    const x = (freq / 1000) * vizCanvas.width;
    vizCtx.beginPath();
    vizCtx.strokeStyle = '#FFC107';
    vizCtx.lineWidth = 3;
    vizCtx.moveTo(x, 0);
    vizCtx.lineTo(x, vizCanvas.height);
    vizCtx.stroke();
    vizCtx.lineWidth = 1;
    calibEl.innerText = 'Mic Active';

    // Update Volume Meter
    const percent = Math.min((freq / 1000) * 100, 100);
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

// --- JUMPING LOGIC (UPDATE SCORE IN SELECTED CHILD) ---
function recordSessionStats() {
    if (!selectedChild) return;

    // Find the child in the main database to ensure we update the reference that gets saved
    const childIndex = profileDatabase.findIndex(c => c.id === selectedChild.id);
    if (childIndex === -1) return;

    const child = profileDatabase[childIndex];

    const session = {
        date: new Date().toLocaleDateString(),
        score: score,
        maxFreq: freqEl.innerText,
        mode: currentSet
    };

    if (!child.sessionHistory) child.sessionHistory = [];
    child.sessionHistory.push(session);
    child.sessions = (child.sessions || 0) + 1;
    child.mastery = Math.min(99, (child.mastery || 0) + 1);

    saveProfiles();
}

// --- TRAINER PORTAL LOGIC ---

function renderProfiles() {
    console.log("Rendering profiles, count:", profileDatabase.length);
    profileGrid.innerHTML = '';

    if (profileDatabase.length === 0) {
        profileGrid.innerHTML = '<div style="color:white; padding: 20px;">No profiles found. Please click the button below to add your first student!</div>';
        return;
    }

    profileDatabase.forEach(child => {
        const card = document.createElement('div');
        card.className = 'child-card';
        card.style.borderLeft = `5px solid ${child.color}`; // Extra visual flair
        card.innerHTML = `
            <div class="child-name" style="color: ${child.color}">${child.name}</div>
            <div class="stat-pill" style="opacity: 0.6">Student ID: #${child.id.toString().slice(-4)}</div>
            <div style="margin-top: 10px; font-size: 0.8rem; opacity: 0.8">Click to start adventure →</div>
        `;
        card.onclick = (e) => {
            e.stopPropagation();
            selectChild(child);
        };
        profileGrid.appendChild(card);
    });
}

function selectChild(child) {
    selectedChild = child;
    console.log("Child selected:", child.name);

    profileModal.style.display = 'none';
    overlay.style.display = 'flex';
    currentViewingChildEl.innerText = child.name;

    // Apply special calibration if it exists
    if (child.lowFreq) {
        if (!ageSettings[currentAge]) currentAge = 'child';
        const ratio = child.lowFreq / baseAgeSettings[currentAge].low;
        ageSettings[currentAge].low = child.lowFreq;
        ageSettings[currentAge].med = baseAgeSettings[currentAge].med * ratio;
        ageSettings[currentAge].high = baseAgeSettings[currentAge].high * ratio;
        ageSettings[currentAge].mega = baseAgeSettings[currentAge].mega * ratio;

        sensitivitySlider.value = child.lowFreq;
        sensitivityValEl.innerText = child.lowFreq;
    }
}

addProfileBtn.onclick = () => {
    const name = window.prompt("Enter Student Name:") || `Student ${profileDatabase.length + 1}`;
    const newChild = {
        id: Date.now(),
        name: name,
        age: "Child",
        sessions: 0,
        mastery: 0,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        highFreq: 600,
        lowFreq: 150,
        sessionHistory: []
    };
    profileDatabase.push(newChild);
    saveProfiles();
    renderProfiles();
    setTimeout(() => { if (confirm(`Profile "${name}" created. Start now?`)) selectChild(newChild); }, 100);
};

// Update Game Reset to track sessions
const originalReset = resetGame;
resetGame = function () {
    if (gameActive && score > 0) recordSessionStats();
    originalReset();
}

// Initialization
micBtn.addEventListener('click', initMic);
connectBtn.addEventListener('click', initSerial);
startBtn.addEventListener('click', async () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    gameActive = true;
    overlay.style.display = 'none';
    statusDot.className = 'status-dot connected';
    statusText.innerText = 'Awaiting Voice...';

    // Show diagnostic log for mic users
    document.getElementById('diagnostic-log').style.display = 'block';

    resetGame();
    updatePrompt();
    if (!audioCtx) initMic();
});

// DIAGNOSTIC FORCE JUMP
document.getElementById('force-jump-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameActive) {
        executeJump(350); // Mid-range force jump
    }
});

// DEBUG MANUAL JUMP
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameActive) {
        e.preventDefault();
        executeJump(300); // Simulate mid-range jump
    }
});

const resizeCanvas = () => {
    // Ensure the container fills available space and canvas follows
    const container = document.getElementById('game-container');
    const headerHeight = document.querySelector('header').offsetHeight;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - headerHeight;

    // Reposition frog if it goes out of bounds on resize
    if (frog.y > canvas.height) resetGame();
};
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

renderProfiles();
animate();
