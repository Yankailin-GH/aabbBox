(function (global) {
  "use strict";

  if (!global.Vue) return;

  const { computed, onBeforeUnmount, onMounted, ref } = global.Vue;
  const games = {
    "fruit-puzzle": {
      src: "./src/fruit-puzzle.html",
      kicker: "亲子 · 果蔬认知 · 拖拽拼合",
      title: "果果拼拼乐",
      description: "听一听蔬果的名字，用玩具切片器把它分开，再把每一块送回完整轮廓。",
      tags: ["12 种蔬果", "中文语音", "无失败拼图"],
      launch: "开始认识果果",
      theme: "fruit",
    },
    "abyss-salvage": {
      src: "./src/abyss-salvage.html",
      kicker: "单机 · 深海搜集 · 资源生存",
      title: "深渊采样",
      description: "驾驶深潜器穿过海沟，维持氧气与艇体状态，避开捕食者并带回十八份深海样本。",
      tags: ["全屏拖动", "声呐脉冲", "风险搜集"],
      launch: "开始下潜",
      theme: "abyss",
    },
    "wasteland-convoy": {
      src: "./src/wasteland-convoy.html",
      kicker: "单机 · 公路追逐 · 自动火力",
      title: "荒原车队",
      description: "在废土公路上变道追逐，拾取武器模块并改装火控、装甲和引擎，冲破封锁抵达检查站。",
      tags: ["武器切换", "永久改装", "氮气冲刺"],
      launch: "发动引擎",
      theme: "convoy",
    },
    "sky-bastion": {
      src: "./src/sky-bastion.html",
      kicker: "单机 · 弹道预测 · 防空拦截",
      title: "天穹守望",
      description: "拖动准星控制穹顶炮台，计算来袭轨迹，拦截战机、无人机和重型轰炸机。",
      tags: ["拖动瞄准", "三种火控", "空爆弹"],
      launch: "启动阵列",
      theme: "bastion",
    },
    "shadow-infiltration": {
      src: "./src/shadow-infiltration.html",
      kicker: "单机 · 路线规划 · 动态警戒",
      title: "影域潜行",
      description: "观察巡逻视锥，在节点间规划无声路线，破解终端并从屋顶完成撤离。",
      tags: ["节点移动", "潜行破解", "干扰脉冲"],
      launch: "进入影域",
      theme: "shadow",
    },
    "core-forge": {
      src: "./src/core-forge.html",
      kicker: "单机 · 色彩匹配 · 节奏连击",
      title: "熔核锻造",
      description: "旋转四色接收环匹配高速来料，保持连击、控制炉温，完成一炉纯净合金。",
      tags: ["全屏旋转", "连击升温", "主动泄压"],
      launch: "点燃熔核",
      theme: "forge",
    },
  };

  global.ArcadeGameTool = {
    name: "ArcadeGameTool",
    props: { tool: { type: Object, required: true } },
    emits: ["go-home"],
    template: `
      <section class="arcade-tool" :data-game-theme="game.theme">
        <header class="app-header tool-header">
          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome"><span class="back-icon"></span></button>
            <div class="tool-title"><p class="eyebrow">{{ tool.category }}</p><h1>{{ game.title }}</h1></div>
          </section>
        </header>
        <section class="arcade-intro">
          <div class="arcade-emblem" aria-hidden="true"><i></i><span>{{ tool.icon }}</span></div>
          <p class="arcade-kicker">{{ game.kicker }}</p>
          <h2>{{ game.title }}</h2>
          <p class="arcade-description">{{ game.description }}</p>
          <div class="arcade-tags"><span v-for="tag in game.tags" :key="tag">{{ tag }}</span></div>
          <button type="button" class="arcade-launch" @click="openGame">{{ game.launch }}</button>
        </section>
        <section v-if="playing" class="arcade-fullscreen">
          <button type="button" class="arcade-close" aria-label="退出游戏" @click="closeGame">×</button>
          <p v-if="loading" class="arcade-loading" role="status">正在载入 {{ game.title }}</p>
          <iframe :src="game.src" :title="game.title" allow="fullscreen" @load="onFrameLoad"></iframe>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const playing = ref(false);
      const loading = ref(false);
      const game = computed(() => games[props.tool.id] || games["abyss-salvage"]);

      function goHome() {
        closeGame();
        emit("go-home");
      }

      async function openGame() {
        loading.value = true;
        playing.value = true;
        try {
          if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
          if (global.screen.orientation && global.screen.orientation.lock) await global.screen.orientation.lock("portrait");
        } catch (error) { /* Fixed overlay preserves play when fullscreen APIs are unavailable. */ }
      }

      async function closeGame() {
        playing.value = false;
        loading.value = false;
        try {
          if (global.screen.orientation && global.screen.orientation.unlock) global.screen.orientation.unlock();
          if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        } catch (error) { /* Exiting the fixed overlay is sufficient. */ }
      }

      function handleFullscreen() {
        if (!document.fullscreenElement) playing.value = false;
      }

      function onFrameLoad() {
        loading.value = false;
      }

      onMounted(() => document.addEventListener("fullscreenchange", handleFullscreen));
      onBeforeUnmount(() => {
        document.removeEventListener("fullscreenchange", handleFullscreen);
        closeGame();
      });

      return { closeGame, game, goHome, loading, onFrameLoad, openGame, playing };
    },
  };
})(window);
