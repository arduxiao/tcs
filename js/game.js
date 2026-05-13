// ============================================
// game.js — 贪吃蛇游戏核心逻辑
// ============================================

import { getCurrentUser } from './auth.js';
import { saveGameRecord } from './data.js';

const CELL  = 20;
const COLS  = 25;
const ROWS  = 25;
const W     = CELL * COLS;
const H     = CELL * ROWS;

const SPEED = Object.freeze({ easy: 150, normal: 100, hard: 60 });

const DIR = Object.freeze({
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 },
});

const FOOD_ICONS = Object.freeze(['🍎', '🐭', '🐰', '🐛', '🍇', '🍊', '🐸']);

// ---- 键盘方向映射表（替代 switch） ----
const KEY_DIR = Object.freeze({
  ArrowUp: DIR.UP,    w: DIR.UP,    W: DIR.UP,
  ArrowDown: DIR.DOWN, s: DIR.DOWN, S: DIR.DOWN,
  ArrowLeft: DIR.LEFT, a: DIR.LEFT, A: DIR.LEFT,
  ArrowRight: DIR.RIGHT, d: DIR.RIGHT, D: DIR.RIGHT,
});

class SnakeGame {
  // ---- Canvas ----
  #canvas    = null;
  #ctx       = null;

  // ---- 游戏状态 ----
  #snake         = [];
  #food          = null;
  #foodIcon      = '🍎';
  #direction     = DIR.RIGHT;
  #nextDirection = DIR.RIGHT;
  #score         = 0;
  #gameOver      = false;
  #paused        = false;
  #running       = false;
  #startTime     = 0;
  #particles     = [];
  #difficulty    = 'normal';

  // ---- 主循环 ----
  #rafId     = null;
  #lastTick  = 0;

  // ---- 演示模式 ----
  #demoMode       = false;
  #demoResetTimer = null;

  // ---- 回调 ----
  #onScoreUpdate = null;
  #onGameOver    = null;

  // ---- 键盘只绑定一次 ----
  #keysBound = false;

  // ==============================
  //  Public API
  // ==============================

  init(canvasId, { onScoreUpdate = null, onGameOver = null } = {}) {
    this.#canvas = document.getElementById(canvasId);
    this.#ctx    = this.#canvas.getContext('2d');
    this.#canvas.width  = W;
    this.#canvas.height = H;
    this.#onScoreUpdate = onScoreUpdate;
    this.#onGameOver    = onGameOver;
    this.#bindKeys();
  }

  setDifficulty(diff) {
    this.#difficulty = diff;
  }

  start() {
    this.stopDemo();
    this.#initState(false);
    this.#startTime = Date.now();
    this.#running   = true;
    this.#onScoreUpdate?.(0);
    this.#render();
    this.#scheduleTick();
  }

  pause() {
    if (this.#gameOver) return false;
    this.#paused = !this.#paused;
    return this.#paused;
  }

  stop() {
    this.#running = false;
    this.#cancelTick();
    this.stopDemo();
  }

  startDemo(canvasId) {
    this.#canvas = document.getElementById(canvasId);
    if (!this.#canvas) return;
    this.#ctx = this.#canvas.getContext('2d');
    this.#canvas.width  = W;
    this.#canvas.height = H;
    this.#demoMode = true;
    this.#runDemoCycle();
  }

  stopDemo() {
    this.#demoMode = false;
    this.#cancelTick();
    clearTimeout(this.#demoResetTimer);
    this.#demoResetTimer = null;
  }

  // ==============================
  //  Private — 状态管理
  // ==============================

  #initState(isDemo) {
    const sx = isDemo ? 5 + Math.floor(Math.random() * 15) : 12;
    const sy = isDemo ? 5 + Math.floor(Math.random() * 15) : 12;
    this.#snake         = [{ x: sx, y: sy }, { x: sx - 1, y: sy }, { x: sx - 2, y: sy }];
    this.#direction     = DIR.RIGHT;
    this.#nextDirection = DIR.RIGHT;
    this.#score         = 0;
    this.#gameOver      = false;
    this.#paused        = false;
    this.#particles     = [];
    this.#spawnFood();
  }

  #runDemoCycle() {
    this.#initState(true);
    this.#running = true;
    this.#render();
    this.#scheduleTick();
    this.#demoResetTimer = setTimeout(() => {
      if (!this.#demoMode) return;
      this.#cancelTick();
      this.#runDemoCycle();
    }, 5000);
  }

