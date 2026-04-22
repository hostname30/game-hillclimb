(function() {
    // ========== CANVAS ==========
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // ========== GAME STATE ==========
    let gameRunning = true;
    let score = 0;
    let coins = 0;
    let distance = 0;
    let bestScore = localStorage.getItem('bestScore') ? parseInt(localStorage.getItem('bestScore')) : 0;
    
    // ========== DOM ELEMENTS ==========
    const scoreEl = document.getElementById('scoreValue');
    const coinsEl = document.getElementById('coinsValue');
    const distanceEl = document.getElementById('distanceValue');
    const bestEl = document.getElementById('bestValue');
    const angleEl = document.getElementById('angleValue');
    const warningEl = document.getElementById('warning');
    
    bestEl.innerText = bestScore;
    
    // ========== KAMERA (Camera Follow) ==========
    let cameraX = 0;  // Posisi kamera di world
    
    // ========== MOBIL OFFROAD ==========
    let car = {
        worldX: 250,   // Posisi di world (bukan di canvas)
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        angularVel: 0,
        width: 52,
        height: 32
    };
    
    // ========== FISIKA ==========
    const GRAVITY = 0.48;
    const MAX_SPEED = 16;
    const GAS_FORCE = 0.6;
    const BRAKE_FORCE = 0.65;
    const STABILITY_FORCE = 0.018;
    
    // ========== GROUND (World space) ==========
    function getGroundY(worldX) {
        let y = 380 
            + Math.sin(worldX * 0.018) * 25
            + Math.sin(worldX * 0.055) * 14
            + Math.cos(worldX * 0.03) * 10
            + Math.sin(worldX * 0.12) * 5;
        
        if(y < 330) y = 330;
        if(y > 440) y = 440;
        return y;
    }
    
    function getGroundSlope(worldX) {
        let dx = 3;
        let y1 = getGroundY(worldX - dx);
        let y2 = getGroundY(worldX + dx);
        return Math.atan2(y2 - y1, dx * 2);
    }
    
    // ========== KOIN (World space) ==========
    let coinsArray = [];
    const COIN_SIZE = 12;
    
    function spawnCoin() {
        let minX = car.worldX + 100;
        let maxX = minX + 400;
        
        let x = minX + Math.random() * (maxX - minX);
        let yGround = getGroundY(x);
        let y = yGround - 18;
        
        coinsArray.push({
            worldX: x,
            worldY: y,
            size: COIN_SIZE,
            collected: false
        });
    }
    
    function initCoins() {
        coinsArray = [];
        for(let i = 0; i < 10; i++) {
            spawnCoin();
        }
    }
    
    function updateCoins() {
        // Hapus koin yang sudah lewat jauh di belakang kamera
        coinsArray = coinsArray.filter(c => c.worldX > cameraX - 300);
        
        for(let i = 0; i < coinsArray.length; i++) {
            let c = coinsArray[i];
            if(c.collected) continue;
            
            let dx = car.worldX - c.worldX;
            let dy = car.y - c.worldY;
            let dist = Math.hypot(dx, dy);
            
            if(dist < car.width/2 + COIN_SIZE/2) {
                c.collected = true;
                coins++;
                score += 25;
                updateUI();
                playCoinSound();
            }
        }
        
        coinsArray = coinsArray.filter(c => !c.collected);
        
        while(coinsArray.length < 8) {
            spawnCoin();
        }
    }
    
    // ========== COLLISION ==========
    function getCarBottomPoints() {
        let halfW = car.width/2;
        let halfH = car.height/2;
        let cos = Math.cos(car.angle);
        let sin = Math.sin(car.angle);
        
        let points = [
            { x: -halfW + 10, y: halfH },
            { x: halfW - 10, y: halfH },
            { x: 0, y: halfH },
            { x: -halfW + 5, y: halfH - 3 },
            { x: halfW - 5, y: halfH - 3 }
        ];
        
        return points.map(p => ({
            worldX: car.worldX + p.x * cos - p.y * sin,
            y: car.y + p.x * sin + p.y * cos
        }));
    }
    
    function handleCollision() {
        let points = getCarBottomPoints();
        let maxPen = 0;
        
        for(let p of points) {
            let groundY = getGroundY(p.worldX);
            let pen = groundY - p.y;
            if(pen > maxPen) maxPen = pen;
        }
        
        if(maxPen > 0) {
            car.y += maxPen;
            car.vy = Math.max(car.vy, 0);
            car.vy *= 0.7;
            car.vx *= 0.985;
            
            let slope = getGroundSlope(car.worldX);
            let targetAngle = slope;
            let angleDiff = targetAngle - car.angle;
            car.angularVel += angleDiff * 0.15;
            car.angularVel *= 0.96;
        }
        
        let groundMid = getGroundY(car.worldX);
        if(car.y > groundMid + 5) {
            car.y = groundMid;
            car.vy = 0;
        }
    }
    
    // ========== GAME OVER ==========
    function checkGameOver() {
        let absAngle = Math.abs(car.angle);
        let angleDeg = absAngle * 57.3;
        
        angleEl.innerText = Math.floor(angleDeg);
        
        if(angleDeg > 110) {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
        
        if(angleDeg > 150) {
            gameRunning = false;
            warningEl.classList.remove('hidden');
            playCrashSound();
            updateBestScore();
            return true;
        }
        
        if(car.y > 550) {
            gameRunning = false;
            playCrashSound();
            updateBestScore();
            return true;
        }
        
        return false;
    }
    
    function updateBestScore() {
        let finalScore = Math.floor(score);
        if(finalScore > bestScore) {
            bestScore = finalScore;
            localStorage.setItem('bestScore', bestScore);
            bestEl.innerText = bestScore;
        }
    }
    
    // ========== UPDATE FISIKA ==========
    function updatePhysics() {
        if(!gameRunning) return;
        
        car.vy += GRAVITY;
        car.vx = Math.min(MAX_SPEED, Math.max(-MAX_SPEED/2, car.vx));
        car.vx *= 0.99;
        car.vy *= 0.99;
        
        // Self-balancing
        let balanceForce = -car.angle * STABILITY_FORCE;
        car.angularVel += balanceForce;
        car.angularVel *= 0.97;
        
        car.worldX += car.vx;
        car.y += car.vy;
        car.angle += car.angularVel;
        
        handleCollision();
        
        // UPDATE KAMERA: follow mobil (mobil di tengah canvas)
        cameraX = car.worldX - canvas.width / 2;
        
        // Update score & distance
        if(car.vx > 0.2) {
            distance += car.vx * 0.25;
            score += car.vx * 0.2;
        }
        
        if(car.vx < -0.5) {
            score += car.vx * 0.1;
            if(score < 0) score = 0;
        }
        
        updateUI();
        updateCoins();
        checkGameOver();
    }
    
    function updateUI() {
        scoreEl.innerText = Math.floor(score);
        coinsEl.innerText = Math.floor(coins);
        distanceEl.innerText = Math.floor(distance);
    }
    
    // ========== KONTROL ==========
    function applyGas() {
        if(!gameRunning) return;
        car.vx += GAS_FORCE;
        car.angularVel -= 0.015;
        playEngineSound();
    }
    
    function applyBrake() {
        if(!gameRunning) return;
        car.vx -= BRAKE_FORCE;
        car.angularVel += 0.01;
        playBrakeSound();
    }
    
    function resetGame() {
        gameRunning = true;
        score = 0;
        coins = 0;
        distance = 0;
        
        car = {
            worldX: 250,
            y: 0,
            vx: 0,
            vy: 0,
            angle: 0,
            angularVel: 0,
            width: 52,
            height: 32
        };
        
        let startY = getGroundY(250);
        car.y = startY - car.height/2;
        
        cameraX = car.worldX - canvas.width / 2;
        
        updateUI();
        initCoins();
        warningEl.classList.add('hidden');
        angleEl.innerText = "0";
    }
    
    // ========== SOUND ==========
    let audioCtx = null;
    
    function initAudio() {
        if(audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    function playSound(freq, duration, type = 'sine', volume = 0.1) {
        if(!audioCtx) initAudio();
        if(audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = type;
            gain.gain.value = volume;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
            osc.stop(audioCtx.currentTime + duration);
        } catch(e) {}
    }
    
    function playCoinSound() {
        playSound(880, 0.1, 'sine', 0.15);
    }
    
    function playEngineSound() {
        let f = 140 + Math.random() * 50;
        playSound(f, 0.06, 'triangle', 0.09);
    }
    
    function playBrakeSound() {
        playSound(100, 0.1, 'sawtooth', 0.1);
    }
    
    function playCrashSound() {
        playSound(70, 0.4, 'sawtooth', 0.2);
        setTimeout(() => playSound(55, 0.3, 'square', 0.15), 100);
    }
    
    // ========== GAMBAR (dengan Camera) ==========
    function worldToScreenX(worldX) {
        return worldX - cameraX;
    }
    
    function drawBackground() {
        let grad = ctx.createLinearGradient(0, 0, 0, 300);
        grad.addColorStop(0, '#87CEEB');
        grad.addColorStop(1, '#6CB4EE');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Matahari (tetap di canvas)
        ctx.fillStyle = '#FFE066';
        ctx.beginPath();
        ctx.arc(850, 70, 40, 0, Math.PI * 2);
        ctx.fill();
        
        // Awan (tetap di canvas)
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(180, 60, 45, 32, 0, 0, Math.PI * 2);
        ctx.ellipse(220, 50, 38, 30, 0, 0, Math.PI * 2);
        ctx.ellipse(140, 55, 35, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(600, 80, 40, 28, 0, 0, Math.PI * 2);
        ctx.ellipse(640, 72, 35, 26, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function drawGround() {
        ctx.beginPath();
        for(let screenX = 0; screenX <= canvas.width + 50; screenX += 10) {
            let worldX = cameraX + screenX;
            let y = getGroundY(worldX);
            if(screenX === 0) ctx.moveTo(screenX, y);
            else ctx.lineTo(screenX, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.fillStyle = '#5a3a1a';
        ctx.fill();
        
        // Garis pinggir jalan
        for(let screenX = 0; screenX <= canvas.width; screenX += 25) {
            let worldX = cameraX + screenX;
            let y = getGroundY(worldX);
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(screenX - 3, y - 5, 6, 8);
        }
        
        // Rumput
        ctx.fillStyle = '#4a8c2a';
        for(let screenX = 0; screenX < canvas.width; screenX += 18) {
            let worldX = cameraX + screenX;
            let y = getGroundY(worldX);
            ctx.fillRect(screenX - 2, y - 10, 4, 14);
        }
        
        // Bayangan
        ctx.fillStyle = '#3a2510';
        for(let screenX = 0; screenX < canvas.width; screenX += 30) {
            let worldX = cameraX + screenX;
            let y = getGroundY(worldX);
            ctx.fillRect(screenX - 1, y - 3, 2, 6);
        }
    }
    
    function drawCar() {
        // Posisi mobil di canvas (tengah layar)
        let screenX = worldToScreenX(car.worldX);
        let screenY = car.y;
        
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(car.angle);
        
        ctx.shadowBlur = 0;
        
        // Body
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(-car.width/2, -car.height/2, car.width, car.height);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-car.width/2, -car.height/2, car.width, car.height);
        
        ctx.fillStyle = '#D35400';
        ctx.fillRect(-car.width/2 + 5, -car.height/2 + 5, car.width - 10, 6);
        
        ctx.fillStyle = '#2C3E1F';
        ctx.fillRect(-car.width/3, -car.height/2 - 8, car.width/1.5, 8);
        ctx.strokeRect(-car.width/3, -car.height/2 - 8, car.width/1.5, 8);
        
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(car.width/3, -car.height/2 - 12, 7, 22);
        ctx.fillRect(-car.width/3.5, -car.height/2 - 12, 7, 22);
        
        ctx.fillStyle = '#A8D8EA';
        ctx.fillRect(-car.width/4, -car.height/2 - 4, car.width/2.2, 8);
        ctx.strokeRect(-car.width/4, -car.height/2 - 4, car.width/2.2, 8);
        
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(car.width/2 - 5, -car.height/4, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(car.width/2 - 5, car.height/4, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.ellipse(-car.width/3, car.height/2 - 2, 12, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(car.width/3, car.height/2 - 2, 12, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-car.width/3, car.height/2 - 2, 12, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(car.width/3, car.height/2 - 2, 12, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        ctx.ellipse(-car.width/3, car.height/2 - 2, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(car.width/3, car.height/2 - 2, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#333';
        for(let i = -1; i <= 1; i++) {
            ctx.fillRect(-car.width/3 - 5 + i*5, car.height/2 - 6, 2, 11);
            ctx.fillRect(car.width/3 - 5 + i*5, car.height/2 - 6, 2, 11);
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = "bold 11px monospace";
        ctx.fillText("4x4", car.width/4, -car.height/3);
        
        ctx.fillStyle = '#FFFF99';
        ctx.beginPath();
        ctx.rect(car.width/2 - 3, car.height/3, 4, 4);
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawCoins() {
        for(let c of coinsArray) {
            let screenX = worldToScreenX(c.worldX);
            if(screenX > -50 && screenX < canvas.width + 50) {
                let glow = Math.sin(Date.now() * 0.008) * 2;
                ctx.beginPath();
                ctx.arc(screenX, c.worldY, COIN_SIZE/1.5 + glow/4, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                ctx.fillStyle = '#DAA520';
                ctx.font = "bold 14px monospace";
                ctx.fillText("★", screenX - 4, c.worldY + 5);
            }
        }
    }
    
    // ========== ANIMASI ==========
    function animate() {
        updatePhysics();
        drawBackground();
        drawGround();
        drawCoins();
        drawCar();
        requestAnimationFrame(animate);
    }
    
    // ========== EVENT ==========
    function bindEvents() {
        document.getElementById('gasBtn').addEventListener('click', (e) => {
            e.preventDefault();
            applyGas();
        });
        
        document.getElementById('brakeBtn').addEventListener('click', (e) => {
            e.preventDefault();
            applyBrake();
        });
        
        document.getElementById('resetBtn').addEventListener('click', (e) => {
            e.preventDefault();
            resetGame();
        });
        
        window.addEventListener('keydown', (e) => {
            if(e.key === 'ArrowUp') {
                applyGas();
                e.preventDefault();
            }
            if(e.key === 'ArrowDown') {
                applyBrake();
                e.preventDefault();
            }
            if(e.key === 'r' || e.key === 'R') {
                resetGame();
                e.preventDefault();
            }
        });
        
        canvas.addEventListener('click', () => {
            if(audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        });
        
        canvas.addEventListener('touchstart', () => {
            if(audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        });
    }
    
    // ========== START ==========
    function start() {
        initAudio();
        resetGame();
        bindEvents();
        animate();
    }
    
    start();
})();