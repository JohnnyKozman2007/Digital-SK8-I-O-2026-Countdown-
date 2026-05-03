/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, ArrowRight, Zap, TrendingUp, ShieldAlert, Volume2, VolumeX, SkipForward, Pause, Music } from 'lucide-react';

// --- Types & Constants ---

type GameMode = 'CLASSIC' | 'CHALLENGE';
type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER' | 'TUTORIAL';
type WeatherType = 'CLEAR' | 'SNOW';
type ObstacleType = 'BUMP' | 'ORB' | 'GEM' | 'HEART' | 'BOOST';

interface Challenge {
  id: string;
  title: string;
  description: string;
  targetGems?: number;
  targetDistance?: number;
  timeLimit: number; // in seconds
}

const CHALLENGES: Challenge[] = [
  { id: 'gem_hunt', title: 'GEM HARVEST', description: 'Collect 15 Gems', targetGems: 15, timeLimit: 60 },
  { id: 'distance_sprint', title: 'VOID SPRINT', description: 'Reach 8,000m', targetDistance: 8000, timeLimit: 90 },
  { id: 'expert_collect', title: 'HYPER COLLECT', description: 'Collect 25 Gems', targetGems: 25, timeLimit: 120 },
  { id: 'stamina_run', title: 'STAMINA RUN', description: 'Reach 15,000m', targetDistance: 15000, timeLimit: 180 },
];

interface NumberProps {
  digit: number;
  speed: number;
  grip: number;
  jumpHeight: number;
  stability: number; // base stability multiplier
  color: string;
}

const NUMBER_DATA: Record<number, NumberProps> = {
  1: { digit: 1, speed: 5.0, grip: 0.9, jumpHeight: 15, stability: 0.4, color: '#3b82f6' }, // Blue
  2: { digit: 2, speed: 6.0, grip: 0.8, jumpHeight: 13, stability: 0.6, color: '#10b981' }, // Green
  3: { digit: 3, speed: 6.5, grip: 0.7, jumpHeight: 14, stability: 0.5, color: '#f59e0b' }, // Amber
  4: { digit: 4, speed: 6.2, grip: 0.8, jumpHeight: 17, stability: 0.3, color: '#ef4444' }, // Red
  5: { digit: 5, speed: 7.0, grip: 0.6, jumpHeight: 16, stability: 0.6, color: '#8b5cf6' }, // Violet
  6: { digit: 6, speed: 7.5, grip: 0.5, jumpHeight: 15, stability: 0.5, color: '#ec4899' }, // Pink
  7: { digit: 7, speed: 10.0, grip: 0.3, jumpHeight: 19, stability: 0.2, color: '#06b6d4' }, // Cyan
  8: { digit: 8, speed: 5.8, grip: 0.9, jumpHeight: 12, stability: 0.8, color: '#f97316' },  // Orange
  9: { digit: 9, speed: 8.5, grip: 0.4, jumpHeight: 18, stability: 0.4, color: '#facc15' }, // Yellow
  10: { digit: 10, speed: 5.5, grip: 0.95, jumpHeight: 11, stability: 1.0, color: '#ffffff' } // White
};

interface Skin {
  id: string;
  name: string;
  color: string;
  trailColor: string;
  glowIntensity: number;
  unlockCondition: string;
}

const SKINS: Skin[] = [
  { id: 'classic', name: 'CORE', color: '#fff', trailColor: 'rgba(255,255,255,0.4)', glowIntensity: 1, unlockCondition: 'Default' },
  { id: 'neon', name: 'VOLT', color: '#22d3ee', trailColor: 'rgba(34,211,238,0.5)', glowIntensity: 2, unlockCondition: 'Score 5,000m' },
  { id: 'magma', name: 'FLARE', color: '#f87171', trailColor: 'rgba(248,113,113,0.5)', glowIntensity: 2, unlockCondition: 'Collect 20 Gems' },
  { id: 'void', name: 'VOID', color: '#a855f7', trailColor: 'rgba(168,85,247,0.5)', glowIntensity: 3, unlockCondition: 'Complete 3 Challenges' },
];

const GRAVITY = 0.75;
const BOARD_SIZE = 100;
const TILT_SPEED_BASE = 0.15;
const FRICTION = 0.985;
const AIR_FRICTION = 0.995;
const TILT_SENSITIVITY = 1.4;
const CRITICAL_TILT = 55; // Degrees

// --- Music Types ---
interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  steps: number;
  synths: {
    osc: OscillatorType;
    pattern: (number | null)[]; // Frequencies or null
    gain: number;
  }[];
}

const PLAYLIST: MusicTrack[] = [
  {
    id: 'neon',
    name: 'NEON GRID',
    bpm: 128,
    steps: 16,
    synths: [
      { osc: 'square', pattern: [55, null, 55, null, 55, null, 55, null, 55, null, 55, null, 110, null, 55, null], gain: 0.05 },
      { osc: 'triangle', pattern: [null, 220, null, 330, null, 220, null, 440, null, 220, null, 330, null, 220, null, 110], gain: 0.03 }
    ]
  },
  {
    id: 'glitch',
    name: 'GLITCH VOID',
    bpm: 140,
    steps: 16,
    synths: [
      { osc: 'sawtooth', pattern: [40, 40, null, 60, 40, 40, null, 80, 40, 40, null, 60, 40, 40, 100, 120], gain: 0.04 },
      { osc: 'square', pattern: [null, 880, 440, null, 880, 440, null, null, 880, null, 440, null, 1200, null, null, 100], gain: 0.02 }
    ]
  },
  {
    id: 'deep',
    name: 'DEEP DIGIT',
    bpm: 110,
    steps: 16,
    synths: [
      { osc: 'triangle', pattern: [30, null, null, 30, null, null, 30, null, 30, null, null, 30, null, null, 40, 30], gain: 0.08 },
      { osc: 'sawtooth', pattern: [110, 110, 110, 110, 165, 165, 165, 165, 220, 220, 220, 220, 110, 110, 55, 55], gain: 0.02 }
    ]
  },
  {
    id: 'cyber',
    name: 'CYBER SPRINT',
    bpm: 160,
    steps: 16,
    synths: [
      { osc: 'square', pattern: [60, null, 60, null, 60, null, 60, null, 60, null, 60, null, 60, null, 60, null], gain: 0.04 },
      { osc: 'sawtooth', pattern: [330, 330, 330, 330, 440, 440, 440, 440, 660, 660, 660, 660, 880, 880, 880, 880], gain: 0.015 }
    ]
  },
  {
    id: 'zen',
    name: 'ZEN OVERFLOW',
    bpm: 90,
    steps: 16,
    synths: [
      { osc: 'sine', pattern: [440, null, 554, null, 659, null, 880, null, 440, null, 554, null, 659, null, 880, null], gain: 0.06 },
      { osc: 'triangle', pattern: [110, null, null, 110, null, null, 110, null, 110, null, null, 110, null, null, 110, null], gain: 0.04 }
    ]
  }
];

