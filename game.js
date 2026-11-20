/* =========================================================
   BLIND TIMER // SABOTAGE EDITION (Continuous BGM + Share Card)
   ========================================================= */

(function () {
  'use strict';

  function getNowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  // ---------------------------------------------------------
  // 1. Web Audio API 常時ループBGM & 音響妨害シンセサイザー
  // ---------------------------------------------------------
  class AcousticEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.onPulseCallback = null;

      this.bgmRunning = false;
      this.bgmTimerId = null;
      this.bgmStep = 0;
      this.bgmMode = 'title';
    }

    init() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            this.ctx = new AudioCtx();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        if (this.ctx && !this.bgmRunning) {
          this.startBgmLoop();
        }
      } catch (e) {
        this.ctx = null;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (!this.muted) {
        this.init();
      }
      return this.muted;
    }

    setBgmMode(mode) {
      this.bgmMode = mode;
    }

    notifyVisualPulse(isSabotage) {
      if (typeof this.onPulseCallback === 'function') {
        this.onPulseCallback(Boolean(isSabotage));
      }
    }

    startBgmLoop() {
      if (this.bgmRunning) return;
      this.bgmRunning = true;

      const tickBgm = () => {
        if (!this.bgmRunning) return;

        let stepMs = 260;
        if (this.bgmMode === 'playing_visible') stepMs = 240;
        else if (this.bgmMode === 'playing_blind') stepMs = 380;
        else if (this.bgmMode === 'sabotage_fast') stepMs = 135;
        else if (this.bgmMode === 'sabotage_slow') stepMs = 520;
        else if (this.bgmMode === 'result') stepMs = 290;

        if (!this.muted && this.ctx && this.ctx.state === 'running') {
          this.renderBgmStep(this.bgmStep, this.bgmMode);
        }
        this.bgmStep = (this.bgmStep + 1) % 16;
        this.bgmTimerId = setTimeout(tickBgm, stepMs);
      };

      tickBgm();
    }

    renderBgmStep(step, mode) {
      try {
        const now = this.ctx.currentTime;
        const arpNotes = [220.0, 261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
        const bassNotes = [110.0, 110.0, 87.31, 87.31, 98.0, 98.0, 82.41, 110.0];

        if (mode === 'playing_blind') {
          if (step % 4 === 0) {
            const droneFreq = [146.83, 164.81, 130.81, 174.61][(step / 4) % 4];
            this.scheduleRawTone(droneFreq, 'sine', 0.95, 0.055, now);
          }
          return;
        }

        const isSabotageBgm = (mode === 'sabotage_fast' || mode === 'sabotage_slow');
        const detuneMult = mode === 'sabotage_fast'
          ? (step % 2 === 0 ? 1.12 : 0.94)
          : mode === 'sabotage_slow'
            ? 0.78
            : 1.0;

        if (step % 2 === 0) {
          const bFreq = bassNotes[(step / 2) % bassNotes.length] * detuneMult;
          this.scheduleRawTone(bFreq, isSabotageBgm ? 'sawtooth' : 'triangle', 0.18, isSabotageBgm ? 0.095 : 0.065, now);
        }

        const aFreq = arpNotes[step % arpNotes.length] * detuneMult;
        this.scheduleRawTone(aFreq, isSabotageBgm ? 'square' : 'sine', 0.12, isSabotageBgm ? 0.06 : 0.045, now);

        if (isSabotageBgm) {
          this.notifyVisualPulse(true);
        }
      } catch (e) {}
    }

    scheduleRawTone(freq, type, duration, gainVal, startTime) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    }

    playTone(freq, type, duration, gainVal, delay, isSabotage) {
      this.notifyVisualPulse(isSabotage);
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime + (delay || 0);
        this.scheduleRawTone(freq, type || 'sine', duration || 0.1, gainVal || 0.22, now);
      } catch (e) {}
    }

    playSweep(startFreq, endFreq, type, duration, gainVal, isSabotage) {
      this.notifyVisualPulse(isSabotage);
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(gainVal || 0.22, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.03);
      } catch (e) {}
    }

    playNoiseBurst(duration, filterFreq, gainVal, isSabotage) {
      this.notifyVisualPulse(isSabotage);
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx) return;

        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq || 1800;

        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(gainVal || 0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + duration + 0.02);
      } catch (e) {}
    }

    playStart() {
      this.playTone(660, 'triangle', 0.08, 0.22, 0, false);
      this.playTone(990, 'triangle', 0.14, 0.24, 0.055, false);
    }

    playCleanTick() {
      this.playTone(1150, 'sine', 0.045, 0.16, 0, false);
    }

    playBlindEngage() {
      this.playSweep(440, 140, 'sawtooth', 0.22, 0.22, false);
    }

    playStopTrigger() {
      this.playTone(280, 'square', 0.07, 0.22, 0, false);
      this.playTone(140, 'triangle', 0.12, 0.22, 0.025, false);
    }

    playDriftTick(pitchShift) {
      this.playTone(980 * pitchShift, 'triangle', 0.06, 0.22, 0, true);
    }

    playFakeFinishChime() {
      this.playTone(880.0, 'sine', 0.22, 0.3, 0, true);
      this.playTone(698.46, 'sine', 0.45, 0.3, 0.16, true);
    }

    playFakeCountdownBeep(isFinal) {
      if (isFinal) {
        this.playTone(1320, 'square', 0.28, 0.26, 0, true);
      } else {
        this.playTone(660, 'square', 0.08, 0.22, 0, true);
      }
    }

    playHeartbeatThump() {
      this.playSweep(135, 48, 'sine', 0.14, 0.36, true);
      setTimeout(() => {
        this.playSweep(115, 42, 'sine', 0.16, 0.3, true);
      }, 130);
    }

    playSirenAlarm() {
      this.playSweep(520, 1180, 'sawtooth', 0.38, 0.22, true);
      setTimeout(() => {
        this.playSweep(1180, 520, 'sawtooth', 0.38, 0.22, true);
      }, 390);
    }

    playDecoyTrapBuzz() {
      this.playTone(130, 'sawtooth', 0.22, 0.28, 0, true);
      this.playNoiseBurst(0.12, 1200, 0.24, true);
    }

    playWhisperEerie() {
      this.playSweep(240, 175, 'sine', 0.42, 0.2, true);
      this.playNoiseBurst(0.28, 3200, 0.1, true);
    }

    playLuxuryFanfare(tier) {
      if (tier <= 0) {
        this.playTone(277.18, 'sawtooth', 0.2, 0.18, 0, false);
        this.playTone(207.65, 'sawtooth', 0.34, 0.18, 0.16, false);
        return;
      }
      const notes = [587.33, 739.99, 880.0, 1174.66];
      notes.forEach((f, i) => {
        this.playTone(f, 'triangle', 0.24, 0.22, i * 0.075, false);
      });
      if (tier >= 2) {
        [1318.51, 1479.98, 1760.0].forEach((f, i) => {
          this.playTone(f, 'sine', 0.32, 0.2, 0.32 + i * 0.085, false);
        });
      }
      if (tier >= 3) {
        this.playTone(2349.32, 'triangle', 0.65, 0.25, 0.62, false);
      }
    }
  }

  // ---------------------------------------------------------
  // 2. 背景・パーティクルエフェクトエンジン
  // ---------------------------------------------------------
  class VisualFX {
    constructor(bgCanvas, fxCanvas) {
      this.bgCanvas = bgCanvas;
      this.fxCanvas = fxCanvas;
      this.bgCtx = bgCanvas && bgCanvas.getContext ? bgCanvas.getContext('2d') : null;
      this.fxCtx = fxCanvas && fxCanvas.getContext ? fxCanvas.getContext('2d') : null;
      this.width = window.innerWidth || 360;
      this.height = window.innerHeight || 640;
      this.particles = [];
      this.rings = [];

      if (this.bgCtx && this.fxCtx) {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loop();
      }
    }

    resize() {
      this.width = window.innerWidth || 360;
      this.height = window.innerHeight || 640;
      if (this.bgCanvas) {
        this.bgCanvas.width = this.width;
        this.bgCanvas.height = this.height;
      }
      if (this.fxCanvas) {
        this.fxCanvas.width = this.width;
        this.fxCanvas.height = this.height;
      }
    }

    spawnPulseRing(x, y, color) {
      if (!this.fxCtx) return;
      this.rings.push({
        x: x,
        y: y,
        r: 10,
        maxR: Math.max(this.width, this.height) * 0.42,
        alpha: 0.85,
        color: color || '#ccff00'
      });
    }

    spawnConfetti(count, palette) {
      if (!this.fxCtx) return;
      const cols = palette || ['#ccff00', '#ff4d00', '#f5c542', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2.4;
        this.particles.push({
          x: this.width * 0.5,
          y: this.height * 0.42,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          size: Math.random() * 6 + 3.5,
          color: cols[Math.floor(Math.random() * cols.length)],
          alpha: 1,
          gravity: 0.16,
          drag: 0.985,
          rot: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 12,
          shape: Math.random() > 0.35 ? 'rect' : 'circle'
        });
      }
    }

    spawnFireworkBurst(x, y, palette) {
      if (!this.fxCtx) return;
      for (let i = 0; i < 46; i++) {
        const angle = (Math.PI * 2 * i) / 46 + (Math.random() - 0.5) * 0.1;
        const speed = Math.random() * 5.2 + 1.8;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3.8 + 2.2,
          color: palette[Math.floor(Math.random() * palette.length)],
          alpha: 1,
          gravity: 0.08,
          drag: 0.97,
          rot: 0,
          vRot: 0,
          shape: 'circle'
        });
      }
    }

    triggerTierCelebration(tier) {
      if (tier <= 0) return;

      if (tier === 1) {
        this.spawnConfetti(38, ['#d97736', '#f59e0b', '#fed7aa']);
      } else if (tier === 2) {
        this.spawnConfetti(80, ['#e2e8f0', '#94a3b8', '#ccff00', '#ffffff']);
      } else if (tier === 3) {
        this.spawnConfetti(135, ['#f5c542', '#fbbf24', '#fef08a', '#ffffff']);
        setTimeout(() => {
          this.spawnFireworkBurst(this.width * 0.25, this.height * 0.28, ['#f5c542', '#ffffff']);
          this.spawnFireworkBurst(this.width * 0.75, this.height * 0.28, ['#f5c542', '#fbbf24']);
        }, 260);
      } else if (tier >= 4) {
        const prism = ['#ff4d00', '#ccff00', '#f5c542', '#ffffff', '#38bdf8'];
        this.spawnConfetti(190, prism);
        [0, 280, 600, 950].forEach((delay, idx) => {
          setTimeout(() => {
            const rx = this.width * (0.2 + ((idx * 0.23) % 0.65));
            const ry = this.height * (0.22 + ((idx * 0.13) % 0.25));
            this.spawnFireworkBurst(rx, ry, prism);
          }, delay);
        });
      }
    }

    loop() {
      const bctx = this.bgCtx;
      const fctx = this.fxCtx;
      if (!bctx || !fctx) return;

      bctx.clearRect(0, 0, this.width, this.height);
      bctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      const spacing = 28;
      for (let x = 14; x < this.width; x += spacing) {
        for (let y = 14; y < this.height; y += spacing) {
          bctx.fillRect(x, y, 1.2, 1.2);
        }
      }

      fctx.clearRect(0, 0, this.width, this.height);

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const ring = this.rings[i];
        ring.r += (ring.maxR - ring.r) * 0.15;
        ring.alpha *= 0.9;
        fctx.save();
        fctx.beginPath();
        fctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        fctx.strokeStyle = ring.color;
        fctx.globalAlpha = ring.alpha;
        fctx.lineWidth = 3;
        fctx.stroke();
        fctx.restore();

        if (ring.alpha < 0.03) {
          this.rings.splice(i, 1);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        p.alpha -= 0.012;

        fctx.save();
        fctx.translate(p.x, p.y);
        fctx.rotate((p.rot * Math.PI) / 180);
        fctx.globalAlpha = Math.max(0, p.alpha);
        fctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          fctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
        } else {
          fctx.beginPath();
          fctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          fctx.fill();
        }
        fctx.restore();

        if (p.alpha <= 0 || p.y > this.height + 30) {
          this.particles.splice(i, 1);
        }
      }

      requestAnimationFrame(() => this.loop());
    }
  }

  // ---------------------------------------------------------
  // 3. 四則演算問題ジェネレーター
  // ---------------------------------------------------------
  function generateMathChallenge() {
    const ops = ['+', '-', '×', '÷'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let expr = '';
    let answer = 8.0;

    if (op === '+') {
      const a = (Math.floor(Math.random() * 55) + 20) / 10;
      const b = (Math.floor(Math.random() * 55) + 15) / 10;
      answer = Number((a + b).toFixed(2));
      expr = a.toFixed(1) + ' + ' + b.toFixed(1);
    } else if (op === '-') {
      const ans = (Math.floor(Math.random() * 90) + 40) / 10;
      const b = (Math.floor(Math.random() * 60) + 20) / 10;
      const a = Number((ans + b).toFixed(1));
      answer = Number(ans.toFixed(2));
      expr = a.toFixed(1) + ' - ' + b.toFixed(1);
    } else if (op === '×') {
      const multipliers = [2, 3, 4, 5];
      const m = multipliers[Math.floor(Math.random() * multipliers.length)];
      const minBase = Math.ceil((4.0 / m) * 10);
      const maxBase = Math.floor((14.5 / m) * 10);
      const base = (Math.floor(Math.random() * (maxBase - minBase + 1)) + minBase) / 10;
      answer = Number((base * m).toFixed(2));
      expr = base.toFixed(1) + ' × ' + m;
    } else {
      const divisors = [2, 3, 4];
      const d = divisors[Math.floor(Math.random() * divisors.length)];
      const ans = (Math.floor(Math.random() * 75) + 40) / 10;
      const dividend = Number((ans * d).toFixed(1));
      answer = Number(ans.toFixed(2));
      expr = dividend.toFixed(1) + ' ÷ ' + d;
    }

    return { expr: expr, answer: answer };
  }

  // ---------------------------------------------------------
  // 4. リザルト画像生成（スクリーンショットカードPNG）
  // ---------------------------------------------------------
  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = Array.from(text);
    let line = '';
    let curY = y;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        ctx.fillText(line, x, curY);
        line = chars[i];
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  }

  function generateResultScreenshotBlob(resultPayload) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');

      const tierColors = [
        { border: '#52525b', accent: '#ccff00', bgTop: '#16161d' },
        { border: '#d97736', accent: '#f59e0b', bgTop: '#241811' },
        { border: '#cbd5e1', accent: '#e2e8f0', bgTop: '#1d242e' },
        { border: '#f5c542', accent: '#f5c542', bgTop: '#2b210b' },
        { border: '#ff4d00', accent: '#ccff00', bgTop: '#26122c' }
      ];
      const theme = tierColors[Math.min(resultPayload.tier, 4)];

      const grad = ctx.createLinearGradient(0, 0, 0, 1350);
      grad.addColorStop(0, theme.bgTop);
      grad.addColorStop(1, '#070709');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1350);

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let gx = 40; gx < 1040; gx += 40) {
        for (let gy = 40; gy < 1310; gy += 40) {
          ctx.fillRect(gx, gy, 3, 3);
        }
      }

      drawRoundRect(ctx, 56, 56, 968, 1238, 36);
      ctx.fillStyle = 'rgba(17, 17, 22, 0.92)';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = theme.border;
      ctx.stroke();

      ctx.fillStyle = '#ff4d00';
      ctx.fillRect(110, 118, 18, 18);
      ctx.fillStyle = '#fafafa';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('BLIND TIMER // SABOTAGE EDITION', 146, 138);

      ctx.fillStyle = '#9494a0';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(resultPayload.modeTag, 540, 230);

      drawRoundRect(ctx, 320, 260, 440, 58, 12);
      ctx.fillStyle = 'rgba(204, 255, 0, 0.14)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.accent;
      ctx.stroke();
      ctx.fillStyle = theme.accent;
      ctx.font = 'bold 30px monospace';
      ctx.fillText(resultPayload.rank, 540, 299);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 66px sans-serif';
      ctx.fillText(resultPayload.title, 540, 405);

      let offsetY = 455;
      if (resultPayload.isSurvival) {
        drawRoundRect(ctx, 120, offsetY, 840, 130, 20);
        ctx.fillStyle = 'rgba(245, 197, 66, 0.12)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f5c542';
        ctx.stroke();

        ctx.fillStyle = '#f5c542';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('SURVIVAL STREAK', 540, offsetY + 42);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 56px monospace';
        ctx.fillText(resultPayload.streak + ' 連続クリア', 540, offsetY + 104);
        offsetY += 160;
      }

      drawRoundRect(ctx, 120, offsetY, 405, 175, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.fillStyle = '#9494a0';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('目標タイム', 322, offsetY + 55);
      ctx.fillStyle = '#fafafa';
      ctx.font = 'bold 46px monospace';
      ctx.fillText(resultPayload.targetText, 322, offsetY + 125);

      drawRoundRect(ctx, 555, offsetY, 405, 175, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.fillStyle = '#9494a0';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('あなたの記録', 757, offsetY + 55);
      ctx.fillStyle = '#ccff00';
      ctx.font = 'bold 52px monospace';
      ctx.fillText(resultPayload.actualText, 757, offsetY + 125);

      offsetY += 200;

      drawRoundRect(ctx, 120, offsetY, 840, 135, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9494a0';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('誤差（DIFF）', 170, offsetY + 80);

      ctx.textAlign = 'right';
      ctx.fillStyle = resultPayload.absDiff <= 0.05 ? '#f5c542' : resultPayload.absDiff <= 0.35 ? '#ccff00' : '#ff1e56';
      ctx.font = '900 64px monospace';
      ctx.fillText(resultPayload.diffText, 910, offsetY + 90);

      offsetY += 165;

      drawRoundRect(ctx, 120, offsetY, 840, 115, 18);
      ctx.fillStyle = 'rgba(255, 77, 0, 0.14)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9466';
      ctx.font = 'bold 26px sans-serif';
      wrapCanvasText(ctx, '受けた妨害：' + resultPayload.gimmickText, 540, offsetY + 50, 790, 36);

      offsetY += 155;

      ctx.fillStyle = '#d4d4d8';
      ctx.font = '28px sans-serif';
      wrapCanvasText(ctx, resultPayload.comment, 540, offsetY, 820, 42);

      ctx.fillStyle = '#71717a';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('#BlindTimer  #狂気の体内時計', 540, 1245);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  // ---------------------------------------------------------
  // 5. メインゲームコントローラー
  // ---------------------------------------------------------
  const sound = new AcousticEngine();
  const fx = new VisualFX(
    document.getElementById('bg-canvas'),
    document.getElementById('fx-canvas')
  );

  const RING_CIRCUMFERENCE = 2 * Math.PI * 114;

  function getSavedBestStreak() {
    try {
      return Number(window.localStorage.getItem('blindTimerBestStreak') || 0);
    } catch (e) {
      return 0;
    }
  }

  function saveBestStreak(val) {
    try {
      window.localStorage.setItem('blindTimerBestStreak', String(val));
    } catch (e) {}
  }

  const state = {
    mode: 'quick',
    phase: 'title',
    targetTime: 8.0,
    targetLabelText: '8.00s',
    isMathMode: false,
    startTimePerf: 0,
    readyAtPerf: 0,
    resultShownAtPerf: 0,
    elapsed: 0,
    isBlind: false,
    rafId: null,
    survivalStage: 1,
    survivalStreak: 0,
    survivalTolerance: 0.6,
    survivalClearedLastRound: false,
    bestStreak: getSavedBestStreak(),
    activeGimmicks: [],
    gimmickTriggered: false,
    gimmickTimers: [],
    lastBeatCount: 0,
    lastActionTimestamp: 0,
    lastResultPayload: null
  };

  const dom = {
    appShell: document.getElementById('app-shell'),
    glitchOverlay: document.getElementById('glitch-overlay'),
    screens: {
      title: document.getElementById('screen-title'),
      game: document.getElementById('screen-game'),
      result: document.getElementById('screen-result')
    },
    btnSound: document.getElementById('btn-sound'),
    soundLabel: document.getElementById('sound-label'),
    btnHome: document.getElementById('btn-home'),
    bestStreak: document.getElementById('best-streak'),
    survivalHud: document.getElementById('survival-hud'),
    hudStage: document.getElementById('hud-stage'),
    hudTolerance: document.getElementById('hud-tolerance'),
    hudStreak: document.getElementById('hud-streak'),
    targetLabel: document.getElementById('target-label'),
    targetDisplay: document.getElementById('target-display'),
    targetHint: document.getElementById('target-hint'),
    timerStage: document.getElementById('timer-stage'),
    ringBar: document.getElementById('ring-bar'),
    timerStatus: document.getElementById('timer-status'),
    timerDigits: document.getElementById('timer-digits'),
    eqBars: document.querySelectorAll('.eq-bar'),
    triggerDeck: document.getElementById('trigger-deck'),
    btnAction: document.getElementById('btn-action'),
    btnMainText: document.getElementById('btn-main-text'),
    btnSubText: document.getElementById('btn-sub-text'),
    fakeNotif: document.getElementById('fake-notification'),
    notifCode: document.getElementById('notif-code'),
    notifApp: document.getElementById('notif-app'),
    notifText: document.getElementById('notif-text'),
    devilWhisper: document.getElementById('devil-whisper'),
    resultCard: document.getElementById('result-card'),
    resModeTag: document.getElementById('res-mode-tag'),
    resRankBadge: document.getElementById('res-rank-badge'),
    resTitle: document.getElementById('res-title'),
    resSurvivalBox: document.getElementById('res-survival-box'),
    resStreakCount: document.getElementById('res-streak-count'),
    resTierName: document.getElementById('res-tier-name'),
    resTarget: document.getElementById('res-target'),
    resActual: document.getElementById('res-actual'),
    resDiff: document.getElementById('res-diff'),
    resGimmickName: document.getElementById('res-gimmick-name'),
    resComment: document.getElementById('res-comment'),
    btnRetry: document.getElementById('btn-retry'),
    btnLineShare: document.getElementById('btn-line-share'),
    btnSaveImg: document.getElementById('btn-save-img'),
    copyToast: document.getElementById('copy-toast')
  };

  dom.bestStreak.textContent = String(state.bestStreak);

  sound.onPulseCallback = function (isSabotage) {
    dom.eqBars.forEach((bar) => {
      const h = Math.floor(Math.random() * 14) + 5;
      bar.style.height = h + 'px';
      bar.classList.toggle('active', !isSabotage);
      bar.classList.toggle('sabotage', isSabotage);
    });
    setTimeout(() => {
      dom.eqBars.forEach((bar) => {
        bar.style.height = '4px';
        bar.classList.remove('active', 'sabotage');
      });
    }, 110);
  };

  function showScreen(name) {
    Object.keys(dom.screens).forEach((key) => {
      const el = dom.screens[key];
      if (!el) return;
      if (key === name) {
        el.classList.add('active');
        el.style.display = 'flex';
      } else {
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
    window.scrollTo(0, 0);
    dom.btnHome.classList.toggle('hidden', name === 'title');
  }

  function clearGimmicks() {
    state.gimmickTimers.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    state.gimmickTimers = [];
    dom.fakeNotif.classList.add('hidden');
    dom.devilWhisper.classList.add('hidden');
    dom.glitchOverlay.classList.add('hidden');
    dom.appShell.classList.remove('is-flipped');
    dom.timerStage.classList.remove('is-fake');
    dom.btnAction.style.transform = '';
    dom.btnAction.style.order = '';

    dom.triggerDeck.classList.remove('has-decoys');
    dom.triggerDeck.querySelectorAll('.decoy-btn').forEach((el) => el.remove());
  }

  function rollSabotageGimmicks(mode, stage) {
    const sabotagePool = [
      { id: 'bgm_hyper', name: 'BGM暴走：超高速トランスBPM' },
      { id: 'bgm_slowmo', name: 'BGM暴走：超スロー泥沼テンポ' },
      { id: 'tempo_drift', name: '音響妨害：加速・減速メトロノーム' },
      { id: 'fake_finish_chime', name: '音響妨害：偽タイムアップ完了音' },
      { id: 'siren_alarm', name: '音響妨害：緊急警報サイレン＆エラー通知' },
      { id: 'heartbeat_panic', name: '音響妨害：緊迫心拍＆モスキート高周波' },
      { id: 'decoy_buttons', name: '操作妨害：偽STOPボタン増殖トラップ' },
      { id: 'moving_button', name: '操作妨害：逃げ回るSTOPスイッチ' },
      { id: 'screen_flip_glitch', name: '視覚妨害：画面上下反転＆グリッチノイズ' },
      { id: 'fake_countdown', name: '視覚妨害：嘘カウントダウン＆高速ビープ' }
    ];

    if (Math.random() < 0.05) {
      return [];
    }

    const shuffled = sabotagePool.slice().sort(() => Math.random() - 0.5);
    const count = (mode === 'survival' && stage >= 3)
      ? (Math.random() < 0.5 ? 3 : 2)
      : (Math.random() < 0.72 ? 2 : 1);

    const picked = [];
    for (let i = 0; i < shuffled.length && picked.length < count; i++) {
      const item = shuffled[i];
      if (item.id === 'bgm_slowmo' && picked.some((p) => p.id === 'bgm_hyper')) continue;
      if (item.id === 'bgm_hyper' && picked.some((p) => p.id === 'bgm_slowmo')) continue;
      picked.push(item);
    }
    return picked;
  }

  function prepareRound(mode, resetSurvival) {
    state.mode = mode;
    state.phase = 'ready';
    state.readyAtPerf = getNowMs();
    state.isBlind = false;
    state.elapsed = 0;
    state.lastBeatCount = 0;
    state.gimmickTriggered = false;
    state.survivalClearedLastRound = false;
    clearGimmicks();
    sound.setBgmMode('title');

    if (mode === 'survival') {
      if (resetSurvival) {
        state.survivalStage = 1;
        state.survivalStreak = 0;
      }
      const stage = state.survivalStage;
      const minT = Math.min(4.5 + (stage - 1) * 0.65, 9.5);
      const maxT = Math.min(8.5 + (stage - 1) * 1.05, 16.0);
      state.targetTime = Number((Math.random() * (maxT - minT) + minT).toFixed(2));
      state.survivalTolerance = Number(Math.max(0.15, 0.65 - stage * 0.07).toFixed(2));

      dom.survivalHud.classList.remove('hidden');
      dom.hudStage.textContent = String(state.survivalStage);
      dom.hudTolerance.textContent = '±' + state.survivalTolerance.toFixed(2) + 's';
      dom.hudStreak.textContent = String(state.survivalStreak);
    } else {
      dom.survivalHud.classList.add('hidden');
    }

    if (mode === 'math') {
      const mathObj = generateMathChallenge();
      state.targetTime = mathObj.answer;
      state.targetLabelText = mathObj.expr + ' = ' + mathObj.answer.toFixed(2) + 's';
      state.isMathMode = true;

      dom.targetLabel.textContent = 'MATH PANIC // STARTで式が出現';
      dom.targetDisplay.textContent = '?? ? ??';
      dom.targetDisplay.classList.add('is-math');
      dom.targetHint.textContent = '暗算しながら複合トラップを突破して止めろ';
      dom.targetDisplay.dataset.pendingExpr = mathObj.expr;
    } else {
      state.isMathMode = false;
      if (mode === 'quick') {
        if (Math.random() < 0.2) {
          const zorome = [4.44, 5.55, 6.66, 7.77, 8.88, 9.99, 11.11, 12.34];
          state.targetTime = zorome[Math.floor(Math.random() * zorome.length)];
        } else {
          state.targetTime = Number((Math.random() * 11.0 + 4.0).toFixed(2));
        }
      }
      state.targetLabelText = state.targetTime.toFixed(2) + 's';

      dom.targetLabel.textContent = 'TARGET TIME';
      dom.targetDisplay.innerHTML = state.targetTime.toFixed(2) + '<span class="unit">s</span>';
      dom.targetDisplay.classList.remove('is-math');
      dom.targetHint.textContent = '3.00秒後に数字消失。音・BGM・視覚・操作の全妨害に耐えろ';
    }

    state.activeGimmicks = rollSabotageGimmicks(mode, state.survivalStage);

    dom.timerStage.classList.remove('is-blind', 'is-fake');
    dom.timerStatus.textContent = 'SYS.READY';
    dom.timerDigits.textContent = '0.00';
    dom.ringBar.style.strokeDashoffset = '0';

    dom.btnAction.className = 'hardware-trigger state-ready';
    dom.btnMainText.textContent = 'START';
    dom.btnSubText.textContent = 'TAP / CLICK / SPACE';

    showScreen('game');
  }

  function startTimer() {
    if (state.phase !== 'ready') return;
    sound.init();
    sound.playStart();
    sound.setBgmMode('playing_visible');

    state.phase = 'running';
    state.startTimePerf = getNowMs();
    state.lastBeatCount = 0;

    if (state.isMathMode) {
      const expr = dom.targetDisplay.dataset.pendingExpr;
      dom.targetLabel.textContent = 'SOLVE & STOP!';
      dom.targetDisplay.textContent = expr;
      dom.targetHint.textContent = '答えの秒数になった瞬間に本物の STOP! を押せ';
    }

    dom.timerStatus.textContent = 'COUNTING';
    dom.btnAction.className = 'hardware-trigger state-running';
    dom.btnMainText.textContent = 'STOP!';
    dom.btnSubText.textContent = '目標タイムだと思ったら押せ';

    const rect = dom.btnAction.getBoundingClientRect();
    fx.spawnPulseRing(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ccff00');

    state.rafId = requestAnimationFrame(updateLoop);
  }

  function spawnDecoyStopButtons() {
    dom.triggerDeck.classList.add('has-decoys');
    dom.btnSubText.textContent = '本物を見極めろ！';

    const realOrder = Math.floor(Math.random() * 4);
    dom.btnAction.style.order = String(realOrder);

    const fakeLabels = [
      { main: 'ST0P!', sub: '※トラップ注意' },
      { main: 'STOP?', sub: '押すと時間ロス' },
      { main: 'STOP!', sub: 'ダミーボタン' }
    ];

    for (let i = 0; i < 3; i++) {
      const decoy = document.createElement('button');
      decoy.type = 'button';
      decoy.className = 'decoy-btn';
      decoy.style.order = String(i >= realOrder ? i + 1 : i);
      const lbl = fakeLabels[i % fakeLabels.length];
      decoy.innerHTML =
        '<span class="trigger-label-main">' + lbl.main + '</span>' +
        '<span class="trigger-label-sub">' + lbl.sub + '</span>';

      const handleDecoyHit = (e) => {
        if (e && e.cancelable) e.preventDefault();
        sound.playDecoyTrapBuzz();
        decoy.classList.add('is-busted');
        decoy.innerHTML =
          '<span class="trigger-label-main">FAKE!</span>' +
          '<span class="trigger-label-sub">本物を押せ！</span>';
      };

      if (window.PointerEvent) {
        decoy.addEventListener('pointerdown', handleDecoyHit);
      } else {
        decoy.addEventListener('mousedown', handleDecoyHit);
        decoy.addEventListener('touchstart', handleDecoyHit, { passive: false });
      }
      dom.triggerDeck.appendChild(decoy);
    }
  }

  function triggerGimmicksNow() {
    if (state.activeGimmicks.length === 0 || state.gimmickTriggered || state.phase !== 'running') return;
    state.gimmickTriggered = true;

    state.activeGimmicks.forEach((g) => {
      if (g.id === 'bgm_hyper') {
        sound.setBgmMode('sabotage_fast');
      } else if (g.id === 'bgm_slowmo') {
        sound.setBgmMode('sabotage_slow');
      } else if (g.id === 'tempo_drift') {
        const accelerate = Math.random() > 0.45;
        let intervalMs = accelerate ? 720 : 1250;
        let stepCount = 0;
        const scheduleNext = () => {
          if (state.phase !== 'running') return;
          const pitch = accelerate ? 1 + stepCount * 0.065 : Math.max(0.6, 1 - stepCount * 0.05);
          sound.playDriftTick(pitch);
          stepCount++;
          intervalMs = accelerate
            ? Math.max(290, intervalMs * 0.87)
            : Math.min(1800, intervalMs * 1.13);
          const tid = setTimeout(scheduleNext, intervalMs);
          state.gimmickTimers.push(tid);
        };
        scheduleNext();
      } else if (g.id === 'fake_finish_chime') {
        sound.playFakeFinishChime();
      } else if (g.id === 'siren_alarm') {
        sound.playSirenAlarm();
        dom.notifCode.textContent = 'ERR';
        dom.notifApp.textContent = 'SYSTEM.ALERT';
        dom.notifText.textContent = '緊急警告：タイマーが異常終了しました';
        dom.fakeNotif.classList.remove('hidden');
        const hideId = setTimeout(() => {
          dom.fakeNotif.classList.add('hidden');
        }, 3200);
        state.gimmickTimers.push(hideId);
      } else if (g.id === 'heartbeat_panic') {
        sound.playSweep(300, 1550, 'sine', 2.6, 0.16, true);
        let beatInterval = 540;
        const beatLoop = () => {
          if (state.phase !== 'running') return;
          sound.playHeartbeatThump();
          beatInterval = Math.max(280, beatInterval * 0.89);
          const tid = setTimeout(beatLoop, beatInterval);
          state.gimmickTimers.push(tid);
        };
        beatLoop();
      } else if (g.id === 'decoy_buttons') {
        sound.playDecoyTrapBuzz();
        spawnDecoyStopButtons();
      } else if (g.id === 'screen_flip_glitch') {
        sound.playWhisperEerie();
        dom.appShell.classList.add('is-flipped');
        dom.glitchOverlay.classList.remove('hidden');
      } else if (g.id === 'fake_countdown') {
        dom.timerStage.classList.add('is-fake');
        let fakeVal = Math.max(2.5, state.targetTime - 0.7);
        let beepStep = 0;
        const fakeTimer = setInterval(() => {
          if (state.phase !== 'running') {
            clearInterval(fakeTimer);
            return;
          }
          fakeVal += 0.08;
          dom.timerDigits.textContent = fakeVal.toFixed(2);
          if (beepStep % 3 === 0) {
            sound.playFakeCountdownBeep(fakeVal >= state.targetTime);
          }
          beepStep++;
          if (fakeVal >= state.targetTime + 0.2) {
            clearInterval(fakeTimer);
            dom.timerStage.classList.remove('is-fake');
            dom.timerDigits.textContent = '??.??';
          }
        }, 42);
        state.gimmickTimers.push(fakeTimer);
      }
    });
  }

  function updateLoop() {
    if (state.phase !== 'running') return;

    const now = getNowMs();
    state.elapsed = (now - state.startTimePerf) / 1000;

    if (state.elapsed <= 3.05) {
      const secFloor = Math.floor(state.elapsed);
      if (secFloor > state.lastBeatCount && secFloor <= 3) {
        state.lastBeatCount = secFloor;
        sound.playCleanTick();
      }
    }

    if (state.elapsed >= 3.0 && !state.isBlind) {
      state.isBlind = true;
      sound.playBlindEngage();
      sound.setBgmMode('playing_blind');
      dom.timerStage.classList.add('is-blind');
      dom.timerStatus.textContent = 'BLIND.ACTIVE';
      dom.timerDigits.textContent = '??.??';
      dom.ringBar.style.strokeDashoffset = '0';
    }

    if (!state.isBlind) {
      dom.timerDigits.textContent = state.elapsed.toFixed(2);
      const ratio = Math.min(state.elapsed / 3.0, 1);
      dom.ringBar.style.strokeDashoffset = String(RING_CIRCUMFERENCE * ratio);
    } else {
      const triggerPoint = state.targetTime <= 5.0
        ? 3.05
        : Math.max(3.15, state.targetTime * 0.56);

      if (state.elapsed >= triggerPoint && !state.gimmickTriggered) {
        triggerGimmicksNow();
      }

      const hasMovingBtn = state.activeGimmicks.some((g) => g.id === 'moving_button');
      if (hasMovingBtn && state.gimmickTriggered) {
        const t = (state.elapsed - triggerPoint) * 4.5;
        const offsetX = Math.sin(t) * 58;
        const offsetY = Math.cos(t * 1.7) * 15;
        dom.btnAction.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px)';
      }
    }

    if (state.elapsed >= state.targetTime + 15) {
      stopTimer();
      return;
    }

    state.rafId = requestAnimationFrame(updateLoop);
  }

  function stopTimer() {
    if (state.phase !== 'running') return;

    const stopPerf = getNowMs();
    state.elapsed = Number(((stopPerf - state.startTimePerf) / 1000).toFixed(2));
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    clearGimmicks();
    sound.playStopTrigger();
    sound.setBgmMode('result');

    const rect = dom.btnAction.getBoundingClientRect();
    fx.spawnPulseRing(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ff4d00');

    const diff = Number((state.elapsed - state.targetTime).toFixed(2));
    const absDiff = Math.abs(diff);

    let isSurvivalStageCleared = false;
    if (state.mode === 'survival' && absDiff <= state.survivalTolerance) {
      isSurvivalStageCleared = true;
      state.survivalStreak += 1;
      if (state.survivalStreak > state.bestStreak) {
        state.bestStreak = state.survivalStreak;
        saveBestStreak(state.bestStreak);
        dom.bestStreak.textContent = String(state.bestStreak);
      }
    }

    state.survivalClearedLastRound = isSurvivalStageCleared;
    renderResult(diff, absDiff, isSurvivalStageCleared);
  }

  function renderResult(diff, absDiff, isSurvivalStageCleared) {
    state.phase = 'result';
    state.resultShownAtPerf = getNowMs();

    let rank = 'RANK C';
    let title = '時間迷子の旅人';
    let comment = '音と視覚のトラップに惑わされず、自分のリズムを刻もう。';
    let celebrationTier = 0;

    if (absDiff === 0) {
      rank = 'GODLIKE // DIFF 0.00s';
      title = '人間原子時計';
      comment = '誤差 0.00秒の完全一致！あなたの脳内にはセシウム原子発振器が搭載されています。';
      celebrationTier = 4;
    } else if (absDiff <= 0.05) {
      rank = 'RANK SSS';
      title = '精密クロノメーター職人';
      comment = '驚異的な時間精度！複合妨害を完全に遮断する鋼の集中力です。';
      celebrationTier = 3;
    } else if (absDiff <= 0.15) {
      rank = 'RANK S';
      title = '高精度タイムキーパー';
      comment = '非常に高い精度！あとコンマ数秒で神の領域でした。';
      celebrationTier = 2;
    } else if (absDiff <= 0.35) {
      rank = 'RANK A';
      title = '優秀な体内時計';
      comment = '安定したリズム感！トラップを受けながらもよく食らいつきました。';
      celebrationTier = 1;
    } else if (diff < -1.5) {
      rank = 'RANK D';
      title = 'せっかちすぎるチーター';
      comment = '焦りすぎ！心の中の1秒が0.6秒くらいに加速しています。';
      celebrationTier = 0;
    } else if (diff > 1.5) {
      rank = 'RANK D';
      title = '時空を超えた浦島太郎';
      comment = 'のんびりしすぎ！気づいたら目標タイムをはるかにオーバーしています。';
      celebrationTier = 0;
    } else if (state.activeGimmicks.length > 0 && state.gimmickTriggered) {
      rank = 'RANK B';
      title = 'トラップに素直な好人物';
      comment = '「' + state.activeGimmicks[0].name + '」に見事翻弄されました。';
      celebrationTier = 0;
    }

    let survivalTierLabel = '';
    if (state.mode === 'survival') {
      const s = state.survivalStreak;
      dom.resSurvivalBox.classList.remove('hidden');
      dom.resStreakCount.textContent = String(s);

      if (s >= 8) {
        celebrationTier = 4;
        survivalTierLabel = 'TIER 5 // PRISM HOLOGRAPHIC（神域達成）';
      } else if (s >= 5) {
        celebrationTier = 3;
        survivalTierLabel = 'TIER 4 // 24K CHRONO GOLD（王者の輝き）';
      } else if (s >= 3) {
        celebrationTier = 2;
        survivalTierLabel = 'TIER 3 // BRUSHED TITANIUM';
      } else if (s >= 1) {
        celebrationTier = 1;
        survivalTierLabel = 'TIER 2 // ANODIZED BRONZE';
      } else {
        celebrationTier = 0;
        survivalTierLabel = 'TIER 1 // MATTE CARBON';
      }
      dom.resTierName.textContent = survivalTierLabel;

      if (isSurvivalStageCleared) {
        rank = 'STAGE ' + state.survivalStage + ' CLEAR!';
        dom.resRankBadge.classList.add('is-cleared');
        comment = '許容誤差 ±' + state.survivalTolerance.toFixed(2) + 's 以内で突破！次のステージはさらに許容誤差が狭まります。';
        dom.btnRetry.textContent = 'NEXT STAGE (' + (state.survivalStage + 1) + ') へ進む ▶';
        dom.btnRetry.classList.add('is-next-stage');
      } else {
        rank = 'SURVIVAL OVER // STAGE ' + state.survivalStage;
        dom.resRankBadge.classList.remove('is-cleared');
        title = s >= 5 ? '黄金の時計仕掛け' : s >= 3 ? '熟練のタイムキーパー' : s >= 1 ? '見習いクロノメーター' : '出直しの刻';
        comment = '許容誤差 ±' + state.survivalTolerance.toFixed(2) + 's をオーバー！最終記録：' + s + '連続クリア。';
        dom.btnRetry.textContent = '最初からリトライ ↻';
        dom.btnRetry.classList.remove('is-next-stage');
      }
    } else {
      dom.resSurvivalBox.classList.add('hidden');
      dom.resRankBadge.classList.remove('is-cleared');
      dom.btnRetry.textContent = 'もう一度プレイ ↻';
      dom.btnRetry.classList.remove('is-next-stage');
    }

    dom.resultCard.className = 'result-sheet tier-' + celebrationTier;

    const modeNames = {
      quick: 'QUICK RANDOM',
      math: 'MATH PANIC // 四則演算',
      survival: 'LIMIT SURVIVAL'
    };
    const modeTagText = modeNames[state.mode] || 'BLIND TIMER';
    dom.resModeTag.textContent = modeTagText;
    dom.resRankBadge.textContent = rank;
    dom.resTitle.textContent = title;

    const targetText = state.isMathMode
      ? state.targetLabelText
      : state.targetTime.toFixed(2) + 's';
    const actualText = state.elapsed.toFixed(2) + 's';
    const sign = diff > 0 ? '+' : '';
    const diffText = sign + diff.toFixed(2) + 's';

    dom.resTarget.textContent = targetText;
    dom.resActual.textContent = actualText;
    dom.resDiff.textContent = diffText;
    dom.resDiff.className = 'metric-diff ' + (absDiff <= 0.05 ? 'perfect' : absDiff <= 0.35 ? 'good' : 'bad');

    const gimmickText = (state.activeGimmicks.length > 0 && state.gimmickTriggered)
      ? state.activeGimmicks.map((g) => g.name).join(' ＋ ')
      : 'なし（ガチンコ勝負）';
    dom.resGimmickName.textContent = gimmickText;

    dom.resComment.textContent = comment;
    dom.copyToast.classList.add('hidden');
    dom.copyToast.innerHTML = '';

    state.lastResultPayload = {
      tier: celebrationTier,
      modeTag: modeTagText,
      rank: rank,
      title: title,
      isSurvival: state.mode === 'survival',
      streak: state.survivalStreak,
      targetText: targetText,
      actualText: actualText,
      diffText: diffText,
      absDiff: absDiff,
      gimmickText: gimmickText,
      comment: comment
    };

    showScreen('result');

    sound.playLuxuryFanfare(celebrationTier);
    if (celebrationTier > 0) {
      fx.triggerTierCelebration(celebrationTier);
    } else {
      dom.resultCard.classList.add('shake-hard');
      setTimeout(() => dom.resultCard.classList.remove('shake-hard'), 380);
    }
  }

  // ---------------------------------------------------------
  // 6. スクリーンショット共有（LINE / OS共有 / 画像ダウンロード）
  // ---------------------------------------------------------
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function shareResultScreenshot(preferLine) {
    if (!state.lastResultPayload) return;

    const p = state.lastResultPayload;
    const shareText =
      '⏱️ BLIND TIMER' + (p.isSurvival ? ' [SURVIVAL ' + p.streak + '連続クリア]' : '') + '\n' +
      '目標: ' + p.targetText + ' → 記録: ' + p.actualText + ' (誤差 ' + p.diffText + ')\n' +
      '称号:【' + p.title + '】\n' +
      '#BlindTimer';

    const blob = await generateResultScreenshotBlob(p);
    if (!blob) return;

    const file = new File([blob], 'blind-timer-result.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'BLIND TIMER 結果',
          text: shareText
        });
        dom.copyToast.textContent = '結果画像をシェアしました！';
        dom.copyToast.classList.remove('hidden');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    downloadBlob(blob, 'blind-timer-result.png');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch (e) {}

    const lineShareUrl = 'https://line.me/R/share?text=' + encodeURIComponent(shareText);
    dom.copyToast.innerHTML =
      '結果スクリーンショット（PNG）を保存しました！<br>' +
      (preferLine
        ? '<a class="line-web-fallback" href="' + lineShareUrl + '" target="_blank" rel="noopener noreferrer">LINEを開いてテキスト・画像を送信 ▶</a>'
        : '保存した画像をLINEやSNSに添付して共有できます。');
    dom.copyToast.classList.remove('hidden');
  }

  // ---------------------------------------------------------
  // 7. 入力イベント処理
  // ---------------------------------------------------------
  function handlePrimaryAction(e) {
    if (e && e.cancelable) {
      e.preventDefault();
    }
    const now = getNowMs();

    if (now - state.lastActionTimestamp < 350) {
      return;
    }

    if (state.phase === 'ready') {
      if (now - state.readyAtPerf < 250) {
        return;
      }
      state.lastActionTimestamp = now;
      startTimer();
    } else if (state.phase === 'running') {
      if (now - state.startTimePerf < 450) {
        return;
      }
      state.lastActionTimestamp = now;
      stopTimer();
    }
  }

  document.querySelectorAll('.mode-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.init();
      const mode = btn.getAttribute('data-mode') || 'quick';
      prepareRound(mode, true);
    });
  });

  if (window.PointerEvent) {
    dom.btnAction.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      handlePrimaryAction(e);
    });
  } else {
    dom.btnAction.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      handlePrimaryAction(e);
    });
    dom.btnAction.addEventListener('touchstart', handlePrimaryAction, { passive: false });
  }

  dom.btnAction.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.key === 'Enter') {
      e.preventDefault();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.key === ' ') {
      if (state.phase === 'ready' || state.phase === 'running') {
        handlePrimaryAction(e);
      }
    }
  });

  dom.btnRetry.addEventListener('click', () => {
    if (getNowMs() - state.resultShownAtPerf < 500) return;

    if (state.mode === 'survival' && state.survivalClearedLastRound) {
      state.survivalStage += 1;
      prepareRound('survival', false);
    } else {
      prepareRound(state.mode, true);
    }
  });

  dom.btnLineShare.addEventListener('click', () => {
    shareResultScreenshot(true);
  });

  dom.btnSaveImg.addEventListener('click', () => {
    shareResultScreenshot(false);
  });

  dom.btnHome.addEventListener('click', () => {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    clearGimmicks();
    state.phase = 'title';
    sound.setBgmMode('title');
    showScreen('title');
  });

  dom.btnSound.addEventListener('click', () => {
    const muted = sound.toggleMute();
    dom.btnSound.classList.toggle('is-muted', muted);
    dom.soundLabel.textContent = muted ? 'AUDIO OFF' : 'AUDIO ON';
    if (!muted) {
      sound.init();
      sound.playCleanTick();
    }
  });

  showScreen('title');
})();
