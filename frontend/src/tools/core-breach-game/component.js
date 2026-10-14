(function (global) {
  if (!global.Vue) return;

  const { onBeforeUnmount, onMounted, ref } = global.Vue;
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
          <p class="survival-kicker">单机 · 竖屏 · 自动攻击</p>
          <h2>弹壳打工</h2>
          <p>选好工地、角色和武器，拖动走位，自动清怪。升级时挑一项强化，撑过三分钟就能下班。</p>
          <div class="survival-tags"><span>五种工地 · 100关</span><span>每轮生命 +20%</span><span>随机强化</span></div>
          <button type="button" class="survival-launch" @click="openGame">开始打工</button>
        </section>
        <section v-if="playing" class="survival-fullscreen">
          <button type="button" class="survival-close" aria-label="退出游戏，返回工具首页" @click="goHome">×</button>
          <iframe :src="gameSrc" title="弹壳打工" allow="fullscreen"></iframe>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const playing = ref(false);
      function goHome() { closeGame(); emit("go-home"); }
      async function openGame() {
        playing.value = true;
        await global.GameDisplay.requestFullscreen();
      }
      async function closeGame() {
        playing.value = false;
        await global.GameDisplay.exitFullscreen();
      }
      onBeforeUnmount(closeGame);
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
        await global.GameDisplay.requestFullscreen();
      }

      async function closeGame() {
        playing.value = false;
        await global.GameDisplay.exitFullscreen();
      }

      function handleMessage(event) {
        if (event.origin !== global.location.origin || !event.data || event.data.type !== "core-breach:exit") return;
        event.source.postMessage({ type: "core-breach:exit-ack" }, event.origin);
        goHome();
      }

      onMounted(() => global.addEventListener("message", handleMessage));
      onBeforeUnmount(() => {
        global.removeEventListener("message", handleMessage);
        closeGame();
      });

      return { closeGame, gameSrc: legacyGameSrc, goHome, openGame, playing };
    },
  };
})(window);
