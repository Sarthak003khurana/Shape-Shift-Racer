/**
 * HUD & Game Over / Pause / Start Screen Overlays.
 * Vector hearts, telemetry box, streak pills, morph badges, and persistent Top-5 leaderboard.
 */

import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  CAR_SHAPES,
  CarShapeKey,
} from '../config';
import { HighScoreEntry } from '../core/storage';

export interface HudData {
  score: number;
  highScore: number;
  distance: number;
  speed: number;
  coins: number;
  lives: number;
  streak: number;
  multiplier: number;
  biomeName: string;
  accentColor: string;
  currentShape: CarShapeKey;
  isMuted?: boolean;
}

export function drawVectorHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 5, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 9, cy);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawAudioIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isMuted: boolean,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  // Speaker body
  ctx.fillRect(x, y + 3, 3, 6);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 8, y + 12);
  ctx.lineTo(x + 3, y + 9);
  ctx.closePath();
  ctx.fill();

  if (!isMuted) {
    // Sound wave arcs
    ctx.beginPath();
    ctx.arc(x + 7, y + 6, 4, -0.7, 0.7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 7, y + 6, 7, -0.7, 0.7);
    ctx.stroke();
  } else {
    // Red mute slash / X
    ctx.strokeStyle = '#ff3c50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 2);
    ctx.lineTo(x + 16, y + 10);
    ctx.moveTo(x + 16, y + 2);
    ctx.lineTo(x + 10, y + 10);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderHUD(ctx: CanvasRenderingContext2D, hud: HudData): void {
  // 1. Top-Left Telemetry Box
  const teleW = 295;
  const teleH = 142;
  const teleX = 20;
  const teleY = 20;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 12, 28, 0.85)';
  ctx.beginPath();
  ctx.roundRect(teleX, teleY, teleW, teleH, 8);
  ctx.fill();

  ctx.strokeStyle = hud.accentColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(teleX, teleY, teleW, teleH, 8);
  ctx.stroke();

  // Telemetry Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Score
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 22px Impact, sans-serif';
  ctx.fillText(`SCORE: ${Math.floor(hud.score)}`, teleX + 14, teleY + 10);

  // Best & Coins
  ctx.fillStyle = '#ffd264';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(
    `BEST: ${Math.max(hud.highScore, Math.floor(hud.score))}   COINS: ${hud.coins}`,
    teleX + 14,
    teleY + 40
  );

  // Distance & Speed
  ctx.fillStyle = '#c8f0ff';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(
    `DIST: ${Math.floor(hud.distance)} m   SPEED: ${Math.floor(hud.speed)} km/h`,
    teleX + 14,
    teleY + 64
  );

  // Biome Zone
  ctx.fillStyle = hud.accentColor;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(`ZONE: ${hud.biomeName}`, teleX + 14, teleY + 88);

  // Hint & Audio State
  const muted = Boolean(hud.isMuted);
  ctx.fillStyle = muted ? '#ff7080' : '#00e6ff';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText(`[M] Audio: ${muted ? 'MUTED' : 'ON'}`, teleX + 14, teleY + 114);

  ctx.fillStyle = '#9ba5be';
  ctx.fillText(`[P] Pause`, teleX + 140, teleY + 114);

  // Vector Audio Icon
  drawAudioIcon(ctx, teleX + 245, teleY + 46, muted, muted ? '#ff4050' : '#00f0ff');

  // Sync touch HUD DOM button if present
  if (typeof document !== 'undefined') {
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.textContent = muted ? '🔇' : '🔊';
      if (muted) {
        btnAudio.classList.add('muted');
      } else {
        btnAudio.classList.remove('muted');
      }
    }
  }

  // Vector Hearts (Top-Right inside Telemetry Box)
  for (let i = 0; i < 3; i++) {
    const hx = teleX + 225 + i * 22;
    const hy = teleY + 22;
    const col = i < hud.lives ? '#ff3250' : '#463241';
    drawVectorHeart(ctx, hx, hy, col);
  }

  // 2. Streak & Multiplier Pill
  if (hud.streak > 0) {
    const pillY = teleY + teleH + 12;
    const pillW = 220;
    const pillH = 34;

    const multCol =
      hud.multiplier >= 3 ? '#ffdc28' : hud.multiplier >= 2 ? '#00ffb4' : '#b4d2ff';

    ctx.fillStyle = 'rgba(18, 14, 34, 0.88)';
    ctx.beginPath();
    ctx.roundRect(teleX, pillY, pillW, pillH, 6);
    ctx.fill();

    ctx.strokeStyle = multCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(teleX, pillY, pillW, pillH, 6);
    ctx.stroke();

    ctx.fillStyle = multCol;
    ctx.font = 'bold 20px Impact, sans-serif';
    ctx.fillText(`STREAK ${hud.streak}   ${hud.multiplier}x`, teleX + 14, pillY + 6);
  }

  // 3. Top-Center Morph Shape Indicator
  const shapeCfg = CAR_SHAPES[hud.currentShape];
  const shapeName = shapeCfg.name;
  const shapeCol = `rgb(${shapeCfg.color_primary.join(',')})`;

  const badgeW = 310;
  const badgeH = 46;
  const badgeX = Math.floor((SCREEN_WIDTH - badgeW) / 2);
  const badgeY = 20;

  ctx.fillStyle = 'rgba(18, 14, 30, 0.88)';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  ctx.strokeStyle = shapeCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.stroke();

  ctx.fillStyle = shapeCol;
  ctx.font = 'bold 24px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`MORPH: ${shapeName}`, badgeX + badgeW / 2, badgeY + badgeH / 2);

  ctx.restore();
}

