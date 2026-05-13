(function() {
    'use strict';
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    let W, H;
    
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Audio System
    const AudioSystem = {
        ctx: null,
        init() {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch(e) {}
        },
        play(type) {
            if (!this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                const now = this.ctx.currentTime;
                
                switch(type) {
                    case 'jump':
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                        osc.start(now);
                        osc.stop(now + 0.1);
                        break;
                    case 'land':
                        osc.frequency.setValueAtTime(150, now);
                        osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                        osc.start(now);
                        osc.stop(now + 0.05);
                        break;
                    case 'coin':
                        osc.frequency.setValueAtTime(800, now);
                        osc.frequency.setValueAtTime(1000, now + 0.05);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                        osc.start(now);
                        osc.stop(now + 0.1);
                        break;
                    case 'death':
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(400, now);
                        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                        osc.start(now);
                        osc.stop(now + 0.5);
                        break;
                    case 'checkpoint':
                        osc.frequency.setValueAtTime(400, now);
                        osc.frequency.setValueAtTime(500, now + 0.1);
                        osc.frequency.setValueAtTime(600, now + 0.2);
                        osc.frequency.setValueAtTime(800, now + 0.3);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.setValueAtTime(0.2, now + 0.35);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                        osc.start(now);
                        osc.stop(now + 0.4);
                        break;
                    case 'gameover':
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                        gain.gain.setValueAtTime(0.2, now);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                        osc.start(now);
                        osc.stop(now + 0.3);
                        break;
                }
            } catch(e) {}
        }
    };
    
    // Game State
    const GameState = {
        MENU: 'menu',
        PLAYING: 'playing',
        GAMEOVER: 'gameover',
        SKINS: 'skins'
    };
    
    // Game Variables
    let state = GameState.MENU;
    let height = 0;
    let maxHeight = 0;
    let bestHeight = parseInt(localStorage.getItem('towerchaos_best') || '0');
    let coins = parseInt(localStorage.getItem('towerchaos_coins') || '0');
    let coinsThisRun = 0;
    let checkpointHeight = 0;
    let currentCheckpoint = 0;
    let screenShake = { x: 0, y: 0, intensity: 0 };
    let timeScale = 1;
    
    // Skins
    const SKINS = [
        { id: 'default', name: 'Climber', color: '#4ade80', price: 0, unlocked: true },
        { id: 'knight', name: 'Cardboard Knight', color: '#a78bfa', price: 10, unlocked: false },
        { id: 'toaster', name: 'Toaster Man', color: '#fbbf24', price: 25, unlocked: false },
        { id: 'duck', name: 'Rubber Duck', color: '#fb923c', price: 40, unlocked: false },
        { id: 'alien', name: 'Alien', color: '#22d3d3', price: 55, unlocked: false },
        { id: 'banana', name: 'Banana Hero', color: '#fde047', price: 70, unlocked: false },
        { id: 'robot', name: 'Robot', color: '#94a3b8', price: 85, unlocked: false },
        { id: 'ghost', name: 'Ghost', color: '#e2e8f0', price: 100, unlocked: false },
        { id: 'fire', name: 'Fire Hero', color: '#ef4444', price: 125, unlocked: false },
        { id: 'ice', name: 'Ice Hero', color: '#67e8f9', price: 150, unlocked: false },
        { id: 'ninja', name: 'Ninja', color: '#1f2937', price: 175, unlocked: false },
        { id: 'rainbow', name: 'Rainbow', color: 'rainbow', price: 200, unlocked: false },
        { id: 'diamond', name: 'Diamond', color: '#e879f9', price: 250, unlocked: false },
        { id: 'gold', name: 'Golden', color: '#f59e0b', price: 300, unlocked: false },
        { id: 'cosmic', name: 'Cosmic', color: 'cosmic', price: 500, unlocked: false }
    ];
    
    let selectedSkin = localStorage.getItem('towerchaos_skin') || 'default';
    let unlockedSkins = JSON.parse(localStorage.getItem('towerchaos_unlocked') || '["default"]');
    let selectedSkinInShop = null;
    
    // Player
    const player = {
        x: 0, y: 0,
        vx: 0, vy: 0,
        width: 30, height: 40,
        grounded: false,
        coyoteTime: 0,
        jumpBuffer: 0,
        jumpHeld: false,
        squash: 1,
        stretch: 1,
        facingRight: true,
        trail: [],
        maxTrail: 8
    };
    
    // Physics Constants
    const GRAVITY = 0.6;
    const JUMP_FORCE = -14;
    const MOVE_SPEED = 6;
    const FRICTION = 0.85;
    const AIR_FRICTION = 0.92;
    const COYOTE_TIME = 8;
    const JUMP_BUFFER_TIME = 8;
    
    // World
    let platforms = [];
    let traps = [];
    let coins_arr = [];
    let particles = [];
    let backgroundObjects = [];
    
    const PLATFORM_WIDTH_MIN = 80;
    const PLATFORM_WIDTH_MAX = 180;
    const PLATFORM_HEIGHT = 20;
    const VERTICAL_GAP_MIN = 80;
    const VERTICAL_GAP_MAX = 140;
    const HORIZONTAL_OFFSET_MAX = 200;
    
    // Biome Colors
    const BIOMES = [
        { name: 'simple', start: 0, bg: '#1a1a2e', platforms: '#4ade80', accent: '#22c55e' },
        { name: 'neon', start: 100, bg: '#0f0f23', platforms: '#e879f9', accent: '#d946ef' },
        { name: 'industrial', start: 300, bg: '#1c1917', platforms: '#f97316', accent: '#ea580c' },
        { name: 'corruption', start: 500, bg: '#18181b', platforms: '#dc2626', accent: '#b91c1c' },
        { name: 'cosmic', start: 800, bg: '#0c0a1d', platforms: '#818cf8', accent: '#6366f1' }
    ];
    
    function getCurrentBiome() {
        let biome = BIOMES[0];
        for (let b of BIOMES) {
            if (height >= b.start) biome = b;
        }
        return biome;
    }
    
    // Trap Types
    const TRAP_TYPES = ['moving', 'falling', 'hammer', 'push', 'laser', 'ice', 'bounce', 'fake', 'wind', 'gravity', 'walls', 'swing'];
    
    let autoJumpCooldown = 0;
    
    // Input
    const input = {
        left: false,
        right: false,
        jump: false,
        jumpPressed: false,
        joystickX: 0
    };
    
    let inputCooldown = { left: 0, right: 0, jump: 0 };
    
    // Mobile Controls
    let joystickActive = false;
    let joystickStartX = 0, joystickStartY = 0;
    let jumpButtonPressed = false;
    
    // Platform Generation
    let lastPlatformY = 0;
    let generatedUpTo = 0;
    
    function generatePlatform(y) {
        const biome = getCurrentBiome();
        const difficulty = Math.min(height / 500, 1);
        
        const width = PLATFORM_WIDTH_MIN + Math.random() * (PLATFORM_WIDTH_MAX - PLATFORM_WIDTH_MIN) * (1 - difficulty * 0.3);
        
        let x;
        if (platforms.length === 0) {
            x = W / 2 - width / 2;
        } else {
            const lastPlatform = platforms[platforms.length - 1];
            const lastCenter = lastPlatform.x + lastPlatform.width / 2;
            const maxOffset = HORIZONTAL_OFFSET_MAX * (0.5 + difficulty * 0.5);
            x = lastCenter - width / 2 + (Math.random() - 0.5) * maxOffset * 2;
            x = Math.max(50, Math.min(W - width - 50, x));
        }
        
        const platform = {
            x, y, width, height: PLATFORM_HEIGHT,
            type: 'normal',
            color: biome.platforms
        };
        
        platforms.push(platform);
        
        // Coins
        if (Math.random() < 0.3) {
            const coinX = x + Math.random() * (width - 20) + 10;
            coins_arr.push({ x: coinX, y: y - 30, collected: false, bobOffset: Math.random() * Math.PI * 2 });
        }
        
        // Traps (based on height)
        if (height > 20 && Math.random() < 0.15 + difficulty * 0.25) {
            const trapType = TRAP_TYPES[Math.floor(Math.random() * Math.min(TRAP_TYPES.length, 3 + Math.floor(difficulty * 9)))];
            spawnTrap(trapType, x + width / 2, y);
        }
        
        return platform;
    }
    
    function spawnTrap(type, x, y) {
        switch(type) {
            case 'moving':
                traps.push({
                    type: 'moving', x, y,
                    width: 100, height: 15,
                    vx: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2),
                    minX: 50, maxX: W - 150,
                    color: '#ff6b6b'
                });
                break;
            case 'falling':
                traps.push({
                    type: 'falling', x, y,
                    width: 80, height: 15,
                    fallTimer: 0, falling: false, vy: 0,
                    color: '#f97316'
                });
                break;
            case 'hammer':
                traps.push({
                    type: 'hammer', x, y: y - 60,
                    width: 20, height: 60,
                    angle: 0, speed: 0.05 + Math.random() * 0.05,
                    color: '#a1a1aa'
                });
                break;
            case 'push':
                traps.push({
                    type: 'push', x, y: y - 25,
                    width: 40, height: 25,
                    vx: 0, pushDir: 1, pushTimer: 0,
                    color: '#84cc16'
                });
                break;
            case 'laser':
                traps.push({
                    type: 'laser', x, y: y - 100,
                    width: 5, height: 100,
                    active: true, timer: 0, interval: 60 + Math.random() * 60,
                    color: '#ef4444'
                });
                break;
            case 'ice':
                traps.push({
                    type: 'ice', x, y,
                    width: 80 + Math.random() * 60, height: 12,
                    color: '#67e8f9'
                });
                break;
            case 'bounce':
                traps.push({
                    type: 'bounce', x, y,
                    width: 50, height: 15,
                    bounceForce: -20,
                    color: '#fbbf24'
                });
                break;
            case 'fake':
                traps.push({
                    type: 'fake', x, y,
                    width: 60, height: 15,
                    breakTimer: 0, broken: false,
                    color: '#a78bfa'
                });
                break;
            case 'wind':
                traps.push({
                    type: 'wind', x, y,
                    width: 100, height: 200,
                    strength: 3 + Math.random() * 2,
                    direction: Math.random() > 0.5 ? 1 : -1,
                    color: '#22d3d3'
                });
                break;
            case 'gravity':
                traps.push({
                    type: 'gravity', x, y,
                    width: 80, height: 150,
                    strength: 0.3,
                    color: '#6366f1'
                });
                break;
            case 'walls':
                traps.push({
                    type: 'walls', x: x < W / 2 ? 0 : W - 60,
                    y: y - 100,
                    width: 60, height: 150,
                    vx: x < W / 2 ? 2 : -2,
                    color: '#dc2626'
                });
                break;
            case 'swing':
                traps.push({
                    type: 'swing', x, y: y - 80,
                    length: 80,
                    angle: Math.random() * 0.5,
                    angleVel: 0,
                    color: '#f59e0b'
                });
                break;
        }
    }
    
    // Particles
    function spawnParticle(x, y, vx, vy, color, life, size) {
        particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
    }
    
    function spawnLandingDust(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.PI + (Math.random() - 0.5) * Math.PI;
            const speed = 2 + Math.random() * 3;
            spawnParticle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 1,
                '#ffffff',
                20 + Math.random() * 10,
                3 + Math.random() * 3
            );
        }
    }
    
    function spawnJumpEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            spawnParticle(
                x + (Math.random() - 0.5) * 20,
                y,
                (Math.random() - 0.5) * 3,
                Math.random() * 2,
                '#4ade80',
                15,
                2 + Math.random() * 2
            );
        }
    }
    
    // Initialize
    function init() {
        platforms = [];
        traps = [];
        coins_arr = [];
        particles = [];
        height = 0;
        maxHeight = 0;
        coinsThisRun = 0;
        checkpointHeight = currentCheckpoint;
        
        player.x = W / 2;
        player.y = H - 100;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.coyoteTime = 0;
        player.jumpBuffer = 0;
        player.squash = 1;
        player.stretch = 1;
        player.trail = [];
        
        lastPlatformY = H - 50;
        generatedUpTo = H - 50;
        
        const startPlatform = { x: W / 2 - 100, y: H - 50, width: 200, height: PLATFORM_HEIGHT, type: 'normal', color: getCurrentBiome().platforms };
        platforms.push(startPlatform);
        
        while (generatedUpTo > -H) {
            generatedUpTo -= VERTICAL_GAP_MIN + Math.random() * (VERTICAL_GAP_MAX - VERTICAL_GAP_MIN);
            generatePlatform(generatedUpTo);
        }
    }
    
    function respawnAtCheckpoint() {
        // Find nearest platform above checkpoint
        let spawnY = checkpointHeight * 10 + H / 2;
        let spawnPlatform = null;
        
        for (let p of platforms) {
            if (p.y > spawnY - 50 && p.y < spawnY + 200) {
                spawnPlatform = p;
                break;
            }
        }
        
        if (!spawnPlatform) {
            spawnPlatform = platforms[Math.min(Math.floor((H - spawnY) / 100), platforms.length - 1)];
        }
        
        player.x = spawnPlatform.x + spawnPlatform.width / 2;
        player.y = spawnPlatform.y - player.height;
        player.vx = 0;
        player.vy = 0;
        player.grounded = true;
        player.coyoteTime = COYOTE_TIME;
    }
    
    // Update
    function update() {
        if (state !== GameState.PLAYING) return;
        
        const biome = getCurrentBiome();
        
        // Input cooldowns
        if (inputCooldown.left > 0) inputCooldown.left--;
        if (inputCooldown.right > 0) inputCooldown.right--;
        if (inputCooldown.jump > 0) inputCooldown.jump--;
        if (autoJumpCooldown > 0) autoJumpCooldown--;
        
        // Player Input
        let moveX = 0;
        if (input.left && inputCooldown.left === 0) moveX -= 1;
        if (input.right && inputCooldown.right === 0) moveX += 1;
        
        // Touch input (lower sensitivity)
        const touchInput = input.joystickX * 0.5;
        if (touchInput < -0.5) moveX -= 1;
        if (touchInput > 0.5) moveX += 1;
        
        if (moveX !== 0) {
            player.vx += moveX * MOVE_SPEED * 0.3;
            player.facingRight = moveX > 0;
            inputCooldown.left = input.left ? 3 : 0;
            inputCooldown.right = input.right ? 3 : 0;
        }
        
        // Apply friction
        const currentFriction = player.grounded ? FRICTION : AIR_FRICTION;
        player.vx *= currentFriction;
        
        // Gravity
        player.vy += GRAVITY;
        
        // Jump buffer from input
        if (input.jumpPressed) {
            player.jumpBuffer = JUMP_BUFFER_TIME;
            input.jumpPressed = false;
        }
        
        // Auto-jump when holding space (only trigger once per ground)
        const canJump = player.grounded || player.coyoteTime > 0;
        if (input.jumpHeld && canJump && autoJumpCooldown === 0) {
            player.jumpBuffer = JUMP_BUFFER_TIME;
        }
        
        if (player.jumpBuffer > 0 && canJump) {
            player.vy = JUMP_FORCE;
            player.grounded = false;
            player.coyoteTime = 0;
            player.jumpBuffer = 0;
            player.stretch = 1.3;
            player.squash = 0.7;
            spawnJumpEffect(player.x + player.width / 2, player.y + player.height);
            AudioSystem.play('jump');
            autoJumpCooldown = 8;
        }
        
        if (player.jumpBuffer > 0) player.jumpBuffer--;
        if (player.coyoteTime > 0) player.coyoteTime--;
        
        // Move
        player.x += player.vx;
        player.y += player.vy;
        
        // Squash/stretch recovery
        player.squash += (1 - player.squash) * 0.2;
        player.stretch += (1 - player.stretch) * 0.2;
        
        // Trail
        player.trail.unshift({ x: player.x + player.width / 2, y: player.y + player.height / 2 });
        if (player.trail.length > player.maxTrail) player.trail.pop();
        
        // Platform collision
        player.grounded = false;
        
        for (let p of platforms) {
            if (p.removed) continue;
            
            // Check if landing on platform
            if (player.vy >= 0 &&
                player.x + player.width > p.x &&
                player.x < p.x + p.width &&
                player.y + player.height > p.y &&
                player.y + player.height < p.y + p.height + player.vy + 5) {
                
                player.y = p.y - player.height;
                
                if (player.vy > 5) {
                    player.squash = 1.4;
                    player.stretch = 0.6;
                    spawnLandingDust(player.x + player.width / 2, p.y);
                    AudioSystem.play('land');
                }
                
                player.vy = 0;
                player.grounded = true;
                player.coyoteTime = COYOTE_TIME;
            }
        }
        
        // Trap collision
        for (let t of traps) {
            if (t.removed) continue;
            
            let collision = false;
            let tx = t.x, ty = t.y, tw = t.width, th = t.height;
            
            if (t.type === 'hammer') {
                const cos = Math.cos(t.angle);
                const sin = Math.sin(t.angle);
                tx = t.x - tw / 2;
                ty = t.y;
                collision = rectCollision(player.x, player.y, player.width, player.height, tx, ty, tw, th);
                if (collision) {
                    const hitX = player.x + player.width / 2 - t.x;
                    player.vx += hitX * 0.3;
                    player.vy = -8;
                    screenShake.intensity = 10;
                }
            } else if (t.type === 'swing') {
                const sx = t.x + Math.sin(t.angle) * t.length;
                const sy = t.y + Math.cos(t.angle) * t.length;
                const ballDist = Math.hypot(player.x + player.width / 2 - sx, player.y + player.height / 2 - sy);
                if (ballDist < 25) {
                    collision = true;
                    const angle = Math.atan2(player.y + player.height / 2 - sy, player.x + player.width / 2 - sx);
                    player.vx += Math.cos(angle) * 8;
                    player.vy += Math.sin(angle) * 8 - 5;
                    screenShake.intensity = 8;
                }
            } else if (t.type === 'laser' && t.active) {
                collision = rectCollision(player.x, player.y, player.width, player.height, tx - 2, ty, tw + 4, th);
            } else if (t.type === 'walls') {
                collision = rectCollision(player.x, player.y, player.width, player.height, tx, ty, tw, th);
            } else if (t.type === 'moving' || t.type === 'falling' || t.type === 'ice' || t.type === 'bounce' || t.type === 'fake' || t.type === 'push') {
                collision = rectCollision(player.x, player.y, player.width, player.height, tx, ty, tw, th);
            } else if (t.type === 'wind' || t.type === 'gravity') {
                if (rectCollision(player.x, player.y, player.width, player.height, tx, ty, tw, th)) {
                    if (t.type === 'wind') {
                        player.vx += t.direction * t.strength * 0.1;
                    } else {
                        player.vy += t.strength;
                    }
                }
            }
            
            if (collision && t.type !== 'wind' && t.type !== 'gravity' && t.type !== 'swing') {
                if (t.type === 'bounce') {
                    player.vy = t.bounceForce;
                    player.stretch = 1.4;
                    player.squash = 0.6;
                    screenShake.intensity = 5;
                } else if (t.type === 'push') {
                    player.vx += t.pushDir * 8;
                } else if (t.type === 'moving') {
                    player.vx += t.vx * 0.5;
                    player.x += t.vx;
                } else if (t.type !== 'fake') {
                    die();
                    return;
                }
            }
            
            if (t.type === 'fake' && collision && !t.broken) {
                t.broken = true;
                t.breakTimer = 10;
            }
        }
        
        // Coin collection
        for (let c of coins_arr) {
            if (c.collected) continue;
            const dist = Math.hypot(player.x + player.width / 2 - c.x, player.y + player.height / 2 - c.y);
            if (dist < 30) {
                c.collected = true;
                coinsThisRun++;
                coins++;
                AudioSystem.play('coin');
                for (let i = 0; i < 5; i++) {
                    spawnParticle(c.x, c.y, (Math.random() - 0.5) * 5, -Math.random() * 5, '#fbbf24', 20, 4);
                }
            }
        }
        
        // Update traps
        for (let t of traps) {
            if (t.removed) continue;
            
            switch(t.type) {
                case 'moving':
                    t.x += t.vx;
                    if (t.x < t.minX || t.x > t.maxX) t.vx *= -1;
                    break;
                case 'falling':
                    if (player.grounded) {
                        const dist = Math.hypot(player.x - t.x, player.y + player.height - t.y);
                        if (dist < t.width) t.falling = true;
                    }
                    if (t.falling) {
                        t.vy += 0.5;
                        t.y += t.vy;
                        if (t.y > lastPlatformY + 500) t.removed = true;
                    }
                    break;
                case 'hammer':
                    t.angle += t.speed;
                    break;
                case 'push':
                    t.pushTimer++;
                    if (t.pushTimer > 30) {
                        t.pushDir *= -1;
                        t.pushTimer = 0;
                    }
                    t.x += t.pushDir * 3;
                    break;
                case 'laser':
                    t.timer++;
                    if (t.timer > t.interval) {
                        t.active = !t.active;
                        t.timer = 0;
                    }
                    break;
                case 'fake':
                    if (t.broken && t.breakTimer > 0) {
                        t.breakTimer--;
                        if (t.breakTimer === 0) {
                            t.removed = true;
                            platforms = platforms.filter(p => p !== t);
                        }
                    }
                    break;
                case 'walls':
                    t.y += t.vx;
                    if (t.y < checkpointHeight * 10 - 100 || t.y > checkpointHeight * 10 + H) {
                        t.vx *= -1;
                    }
                    break;
                case 'swing':
                    t.angleVel += Math.sin(t.angle) * 0.001;
                    t.angleVel *= 0.999;
                    t.angle += t.angleVel;
                    break;
            }
        }
        
        // Wall boundaries
        if (player.x < 0) {
            player.x = 0;
            player.vx *= -0.5;
        }
        if (player.x + player.width > W) {
            player.x = W - player.width;
            player.vx *= -0.5;
        }
        
        // Update height
        const newHeight = Math.floor((H - player.y) / 10);
        if (newHeight > maxHeight) {
            maxHeight = newHeight;
            height = maxHeight;
        }
        
        // Checkpoint
        const newCheckpoint = Math.floor(height / 100);
        if (newCheckpoint > currentCheckpoint) {
            currentCheckpoint = newCheckpoint;
            checkpointHeight = currentCheckpoint * 100;
            showCheckpointFlash();
            AudioSystem.play('checkpoint');
        }
        
        // Death (fell off)
        if (player.y > lastPlatformY + 300) {
            die();
            return;
        }
        
        // Generate more platforms
        while (generatedUpTo > player.y - H) {
            generatedUpTo -= VERTICAL_GAP_MIN + Math.random() * (VERTICAL_GAP_MAX - VERTICAL_GAP_MIN);
            generatePlatform(generatedUpTo);
        }
        
        // Remove old platforms
        platforms = platforms.filter(p => p.y < player.y + H * 2 && !p.removed);
        traps = traps.filter(t => !t.removed && t.y < player.y + H * 2);
        coins_arr = coins_arr.filter(c => !c.collected && c.y < player.y + H * 2);
        
        // Update particles
        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
        }
        particles = particles.filter(p => p.life > 0);
        
        // Screen shake
        if (screenShake.intensity > 0) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.intensity *= 0.9;
        }
        
        // Update UI
        updateUI();
    }
    
    function rectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    function die() {
        AudioSystem.play('death');
        screenShake.intensity = 15;
        
        // Death particles
        for (let i = 0; i < 20; i++) {
            spawnParticle(
                player.x + player.width / 2,
                player.y + player.height / 2,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                '#ff6b6b',
                30,
                4 + Math.random() * 4
            );
        }
        
        // Save best
        if (height > bestHeight) {
            bestHeight = height;
            localStorage.setItem('towerchaos_best', bestHeight);
        }
        localStorage.setItem('towerchaos_coins', coins);
        
        state = GameState.GAMEOVER;
        AudioSystem.play('gameover');
        showGameOver();
    }
    
    function showCheckpointFlash() {
        const el = document.getElementById('checkpoint-flash');
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1000);
    }
    
    function updateUI() {
        document.querySelector('#current-height span').textContent = height;
        document.querySelector('#best-height span').textContent = bestHeight;
        document.getElementById('coins-count').textContent = coins;
    }
    
    function showGameOver() {
        document.getElementById('final-height').textContent = height;
        document.getElementById('final-best').textContent = bestHeight;
        document.getElementById('coins-earned').textContent = coinsThisRun;
        document.getElementById('game-over').classList.add('active');
    }
    
    // Draw
    function draw() {
        ctx.save();
        ctx.translate(screenShake.x, screenShake.y);
        
        const biome = getCurrentBiome();
        
        // Background
        ctx.fillStyle = biome.bg;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        
        // Background decorations
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 20; i++) {
            const x = (i * 100 + height * 0.1) % (W + 100) - 50;
            const y = ((i * 200 + height * 0.05) % (H + 200)) - 100;
            ctx.fillStyle = biome.accent;
            ctx.fillRect(x, y, 3, 100);
        }
        ctx.globalAlpha = 1;
        
        // Camera offset
        const camY = player.y - H / 2;
        
        ctx.save();
        ctx.translate(0, -camY);
        
        // Platforms
        for (let p of platforms) {
            if (p.removed) continue;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            
            // Platform highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(p.x, p.y, p.width, 4);
        }
        
        // Traps
        for (let t of traps) {
            if (t.removed) continue;
            
            ctx.fillStyle = t.color;
            
            switch(t.type) {
                case 'moving':
                case 'falling':
                case 'ice':
                case 'fake':
                case 'bounce':
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    break;
                case 'hammer':
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    ctx.rotate(t.angle);
                    ctx.fillRect(-t.width / 2, 0, t.width, t.height);
                    ctx.fillStyle = '#52525b';
                    ctx.beginPath();
                    ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    break;
                case 'push':
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.fillStyle = '#65a30d';
                    ctx.fillRect(t.x + (t.pushDir > 0 ? t.width - 5 : 0), t.y + 5, 5, t.height - 10);
                    break;
                case 'laser':
                    if (t.active) {
                        ctx.shadowColor = t.color;
                        ctx.shadowBlur = 20;
                        ctx.fillRect(t.x, t.y, t.width, t.height);
                        ctx.shadowBlur = 0;
                    } else {
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(t.x, t.y, t.width, t.height);
                        ctx.globalAlpha = 1;
                    }
                    break;
                case 'wind':
                    ctx.globalAlpha = 0.2;
                    for (let i = 0; i < 5; i++) {
                        const wy = t.y + i * (t.height / 5);
                        ctx.beginPath();
                        ctx.moveTo(t.x, wy);
                        ctx.lineTo(t.x + t.width * t.direction, wy + 20);
                        ctx.lineTo(t.x, wy + 40);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    break;
                case 'gravity':
                    ctx.globalAlpha = 0.2;
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = t.color;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(t.x, t.y, t.width, t.height);
                    ctx.setLineDash([]);
                    break;
                case 'walls':
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.fillStyle = '#991b1b';
                    ctx.fillRect(t.x + (t.vx > 0 ? 0 : t.width - 5), t.y, 5, t.height);
                    break;
                case 'swing':
                    const sx = t.x + Math.sin(t.angle) * t.length;
                    const sy = t.y + Math.cos(t.angle) * t.length;
                    ctx.strokeStyle = '#78716c';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(t.x, t.y);
                    ctx.lineTo(sx, sy);
                    ctx.stroke();
                    ctx.fillStyle = t.color;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
        }
        
        // Coins
        const time = Date.now() / 1000;
        for (let c of coins_arr) {
            if (c.collected) continue;
            const bob = Math.sin(time * 3 + c.bobOffset) * 5;
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(c.x, c.y + bob, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(c.x - 3, c.y + bob - 3, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Player trail
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < player.trail.length; i++) {
            const t = player.trail[i];
            const alpha = (1 - i / player.trail.length) * 0.3;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = getSkinColor();
            ctx.beginPath();
            ctx.arc(t.x, t.y, player.width / 2 * (1 - i / player.trail.length), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        // Player
        if (state === GameState.PLAYING) {
            ctx.save();
            ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
            ctx.scale(player.squash, player.stretch);
            ctx.translate(-player.width / 2, -player.height / 2);
            
            const skinColor = getSkinColor();
            
            // Body
            ctx.fillStyle = skinColor;
            if (skinColor === 'rainbow') {
                const hue = (Date.now() / 10) % 360;
                ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
            } else if (skinColor === 'cosmic') {
                const gradient = ctx.createLinearGradient(0, 0, player.width, player.height);
                const hue = (Date.now() / 10) % 360;
                gradient.addColorStop(0, `hsl(${hue}, 80%, 60%)`);
                gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 80%, 60%)`);
                gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 80%, 60%)`);
                ctx.fillStyle = gradient;
            }
            
            // Main body
            ctx.beginPath();
            ctx.roundRect(2, 5, player.width - 4, player.height - 15, 8);
            ctx.fill();
            
            // Head
            ctx.beginPath();
            ctx.arc(player.width / 2, 10, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(player.width / 2 - 4, 8, 4, 0, Math.PI * 2);
            ctx.arc(player.width / 2 + 4, 8, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#1a1a2e';
            const eyeOffset = player.facingRight ? 1 : -1;
            ctx.beginPath();
            ctx.arc(player.width / 2 - 4 + eyeOffset, 8, 2, 0, Math.PI * 2);
            ctx.arc(player.width / 2 + 4 + eyeOffset, 8, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Legs
            ctx.fillStyle = '#1a1a2e';
            const legOffset = Math.sin(Date.now() / 100) * (Math.abs(player.vx) > 0.5 ? 5 : 0);
            ctx.fillRect(5, player.height - 12, 8, 12 + legOffset);
            ctx.fillRect(player.width - 13, player.height - 12, 8, 12 - legOffset);
            
            ctx.restore();
        }
        
        // Particles
        for (let p of particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        ctx.restore();
        ctx.restore();
    }
    
    function getSkinColor() {
        const skin = SKINS.find(s => s.id === selectedSkin);
        return skin ? skin.color : '#4ade80';
    }
    
    // Game Loop
    let lastTime = 0;
    function gameLoop(timestamp) {
        const dt = timestamp - lastTime;
        lastTime = timestamp;
        
        update();
        draw();
        
        requestAnimationFrame(gameLoop);
    }
    
    // Input Handlers
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
        }
        
        if (state === GameState.PLAYING) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                if (!input.left) inputCooldown.left = 5;
                input.left = true;
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                if (!input.right) inputCooldown.right = 5;
                input.right = true;
            }
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (!input.jumpHeld) {
                    input.jumpPressed = true;
                }
                input.jumpHeld = true;
            }
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            input.jumpHeld = false;
        }
    });
    
    // Mobile controls
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    const jumpButton = document.getElementById('jump-button');
    
    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = joystickBase.getBoundingClientRect();
        joystickStartX = rect.left + rect.width / 2;
        joystickStartY = rect.top + rect.height / 2;
        joystickActive = true;
    });
    
    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        const touch = e.touches[0];
        const dx = touch.clientX - joystickStartX;
        const dy = touch.clientY - joystickStartY;
        const dist = Math.min(Math.hypot(dx, dy), 40);
        const angle = Math.atan2(dy, dx);
        const stickX = Math.cos(angle) * dist;
        const stickY = Math.sin(angle) * dist;
        joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
        input.joystickX = dx / 40;
    });
    
    joystickBase.addEventListener('touchend', () => {
        joystickActive = false;
        joystickStick.style.transform = 'translate(-50%, -50%)';
        input.joystickX = 0;
    });
    
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!input.jumpHeld) {
            input.jumpPressed = true;
        }
        input.jumpHeld = true;
        jumpButton.style.transform = 'scale(0.9)';
    });
    
    jumpButton.addEventListener('touchend', () => {
        input.jumpHeld = false;
        jumpButton.style.transform = 'scale(1)';
    });
    
    // UI Buttons
    document.getElementById('play-btn').addEventListener('click', () => {
        AudioSystem.init();
        init();
        state = GameState.PLAYING;
        document.getElementById('main-menu').classList.remove('active');
    });
    
    document.getElementById('retry-btn').addEventListener('click', () => {
        init();
        state = GameState.PLAYING;
        document.getElementById('game-over').classList.remove('active');
    });
    
    document.getElementById('revive-btn').addEventListener('click', () => {
        showRewardedAd(() => {
            currentCheckpoint = Math.floor(checkpointHeight / 100);
            init();
            respawnAtCheckpoint();
            state = GameState.PLAYING;
            document.getElementById('game-over').classList.remove('active');
        });
    });
    
    document.getElementById('menu-btn').addEventListener('click', () => {
        document.getElementById('game-over').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
        document.getElementById('menu-best').textContent = bestHeight;
        state = GameState.MENU;
    });
    
    document.getElementById('skins-btn').addEventListener('click', () => {
        document.getElementById('main-menu').classList.remove('active');
        document.getElementById('skins-menu').classList.add('active');
        renderSkins();
    });
    
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('skins-menu').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
    });
    
    function renderSkins() {
        const grid = document.getElementById('skins-grid');
        grid.innerHTML = '';
        document.getElementById('skins-coins').textContent = coins;
        
        const buyBtn = document.getElementById('buy-btn');
        buyBtn.classList.remove('show');
        selectedSkinInShop = null;
        
        SKINS.forEach(skin => {
            const unlocked = unlockedSkins.includes(skin.id);
            const item = document.createElement('div');
            item.className = 'skin-item' + (selectedSkin === skin.id ? ' selected' : '');
            
            const preview = document.createElement('div');
            preview.className = 'skin-preview';
            preview.style.background = skin.color === 'rainbow' 
                ? 'linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff)' 
                : skin.color === 'cosmic'
                ? 'linear-gradient(135deg, #818cf8, #e879f9, #22d3d3)'
                : skin.color;
            preview.style.borderRadius = '50%';
            
            const name = document.createElement('div');
            name.className = 'skin-name';
            name.textContent = skin.name + (unlocked ? '' : ' - ' + skin.price);
            
            item.appendChild(preview);
            item.appendChild(name);
            
            item.addEventListener('click', () => {
                if (unlocked) {
                    selectedSkin = skin.id;
                    localStorage.setItem('towerchaos_skin', selectedSkin);
                    renderSkins();
                } else {
                    selectedSkinInShop = skin;
                    document.querySelectorAll('.skin-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    document.getElementById('buy-price').textContent = skin.price;
                    buyBtn.classList.add('show');
                }
            });
            
            grid.appendChild(item);
        });
    }
    
    document.getElementById('buy-btn').addEventListener('click', () => {
        if (selectedSkinInShop && !unlockedSkins.includes(selectedSkinInShop.id)) {
            if (coins >= selectedSkinInShop.price) {
                coins -= selectedSkinInShop.price;
                unlockedSkins.push(selectedSkinInShop.id);
                localStorage.setItem('towerchaos_coins', coins);
                localStorage.setItem('towerchaos_unlocked', JSON.stringify(unlockedSkins));
                selectedSkin = selectedSkinInShop.id;
                localStorage.setItem('towerchaos_skin', selectedSkin);
                renderSkins();
            }
        }
    });
    
    // Yandex Games Integration Placeholders
    function showRewardedAd(callback) {
        console.log('[Tower Chaos] Show rewarded ad (placeholder)');
        if (callback) callback();
    }
    
    function showFullscreenAd(callback) {
        console.log('[Tower Chaos] Show fullscreen ad (placeholder)');
        if (callback) callback();
    }
    
    function saveBestScore(score) {
        localStorage.setItem('towerchaos_best', score);
    }
    
    function loadBestScore() {
        return parseInt(localStorage.getItem('towerchaos_best') || '0');
    }
    
    // Initialize menu
    document.getElementById('menu-best').textContent = bestHeight;
    
    // Start
    requestAnimationFrame(gameLoop);
})();
