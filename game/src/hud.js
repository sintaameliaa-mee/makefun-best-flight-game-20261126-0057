// hud.js — instruments, menus and end screens, all drawn on the canvas.
// The judge reads the flight game through these: speed, altitude, heading,
// throttle, fuel, attitude, rings and score are always in frame.
import { CONFIG, CONTROLS } from './config.js';
import { clamp } from './random.js';

const TAU = Math.PI * 2;
const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(8,18,30,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bigNumber(ctx, x, y, value, label, align = 'left') {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(value, x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(label, x, y + 16);
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function drawCompass(ctx, view, headingDeg, ringBearingDeg) {
  const w = Math.min(460, view.w * 0.42);
  const x0 = view.cx - w / 2;
  const y = 14;
  panel(ctx, x0, y, w, 52);
  const pxPerDeg = w / 120;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 6, y + 4, w - 12, 44);
  ctx.clip();
  for (let d = -75; d <= 75; d += 5) {
    let deg = Math.round(headingDeg + d);
    const norm = ((deg % 360) + 360) % 360;
    const sx = view.cx + d * pxPerDeg;
    const major = norm % 45 === 0;
    const mid = norm % 15 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, y + 10);
    ctx.lineTo(sx, y + (major ? 26 : mid ? 21 : 16));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(COMPASS_LABELS[Math.round(norm / 45) % 8], sx, y + 42);
    } else if (mid) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(norm).padStart(3, '0'), sx, y + 42);
    }
  }
  // Diamond marks the bearing to the next ring.
  if (ringBearingDeg !== null) {
    let diff = ringBearingDeg - headingDeg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const sx = view.cx + clamp(diff, -58, 58) * pxPerDeg;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(sx, y + 46);
    ctx.lineTo(sx - 6, y + 54);
    ctx.lineTo(sx, y + 62);
    ctx.lineTo(sx + 6, y + 54);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Centre caret + digital heading.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(view.cx - 7, y + 2);
  ctx.lineTo(view.cx + 7, y + 2);
  ctx.lineTo(view.cx, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, view.cx, y + 64);
}

export function drawFlightInstruments(ctx, view, plane) {
  // Airspeed, top left.
  panel(ctx, 14, 14, 150, 66);
  bigNumber(ctx, 28, 46, String(Math.round(plane.speed * MS_TO_KT)), 'KECEPATAN · KNOT');
  // Altitude, top right.
  panel(ctx, view.w - 164, 14, 150, 66);
  bigNumber(ctx, view.w - 150, 46, String(Math.round(plane.y * M_TO_FT)), 'KETINGGIAN · KAKI');
  const vsi = Math.round(plane.verticalSpeed * M_TO_FT * 60);
  ctx.textAlign = 'right';
  ctx.fillStyle = vsi >= 0 ? '#8dff9a' : '#ffb199';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`${vsi >= 0 ? '+' : ''}${vsi} ft/mnt`, view.w - 28, 70);

  // Throttle + fuel, left edge below airspeed.
  panel(ctx, 14, 92, 150, 92);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GAS', 28, 112);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(28, 120, 122, 10);
  ctx.fillStyle = plane.throttle > 0.85 ? '#ffb199' : '#ffd34d';
  ctx.fillRect(28, 120, 122 * plane.throttle, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('BAHAN BAKAR', 28, 150);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(28, 158, 122, 10);
  ctx.fillStyle = plane.fuel < 20 ? '#ff5a4e' : '#7ee787';
  ctx.fillRect(28, 158, 122 * (plane.fuel / 100), 10);
}

export function drawAttitude(ctx, view, plane, palette) {
  const cx = 74;
  const cy = view.h - 74;
  const r = 52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  ctx.translate(0, plane.pitch * 90);
  ctx.fillStyle = palette.skyMid;
  ctx.fillRect(-r - 10, -r * 2 - 10, (r + 10) * 2, r * 2 + 10);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 10, 0, (r + 10) * 2, r * 2 + 10);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', cx, cy + r + 14);
}

