(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } = global.Vue;
  const storageKey = "aabb-toolbox-teleprompter";
  const sampleText = `大家好，欢迎来到今天的分享。

今天我们会用一个简单的结构，把核心信息讲清楚。

第一，先说明背景和问题。
第二，展示解决方案和关键步骤。
第三，给出结论和下一步计划。

如果语速偏快，可以把滚动速度调低。
如果距离屏幕较远，可以调大字号和行距。

谢谢大家。`;

  const scenePresets = [
    {
      id: "short-video",
      label: "短视频",
      fontSize: 34,
      scrollSpeed: 42,
      lineHeight: 1.62,
      sidePadding: 24,
      orientation: "portrait",
      backgroundColor: "#05070c",
      textColor: "#ffffff",
      readColor: "#768195",
      readColorEnabled: true,
      autoPlay: true,
    },
    {
      id: "live",
      label: "直播",
      fontSize: 40,
      scrollSpeed: 34,
      lineHeight: 1.7,
      sidePadding: 34,
      orientation: "landscape",
      backgroundColor: "#000000",
      textColor: "#f9fafb",
      readColor: "#6b7280",
      readColorEnabled: true,
      autoPlay: true,
    },
    {
      id: "speech",
      label: "演讲",
      fontSize: 46,
      scrollSpeed: 28,
      lineHeight: 1.78,
      sidePadding: 42,
      orientation: "landscape",
      backgroundColor: "#0b1020",
      textColor: "#ffffff",
      readColor: "#8b95a7",
      readColorEnabled: false,
      autoPlay: false,
    },
    {
      id: "desk",
      label: "桌面",
      fontSize: 30,
      scrollSpeed: 50,
      lineHeight: 1.55,
      sidePadding: 20,
      orientation: "portrait",
      backgroundColor: "#f8fafc",
      textColor: "#111827",
      readColor: "#9ca3af",
      readColorEnabled: true,
      autoPlay: false,
    },
  ];

  global.TeleprompterTool = {
    name: "TeleprompterTool",
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
            <button class="text-action" type="button" @click="enterPresenter">全屏</button>
          </section>
        </header>

        <section class="prompter-overview" aria-label="提词器概览">
          <div>
            <span>{{ lineCount }}</span>
            <p>行数</p>
          </div>
          <div>
            <span>{{ config.fontSize }}px</span>
            <p>字号</p>
          </div>
          <div>
            <span>{{ progress }}%</span>
            <p>进度</p>
          </div>
        </section>

        <section class="prompter-section">
          <div class="section-header">
            <h2>文稿</h2>
            <button type="button" @click="loadSample">示例</button>
          </div>
          <textarea
            v-model="scriptText"
            class="prompter-editor"
            placeholder="输入或粘贴提词文稿"
            @input="handleScriptInput"
          ></textarea>
        </section>

        <section class="prompter-section">
          <div class="section-header">
            <h2>场景</h2>
            <button type="button" @click="resetTool">重置</button>
          </div>
          <div class="prompter-preset-grid">
            <button
              v-for="preset in scenePresets"
              :key="preset.id"
              type="button"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </section>

        <section class="prompter-section">
          <div class="section-header">
            <h2>显示设置</h2>
            <button type="button" @click="toggleOrientation">
              {{ config.orientation === 'portrait' ? '竖屏' : '横屏' }}
            </button>
          </div>
          <div class="prompter-tabs">
            <button :class="{ active: config.orientation === 'portrait' }" type="button" @click="setOrientation('portrait')">竖屏</button>
            <button :class="{ active: config.orientation === 'landscape' }" type="button" @click="setOrientation('landscape')">横屏</button>
          </div>
          <div class="prompter-range-list">
            <label>
              <span>文字大小 {{ config.fontSize }}px</span>
              <input v-model.number="config.fontSize" type="range" min="20" max="88" step="1" @input="saveConfig" />
            </label>
            <label>
              <span>滚动速度 {{ config.scrollSpeed }}px/s</span>
              <input v-model.number="config.scrollSpeed" type="range" min="5" max="180" step="1" @input="saveConfig" />
            </label>
            <label class="prompter-switch">
              <span>进入全屏自动播放</span>
              <input v-model="config.autoPlay" type="checkbox" @change="saveConfig" />
            </label>
            <label>
              <span>行距 {{ config.lineHeight }}</span>
              <input v-model.number="config.lineHeight" type="range" min="1.2" max="2.2" step="0.02" @input="saveConfig" />
            </label>
            <label>
              <span>左右边距 {{ config.sidePadding }}px</span>
              <input v-model.number="config.sidePadding" type="range" min="8" max="96" step="1" @input="saveConfig" />
            </label>
          </div>
        </section>

        <section class="prompter-section">
          <div class="section-header">
            <h2>颜色</h2>
            <button type="button" @click="toggleReadColor">{{ config.readColorEnabled ? '已读开' : '已读关' }}</button>
          </div>
          <div class="prompter-color-grid">
            <label>
              <span>背景</span>
              <input v-model="config.backgroundColor" type="color" @input="saveConfig" />
            </label>
            <label>
              <span>文字</span>
              <input v-model="config.textColor" type="color" @input="saveConfig" />
            </label>
            <label :class="{ disabled: !config.readColorEnabled }">
              <span>已读</span>
              <input v-model="config.readColor" type="color" :disabled="!config.readColorEnabled" @input="saveConfig" />
            </label>
          </div>
        </section>

        <section class="prompter-section">
          <div class="section-header">
            <h2>预览</h2>
            <button type="button" @click="resetScroll">回到顶部</button>
          </div>
          <div class="prompter-stage" :style="stageStyle">
            <div
              ref="previewScroll"
              class="prompter-scroll"
              :style="scrollStyle"
              @scroll="handleScroll"
            >
              <div class="prompter-spacer"></div>
              <p
                v-for="(line, index) in promptLines"
                :key="index"
                :class="['prompter-line', { read: isLineRead(index) }]"
                :style="lineStyle(index)"
              >
                {{ line }}
              </p>
              <div class="prompter-spacer"></div>
            </div>
            <span class="prompter-marker" aria-hidden="true"></span>
          </div>
          <div class="prompter-progress-panel">
            <label>
              <span>手动校正进度 {{ progress }}%</span>
              <input :value="progress" type="range" min="0" max="100" step="1" @input="setProgress($event.target.value)" />
            </label>
            <div class="prompter-speed-row">
              <button type="button" @click="adjustSpeed(-5)">慢一点</button>
              <span>{{ config.scrollSpeed }}px/s</span>
              <button type="button" @click="adjustSpeed(5)">快一点</button>
            </div>
          </div>
        </section>

        <section class="prompter-actions">
          <button type="button" @click="toggleRunning">{{ running ? '暂停' : '开始' }}</button>
          <button type="button" @click="resetScroll">回顶</button>
          <button type="button" @click="enterPresenter">全屏</button>
        </section>

        <section v-if="notice.message" :class="['prompter-notice', notice.type]">
          <strong>{{ notice.title }}</strong>
          <p>{{ notice.message }}</p>
        </section>

        <section
          v-if="presenting"
          :class="['prompter-presenter', config.orientation]"
          :style="stageStyle"
        >
          <div class="prompter-fullbar">
            <button type="button" @click="adjustSpeed(-5)">慢</button>
            <button type="button" @click="toggleRunning">{{ running ? '暂停' : '开始' }}</button>
            <button type="button" @click="adjustSpeed(5)">快</button>
            <button type="button" @click="resetScroll">回顶</button>
            <button type="button" @click="toggleOrientation">{{ config.orientation === 'portrait' ? '竖屏' : '横屏' }}</button>
            <button type="button" @click="exitPresenter">退出</button>
          </div>
          <label class="prompter-full-progress">
            <span>进度 {{ progress }}% · {{ config.scrollSpeed }}px/s</span>
            <input :value="progress" type="range" min="0" max="100" step="1" @input="setProgress($event.target.value)" />
          </label>
          <div
            ref="presenterScroll"
            class="prompter-scroll full"
            :style="scrollStyle"
            @scroll="handleScroll"
          >
            <div class="prompter-spacer"></div>
            <p
              v-for="(line, index) in promptLines"
              :key="'full-' + index"
              :class="['prompter-line', { read: isLineRead(index) }]"
              :style="lineStyle(index)"
            >
              {{ line }}
            </p>
            <div class="prompter-spacer"></div>
          </div>
          <span class="prompter-marker full" aria-hidden="true"></span>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const cached = loadConfig();
      const scriptText = ref(cached.scriptText || sampleText);
      const config = reactive({
        fontSize: cached.fontSize || 34,
        scrollSpeed: cached.scrollSpeed || 42,
        lineHeight: cached.lineHeight || 1.62,
        sidePadding: cached.sidePadding || 24,
        orientation: cached.orientation || "portrait",
        backgroundColor: cached.backgroundColor || "#05070c",
        textColor: cached.textColor || "#ffffff",
        readColor: cached.readColor || "#768195",
        readColorEnabled: cached.readColorEnabled !== false,
        autoPlay: cached.autoPlay !== false,
      });
      const previewScroll = ref(null);
      const presenterScroll = ref(null);
      const presenting = ref(false);
      const running = ref(false);
      const scrollState = reactive({
        top: 0,
        height: 0,
        client: 0,
        activeLine: -1,
      });
      const notice = reactive({
        type: "idle",
        title: "",
        message: "",
      });
      let rafId = 0;
      let lastFrame = 0;

      const promptLines = computed(() => {
        const lines = scriptText.value.replace(/\r/g, "").split("\n");
        return lines.length ? lines.map((line) => line || " ") : [" "];
      });
      const lineCount = computed(() => promptLines.value.filter((line) => line.trim()).length);
      const progress = computed(() => {
        const max = Math.max(1, scrollState.height - scrollState.client);
        return Math.max(0, Math.min(100, Math.round((scrollState.top / max) * 100)));
      });
      const stageStyle = computed(() => ({
        background: config.backgroundColor,
        color: config.textColor,
      }));
      const scrollStyle = computed(() => ({
        paddingRight: `${config.sidePadding}px`,
        paddingLeft: `${config.sidePadding}px`,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineHeight,
      }));

      function goHome() {
        emit("go-home");
      }

      function handleScriptInput() {
        saveConfig();
        nextTick(syncMetrics);
      }

      function saveConfig() {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...config,
            scriptText: scriptText.value,
          })
        );
      }

      function applyPreset(preset) {
        Object.assign(config, {
          fontSize: preset.fontSize,
          scrollSpeed: preset.scrollSpeed,
          lineHeight: preset.lineHeight,
          sidePadding: preset.sidePadding,
          orientation: preset.orientation,
          backgroundColor: preset.backgroundColor,
          textColor: preset.textColor,
          readColor: preset.readColor,
          readColorEnabled: preset.readColorEnabled,
          autoPlay: preset.autoPlay,
        });
        saveConfig();
        lockOrientation();
        showSuccess("已应用场景", `${preset.label} 参数已生效。`);
      }

      function loadSample() {
        scriptText.value = sampleText;
        saveConfig();
        nextTick(syncMetrics);
      }

      function setOrientation(value) {
        config.orientation = value;
        saveConfig();
        lockOrientation();
      }

      function toggleOrientation() {
        setOrientation(config.orientation === "portrait" ? "landscape" : "portrait");
      }

      function toggleReadColor() {
        config.readColorEnabled = !config.readColorEnabled;
        saveConfig();
      }

      function currentScroll() {
        return presenting.value && presenterScroll.value ? presenterScroll.value : previewScroll.value;
      }

      function handleScroll(event) {
        updateScrollState(event.currentTarget);
      }

      function updateScrollState(element) {
        if (!element) return;

        scrollState.top = element.scrollTop;
        scrollState.height = element.scrollHeight;
        scrollState.client = element.clientHeight;
        updateReadIndex(element);
      }

      function setProgress(value) {
        pause();
        const percent = Math.max(0, Math.min(100, Number(value) || 0));
        const targets = [previewScroll.value, presenterScroll.value].filter(Boolean);

        targets.forEach((element) => {
          const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
          element.scrollTop = (maxTop * percent) / 100;
          updateScrollState(element);
        });
      }

      function adjustSpeed(delta) {
        config.scrollSpeed = Math.max(5, Math.min(180, Number(config.scrollSpeed) + delta));
        saveConfig();
      }

      function updateReadIndex(element) {
        const threshold = element.scrollTop + element.clientHeight * 0.35;
        const lines = Array.from(element.querySelectorAll(".prompter-line"));
        let active = -1;

        lines.forEach((line, index) => {
          if (line.offsetTop <= threshold) active = index;
        });

        scrollState.activeLine = active;
      }

      function syncMetrics() {
        const element = currentScroll();
        if (!element) return;
        element.scrollTop = scrollState.top;
        updateScrollState(element);
      }

      function toggleRunning() {
        if (running.value) {
          pause();
          return;
        }
        start();
      }

      function start() {
        if (running.value) return;

        running.value = true;
        lastFrame = now();
        rafId = requestFrame(step);
      }

      function pause() {
        running.value = false;
        cancelFrame(rafId);
      }

      function step(timestamp) {
        if (!running.value) return;

        const element = currentScroll();
        const delta = Math.max(0, timestamp - lastFrame);
        lastFrame = timestamp;

        if (element) {
          const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
          element.scrollTop = Math.min(maxTop, element.scrollTop + (config.scrollSpeed * delta) / 1000);
          updateScrollState(element);
          if (element.scrollTop >= maxTop && maxTop > 0) {
            pause();
            return;
          }
        }

        rafId = requestFrame(step);
      }

      function resetScroll() {
        pause();
        scrollState.top = 0;
        scrollState.activeLine = -1;
        [previewScroll.value, presenterScroll.value].forEach((element) => {
          if (element) {
            element.scrollTop = 0;
            updateScrollState(element);
          }
        });
      }

      async function enterPresenter() {
        presenting.value = true;
        showSuccess("演示模式", "已进入提词展示。");

        try {
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
        } catch (error) {
          showSuccess("演示模式", "浏览器未允许系统全屏，已使用页面全屏展示。");
        }

        await lockOrientation();
        await nextTick();
        syncMetrics();

        if (config.autoPlay) {
          start();
        }
      }

      async function exitPresenter() {
        presenting.value = false;
        unlockOrientation();
        await nextTick();
        syncMetrics();

        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
          }
        } catch (error) {
          // Browser may reject exitFullscreen when it was not user initiated.
        }
      }

      async function lockOrientation() {
        if (!presenting.value || !global.screen || !global.screen.orientation || !global.screen.orientation.lock) {
          return;
        }

        try {
          await global.screen.orientation.lock(config.orientation);
        } catch (error) {
          // Orientation lock is optional; CSS keeps a usable fallback.
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

      function handleFullscreenChange() {
        if (!document.fullscreenElement && presenting.value) {
          presenting.value = false;
          unlockOrientation();
          nextTick(syncMetrics);
        }
      }

      function isLineRead(index) {
        return config.readColorEnabled && index <= scrollState.activeLine;
      }

      function lineStyle(index) {
        return {
          color: isLineRead(index) ? config.readColor : config.textColor,
        };
      }

      function resetTool() {
        pause();
        scriptText.value = sampleText;
        Object.assign(config, {
          fontSize: scenePresets[0].fontSize,
          scrollSpeed: scenePresets[0].scrollSpeed,
          lineHeight: scenePresets[0].lineHeight,
          sidePadding: scenePresets[0].sidePadding,
          orientation: scenePresets[0].orientation,
          backgroundColor: scenePresets[0].backgroundColor,
          textColor: scenePresets[0].textColor,
          readColor: scenePresets[0].readColor,
          readColorEnabled: scenePresets[0].readColorEnabled,
          autoPlay: scenePresets[0].autoPlay,
        });
        saveConfig();
        resetScroll();
      }

      function showSuccess(title, message) {
        notice.type = "success";
        notice.title = title;
        notice.message = message;
      }

      onMounted(() => {
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        nextTick(syncMetrics);
      });

      onBeforeUnmount(() => {
        pause();
        unlockOrientation();
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      });

      return {
        adjustSpeed,
        applyPreset,
        config,
        enterPresenter,
        exitPresenter,
        goHome,
        handleScriptInput,
        handleScroll,
        isLineRead,
        lineCount,
        lineStyle,
        loadSample,
        notice,
        presenting,
        presenterScroll,
        previewScroll,
        progress,
        promptLines,
        resetScroll,
        resetTool,
        running,
        saveConfig,
        scenePresets,
        scriptText,
        scrollStyle,
        setOrientation,
        setProgress,
        stageStyle,
        toggleOrientation,
        toggleReadColor,
        toggleRunning,
      };
    },
  };

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function now() {
    return global.performance && global.performance.now ? global.performance.now() : Date.now();
  }

  function requestFrame(callback) {
    if (global.requestAnimationFrame) return global.requestAnimationFrame(callback);
    return global.setTimeout(() => callback(now()), 16);
  }

  function cancelFrame(id) {
    if (global.cancelAnimationFrame) {
      global.cancelAnimationFrame(id);
      return;
    }
    global.clearTimeout(id);
  }
})(window);