export function renderStartOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 5, 20, 0.82)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#00e6ff';
  ctx.font = 'bold 54px Impact, sans-serif';
  ctx.fillText('SHAPE-SHIFT RACER', SCREEN_WIDTH / 2, 110);

  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 26px Impact, sans-serif';
  ctx.fillText('REAL-TIME VEHICLE MORPHING ARCADE RACER', SCREEN_WIDTH / 2, 175);

  // Instruction Card
  const cardW = 760;
  const cardH = 320;
  const cardX = Math.floor((SCREEN_WIDTH - cardW) / 2);
  const cardY = 220;

  ctx.fillStyle = 'rgba(20, 16, 38, 0.92)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 10);
  ctx.fill();

  ctx.strokeStyle = '#ff0080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 10);
  ctx.stroke();

  const rules: [string, string][] = [
    ['SMILE / KEY S', '--> SLIDE FLAT (Low-Rider clears low beams)'],
    ['O-MOUTH / KEY W', '--> SQUEEZE NARROW (Slim-Blade clears twin pillars)'],
    ['NEUTRAL / KEY 1', '--> NORMAL CRUISER (Balanced sports coupe)'],
    ['EYEBROW / SPACE', '--> JUMP OVER ROADBLOCKS (Airborne leap physics)'],
    ['WINK / SHIFT', '--> ENERGY SHIELD + NITRO BOOST (3.5s damage immunity)'],
    ['TURN HEAD / A & D', '--> 3-LANE STEERING (Head turn/tilt steers car)'],
  ];

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px Arial, sans-serif';
  for (let i = 0; i < rules.length; i++) {
    const [action, desc] = rules[i];
    const yPos = cardY + 24 + i * 46;

    ctx.fillStyle = '#ffe600';
    ctx.fillText(action, cardX + 24, yPos);

    ctx.fillStyle = '#dce6ff';
    ctx.fillText(desc, cardX + 260, yPos);
  }

  // Pulsing Start Prompt
  const pulse = Math.floor(Date.now() / 400) % 2 === 0;
  if (pulse) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64ff8c';
    ctx.font = 'bold 28px Impact, sans-serif';
    ctx.fillText('PRESS SPACE OR TAP TO START', SCREEN_WIDTH / 2, 570);
  }

  ctx.restore();
}