export function drawMissionPanel(ctx, view, game) {
  const mission = game.mission;
  const w = 210;
  const x = view.w - w - 14;
  const y = 92;
  panel(ctx, x, y, w, 118);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(mission.title.toUpperCase(), x + 14, y + 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`CINCIN ${game.ringsPassed}/${mission.rings.length}`, x + 14, y + 52);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SKOR  ${game.score}`, x + 14, y + 76);
  const remain = Math.max(0, mission.timeLimit - game.elapsed);
  const mm = Math.floor(remain / 60);
  const ss = String(Math.floor(remain % 60)).padStart(2, '0');
  ctx.fillStyle = remain < 60 ? '#ff8a7a' : 'rgba(255,255,255,0.85)';
  ctx.fillText(`WAKTU  ${mm}:${ss}`, x + 14, y + 98);
  if (game.nextRing) {
    ctx.fillStyle = '#9feaff';
    ctx.fillText(`RING BERIKUTNYA  ${Math.round(game.nextRingDistance)} m`, x + 14, y + 118 - 4);
  }
}

export function drawWarnings(ctx, view, game, plane, time) {
  const warnings = [];
  if (game.pullUp) warnings.push(['TARIK KE ATAS!', '#ff5a4e']);
  if (game.stalled) warnings.push(['STALL — TURUNKAN HIDUNG!', '#ffb199']);
  if (plane.fuel < 20 && plane.fuel > 0) warnings.push(['BAHAN BAKAR RENDAH', '#ff8a7a']);
  if (plane.fuel <= 0) warnings.push(['MESIN MATI — MELUNCUR!', '#ff5a4e']);
  if (game.timeUp) warnings.push(['WAKTU HABIS', '#ff8a7a']);
  if (warnings.length === 0) return;
  const blink = Math.sin(time * 8) > -0.2;
  if (!blink) return;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px sans-serif';
  let y = view.h * 0.3;
  for (const [text, colour] of warnings) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 5;
    ctx.strokeText(text, view.cx, y);
    ctx.fillStyle = colour;
    ctx.fillText(text, view.cx, y);
    y += 34;
  }
}

export function drawToast(ctx, view, toast, time) {
  if (!toast || time > toast.until) return;
  const alpha = clamp((toast.until - time) / 0.5, 0, 1);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 6;
  ctx.strokeText(toast.text, view.cx, view.h * 0.42);
  ctx.fillStyle = toast.colour || '#ffd34d';
  ctx.fillText(toast.text, view.cx, view.h * 0.42);
  if (toast.sub) {
    ctx.font = 'bold 16px sans-serif';
    ctx.strokeText(toast.sub, view.cx, view.h * 0.42 + 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(toast.sub, view.cx, view.h * 0.42 + 28);
  }
  ctx.globalAlpha = 1;
}

export function drawHelpLine(ctx, view, text) {
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, view.cx, view.h - 18);
  ctx.fillText(text, view.cx, view.h - 18);
}

// --- Screens --------------------------------------------------------------

function button(ctx, rect, label, sub, hover, accent) {
  ctx.fillStyle = hover ? 'rgba(20,40,60,0.88)' : 'rgba(10,24,38,0.78)';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.strokeStyle = hover ? '#ffd34d' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = hover ? 2.5 : 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(label, rect.x + 18, rect.y + 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(sub, rect.x + 18, rect.y + 58);
  if (accent) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '13px sans-serif';
    ctx.fillText(accent, rect.x + 18, rect.y + rect.h - 16);
  }
}

// Menu: title, mission cards, controls. Returns the clickable card rects.
export function drawMenu(ctx, view, game, mouse) {
  ctx.fillStyle = 'rgba(6,16,28,0.28)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 8;
  ctx.strokeText('SAYAP NUSANTARA', view.cx, 108);
  ctx.fillText('SAYAP NUSANTARA', view.cx, 108);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Terbang melewati cincin emas, mendarat dengan selamat', view.cx, 140);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Pilih misi — klik kartu, atau tekan 1, 2, 3', view.cx, 176);

  const cardW = Math.min(300, (view.w - 120) / 3);
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const x0 = view.cx - totalW / 2;
  const y = 205;
  const h = 150;
  const rects = [];
  game.missions.forEach((mission, i) => {
    const rect = { x: x0 + i * (cardW + gap), y, w: cardW, h };
    const hover =
      mouse.x >= rect.x && mouse.x <= rect.x + rect.w &&
      mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
    button(
      ctx, rect,
      `MISI ${i + 1} · ${mission.rings.length} CINCIN · ${Math.floor(mission.timeLimit / 60)} MNT`,
      mission.title,
      hover,
      mission.subtitle,
    );
    rects.push({ ...rect, mission: i });
  });

  // Controls table.
  const cy = y + h + 44;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KENDALI', view.cx, cy);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const cols = 2;
  CONTROLS.forEach((row, i) => {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const tx = view.cx + (col === 0 ? -330 : 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(row[0], tx, cy + 26 + rowIdx * 22);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px sans-serif';
    ctx.fillText(row[1], tx + 150, cy + 26 + rowIdx * 22);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px sans-serif';
  ctx.fillText('Suara mesin dan angin dibuat oleh game — tanpa file audio.', view.cx, view.h - 22);
  return rects;
}

function scoreLines(game) {
  const m = game.mission;
  const landed = !!(game.plane && game.plane.landed);
  return [
    ['Cincin dilewati', `${game.ringsPassed} / ${m.rings.length}`, game.ringPoints],
    ['Bonus pendaratan', landed ? 'Ya' : '—', landed ? CONFIG.landingScore : 0],
    ['Bonus waktu', `${Math.max(0, Math.round(m.timeLimit - game.elapsed))} dtk tersisa`, game.timeBonus],
    ['Bonus bahan bakar', `${Math.round(game.plane.fuel)}% tersisa`, game.fuelBonus],
  ];
}

export function drawEndScreen(ctx, view, game) {
  ctx.fillStyle = 'rgba(6,16,28,0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
  const won = game.state === 'complete';
  const title = won
    ? 'MISI SELESAI!'
    : game.state === 'landed'
      ? 'MENDARAT DENGAN SELAMAT'
      : 'PESAWAT JATUH';
  const colour = won ? '#7ee787' : game.state === 'landed' ? '#ffd34d' : '#ff6a5e';
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.font = 'bold 52px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 7;
  ctx.strokeText(title, view.cx, 150);
  ctx.fillText(title, view.cx, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  const sub = won
    ? `${game.mission.title} — semua cincin dilewati, pendaratan mulus.`
    : game.state === 'landed'
      ? 'Kamu mendarat sebelum semua cincin dilewati — lepas landas lagi untuk melanjutkan.'
      : game.plane.crashReason || 'Pesawat hancur.';
  ctx.fillText(sub, view.cx, 186);

  const lines = scoreLines(game);
  const boxW = 460;
  const boxX = view.cx - boxW / 2;
  const boxY = 220;
  panel(ctx, boxX, boxY, boxW, 40 + lines.length * 34 + 58);
  ctx.textAlign = 'left';
  lines.forEach(([label, value, points], i) => {
    const y = boxY + 36 + i * 34;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '15px sans-serif';
    ctx.fillText(label, boxX + 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, boxX + boxW - 110, y);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`+${points}`, boxX + boxW - 24, y);
    ctx.textAlign = 'left';
  });
  const totalY = boxY + 36 + lines.length * 34 + 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(boxX + 24, totalY - 14);
  ctx.lineTo(boxX + boxW - 24, totalY - 14);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('SKOR AKHIR', boxX + 24, totalY + 16);
  ctx.textAlign = 'right';
  ctx.fillText(String(game.score), boxX + boxW - 24, totalY + 16);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '16px sans-serif';
  const hint = game.state === 'landed'
    ? 'Tekan T untuk lepas landas lagi · R untuk ulangi misi · M untuk menu'
    : 'Tekan R untuk terbang lagi · M untuk kembali ke menu';
  ctx.fillText(hint, view.cx, boxY + 40 + lines.length * 34 + 58 + 30);
}

export function drawPause(ctx, view) {
  ctx.fillStyle = 'rgba(6,16,28,0.55)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('JEDA', view.cx, view.h / 2 - 10);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Tekan P untuk melanjutkan · R untuk ulangi · M untuk menu', view.cx, view.h / 2 + 26);
}