  // ==============================
  //  Private — 主循环（rAF + 时间戳节流）
  // ==============================

  #scheduleTick() {
    this.#cancelTick();
    this.#lastTick = performance.now();
    const tickMs = this.#demoMode ? 100 : SPEED[this.#difficulty];

    const frame = (now) => {
      if (!this.#running) return;

      if (now - this.#lastTick >= tickMs) {
        if (this.#demoMode) this.#demoAI();
        this.#advanceLogic();
        this.#lastTick = now;
      }

      // 每帧都渲染（粒子动画流畅 60fps）
      if (this.#running) this.#render();

      if (this.#running) {
        this.#rafId = requestAnimationFrame(frame);
      }
    };

    this.#rafId = requestAnimationFrame(frame);
  }

  #cancelTick() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  // ==============================
  //  Private — 游戏逻辑（与渲染解耦）
  // ==============================

  #advanceLogic() {
    if (this.#paused || this.#gameOver) return;
    this.#direction = this.#nextDirection;

    const { x, y } = this.#snake[0];
    const head = { x: x + this.#direction.x, y: y + this.#direction.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      this.#endGame(); return;
    }
    if (this.#snake.some(s => s.x === head.x && s.y === head.y)) {
      this.#endGame(); return;
    }

    this.#snake.unshift(head);
    if (head.x === this.#food.x && head.y === this.#food.y) {
      this.#score += 10;
      this.#spawnParticles(this.#food.x, this.#food.y);
      this.#spawnFood();
      this.#onScoreUpdate?.(this.#score);
    } else {
      this.#snake.pop();
    }
  }

  #endGame() {
    this.#gameOver = true;
    this.#running  = false;
    this.#cancelTick();

    if (this.#demoMode) {
      setTimeout(() => { if (this.#demoMode) this.#runDemoCycle(); }, 300);
      return;
    }

    const duration = Math.round((Date.now() - this.#startTime) / 1000);
    this.#renderGameOver();

    const user = getCurrentUser();
    if (user) saveGameRecord(user, this.#score, duration);
    this.#onGameOver?.(this.#score, duration);
  }

  #spawnFood() {
    const occupied = new Set(this.#snake.map(s => `${s.x},${s.y}`));
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (occupied.has(`${pos.x},${pos.y}`));
    this.#food     = pos;
    this.#foodIcon = FOOD_ICONS[Math.floor(Math.random() * FOOD_ICONS.length)];
  }

  #spawnParticles(gx, gy) {
    const cx = gx * CELL + CELL / 2;
    const cy = gy * CELL + CELL / 2;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.#particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 15,
        color: `hsl(${Math.random() * 60 + 100}, 100%, 60%)`,
      });
    }
  }

  #updateParticles() {
    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p = this.#particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (--p.life <= 0) this.#particles.splice(i, 1);
    }
  }

  // ==============================
  //  Private — 演示 AI
  // ==============================

  #demoAI() {
    const head = this.#snake[0];
    const opp  = { x: -this.#direction.x, y: -this.#direction.y };
    let bestDir   = this.#direction;
    let bestScore = -Infinity;

    for (const d of Object.values(DIR)) {
      if (d.x === opp.x && d.y === opp.y) continue;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (this.#snake.some(s => s.x === nx && s.y === ny)) continue;
      const dist = Math.abs(nx - this.#food.x) + Math.abs(ny - this.#food.y);
      const sc   = 100 - dist + Math.random() * 5;
      if (sc > bestScore) { bestScore = sc; bestDir = d; }
    }
    this.#nextDirection = bestDir;
  }

  // ==============================
  //  Private — 渲染
  // ==============================

  #render() {
    const ctx = this.#ctx;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= W; x += CELL) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 食物光晕
    const fx = this.#food.x * CELL + CELL / 2;
    const fy = this.#food.y * CELL + CELL / 2;
    const gr = CELL * 1.2;
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, gr);
    glow.addColorStop(0, 'rgba(255,215,0,0.45)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fx - gr, fy - gr, gr * 2, gr * 2);

    // 食物 emoji
    ctx.font         = `${CELL - 2}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.#foodIcon, fx, fy + 1);

    // 蛇身
    this.#snake.forEach((seg, i) => {
      const sx    = seg.x * CELL;
      const sy    = seg.y * CELL;
      const ratio = 1 - i / this.#snake.length;
      ctx.fillStyle = `hsl(140, 100%, ${35 + ratio * 30}%)`;
      const pad = i === 0 ? 1 : 2;
      const rad = i === 0 ? 5 : 3;
      this.#roundRect(ctx, sx + pad, sy + pad, CELL - pad * 2, CELL - pad * 2, rad);
      ctx.fill();
      if (i === 0) this.#drawHead(ctx, sx, sy);
    });

    // 粒子（逻辑+渲染合一，每帧更新）
    this.#updateParticles();
    for (const p of this.#particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle   = p.color;
      ctx.globalAlpha = p.life / 15;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #drawHead(ctx, sx, sy) {
    let ex1, ey1, ex2, ey2, tx, ty, ta;

    if (this.#direction === DIR.RIGHT) {
      [ex1, ey1, ex2, ey2] = [sx + 14, sy + 6,  sx + 14, sy + 13];
      [tx, ty, ta] = [sx + CELL, sy + CELL / 2, 0];
    } else if (this.#direction === DIR.LEFT) {
      [ex1, ey1, ex2, ey2] = [sx + 5,  sy + 6,  sx + 5,  sy + 13];
      [tx, ty, ta] = [sx, sy + CELL / 2, Math.PI];
    } else if (this.#direction === DIR.UP) {
      [ex1, ey1, ex2, ey2] = [sx + 6,  sy + 5,  sx + 13, sy + 5];
      [tx, ty, ta] = [sx + CELL / 2, sy, -Math.PI / 2];
    } else {
      [ex1, ey1, ex2, ey2] = [sx + 6,  sy + 14, sx + 13, sy + 14];
      [tx, ty, ta] = [sx + CELL / 2, sy + CELL, Math.PI / 2];
    }

    // 眼睛（循环消除重复）
    for (const [ex, ey] of [[ex1, ey1], [ex2, ey2]]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // 分叉舌头
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(ta);
    ctx.strokeStyle = '#e53030';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    const tl = 8, fl = 4, sp = Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tl, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tl, 0); ctx.lineTo(tl + fl * Math.cos(-sp), fl * Math.sin(-sp)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tl, 0); ctx.lineTo(tl + fl * Math.cos(sp),  fl * Math.sin(sp));  ctx.stroke();
    ctx.restore();
  }

  #renderGameOver() {
    this.#render();
    const ctx = this.#ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3264';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText('游戏结束', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText(`得分：${this.#score}`, W / 2, H / 2 + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('按 空格键 或点击「开始游戏」重新开始', W / 2, H / 2 + 55);
  }

  #roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,         x + r, y);
    ctx.closePath();
  }

  // ==============================
  //  Private — 键盘（只绑定一次）
  // ==============================

  #bindKeys() {
    if (this.#keysBound) return;
    this.#keysBound = true;

    document.addEventListener('keydown', (e) => {
      if (!this.#running && !this.#gameOver) return;

      const next = KEY_DIR[e.key];
      if (next) {
        const opp = { x: -this.#direction.x, y: -this.#direction.y };
        if (!(next.x === opp.x && next.y === opp.y)) {
          this.#nextDirection = next;
          e.preventDefault();
        }
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (this.#gameOver) {
          this.start();
        } else {
          this.pause();
          const btn = document.getElementById('btn-pause');
          if (btn) btn.textContent = this.#paused ? '▶ 继续' : '⏸ 暂停';
        }
      }
    });
  }
}

export default new SnakeGame();
