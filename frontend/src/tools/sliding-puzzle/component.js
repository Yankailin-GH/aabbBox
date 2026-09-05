(function (global) {
  if (!global.Vue) return;

  const { computed, nextTick, onBeforeUnmount, onMounted, ref } = global.Vue;
  const bestStorageKey = "aabb-toolbox-sliding-puzzle-best";

  global.SlidingPuzzleTool = {
    name: "SlidingPuzzleTool",
    props: {
      tool: {
        type: Object,
        required: true,
      },
    },
    emits: ["go-home"],
    template: `
      <section class="sliding-puzzle-page">
        <header class="app-header tool-header puzzle-header">
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

        <section class="puzzle-launch-card">
          <div class="puzzle-launch-visual" aria-hidden="true">
            <div class="puzzle-level-preview">
              <span>1</span><span>2</span><span>3</span>
              <span>4</span><span>5</span><span>6</span>
              <span>7</span><span>8</span><i></i>
            </div>
            <span>01</span>
          </div>
          <p class="puzzle-launch-kicker">单机 · 数字益智 · 计时挑战</p>
          <h2>数字华容道</h2>
          <p>按顺序复原数字棋盘。从 3 × 3 入门关卡开始，也可以直接挑战更大的棋盘。</p>
          <div class="puzzle-launch-tags">
            <span>八档关卡</span><span>最佳记录</span><span>保证可解</span>
          </div>
          <button class="puzzle-launch-button" type="button" @click="openGame">进入游戏</button>
        </section>

        <section v-if="playing" class="puzzle-fullscreen">
          <div class="puzzle-game-frame">
            <header class="puzzle-game-header">
              <div>
                <p>数字华容道</p>
                <strong>{{ hasSelectedSize ? '第 ' + (size - 2) + ' 关 · ' + size + ' × ' + size : '选择关卡' }}</strong>
              </div>
              <div class="puzzle-game-actions">
                <button
                  v-if="hasSelectedSize"
                  class="puzzle-reset-button"
                  type="button"
                  aria-label="重新开始"
                  title="重新开始"
                  @click="newGame"
                >
                  <span class="puzzle-reset-icon" aria-hidden="true"></span>
                </button>
                <button class="puzzle-exit-button" type="button" aria-label="退出游戏" @click="closeGame">
                  <span aria-hidden="true"></span>
                </button>
              </div>
            </header>

            <main class="sliding-puzzle-main">
          <section v-if="!hasSelectedSize" class="puzzle-level-select" aria-labelledby="level-select-title">
            <div class="puzzle-level-copy">
              <p class="puzzle-kicker">准备出发</p>
              <h2 id="level-select-title" ref="levelHeading" tabindex="-1">选择挑战关卡</h2>
              <p>所有关卡均可直接挑战，数字越多，复原路线越复杂。</p>
            </div>
            <div class="puzzle-level-grid" aria-label="选择关卡">
              <button
                v-for="option in sizes"
                :key="option"
                type="button"
                @click="startGame(option)"
              >
                <span class="puzzle-level-size">{{ option - 2 }}<small>第 {{ option - 2 }} 关</small></span>
                <span class="puzzle-level-meta">
                  <strong>{{ option }} × {{ option }}</strong>
                  <small>{{ difficultyName(option) }} · {{ option * option - 1 }} 格</small>
                </span>
                <span class="puzzle-level-arrow" aria-hidden="true"></span>
              </button>
            </div>
          </section>

          <template v-else>
            <section class="puzzle-intro" aria-labelledby="puzzle-heading">
              <div>
                <p class="puzzle-kicker">第 {{ size - 2 }} 关 · {{ size }} × {{ size }}</p>
                <h2 id="puzzle-heading" ref="gameHeading" tabindex="-1">把数字送回正确的位置</h2>
              </div>
              <span :class="['puzzle-state', { running: isRunning, complete: isComplete }]">
                {{ stateLabel }}
              </span>
            </section>

            <section class="puzzle-stats" aria-label="本局数据">
              <div>
                <span class="puzzle-stat-value">{{ formattedTime }}</span>
                <small>用时</small>
              </div>
              <div>
                <span class="puzzle-stat-value">{{ moves }}</span>
                <small>步数</small>
              </div>
              <div>
                <span class="puzzle-stat-value best-value">{{ bestLabel }}</span>
                <small>最佳</small>
              </div>
            </section>

            <section class="puzzle-board-wrap">
              <TransitionGroup
                tag="div"
                name="puzzle"
                class="puzzle-board"
                :class="boardSizeClass"
                :style="boardStyle"
                tabindex="0"
                role="group"
                :aria-label="boardAriaLabel"
                @keydown="handleBoardKeydown"
              >
                <template v-for="(tile, index) in tiles" :key="tile">
                  <span v-if="tile === 0" class="puzzle-blank" aria-hidden="true"></span>
                  <button
                    v-else
                    class="puzzle-tile"
                    :class="{ movable: isMovable(index), placed: tile === index + 1 }"
                    type="button"
                    :disabled="!isMovable(index) || isComplete"
                    :aria-label="tileAriaLabel(tile, index)"
                    @click="moveTile(index)"
                  >
                    {{ tile }}
                  </button>
                </template>
              </TransitionGroup>
              <p class="puzzle-hint">{{ hintLabel }}</p>
            </section>

            <button class="puzzle-change-level" type="button" @click="chooseDifficulty">
              返回选关
            </button>
          </template>
            </main>
          </div>
        </section>

        <transition name="puzzle-modal">
          <div v-if="winOpen" class="puzzle-win-overlay">
            <section
              class="puzzle-win-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="puzzle-win-title"
            >
              <button class="puzzle-close-button" type="button" aria-label="关闭完成提示" @click="closeWin">
                <span aria-hidden="true"></span>
              </button>
              <div class="puzzle-win-mark" aria-hidden="true">
                <span></span>
              </div>
              <p>挑战完成</p>
              <h2 id="puzzle-win-title">数字全部归位</h2>
              <div class="puzzle-win-score">
                <span><strong>{{ formattedTime }}</strong><small>用时</small></span>
                <span><strong>{{ moves }}</strong><small>步数</small></span>
              </div>
              <p v-if="isNewBest" class="puzzle-new-best">刷新 {{ size }} × {{ size }} 最佳成绩</p>
              <button ref="winPrimary" class="puzzle-primary-action" type="button" @click="newGame">
                再来一局
              </button>
              <button v-if="size < 10" class="puzzle-secondary-action" type="button" @click="levelUp">
                下一关 · {{ size + 1 }} × {{ size + 1 }}
              </button>
            </section>
          </div>
        </transition>

        <p class="puzzle-sr-status" aria-live="polite">{{ liveMessage }}</p>
      </section>
    `,
    setup(props, { emit }) {
      const sizes = Object.freeze([3, 4, 5, 6, 7, 8, 9, 10]);
      const size = ref(3);
      const tiles = ref(createSolvedTiles(3));
      const hasSelectedSize = ref(false);
      const playing = ref(false);
      const moves = ref(0);
      const elapsedMs = ref(0);
      const isRunning = ref(false);
      const isComplete = ref(false);
      const winOpen = ref(false);
      const isNewBest = ref(false);
      const liveMessage = ref("");
      const bestScores = ref(loadBestScores());
      const winPrimary = ref(null);
      const gameHeading = ref(null);
      const levelHeading = ref(null);
      let timerId = 0;
      let startedAt = 0;

      const formattedTime = computed(() => formatTime(elapsedMs.value));
      const bestLabel = computed(() => {
        const best = bestScores.value[size.value];
        return best ? formatTime(best.elapsedMs) : "--:--";
      });
      const boardStyle = computed(() => ({
        gridTemplateColumns: `repeat(${size.value}, minmax(0, 1fr))`,
      }));
      const boardSizeClass = computed(() => `size-${size.value}`);
      const stateLabel = computed(() => {
        if (isComplete.value) return "已完成";
        if (isRunning.value) return "计时中";
        return "准备好";
      });
      const hintLabel = computed(() => {
        if (isComplete.value) return "漂亮！所有数字都已按顺序排列";
        if (isRunning.value) return "点击空格旁的数字，也可以使用方向键";
        return "移动第一块数字后开始计时";
      });
      const boardAriaLabel = computed(
        () => `${size.value}乘${size.value}数字华容道，${hintLabel.value}`
      );

      function goHome() {
        closeGame();
        emit("go-home");
      }

      async function openGame() {
        stopTimer();
        elapsedMs.value = 0;
        moves.value = 0;
        isComplete.value = false;
        winOpen.value = false;
        hasSelectedSize.value = false;
        playing.value = true;
        liveMessage.value = "请选择挑战关卡";

        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch (error) {
          // The fixed game layer remains available when fullscreen is blocked.
        }

        await nextTick();
        if (levelHeading.value) levelHeading.value.focus();
      }

      async function closeGame() {
        stopTimer();
        winOpen.value = false;
        isComplete.value = false;
        hasSelectedSize.value = false;
        playing.value = false;

        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
          }
        } catch (error) {
          // Closing the fixed game layer is sufficient when fullscreen exit fails.
        }
      }

      function createSolvedTiles(boardSize) {
        return Array.from({ length: boardSize * boardSize }, (_, index) =>
          index === boardSize * boardSize - 1 ? 0 : index + 1
        );
      }

      function newGame() {
        stopTimer();
        elapsedMs.value = 0;
        moves.value = 0;
        isComplete.value = false;
        winOpen.value = false;
        isNewBest.value = false;
        liveMessage.value = `${size.value}乘${size.value}新游戏已准备好`;
        tiles.value = createShuffledTiles(size.value);
      }

      function startGame(nextSize) {
        size.value = nextSize;
        hasSelectedSize.value = true;
        newGame();
        nextTick(() => {
          if (gameHeading.value) gameHeading.value.focus();
        });
      }

      function chooseDifficulty() {
        stopTimer();
        winOpen.value = false;
        isComplete.value = false;
        hasSelectedSize.value = false;
        liveMessage.value = "请选择棋盘难度";
        nextTick(() => {
          if (levelHeading.value) levelHeading.value.focus();
        });
      }

      function levelUp() {
        if (size.value < 10) size.value += 1;
        newGame();
      }

      function createShuffledTiles(boardSize) {
        const shuffled = createSolvedTiles(boardSize);
        let blankIndex = shuffled.length - 1;
        let previousBlank = -1;
        const shuffleSteps = Math.max(90, boardSize * boardSize * 28);

        for (let step = 0; step < shuffleSteps; step += 1) {
          let candidates = neighborIndexes(blankIndex, boardSize).filter(
            (index) => index !== previousBlank
          );
          if (!candidates.length) candidates = neighborIndexes(blankIndex, boardSize);
          const nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
          [shuffled[blankIndex], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[blankIndex]];
          previousBlank = blankIndex;
          blankIndex = nextIndex;
        }

        if (isSolved(shuffled)) {
          const nextIndex = neighborIndexes(blankIndex, boardSize)[0];
          [shuffled[blankIndex], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[blankIndex]];
        }

        return shuffled;
      }

      function neighborIndexes(index, boardSize) {
        const row = Math.floor(index / boardSize);
        const column = index % boardSize;
        const neighbors = [];

        if (row > 0) neighbors.push(index - boardSize);
        if (row < boardSize - 1) neighbors.push(index + boardSize);
        if (column > 0) neighbors.push(index - 1);
        if (column < boardSize - 1) neighbors.push(index + 1);
        return neighbors;
      }

      function isMovable(index) {
        if (isComplete.value) return false;
        const blankIndex = tiles.value.indexOf(0);
        return neighborIndexes(blankIndex, size.value).includes(index);
      }

      function moveTile(index) {
        if (!isMovable(index)) return;
        if (!isRunning.value) startTimer();

        const blankIndex = tiles.value.indexOf(0);
        const nextTiles = tiles.value.slice();
        [nextTiles[blankIndex], nextTiles[index]] = [nextTiles[index], nextTiles[blankIndex]];
        tiles.value = nextTiles;
        moves.value += 1;

        if (isSolved(nextTiles)) finishGame();
      }

      function handleBoardKeydown(event) {
        if (isComplete.value) return;
        const blankIndex = tiles.value.indexOf(0);
        const row = Math.floor(blankIndex / size.value);
        const column = blankIndex % size.value;
        let targetIndex = -1;

        if (event.key === "ArrowUp" && row > 0) targetIndex = blankIndex - size.value;
        if (event.key === "ArrowDown" && row < size.value - 1) targetIndex = blankIndex + size.value;
        if (event.key === "ArrowLeft" && column > 0) targetIndex = blankIndex - 1;
        if (event.key === "ArrowRight" && column < size.value - 1) targetIndex = blankIndex + 1;

        if (targetIndex >= 0) {
          event.preventDefault();
          moveTile(targetIndex);
        }
      }

      function startTimer() {
        isRunning.value = true;
        startedAt = Date.now() - elapsedMs.value;
        timerId = window.setInterval(updateTimer, 100);
        liveMessage.value = "计时开始";
      }

      function updateTimer() {
        elapsedMs.value = Date.now() - startedAt;
      }

      function stopTimer() {
        if (isRunning.value) updateTimer();
        isRunning.value = false;
        window.clearInterval(timerId);
        timerId = 0;
      }

      function finishGame() {
        stopTimer();
        isComplete.value = true;
        isNewBest.value = saveBestScore();
        winOpen.value = true;
        liveMessage.value = `挑战完成，用时${formattedTime.value}，共${moves.value}步`;
        nextTick(() => {
          if (winPrimary.value) winPrimary.value.focus();
        });
      }

      function closeWin() {
        winOpen.value = false;
      }

      function saveBestScore() {
        const currentBest = bestScores.value[size.value];
        const shouldSave =
          !currentBest ||
          elapsedMs.value < currentBest.elapsedMs ||
          (elapsedMs.value === currentBest.elapsedMs && moves.value < currentBest.moves);

        if (!shouldSave) return false;

        bestScores.value = {
          ...bestScores.value,
          [size.value]: { elapsedMs: elapsedMs.value, moves: moves.value },
        };

        try {
          localStorage.setItem(bestStorageKey, JSON.stringify(bestScores.value));
        } catch (error) {
          // The game still works when private browsing blocks local storage.
        }
        return true;
      }

      function loadBestScores() {
        try {
          const parsed = JSON.parse(localStorage.getItem(bestStorageKey) || "{}");
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
          return {};
        }
      }

      function isSolved(list) {
        return list.every((tile, index) =>
          index === list.length - 1 ? tile === 0 : tile === index + 1
        );
      }

      function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      }

      function difficultyName(boardSize) {
        const names = {
          3: "入门",
          4: "简单",
          5: "进阶",
          6: "熟练",
          7: "困难",
          8: "专家",
          9: "大师",
          10: "极限",
        };
        return names[boardSize];
      }

      function tileAriaLabel(tile, index) {
        return isMovable(index) ? `移动数字${tile}` : `数字${tile}`;
      }

      function syncVisibleTime() {
        if (isRunning.value) updateTimer();
      }

      onMounted(() => {
        document.addEventListener("visibilitychange", syncVisibleTime);
      });

      onBeforeUnmount(() => {
        document.removeEventListener("visibilitychange", syncVisibleTime);
        closeGame();
      });

      return {
        bestLabel,
        boardAriaLabel,
        boardSizeClass,
        boardStyle,
        chooseDifficulty,
        closeGame,
        closeWin,
        difficultyName,
        elapsedMs,
        formattedTime,
        gameHeading,
        goHome,
        hasSelectedSize,
        handleBoardKeydown,
        hintLabel,
        isComplete,
        isMovable,
        isNewBest,
        isRunning,
        levelUp,
        levelHeading,
        liveMessage,
        moveTile,
        moves,
        newGame,
        openGame,
        playing,
        size,
        sizes,
        startGame,
        stateLabel,
        tileAriaLabel,
        tiles,
        winOpen,
        winPrimary,
      };
    },
  };
})(window);