export function renderPauseOverlay(ctx: CanvasRenderingContext2D, isMuted: boolean = false): void {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 18, 0.85)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const panelW = 580;
  const panelH = 340;
  const px = Math.floor((SCREEN_WIDTH - panelW) / 2);
  const py = Math.floor((SCREEN_HEIGHT - panelH) / 2);

  ctx.fillStyle = 'rgba(22, 18, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 12);
  ctx.fill();

  ctx.strokeStyle = '#00e6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 12);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#00e6ff';
  ctx.font = 'bold 48px Impact, sans-serif';
  ctx.fillText('PAUSED', SCREEN_WIDTH / 2, py + 24);

  ctx.fillStyle = '#b4c8e6';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText('Game is currently paused.', SCREEN_WIDTH / 2, py + 85);

  ctx.fillStyle = '#dce6ff';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('Smile: FLAT | O-Mouth: NARROW | Neutral: NORMAL', SCREEN_WIDTH / 2, py + 120);
  ctx.fillText('Eyebrow Raise / Space: JUMP | Wink / Shift: SHIELD + NITRO', SCREEN_WIDTH / 2, py + 145);
  ctx.fillText('Head Turn / Tilt / A & D: Lateral Steering', SCREEN_WIDTH / 2, py + 170);

  ctx.fillStyle = isMuted ? '#ff5060' : '#00e6ff';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(`AUDIO: ${isMuted ? 'MUTED [M to Unmute]' : 'ACTIVE [M to Mute]'}`, SCREEN_WIDTH / 2, py + 205);

  const pulse = Math.floor(Date.now() / 400) % 2 === 0;
  if (pulse) {
    ctx.fillStyle = '#64ff8c';
    ctx.font = 'bold 26px Impact, sans-serif';
    ctx.fillText('PRESS P, SPACE OR TAP TO RESUME', SCREEN_WIDTH / 2, py + 260);
  }

  ctx.restore();
}

export function renderGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  score: number,
  distance: number,
  maxStreak: number,
  coins: number,
  highScores: HighScoreEntry[],
  isNewRecord: boolean,
  canRestart: boolean = true
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 5, 18, 0.88)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Title
  ctx.fillStyle = '#ff2d41';
  ctx.font = 'bold 54px Impact, sans-serif';
  ctx.fillText('GAME OVER', SCREEN_WIDTH / 2, 60);

  if (isNewRecord) {
    ctx.fillStyle = '#ffe128';
    ctx.font = 'bold 26px Impact, sans-serif';
    ctx.fillText('★ NEW HIGH SCORE! ★', SCREEN_WIDTH / 2, 125);
  }

  // Summary Row
  ctx.fillStyle = '#dce6ff';
  ctx.font = 'bold 22px Impact, sans-serif';
  ctx.fillText(
    `SCORE: ${Math.floor(score)}   |   DIST: ${Math.floor(distance)} m   |   COINS: ${coins}   |   MAX STREAK: ${maxStreak}`,
    SCREEN_WIDTH / 2,
    165
  );

  // Leaderboard Panel
  const lbW = 660;
  const lbH = 260;
  const lbX = Math.floor((SCREEN_WIDTH - lbW) / 2);
  const lbY = 215;

  ctx.fillStyle = 'rgba(22, 16, 40, 0.94)';
  ctx.beginPath();
  ctx.roundRect(lbX, lbY, lbW, lbH, 10);
  ctx.fill();

  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lbX, lbY, lbW, lbH, 10);
  ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px Impact, sans-serif';
  ctx.fillText('TOP 5 HIGH SCORES (SAVED)', SCREEN_WIDTH / 2, lbY + 14);

  // Table columns
  const cols: [string, number][] = [
    ['RANK', 32],
    ['SCORE', 110],
    ['DIST', 225],
    ['COINS', 315],
    ['STREAK', 400],
    ['DATE', 490],
  ];

  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillStyle = '#96afd2';
  for (const [heading, colX] of cols) {
    ctx.fillText(heading, lbX + colX, lbY + 52);
  }

  // Rows
  if (highScores.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b4b4c8';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('No scores recorded yet.', SCREEN_WIDTH / 2, lbY + 120);
  } else {
    for (let i = 0; i < highScores.length; i++) {
      const entry = highScores[i];
      const ry = lbY + 80 + i * 32;
      const rowCol = i === 0 ? '#ffe63c' : '#e1ebfa';
      ctx.fillStyle = rowCol;
      ctx.font = 'bold 16px Arial, sans-serif';

      const vals = [
        `#${i + 1}`,
        String(entry.score),
        `${entry.distance}m`,
        String(entry.coins),
        String(entry.max_streak),
        entry.date,
      ];

      for (let c = 0; c < vals.length; c++) {
        ctx.fillText(vals[c], lbX + cols[c][1], ry);
      }
    }
  }

  // Play Again Prompt (guarded by cooldown!)
  const pulse = Math.floor(Date.now() / 400) % 2 === 0;
  if (!canRestart) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 22px Impact, sans-serif';
    ctx.fillText('ANALYZING TELEMETRY...', SCREEN_WIDTH / 2, 510);
  } else if (pulse) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64ff8c';
    ctx.font = 'bold 28px Impact, sans-serif';
    ctx.fillText('PRESS SPACE OR TAP TO PLAY AGAIN', SCREEN_WIDTH / 2, 510);
  }

  ctx.restore();
}
