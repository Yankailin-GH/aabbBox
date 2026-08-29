(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, onMounted, ref } = global.Vue;
  const gameSrc = "./src/core-breach-game.html";

  global.CoreBreachGameTool = {
    name: "CoreBreachGameTool",
    props: {
      tool: {
        type: Object,
        required: true,
      },
    },
    emits: ["go-home"],
    template: `
      <section>
        <header class="app-header tool-header">
          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome">
              <span class="back-icon"></span>
            </button>
            <div class="tool-title">
              <p class="eyebrow">{{ tool.category }}</p>
              <h1>{{ tool.name }}</h1>
            </div>
          </section>
        </header>

        <section class="game-hero-panel">
          <div class="game-logo-mark">星核</div>
          <h2>星核防线：量子协议</h2>
          <p>{{ isWechat ? '微信内使用沉浸模式打开，请横屏游玩。' : '横屏塔防游戏。进入游戏后请横屏游玩，战场会铺满当前可用视口。' }}</p>
          <div class="game-hero-actions">
            <button type="button" @click="openGame">{{ isWechat ? '沉浸游戏' : '进入游戏' }}</button>
            <button type="button" @click="openDirect">独立打开</button>
            <button type="button" @click="loadPreview">{{ previewLoaded ? '刷新预览' : '加载预览' }}</button>
          </div>
        </section>

        <section class="game-section">
          <div class="section-header">
            <h2>内嵌预览</h2>
            <button type="button" @click="reloadGame">重载</button>
          </div>
          <div v-if="!previewLoaded" class="game-preview-placeholder">
            <span>横屏游戏</span>
            <p>点击“加载预览”后在工具页内查看。</p>
          </div>
          <div v-else class="game-preview-shell" :style="{ height: previewHeight + 'px' }">
            <iframe
              :key="'preview-' + frameVersion"
              class="game-preview-frame"
              :style="{ transform: 'translateX(-50%) scale(' + previewScale + ')' }"
              :src="gameSrc"
              title="星核防线游戏预览"
              allow="fullscreen; screen-wake-lock"
              allowfullscreen
            ></iframe>
          </div>
        </section>

        <section class="game-tip-panel">
          <strong>手机操作建议</strong>
          <p>iPhone 浏览器建议横屏进入。微信里无法保证隐藏顶部栏，页面会自动使用沉浸式覆盖层铺满当前可用区域。</p>
        </section>

        <section
          v-if="playing"
          :class="['game-fullscreen-shell', { landscape: forceLandscape, wechat: isWechat }]"
        >
          <div class="game-fullbar">
            <button type="button" @click="reloadGame">重载</button>
            <button type="button" @click="closeGame">退出</button>
          </div>
          <iframe
            ref="gameFrame"
            :key="'full-' + frameVersion"
            class="game-full-frame"
            :src="gameSrc"
            title="星核防线：量子协议"
            allow="fullscreen; screen-wake-lock"
            allowfullscreen
          ></iframe>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const playing = ref(false);
      const previewLoaded = ref(false);
      const forceLandscape = ref(false);
      const frameVersion = ref(1);
      const viewportWidth = ref(getViewportWidth());
      const gameFrame = ref(null);
      const isWechat = /MicroMessenger/i.test(global.navigator && global.navigator.userAgent ? global.navigator.userAgent : "");

      const previewScale = computed(() => Math.min(1, Math.max(0.32, (viewportWidth.value - 32) / 860)));
      const previewHeight = computed(() => Math.round(540 * previewScale.value));

      function goHome() {
        closeGame();
        emit("go-home");
      }

      async function openGame() {
        playing.value = true;
        await nextTick();
        if (!isWechat) {
          await requestFullscreen();
        }
        await lockLandscape();
      }

      function openDirect() {
        window.location.href = gameSrc;
      }

      async function closeGame() {
        playing.value = false;
        unlockOrientation();

        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
          }
        } catch (error) {
          // Ignore fullscreen exit failures.
        }
      }

      function loadPreview() {
        previewLoaded.value = true;
        reloadGame();
      }

      function reloadGame() {
        frameVersion.value += 1;
      }

      async function toggleLandscape() {
        forceLandscape.value = !forceLandscape.value;
        if (playing.value && forceLandscape.value) {
          await lockLandscape();
        } else {
          unlockOrientation();
        }
      }

      async function requestFullscreen() {
        const docEl = document.documentElement;
        const rfs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;

        try {
          if (rfs && !document.fullscreenElement && !document.webkitFullscreenElement) {
            await rfs.call(docEl);
          }
        } catch (error) {
          // CSS fixed overlay remains usable if fullscreen is denied.
        }
      }

      async function lockLandscape() {
        if (!forceLandscape.value || !global.screen || !global.screen.orientation || !global.screen.orientation.lock) {
          return;
        }

        try {
          await global.screen.orientation.lock("landscape");
        } catch (error) {
          // Orientation lock is optional; CSS rotation is the fallback.
        }
      }

      function unlockOrientation() {
        if (global.screen && global.screen.orientation && global.screen.orientation.unlock) {
          try {
            global.screen.orientation.unlock();
          } catch (error) {
            // Ignore unsupported unlock.
          }
        }
      }

      function handleResize() {
        viewportWidth.value = getViewportWidth();
      }

      function handleFullscreenChange() {
        if (playing.value) {
          unlockOrientation();
        }
      }

      onMounted(() => {
        global.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
      });

      onBeforeUnmount(() => {
        unlockOrientation();
        global.removeEventListener("resize", handleResize);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      });

      return {
        closeGame,
        forceLandscape,
        frameVersion,
        gameFrame,
        gameSrc,
        goHome,
        isWechat,
        loadPreview,
        openGame,
        playing,
        previewHeight,
        previewScale,
        previewLoaded,
        reloadGame,
        toggleLandscape,
      };
    },
  };

  function getViewportWidth() {
    return Math.min(global.innerWidth || 430, 430);
  }
})(window);
