import React, { useEffect, useRef, useState } from 'react';
import { 
  Shield, Zap, Terminal, Play, RotateCcw, Volume2, VolumeX, 
  Cpu, Award, ChevronRight, Crosshair, Heart, Flame
} from 'lucide-react';

// --- TYPES & INTERFACES ---
type GameState = 'MENU' | 'CHARACTER_SELECT' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';
type CharacterId = 'KAI' | 'NYX' | 'VEX';

interface Character {
  id: CharacterId;
  name: string;
  title: string;
  color: string;
  accent: string;
  speed: number;
  jump: number;
  dashCooldown: number;
  description: string;
}

const CHARACTERS: Character[] = [
  {
    id: 'KAI',
    name: 'KAI-07',
    title: 'CYBER-SAMURAI',
    color: '#00f0ff',
    accent: '#ff0055',
    speed: 6,
    jump: -13,
    dashCooldown: 90,
    description: 'Balanced operative with high mobility and rapid blade strikes.'
  },
  {
    id: 'NYX',
    name: 'NYX',
    title: 'STEALTH ASSASSIN',
    color: '#bd00ff',
    accent: '#00ffff',
    speed: 7.5,
    jump: -14,
    dashCooldown: 60,
    description: 'Blazing fast speed and shorter dash cooldowns, lower armor.'
  },
  {
    id: 'VEX',
    name: 'VEX',
    title: 'HEAVY JUGGERNAUT',
    color: '#ff5500',
    accent: '#ffee00',
    speed: 4.5,
    jump: -11,
    dashCooldown: 120,
    description: 'High health pool and devastating shockwave attacks.'
  }
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game UI States
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [selectedChar, setSelectedChar] = useState<Character>(CHARACTERS[0]);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [health, setHealth] = useState<number>(100);
  const [score, setScore] = useState<number>(0);
  const [credits, setCredits] = useState<number>(0);
  const [timeLoop, setTimeLoop] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Web Audio
  const playSound = (type: 'jump' | 'slash' | 'hit' | 'win' | 'click') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'slash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Canvas Game Engine Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-res canvas dimensions
    canvas.width = 960;
    canvas.height = 540;

    // Player state
    let px = 100;
    let py = 350;
    let pvx = 0;
    let pvy = 0;
    let isGrounded = false;
    let isAttacking = false;
    let attackTimer = 0;
    let dashTimer = 0;
    let facingRight = true;
    let currentHp = 100;

    // Input States
    const keys: { [key: string]: boolean } = {};
    let touchLeft = false;
    let touchRight = false;
    let touchJump = false;
    let touchAttack = false;
    let touchDash = false;

    const handleKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Platforms & Obstacles
    const platforms = [
      { x: 0, y: 480, w: 960, h: 60 },
      { x: 250, y: 380, w: 200, h: 20 },
      { x: 550, y: 280, w: 220, h: 20 },
      { x: 150, y: 200, w: 180, h: 20 },
      { x: 750, y: 360, w: 150, h: 20 }
    ];

    // Enemies
    let enemies = [
      { x: 400, y: 430, w: 30, h: 50, vx: 2, minX: 280, maxX: 430, hp: 2, alive: true },
      { x: 600, y: 230, w: 30, h: 50, vx: -2, minX: 560, maxX: 740, hp: 2, alive: true },
      { x: 200, y: 150, w: 30, h: 50, vx: 1.5, minX: 160, maxX: 300, hp: 3, alive: true }
    ];

    // Collectibles / Terminal
    let terminal = { x: 850, y: 420, w: 40, h: 60, activated: false };

    let animationFrameId: number;

    const updateGame = () => {
      // Horizontal movement
      let moveDir = 0;
      if (keys['ArrowLeft'] || keys['KeyA'] || touchLeft) moveDir = -1;
      if (keys['ArrowRight'] || keys['KeyD'] || touchRight) moveDir = 1;

      pvx = moveDir * selectedChar.speed;
      if (moveDir !== 0) facingRight = moveDir > 0;

      // Jump
      if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || touchJump) && isGrounded) {
        pvy = selectedChar.jump;
        isGrounded = false;
        playSound('jump');
        touchJump = false;
      }

      // Attack
      if ((keys['KeyJ'] || keys['KeyX'] || touchAttack) && attackTimer <= 0) {
        isAttacking = true;
        attackTimer = 20;
        playSound('slash');
        touchAttack = false;

        // Check hits on enemies
        enemies.forEach(en => {
          if (!en.alive) return;
          const dist = Math.hypot((px + 20) - (en.x + 15), (py + 25) - (en.y + 25));
          if (dist < 70) {
            en.hp -= 1;
            playSound('hit');
            if (en.hp <= 0) en.alive = false;
          }
        });
      }

      if (attackTimer > 0) attackTimer--;
      if (attackTimer === 0) isAttacking = false;

      // Dash
      if ((keys['KeyK'] || keys['KeyC'] || touchDash) && dashTimer <= 0) {
        pvx = facingRight ? 18 : -18;
        pvy = 0;
        dashTimer = selectedChar.dashCooldown;
        playSound('slash');
        touchDash = false;
      }
      if (dashTimer > 0) dashTimer--;

      // Gravity & Physics
      pvy += 0.6; // Gravity
      px += pvx;
      py += pvy;

      // Platform Collisions
      isGrounded = false;
      platforms.forEach(plat => {
        if (
          px + 30 > plat.x &&
          px < plat.x + plat.w &&
          py + 50 >= plat.y &&
          py + 50 - pvy <= plat.y
        ) {
          py = plat.y - 50;
          pvy = 0;
          isGrounded = true;
        }
      });

      // Boundaries
      if (px < 0) px = 0;
      if (px > canvas.width - 40) px = canvas.width - 40;

      // Enemy AI & Collision
      enemies.forEach(en => {
        if (!en.alive) return;
        en.x += en.vx;
        if (en.x < en.minX || en.x > en.maxX) en.vx *= -1;

        // Player damage collision
        const hitDist = Math.hypot((px + 20) - (en.x + 15), (py + 25) - (en.y + 25));
        if (hitDist < 30) {
          currentHp -= 0.7;
          setHealth(Math.max(0, Math.floor(currentHp)));
          if (currentHp <= 0) {
            playSound('hit');
            setGameState('GAMEOVER');
          }
        }
      });

      // Terminal Check
      if (
        !terminal.activated &&
        px + 30 > terminal.x &&
        px < terminal.x + terminal.w &&
        py + 50 >= terminal.y &&
        py <= terminal.y + terminal.h
      ) {
        terminal.activated = true;
        playSound('win');
        setScore(prev => prev + 500 * currentLevel);
        setCredits(prev => prev + 100);

        setTimeout(() => {
          if (currentLevel < 3) {
            setCurrentLevel(prev => prev + 1);
            setTimeLoop(prev => prev + 1);
            setGameState('PLAYING');
          } else {
            setGameState('VICTORY');
          }
        }, 1000);
      }
    };

    const renderGame = () => {
      // Background gradient grid
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid lines
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Platforms
      platforms.forEach(plat => {
        ctx.fillStyle = '#101026';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = selectedChar.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
      });

      // Draw Terminal
      ctx.fillStyle = terminal.activated ? '#00ffcc' : '#ff0055';
      ctx.fillRect(terminal.x, terminal.y, terminal.w, terminal.h);
      ctx.shadowColor = terminal.activated ? '#00ffcc' : '#ff0055';
      ctx.shadowBlur = 15;
      ctx.fillRect(terminal.x, terminal.y, terminal.w, terminal.h);
      ctx.shadowBlur = 0;

      // Draw Enemies
      enemies.forEach(en => {
        if (!en.alive) return;
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(en.x, en.y, en.w, en.h);
        ctx.fillStyle = '#ffee00';
        ctx.fillRect(en.x + 6, en.y + 10, 6, 6);
        ctx.fillRect(en.x + 18, en.y + 10, 6, 6);
      });

      // Draw Player
      ctx.fillStyle = selectedChar.color;
      ctx.shadowColor = selectedChar.color;
      ctx.shadowBlur = 20;
      ctx.fillRect(px, py, 35, 50);

      // Visor / Face
      ctx.fillStyle = '#ffffff';
      const eyeX = facingRight ? px + 20 : px + 5;
      ctx.fillRect(eyeX, py + 12, 10, 6);

      // Attack Slash Effect
      if (isAttacking) {
        ctx.strokeStyle = selectedChar.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (facingRight) {
          ctx.arc(px + 45, py + 25, 30, -Math.PI / 2, Math.PI / 2);
        } else {
          ctx.arc(px - 10, py + 25, 30, Math.PI / 2, Math.PI * 1.5);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      updateGame();
      renderGame();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedChar, currentLevel]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center font-mono">
      
      {/* --- MENU STATE --- */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05050a] bg-opacity-95 p-6 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black pointer-events-none" />
          
          <div className="relative z-10 space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs tracking-widest uppercase mb-2">
              <Terminal size={14} /> SYSTEM READY // v2.4.0
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-500 drop-shadow-[0_0_35px_rgba(0,240,255,0.4)]">
              ECHO PROTOCOL
            </h1>
            
            <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
              Dive into the neural grid. Bypass cyber-defenses, eliminate rogue security units, and breach the core mainframes across temporal loops.
            </p>

            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => { playSound('click'); setGameState('CHARACTER_SELECT'); }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold tracking-wider uppercase flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,240,255,0.5)] hover:shadow-[0_0_35px_rgba(0,240,255,0.8)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play size={20} fill="black" /> INITIALIZE RUN
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-300 hover:text-white transition-all flex items-center gap-2"
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                <span className="text-xs uppercase">Audio: {soundEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CHARACTER SELECT STATE --- */}
      {gameState === 'CHARACTER_SELECT' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05050a] p-4 md:p-8">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-wider mb-2">SELECT OPERATIVE</h2>
          <p className="text-cyan-400 text-xs tracking-widest uppercase mb-8">Choose your neural combat avatar</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-8">
            {CHARACTERS.map(char => (
              <div
                key={char.id}
                onClick={() => { playSound('click'); setSelectedChar(char); }}
                className={`relative p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedChar.id === char.id
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_30px_rgba(0,240,255,0.3)]'
                    : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-black/50 border border-gray-700" style={{ color: char.color }}>
                      {char.title}
                    </span>
                    <Cpu size={20} style={{ color: char.color }} />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">{char.name}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed mb-6">{char.description}</p>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-800/80 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>SPEED:</span>
                    <span className="text-cyan-400 font-bold">{char.speed}x</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>DASH CD:</span>
                    <span className="text-rose-400 font-bold">{char.dashCooldown}f</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => { playSound('click'); setHealth(100); setGameState('PLAYING'); }}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-black font-extrabold tracking-widest uppercase shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.7)] transition-all flex items-center gap-2"
          >
            ENTER GRID <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* --- PLAYING STATE (CANVAS & TOUCH HUD) --- */}
      {gameState === 'PLAYING' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
          {/* Top Status HUD */}
          <div className="absolute top-4 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
            <div className="flex items-center gap-6 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-rose-500 fill-rose-500" />
                <div className="w-28 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 transition-all duration-200" style={{ width: `${health}%` }} />
                </div>
              </div>
              <div className="text-xs text-gray-300">
                LOOP: <span className="text-cyan-400 font-bold">#{timeLoop}</span>
              </div>
              <div className="text-xs text-gray-300">
                SECTOR: <span className="text-indigo-400 font-bold">{currentLevel}/3</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-xl border border-gray-800">
              <div className="text-xs text-gray-300">SCORE: <span className="text-cyan-400 font-bold">{score}</span></div>
              <div className="text-xs text-gray-300">CREDITS: <span className="text-amber-400 font-bold">${credits}</span></div>
            </div>
          </div>

          {/* Canvas Render */}
          <canvas ref={canvasRef} className="w-full h-full object-contain cursor-crosshair" />

          {/* On-Screen Mobile Landscape Controls HUD */}
          <div className="absolute bottom-6 left-6 right-6 z-10 flex justify-between items-end pointer-events-auto">
            {/* Left D-Pad / Movement */}
            <div className="flex gap-3">
              <button
                onTouchStart={() => { touchLeft = true; }}
                onMouseDown={() => { touchLeft = true; }}
                onTouchEnd={() => { touchLeft = false; }}
                onMouseUp={() => { touchLeft = false; }}
                className="w-16 h-16 rounded-2xl bg-gray-900/80 border border-gray-700 active:bg-cyan-500/30 text-white flex items-center justify-center text-xl font-bold shadow-lg backdrop-blur-sm"
              >
                ◀
              </button>
              <button
                onTouchStart={() => { touchRight = true; }}
                onMouseDown={() => { touchRight = true; }}
                onTouchEnd={() => { touchRight = false; }}
                onMouseUp={() => { touchRight = false; }}
                className="w-16 h-16 rounded-2xl bg-gray-900/80 border border-gray-700 active:bg-cyan-500/30 text-white flex items-center justify-center text-xl font-bold shadow-lg backdrop-blur-sm"
              >
                ▶
              </button>
            </div>

            {/* Right Action Buttons */}
            <div className="flex gap-3">
              <button
                onTouchStart={() => { touchDash = true; }}
                onMouseDown={() => { touchDash = true; }}
                className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-500/50 active:bg-indigo-600 text-indigo-300 active:text-white flex items-center justify-center font-bold text-xs shadow-lg backdrop-blur-sm"
              >
                DASH
              </button>
              <button
                onTouchStart={() => { touchAttack = true; }}
                onMouseDown={() => { touchAttack = true; }}
                className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-500/50 active:bg-rose-600 text-rose-300 active:text-white flex items-center justify-center font-bold text-xs shadow-lg backdrop-blur-sm"
              >
                STRIKE
              </button>
              <button
                onTouchStart={() => { touchJump = true; }}
                onMouseDown={() => { touchJump = true; }}
                className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 active:bg-cyan-600 text-cyan-300 active:text-white flex items-center justify-center font-bold text-xs shadow-lg backdrop-blur-sm"
              >
                JUMP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GAMEOVER STATE --- */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs tracking-widest uppercase">
              SIGNAL LOST // TERMINATED
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter">NEURAL FLATLINE</h2>
            <p className="text-gray-400 text-sm">Your operative sustained critical corruption damage in the grid.</p>
            
            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={() => { playSound('click'); setHealth(100); setCurrentLevel(1); setGameState('PLAYING'); }}
                className="w-full py-4 rounded-xl bg-cyan-400 text-black font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)]"
              >
                <RotateCcw size={18} /> REBOOT TIME LOOP
              </button>
              <button
                onClick={() => { playSound('click'); setGameState('MENU'); }}
                className="w-full py-3 rounded-xl border border-gray-800 bg-gray-900 text-gray-300 hover:text-white text-xs uppercase"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VICTORY STATE --- */}
      {gameState === 'VICTORY' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs tracking-widest uppercase">
              MISSION COMPLETE // MAINFRAME BREACHED
            </div>
            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 tracking-tighter">PROTOCOL SAVED</h2>
            <p className="text-gray-400 text-sm">You successfully neutralized all core security sectors and secured the grid.</p>
            
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-left space-y-2 my-4">
              <div className="flex justify-between text-xs text-gray-300">
                <span>FINAL SCORE:</span>
                <span className="text-cyan-400 font-bold">{score}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>BOUNTY EARNED:</span>
                <span className="text-amber-400 font-bold">${credits}</span>
              </div>
            </div>

            <button
              onClick={() => { playSound('click'); setGameState('MENU'); }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.5)]"
            >
              <Award size={18} /> PLAY AGAIN
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
