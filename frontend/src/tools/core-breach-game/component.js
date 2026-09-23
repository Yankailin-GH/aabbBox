(function (global) {
  if (!global.Vue) return;

  const { computed, onBeforeUnmount, onMounted, ref } = global.Vue;
  const gameSrc = "./src/core-breach-game.html";

  global.CoreBreachGameTool = {
    name: "CoreBreachGameTool",
    props: { tool: { type: Object, required: true } },
    emits: ["go-home"],
    template: `
      <section class="survival-tool">
        <header class="app-header tool-header">
          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome"><span class="back-icon"></span></button>
            <div class="tool-title"><p class="eyebrow">{{ tool.category }}</p><h1>{{ tool.name }}</h1></div>
          </section>
        </header>
        <section class="survival-intro">
          <p class="survival-kicker">单机 · 竖屏 · 自动射击</p>
          <h2>裂隙远征</h2>
          <p>在荧光温室的战场任意位置拖动走位，武器会自动锁定敌群。每次升级选择一项变异，撑过三分钟。</p>
          <div class="survival-tags"><span>移动构筑</span><span>精英波</span><span>随机变异</span></div>
          <button type="button" class="survival-launch" @click="openGame">开始远征</button>
        </section>
        <section v-if="playing" class="survival-fullscreen">
          <button type="button" class="survival-close" aria-label="退出游戏，返回工具首页" @click="goHome">×</button>
          <iframe :src="gameSrc" title="裂隙远征" allow="fullscreen"></iframe>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const playing = ref(false);
      const canFullscreen = computed(() => Boolean(document.documentElement.requestFullscreen));
      function goHome() { closeGame(); emit("go-home"); }
      async function openGame() {
        playing.value = true;
        try { if (canFullscreen.value) await document.documentElement.requestFullscreen(); } catch (error) { /* Fixed overlay is the fallback. */ }
      }
      async function closeGame() {
        playing.value = false;
        try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch (error) { /* No action needed. */ }
      }
      function handleFullscreen() { if (!document.fullscreenElement) playing.value = false; }
      onMounted(() => document.addEventListener("fullscreenchange", handleFullscreen));
      onBeforeUnmount(() => { document.removeEventListener("fullscreenchange", handleFullscreen); closeGame(); });
      return { closeGame, gameSrc, goHome, openGame, playing };
    },
  };

  const legacyGameSrc = "./src/core-breach-legacy.html";

  global.LegacyCoreBreachGameTool = {
    name: "LegacyCoreBreachGameTool",
    props: { tool: { type: Object, required: true } },
    emits: ["go-home"],
    template: `
      <section class="survival-tool legacy-game-tool">
        <header class="app-header tool-header">
          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome"><span class="back-icon"></span></button>
            <div class="tool-title"><p class="eyebrow">{{ tool.category }}</p><h1>{{ tool.name }}</h1></div>
          </section>
        </header>
        <section class="survival-intro legacy-intro">
          <p class="survival-kicker">单机 · 竖屏 · 策略塔防</p>
          <h2>花园防线</h2>
          <p>在阳光花园布置植物守卫，搭配不同路线和技能，挡住一路前来的捣蛋方块军团。</p>
          <div class="survival-tags"><span>花园构筑</span><span>首领波次</span><span>园丁技能</span></div>
          <button type="button" class="survival-launch legacy-launch" @click="openGame">守护花园</button>
        </section>
        <section v-if="playing" class="survival-fullscreen legacy-fullscreen">
          <button type="button" class="survival-close" aria-label="退出游戏，返回工具首页" @click="goHome">×</button>
          <iframe :src="gameSrc" title="花园防线" allow="fullscreen"></iframe>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const playing = ref(false);

      function goHome() {
        closeGame();
        emit("go-home");
      }

      async function openGame() {
        playing.value = true;
        try {
          if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
          if (global.screen.orientation && global.screen.orientation.lock) await global.screen.orientation.lock("portrait");
        } catch (error) { /* Fullscreen and orientation lock are optional. */ }
      }

      async function closeGame() {
        playing.value = false;
        try {
          if (global.screen.orientation && global.screen.orientation.unlock) global.screen.orientation.unlock();
          if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        } catch (error) { /* No action needed. */ }
      }

      function handleFullscreen() { if (!document.fullscreenElement) playing.value = false; }
      function handleMessage(event) {
        if (event.origin !== global.location.origin || !event.data || event.data.type !== "core-breach:exit") return;
        event.source.postMessage({ type: "core-breach:exit-ack" }, event.origin);
        goHome();
      }

      onMounted(() => {
        document.addEventListener("fullscreenchange", handleFullscreen);
        global.addEventListener("message", handleMessage);
      });
      onBeforeUnmount(() => {
        document.removeEventListener("fullscreenchange", handleFullscreen);
        global.removeEventListener("message", handleMessage);
        closeGame();
      });

      return { closeGame, gameSrc: legacyGameSrc, goHome, openGame, playing };
    },
  };
})(window);
