(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } = global.Vue;
  const storageKey = "aabb-toolbox-lucky-wheel-prizes";
  const historyStorageKey = "aabb-toolbox-lucky-wheel-history";
  const legacyStorageKey = "lotteryPrizes";
  const themeStorageKey = "aabb-toolbox-lucky-wheel-theme";
  const soundStorageKey = "aabb-toolbox-lucky-wheel-sound";

  const maxPrizeKinds = 12;
  const maxQuantity = 10000;
  const maxHistoryCount = 10;

  const themes = [
    {
      id: "classic",
      name: "经典原版",
      desc: "极简拟物 · 原版经典设计",
      dotColor: "#111827",
      badge: "原版",
    },
    {
      id: "cyber",
      name: "赛博霓虹",
      desc: "暗黑电竞 · 发光霓虹光轨",
      dotColor: "#00f2fe",
      badge: "推荐",
    },
    {
      id: "luxury",
      name: "盛典华金",
      desc: "盛典派对 · 走马灯闪烁华彩",
      dotColor: "#d97706",
      badge: "奢华",
    },
    {
      id: "macaron",
      name: "马卡龙潮玩",
      desc: "糖果盲盒 · 梦幻立体圆角",
      dotColor: "#ec4899",
      badge: "甜美",
    },
  ];

  const wheelPalette = [
    "#FF9500",
    "#5AC8FA",
    "#FFCC00",
    "#AF52DE",
    "#FF2D55",
    "#34C759",
    "#007AFF",
    "#FF3B30",
  ];

  const defaultPrizeConfigs = [
    { name: "一等奖", quantity: 1, color: "#FF9500" },
    { name: "二等奖", quantity: 2, color: "#5AC8FA" },
    { name: "三等奖", quantity: 3, color: "#FFCC00" },
    { name: "谢谢参与", quantity: 10, color: "#AF52DE" },
    { name: "再来一次", quantity: 5, color: "#34C759" },
    { name: "红包5元", quantity: 3, color: "#FF2D55" },
  ];

  const presetTemplates = [
    {
      name: "经典年会",
      icon: "🎁",
      prizes: [
        { name: "特等奖", quantity: 1, color: "#FF3B30" },
        { name: "一等奖", quantity: 2, color: "#FF9500" },
        { name: "二等奖", quantity: 3, color: "#FFCC00" },
        { name: "三等奖", quantity: 5, color: "#34C759" },
        { name: "阳光普照", quantity: 15, color: "#007AFF" },
        { name: "谢谢参与", quantity: 10, color: "#AF52DE" },
      ],
    },
    {
      name: "今天吃什么",
      icon: "🍜",
      prizes: [
        { name: "火锅", quantity: 1, color: "#FF2D55" },
        { name: "烧烤烤肉", quantity: 1, color: "#FF9500" },
        { name: "麦当劳汉堡", quantity: 1, color: "#FFCC00" },
        { name: "轻食减脂餐", quantity: 1, color: "#34C759" },
        { name: "兰州拉面", quantity: 1, color: "#007AFF" },
        { name: "麻辣烫冒菜", quantity: 1, color: "#AF52DE" },
        { name: "日料寿司", quantity: 1, color: "#5AC8FA" },
        { name: "自己下厨", quantity: 1, color: "#FF3B30" },
      ],
    },
    {
      name: "聚会大冒险",
      icon: "🎉",
      prizes: [
        { name: "喝半杯", quantity: 1, color: "#FF2D55" },
        { name: "真心话", quantity: 1, color: "#AF52DE" },
        { name: "大冒险", quantity: 1, color: "#FF9500" },
        { name: "唱一首歌", quantity: 1, color: "#007AFF" },
        { name: "绕口令", quantity: 1, color: "#34C759" },
        { name: "学动物叫", quantity: 1, color: "#FFCC00" },
        { name: "发朋友圈点赞", quantity: 1, color: "#5AC8FA" },
        { name: "幸运免罚", quantity: 1, color: "#34C759" },
      ],
    },
    {
      name: "谁去拿外卖",
      icon: "🛵",
      prizes: [
        { name: "1号同学", quantity: 1, color: "#FF9500" },
        { name: "2号同学", quantity: 1, color: "#5AC8FA" },
        { name: "3号同学", quantity: 1, color: "#34C759" },
        { name: "4号同学", quantity: 1, color: "#FF2D55" },
        { name: "一起去拿", quantity: 1, color: "#AF52DE" },
        { name: "猜拳决定", quantity: 1, color: "#007AFF" },
      ],
    },
    {
      name: "幸运免单",
      icon: "💰",
      prizes: [
        { name: "全单免单", quantity: 1, color: "#FF3B30" },
        { name: "5折大额券", quantity: 2, color: "#FF9500" },
        { name: "8折优惠券", quantity: 5, color: "#FFCC00" },
        { name: "10元代金券", quantity: 10, color: "#34C759" },
        { name: "免费加小吃", quantity: 8, color: "#007AFF" },
        { name: "谢谢光临", quantity: 15, color: "#AF52DE" },
      ],
    },
  ];

  // =========================================================================
  // Web Audio Synthesizer (Zero Dependencies)
  // =========================================================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTickSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600 + Math.random() * 200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.045);
    } catch (e) {
      // Ignore audio error
    }
  }

  function playWinSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + i * 0.09;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.42);
      });
    } catch (e) {
      // Ignore audio error
    }
  }

  // =========================================================================
  // LuckyWheelTool Vue Component
  // =========================================================================
  global.LuckyWheelTool = {
    name: "LuckyWheelTool",
    props: {
      tool: {
        type: Object,
        required: true,
      },
    },
    emits: ["go-home"],
    template: `
      <section class="lucky-wheel-container" :data-wheel-theme="currentTheme">
        <!-- 顶部导航 -->
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

        <!-- 视图切换 (抽奖 / 配置) -->
        <nav class="wheel-tabs" aria-label="转盘页面">
          <button
            :class="{ active: activeView === 'draw' }"
            type="button"
            :disabled="isSpinning"
            @click="setView('draw')"
          >
            抽奖
          </button>
          <button
            :class="{ active: activeView === 'config' }"
            type="button"
            :disabled="isSpinning"
            @click="setView('config')"
          >
            配置
          </button>
        </nav>

        <!-- ==================== 1. 抽奖主视图 ==================== -->
        <template v-if="activeView === 'draw'">
          <!-- 第一屏：聚焦展示抽奖转盘（适配 iPhone 15 等手机一屏完整呈现） -->
          <section class="wheel-hero wheel-first-screen">
            <div class="wheel-stage" aria-label="幸运转盘">
              <div class="wheel-wrap">
                <!-- 盛典华金风格跑马灯外圈灯珠 -->
                <div v-if="currentTheme === 'luxury'" class="luxury-lights-ring" aria-hidden="true">
                  <span
                    v-for="(dot, idx) in marqueeDots"
                    :key="idx"
                    class="luxury-light-dot"
                    :class="{ blink: (marqueeTick + idx) % 2 === 0 }"
                    :style="dot.style"
                  ></span>
                </div>

                <span :class="['wheel-marker', { 'marker-bob': isMarkerBobbing }]" aria-hidden="true"></span>
                <canvas
                  ref="wheelCanvas"
                  :class="['wheel-canvas', { 'no-transition': isResettingWheel }]"
                  width="720"
                  height="720"
                  :style="{ transform: 'rotate(' + currentRotation + 'deg)' }"
                ></canvas>
                <button
                  class="wheel-go"
                  type="button"
                  :disabled="isSpinning || totalQuantity < 1"
                  @click="spinWheel"
                >
                  <span>{{ isSpinning ? '抽' : 'GO' }}</span>
                </button>
              </div>
            </div>

            <!-- 向下滑动提示指示器 -->
            <div class="wheel-scroll-indicator" aria-hidden="true">
              <span>下滑查看记录与奖池</span>
              <span class="scroll-arrow">↓</span>
            </div>
          </section>

          <!-- 下一屏：先展示抽奖记录 -->
          <section class="wheel-section wheel-history-section">
            <div class="section-header">
              <h2>抽奖记录 (最近{{ drawHistory.length }}条)</h2>
              <button type="button" :disabled="drawHistory.length === 0" @click="clearDrawHistory">清空记录</button>
            </div>
            <div class="history-panel">
              <div v-if="drawHistory.length === 0" class="wheel-empty">暂无抽奖记录，快去转动转盘吧</div>
              <ol v-else class="draw-history-list">
                <li v-for="(result, index) in drawHistory" :key="result.id">
                  <span class="history-index">{{ index + 1 }}</span>
                  <span class="prize-color" :style="{ background: result.color }"></span>
                  <span class="history-name">{{ result.name }}</span>
                  <time>{{ result.timeText }}</time>
                </li>
              </ol>
            </div>
          </section>

          <!-- 下一屏：最后展示奖池信息 -->
          <section class="wheel-section wheel-pool-section">
            <div class="section-header">
              <h2>奖池信息 ({{ activePrizes.length }} 项 / 共 {{ totalQuantity }} 件)</h2>
              <button type="button" :disabled="isSpinning" @click="setView('config')">前往配置</button>
            </div>
            <div class="draw-prize-panel">
              <div v-if="activePrizes.length === 0" class="wheel-empty">奖池已抽空，请前往配置补充</div>
              <div v-else class="draw-prize-list">
                <span v-for="prize in activePrizesWithProb" :key="prize.id" class="draw-prize-chip">
                  <span class="prize-color" :style="{ background: prize.color }"></span>
                  <span>{{ prize.name }}</span>
                  <span class="prize-prob-tag">×{{ prize.quantity }} ({{ prize.prob }}%)</span>
                </span>
              </div>
            </div>
          </section>
        </template>

        <!-- ==================== 2. 配置视图 ==================== -->
        <template v-else>
          <!-- 1. 风格与视觉配置卡片区 -->
          <section class="wheel-section">
            <div class="section-header">
              <h2>🎨 转盘风格与音效设置</h2>
            </div>
            <div class="theme-config-panel">
              <div class="theme-config-grid">
                <div
                  v-for="th in themes"
                  :key="th.id"
                  :class="['theme-config-card', { active: currentTheme === th.id }]"
                  role="button"
                  tabindex="0"
                  @click="setTheme(th.id)"
                >
                  <div class="theme-card-top">
                    <span class="theme-card-preview" :style="{ background: th.dotColor }"></span>
                    <span class="theme-card-badge">{{ currentTheme === th.id ? '当前生效' : th.badge }}</span>
                  </div>
                  <div>
                    <div class="theme-card-title">{{ th.name }}</div>
                    <div class="theme-card-desc">{{ th.desc }}</div>
                  </div>
                </div>
              </div>

              <!-- 物理音效开关 -->
              <div class="sound-toggle-row">
                <div class="sound-toggle-info">
                  <h4>机械转盘音效</h4>
                  <p>真实机械指针卡嗒声与中奖胜利音效</p>
                </div>
                <button
                  :class="['sound-toggle-btn', { muted: isMuted }]"
                  type="button"
                  @click="toggleSound"
                >
                  {{ isMuted ? '已静音 🔇' : '已开启 🔊' }}
                </button>
              </div>
            </div>
          </section>

          <!-- 2. 快捷预设导入栏 -->
          <section class="wheel-section">
            <div class="section-header">
              <h2>📚 常用模板快速载入</h2>
            </div>
            <div class="preset-template-panel">
              <div class="preset-title">
                <span>选择模板一键套用</span>
              </div>
              <div class="preset-chips-scroll">
                <button
                  v-for="preset in presetTemplates"
                  :key="preset.name"
                  class="preset-chip-btn"
                  type="button"
                  @click="applyPreset(preset)"
                >
                  <span class="preset-icon">{{ preset.icon }}</span>
                  <span>{{ preset.name }}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- 3. 奖品增删改配置 -->
          <section class="wheel-section">
            <div class="section-header">
              <h2>🎁 奖品项配置 ({{ visibleConfigPrizes.length }}/{{ maxPrizeKinds }})</h2>
              <div class="config-actions">
                <button v-if="!isEditingConfig" type="button" @click="enterEditConfig">编辑</button>
                <template v-else>
                  <button class="secondary" type="button" @click="cancelEditConfig">取消</button>
                  <button class="primary" type="button" @click="saveConfig">保存</button>
                </template>
              </div>
            </div>

            <div v-if="isEditingConfig" class="prize-form-panel">
              <div class="prize-form-grid">
                <label class="prize-form-field prize-form-name">
                  <span>奖品名称</span>
                  <input
                    v-model.trim="newPrizeName"
                    type="text"
                    maxlength="12"
                    placeholder="输入奖品名称"
                    :disabled="draftPrizes.length >= maxPrizeKinds"
                    @keyup.enter="addPrize"
                  />
                </label>
                <label class="prize-form-field">
                  <span>数量</span>
                  <input
                    v-model="newPrizeQuantity"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    inputmode="numeric"
                    :disabled="draftPrizes.length >= maxPrizeKinds"
                    @keyup.enter="addPrize"
                  />
                </label>
              </div>

              <div class="color-picker-row">
                <button
                  v-for="color in colorOptions"
                  :key="color"
                  :class="['color-swatch', { active: newPrizeColor === color }]"
                  type="button"
                  :style="{ background: color }"
                  :aria-label="'选择颜色 ' + color"
                  :disabled="draftPrizes.length >= maxPrizeKinds"
                  @click="newPrizeColor = color"
                ></button>
                <input
                  v-model="newPrizeColor"
                  class="native-color-input"
                  type="color"
                  aria-label="自定义颜色"
                  :disabled="draftPrizes.length >= maxPrizeKinds"
                />
              </div>

              <button
                class="prize-add-button"
                type="button"
                :disabled="draftPrizes.length >= maxPrizeKinds"
                @click="addPrize"
              >
                添加到奖池
              </button>
            </div>

            <div class="config-prize-list">
              <article v-for="(prize, index) in visibleConfigPrizes" :key="prize.id" class="config-prize-card">
                <template v-if="isEditingConfig">
                  <div class="config-prize-top">
                    <span class="config-prize-swatch" :style="{ background: prize.color }"></span>
                    <input
                      class="config-name-input"
                      :value="prize.name"
                      type="text"
                      maxlength="12"
                      @change="updateDraftPrizeName(index, $event)"
                    />
                    <button
                      class="prize-delete"
                      type="button"
                      :disabled="draftPrizes.length <= 1"
                      @click="deleteDraftPrize(index)"
                    >
                      删除
                    </button>
                  </div>
                  <div class="config-fields">
                    <label>
                      <span>剩余数量</span>
                      <input
                        :value="prize.quantity"
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        inputmode="numeric"
                        @change="updateDraftPrizeQuantity(index, $event)"
                      />
                    </label>
                    <label>
                      <span>扇区颜色</span>
                      <input
                        :value="prize.color"
                        type="color"
                        @input="updateDraftPrizeColor(index, $event)"
                      />
                    </label>
                  </div>
                </template>

                <div v-else class="config-prize-view">
                  <span class="config-prize-swatch" :style="{ background: prize.color }"></span>
                  <div class="config-prize-info">
                    <h3>{{ prize.name }}</h3>
                    <p>剩余 {{ prize.quantity }} 件</p>
                  </div>
                  <span class="config-color-text">{{ prize.color }}</span>
                </div>
              </article>
            </div>

            <div v-if="isEditingConfig" class="config-save-bar">
              <button class="secondary" type="button" @click="resetDraftPrizes">重置默认</button>
              <button type="button" @click="shuffleDraftPrizes">打乱顺序</button>
            </div>
          </section>
        </template>

        <!-- 庆典礼花全屏 Canvas -->
        <canvas ref="confettiCanvas" class="confetti-canvas" v-show="showConfetti"></canvas>

        <!-- 抽奖结果 / 提示 弹窗 -->
        <transition name="modal">
          <div v-if="modal.active" class="wheel-modal-overlay" @click.self="closeModal">
            <div class="wheel-modal-box" role="dialog" aria-modal="true">
              <div class="wheel-modal-banner">
                <span class="wheel-celebration-badge">{{ modal.badge || '🎉' }}</span>
                <h2 class="wheel-modal-title">{{ modal.title }}</h2>
              </div>
              <p v-if="modal.message" class="wheel-modal-message">{{ modal.message }}</p>
              <div v-if="modal.highlight" class="wheel-modal-prize-card">
                <p class="wheel-modal-prize">{{ modal.highlight }}</p>
              </div>
              <div :class="['wheel-modal-actions', { 'single-action': !modal.isWin }]">
                <button v-if="modal.isWin" type="button" @click="spinAgainFromModal">再抽一次</button>
                <button type="button" @click="closeModal">{{ modal.isWin ? '收下奖励' : '知道了' }}</button>
              </div>
            </div>
          </div>
        </transition>
      </section>
    `,
    setup(props, { emit }) {
      const wheelCanvas = ref(null);
      const confettiCanvas = ref(null);

      // 主题状态
      const currentTheme = ref(loadTheme());
      const isMuted = ref(loadSoundMuted());

      const prizes = ref(loadPrizes());
      const draftPrizes = ref(clonePrizes(prizes.value));
      const activeView = ref("draw");
      const isEditingConfig = ref(false);

      const newPrizeName = ref("");
      const newPrizeQuantity = ref(1);
      const newPrizeColor = ref(wheelPalette[0]);

      const currentRotation = ref(0);
      const isSpinning = ref(false);
      const isResettingWheel = ref(false);
      const isMarkerBobbing = ref(false);

      const drawHistory = ref(loadDrawHistory());

      const showConfetti = ref(false);
      let confettiAnimationId = null;

      // 盛典华金风格外圈走马灯
      const marqueeTick = ref(0);
      let marqueeTimer = null;

      const modal = reactive({
        active: false,
        title: "",
        message: "",
        highlight: "",
        badge: "🎉",
        isWin: false,
      });

      let spinTimer = 0;
      let resetTimer = 0;
      let tickAudioTimer = 0;

      // 计算跑马灯灯珠坐标（16颗均匀分布在环周）
      const marqueeDots = computed(() => {
        const dots = [];
        const count = 16;
        for (let i = 0; i < count; i++) {
          const angle = (i * 360) / count;
          const rad = (angle * Math.PI) / 180;
          const r = 50; // 百分比半径
          const x = 50 + r * Math.cos(rad);
          const y = 50 + r * Math.sin(rad);
          dots.push({
            style: {
              left: `${x}%`,
              top: `${y}%`,
            },
          });
        }
        return dots;
      });

      const activePrizes = computed(() =>
        prizes.value.filter((prize) => getPrizeQuantity(prize) > 0)
      );

      const totalQuantity = computed(() =>
        activePrizes.value.reduce((total, prize) => total + getPrizeQuantity(prize), 0)
      );

      const activePrizesWithProb = computed(() => {
        const total = totalQuantity.value;
        return activePrizes.value.map((prize) => {
          const q = getPrizeQuantity(prize);
          const prob = total > 0 ? ((q / total) * 100).toFixed(1) : "0.0";
          return {
            ...prize,
            prob,
          };
        });
      });

      const visibleConfigPrizes = computed(() =>
        isEditingConfig.value ? draftPrizes.value : prizes.value
      );

      function setTheme(themeId) {
        currentTheme.value = themeId;
        localStorage.setItem(themeStorageKey, themeId);
        nextTick(drawWheel);
      }

      function toggleSound() {
        isMuted.value = !isMuted.value;
        localStorage.setItem(soundStorageKey, isMuted.value ? "1" : "0");
      }

      function goHome() {
        emit("go-home");
      }

      function toggleView() {
        setView(activeView.value === "draw" ? "config" : "draw");
      }

      function setView(view) {
        if (isSpinning.value) return;

        if (activeView.value === "config" && isEditingConfig.value && view !== "config") {
          showNotice("请先保存或取消编辑");
          return;
        }

        activeView.value = view;

        if (view === "draw") {
          nextTick(drawWheel);
        }
      }

      // =====================================================================
      // 多风格自适应 Canvas 转盘绘制
      // =====================================================================
      function drawWheel() {
        const canvas = wheelCanvas.value;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const size = canvas.width;
        const radius = size / 2;
        const slices = getWheelSlices();
        const theme = currentTheme.value;

        context.clearRect(0, 0, size, size);

        if (slices.length === 0) {
          drawEmptyWheel(context, radius, theme);
          return;
        }

        // 绘制每个扇区
        slices.forEach((slice) => {
          const startAngle = degreesToRadians(-90 + slice.startDegrees);
          const endAngle = degreesToRadians(-90 + slice.endDegrees);
          const middleAngle = degreesToRadians(-90 + slice.centerDegrees);
          const spanDegrees = slice.endDegrees - slice.startDegrees;

          context.beginPath();
          context.moveTo(radius, radius);
          context.arc(radius, radius, radius - 6, startAngle, endAngle, false);
          context.closePath();

          if (theme === "cyber") {
            const grad = context.createRadialGradient(radius, radius, 30, radius, radius, radius);
            grad.addColorStop(0, slice.prize.color);
            grad.addColorStop(1, adjustColorBrightness(slice.prize.color, -25));
            context.fillStyle = grad;
          } else if (theme === "luxury") {
            const grad = context.createRadialGradient(radius, radius, 40, radius, radius, radius);
            grad.addColorStop(0, slice.prize.color);
            grad.addColorStop(0.9, slice.prize.color);
            grad.addColorStop(1, "#b45309");
            context.fillStyle = grad;
          } else if (theme === "macaron") {
            const grad = context.createRadialGradient(radius, radius, 20, radius, radius, radius);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.2, slice.prize.color);
            grad.addColorStop(1, slice.prize.color);
            context.fillStyle = grad;
          } else {
            context.fillStyle = slice.prize.color;
          }
          context.fill();

          // 扇区边框
          if (theme === "cyber") {
            context.lineWidth = 4;
            context.strokeStyle = "rgba(0, 242, 254, 0.75)";
            context.stroke();
          } else if (theme === "luxury") {
            context.lineWidth = 5;
            context.strokeStyle = "#fef08a";
            context.stroke();
          } else if (theme === "macaron") {
            context.lineWidth = 6;
            context.strokeStyle = "rgba(255, 255, 255, 0.95)";
            context.stroke();
          } else {
            context.lineWidth = 7;
            context.strokeStyle = "#ffffff";
            context.stroke();
          }

          // 扇区奖品文字
          if (spanDegrees >= 10) {
            context.save();
            context.translate(radius, radius);
            context.rotate(middleAngle);
            context.textAlign = "right";
            context.textBaseline = "middle";

            if (theme === "cyber") {
              context.fillStyle = "#ffffff";
              context.shadowColor = "#00f2fe";
              context.shadowBlur = 8;
            } else if (theme === "luxury") {
              context.fillStyle = "#fffbeb";
              context.shadowColor = "rgba(0, 0, 0, 0.6)";
              context.shadowBlur = 6;
            } else {
              context.fillStyle = "#ffffff";
              context.shadowColor = "rgba(17, 24, 39, 0.2)";
              context.shadowBlur = 6;
            }

            const fontSize = getPrizeFontSize(slices.length, spanDegrees);
            context.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif`;
            const textToDraw = trimCanvasText(slice.prize.name, spanDegrees);
            context.fillText(textToDraw, radius - 72, 0);
            context.restore();
          }
        });

        // 绘制中心轴装饰环
        context.beginPath();
        if (theme === "cyber") {
          context.arc(radius, radius, 62, 0, Math.PI * 2);
          context.fillStyle = "#0d1117";
          context.fill();
          context.lineWidth = 6;
          context.strokeStyle = "#00f2fe";
          context.stroke();
        } else if (theme === "luxury") {
          context.arc(radius, radius, 60, 0, Math.PI * 2);
          context.fillStyle = "#92400e";
          context.fill();
          context.lineWidth = 6;
          context.strokeStyle = "#fef08a";
          context.stroke();
        } else if (theme === "macaron") {
          context.arc(radius, radius, 60, 0, Math.PI * 2);
          context.fillStyle = "#fdf2f8";
          context.fill();
          context.lineWidth = 6;
          context.strokeStyle = "#fbcfe8";
          context.stroke();
        } else {
          context.arc(radius, radius, 58, 0, Math.PI * 2);
          context.fillStyle = "#ffffff";
          context.fill();
          context.lineWidth = 8;
          context.strokeStyle = "rgba(255, 255, 255, 0.62)";
          context.stroke();
        }
      }

      // =====================================================================
      // 抽奖旋转逻辑与音效联动
      // =====================================================================
      function spinWheel() {
        if (isSpinning.value) return;

        const slices = getWheelSlices();
        if (slices.length === 0) {
          showNotice("奖池已抽空，请到配置页补充数量");
          return;
        }

        const winnerSlice = pickWinnerSlice(slices);
        const targetRotation = normalizeDegrees(360 - winnerSlice.centerDegrees);
        const currentMod = normalizeDegrees(currentRotation.value);
        const delta = normalizeDegrees(targetRotation - currentMod);
        const fullTurns = 6 + Math.floor(Math.random() * 3);

        isSpinning.value = true;
        currentRotation.value += fullTurns * 360 + delta;

        // 机械指针卡嗒声与轻微晃动
        playTickSeries();

        window.clearTimeout(spinTimer);
        spinTimer = window.setTimeout(() => {
          const winner = prizes.value[winnerSlice.index];
          if (winner) {
            winner.quantity = Math.max(0, getPrizeQuantity(winner) - 1);
            savePrizes(prizes.value);
            draftPrizes.value = clonePrizes(prizes.value);
            recordDrawResult(winner);
            nextTick(drawWheel);

            // 触发胜利音效与五彩礼花
            if (!isMuted.value) {
              playWinSound();
            }
            triggerConfetti();
            showWin(winner.name);
          }
          isSpinning.value = false;
        }, 4200);
      }

      function playTickSeries() {
        let delay = 60;
        let elapsed = 0;
        const totalDuration = 4000;

        function step() {
          if (!isSpinning.value) return;
          if (!isMuted.value) {
            playTickSound();
          }
          isMarkerBobbing.value = true;
          setTimeout(() => {
            isMarkerBobbing.value = false;
          }, 40);

          elapsed += delay;
          if (elapsed < 2000) {
            delay = 80;
          } else if (elapsed < 3200) {
            delay = 140;
          } else if (elapsed < 3800) {
            delay = 240;
          } else {
            delay = 380;
          }

          if (elapsed < totalDuration) {
            tickAudioTimer = setTimeout(step, delay);
          }
        }
        step();
      }

      // =====================================================================
      // 庆典礼花粒子系统 (Confetti Fireworks)
      // =====================================================================
      function triggerConfetti() {
        showConfetti.value = true;
        const canvas = confettiCanvas.value;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext("2d");
        const particles = [];
        const colors = ["#ff0055", "#00f2fe", "#ffcc00", "#34c759", "#af52de", "#ff9500", "#ffffff"];

        for (let i = 0; i < 90; i++) {
          particles.push({
            x: canvas.width / 2,
            y: canvas.height * 0.45,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.7) * 16 - 3,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
            gravity: 0.38,
          });
        }

        let frame = 0;
        function render() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          let alive = 0;

          particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotSpeed;
            p.opacity -= 0.012;

            if (p.opacity > 0) {
              alive++;
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate((p.rotation * Math.PI) / 180);
              ctx.fillStyle = p.color;
              ctx.globalAlpha = Math.max(0, p.opacity);
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
              ctx.restore();
            }
          });

          frame++;
          if (alive > 0 && frame < 120) {
            confettiAnimationId = requestAnimationFrame(render);
          } else {
            showConfetti.value = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        cancelAnimationFrame(confettiAnimationId);
        render();
      }

      // =====================================================================
      // 快捷预设场景载入
      // =====================================================================
      function applyPreset(preset) {
        if (isSpinning.value) return;

        const newPrizes = preset.prizes.map((p, idx) =>
          createPrize(p.name, p.quantity, p.color, idx)
        );

        prizes.value = newPrizes;
        draftPrizes.value = clonePrizes(newPrizes);
        savePrizes(newPrizes);
        resetWheel();
        showNotice(`已切换至【${preset.name}】预设模板`);
      }

      function enterEditConfig() {
        draftPrizes.value = clonePrizes(prizes.value);
        resetNewPrizeForm();
        isEditingConfig.value = true;
      }

      function cancelEditConfig() {
        draftPrizes.value = clonePrizes(prizes.value);
        resetNewPrizeForm();
        isEditingConfig.value = false;
      }

      function saveConfig() {
        const nextPrizes = buildValidDraftPrizes();
        if (!nextPrizes) return;

        prizes.value = nextPrizes;
        draftPrizes.value = clonePrizes(nextPrizes);
        isEditingConfig.value = false;
        resetNewPrizeForm();
        savePrizes(prizes.value);
        resetWheel();
        showNotice("已保存配置");
      }

      function addPrize() {
        if (!isEditingConfig.value) return;

        const name = newPrizeName.value.trim();
        const quantity = clampQuantity(newPrizeQuantity.value, 1);
        const color = normalizeColor(
          newPrizeColor.value,
          wheelPalette[draftPrizes.value.length % wheelPalette.length]
        );

        if (!name) {
          showNotice("奖品名称不能为空");
          return;
        }

        if (draftPrizes.value.some((prize) => prize.name === name)) {
          showNotice("该奖品已存在");
          return;
        }

        if (draftPrizes.value.length >= maxPrizeKinds) {
          showNotice("最多配置 12 个奖品");
          return;
        }

        draftPrizes.value.push(createPrize(name, quantity, color, draftPrizes.value.length));
        resetNewPrizeForm();
      }

      function deleteDraftPrize(index) {
        if (draftPrizes.value.length <= 1) {
          showNotice("至少保留 1 个奖品");
          return;
        }
        draftPrizes.value.splice(index, 1);
      }

      function shuffleDraftPrizes() {
        shuffleList(draftPrizes.value);
      }

      function resetDraftPrizes() {
        draftPrizes.value = buildDefaultPrizes();
        resetNewPrizeForm();
      }

      function updateDraftPrizeName(index, event) {
        const prize = draftPrizes.value[index];
        if (!prize) return;

        const name = event.target.value.trim();
        if (!name) {
          event.target.value = prize.name;
          showNotice("奖品名称不能为空");
          return;
        }

        const duplicated = draftPrizes.value.some(
          (item, itemIndex) => itemIndex !== index && item.name === name
        );
        if (duplicated) {
          event.target.value = prize.name;
          showNotice("该奖品已存在");
          return;
        }

        prize.name = name;
      }

      function updateDraftPrizeQuantity(index, event) {
        const prize = draftPrizes.value[index];
        if (!prize) return;

        const quantity = clampQuantity(event.target.value, 0);
        prize.quantity = quantity;
        event.target.value = quantity;
      }

      function updateDraftPrizeColor(index, event) {
        const prize = draftPrizes.value[index];
        if (!prize) return;

        prize.color = normalizeColor(event.target.value, wheelPalette[index % wheelPalette.length]);
      }

      function buildValidDraftPrizes() {
        const names = [];
        const cleaned = [];

        for (let index = 0; index < draftPrizes.value.length; index += 1) {
          const draft = draftPrizes.value[index];
          const name = String(draft.name || "").trim();

          if (!name) {
            showNotice("奖品名称不能为空");
            return null;
          }

          if (names.includes(name)) {
            showNotice(`奖品“${name}”重复`);
            return null;
          }

          names.push(name);
          cleaned.push(
            createPrize(
              name,
              clampQuantity(draft.quantity, 0),
              normalizeColor(draft.color, wheelPalette[index % wheelPalette.length]),
              index,
              draft.id
            )
          );
        }

        if (cleaned.length === 0) {
          showNotice("至少保留 1 个奖品");
          return null;
        }

        return cleaned;
      }

      function resetNewPrizeForm() {
        newPrizeName.value = "";
        newPrizeQuantity.value = 1;
        newPrizeColor.value = wheelPalette[draftPrizes.value.length % wheelPalette.length] || wheelPalette[0];
      }

      function recordDrawResult(prize) {
        const result = {
          id: `result-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: prize.name,
          color: prize.color,
          timestamp: Date.now(),
          timeText: formatHistoryTime(Date.now()),
        };

        drawHistory.value = [result, ...drawHistory.value].slice(0, maxHistoryCount);
        saveDrawHistory(drawHistory.value);
      }

      function clearDrawHistory() {
        drawHistory.value = [];
        localStorage.removeItem(historyStorageKey);
      }

      function resetWheel() {
        window.clearTimeout(resetTimer);
        isResettingWheel.value = true;
        currentRotation.value = 0;

        nextTick(() => {
          drawWheel();
          resetTimer = window.setTimeout(() => {
            isResettingWheel.value = false;
          }, 80);
        });
      }

      function getWheelSlices() {
        const activeItems = [];
        let cursor = 0;

        prizes.value.forEach((prize, index) => {
          const quantity = getPrizeQuantity(prize);
          if (quantity > 0) {
            activeItems.push({ index, prize, quantity });
          }
        });

        if (activeItems.length === 0) return [];

        const spanDegrees = 360 / activeItems.length;

        return activeItems.map((item) => {
          const slice = {
            index: item.index,
            prize: item.prize,
            quantity: item.quantity,
            startDegrees: cursor,
            endDegrees: cursor + spanDegrees,
            centerDegrees: cursor + spanDegrees / 2,
          };
          cursor += spanDegrees;
          return slice;
        });
      }

      function pickWinnerSlice(slices) {
        const total = slices.reduce((sum, slice) => sum + slice.quantity, 0);
        let ticket = Math.floor(Math.random() * total) + 1;

        for (let index = 0; index < slices.length; index += 1) {
          ticket -= slices[index].quantity;
          if (ticket <= 0) return slices[index];
        }

        return slices[slices.length - 1];
      }

      function showWin(prizeName) {
        modal.title = "恭喜中奖！";
        modal.message = "幸运眷顾，您抽中了：";
        modal.highlight = prizeName;
        modal.badge = "🎉";
        modal.isWin = true;
        modal.active = true;
      }

      function showNotice(message) {
        modal.title = "提示";
        modal.message = message;
        modal.highlight = "";
        modal.badge = "💡";
        modal.isWin = false;
        modal.active = true;
      }

      function closeModal() {
        modal.active = false;
        showConfetti.value = false;
      }

      function spinAgainFromModal() {
        closeModal();
        setTimeout(() => {
          spinWheel();
        }, 150);
      }

      onMounted(() => {
        nextTick(drawWheel);
        marqueeTimer = setInterval(() => {
          marqueeTick.value = (marqueeTick.value + 1) % 2;
        }, 400);
      });

      onBeforeUnmount(() => {
        window.clearTimeout(spinTimer);
        window.clearTimeout(resetTimer);
        window.clearTimeout(tickAudioTimer);
        if (marqueeTimer) clearInterval(marqueeTimer);
        if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
      });

      return {
        activePrizes,
        activePrizesWithProb,
        activeView,
        addPrize,
        applyPreset,
        cancelEditConfig,
        clearDrawHistory,
        closeModal,
        colorOptions: wheelPalette,
        confettiCanvas,
        currentRotation,
        currentTheme,
        deleteDraftPrize,
        draftPrizes,
        drawHistory,
        enterEditConfig,
        goHome,
        isEditingConfig,
        isMarkerBobbing,
        isMuted,
        isResettingWheel,
        isSpinning,
        marqueeDots,
        marqueeTick,
        maxPrizeKinds,
        modal,
        newPrizeColor,
        newPrizeName,
        newPrizeQuantity,
        presetTemplates,
        prizes,
        resetDraftPrizes,
        saveConfig,
        setTheme,
        setView,
        showConfetti,
        shuffleDraftPrizes,
        spinAgainFromModal,
        spinWheel,
        themes,
        toggleSound,
        toggleView,
        totalQuantity,
        updateDraftPrizeColor,
        updateDraftPrizeName,
        updateDraftPrizeQuantity,
        visibleConfigPrizes,
        wheelCanvas,
      };
    },
  };

  // =========================================================================
  // Storage & Helper Utilities
  // =========================================================================
  function loadTheme() {
    return localStorage.getItem(themeStorageKey) || "classic";
  }

  function loadSoundMuted() {
    return localStorage.getItem(soundStorageKey) === "1";
  }

  function loadPrizes() {
    const fromStorage = readPrizeStorage(storageKey) || readPrizeStorage(legacyStorageKey);
    return fromStorage || buildDefaultPrizes();
  }

  function readPrizeStorage(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (!Array.isArray(parsed)) return null;

      const prizes = parsed
        .map((item, index) => normalizePrize(item, index))
        .filter(Boolean)
        .filter((prize, index, list) => list.findIndex((item) => item.name === prize.name) === index)
        .slice(0, maxPrizeKinds);

      return prizes.length > 0 ? prizes : null;
    } catch (error) {
      return null;
    }
  }

  function loadDrawHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map(normalizeHistoryItem)
        .filter(Boolean)
        .slice(0, maxHistoryCount);
    } catch (error) {
      return [];
    }
  }

  function normalizeHistoryItem(item) {
    if (!item || typeof item !== "object") return null;

    const name = String(item.name || "").trim();
    const timestamp = Number(item.timestamp) || Date.now();
    const color = normalizeColor(item.color, wheelPalette[0]);

    if (!name) return null;

    return {
      id: item.id || `result-${timestamp}-${Math.random().toString(16).slice(2)}`,
      name,
      color,
      timestamp,
      timeText: item.timeText || formatHistoryTime(timestamp),
    };
  }

  function normalizePrize(item, index) {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? createPrize(name, 1, wheelPalette[index % wheelPalette.length], index) : null;
    }

    if (!item || typeof item !== "object") return null;

    const name = String(item.name || "").trim();
    if (!name) return null;

    return createPrize(
      name,
      clampQuantity(item.quantity, 0),
      normalizeColor(item.color, wheelPalette[index % wheelPalette.length]),
      index,
      item.id
    );
  }

  function buildDefaultPrizes() {
    return defaultPrizeConfigs.map((prize, index) =>
      createPrize(prize.name, prize.quantity, prize.color, index)
    );
  }

  function clonePrizes(prizes) {
    return prizes.map((prize, index) =>
      createPrize(prize.name, prize.quantity, prize.color, index, prize.id)
    );
  }

  function createPrize(name, quantity, color, index, id) {
    return {
      id: id || `prize-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      name,
      quantity: clampQuantity(quantity, 0),
      color: normalizeColor(color, wheelPalette[index % wheelPalette.length]),
    };
  }

  function savePrizes(prizes) {
    const payload = prizes.map((prize, index) =>
      createPrize(
        String(prize.name || "").trim() || `奖品${index + 1}`,
        clampQuantity(prize.quantity, 0),
        normalizeColor(prize.color, wheelPalette[index % wheelPalette.length]),
        index,
        prize.id
      )
    );
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function saveDrawHistory(history) {
    localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, maxHistoryCount)));
  }

  function shuffleList(list) {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const currentItem = list[index];
      list[index] = list[randomIndex];
      list[randomIndex] = currentItem;
    }
  }

  function clampQuantity(value, minValue) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return minValue;
    return Math.min(maxQuantity, Math.max(minValue, number));
  }

  function getPrizeQuantity(prize) {
    return clampQuantity(prize.quantity, 0);
  }

  function normalizeColor(color, fallback) {
    const value = String(color || "").trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function adjustColorBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function drawEmptyWheel(context, radius, theme) {
    context.beginPath();
    context.arc(radius, radius, radius - 6, 0, Math.PI * 2);
    if (theme === "cyber") {
      context.fillStyle = "#161b22";
      context.strokeStyle = "#00f2fe";
    } else if (theme === "luxury") {
      context.fillStyle = "#fef3c7";
      context.strokeStyle = "#d97706";
    } else {
      context.fillStyle = "#d9dee8";
      context.strokeStyle = "#ffffff";
    }
    context.fill();
    context.lineWidth = 7;
    context.stroke();

    context.fillStyle = theme === "cyber" ? "#58a6ff" : "#687083";
    context.font = '800 34px -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("奖池已空", radius, radius);
  }

  function formatHistoryTime(timestamp) {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${month}/${day} ${hour}:${minute}`;
  }

  function getPrizeFontSize(sliceCount, spanDegrees) {
    if (spanDegrees < 18) return 20;
    if (sliceCount >= 10) return 24;
    if (sliceCount >= 7) return 28;
    return 34;
  }

  function trimCanvasText(text, spanDegrees) {
    const maxLength = spanDegrees < 18 ? 4 : spanDegrees < 32 ? 6 : 8;
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }
})(window);
