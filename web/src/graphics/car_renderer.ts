/**
 * Detailed Rear-View Morphing Sports Car Vector Renderer.
 * Draws GT Coupe (NORMAL), Slammed Supercar (FLAT), and Slim Concept Car (NARROW)
 * with animated rubber tires, sculpted body, LED taillights, spoiler wing, and exhaust flames.
 */

import { RGBTuple } from '../config';
import { toRgbString } from './biomes';
import { ExhaustParticle } from './particles';

function shade(c: RGBTuple, delta: number): RGBTuple {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] + delta))),
    Math.max(0, Math.min(255, Math.round(c[1] + delta))),
    Math.max(0, Math.min(255, Math.round(c[2] + delta))),
  ];
}

export interface RenderableCar {
  screenX: number;
  screenY: number;
  groundY?: number;
  jumpY?: number;
  isShielded?: boolean;
  shieldPulse?: number;
  w: number;
  h: number;
  lean: number;
  colorPrimary: RGBTuple;
  wheelPhase: number;
  particles: ExhaustParticle[];
}

export function renderCar(ctx: CanvasRenderingContext2D, car: RenderableCar): void {
  const cx = car.screenX;
  const groundY = car.groundY !== undefined ? car.groundY : car.screenY;
  const jumpY = car.jumpY || 0.0;
  const cy = groundY - jumpY;
  const w = car.w;
  const h = car.h;
  const halfW = w / 2.0;

  const baseCol = car.colorPrimary;
  const darkCol = shade(baseCol, -65);
  const midCol = shade(baseCol, -25);
  const lightCol = shade(baseCol, 45);

  const baseStr = toRgbString(baseCol);
  const darkStr = toRgbString(darkCol);
  const midStr = toRgbString(midCol);
  const lightStr = toRgbString(lightCol);

  const lean = car.lean;

  // 1. Ground Contact Shadow (scales dynamically with jump height)
  const airFactor = Math.max(0.35, 1.0 - jumpY / 180.0);
  const shadowW = Math.max(12, Math.floor(w * 1.18 * airFactor));
  const shadowH = Math.max(6, Math.floor(h * 0.22 * airFactor));
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.57)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Rear Rubber Tires (Left & Right)
  const tireW = Math.max(8, Math.floor(w * 0.20));
  const tireH = Math.max(10, Math.floor(Math.min(h * 0.42, 26)));
  const tireTop = Math.floor(cy - tireH + 2);

  const leftTire = { x: Math.floor(cx - halfW - 2), y: tireTop, w: tireW, h: tireH };
  const rightTire = { x: Math.floor(cx + halfW - tireW + 2), y: tireTop, w: tireW, h: tireH };

  for (const trect of [leftTire, rightTire]) {
    // Tire body
    ctx.fillStyle = 'rgb(20, 20, 26)';
    ctx.beginPath();
    ctx.roundRect(trect.x, trect.y, trect.w, trect.h, 3);
    ctx.fill();

    // Tread lines
    ctx.strokeStyle = 'rgb(45, 45, 55)';
    ctx.lineWidth = 1;
    const treadStart = Math.floor(car.wheelPhase) % 5;
    for (let ty = treadStart; ty < trect.h - 2; ty += 5) {
      ctx.beginPath();
      ctx.moveTo(trect.x + 2, trect.y + ty);
      ctx.lineTo(trect.x + trect.w - 2, trect.y + ty);
      ctx.stroke();
    }

    // Outer edge rim highlight
    ctx.strokeStyle = 'rgb(60, 60, 72)';
    ctx.beginPath();
    ctx.roundRect(trect.x, trect.y, trect.w, trect.h, 3);
    ctx.stroke();
  }

  // 3. Exhaust Flame Particles behind bumper
  for (const p of car.particles) {
    p.draw(ctx);
  }

  // Vertical silhouette landmarks
  const chassisBottom = cy - Math.max(4.0, tireH * 0.30);
  const bumperTop = cy - h * 0.34;
  const trunkTop = cy - h * 0.56;
  const roofTop = cy - h;

  // 4. Main Lower Car Body / Sculpted Rear Fenders
  const bodyPts: [number, number][] = [
    [cx - halfW, chassisBottom - 2],
    [cx - halfW * 1.02, bumperTop],
    [cx - halfW * 0.90 + lean * 0.4, trunkTop],
    [cx + halfW * 0.90 + lean * 0.4, trunkTop],
    [cx + halfW * 1.02, bumperTop],
    [cx + halfW, chassisBottom - 2],
  ];

  ctx.fillStyle = baseStr;
  ctx.beginPath();
  ctx.moveTo(bodyPts[0][0], bodyPts[0][1]);
  for (let i = 1; i < bodyPts.length; i++) {
    ctx.lineTo(bodyPts[i][0], bodyPts[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  // Lower bumper shadow band
  const bumperBand: [number, number][] = [
    [cx - halfW, chassisBottom - 2],
    [cx - halfW * 1.01, bumperTop + 3],
    [cx + halfW * 1.01, bumperTop + 3],
    [cx + halfW, chassisBottom - 2],
  ];
  ctx.fillStyle = midStr;
  ctx.beginPath();
  ctx.moveTo(bumperBand[0][0], bumperBand[0][1]);
  for (let i = 1; i < bumperBand.length; i++) {
    ctx.lineTo(bumperBand[i][0], bumperBand[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  // Edge outline
  ctx.strokeStyle = lightStr;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bodyPts[0][0], bodyPts[0][1]);
  for (let i = 1; i < bodyPts.length; i++) {
    ctx.lineTo(bodyPts[i][0], bodyPts[i][1]);
  }
  ctx.closePath();
  ctx.stroke();

  // 5. Lower Rear Diffuser & Chrome Exhaust Pipes
  const diffuserH = Math.max(5, Math.floor(Math.min(h * 0.16, 12)));
  const diffuserW = Math.floor(w * 0.72);
  const diffuserX = Math.floor(cx - halfW * 0.72);
  const diffuserY = Math.floor(chassisBottom - diffuserH - 1);

  ctx.fillStyle = 'rgb(26, 28, 38)';
  ctx.beginPath();
  ctx.roundRect(diffuserX, diffuserY, diffuserW, diffuserH, 2);
  ctx.fill();

  // Diffuser vertical fins
  ctx.strokeStyle = 'rgb(70, 76, 95)';
  ctx.lineWidth = 1;
  for (const finRatio of [-0.10, 0.0, 0.10]) {
    const fx = Math.floor(cx + w * finRatio);
    ctx.beginPath();
    ctx.moveTo(fx, diffuserY + 1);
    ctx.lineTo(fx, diffuserY + diffuserH - 1);
    ctx.stroke();
  }

  // Twin Chrome Pipes
  const pipeR = Math.max(2, Math.floor(Math.min(w * 0.048, diffuserH * 0.45, 5)));
  const pipeY = Math.floor(diffuserY + diffuserH / 2);
  for (const sign of [-1, 1]) {
    const px = Math.floor(cx + sign * w * 0.24);
    ctx.fillStyle = 'rgb(200, 210, 225)';
    ctx.beginPath();
    ctx.arc(px, pipeY, pipeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgb(30, 20, 25)';
    ctx.beginPath();
    ctx.arc(px, pipeY, Math.max(1, pipeR - 1), 0, Math.PI * 2);
    ctx.fill();

    if (pipeR >= 3) {
      ctx.fillStyle = 'rgb(255, 130, 35)';
      ctx.beginPath();
      ctx.arc(px, pipeY, Math.max(1, pipeR - 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. Side Mirrors (when car is wide enough)
  if (w > 48) {
    const mirrorW = Math.max(5, Math.floor(w * 0.08));
    const mirrorH = Math.max(3, Math.floor(Math.min(h * 0.10, 6)));
    const mirrorY = Math.floor(trunkTop - mirrorH * 0.6);

    ctx.fillStyle = baseStr;
    // Left mirror
    ctx.beginPath();
    ctx.ellipse(
      Math.floor(cx - halfW * 0.90 - mirrorW / 2 + lean * 0.5),
      mirrorY + mirrorH / 2,
      mirrorW / 2,
      mirrorH / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Right mirror
    ctx.beginPath();
    ctx.ellipse(
      Math.floor(cx + halfW * 0.90 + mirrorW / 2 + lean * 0.5),
      mirrorY + mirrorH / 2,
      mirrorW / 2,
      mirrorH / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 7. Upper Greenhouse Cabin & Curved Roofline
  const roofHalfW = halfW * 0.62;
  const cabinPts: [number, number][] = [
    [cx - halfW * 0.84 + lean * 0.5, trunkTop + 1],
    [cx - roofHalfW + lean, roofTop],
    [cx + roofHalfW + lean, roofTop],
    [cx + halfW * 0.84 + lean * 0.5, trunkTop + 1],
  ];

  ctx.fillStyle = darkStr;
  ctx.beginPath();
  ctx.moveTo(cabinPts[0][0], cabinPts[0][1]);
  for (let i = 1; i < cabinPts.length; i++) {
    ctx.lineTo(cabinPts[i][0], cabinPts[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  // Roof metallic highlight
  ctx.strokeStyle = lightStr;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - roofHalfW + lean + 2, roofTop + 1);
  ctx.lineTo(cx + roofHalfW + lean - 2, roofTop + 1);
  ctx.stroke();

  // Rear Windshield Glass
  const glassMarginX = Math.max(3.0, w * 0.08);
  const glassTop = roofTop + Math.max(2.5, h * 0.07);
  const glassBot = trunkTop - Math.max(1.5, h * 0.04);
  if (glassBot > glassTop + 2) {
    const glassPts: [number, number][] = [
      [cx - halfW * 0.72 + lean * 0.55, glassBot],
      [cx - roofHalfW + glassMarginX * 0.4 + lean, glassTop],
      [cx + roofHalfW - glassMarginX * 0.4 + lean, glassTop],
      [cx + halfW * 0.72 + lean * 0.55, glassBot],
    ];

    ctx.fillStyle = 'rgb(25, 40, 65)';
    ctx.beginPath();
    ctx.moveTo(glassPts[0][0], glassPts[0][1]);
    for (let i = 1; i < glassPts.length; i++) {
      ctx.lineTo(glassPts[i][0], glassPts[i][1]);
    }
    ctx.closePath();
    ctx.fill();

    // Diagonal glossy reflections
    const refX = cx - roofHalfW * 0.35 + lean * 0.8;
    ctx.strokeStyle = 'rgb(140, 210, 255)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(refX, glassTop + 2);
    ctx.lineTo(refX - w * 0.10, glassBot - 1);
    ctx.stroke();

    ctx.strokeStyle = 'rgb(90, 150, 200)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(refX + w * 0.12, glassTop + 2);
    ctx.lineTo(refX + w * 0.02, glassBot - 1);
    ctx.stroke();

    ctx.strokeStyle = 'rgb(100, 150, 200)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(glassPts[0][0], glassPts[0][1]);
    for (let i = 1; i < glassPts.length; i++) {
      ctx.lineTo(glassPts[i][0], glassPts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 8. Rear Taillight Clusters (Left & Right LED Bars) & License Plate
  const tlY = Math.floor(trunkTop + (bumperTop - trunkTop) * 0.22);
  const tlH = Math.max(4, Math.floor((bumperTop - trunkTop) * 0.52));
  const tlW = Math.max(7, Math.floor(w * 0.25));

  const leftTl = { x: Math.floor(cx - halfW * 0.88), y: tlY, w: tlW, h: tlH };
  const rightTl = { x: Math.floor(cx + halfW * 0.88 - tlW), y: tlY, w: tlW, h: tlH };

  for (const tl of [leftTl, rightTl]) {
    // Housing
    ctx.fillStyle = 'rgb(60, 10, 15)';
    ctx.beginPath();
    ctx.roundRect(tl.x, tl.y, tl.w, tl.h, 2);
    ctx.fill();

    // Glowing LED bar
    if (tl.w > 4 && tl.h > 2) {
      ctx.fillStyle = 'rgb(255, 25, 45)';
      ctx.beginPath();
      ctx.roundRect(tl.x + 1, tl.y + 1, tl.w - 2, tl.h - 2, 2);
      ctx.fill();

      // Hot center core
      const coreH = Math.max(1, Math.floor((tl.h - 2) / 3));
      const coreY = Math.floor(tl.y + tl.h / 2 - coreH / 2);
      ctx.fillStyle = 'rgb(255, 160, 160)';
      ctx.fillRect(tl.x + 2, coreY, Math.max(1, tl.w - 4), coreH);
    }
  }

  // Center License Plate
  const plateW = Math.max(10, Math.floor(w * 0.22));
  const plateH = Math.max(5, Math.floor(Math.min(tlH * 1.05, 12)));
  const plateX = Math.floor(cx - plateW / 2);
  const plateY = Math.floor(tlY + (tlH - plateH) / 2);

  ctx.fillStyle = 'rgb(240, 240, 245)';
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 1);
  ctx.fill();

  ctx.fillStyle = 'rgb(40, 60, 160)';
  ctx.fillRect(plateX, plateY, plateW, Math.max(1, Math.floor(plateH / 4)));

  // 9. Rear Racing Spoiler Wing on Twin Struts
  const spoilerW = w * 0.86;
  const strutH = Math.max(3, Math.floor(Math.min(h * 0.12, 8)));
  const wingY = Math.floor(trunkTop - strutH);
  const wingH = Math.max(3, Math.floor(Math.min(h * 0.08, 5)));

  // Twin struts
  ctx.strokeStyle = 'rgb(25, 25, 35)';
  ctx.lineWidth = 2;
  for (const sign of [-1, 1]) {
    const stX = Math.floor(cx + sign * (spoilerW * 0.28) + lean * 0.4);
    ctx.beginPath();
    ctx.moveTo(stX, Math.floor(trunkTop + 1));
    ctx.lineTo(stX, wingY + wingH);
    ctx.stroke();
  }

  // Wing blade
  const wingX = Math.floor(cx - spoilerW / 2 + lean * 0.4);
  ctx.fillStyle = darkStr;
  ctx.beginPath();
  ctx.roundRect(wingX, wingY, Math.floor(spoilerW), wingH, 2);
  ctx.fill();

  ctx.strokeStyle = lightStr;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(wingX, wingY, Math.floor(spoilerW), wingH, 2);
  ctx.stroke();

  // 10. Glowing Energy Shield + Nitro Boost Aura
  if (car.isShielded) {
    ctx.save();
    const pulse = 1.0 + Math.sin(car.shieldPulse || 0) * 0.08;
    const sW = (w + 28) * pulse;
    const sH = (h + 24) * pulse;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - h / 2, sW / 2, sH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 220, 50, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy - h / 2, (sW - 8) / 2, (sH - 8) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
