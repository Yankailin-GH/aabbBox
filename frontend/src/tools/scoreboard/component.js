(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, reactive, ref } = global.Vue;
  const scoreStorageKey = "cardScoreDataiOS";
  const scorePalette = [
    "#007AFF",
    "#FF9500",
    "#AF52DE",
    "#5856D6",
    "#5AC8FA",
    "#FF2D55",
    "#E6C400",
    "#A2845E",
  ];

  global.ScoreboardTool = {
    name: "ScoreboardTool",
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
          <div class="status-row" aria-hidden="true">
            <span>9:41</span>
            <span class="status-icons">
              <span class="signal-icon">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </span>
              <span class="wifi-icon"></span>
              <span class="battery-icon"></span>
            </span>
          </div>

          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome">
              <span class="back-icon"></span>
            </button>
            <div class="tool-title">
              <p class="eyebrow">{{ tool.category }}</p>
              <h1>{{ tool.name }}</h1>
            </div>
            <button class="text-action danger" type="button" @click="clearScoreData">清除</button>
          </section>
        </header>

        <section class="score-overview" aria-label="计分概览">
          <div>
            <span>{{ scoreState.players.length }}</span>
            <p>玩家</p>
          </div>
          <div>
            <span>{{ scoreState.rounds.length }}</span>
            <p>局数</p>
          </div>
          <div>
            <span>第 {{ scoreState.rounds.length + 1 }} 局</span>
            <p>本局</p>
          </div>
        </section>

        <section class="score-section">
          <div class="section-header">
            <h2>战绩大厅</h2>
          </div>
          <div class="score-panel">
            <div class="score-table-wrap">
              <table class="score-table" :style="scoreTableStyle">
                <thead v-if="scoreState.players.length > 0">
                  <tr class="name-row">
                    <th>轮次</th>
                    <th
                      v-for="player in scoreState.players"
                      :key="player.id"
                      class="editable-score-name"
                      :style="{ color: player.color }"
                      @pointerdown="startNamePress(player.id)"
                      @pointermove="cancelNamePress"
                      @pointerup="cancelNamePress"
                      @pointercancel="cancelNamePress"
                      @pointerleave="cancelNamePress"
                      @touchstart="startNamePress(player.id)"
                      @touchmove="cancelNamePress"
                      @touchend="cancelNamePress"
                      @touchcancel="cancelNamePress"
                      @contextmenu.prevent
                    >
                      {{ player.name }}
                    </th>
                  </tr>
                  <tr class="total-row">
                    <th>总分</th>
                    <th
                      v-for="player in scoreState.players"
                      :key="player.id"
                      :class="getScoreClass(player.total)"
                    >
                      {{ formatScore(player.total) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="scoreState.players.length === 0">
                    <td class="empty-tip">暂无玩家，请在下方添加</td>
                  </tr>
                  <tr v-else-if="scoreState.rounds.length === 0">
                    <td :colspan="scoreState.players.length + 1" class="empty-tip">暂无对局记录</td>
                  </tr>
                  <template v-else>
                    <tr v-for="round in reversedRounds" :key="round.roundNum">
                      <td>第 {{ round.roundNum }} 局</td>
                      <td
                        v-for="player in scoreState.players"
                        :key="player.id"
                        :class="getScoreClass(round.scores[player.id] || 0)"
                      >
                        {{ formatScore(round.scores[player.id] || 0) }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="scoreState.players.length > 0" class="score-section">
          <div class="section-header">
            <h2>记录本局分数</h2>
          </div>
          <div class="score-input-panel">
            <div
              v-for="(player, index) in scoreState.players"
              :key="player.id"
              :class="['score-form-row', { 'auto-target': isAutoTarget(player.id) }]"
            >
              <div class="score-player-label" :style="{ color: player.color }">
                <span>{{ player.name }}</span>
                <small v-if="isAutoTarget(player.id)">赢家自动</small>
              </div>
              <button
                :class="['score-toggle', getDraftSign(player.id) === 1 ? 'win' : 'lose']"
                type="button"
                @click="toggleSign(player.id)"
              >
                {{ getDraftSign(player.id) === 1 ? '胜' : '负' }}
              </button>
              <input
                :value="getDraftValue(player.id)"
                type="number"
                inputmode="decimal"
                :disabled="isAutoTarget(player.id)"
                placeholder="0"
                @input="updateScoreInput(player.id, $event.target.value)"
              />
            </div>
          </div>
          <button class="submit-score-btn" type="button" @click="submitRound">确认提交</button>
        </section>

        <section class="score-section">
          <div class="section-header">
            <h2>添加玩家</h2>
          </div>
          <div class="add-player-panel">
            <input
              v-model.trim="newPlayerName"
              type="text"
              maxlength="8"
              placeholder="输入玩家名字"
              @keyup.enter="addPlayer"
            />
            <button type="button" @click="addPlayer">添加</button>
          </div>
        </section>

        <transition name="modal">
          <div v-if="modal.active" class="score-modal-overlay">
            <div class="score-modal-box" role="dialog" aria-modal="true">
              <h2 class="score-modal-title">{{ modal.title }}</h2>
              <p v-if="modal.message" class="score-modal-message">{{ modal.message }}</p>
              <div v-if="modal.type === 'prompt'" class="score-modal-input-wrap">
                <input ref="modalInput" v-model="modal.input" class="score-modal-input" type="text" />
              </div>
              <div class="score-modal-actions">
                <button
                  v-if="modal.type === 'confirm' || modal.type === 'prompt'"
                  type="button"
                  @click="closeModal(null)"
                >
                  {{ modal.cancelText }}
                </button>
                <button
                  :class="{ danger: modal.danger }"
                  type="button"
                  @click="confirmModal"
                >
                  {{ modal.confirmText }}
                </button>
              </div>
            </div>
          </div>
        </transition>
      </section>
    `,
    setup(props, { emit }) {
      const scoreState = reactive({ players: [], rounds: [] });
      const scoreDraft = reactive({});
      const newPlayerName = ref("");
      const modalInput = ref(null);
      const modal = reactive({
        active: false,
        type: "alert",
        title: "提示",
        message: "",
        input: "",
        confirmText: "确定",
        cancelText: "取消",
        danger: false,
        resolver: null,
      });

      initScoreboard();

      const reversedRounds = computed(() => scoreState.rounds.slice().reverse());
      const scoreTableStyle = computed(() => {
        const columns = scoreState.players.length + 1;
        return {
          minWidth: columns > 7 ? `${columns * 56}px` : "100%",
        };
      });
      let namePressTimer = 0;

      function goHome() {
        emit("go-home");
      }

      function initScoreboard() {
        const saved = localStorage.getItem(scoreStorageKey);

        if (saved) {
          try {
            const savedState = JSON.parse(saved);
            scoreState.players.splice(0, scoreState.players.length, ...(savedState.players || []));
            scoreState.rounds.splice(0, scoreState.rounds.length, ...(savedState.rounds || []));
            scoreState.players.forEach((player, index) => {
              if (!player.color || player.color === "#e53935" || player.color === "#43a047") {
                player.color = scorePalette[index % scorePalette.length];
              }
            });
          } catch (error) {
            scoreState.players.splice(0);
            scoreState.rounds.splice(0);
          }
        }

        resetScoreDraft();
      }

      function saveScoreData() {
        localStorage.setItem(scoreStorageKey, JSON.stringify(scoreState));
      }

      async function addPlayer() {
        const name = newPlayerName.value.trim();
        if (!name) return await UI.alert("请输入玩家名字！");
        if (scoreState.players.find((player) => player.name === name)) {
          return await UI.alert("玩家名字已存在！");
        }

        const colorIndex = scoreState.players.length % scorePalette.length;
        const player = {
          id: "p_" + Date.now(),
          name,
          total: 0,
          color: scorePalette[colorIndex],
        };

        scoreState.players.push(player);
        resetScoreDraft();
        newPlayerName.value = "";
        saveScoreData();
        await nextTick();
        autoCalculateWinners();
      }

      async function editPlayerName(id) {
        const player = scoreState.players.find((item) => item.id === id);
        if (!player) return;

        const newName = await UI.prompt("修改玩家名字", player.name);

        if (newName !== null && newName.trim() !== "") {
          if (scoreState.players.find((item) => item.name === newName.trim() && item.id !== id)) {
            return await UI.alert("玩家名字已存在！");
          }

          player.name = newName.trim();
          saveScoreData();
        }
      }

      function toggleSign(id) {
        const draft = ensureScoreDraft(id);

        if (draft.sign === 1) {
          const winners = getWinnerIds();

          if (scoreState.players.length > 1 && winners.length === 1) {
            UI.alert("至少保留一个赢家");
            return;
          }

          draft.sign = -1;
          draft.value = "";
        } else {
          draft.sign = 1;
          draft.value = "";
        }

        if (scoreState.players.length > 1) {
          autoCalculateWinners();
          return;
        }

        draft.sign = draft.sign === 1 ? 1 : -1;
      }

      function updateScoreInput(id, value) {
        if (isAutoTarget(id)) return;

        ensureScoreDraft(id).value = value;
        onScoreInput(id);
      }

      function onScoreInput(id) {
        if (scoreState.players.length > 1 && !isAutoTarget(id)) {
          autoCalculateWinners();
        }
      }

      function autoCalculateWinners() {
        if (scoreState.players.length < 2) return;

        ensureWinners();
        const autoWinnerId = getAutoWinnerId();
        if (!autoWinnerId) return;

        let sumOtherPlayers = 0;
        let hasInput = false;

        scoreState.players.forEach((player) => {
          if (player.id === autoWinnerId) return;

          const draft = ensureScoreDraft(player.id);

          if (draft.value !== "") hasInput = true;

          const val = Math.abs(parseFloat(draft.value) || 0);
          const sign = parseInt(draft.sign, 10);
          sumOtherPlayers += val * sign;
        });

        const targetScore = -sumOtherPlayers;
        const autoDraft = ensureScoreDraft(autoWinnerId);

        autoDraft.value = targetScore === 0 && !hasInput ? "" : String(targetScore);
        autoDraft.sign = 1;
      }

      async function submitRound() {
        const roundScores = {};
        const scoreChanges = [];
        let hasInput = false;

        autoCalculateWinners();

        scoreState.players.forEach((player) => {
          const draft = ensureScoreDraft(player.id);
          const valStr = draft.value;
          let finalScore = 0;

          if (isAutoTarget(player.id)) {
            finalScore = parseFloat(valStr) || 0;
          } else {
            const val = Math.abs(parseFloat(valStr) || 0);
            const sign = getDraftSign(player.id);
            finalScore = val * sign;

            if (valStr !== "") hasInput = true;
          }

          scoreChanges.push({ player, finalScore });

          roundScores[player.id] = finalScore;
        });

        if (!hasInput) return await UI.alert("请至少输入一个分数！");

        const autoWinnerId = getAutoWinnerId();
        if (autoWinnerId && roundScores[autoWinnerId] < 0) {
          return await UI.alert("最后一位赢家分数为负，请调整其他赢家或输家的分数");
        }

        scoreChanges.forEach(({ player, finalScore }) => {
          player.total += finalScore;
        });

        scoreState.rounds.push({
          roundNum: scoreState.rounds.length + 1,
          scores: roundScores,
        });

        saveScoreData();
        resetScoreDraft();
        await nextTick();
        autoCalculateWinners();
      }

      async function clearScoreData() {
        if (scoreState.players.length === 0 && scoreState.rounds.length === 0) return;

        const isConfirm = await UI.confirm("清除数据", "确认清除全部计分，重新开局", "确认清除");

        if (isConfirm) {
          scoreState.players.splice(0);
          scoreState.rounds.splice(0);
          resetScoreDraft();
          saveScoreData();
        }
      }

      function resetScoreDraft() {
        Object.keys(scoreDraft).forEach((key) => {
          delete scoreDraft[key];
        });

        scoreState.players.forEach((player) => {
          scoreDraft[player.id] = {
            value: "",
            sign:
              scoreState.players.length > 1 &&
              player.id === scoreState.players[scoreState.players.length - 1].id
                ? 1
                : -1,
          };
        });
      }

      function ensureScoreDraft(id) {
        if (!scoreDraft[id]) {
          scoreDraft[id] = { value: "", sign: -1 };
        }

        return scoreDraft[id];
      }

      function getDraftSign(id) {
        return ensureScoreDraft(id).sign;
      }

      function getDraftValue(id) {
        return ensureScoreDraft(id).value || "";
      }

      function ensureWinners() {
        if (scoreState.players.length === 0) return;
        if (getWinnerIds().length > 0) return;

        const lastPlayer = scoreState.players[scoreState.players.length - 1];
        if (lastPlayer) {
          ensureScoreDraft(lastPlayer.id).sign = 1;
        }
      }

      function isAutoTarget(id) {
        return scoreState.players.length > 1 && id === getAutoWinnerId();
      }

      function getWinnerIds() {
        return scoreState.players
          .filter((player) => ensureScoreDraft(player.id).sign === 1)
          .map((player) => player.id);
      }

      function getAutoWinnerId() {
        const winners = getWinnerIds();
        return winners.length > 0 ? winners[winners.length - 1] : "";
      }

      function startNamePress(id) {
        if (modal.active) return;

        cancelNamePress();
        namePressTimer = window.setTimeout(() => {
          namePressTimer = 0;
          editPlayerName(id);
        }, 560);
      }

      function cancelNamePress() {
        if (!namePressTimer) return;

        window.clearTimeout(namePressTimer);
        namePressTimer = 0;
      }

      onBeforeUnmount(cancelNamePress);

      function getScoreClass(score) {
        if (score > 0) return "score positive";
        if (score < 0) return "score negative";
        return "score";
      }

      function formatScore(score) {
        return score > 0 ? "+" + score : score;
      }

      function showModal({
        type,
        title,
        message,
        defaultValue,
        confirmText = "确定",
        cancelText = "取消",
        danger = false,
      }) {
        return new Promise((resolve) => {
          modal.type = type;
          modal.title = title || "提示";
          modal.message = message || "";
          modal.input = defaultValue || "";
          modal.confirmText = confirmText;
          modal.cancelText = cancelText;
          modal.danger = danger;
          modal.resolver = resolve;
          modal.active = true;

          if (type === "prompt") {
            nextTick(() => {
              window.setTimeout(() => {
                if (modalInput.value) modalInput.value.focus();
              }, 50);
            });
          }
        });
      }

      function closeModal(result) {
        const resolver = modal.resolver;
        modal.active = false;
        modal.resolver = null;
        window.setTimeout(() => {
          if (resolver) resolver(result);
        }, 200);
      }

      function confirmModal() {
        if (modal.type === "prompt") {
          closeModal(modal.input);
          return;
        }

        closeModal(true);
      }

      const UI = {
        alert: (msg) => showModal({ type: "alert", title: "提示", message: msg }),
        confirm: (title, msg, confirmText) =>
          showModal({
            type: "confirm",
            title,
            message: msg,
            danger: true,
            confirmText: confirmText || "确认",
          }),
        prompt: (title, defaultValue) => showModal({ type: "prompt", title, defaultValue }),
      };

      return {
        addPlayer,
        clearScoreData,
        closeModal,
        confirmModal,
        editPlayerName,
        formatScore,
        getDraftSign,
        getDraftValue,
        getScoreClass,
        goHome,
        isAutoTarget,
        modal,
        modalInput,
        newPlayerName,
        reversedRounds,
        scoreTableStyle,
        scoreDraft,
        scoreState,
        startNamePress,
        cancelNamePress,
        submitRound,
        toggleSign,
        updateScoreInput,
      };
    },
  };
})(window);
