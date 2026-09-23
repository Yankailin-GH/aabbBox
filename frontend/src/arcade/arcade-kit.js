(function (global) {
  "use strict";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const formatTime = (seconds) => {
    const minute = Math.floor(seconds / 60);
    const second = Math.floor(seconds % 60);
    return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  };

  function mount(config) {
    const host = document.getElementById("app");
    const colors = config.colors || {};
    Object.entries({
      "--game-bg": colors.bg,
      "--game-surface": colors.surface,
      "--game-surface-2": colors.surface2,
      "--game-ink": colors.ink,
      "--game-muted": colors.muted,
      "--game-accent": colors.accent,
      "--game-accent-2": colors.accent2,
    }).forEach(([name, value]) => value && document.documentElement.style.setProperty(name, value));

    const choices = config.choices || [];
    host.innerHTML = `
      <main class="arcade" id="arcade" aria-label="${config.title}手机单机游戏">
        <canvas id="field" aria-label="${config.title}游戏战场"></canvas>
        <header class="game-hud" aria-label="战斗状态">
          <button id="pause" class="hud-button" type="button" aria-label="暂停游戏"><i class="pause-mark" aria-hidden="true"></i></button>
          <div class="readout">
            <span><b id="metric">0</b><small id="metric-label">${config.metricLabel || "进度"}</small></span>
            <span><b id="timer">00:00</b><small>时间</small></span>
            <span><b id="score">0</b><small id="score-label">${config.scoreLabel || "得分"}</small></span>
          </div>
          <button id="sound" class="hud-button" type="button" aria-label="关闭音效"><i id="sound-mark" class="sound-mark" aria-hidden="true"></i></button>
          <div class="vital" aria-label="状态"><i id="vital"></i></div>
        </header>
        <p id="objective" class="objective">${config.objective}</p>
        <button id="action" class="game-action" type="button">${config.actionLabel}</button>
        <div id="flash" class="flash" aria-hidden="true"></div>
        <section id="start" class="overlay show">
          <div class="start-panel">
            <div class="game-seal" aria-hidden="true">${config.seal}</div>
            <h1>${config.title}</h1>
            <p class="game-kicker">${config.kicker}</p>
            <div class="game-mission"><span>任务</span><b>${config.mission}</b><span>时限</span><b>${config.limit}</b></div>
            <p class="choice-label">${config.choiceLabel}</p>
            <div class="loadout-grid" role="group" aria-label="${config.choiceLabel}">
              ${choices.map((choice, index) => `<button class="loadout${index === 0 ? " selected" : ""}" type="button" data-choice="${choice.id}" aria-pressed="${index === 0}"><b aria-hidden="true">${choice.icon}</b><strong>${choice.name}</strong><small>${choice.detail}</small></button>`).join("")}
            </div>
            <button id="start-button" class="primary" type="button">${config.startLabel}</button>
          </div>
        </section>
        <section id="paused" class="overlay" aria-hidden="true" inert>
          <div class="pause-panel"><h2>行动暂停</h2><p>战场状态已冻结。</p><button id="resume" class="primary" type="button">继续</button><button id="restart-paused" class="secondary" type="button">重新开始</button></div>
        </section>
        <section id="result" class="overlay" aria-hidden="true" inert>
          <div class="result-panel"><h1 id="result-title">任务结束</h1><p id="result-sub" class="result-sub"></p><div id="result-stats" class="result-stats"></div><button id="retry" class="primary" type="button">再来一局</button><button id="back-start" class="secondary" type="button">返回配置</button></div>
        </section>
      </main>`;

    const root = document.getElementById("arcade");
    const canvas = document.getElementById("field");
    const ctx = canvas.getContext("2d");
    const elements = Object.fromEntries(["metric", "metric-label", "timer", "score", "score-label", "vital", "objective", "action", "flash", "start", "paused", "result", "result-title", "result-sub", "result-stats", "sound-mark"].map((id) => [id, document.getElementById(id)]));
    let width = 0;
    let height = 0;
    let dpr = 1;
    let mode = "start";
    let elapsed = 0;
    let last = 0;
    let raf = 0;
    let selectedChoice = choices[0] ? choices[0].id : "default";
    let audioOn = true;
    let pointerId = null;
    let audioContext = null;
    let voices = 0;

    function toggle(id, show) {
      const element = elements[id];
      element.classList.toggle("show", show);
      element.setAttribute("aria-hidden", String(!show));
      element.inert = !show;
    }

    function unlockAudio() {
      if (!audioOn) return null;
      try {
        const AudioCtor = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtor) return null;
        audioContext ||= new AudioCtor();
        if (audioContext.state === "suspended") audioContext.resume();
        return audioContext;
      } catch (error) {
        return null;
      }
    }

    function tone(frequency, duration = 0.08, type = "sine", volume = 0.02, endFrequency = frequency, delay = 0) {
      const ac = unlockAudio();
      if (!ac || voices >= 24) return;
      try {
        const oscillator = ac.createOscillator();
        const gain = ac.createGain();
        const at = ac.currentTime + delay;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(20, frequency), at);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
        gain.gain.setValueAtTime(volume, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
        oscillator.connect(gain).connect(ac.destination);
        oscillator.onended = () => { voices = Math.max(0, voices - 1); };
        oscillator.start(at);
        oscillator.stop(at + duration);
        voices += 1;
      } catch (error) {
        voices = Math.max(0, voices - 1);
      }
    }

    const api = {
      canvas,
      ctx,
      clamp,
      rand,
      distance,
      formatTime,
      tone,
      vibrate(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); },
      get w() { return width; },
      get h() { return height; },
      get elapsed() { return elapsed; },
      get choice() { return selectedChoice; },
      get mode() { return mode; },
      setHud(data = {}) {
        if (data.metric !== undefined) elements.metric.textContent = data.metric;
        if (data.metricLabel) elements["metric-label"].textContent = data.metricLabel;
        if (data.score !== undefined) elements.score.textContent = data.score;
        if (data.scoreLabel) elements["score-label"].textContent = data.scoreLabel;
        if (data.health !== undefined) {
          const ratio = clamp(data.health / Math.max(1, data.maxHealth || 100), 0, 1);
          elements.vital.style.width = `${ratio * 100}%`;
          elements.vital.style.background = ratio < 0.28 ? "#ff6259" : "linear-gradient(90deg,var(--game-accent),#f6ffb2)";
        }
        if (data.objective) elements.objective.textContent = data.objective;
      },
      setAction(label, charge = 1, ready = true) {
        elements.action.textContent = label;
        elements.action.style.setProperty("--charge", clamp(charge, 0, 1));
        elements.action.disabled = !ready;
      },
      hit() {
        elements.flash.classList.remove("show");
        void elements.flash.offsetWidth;
        elements.flash.classList.add("show");
        if (navigator.vibrate) navigator.vibrate(18);
      },
      freeze() {
        if (mode !== "playing") return false;
        mode = "frozen";
        cancelAnimationFrame(raf);
        return true;
      },
      unfreeze() {
        if (mode !== "frozen") return false;
        mode = "playing";
        last = performance.now();
        raf = requestAnimationFrame(loop);
        return true;
      },
      finish(title, subtitle, stats) { finish(title, subtitle, stats); },
      render() { render(); },
    };

    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      config.draw(api);
    }

    function resize() {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (config.resize) config.resize(api);
      render();
    }

    function loop(now) {
      if (mode !== "playing") return;
      const dt = Math.min(0.034, (now - last) / 1000 || 0);
      last = now;
      elapsed += dt;
      elements.timer.textContent = formatTime(elapsed);
      config.update(api, dt);
      if (mode !== "playing") return;
      render();
      raf = requestAnimationFrame(loop);
    }

    function start() {
      unlockAudio();
      cancelAnimationFrame(raf);
      elapsed = 0;
      mode = "playing";
      toggle("start", false);
      toggle("paused", false);
      toggle("result", false);
      elements.timer.textContent = "00:00";
      config.reset(api);
      render();
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function pause() {
      if (mode !== "playing") return;
      mode = "paused";
      cancelAnimationFrame(raf);
      toggle("paused", true);
    }

    function resume() {
      if (mode !== "paused") return;
      mode = "playing";
      toggle("paused", false);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function finish(title, subtitle, stats = []) {
      if (mode === "result") return;
      mode = "result";
      cancelAnimationFrame(raf);
      elements["result-title"].textContent = title;
      elements["result-sub"].textContent = subtitle;
      elements["result-stats"].innerHTML = stats.slice(0, 3).map((stat) => `<div><b>${stat.value}</b><small>${stat.label}</small></div>`).join("");
      toggle("paused", false);
      toggle("result", true);
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (mode !== "playing" || !event.isPrimary) return;
      pointerId = event.pointerId;
      canvas.setPointerCapture(pointerId);
      if (config.pointerDown) config.pointerDown(api, point(event), event);
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (mode !== "playing" || event.pointerId !== pointerId) return;
      if (config.pointerMove) config.pointerMove(api, point(event), event);
      event.preventDefault();
    });
    const endPointer = (event) => {
      if (event.pointerId !== pointerId) return;
      if (config.pointerUp) config.pointerUp(api, point(event), event);
      pointerId = null;
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    document.querySelectorAll(".loadout").forEach((button) => {
      button.addEventListener("click", () => {
        selectedChoice = button.dataset.choice;
        document.querySelectorAll(".loadout").forEach((item) => {
          const selected = item === button;
          item.classList.toggle("selected", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        tone(520, 0.05, "triangle", 0.012, 760);
        if (config.choiceChanged) config.choiceChanged(api);
      });
    });

    document.getElementById("start-button").addEventListener("click", start);
    document.getElementById("retry").addEventListener("click", start);
    document.getElementById("pause").addEventListener("click", pause);
    document.getElementById("resume").addEventListener("click", resume);
    document.getElementById("restart-paused").addEventListener("click", start);
    document.getElementById("back-start").addEventListener("click", () => { mode = "start"; toggle("paused", false); toggle("result", false); toggle("start", true); render(); });
    elements.action.addEventListener("click", () => { if (mode === "playing" && config.action) config.action(api); });
    document.getElementById("sound").addEventListener("click", () => {
      audioOn = !audioOn;
      elements["sound-mark"].classList.toggle("off", !audioOn);
      document.getElementById("sound").setAttribute("aria-label", audioOn ? "关闭音效" : "开启音效");
      if (audioOn) tone(660, 0.05, "sine", 0.012, 880);
    });
    global.addEventListener("keydown", (event) => {
      if ((event.key === "Escape" || event.key.toLowerCase() === "p") && mode === "playing") pause();
      else if ((event.key === "Escape" || event.key.toLowerCase() === "p") && mode === "paused") resume();
      else if (event.code === "Space" && mode === "playing" && config.action) config.action(api);
      if (config.key) config.key(api, event, true);
    });
    global.addEventListener("keyup", (event) => { if (config.key) config.key(api, event, false); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "playing") pause(); });
    global.addEventListener("resize", resize);

    if (config.init) config.init(api);
    resize();
    return api;
  }

  global.ArcadeKit = { mount, clamp, rand, distance, formatTime };
})(window);
