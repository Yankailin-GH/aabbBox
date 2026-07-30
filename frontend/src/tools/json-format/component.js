(function (global) {
  if (!global.Vue) return;

  const { computed, reactive, ref } = global.Vue;
  const sourceStorageKey = "aabb-toolbox-json-source";
  const indentStorageKey = "aabb-toolbox-json-indent";
  const sampleJson = {
    project: "AABB Toolbox",
    tools: ["打牌计分板", "幸运转盘", "JSON 格式化"],
    enabled: true,
    version: 1,
    meta: {
      platform: "H5",
      updatedAt: "2026-07-30",
    },
  };

  global.JsonFormatTool = {
    name: "JsonFormatTool",
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
            <button class="text-action" type="button" @click="loadSample">示例</button>
          </section>
        </header>

        <section class="json-overview" aria-label="JSON 概览">
          <div>
            <span>{{ statusLabel }}</span>
            <p>状态</p>
          </div>
          <div>
            <span>{{ inputSize }}</span>
            <p>字符</p>
          </div>
          <div>
            <span>{{ lineCount }}</span>
            <p>行数</p>
          </div>
        </section>

        <section class="json-section">
          <div class="section-header">
            <h2>JSON 内容</h2>
            <button type="button" @click="clearAll">清空</button>
          </div>
          <textarea
            v-model="source"
            class="json-editor"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            placeholder='粘贴 JSON，例如 {"name":"工具箱"}'
            @input="handleInput"
          ></textarea>
        </section>

        <section class="json-controls" aria-label="JSON 操作">
          <div class="json-indent-tabs">
            <button
              :class="{ active: indentSize === 2 }"
              type="button"
              @click="setIndent(2)"
            >
              2 空格
            </button>
            <button
              :class="{ active: indentSize === 4 }"
              type="button"
              @click="setIndent(4)"
            >
              4 空格
            </button>
          </div>
          <div class="json-action-grid">
            <button type="button" @click="formatJson">格式化</button>
            <button type="button" @click="minifyJson">压缩</button>
            <button type="button" @click="escapeJson">转义</button>
            <button type="button" @click="unescapeJson">去转义</button>
            <button type="button" @click="validateJson">校验</button>
            <button type="button" @click="copyResult">复制</button>
          </div>
        </section>

        <section v-if="notice.message" :class="['json-notice', notice.type]">
          <strong>{{ notice.title }}</strong>
          <p>{{ notice.message }}</p>
          <small v-if="notice.detail">{{ notice.detail }}</small>
        </section>

        <section v-if="errorMarker.visible" class="json-error-marker" aria-label="JSON 错误位置">
          <div>
            <span>{{ errorMarker.before }}</span><mark>{{ errorMarker.marked }}</mark><span>{{ errorMarker.after }}</span>
          </div>
          <small>错误位置：第 {{ errorMarker.line }} 行，第 {{ errorMarker.column }} 列</small>
        </section>

        <section v-if="summary.visible" class="json-summary" aria-label="JSON 结构信息">
          <div>
            <span>{{ summary.objects }}</span>
            <p>对象</p>
          </div>
          <div>
            <span>{{ summary.arrays }}</span>
            <p>数组</p>
          </div>
          <div>
            <span>{{ summary.keys }}</span>
            <p>键</p>
          </div>
          <div>
            <span>{{ summary.depth }}</span>
            <p>深度</p>
          </div>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const source = ref(loadCachedSource());
      const indentSize = ref(loadIndentSize());
      const notice = reactive({
        type: "idle",
        title: "等待输入",
        message: "",
        detail: "",
      });
      const errorMarker = reactive({
        visible: false,
        before: "",
        marked: "",
        after: "",
        line: 0,
        column: 0,
      });
      const summary = reactive({
        visible: false,
        objects: 0,
        arrays: 0,
        keys: 0,
        depth: 0,
      });

      const inputSize = computed(() => formatSize(source.value));
      const lineCount = computed(() => getLineCount(source.value));
      const statusLabel = computed(() => {
        if (notice.type === "success") {
          return isJsonSuccessTitle(notice.title) ? "有效" : "已处理";
        }
        if (notice.type === "error") return "错误";
        return "待处理";
      });

      function goHome() {
        emit("go-home");
      }

      function saveSource() {
        localStorage.setItem(sourceStorageKey, source.value);
      }

      function handleInput() {
        saveSource();
        validateLiveInput();
      }

      function validateLiveInput() {
        const text = source.value;

        if (!text.trim()) {
          resetSummary();
          resetErrorMarker();
          notice.type = "idle";
          notice.title = "等待输入";
          notice.message = "";
          notice.detail = "";
          return;
        }

        try {
          const parsed = JSON.parse(text);
          updateSummary(parsed);
          showSuccess("JSON 有效", "当前输入可以被正确解析。");
        } catch (error) {
          resetSummary();
          showParseError(error, text);
        }
      }

      function setIndent(size) {
        indentSize.value = size;
        localStorage.setItem(indentStorageKey, String(size));

        if (canParseJson(source.value)) {
          formatJson();
        }
      }

      function formatJson() {
        const parsed = parseInput();
        if (!parsed.ok) return;

        source.value = JSON.stringify(parsed.value, null, indentSize.value);
        saveSource();
        updateSummary(parsed.value);
        showSuccess("格式化完成", "JSON 已按当前缩进展开。");
      }

      function minifyJson() {
        const parsed = parseInput();
        if (!parsed.ok) return;

        source.value = JSON.stringify(parsed.value);
        saveSource();
        updateSummary(parsed.value);
        showSuccess("压缩完成", "已移除多余空白字符。");
      }

      function validateJson() {
        const parsed = parseInput();
        if (!parsed.ok) return;

        updateSummary(parsed.value);
        showSuccess("JSON 有效", "当前输入可以被正确解析。");
      }

      function escapeJson() {
        const text = source.value;

        if (!text.trim()) {
          showError("请输入内容", "输入区不能为空。");
          return;
        }

        source.value = JSON.stringify(text).slice(1, -1);
        saveSource();
        resetSummary();
        resetErrorMarker();
        showSuccess("转义完成", "已生成可嵌入字符串的转义内容。");
      }

      function unescapeJson() {
        const text = source.value.trim();

        if (!text) {
          showError("请输入内容", "输入区不能为空。");
          return;
        }

        try {
          const value = parseEscapedText(text);
          source.value = value;
          saveSource();

          try {
            updateSummary(JSON.parse(value.trim()));
          } catch (error) {
            resetSummary();
          }

          resetErrorMarker();
          showSuccess("去转义完成", "已还原转义字符串。");
        } catch (error) {
          resetSummary();
          resetErrorMarker();
          showError("去转义失败", "请检查输入是否为合法的转义字符串。");
        }
      }

      function clearAll() {
        source.value = "";
        localStorage.removeItem(sourceStorageKey);
        resetSummary();
        resetErrorMarker();
        notice.type = "idle";
        notice.title = "等待输入";
        notice.message = "";
        notice.detail = "";
      }

      function loadSample() {
        source.value = JSON.stringify(sampleJson);
        saveSource();
        formatJson();
      }

      async function copyResult() {
        const text = source.value;

        if (!text.trim()) {
          showError("没有可复制内容", "请先输入 JSON 内容。");
          return;
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            fallbackCopy(text);
          }
          showSuccess("已复制", "内容已复制到剪贴板。");
        } catch (error) {
          try {
            fallbackCopy(text);
            showSuccess("已复制", "内容已复制到剪贴板。");
          } catch (fallbackError) {
            showError("复制失败", "当前浏览器限制了剪贴板访问。");
          }
        }
      }

      function parseInput() {
        const text = source.value;

        if (!text.trim()) {
          resetSummary();
          showError("请输入 JSON", "输入区不能为空。");
          return { ok: false };
        }

        try {
          return { ok: true, value: JSON.parse(text) };
        } catch (error) {
          resetSummary();
          showParseError(error, text);
          return { ok: false };
        }
      }

      function showSuccess(title, message) {
        notice.type = "success";
        notice.title = title;
        notice.message = message;
        notice.detail = "";
        resetErrorMarker();
      }

      function showError(title, message) {
        notice.type = "error";
        notice.title = title;
        notice.message = message;
        notice.detail = "";
        resetErrorMarker();
      }

      function showParseError(error, text) {
        const info = getParseErrorInfo(error, text);

        notice.type = "error";
        notice.title = "解析失败";
        notice.message = info.message;
        notice.detail = info.detail;
        setErrorMarker(text, info);
      }

      function updateSummary(value) {
        const result = analyzeJson(value);

        summary.visible = true;
        summary.objects = result.objects;
        summary.arrays = result.arrays;
        summary.keys = result.keys;
        summary.depth = result.depth;
      }

      function resetSummary() {
        summary.visible = false;
        summary.objects = 0;
        summary.arrays = 0;
        summary.keys = 0;
        summary.depth = 0;
      }

      function setErrorMarker(text, info) {
        if (info.position === null) {
          resetErrorMarker();
          return;
        }

        const marker = buildErrorMarker(text, info.position);

        errorMarker.visible = true;
        errorMarker.before = marker.before;
        errorMarker.marked = marker.marked;
        errorMarker.after = marker.after;
        errorMarker.line = marker.line;
        errorMarker.column = marker.column;
      }

      function resetErrorMarker() {
        errorMarker.visible = false;
        errorMarker.before = "";
        errorMarker.marked = "";
        errorMarker.after = "";
        errorMarker.line = 0;
        errorMarker.column = 0;
      }

      return {
        clearAll,
        copyResult,
        errorMarker,
        escapeJson,
        formatJson,
        goHome,
        handleInput,
        indentSize,
        inputSize,
        lineCount,
        loadSample,
        minifyJson,
        notice,
        saveSource,
        setIndent,
        source,
        statusLabel,
        summary,
        unescapeJson,
        validateJson,
      };
    },
  };

  function loadCachedSource() {
    return localStorage.getItem(sourceStorageKey) || "";
  }

  function loadIndentSize() {
    const cached = Number.parseInt(localStorage.getItem(indentStorageKey) || "2", 10);
    return cached === 4 ? 4 : 2;
  }

  function analyzeJson(value) {
    const result = {
      objects: 0,
      arrays: 0,
      keys: 0,
      depth: 0,
    };

    walkJson(value, 1, result);
    return result;
  }

  function walkJson(value, depth, result) {
    if (depth > result.depth) result.depth = depth;

    if (Array.isArray(value)) {
      result.arrays += 1;
      value.forEach((item) => walkJson(item, depth + 1, result));
      return;
    }

    if (value && typeof value === "object") {
      const keys = Object.keys(value);

      result.objects += 1;
      result.keys += keys.length;
      keys.forEach((key) => walkJson(value[key], depth + 1, result));
    }
  }

  function getParseErrorInfo(error, text) {
    const message = error && error.message ? error.message : "JSON 格式不正确。";
    let position = findErrorPosition(message);
    let location = position === null ? findLineColumn(message) : getLineColumn(text, position);

    if (position === null && location) {
      position = getPositionFromLineColumn(text, location.line, location.column);
    }

    if (position === null || !location) {
      return {
        message,
        detail: "",
        position: null,
        line: 0,
        column: 0,
      };
    }

    return {
      message,
      detail: `第 ${location.line} 行，第 ${location.column} 列`,
      position,
      line: location.line,
      column: location.column,
    };
  }

  function findErrorPosition(message) {
    const match = String(message).match(/position\s+(\d+)/i);
    if (!match) return null;

    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? value : null;
  }

  function findLineColumn(message) {
    const match = String(message).match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (!match) return null;

    const line = Number.parseInt(match[1], 10);
    const column = Number.parseInt(match[2], 10);

    if (!Number.isFinite(line) || !Number.isFinite(column)) return null;

    return { line, column };
  }

  function getLineColumn(text, position) {
    const before = text.slice(0, position);
    const lines = before.split("\n");

    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  function getPositionFromLineColumn(text, line, column) {
    const lines = text.split("\n");
    let position = 0;

    for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
      position += lines[index].length + 1;
    }

    return Math.min(text.length, position + Math.max(0, column - 1));
  }

  function buildErrorMarker(text, position) {
    const clamped = Math.max(0, Math.min(position, text.length));
    const markedChar = text.charAt(clamped);
    const start = Math.max(0, clamped - 28);
    const end = Math.min(text.length, clamped + 29);
    const location = getLineColumn(text, clamped);

    return {
      before: formatSnippetText(text.slice(start, clamped)),
      marked: formatMarkedChar(markedChar),
      after: formatSnippetText(text.slice(markedChar ? clamped + 1 : clamped, end)),
      line: location.line,
      column: location.column,
    };
  }

  function formatSnippetText(text) {
    return text.replace(/\r/g, "").replace(/\n/g, "↵").replace(/\t/g, "⇥");
  }

  function formatMarkedChar(char) {
    if (!char) return "末尾";
    if (char === "\n") return "↵";
    if (char === "\t") return "⇥";
    if (char === " ") return "空格";
    return char;
  }

  function parseEscapedText(text) {
    if (text.startsWith('"') && text.endsWith('"')) {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "string") throw new Error("Escaped value must be a string.");
      return parsed;
    }

    try {
      return JSON.parse(`"${text}"`);
    } catch (error) {
      const safeText = text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");

      return JSON.parse(`"${safeText}"`);
    }
  }

  function formatSize(text) {
    const count = text.length;
    if (count === 0) return "0";
    if (count < 1000) return `${count}`;

    return `${(count / 1000).toFixed(1)}k`;
  }

  function getLineCount(text) {
    if (!text) return 0;

    return text.split(/\r\n|\r|\n/).length;
  }

  function isJsonSuccessTitle(title) {
    return title === "JSON 有效" || title === "格式化完成" || title === "压缩完成";
  }

  function canParseJson(text) {
    if (!text.trim()) return false;

    try {
      JSON.parse(text);
      return true;
    } catch (error) {
      return false;
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
})(window);