// --- Helper Components ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [gameMode, setGameMode] = useState<GameMode>('CLASSIC');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [challengeTimer, setChallengeTimer] = useState(0);
  const [selectedDigit, setSelectedDigit] = useState<number>(1);
  const [weather, setWeather] = useState<WeatherType>('CLEAR');
  const [distance, setDistance] = useState(0);
  const [tiltRatio, setTiltRatio] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gems, setGems] = useState(0);
  const [selectedSkinId, setSelectedSkinId] = useState('classic');
  const [unlockedSkinIds, setUnlockedSkinIds] = useState<string[]>(['classic']);
  const [screenFlash, setScreenFlash] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialTimer, setTutorialTimer] = useState(0);
  const [stats, setStats] = useState({
    distance: 0,
    gems: 0,
    jumps: 0,
    peakSpeed: 0,
    weatherTime: 0
  });

  // --- Music State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const musicRef = useRef({
    currentStep: 0,
    nextStepTime: 0,
    schedulerTimer: null as number | null,
    intensifier: 1.0,
  });

  const gameRef = useRef({
    x: 0,
    y: 400,
    vy: 0,
    tilt: 0,
    targetTilt: 0,
    tiltVelocity: 0,
    isJumping: false,
    distance: 0,
    speed: 0,
    obstacles: [] as { x: number; y: number; type: ObstacleType }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; text?: string; size?: number }[],
    snowflakes: [] as { x: number; y: number; speed: number; drift: number }[],
    weather: 'CLEAR' as WeatherType,
    weatherIntensity: 0, // 0 to 1 for fading in/out
    lastObstacleX: 0,
    groundY: 450,
    width: 0,
    height: 0,
    mouseY: 0,
    mouseX: 0,
    gameOver: false,
    startTime: 0,
    impactJerk: 0,
    lives: 3,
    invincibleUntil: 0,
    gemsCollected: 0,
    totalJumps: 0,
    peakSpeed: 0,
    stormTicks: 0,
    challengesCleared: 0,
    highScore: 0,
    landingStreak: 0,
    gemStreak: 0,
    difficultyMultiplier: 1.0,
    selectedDigit: 1, // Add digit to ref to avoid effect restarts
    trail: [] as { x: number; y: number; opacity: number }[],
    parallax: [] as { x: number; y: number; size: number; speed: number; opacity: number }[],
    cameraShake: 0,
    cameraX: 0,
    cameraY: 0,
  });

  // --- Audio System (Web Audio API) ---
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playSound = (freq: number, type: OscillatorType, duration: number, volume: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playJumpSound = () => playSound(440, 'square', 0.2, 0.1);
  const playLandSound = () => playSound(220, 'sine', 0.1, 0.2);
  const playCrashSound = () => {
    playSound(100, 'sawtooth', 0.5, 0.3);
    playSound(50, 'square', 0.4, 0.4);
  };
  const playGemSound = () => playSound(880, 'sine', 0.15, 0.1);
  const playPowerupSound = () => playSound(1200, 'sine', 0.2, 0.1);
  const playHitSound = () => playSound(150, 'square', 0.2, 0.2);

  const switchSound = () => playSound(880, 'sine', 0.1, 0.1);

  // --- Procedural Music Engine ---

  const scheduleMusicStep = () => {
    if (!audioContextRef.current || !isMusicPlaying) return;
    const ctx = audioContextRef.current;
    const m = musicRef.current;
    const track = PLAYLIST[currentTrackIndex];
    
    // Dynamic intensity based on game speed and weather
    const intensity = 1.0 + (gameRef.current.weatherIntensity * 0.5) + (Math.max(0, gameRef.current.speed - 5) * 0.05);
    m.intensifier = intensity;

    while (m.nextStepTime < ctx.currentTime + 0.1) {
      const stepDuration = 60 / track.bpm / 2; // 8th notes
      
      track.synths.forEach(synth => {
        const freq = synth.pattern[m.currentStep % track.steps];
        if (freq !== null) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = synth.osc;
          const tension = gameRef.current.weatherIntensity > 0.5 ? Math.sin(ctx.currentTime * 10) * 5 : 0;
          osc.frequency.setValueAtTime(freq * (m.currentStep % 4 === 0 ? 1 : 0.5) + tension, m.nextStepTime);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          const volumeScale = synth.gain * musicVolume * intensity;
          gain.gain.setValueAtTime(volumeScale, m.nextStepTime);
          gain.gain.exponentialRampToValueAtTime(0.001, m.nextStepTime + stepDuration * 0.8);
          
          osc.start(m.nextStepTime);
          osc.stop(m.nextStepTime + stepDuration);
        }
      });

      // Simple Kick/Snare
      if (m.currentStep % 4 === 0) { // Kick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, m.nextStepTime);
        osc.frequency.exponentialRampToValueAtTime(40, m.nextStepTime + 0.1);
        gain.gain.setValueAtTime(0.1 * musicVolume, m.nextStepTime);
        gain.gain.linearRampToValueAtTime(0, m.nextStepTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(m.nextStepTime);
        osc.stop(m.nextStepTime + 0.1);
      }
      
      if (m.currentStep % 8 === 4) { // Snare
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1000, m.nextStepTime);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.05 * musicVolume, m.nextStepTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, m.nextStepTime + 0.1);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(m.nextStepTime);
        noise.stop(m.nextStepTime + 0.1);
      }

      m.nextStepTime += stepDuration;
      m.currentStep++;
    }
  };

  useEffect(() => {
    if (isMusicPlaying) {
      musicRef.current.nextStepTime = audioContextRef.current ? audioContextRef.current.currentTime : 0;
      const timer = window.setInterval(scheduleMusicStep, 25);
      musicRef.current.schedulerTimer = timer;
      return () => clearInterval(timer);
    }
  }, [isMusicPlaying, currentTrackIndex, musicVolume, gameState]);

  // --- Core Game Logic ---

  const getStabilityLabel = (stability: number, isSnowing: boolean) => {
    let base = "Average";
    if (stability < 0.4) base = "Volatile";
    else if (stability < 0.6) base = "Standard";
    else if (stability < 0.8) base = "Resilient";
    else base = "Solid";

    if (isSnowing) return `Unreliable (${base})`;
    return base;
  };

  const startLevel = (digit: number) => {
    initAudio();
    const props = NUMBER_DATA[digit];
    const initialWidth = window.innerWidth;
    
    let challenge: Challenge | null = null;
    if (gameMode === 'CHALLENGE') {
      challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    }
    setActiveChallenge(challenge);
    setChallengeTimer(challenge ? challenge.timeLimit : 0);

    gameRef.current = {
      x: 200,
      y: 430,
      vy: 0,
      tilt: 0,
      targetTilt: 0,
      tiltVelocity: 0,
      isJumping: false,
      distance: 0,
      speed: props.speed,
      obstacles: [],
      particles: [],
      lastObstacleX: 1200,
      groundY: 450,
      snowflakes: [],
      weather: 'CLEAR',
      weatherIntensity: 0,
      width: initialWidth,
      height: window.innerHeight,
      mouseY: 0,
      mouseX: initialWidth / 2,
      gameOver: false,
      startTime: Date.now(),
      impactJerk: 0,
      lives: 3,
      invincibleUntil: 0,
      gemsCollected: 0,
      totalJumps: 0,
      peakSpeed: props.speed,
      stormTicks: 0,
      challengesCleared: gameRef.current.challengesCleared,
      highScore: gameRef.current.highScore,
      landingStreak: 0,
      gemStreak: 0,
      difficultyMultiplier: 1.0,
      selectedDigit: digit,
      challengeCompleted: false,
      challengeTimeLeft: challenge ? challenge.timeLimit : 0,
      trail: [],
      parallax: Array.from({ length: 40 }).map(() => ({
        x: Math.random() * window.innerWidth * 2,
        y: Math.random() * window.innerHeight,
        size: 2 + Math.random() * 60,
        speed: 0.1 + Math.random() * 0.4,
        opacity: 0.05 + Math.random() * 0.1,
      })),
      cameraShake: 0,
      cameraX: 0,
      cameraY: 0,
    };
    setGameState('PLAYING');
    setDistance(0);
    setLives(3);
    setGems(0);
  };

  const createExplosion = () => {
    const g = gameRef.current;
    const colors = ['#ec4899', '#22d3ee', '#facc15', '#ffffff'];
    for (let i = 0; i < 100; i++) {
      const isText = Math.random() > 0.3;
      g.particles.push({
        x: g.x,
        y: g.y,
        vx: (Math.random() - 0.5) * 50, 
        vy: (Math.random() - 0.5) * 50 - 20,
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        text: isText ? Math.floor(Math.random() * 10).toString() : undefined,
        size: isText ? undefined : 2 + Math.random() * 4
      });
    }
    for (let i = 0; i < 30; i++) {
      g.particles.push({
        x: g.x,
        y: g.y,
        vx: Math.cos(i) * 30,
        vy: Math.sin(i) * 30,
        life: 1.5,
        color: "#fff",
        text: "!!"
      });
    }
    playCrashSound();
  };

  const drawDigitAsBoard = (ctx: CanvasRenderingContext2D, digit: number, x: number, y: number, size: number, tilt: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    const skin = SKINS.find(s => s.id === selectedSkinId) || SKINS[0];

    // Apply Transformation Rules
    switch (digit) {
      case 1:
        ctx.rotate(Math.PI / 2); // 90 CW
        break;
      case 4:
        ctx.rotate(Math.PI); // 180 (Inverted)
        break;
      case 7:
        ctx.rotate(Math.PI / 2); // 90 CW
        break;
      case 9:
        ctx.scale(-1, 1); // Mirror Y
        break;
      case 10:
        ctx.rotate(Math.PI / 2); // 90 CW
        break;
      default:
        // 2, 3, 5, 6, 8 leave upright
        break;
    }

    ctx.font = `bold ${size}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Board Glow
    const maxTiltRad = (CRITICAL_TILT * Math.PI) / 180;
    const currentTiltRatio = Math.min(1.2, Math.abs(tilt) / maxTiltRad);
    const glowColor = currentTiltRatio > 0.8 ? '#f43f5e' : skin.color;
    
    ctx.shadowBlur = (20 + currentTiltRatio * 30) * skin.glowIntensity;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 4 + (currentTiltRatio > 0.8 ? 2 : 0);
    ctx.strokeText(digit.toString(), 0, 0);
    
    ctx.fillStyle = "#000";
    ctx.fillText(digit.toString(), 0, 0);

    ctx.restore();
  };

  const drawStickman = (ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number) => {
    const g = gameRef.current;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    
    // Idle bobbing / Breathing / Running motion
    const time = Date.now() / 200;
    const props = NUMBER_DATA[g.selectedDigit];
    const breathe = Math.sin(time) * 2;
    
    // Immediate input lean (Anticipation)
    const center = g.width / 2;
    const mouseDeviation = (g.mouseX - center) / (g.width / 2);
    const inputLean = mouseDeviation * 15; 

    // Weight shift based on tilt AND stability
    const struggleIntensity = (1.1 - props.stability) * 2;
    const balanceShift = (Math.sin(tilt) * (15 + struggleIntensity * 10)) + inputLean;
    const jerk = Math.sin(Date.now() / 50) * g.impactJerk;
    
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    
    // Knees (Bending based on stability - lower stability = lower center of gravity)
    const legBend = g.isJumping ? 8 : (Math.abs(Math.sin(g.distance / 50)) * 3) + (struggleIntensity * 2);
    
    // Head - reacts with a slight delay or overshoot to jerk
    ctx.arc(balanceShift + jerk * 1.5, -65 + breathe + legBend, 8, 0, Math.PI * 2);
    // Torso
    ctx.moveTo(balanceShift + jerk, -57 + breathe + legBend);
    ctx.lineTo(0, -25 + legBend);
    
    // Arms - flailing intensity depends on how much we're tilting and stability
    const armWaver = Math.sin(time * (1.5 + struggleIntensity)) * (4 + struggleIntensity * 2);
    const reaction = tilt * (30 + struggleIntensity * 20);
    
    // Left Arm
    ctx.moveTo(balanceShift / 2, -50 + breathe + legBend);
    ctx.lineTo(-20 - reaction, -40 + armWaver - Math.abs(reaction) + legBend);
    
    // Right Arm
    ctx.moveTo(balanceShift / 2, -50 + breathe + legBend);
    ctx.lineTo(20 - reaction, -40 - armWaver + Math.abs(reaction) + legBend);
    
    // Legs
    const runCycle = Math.sin(g.distance / 30) * (g.speed * 1.2);
    ctx.moveTo(0, -25 + legBend);
    ctx.lineTo(-12 + (g.isJumping ? 0 : runCycle), -legBend);
    ctx.moveTo(0, -25 + legBend);
    ctx.lineTo(12 - (g.isJumping ? 0 : runCycle), -legBend);
    
    ctx.stroke();
    
    // Sweat drops
    if (Math.abs(tilt) > 0.4) {
      ctx.fillStyle = "#3b82f6";
      for(let i=0; i<3; i++) {
        ctx.beginPath();
        ctx.arc(15 + balanceShift, -65 + i * 12 + breathe, 1.5, 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  const createSparkles = (x: number, y: number, color: string, text?: string) => {
    const g = gameRef.current;
    for (let i = 0; i < 12; i++) {
      g.particles.push({
        xOffset: 0,
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1,
        color,
        text: text ? undefined : Math.floor(Math.random() * 10).toString(),
        size: 2
      });
    }
    if (text) {
      g.particles.push({
        x, y: y - 20, vx: 0, vy: -1.5, life: 1.5, color: '#fff', text
      });
    }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    const g = gameRef.current;
    g.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      if (p.text) {
        ctx.font = `bold ${p.text.length > 1 ? 24 : 16 + p.life * 10}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        const size = p.size || 2 * p.life;
        if (size > 0) {
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      // Gravity for non-text particles
      if (!p.text) p.vy += 0.2;
      else p.vy += 0.05;
      p.life -= 0.012;
    });
    g.particles = g.particles.filter(p => p.life > 0);
  };

  const getContactWidth = (digit: number) => {
    switch (digit) {
      case 1: return 20;
      case 2: return 80;
      case 3: return 70;
      case 4: return 30;
      case 5: return 80;
      case 6: return 60;
      case 7: return 20;
      case 8: return 90;
      case 9: return 50;
      case 10: return 100; // Scaled down
      default: return 40;
    }
  };

  useEffect(() => {
    if (gameState === 'MENU') return;
    if (gameState === 'GAMEOVER') {
      // Small loop for particles even when game over
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      let animationFrameId: number;
      const updateParticlesOnly = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Still draw background
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 100) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        drawParticles(ctx);
        animationFrameId = requestAnimationFrame(updateParticlesOnly);
      };
      updateParticlesOnly();
      return () => cancelAnimationFrame(animationFrameId);
    }

    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let animationFrameId: number;

    const getTerrainY = (dist: number) => {
      const base = 480;
      const hills = Math.sin(dist / 400) * 80;
      const noise = (Math.sin(dist / 80) + Math.cos(dist / 40)) * 25; // More bumpy
      return base + hills + noise;
    };

    const update = () => {
      const g = gameRef.current;
      if (g.gameOver) {
        render();
        animationFrameId = requestAnimationFrame(update);
        return;
      }
      const props = NUMBER_DATA[g.selectedDigit]; // Use ref value

      // Weather Logic
      if (Math.random() < 0.001) { // Much rarer toggle
        g.weather = g.weather === 'CLEAR' ? 'SNOW' : 'CLEAR';
        setWeather(g.weather);
      }

      if (g.weather === 'SNOW') {
        g.stormTicks++;
        g.weatherIntensity = Math.min(1, g.weatherIntensity + 0.01);
        // Add new snowflakes
        if (g.snowflakes.length < 200) {
          g.snowflakes.push({
            x: Math.random() * g.width,
            y: -20,
            speed: 2 + Math.random() * 3,
            drift: (Math.random() - 0.5) * 2
          });
        }
      } else {
        g.weatherIntensity = Math.max(0, g.weatherIntensity - 0.01);
      }

      // Update existing snowflakes
      g.snowflakes.forEach(s => {
        s.y += s.speed;
        s.x += s.drift + (g.speed / 2); // Wind effect from moving forward
        if (s.y > g.height) s.y = -20;
        if (s.x < -50) s.x = g.width + 50;
        if (s.x > g.width + 50) s.x = -50;
      });

      // Handling Ground & Terrain Displacement
      const terrainSlope = (getTerrainY(g.distance + 10) - getTerrainY(g.distance - 10)) / 20;
      const slopeForce = terrainSlope * 0.5;
      
      g.distance += g.speed;
      setDistance(Math.floor(g.distance / 10));

      // Gravity & Jumping
      g.vy += GRAVITY;
      
      // Update Camera Effects
      if (Math.abs(g.tilt) > 0.45) {
        g.cameraShake = Math.min(10, g.cameraShake + 0.5);
      } else {
        g.cameraShake *= 0.9;
      }
      g.cameraX = (Math.random() - 0.5) * g.cameraShake;
      g.cameraY = (Math.random() - 0.5) * g.cameraShake;

      // Physics Enhancements: Stickiness and Friction
      if (!g.isJumping) {
        // Friction depends on weather and speed
        const currentFriction = g.weather === 'SNOW' ? 0.995 : FRICTION;
        g.speed *= currentFriction;
        
        // Dynamic Difficulty: Speed target increases with performance
        const difficultySpeedBonus = (g.difficultyMultiplier - 1.0) * 10;
        const targetSpeed = props.speed + difficultySpeedBonus;
        g.speed += (targetSpeed - g.speed) * 0.01;

        // Acceleration from slope
        g.speed -= slopeForce * (g.weather === 'SNOW' ? 0.4 : 0.8);
        
        // Sticking to terrain while moving
        const targetGroundY = getTerrainY(g.distance) - 35;
        const groundDiff = targetGroundY - g.y;
        g.y += groundDiff * 0.5; // Rapidly snap to ground
        g.vy = 0;
      } else {
        g.y += g.vy;
        g.speed *= AIR_FRICTION;
      }
      
      const groundAtY = getTerrainY(g.distance);
      if (g.y + 35 >= groundAtY) {
        if (g.isJumping) {
          playLandSound();
          g.impactJerk = Math.abs(g.vy) * 2.5;
          // Impact also affects tilt
          g.tiltVelocity += (Math.random() - 0.5) * g.vy * 0.05;

          // PERFECT LANDING CHECK
          const landingTiltDeg = Math.abs(g.tilt * 180 / Math.PI);
          const landingTiltVel = Math.abs(g.tiltVelocity);
          if (landingTiltDeg < 6 && landingTiltVel < 0.015) {
            g.speed += 6;
            g.landingStreak++;
            g.difficultyMultiplier = Math.min(2.5, g.difficultyMultiplier + 0.05);
            createSparkles(g.x, g.y, '#facc15', `PERFECT ${g.landingStreak}x`);
            playPowerupSound();
          } else {
            g.landingStreak = 0;
            g.difficultyMultiplier = Math.max(1.0, g.difficultyMultiplier - 0.1);
          }
        }
        g.y = groundAtY - 35;
        g.vy = 0;
        g.isJumping = false;
      } else {
        g.isJumping = true;
      }

      // Tilt Physics Enhancements
      const center = g.width / 2;
      const mouseOffset = g.mouseX - center;
      const mouseRange = g.width / 2.2; 
      
      // Dynamic tilt based on mouse velocity could be nice, but simple position is more predictable
      const tiltIntensity = Math.pow(Math.abs(mouseOffset / mouseRange), 1.1) * Math.sign(mouseOffset);
      let targetTiltDeg = tiltIntensity * 70; 
      
      // Terrain Influence: leaning into curves
      const futureSlope = (getTerrainY(g.distance + 80) - getTerrainY(g.distance)) / 80;
      targetTiltDeg += (Math.atan(futureSlope) * 180 / Math.PI) * 0.6;

      targetTiltDeg = Math.max(-75, Math.min(75, targetTiltDeg));
      g.targetTilt = (targetTiltDeg * Math.PI) / 180;
      
      // Weather and Speed destabilize the board
      const weatherHandicap = g.weatherIntensity * 0.9; 
      const speedInstability = Math.max(0, (g.speed - 12) / 20);
      const randomJitter = (Math.random() - 0.5) * (weatherHandicap * 0.08 + speedInstability * 0.1);
      
      const stabilityFactor = props.stability * (1 - (weatherHandicap * 0.5) - (speedInstability * 0.3));
      
      // Spring physics with dynamic stability
      const stiffness = 0.22 * (0.7 + stabilityFactor * 0.5);
      const damping = 0.75 - (stabilityFactor * 0.15); 
      
      const acceleration = (g.targetTilt - g.tilt) * stiffness * TILT_SENSITIVITY;
      g.tiltVelocity += acceleration + randomJitter;
      
      // Air control is weaker
      if (g.isJumping) {
        g.tiltVelocity *= 0.92; // More floaty air control
      } else {
        g.tiltVelocity *= damping;
      }
      
    g.tilt += g.tiltVelocity;
      
      // Speed restoration
      g.speed += (props.speed - g.speed) * 0.05;
      g.speed = Math.max(props.speed * 0.4, Math.min(props.speed * 2.5, g.speed)); 
      
      // Difficulty Scaling: Increase tilt sensitivity slightly
      const dynamicTiltSensitivity = TILT_SENSITIVITY * g.difficultyMultiplier;
      g.tiltVelocity += (g.targetTilt - g.tilt) * (dynamicTiltSensitivity * (g.isJumping ? 0.15 : stiffness) / 10);

      g.peakSpeed = Math.max(g.peakSpeed, g.speed);

      // Tilt Damage Check
      const currentTiltDeg = Math.abs(g.tilt * 180 / Math.PI);
      const isGracePeriod = (Date.now() - g.startTime) < 2000; 
      const isInvincible = Date.now() < g.invincibleUntil;
      const ratio = Math.min(1.2, currentTiltDeg / CRITICAL_TILT);
      setTiltRatio(ratio);

      if (currentTiltDeg > CRITICAL_TILT && !g.gameOver && !isInvincible && gameState !== 'TUTORIAL') {
        g.tiltVelocity = 0; 
        handleDamage('TILT');
      }

      // Tutorial Step Logic
      if (gameState === 'TUTORIAL') {
        if (tutorialStep === 0) { // Learn to tilt
          if (Math.abs(g.tiltVelocity) > 0.05) {
            setTutorialTimer(prev => prev + 1);
            if (tutorialTimer > 60) {
              setTutorialStep(1);
              setTutorialTimer(0);
            }
          }
        } else if (tutorialStep === 1) { // Balance test
          if (currentTiltDeg < 15) {
            setTutorialTimer(prev => prev + 1);
            if (tutorialTimer > 120) {
              setTutorialStep(2);
              setTutorialTimer(0);
            }
          } else {
            setTutorialTimer(0);
          }
        } else if (tutorialStep === 2) { // Jump test - handled in handleKeyDown
        } else if (tutorialStep === 3) { // Complete
          setTutorialTimer(prev => prev + 1);
          if (tutorialTimer > 180) {
            setGameState('MENU');
          }
        }
      }

      // Obstacle & Collectible Logic
      if (g.distance > g.lastObstacleX - 1000) {
        // Difficulty scaling affects obstacle frequency
        const spawnFrequencyBonus = Math.max(0, (g.difficultyMultiplier - 1.0) * 150);
        const rand = Math.random();
        let type: ObstacleType = 'BUMP';
        if (rand < 0.15) type = 'ORB';
        else if (rand < 0.35) type = 'GEM';
        else if (rand < 0.38) type = 'HEART';
        else if (rand < 0.42) type = 'BOOST';
        
        g.obstacles.push({
          x: g.lastObstacleX,
          y: getTerrainY(g.lastObstacleX),
          type: type
        });
        g.lastObstacleX += (350 - spawnFrequencyBonus) + Math.random() * (500 - spawnFrequencyBonus); 
      }

      // Collision
      g.obstacles.forEach((obs) => {
        const relativeX = obs.x - g.distance + g.x;
        const isInvincible = Date.now() < g.invincibleUntil;
        
        if (obs.type === 'BUMP') {
          if (Math.abs(relativeX - g.x) < 45 && g.y > obs.y - 60) {
            g.vy = -8;
            g.tilt += (Math.random() - 0.5) * (0.6 + weatherHandicap);
            g.impactJerk = 12;
            playLandSound();
          }
        } else if (obs.type === 'ORB') {
          const orbY = obs.y + Math.sin(Date.now() / 400 + obs.x) * 80 - 100;
          const dx = relativeX - g.x;
          const dy = orbY - g.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 40 && !isInvincible && !g.gameOver) {
            g.gemStreak = 0;
            g.difficultyMultiplier = Math.max(1.0, g.difficultyMultiplier - 0.2);
            handleDamage('ORB');
            // Remove orb on hit
            obs.x = -1000;
          }
        } else if (obs.type === 'GEM') {
          const dx = relativeX - g.x;
          const dy = obs.y - 50 - g.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 60) {
            g.gemsCollected++;
            g.gemStreak++;
            setGems(g.gemsCollected);
            playGemSound();
            createSparkles(g.x, g.y - 100, '#fbbf24', '+1 GEM');
            if (g.gemStreak % 5 === 0) {
              createSparkles(g.x, g.y - 100, '#fbbf24', `${g.gemStreak} STREAK!`);
              g.difficultyMultiplier = Math.min(2.5, g.difficultyMultiplier + 0.1);
            }
            obs.x = -1000;
          }
        } else if (obs.type === 'HEART') {
          const dist = Math.sqrt((relativeX - g.x)**2 + (obs.y - 50 - g.y)**2);
          if (dist < 60) {
            g.lives = Math.min(3, g.lives + 1);
            setLives(g.lives);
            playPowerupSound();
            createSparkles(g.x, g.y - 100, '#f43f5e', '+1 LIFE');
            obs.x = -1000;
          }
        } else if (obs.type === 'BOOST') {
          const dist = Math.sqrt((relativeX - g.x)**2 + (obs.y - 50 - g.y)**2);
          if (dist < 60) {
            g.speed += 5;
            playPowerupSound();
            createSparkles(g.x, g.y - 100, '#22d3ee', 'BOOST!');
            obs.x = -1000;
          }
        }
      });
      
      g.obstacles = g.obstacles.filter(o => o.x - g.distance + g.x > -200);

      render();
      animationFrameId = requestAnimationFrame(update);
    };

    const render = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(g.cameraX, g.cameraY);

      // Parallax Background
      g.parallax.forEach(p => {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        // Move with parallax
        const px = (p.x - g.distance * p.speed) % (canvas.width * 2);
        const finalPx = px < 0 ? px + canvas.width * 2 : px;
        ctx.arc(finalPx, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Background Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const scrollOffset = -(g.distance % 100);
      for (let i = scrollOffset; i < canvas.width; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 100) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Ground Rendering
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= canvas.width; i += 10) {
        const distAtPoint = g.distance + (i - g.x);
        const y = getTerrainY(distAtPoint); 
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();

      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fillStyle = g.weatherIntensity > 0.5 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.4)';
      ctx.fill();

      // Snowflakes
      if (g.weatherIntensity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${g.weatherIntensity * 0.8})`;
        g.snowflakes.forEach(s => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Obstacles
      g.obstacles.forEach(obs => {
        const x = obs.x - g.distance + g.x;
        if (obs.type === 'BUMP') {
          ctx.fillStyle = '#ec4899';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ec4899';
          ctx.beginPath();
          ctx.arc(x, obs.y, 20, Math.PI, 0);
          ctx.fill();
        } else if (obs.type === 'ORB') {
          const orbY = obs.y + Math.sin(Date.now() / 400 + obs.x) * 80 - 100;
          ctx.fillStyle = '#f43f5e';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#f43f5e';
          ctx.beginPath();
          ctx.arc(x, orbY, 25, 0, Math.PI * 2);
          ctx.fill();
          // Core glow
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x, orbY, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === 'GEM') {
          ctx.fillStyle = '#facc15';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#facc15';
          ctx.beginPath();
          const gy = obs.y - 50 + Math.sin(Date.now() / 200) * 15;
          const rotation = (Date.now() / 500) % (Math.PI * 2);
          ctx.save();
          ctx.translate(x, gy);
          ctx.rotate(rotation);
          ctx.moveTo(0, -15);
          ctx.lineTo(12, 0);
          ctx.lineTo(0, 15);
          ctx.lineTo(-12, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (obs.type === 'HEART') {
          ctx.fillStyle = '#f43f5e';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#f43f5e';
          const hy = obs.y - 50 + Math.sin(Date.now() / 150) * 10;
          const scale = 0.8 + Math.sin(Date.now() / 200) * 0.2;
          ctx.save();
          ctx.translate(x, hy);
          ctx.scale(scale, scale);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-15, -15, -30, 0, 0, 20);
          ctx.bezierCurveTo(30, 0, 15, -15, 0, 0);
          ctx.fill();
          ctx.restore();
        } else if (obs.type === 'BOOST') {
          ctx.fillStyle = '#22d3ee';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#22d3ee';
          const by = obs.y - 50;
          const osc = Math.sin(Date.now() / 100) * 5;
          ctx.beginPath();
          ctx.moveTo(x - 15, by + 10 + osc);
          ctx.lineTo(x, by - 20 + osc);
          ctx.lineTo(x + 15, by + 10 + osc);
          ctx.fill();
          // Afterimage
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(x - 15, by + 20 + osc);
          ctx.lineTo(x, by - 10 + osc);
          ctx.lineTo(x + 15, by + 20 + osc);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
      });

      // Digital Board & Stickman
      if (!g.gameOver) {
        const isInvincible = Date.now() < g.invincibleUntil;
        if (!isInvincible || Math.floor(Date.now() / 100) % 2 === 0) {
          drawDigitAsBoard(ctx, g.selectedDigit, g.x, g.y, BOARD_SIZE, g.tilt);
          drawStickman(ctx, g.x, g.y - 15, g.tilt);
        }
      }
      
      drawParticles(ctx);

      // Speed Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const lx = (Math.random() * canvas.width);
        const ly = (Math.random() * canvas.height);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 50, ly); ctx.stroke();
      }

      ctx.restore();
      
      // Extreme tilt blur effect
      if (Math.abs(g.tilt) > 0.5) {
        canvas.style.filter = `blur(${Math.min(5, (Math.abs(g.tilt) - 0.5) * 20)}px)`;
      } else {
        canvas.style.filter = 'none';
      }
    };

      const handleDamage = (source: string) => {
        const g = gameRef.current;
        g.lives--;
        setLives(g.lives);
        setScreenFlash(true);
        setTimeout(() => setScreenFlash(false), 150);
        
        if (g.lives <= 0) {
          g.gameOver = true;
          createExplosion();
          handleGameOver();
        } else {
          g.cameraShake = 30;
          g.invincibleUntil = Date.now() + 1500;
          playHitSound();
          // Violent push back for tilt
          g.vy = -12;
          g.tiltVelocity = source === 'TILT' ? (-Math.sign(g.tilt) * 0.2) : g.tiltVelocity;
          g.tilt = source === 'TILT' ? (g.tilt * 0.4) : (g.tilt + (Math.random() - 0.5));
          g.impactJerk = 20;
        }
      };

      const handleGameOver = () => {
        const g = gameRef.current;
        // Calculate normalized score 1-10
        const score = Math.max(1, Math.min(10, Math.floor(g.distance / 1000) + 1));
        setFinalScore(score);
        
        g.highScore = Math.max(g.highScore, g.distance);
        if (g.challengeCompleted) g.challengesCleared++;

        const newUnlocked = [...unlockedSkinIds];
        if (g.highScore >= 50000 && !newUnlocked.includes('neon')) newUnlocked.push('neon');
        if (g.gemsCollected >= 20 && !newUnlocked.includes('magma')) newUnlocked.push('magma');
        if (g.challengesCleared >= 3 && !newUnlocked.includes('void')) newUnlocked.push('void');
        setUnlockedSkinIds(newUnlocked);

        setStats({
          distance: Math.floor(g.distance / 10),
          gems: g.gemsCollected,
          jumps: g.totalJumps,
          peakSpeed: Math.floor(g.peakSpeed * 10),
          weatherTime: Math.floor(g.stormTicks / 60)
        });

        // Delay the UI to show the explosion
        setTimeout(() => {
          setGameState('GAMEOVER');
        }, 1500);
      };

    const handleKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if ((e.code === 'Space' || e.key === ' ') && !g.isJumping && (gameState === 'PLAYING' || gameState === 'TUTORIAL')) {
        e.preventDefault(); // CRITICAL: Stop space from scrolling or clicking buttons
        const jumpPower = NUMBER_DATA[g.selectedDigit].jumpHeight;
        // Jump vector is influenced by current tilt: leaning into the jump affects trajectory
        g.vy = -jumpPower * Math.cos(g.tilt);
        g.speed += Math.sin(g.tilt) * (jumpPower * 0.15); 
        
        g.isJumping = true;
        g.totalJumps++;
        playJumpSound();
        // Change digit on jump - cycling through all for variety
        g.selectedDigit = (g.selectedDigit % 10) + 1; // Update ref directly
        setSelectedDigit(g.selectedDigit); // Sync state for HUD without triggering effect restart
        switchSound();

        if (gameState === 'TUTORIAL' && tutorialStep === 2) {
          setTutorialStep(3);
          setTutorialTimer(0);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      gameRef.current.mouseX = e.clientX;
      gameRef.current.mouseY = e.clientY;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    
    // Resize handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameRef.current.width = canvas.width;
      gameRef.current.height = canvas.height;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState]); // Only depend on gameState to preserve game loop continuity

  return (
    <div className="relative w-full h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(30,58,138,0.3)_0%,_transparent_70%)] pointer-events-none" />

      {/* Screen Flash Overlay */}
      <AnimatePresence>
        {screenFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-rose-600 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Game Canvas */}
      <canvas
        id="game-canvas"
        ref={canvasRef}
        className={`w-full h-full ${(gameState !== 'PLAYING' && gameState !== 'TUTORIAL') ? 'blur-md pointer-events-none' : ''}`}
      />

      {/* Tutorial Overlay */}
      {gameState === 'TUTORIAL' && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 pointer-events-none text-center px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={tutorialStep}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-black/80 backdrop-blur-2xl border border-cyan-500/30 p-8 rounded-3xl max-w-xl shadow-[0_0_50px_rgba(34,211,238,0.2)]"
            >
              <div className="text-cyan-400 font-mono text-[10px] tracking-[0.4em] uppercase mb-2 font-black">Tutorial Phase 0{tutorialStep + 1}</div>
              <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-4">
                {tutorialStep === 0 && "Interface Control"}
                {tutorialStep === 1 && "Precision Balance"}
                {tutorialStep === 2 && "Elevation Thrust"}
                {tutorialStep === 3 && "Neural Sync Complete"}
              </h2>
              <p className="text-slate-400 text-[13px] leading-relaxed mb-6 font-mono">
                {tutorialStep === 0 && "Move your mouse horizontally to shift the board's weight. Try tilting left and right now."}
                {tutorialStep === 1 && "Keeping the digit vertical is essential. Try to maintain equilibrium near 0° for a moment."}
                {tutorialStep === 2 && "Press SPACEBAR to jump over hazards. Each jump also cycles your numeric board, altering your physics."}
                {tutorialStep === 3 && "You have successfully calibrated the connection. Prepare for infinite traversal. System shutting down..."}
              </p>
              
              <div className="flex items-center justify-between gap-4 mb-6 pointer-events-auto">
                <button
                  disabled={tutorialStep === 0}
                  onClick={() => setTutorialStep(prev => prev - 1)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === tutorialStep ? 'w-8 bg-cyan-400' : 'w-2 bg-white/10'}`} />
                  ))}
                </div>
                <button
                  disabled={tutorialStep === 3}
                  onClick={() => setTutorialStep(prev => prev + 1)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
                >
                  Next
                </button>
              </div>

              {tutorialStep === 3 && (
                <button 
                  onClick={() => setGameState('MENU')}
                  className="w-full py-4 bg-cyan-500 text-black font-black uppercase tracking-tighter italic text-xl rounded-xl pointer-events-auto hover:scale-105 transition-transform"
                >
                  Back to Menu
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* HUD (Header) */}
      {gameState === 'PLAYING' && (
        <>
          {/* Instability Edge Warning */}
          {tiltRatio > 0.4 && (
            <motion.div 
              style={{
                boxShadow: `inset 0 0 ${tiltRatio * 150}px ${tiltRatio > 0.8 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(34, 211, 238, 0.2)'}`,
              }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 - tiltRatio }}
              className="absolute inset-0 z-10 pointer-events-none"
            />
          )}

          {weather === 'SNOW' && (
            <div className="absolute inset-x-0 top-32 flex justify-center z-30 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white/10 border border-white/20 px-6 py-3 rounded-full backdrop-blur-xl flex items-center gap-3 shadow-2xl"
              >
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                <span className="text-white font-mono text-[12px] font-bold uppercase tracking-[0.2em]">Storm Warning: Critical Instability</span>
              </motion.div>
            </div>
          )}
          {(Date.now() - gameRef.current.startTime < 2000 && weather === 'CLEAR') && (
            <div className="absolute inset-x-0 top-32 flex justify-center z-30 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-widest">Calibration: Stability Stabilized</span>
              </motion.div>
            </div>
          )}
          <header className="absolute top-0 left-0 right-0 flex justify-between items-center px-12 py-8 z-20 pointer-events-none">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-500 font-bold mb-1">Live Run</span>
              <h1 className="text-4xl font-black tracking-tighter italic text-white leading-none">
                STICKMAN <span className="text-cyan-400">SK8</span>
              </h1>
            </div>

            {gameMode === 'CHALLENGE' && activeChallenge && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-6 pl-8 ml-2"
              >
                <div className="flex flex-col">
                  <div className="text-[10px] uppercase text-cyan-400 font-bold tracking-[0.2em] mb-0.5">Objective</div>
                  <div className="text-sm font-black italic text-white uppercase tracking-tight">{activeChallenge.title}</div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{activeChallenge.description}</div>
                </div>

                <div className="flex flex-col items-end min-w-[100px]">
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] font-mono text-white font-bold">
                      {activeChallenge.targetGems ? `${gems}/${activeChallenge.targetGems}` : `${distance}/${activeChallenge.targetDistance}m`}
                    </div>
                    <div className={`text-sm font-mono font-bold ${challengeTimer < 10 ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`}>
                      {challengeTimer}s
                    </div>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1 text-right">
                    <motion.div 
                      className="h-full bg-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${Math.min(100, (activeChallenge.targetGems ? (gems/activeChallenge.targetGems) : (distance*10/activeChallenge.targetDistance)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                {gameRef.current.challengeCompleted && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1 bg-cyan-500/20 rounded-md border border-cyan-500/30"
                  >
                    <span className="text-[8px] font-black italic text-cyan-400 uppercase">Clearance Confirmed</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
          
           <div className="flex gap-10 items-center justify-end">
            {/* Music Controls */}
            <div className="flex items-center gap-6 bg-white/5 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 pointer-events-auto">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  {isMusicPlaying ? <Pause size={18} /> : <Music size={18} />}
                </button>
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[7px] text-cyan-400 font-bold uppercase tracking-[0.2em]">Procedural OST</span>
                  <span className="text-[10px] font-black text-white italic truncate leading-none uppercase">{PLAYLIST[currentTrackIndex].name}</span>
                </div>
                <button 
                  onClick={() => {
                    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
                    musicRef.current.currentStep = 0;
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <SkipForward size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <button onClick={() => setMusicVolume(prev => prev === 0 ? 0.5 : 0)} className="text-slate-400 hover:text-white">
                  {musicVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={musicVolume} 
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-white/10 accent-cyan-400 appearance-none rounded-full cursor-pointer h-[2px]"
                />
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mb-1">Lives</div>
              <div className="flex gap-1 justify-center">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`w-2 h-4 rounded-sm ${i < lives ? 'bg-rose-500 animate-pulse' : 'bg-slate-800'}`} />
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mb-1">Gems</div>
              <div className="text-3xl font-mono text-amber-400 font-bold">{gems}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mb-1">Traversed</div>
              <div className="text-3xl font-mono text-cyan-50 font-bold">{distance.toLocaleString()}m</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mb-1">Velocity</div>
              <div className="text-3xl font-mono text-cyan-400 font-bold">{(gameRef.current.speed * 10).toFixed(0)}<span className="text-sm">u</span></div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase text-slate-500 tracking-widest font-bold mb-1">Board</div>
              <div className="text-3xl font-mono text-cyan-400 font-bold">#{selectedDigit}</div>
            </div>
          </div>
        </header>
      </>
      )}

      {/* Warning Overlay */}
      {gameState === 'PLAYING' && tiltRatio > 0.7 && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-rose-600/20 animate-pulse transition-opacity duration-100"
            style={{ opacity: (tiltRatio - 0.7) * 3 }}
          />
          {tiltRatio > 0.85 && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              className="text-rose-500 font-black italic text-4xl md:text-6xl tracking-tighter drop-shadow-2xl"
            >
              CRITICAL TILT
            </motion.div>
          )}
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="absolute top-32 right-12 flex flex-col items-end gap-2 text-[10px] font-mono z-20 pointer-events-none hidden lg:flex">
          <div><span className="text-cyan-400 font-bold">SPACE</span> JUMP & SWITCH</div>
          <div><span className="text-cyan-400 font-bold">MOUSE</span> BALANCE</div>
        </div>
      )}


      {/* Main Menu */}
      <AnimatePresence>
        {gameState === 'MENU' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-[#0a0a0c]/90 backdrop-blur-md"
          >
            <div className="text-center mb-6">
              <span className="text-[10px] uppercase tracking-[0.4em] text-cyan-500 font-bold mb-1 block">Simulation Prototype 04</span>
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white leading-none">
                DIGITAL <span className="text-cyan-400">SK8</span>
              </h1>
              <p className="text-slate-600 font-mono tracking-widest uppercase text-[9px] mt-1">Number Board Physics Engine</p>
            </div>

            <div className="w-full max-w-2xl mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Digit Selector */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 mb-3 text-cyan-400">
                    <Play size={12} fill="currentColor" />
                    <h2 className="text-[9px] font-bold uppercase tracking-[0.2em]">Select Board Unit</h2>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Object.values(NUMBER_DATA).map((nd) => (
                      <button
                        key={nd.digit}
                        id={`select-digit-${nd.digit}`}
                        onClick={() => setSelectedDigit(nd.digit)}
                        className={`h-10 flex items-center justify-center rounded-lg font-black italic transition-all text-base ${
                          selectedDigit === nd.digit
                            ? 'bg-cyan-400 text-black scale-110 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                            : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {nd.digit}
                      </button>
                    ))}
                  </div>
                  
                  {/* Stats */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2"><Zap size={9}/> Acceleration</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-4 h-1 rounded-full ${i < Math.floor(NUMBER_DATA[selectedDigit].speed * 0.8) ? 'bg-cyan-400' : 'bg-white/5'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2"><Trophy size={9}/> Stability Index</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-4 h-1 rounded-full ${i < Math.floor(NUMBER_DATA[selectedDigit].stability * 4) ? 'bg-amber-400' : 'bg-white/5'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 mb-3 text-cyan-400">
                      <Music size={12} fill="currentColor" />
                      <h2 className="text-[9px] font-bold uppercase tracking-[0.2em]">Board Aesthetics</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SKINS.map((s) => {
                        const isUnlocked = unlockedSkinIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => isUnlocked && setSelectedSkinId(s.id)}
                            className={`relative p-2.5 rounded-xl border transition-all text-left overflow-hidden ${
                              selectedSkinId === s.id 
                                ? 'bg-white/10 border-white/20 ring-1 ring-white/30' 
                                : isUnlocked ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black italic tracking-tighter uppercase text-white">{s.name}</span>
                              <span className="text-[7px] text-slate-500 uppercase tracking-widest">{isUnlocked ? 'Unlocked' : s.unlockCondition}</span>
                            </div>
                            {selectedSkinId === s.id && (
                              <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: s.color }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 mb-3 text-amber-500">
                      <ShieldAlert size={12} />
                      <h2 className="text-[9px] font-bold uppercase tracking-[0.2em]">Pilot Instructions</h2>
                    </div>
                    <div className="space-y-2 text-[10px] font-mono text-slate-400">
                      <div className="flex items-start gap-2 bg-black/20 p-1.5 rounded-lg">
                        <span className="text-cyan-400 font-bold shrink-0">MOUSE:</span>
                        <span>LEFT/RIGHT to balance.</span>
                      </div>
                      <div className="flex items-start gap-2 bg-black/20 p-1.5 rounded-lg">
                        <span className="text-pink-500 font-bold shrink-0">SPACE:</span>
                        <span>Boost Jump & Switch identity.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setGameMode('CLASSIC')}
                className={`px-6 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all ${
                  gameMode === 'CLASSIC' 
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}
              >
                Classic Mode
              </button>
              <button
                onClick={() => setGameMode('CHALLENGE')}
                className={`px-6 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all ${
                  gameMode === 'CHALLENGE' 
                    ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}
              >
                Challenge Mode
              </button>
            </div>

            <div className="mb-6 flex flex-col items-center gap-2">
              <div className="text-[10px] uppercase text-cyan-500 font-bold tracking-widest flex items-center gap-2">
                 <div className="w-4 h-px bg-cyan-500/50" />
                 Navigation Systems
                 <div className="w-4 h-px bg-cyan-500/50" />
              </div>
              <div className="flex flex-col items-center gap-1 text-[11px] font-mono text-slate-400 text-center">
                <p><span className="text-white font-bold">MOVE MOUSE LEFT/RIGHT:</span> Tilt the numeric board</p>
                <p><span className="text-white font-bold">SPACEBAR:</span> Execute Jump & Cycle Identity</p>
                <p className="text-rose-500/80 mt-1 uppercase font-bold text-[9px] animate-pulse">EXCEEDING {CRITICAL_TILT}° TILT RESULTS IN STRUCTURAL FAILURE</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-10 w-full max-w-xs">
              <button
                id="start-tutorial"
                onClick={() => {
                  setTutorialStep(0);
                  setTutorialTimer(0);
                  startLevel(8); // Start with 8 for stability
                  setGameState('TUTORIAL');
                }}
                className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold text-[10px] tracking-widest uppercase hover:bg-white/10 active:scale-95 transition-all rounded-xl"
              >
                Standard Tutorial
              </button>
              <button
                id="start-game"
                onClick={() => startLevel(selectedDigit)}
                className="group relative w-full py-6 bg-white text-black font-black text-2xl italic uppercase tracking-tighter rounded-2xl flex items-center justify-center gap-6 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-15px_rgba(255,255,255,0.3)]"
              >
                Initialize Run
                <ArrowRight strokeWidth={4} className="group-hover:translate-x-2 transition-transform" />
                <div className="absolute inset-0 bg-white blur-2xl opacity-10 -z-10 group-hover:opacity-30 transition-opacity" />
              </button>
            </div>
            
            <div className="mt-16 flex flex-wrap justify-center gap-10 text-[9px] text-slate-600 uppercase font-bold tracking-[0.3em]">
              <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" /> MOUSE X : BALANCE</div>
              <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899]" /> SPACE : BOOST JUMP</div>
              <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" /> DISTANCE : SCORE ALPHA</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {gameState === 'GAMEOVER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-12 text-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="text-cyan-400 text-sm tracking-[0.5em] uppercase font-bold mb-4">Run Analysis Complete</div>
              {gameMode === 'CHALLENGE' && activeChallenge && (
                <div className={`mb-4 px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${gameRef.current.challengeCompleted ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-rose-500/20 text-rose-500 border border-rose-500/30'}`}>
                  {gameRef.current.challengeCompleted ? 'Challenge Successful' : 'Challenge Failed'}
                </div>
              )}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl md:text-9xl font-black italic text-white tracking-tighter"
              >
                LEVEL {finalScore}
              </motion.div>
              
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                  <div className="text-[10px] uppercase text-slate-500 tracking-widest mb-2 font-bold">Total Displacement</div>
                  <div className="text-2xl font-mono text-cyan-400 font-bold">{stats.distance}m</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                  <div className="text-[10px] uppercase text-slate-500 tracking-widest mb-2 font-bold">Gems Acquired</div>
                  <div className="text-2xl font-mono text-amber-400 font-bold">{stats.gems}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                  <div className="text-[10px] uppercase text-slate-500 tracking-widest mb-2 font-bold">Thrust Procedures</div>
                  <div className="text-2xl font-mono text-pink-500 font-bold">{stats.jumps}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                  <div className="text-[10px] uppercase text-slate-500 tracking-widest mb-2 font-bold">Peak Velocity</div>
                  <div className="text-2xl font-mono text-white font-bold">{stats.peakSpeed}u</div>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-8">
                <div className="text-slate-500 font-mono text-[10px] tracking-widest uppercase">
                  Storm Exposure: <span className="text-cyan-400">{stats.weatherTime}s</span>
                </div>

                <div className="flex gap-4">
                  <button
                    id="retry-game"
                    onClick={() => setGameState('MENU')}
                    className="px-10 py-5 bg-white text-black font-black uppercase tracking-tighter italic text-lg rounded-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"
                  >
                    <RotateCcw size={22} strokeWidth={3} /> RESTART SESSION
                  </button>
                </div>

                <div className="text-[10px] text-slate-700 uppercase tracking-widest font-bold mt-4">
                  Control Board System v4.0.2 // Status: Disconnected
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Visual Accents */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[linear-gradient(90deg,_transparent,_rgba(14,165,233,0.5),_transparent)]" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-[linear-gradient(90deg,_transparent,_rgba(236,72,153,0.5),_transparent)]" />
    </div>
  );
}
