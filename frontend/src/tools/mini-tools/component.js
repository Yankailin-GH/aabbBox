(function (global) {
  if (!global.Vue) return;

  const { computed, onBeforeUnmount, reactive, ref } = global.Vue;
  const dayMs = 24 * 60 * 60 * 1000;

  function createTool(name, body, setupFn) {
    return {
      name,
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
              <button class="text-action" type="button" @click="resetTool">重置</button>
            </section>
          </header>
          ${body}
        </section>
      `,
      setup(props, { emit }) {
        function goHome() {
          emit("go-home");
        }

        return {
          goHome,
          ...setupFn(),
        };
      },
    };
  }

  global.AabbBoxTool = createTool(
    "AabbBoxTool",
    `
      <section class="mini-overview">
        <div>
          <span>{{ result.collides ? '碰撞' : '分离' }}</span>
          <p>状态</p>
        </div>
        <div>
          <span>{{ result.overlapArea }}</span>
          <p>重叠面积</p>
        </div>
        <div>
          <span>{{ result.distance }}</span>
          <p>中心距离</p>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>碰撞预览</h2>
          <button type="button" @click="randomize">随机</button>
        </div>
        <div class="aabb-stage">
          <span class="aabb-rect rect-a" :style="rectStyle(boxA)">A</span>
          <span class="aabb-rect rect-b" :style="rectStyle(boxB)">B</span>
          <span v-if="result.collides" class="aabb-overlap" :style="overlapStyle">重叠</span>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>盒子 A</h2>
          <button type="button" @click="copyResult">复制</button>
        </div>
        <div class="mini-input-grid four">
          <label><span>X</span><input v-model.number="boxA.x" type="number" /></label>
          <label><span>Y</span><input v-model.number="boxA.y" type="number" /></label>
          <label><span>宽</span><input v-model.number="boxA.w" type="number" min="1" /></label>
          <label><span>高</span><input v-model.number="boxA.h" type="number" min="1" /></label>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>盒子 B</h2>
          <button type="button" @click="swapBoxes">交换</button>
        </div>
        <div class="mini-input-grid four">
          <label><span>X</span><input v-model.number="boxB.x" type="number" /></label>
          <label><span>Y</span><input v-model.number="boxB.y" type="number" /></label>
          <label><span>宽</span><input v-model.number="boxB.w" type="number" min="1" /></label>
          <label><span>高</span><input v-model.number="boxB.h" type="number" min="1" /></label>
        </div>
      </section>

      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const boxA = reactive({ x: 30, y: 40, w: 150, h: 110 });
      const boxB = reactive({ x: 120, y: 95, w: 150, h: 120 });
      const notice = ref("");

      const bounds = computed(() => {
        const maxX = Math.max(boxA.x + boxA.w, boxB.x + boxB.w, 320);
        const maxY = Math.max(boxA.y + boxA.h, boxB.y + boxB.h, 260);
        return { width: maxX + 28, height: maxY + 28 };
      });

      const result = computed(() => {
        const left = Math.max(boxA.x, boxB.x);
        const top = Math.max(boxA.y, boxB.y);
        const right = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
        const bottom = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);
        const overlapW = Math.max(0, right - left);
        const overlapH = Math.max(0, bottom - top);
        const centerAx = boxA.x + boxA.w / 2;
        const centerAy = boxA.y + boxA.h / 2;
        const centerBx = boxB.x + boxB.w / 2;
        const centerBy = boxB.y + boxB.h / 2;

        return {
          collides: overlapW > 0 && overlapH > 0,
          overlapArea: Math.round(overlapW * overlapH),
          distance: Math.round(Math.hypot(centerAx - centerBx, centerAy - centerBy)),
          overlap: { x: left, y: top, w: overlapW, h: overlapH },
        };
      });

      const overlapStyle = computed(() => rectStyle(result.value.overlap));

      function rectStyle(box) {
        return {
          left: `${(box.x / bounds.value.width) * 100}%`,
          top: `${(box.y / bounds.value.height) * 100}%`,
          width: `${(Math.max(1, box.w) / bounds.value.width) * 100}%`,
          height: `${(Math.max(1, box.h) / bounds.value.height) * 100}%`,
        };
      }

      function randomize() {
        Object.assign(boxA, randomBox());
        Object.assign(boxB, randomBox());
        notice.value = "已生成随机碰撞盒。";
      }

      function randomBox() {
        return {
          x: randomInt(0, 180),
          y: randomInt(0, 160),
          w: randomInt(70, 170),
          h: randomInt(60, 160),
        };
      }

      function swapBoxes() {
        const a = { ...boxA };
        Object.assign(boxA, boxB);
        Object.assign(boxB, a);
      }

      function copyResult() {
        copyText(JSON.stringify({ a: boxA, b: boxB, result: result.value }, null, 2));
        notice.value = "碰撞数据已复制。";
      }

      function resetTool() {
        Object.assign(boxA, { x: 30, y: 40, w: 150, h: 110 });
        Object.assign(boxB, { x: 120, y: 95, w: 150, h: 120 });
        notice.value = "";
      }

      return { boxA, boxB, copyResult, notice, overlapStyle, randomize, rectStyle, resetTool, result, swapBoxes };
    }
  );

  global.ColorPickerTool = createTool(
    "ColorPickerTool",
    `
      <section class="mini-overview">
        <div><span>{{ colorInfo.hex }}</span><p>HEX</p></div>
        <div><span>{{ colorInfo.rgb }}</span><p>RGB</p></div>
        <div><span>{{ colorInfo.hsl }}</span><p>HSL</p></div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>颜色</h2>
          <button type="button" @click="randomColor">随机</button>
        </div>
        <div class="color-large-preview" :style="{ background: hex }"></div>
        <div class="mini-input-grid two">
          <label><span>取色</span><input v-model="hex" type="color" /></label>
          <label><span>HEX</span><input v-model.trim="hexText" type="text" maxlength="7" @input="syncHexText" /></label>
        </div>
      </section>

      <section class="mini-actions">
        <button type="button" @click="copy(colorInfo.hex)">复制 HEX</button>
        <button type="button" @click="copy(colorInfo.rgb)">复制 RGB</button>
        <button type="button" @click="copy(colorInfo.hsl)">复制 HSL</button>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>透明度</h2>
          <button type="button" @click="copy(colorInfo.rgba)">复制</button>
        </div>
        <label class="mini-range"><span>Alpha {{ alpha }}%</span><input v-model.number="alpha" type="range" min="0" max="100" /></label>
        <textarea class="mini-output" readonly :value="colorInfo.rgba"></textarea>
      </section>

      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const hex = ref("#2f7df6");
      const hexText = ref("#2f7df6");
      const alpha = ref(80);
      const notice = ref("");

      const colorInfo = computed(() => {
        const rgb = hexToRgb(hex.value);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {
          hex: hex.value.toUpperCase(),
          rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          rgba: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha.value / 100).toFixed(2)})`,
          hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
        };
      });

      function syncHexText() {
        const value = normalizeHex(hexText.value);
        if (value) hex.value = value;
      }

      function randomColor() {
        hex.value = randomHex();
        hexText.value = hex.value;
      }

      function copy(text) {
        copyText(text);
        notice.value = "颜色值已复制。";
      }

      function resetTool() {
        hex.value = "#2f7df6";
        hexText.value = hex.value;
        alpha.value = 80;
        notice.value = "";
      }

      return { alpha, colorInfo, copy, hex, hexText, notice, randomColor, resetTool, syncHexText };
    }
  );

  global.PaletteMakerTool = createTool(
    "PaletteMakerTool",
    `
      <section class="mini-section">
        <div class="section-header">
          <h2>主色</h2>
          <button type="button" @click="randomColor">随机</button>
        </div>
        <div class="mini-input-grid two">
          <label><span>颜色</span><input v-model="baseColor" type="color" /></label>
          <label><span>HEX</span><input v-model.trim="baseText" type="text" maxlength="7" @input="syncBaseText" /></label>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>色板</h2>
          <button type="button" @click="copyPalette">复制</button>
        </div>
        <div class="palette-grid">
          <button v-for="item in palette" :key="item.label" type="button" @click="copy(item.hex)">
            <span :style="{ background: item.hex }"></span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.hex }}</small>
          </button>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>CSS 变量</h2>
          <button type="button" @click="copy(cssVars)">复制</button>
        </div>
        <textarea class="mini-output" readonly :value="cssVars"></textarea>
      </section>

      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const baseColor = ref("#2f7df6");
      const baseText = ref("#2f7df6");
      const notice = ref("");
      const palette = computed(() => buildPalette(baseColor.value));
      const cssVars = computed(() => palette.value.map((item) => `--color-${item.label}: ${item.hex};`).join("\n"));

      function syncBaseText() {
        const value = normalizeHex(baseText.value);
        if (value) baseColor.value = value;
      }

      function randomColor() {
        baseColor.value = randomHex();
        baseText.value = baseColor.value;
      }

      function copy(text) {
        copyText(text);
        notice.value = "已复制。";
      }

      function copyPalette() {
        copy(cssVars.value);
      }

      function resetTool() {
        baseColor.value = "#2f7df6";
        baseText.value = baseColor.value;
        notice.value = "";
      }

      return { baseColor, baseText, copy, copyPalette, cssVars, notice, palette, randomColor, resetTool, syncBaseText };
    }
  );

  global.GradientMakerTool = createTool(
    "GradientMakerTool",
    `
      <section class="mini-section">
        <div class="section-header">
          <h2>渐变预览</h2>
          <button type="button" @click="randomize">随机</button>
        </div>
        <div class="gradient-preview" :style="{ background: cssValue }"></div>
        <div class="mini-input-grid two">
          <label><span>颜色 A</span><input v-model="colorA" type="color" /></label>
          <label><span>颜色 B</span><input v-model="colorB" type="color" /></label>
        </div>
        <label class="mini-select"><span>方向</span><select v-model="direction"><option v-for="item in directions" :key="item" :value="item">{{ item }}</option></select></label>
      </section>

      <section class="mini-actions">
        <button type="button" @click="swap">交换颜色</button>
        <button type="button" @click="copy(cssValue)">复制 CSS</button>
      </section>

      <textarea class="mini-output" readonly :value="'background: ' + cssValue + ';'"></textarea>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const colorA = ref("#2f7df6");
      const colorB = ref("#20a86b");
      const direction = ref("135deg");
      const directions = ["90deg", "135deg", "180deg", "to right", "to bottom", "to bottom right"];
      const notice = ref("");
      const cssValue = computed(() => `linear-gradient(${direction.value}, ${colorA.value}, ${colorB.value})`);

      function swap() {
        const next = colorA.value;
        colorA.value = colorB.value;
        colorB.value = next;
      }

      function randomize() {
        colorA.value = randomHex();
        colorB.value = randomHex();
      }

      function copy(text) {
        copyText(`background: ${text};`);
        notice.value = "渐变 CSS 已复制。";
      }

      function resetTool() {
        colorA.value = "#2f7df6";
        colorB.value = "#20a86b";
        direction.value = "135deg";
        notice.value = "";
      }

      return { colorA, colorB, copy, cssValue, direction, directions, notice, randomize, resetTool, swap };
    }
  );

  global.ShadowRadiusTool = createTool(
    "ShadowRadiusTool",
    `
      <section class="mini-section">
        <div class="section-header">
          <h2>预览</h2>
          <button type="button" @click="copy(cssValue)">复制 CSS</button>
        </div>
        <div class="shadow-preview-wrap">
          <div class="shadow-preview-card" :style="previewStyle">Card</div>
        </div>
      </section>

      <section class="mini-section">
        <div class="mini-range-list">
          <label class="mini-range"><span>圆角 {{ radius }}px</span><input v-model.number="radius" type="range" min="0" max="48" /></label>
          <label class="mini-range"><span>X {{ x }}px</span><input v-model.number="x" type="range" min="-40" max="40" /></label>
          <label class="mini-range"><span>Y {{ y }}px</span><input v-model.number="y" type="range" min="-40" max="60" /></label>
          <label class="mini-range"><span>模糊 {{ blur }}px</span><input v-model.number="blur" type="range" min="0" max="80" /></label>
          <label class="mini-range"><span>扩散 {{ spread }}px</span><input v-model.number="spread" type="range" min="-20" max="30" /></label>
          <label class="mini-range"><span>透明度 {{ opacity }}%</span><input v-model.number="opacity" type="range" min="0" max="60" /></label>
        </div>
      </section>

      <textarea class="mini-output" readonly :value="cssValue"></textarea>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const radius = ref(12);
      const x = ref(0);
      const y = ref(18);
      const blur = ref(44);
      const spread = ref(0);
      const opacity = ref(14);
      const notice = ref("");
      const shadow = computed(() => `${x.value}px ${y.value}px ${blur.value}px ${spread.value}px rgba(31, 41, 55, ${(opacity.value / 100).toFixed(2)})`);
      const cssValue = computed(() => `border-radius: ${radius.value}px;\nbox-shadow: ${shadow.value};`);
      const previewStyle = computed(() => ({ borderRadius: `${radius.value}px`, boxShadow: shadow.value }));

      function copy(text) {
        copyText(text);
        notice.value = "样式已复制。";
      }

      function resetTool() {
        radius.value = 12;
        x.value = 0;
        y.value = 18;
        blur.value = 44;
        spread.value = 0;
        opacity.value = 14;
        notice.value = "";
      }

      return { blur, copy, cssValue, notice, opacity, previewStyle, radius, resetTool, spread, x, y };
    }
  );

  const unitCategories = {
    length: {
      label: "长度",
      units: [
        { id: "m", label: "米", factor: 1 },
        { id: "km", label: "千米", factor: 1000 },
        { id: "cm", label: "厘米", factor: 0.01 },
        { id: "mm", label: "毫米", factor: 0.001 },
        { id: "inch", label: "英寸", factor: 0.0254 },
        { id: "ft", label: "英尺", factor: 0.3048 },
      ],
    },
    area: {
      label: "面积",
      units: [
        { id: "sqm", label: "平方米", factor: 1 },
        { id: "sqkm", label: "平方千米", factor: 1000000 },
        { id: "mu", label: "亩", factor: 666.6666667 },
        { id: "hectare", label: "公顷", factor: 10000 },
        { id: "sqft", label: "平方英尺", factor: 0.09290304 },
      ],
    },
    weight: {
      label: "重量",
      units: [
        { id: "kg", label: "千克", factor: 1 },
        { id: "g", label: "克", factor: 0.001 },
        { id: "t", label: "吨", factor: 1000 },
        { id: "jin", label: "斤", factor: 0.5 },
        { id: "lb", label: "磅", factor: 0.45359237 },
      ],
    },
    data: {
      label: "数据",
      units: [
        { id: "B", label: "B", factor: 1 },
        { id: "KB", label: "KB", factor: 1024 },
        { id: "MB", label: "MB", factor: 1048576 },
        { id: "GB", label: "GB", factor: 1073741824 },
      ],
    },
  };

  global.UnitConvertTool = createTool(
    "UnitConvertTool",
    `
      <section class="mini-overview">
        <div><span>{{ resultText }}</span><p>结果</p></div>
        <div><span>{{ currentCategory.label }}</span><p>类型</p></div>
        <div><span>{{ fromLabel }} → {{ toLabel }}</span><p>单位</p></div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>单位换算</h2>
          <button type="button" @click="swap">交换</button>
        </div>
        <label class="mini-select"><span>类型</span><select v-model="category" @change="syncUnits"><option v-for="item in categoryOptions" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        <div class="mini-input-grid two">
          <label><span>数值</span><input v-model.number="value" type="number" inputmode="decimal" /></label>
          <label><span>从</span><select v-model="from"><option v-for="unit in currentCategory.units" :key="unit.id" :value="unit.id">{{ unit.label }}</option></select></label>
        </div>
        <label class="mini-select"><span>到</span><select v-model="to"><option v-for="unit in currentCategory.units" :key="unit.id" :value="unit.id">{{ unit.label }}</option></select></label>
      </section>

      <section class="mini-actions"><button type="button" @click="copyResult">复制结果</button></section>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const category = ref("length");
      const value = ref(1);
      const from = ref("m");
      const to = ref("cm");
      const notice = ref("");
      const categoryOptions = Object.keys(unitCategories).map((id) => ({ id, label: unitCategories[id].label }));
      const currentCategory = computed(() => unitCategories[category.value]);
      const fromUnit = computed(() => findUnit(currentCategory.value, from.value));
      const toUnit = computed(() => findUnit(currentCategory.value, to.value));
      const result = computed(() => (Number(value.value || 0) * fromUnit.value.factor) / toUnit.value.factor);
      const resultText = computed(() => formatNumber(result.value));
      const fromLabel = computed(() => fromUnit.value.label);
      const toLabel = computed(() => toUnit.value.label);

      function syncUnits() {
        const units = currentCategory.value.units;
        from.value = units[0].id;
        to.value = units[1] ? units[1].id : units[0].id;
      }

      function swap() {
        const next = from.value;
        from.value = to.value;
        to.value = next;
      }

      function copyResult() {
        copyText(resultText.value);
        notice.value = "结果已复制。";
      }

      function resetTool() {
        category.value = "length";
        value.value = 1;
        from.value = "m";
        to.value = "cm";
        notice.value = "";
      }

      return { category, categoryOptions, copyResult, currentCategory, from, fromLabel, notice, resetTool, resultText, swap, syncUnits, to, toLabel, value };
    }
  );

  global.DateCalcTool = createTool(
    "DateCalcTool",
    `
      <section class="mini-overview">
        <div><span>{{ diffDays }}</span><p>相差天数</p></div>
        <div><span>{{ addResult }}</span><p>日期推算</p></div>
        <div><span>{{ todayText }}</span><p>今天</p></div>
      </section>

      <section class="mini-section">
        <div class="section-header">
          <h2>日期间隔</h2>
          <button type="button" @click="setToday">今天</button>
        </div>
        <div class="mini-input-grid two">
          <label><span>开始</span><input v-model="startDate" type="date" /></label>
          <label><span>结束</span><input v-model="endDate" type="date" /></label>
        </div>
      </section>

      <section class="mini-section">
        <div class="section-header"><h2>日期推算</h2><button type="button" @click="copy(addResult)">复制</button></div>
        <div class="mini-input-grid two">
          <label><span>基准日期</span><input v-model="baseDate" type="date" /></label>
          <label><span>增减天数</span><input v-model.number="offsetDays" type="number" /></label>
        </div>
      </section>

      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const today = todayString();
      const startDate = ref(today);
      const endDate = ref(today);
      const baseDate = ref(today);
      const offsetDays = ref(7);
      const notice = ref("");
      const todayText = computed(() => `${today} ${weekdayText(today)}`);
      const diffDays = computed(() => {
        const start = dateValue(startDate.value);
        const end = dateValue(endDate.value);
        return Math.round((end - start) / dayMs);
      });
      const addResult = computed(() => formatDateInput(new Date(dateValue(baseDate.value) + Number(offsetDays.value || 0) * dayMs)));

      function setToday() {
        startDate.value = todayString();
        endDate.value = todayString();
        baseDate.value = todayString();
      }

      function copy(text) {
        copyText(text);
        notice.value = "日期已复制。";
      }

      function resetTool() {
        setToday();
        offsetDays.value = 7;
        notice.value = "";
      }

      return { addResult, baseDate, copy, diffDays, endDate, notice, offsetDays, resetTool, setToday, startDate, todayText };
    }
  );

  global.JwtDecodeTool = createTool(
    "JwtDecodeTool",
    `
      <section class="mini-section">
        <div class="section-header"><h2>Token</h2><button type="button" @click="fillSample">示例</button></div>
        <textarea v-model.trim="token" class="mini-textarea" placeholder="粘贴 JWT Token"></textarea>
      </section>

      <section class="mini-overview">
        <div><span>{{ parsed.ok ? '有效' : '待解析' }}</span><p>状态</p></div>
        <div><span>{{ parsed.expText }}</span><p>过期</p></div>
        <div><span>{{ parsed.alg }}</span><p>算法</p></div>
      </section>

      <section class="mini-section">
        <div class="section-header"><h2>Payload</h2><button type="button" @click="copy(parsed.payloadText)">复制</button></div>
        <textarea class="mini-output" readonly :value="parsed.payloadText"></textarea>
      </section>
      <section v-if="parsed.error" class="mini-notice error">{{ parsed.error }}</section>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const token = ref("");
      const notice = ref("");
      const parsed = computed(() => parseJwt(token.value));

      function fillSample() {
        token.value = [
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          "eyJzdWIiOiIxMDAwMSIsInVzZXJuYW1lIjoiZGVtbyIsInJvbGUiOiJzdHVkZW50IiwiZXhwIjo0MTAyNDQ0ODAwfQ",
          "signature",
        ].join(".");
      }

      function copy(text) {
        copyText(text || "");
        notice.value = "Payload 已复制。";
      }

      function resetTool() {
        token.value = "";
        notice.value = "";
      }

      return { copy, fillSample, notice, parsed, resetTool, token };
    }
  );

  global.Base64CodecTool = createTool(
    "Base64CodecTool",
    `
      <section class="mini-tabs">
        <button :class="{ active: mode === 'encode' }" type="button" @click="mode = 'encode'">编码</button>
        <button :class="{ active: mode === 'decode' }" type="button" @click="mode = 'decode'">解码</button>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>输入</h2><button type="button" @click="swap">交换</button></div>
        <textarea v-model="input" class="mini-textarea" placeholder="输入文本"></textarea>
        <label class="mini-check"><input v-model="urlSafe" type="checkbox" /> URL Safe</label>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>结果</h2><button type="button" @click="copy(output.text)">复制</button></div>
        <textarea class="mini-output" readonly :value="output.text"></textarea>
      </section>
      <section v-if="output.error" class="mini-notice error">{{ output.error }}</section>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const mode = ref("encode");
      const input = ref("hello 工具箱");
      const urlSafe = ref(false);
      const notice = ref("");
      const output = computed(() => {
        try {
          return { text: mode.value === "encode" ? encodeBase64(input.value, urlSafe.value) : decodeBase64(input.value, urlSafe.value), error: "" };
        } catch (error) {
          return { text: "", error: "解码失败，请检查输入内容。" };
        }
      });

      function swap() {
        input.value = output.value.text;
        mode.value = mode.value === "encode" ? "decode" : "encode";
      }

      function copy(text) {
        copyText(text);
        notice.value = "结果已复制。";
      }

      function resetTool() {
        mode.value = "encode";
        input.value = "";
        urlSafe.value = false;
        notice.value = "";
      }

      return { copy, input, mode, notice, output, resetTool, swap, urlSafe };
    }
  );

  global.UrlQueryTool = createTool(
    "UrlQueryTool",
    `
      <section class="mini-tabs">
        <button :class="{ active: mode === 'parse' }" type="button" @click="mode = 'parse'">Query 转 JSON</button>
        <button :class="{ active: mode === 'build' }" type="button" @click="mode = 'build'">JSON 转 Query</button>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>输入</h2><button type="button" @click="fillSample">示例</button></div>
        <textarea v-model="input" class="mini-textarea" :placeholder="mode === 'parse' ? 'https://a.com?a=1&b=2' : '{ &quot;a&quot;: 1 }'"></textarea>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>结果</h2><button type="button" @click="copy(result.text)">复制</button></div>
        <textarea class="mini-output" readonly :value="result.text"></textarea>
      </section>
      <section v-if="result.error" class="mini-notice error">{{ result.error }}</section>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const mode = ref("parse");
      const input = ref("https://example.com/api?name=demo&page=1&tags=a&tags=b");
      const notice = ref("");
      const result = computed(() => {
        try {
          return {
            text: mode.value === "parse" ? JSON.stringify(parseQuery(input.value), null, 2) : buildQuery(JSON.parse(input.value || "{}")),
            error: "",
          };
        } catch (error) {
          return { text: "", error: mode.value === "parse" ? "URL 或 Query 解析失败。" : "JSON 格式不正确。" };
        }
      });

      function fillSample() {
        input.value = mode.value === "parse" ? "https://example.com/api?name=demo&page=1&tags=a&tags=b" : JSON.stringify({ name: "demo", page: 1, tags: ["a", "b"] }, null, 2);
      }

      function copy(text) {
        copyText(text);
        notice.value = "结果已复制。";
      }

      function resetTool() {
        mode.value = "parse";
        input.value = "";
        notice.value = "";
      }

      return { copy, fillSample, input, mode, notice, resetTool, result };
    }
  );

  global.RegexTestTool = createTool(
    "RegexTestTool",
    `
      <section class="mini-overview">
        <div><span>{{ result.matches.length }}</span><p>匹配数</p></div>
        <div><span>{{ flags }}</span><p>Flags</p></div>
        <div><span>{{ result.error ? '错误' : '正常' }}</span><p>状态</p></div>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>表达式</h2><button type="button" @click="fillSample">示例</button></div>
        <input v-model="pattern" class="mini-single-input" placeholder="\\d+" />
        <div class="regex-flags">
          <label v-for="item in flagOptions" :key="item"><input type="checkbox" :value="item" v-model="selectedFlags" /> {{ item }}</label>
        </div>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>文本</h2><button type="button" @click="copyMatches">复制匹配</button></div>
        <textarea v-model="text" class="mini-textarea"></textarea>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>匹配结果</h2><button type="button" @click="resetTool">清空</button></div>
        <div class="match-list">
          <article v-for="(match, index) in result.matches" :key="index">
            <strong>{{ match.value }}</strong>
            <small>index {{ match.index }}</small>
            <p v-if="match.groups.length">分组：{{ match.groups.join(' / ') }}</p>
          </article>
          <p v-if="!result.matches.length && !result.error" class="mini-empty">暂无匹配</p>
        </div>
      </section>
      <section v-if="result.error" class="mini-notice error">{{ result.error }}</section>
      <section v-if="notice" class="mini-notice success">{{ notice }}</section>
    `,
    () => {
      const pattern = ref("\\d+");
      const selectedFlags = ref(["g"]);
      const flagOptions = ["g", "i", "m", "s", "u"];
      const text = ref("订单 A1001 金额 29.90，订单 B1002 金额 58.00");
      const notice = ref("");
      const flags = computed(() => [...new Set(selectedFlags.value)].join(""));
      const result = computed(() => testRegex(pattern.value, flags.value, text.value));

      function fillSample() {
        pattern.value = "订单\\s+([A-Z]\\d+)";
        selectedFlags.value = ["g"];
        text.value = "订单 A1001 金额 29.90，订单 B1002 金额 58.00";
      }

      function copyMatches() {
        copyText(result.value.matches.map((item) => item.value).join("\n"));
        notice.value = "匹配结果已复制。";
      }

      function resetTool() {
        pattern.value = "";
        selectedFlags.value = ["g"];
        text.value = "";
        notice.value = "";
      }

      return { copyMatches, fillSample, flagOptions, flags, notice, pattern, resetTool, result, selectedFlags, text };
    }
  );

  global.TodoListTool = createTool(
    "TodoListTool",
    `
      <section class="mini-overview">
        <div><span>{{ activeCount }}</span><p>待完成</p></div>
        <div><span>{{ doneCount }}</span><p>已完成</p></div>
        <div><span>{{ todos.length }}</span><p>总数</p></div>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>新增任务</h2><button type="button" @click="addTodo">添加</button></div>
        <input v-model.trim="draft" class="mini-single-input" placeholder="输入待办事项" @keyup.enter="addTodo" />
      </section>
      <section class="mini-tabs">
        <button :class="{ active: filter === 'all' }" type="button" @click="filter = 'all'">全部</button>
        <button :class="{ active: filter === 'active' }" type="button" @click="filter = 'active'">待办</button>
        <button :class="{ active: filter === 'done' }" type="button" @click="filter = 'done'">完成</button>
      </section>
      <section class="todo-list">
        <article v-for="todo in visibleTodos" :key="todo.id" :class="{ done: todo.done }">
          <button type="button" @click="toggleTodo(todo.id)">{{ todo.done ? '✓' : '' }}</button>
          <span>{{ todo.text }}</span>
          <small>{{ todo.time }}</small>
          <button type="button" @click="deleteTodo(todo.id)">删</button>
        </article>
        <p v-if="visibleTodos.length === 0" class="mini-empty">暂无任务</p>
      </section>
    `,
    () => {
      const storageKey = "aabb-toolbox-todos";
      const todos = ref(readStorage(storageKey, []));
      const draft = ref("");
      const filter = ref("all");
      const visibleTodos = computed(() => todos.value.filter((todo) => filter.value === "all" || (filter.value === "active" ? !todo.done : todo.done)));
      const activeCount = computed(() => todos.value.filter((todo) => !todo.done).length);
      const doneCount = computed(() => todos.value.filter((todo) => todo.done).length);

      function save() {
        localStorage.setItem(storageKey, JSON.stringify(todos.value));
      }

      function addTodo() {
        if (!draft.value) return;
        todos.value.unshift({ id: createId(), text: draft.value, done: false, time: shortTime() });
        draft.value = "";
        save();
      }

      function toggleTodo(id) {
        const todo = todos.value.find((item) => item.id === id);
        if (!todo) return;
        todo.done = !todo.done;
        save();
      }

      function deleteTodo(id) {
        todos.value = todos.value.filter((item) => item.id !== id);
        save();
      }

      function resetTool() {
        todos.value = [];
        draft.value = "";
        filter.value = "all";
        localStorage.removeItem(storageKey);
      }

      return { activeCount, addTodo, deleteTodo, doneCount, draft, filter, resetTool, todos, toggleTodo, visibleTodos };
    }
  );

  global.PomodoroTool = createTool(
    "PomodoroTool",
    `
      <section class="pomodoro-panel">
        <span>{{ modeLabel }}</span>
        <strong>{{ timeText }}</strong>
        <small>{{ completed }} 个专注</small>
      </section>
      <section class="mini-tabs">
        <button :class="{ active: mode === 'focus' }" type="button" @click="setMode('focus')">专注</button>
        <button :class="{ active: mode === 'break' }" type="button" @click="setMode('break')">休息</button>
        <button :class="{ active: mode === 'long' }" type="button" @click="setMode('long')">长休息</button>
      </section>
      <section class="mini-section">
        <div class="mini-range-list">
          <label class="mini-range"><span>专注 {{ focusMinutes }} 分钟</span><input v-model.number="focusMinutes" type="range" min="5" max="60" step="5" @change="resetSeconds" /></label>
          <label class="mini-range"><span>休息 {{ breakMinutes }} 分钟</span><input v-model.number="breakMinutes" type="range" min="1" max="20" @change="resetSeconds" /></label>
        </div>
      </section>
      <section class="mini-actions">
        <button type="button" @click="toggle">{{ running ? '暂停' : '开始' }}</button>
        <button type="button" @click="resetSeconds">重置</button>
      </section>
    `,
    () => {
      const focusMinutes = ref(25);
      const breakMinutes = ref(5);
      const longMinutes = ref(15);
      const mode = ref("focus");
      const secondsLeft = ref(25 * 60);
      const running = ref(false);
      const completed = ref(Number(localStorage.getItem("aabb-toolbox-pomodoro-count") || "0"));
      let timer = 0;
      const modeLabel = computed(() => (mode.value === "focus" ? "专注中" : mode.value === "break" ? "短休息" : "长休息"));
      const timeText = computed(() => `${pad2(Math.floor(secondsLeft.value / 60))}:${pad2(secondsLeft.value % 60)}`);

      function durationSeconds(nextMode) {
        if (nextMode === "focus") return focusMinutes.value * 60;
        if (nextMode === "long") return longMinutes.value * 60;
        return breakMinutes.value * 60;
      }

      function setMode(nextMode) {
        mode.value = nextMode;
        resetSeconds();
      }

      function tick() {
        if (secondsLeft.value > 0) {
          secondsLeft.value -= 1;
          return;
        }

        if (mode.value === "focus") {
          completed.value += 1;
          localStorage.setItem("aabb-toolbox-pomodoro-count", String(completed.value));
          setMode(completed.value % 4 === 0 ? "long" : "break");
        } else {
          setMode("focus");
        }
      }

      function toggle() {
        running.value = !running.value;
        window.clearInterval(timer);
        if (running.value) timer = window.setInterval(tick, 1000);
      }

      function resetSeconds() {
        secondsLeft.value = durationSeconds(mode.value);
        running.value = false;
        window.clearInterval(timer);
      }

      function resetTool() {
        focusMinutes.value = 25;
        breakMinutes.value = 5;
        longMinutes.value = 15;
        mode.value = "focus";
        completed.value = 0;
        localStorage.removeItem("aabb-toolbox-pomodoro-count");
        resetSeconds();
      }

      onBeforeUnmount(() => window.clearInterval(timer));

      return { breakMinutes, completed, focusMinutes, mode, modeLabel, resetSeconds, resetTool, running, setMode, timeText, toggle };
    }
  );

  global.TextDedupeTool = createTool(
    "TextDedupeTool",
    `
      <section class="mini-section">
        <div class="section-header"><h2>文本</h2><button type="button" @click="fillSample">示例</button></div>
        <textarea v-model="input" class="mini-textarea" placeholder="每行一条"></textarea>
        <div class="mini-check-grid">
          <label><input v-model="trimLine" type="checkbox" /> Trim</label>
          <label><input v-model="removeEmpty" type="checkbox" /> 去空行</label>
          <label><input v-model="dedupe" type="checkbox" /> 去重</label>
          <label><input v-model="sortLines" type="checkbox" /> 排序</label>
        </div>
      </section>
      <section class="mini-overview">
        <div><span>{{ stats.input }}</span><p>输入行</p></div>
        <div><span>{{ stats.output }}</span><p>输出行</p></div>
        <div><span>{{ stats.removed }}</span><p>减少</p></div>
      </section>
      <section class="mini-section">
        <div class="section-header"><h2>结果</h2><button type="button" @click="copyResult">复制</button></div>
        <textarea class="mini-output" readonly :value="output"></textarea>
      </section>
    `,
    () => {
      const input = ref("");
      const trimLine = ref(true);
      const removeEmpty = ref(true);
      const dedupe = ref(true);
      const sortLines = ref(false);
      const output = computed(() => processLines(input.value, { trimLine: trimLine.value, removeEmpty: removeEmpty.value, dedupe: dedupe.value, sortLines: sortLines.value }).join("\n"));
      const stats = computed(() => {
        const inputCount = input.value ? input.value.split(/\r\n|\n|\r/).length : 0;
        const outputCount = output.value ? output.value.split(/\r\n|\n|\r/).length : 0;
        return { input: inputCount, output: outputCount, removed: Math.max(0, inputCount - outputCount) };
      });

      function fillSample() {
        input.value = " apple\\nbanana\\napple\\n\\norange\\nbanana ";
      }

      function copyResult() {
        copyText(output.value);
      }

      function resetTool() {
        input.value = "";
        trimLine.value = true;
        removeEmpty.value = true;
        dedupe.value = true;
        sortLines.value = false;
      }

      return { copyResult, dedupe, fillSample, input, output, removeEmpty, resetTool, sortLines, stats, trimLine };
    }
  );

  global.NotesTool = createTool(
    "NotesTool",
    `
      <section class="mini-section">
        <div class="section-header"><h2>便签</h2><button type="button" @click="addNote">新增</button></div>
        <div class="note-list">
          <button v-for="note in notes" :key="note.id" :class="{ active: note.id === selectedId }" type="button" @click="selectedId = note.id">
            <strong>{{ note.title || '未命名' }}</strong>
            <small>{{ note.updatedAt }}</small>
          </button>
        </div>
      </section>
      <section v-if="currentNote" class="mini-section">
        <div class="section-header"><h2>内容</h2><button type="button" @click="deleteNote">删除</button></div>
        <input class="mini-single-input" :value="currentNote.title" placeholder="标题" @input="updateTitle($event.target.value)" />
        <textarea class="mini-textarea tall" :value="currentNote.content" placeholder="记录临时内容" @input="updateContent($event.target.value)"></textarea>
      </section>
      <p v-else class="mini-empty">暂无便签</p>
    `,
    () => {
      const storageKey = "aabb-toolbox-notes";
      const notes = ref(readStorage(storageKey, []));
      const selectedId = ref(notes.value[0] ? notes.value[0].id : "");
      const currentNote = computed(() => notes.value.find((note) => note.id === selectedId.value) || null);

      function save() {
        localStorage.setItem(storageKey, JSON.stringify(notes.value));
      }

      function touch(note) {
        note.updatedAt = shortTime();
        save();
      }

      function addNote() {
        const note = { id: createId(), title: "新便签", content: "", updatedAt: shortTime() };
        notes.value.unshift(note);
        selectedId.value = note.id;
        save();
      }

      function updateTitle(value) {
        if (!currentNote.value) return;
        currentNote.value.title = value;
        touch(currentNote.value);
      }

      function updateContent(value) {
        if (!currentNote.value) return;
        currentNote.value.content = value;
        touch(currentNote.value);
      }

      function deleteNote() {
        if (!currentNote.value) return;
        notes.value = notes.value.filter((note) => note.id !== currentNote.value.id);
        selectedId.value = notes.value[0] ? notes.value[0].id : "";
        save();
      }

      function resetTool() {
        notes.value = [];
        selectedId.value = "";
        localStorage.removeItem(storageKey);
      }

      if (notes.value.length === 0) addNote();

      return { addNote, currentNote, deleteNote, notes, resetTool, selectedId, updateContent, updateTitle };
    }
  );

  function findUnit(category, id) {
    return category.units.find((unit) => unit.id === id) || category.units[0];
  }

  function buildPalette(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const items = [
      { label: "50", h: hsl.h, s: Math.max(20, hsl.s - 10), l: 95 },
      { label: "100", h: hsl.h, s: hsl.s, l: 88 },
      { label: "300", h: hsl.h, s: hsl.s, l: 70 },
      { label: "500", h: hsl.h, s: hsl.s, l: hsl.l },
      { label: "700", h: hsl.h, s: hsl.s, l: Math.max(18, hsl.l - 18) },
      { label: "comp", h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l },
      { label: "warm", h: (hsl.h + 28) % 360, s: hsl.s, l: hsl.l },
      { label: "cool", h: (hsl.h + 332) % 360, s: hsl.s, l: hsl.l },
    ];

    return items.map((item) => ({ label: item.label, hex: hslToHex(item.h, item.s, item.l) }));
  }

  function parseJwt(token) {
    if (!token) return { ok: false, alg: "-", expText: "-", payloadText: "", error: "" };
    const parts = token.split(".");
    if (parts.length < 2) return { ok: false, alg: "-", expText: "-", payloadText: "", error: "JWT 至少需要 Header 和 Payload 两段。" };

    try {
      const header = JSON.parse(decodeBase64(parts[0], true));
      const payload = JSON.parse(decodeBase64(parts[1], true));
      const expText = payload.exp ? formatDateTime(new Date(payload.exp * 1000)) : "无";
      return {
        ok: true,
        alg: header.alg || "-",
        expText,
        payloadText: JSON.stringify(payload, null, 2),
        error: "",
      };
    } catch (error) {
      return { ok: false, alg: "-", expText: "-", payloadText: "", error: "Token 解析失败。" };
    }
  }

  function testRegex(pattern, flags, text) {
    if (!pattern) return { matches: [], error: "" };

    try {
      const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
      const regex = new RegExp(pattern, normalizedFlags);
      const matches = [];
      let match;
      let guard = 0;

      while ((match = regex.exec(text)) && guard < 200) {
        matches.push({
          value: match[0],
          index: match.index,
          groups: match.slice(1).filter((item) => item !== undefined),
        });
        if (match[0] === "") regex.lastIndex += 1;
        guard += 1;
      }

      return { matches, error: "" };
    } catch (error) {
      return { matches: [], error: error.message || "正则表达式不正确。" };
    }
  }

  function parseQuery(input) {
    const text = input.trim();
    const query = text.includes("?") ? text.split("?").slice(1).join("?").split("#")[0] : text.replace(/^\?/, "");
    const params = new URLSearchParams(query);
    const result = {};

    params.forEach((value, key) => {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  function buildQuery(value) {
    const params = new URLSearchParams();
    Object.keys(value || {}).forEach((key) => {
      const item = value[key];
      if (Array.isArray(item)) {
        item.forEach((child) => params.append(key, child));
      } else if (item !== null && item !== undefined) {
        params.set(key, item);
      }
    });
    return params.toString();
  }

  function processLines(text, options) {
    let lines = text ? text.split(/\r\n|\n|\r/) : [];
    if (options.trimLine) lines = lines.map((line) => line.trim());
    if (options.removeEmpty) lines = lines.filter(Boolean);
    if (options.dedupe) lines = [...new Set(lines)];
    if (options.sortLines) lines = [...lines].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return lines;
  }

  function encodeBase64(text, urlSafe) {
    let value = btoa(unescape(encodeURIComponent(text)));
    if (urlSafe) value = value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return value;
  }

  function decodeBase64(text, urlSafe) {
    let value = text.trim();
    if (urlSafe) {
      value = value.replace(/-/g, "+").replace(/_/g, "/");
      while (value.length % 4) value += "=";
    }
    return decodeURIComponent(escape(atob(value)));
  }

  function normalizeHex(value) {
    const text = String(value || "").trim();
    const match = text.match(/^#?([0-9a-f]{6})$/i);
    return match ? `#${match[1]}` : "";
  }

  function randomHex() {
    return `#${randomInt(0, 0xffffff).toString(16).padStart(6, "0")}`;
  }

  function hexToRgb(hex) {
    const value = normalizeHex(hex) || "#000000";
    return {
      r: Number.parseInt(value.slice(1, 3), 16),
      g: Number.parseInt(value.slice(3, 5), 16),
      b: Number.parseInt(value.slice(5, 7), 16),
    };
  }

  function rgbToHsl(r, g, b) {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === nr) h = (ng - nb) / d + (ng < nb ? 6 : 0);
      if (max === ng) h = (nb - nr) / d + 2;
      if (max === nb) h = (nr - ng) / d + 4;
      h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    const sat = s / 100;
    const light = l / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = light - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
  }

  function copyText(text) {
    const value = String(text || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  function readStorage(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function todayString() {
    return formatDateInput(new Date());
  }

  function dateValue(value) {
    return new Date(`${value}T00:00:00`).getTime();
  }

  function formatDateInput(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function formatDateTime(date) {
    return `${formatDateInput(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  }

  function weekdayText(value) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${value}T00:00:00`).getDay()];
  }

  function shortTime() {
    const date = new Date();
    return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "0";
    if (Math.abs(value) >= 100000) return value.toExponential(4);
    return Number(value.toFixed(8)).toString();
  }
})(window);
