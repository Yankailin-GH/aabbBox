(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } = global.Vue;
  const storageKey = "aabb-toolbox-lucky-wheel-prizes";
  const historyStorageKey = "aabb-toolbox-lucky-wheel-history";
  const legacyStorageKey = "lotteryPrizes";
  const maxPrizeKinds = 12;
  const maxQuantity = 10000;
  const maxHistoryCount = 10;
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
            <button class="text-action" type="button" :disabled="isSpinning" @click="toggleView">
              {{ activeView === 'draw' ? '配置' : '抽奖' }}
            </button>
          </section>
        </header>

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

        <template v-if="activeView === 'draw'">
          <section class="wheel-hero">
            <div class="wheel-stage" aria-label="幸运转盘">
              <div class="wheel-wrap">
                <span class="wheel-marker" aria-hidden="true"></span>
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
          </section>

          <section class="wheel-section">
            <div class="section-header">
              <h2>奖池</h2>
              <button type="button" :disabled="isSpinning" @click="setView('config')">配置</button>
            </div>
            <div class="draw-prize-panel">
              <div v-if="activePrizes.length === 0" class="wheel-empty">奖池已抽空</div>
              <div v-else class="draw-prize-list">
                <span v-for="prize in activePrizes" :key="prize.id" class="draw-prize-chip">
                  <span class="prize-color" :style="{ background: prize.color }"></span>
                  <span>{{ prize.name }}</span>
                </span>
              </div>
            </div>
          </section>

          <section class="wheel-section">
            <div class="section-header">
              <h2>最近10次结果</h2>
              <button type="button" :disabled="drawHistory.length === 0" @click="clearDrawHistory">清空</button>
            </div>
            <div class="history-panel">
              <div v-if="drawHistory.length === 0" class="wheel-empty">暂无抽奖记录</div>
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
        </template>

        <template v-else>
          <section class="wheel-section">
            <div class="section-header">
              <h2>奖品配置</h2>
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
                  <span>奖品</span>
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
                      <span>剩余</span>
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
                      <span>颜色</span>
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
                    <p>剩余 {{ prize.quantity }}</p>
                  </div>
                  <span class="config-color-text">{{ prize.color }}</span>
                </div>
              </article>
            </div>

            <div v-if="isEditingConfig" class="config-save-bar">
              <button class="secondary" type="button" @click="resetDraftPrizes">重置默认</button>
              <button type="button" @click="shuffleDraftPrizes">打乱</button>
            </div>
          </section>
        </template>

        <transition name="modal">
          <div v-if="modal.active" class="wheel-modal-overlay">
            <div class="wheel-modal-box" role="dialog" aria-modal="true">
              <h2 class="wheel-modal-title">{{ modal.title }}</h2>
              <p v-if="modal.message" class="wheel-modal-message">{{ modal.message }}</p>
              <p v-if="modal.highlight" class="wheel-modal-prize">{{ modal.highlight }}</p>
              <div class="wheel-modal-actions">
                <button type="button" @click="closeModal">知道了</button>
              </div>
            </div>
          </div>
        </transition>
      </section>
    `,
    setup(props, { emit }) {
      const wheelCanvas = ref(null);
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
      const drawHistory = ref(loadDrawHistory());
      const modal = reactive({
        active: false,
        title: "",
        message: "",
        highlight: "",
      });
      let spinTimer = 0;
      let resetTimer = 0;

      const activePrizes = computed(() =>
        prizes.value.filter((prize) => getPrizeQuantity(prize) > 0)
      );

      const totalQuantity = computed(() =>
        activePrizes.value.reduce((total, prize) => total + getPrizeQuantity(prize), 0)
      );

      const visibleConfigPrizes = computed(() =>
        isEditingConfig.value ? draftPrizes.value : prizes.value
      );

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

      function drawWheel() {
        const canvas = wheelCanvas.value;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const size = canvas.width;
        const radius = size / 2;
        const slices = getWheelSlices();

        context.clearRect(0, 0, size, size);

        if (slices.length === 0) {
          drawEmptyWheel(context, radius);
          return;
        }

        slices.forEach((slice) => {
          const startAngle = degreesToRadians(-90 + slice.startDegrees);
          const endAngle = degreesToRadians(-90 + slice.endDegrees);
          const middleAngle = degreesToRadians(-90 + slice.centerDegrees);
          const spanDegrees = slice.endDegrees - slice.startDegrees;

          context.beginPath();
          context.moveTo(radius, radius);
          context.arc(radius, radius, radius - 6, startAngle, endAngle, false);
          context.closePath();
          context.fillStyle = slice.prize.color;
          context.fill();

          context.lineWidth = 7;
          context.strokeStyle = "#ffffff";
          context.stroke();

          if (spanDegrees >= 10) {
            context.save();
            context.translate(radius, radius);
            context.rotate(middleAngle);
            context.textAlign = "right";
            context.textBaseline = "middle";
            context.fillStyle = "#ffffff";
            context.shadowColor = "rgba(17, 24, 39, 0.18)";
            context.shadowBlur = 7;
            context.font = `800 ${getPrizeFontSize(slices.length, spanDegrees)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial`;
            context.fillText(trimCanvasText(slice.prize.name, spanDegrees), radius - 72, 0);
            context.restore();
          }
        });

        context.beginPath();
        context.arc(radius, radius, 58, 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
        context.lineWidth = 8;
        context.strokeStyle = "rgba(255, 255, 255, 0.62)";
        context.stroke();
      }

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

        window.clearTimeout(spinTimer);
        spinTimer = window.setTimeout(() => {
          const winner = prizes.value[winnerSlice.index];
          if (winner) {
            winner.quantity = Math.max(0, getPrizeQuantity(winner) - 1);
            savePrizes(prizes.value);
            draftPrizes.value = clonePrizes(prizes.value);
            recordDrawResult(winner);
            nextTick(drawWheel);
            showWin(winner.name);
          }
          isSpinning.value = false;
        }, 4200);
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
        modal.title = "抽奖结果";
        modal.message = "恭喜抽中";
        modal.highlight = prizeName;
        modal.active = true;
      }

      function showNotice(message) {
        modal.title = "提示";
        modal.message = message;
        modal.highlight = "";
        modal.active = true;
      }

      function closeModal() {
        modal.active = false;
      }

      onMounted(() => {
        nextTick(drawWheel);
      });

      onBeforeUnmount(() => {
        window.clearTimeout(spinTimer);
        window.clearTimeout(resetTimer);
      });

      return {
        activePrizes,
        activeView,
        addPrize,
        cancelEditConfig,
        clearDrawHistory,
        closeModal,
        colorOptions: wheelPalette,
        currentRotation,
        deleteDraftPrize,
        draftPrizes,
        drawHistory,
        enterEditConfig,
        goHome,
        isEditingConfig,
        isResettingWheel,
        isSpinning,
        maxPrizeKinds,
        modal,
        newPrizeColor,
        newPrizeName,
        newPrizeQuantity,
        prizes,
        resetDraftPrizes,
        saveConfig,
        setView,
        shuffleDraftPrizes,
        spinWheel,
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

  function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function drawEmptyWheel(context, radius) {
    context.beginPath();
    context.arc(radius, radius, radius - 6, 0, Math.PI * 2);
    context.fillStyle = "#d9dee8";
    context.fill();
    context.lineWidth = 7;
    context.strokeStyle = "#ffffff";
    context.stroke();

    context.fillStyle = "#687083";
    context.font = '800 34px -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial';
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
