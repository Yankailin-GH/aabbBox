(function (global) {
  if (!global.Vue) return;

  const { computed, onBeforeUnmount, reactive, ref } = global.Vue;
  const maxCanvasSide = 4096;
  const minCanvasSide = 160;

  const cropPresets = [
    { id: "original", label: "原图", width: 0, height: 0 },
    { id: "1-1", label: "1:1", width: 1, height: 1 },
    { id: "4-3", label: "4:3", width: 4, height: 3 },
    { id: "3-4", label: "3:4", width: 3, height: 4 },
    { id: "16-9", label: "16:9", width: 16, height: 9 },
    { id: "9-16", label: "9:16", width: 9, height: 16 },
    { id: "3-2", label: "3:2", width: 3, height: 2 },
    { id: "custom", label: "自定义", width: 0, height: 0 },
  ];

  const targetPresets = [
    { id: "50", label: "50KB", kb: 50 },
    { id: "100", label: "100KB", kb: 100 },
    { id: "200", label: "200KB", kb: 200 },
    { id: "500", label: "500KB", kb: 500 },
    { id: "1024", label: "1MB", kb: 1024 },
    { id: "custom", label: "自定义", kb: 0 },
  ];

  const formatOptions = [
    { value: "image/jpeg", label: "JPG" },
    { value: "image/webp", label: "WEBP" },
    { value: "image/png", label: "PNG" },
  ];

  global.ImageCompressTool = {
    name: "ImageCompressTool",
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
            <button class="text-action" type="button" @click="triggerFilePicker">
              {{ imageUrl ? '换图' : '添加' }}
            </button>
          </section>
        </header>

        <input
          ref="fileInput"
          class="image-file-input"
          type="file"
          accept="image/*"
          @change="handleFileChange"
        />

        <label v-if="!imageUrl" class="image-upload-panel">
          <input type="file" accept="image/*" @change="handleFileChange" />
          <span class="image-upload-icon">▧</span>
          <strong>添加图片</strong>
          <small>支持 JPG、PNG、WEBP，本地裁剪压缩</small>
        </label>

        <template v-else>
          <section class="image-overview" aria-label="图片信息">
            <div>
              <span>{{ sourceSizeLabel }}</span>
              <p>原图</p>
            </div>
            <div>
              <span>{{ sourceDimension }}</span>
              <p>尺寸</p>
            </div>
            <div>
              <span>{{ resultSizeLabel }}</span>
              <p>结果</p>
            </div>
          </section>

          <section class="image-section">
            <div class="section-header">
              <h2>裁剪预览</h2>
              <button type="button" @click="resetCrop">居中</button>
            </div>
            <div class="image-preview-frame" :style="previewFrameStyle">
              <img
                :src="imageUrl"
                alt="裁剪预览"
                :style="previewImageStyle"
              />
            </div>
          </section>

          <section class="image-section">
            <div class="section-header">
              <h2>裁剪比例</h2>
              <button type="button" @click="selectCropPreset('original')">原图</button>
            </div>

            <div class="image-chip-grid">
              <button
                v-for="preset in cropPresets"
                :key="preset.id"
                :class="{ active: cropPresetId === preset.id }"
                type="button"
                @click="selectCropPreset(preset.id)"
              >
                {{ preset.label }}
              </button>
            </div>

            <div v-if="cropPresetId === 'custom'" class="image-inline-fields">
              <label>
                <span>宽</span>
                <input v-model.number="customRatioWidth" type="number" min="1" max="999" inputmode="decimal" />
              </label>
              <label>
                <span>高</span>
                <input v-model.number="customRatioHeight" type="number" min="1" max="999" inputmode="decimal" />
              </label>
            </div>

            <div class="image-range-panel">
              <label>
                <span>放大 {{ cropZoom }}x</span>
                <input v-model.number="cropZoom" type="range" min="1" max="3" step="0.1" />
              </label>
              <label>
                <span>左右 {{ cropOffsetX }}%</span>
                <input v-model.number="cropOffsetX" type="range" min="0" max="100" step="1" :disabled="!canMoveCrop" />
              </label>
              <label>
                <span>上下 {{ cropOffsetY }}%</span>
                <input v-model.number="cropOffsetY" type="range" min="0" max="100" step="1" :disabled="!canMoveCrop" />
              </label>
            </div>
          </section>

          <section class="image-section">
            <div class="section-header">
              <h2>压缩目标</h2>
              <button type="button" @click="selectTargetPreset('200')">200KB</button>
            </div>

            <label class="image-select-row">
              <span>格式</span>
              <select v-model="outputFormat">
                <option v-for="option in formatOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <div class="image-chip-grid target-grid">
              <button
                v-for="preset in targetPresets"
                :key="preset.id"
                :class="{ active: targetPresetId === preset.id }"
                type="button"
                @click="selectTargetPreset(preset.id)"
              >
                {{ preset.label }}
              </button>
            </div>

            <label v-if="targetPresetId === 'custom'" class="image-custom-target">
              <span>目标大小 KB</span>
              <input v-model.number="customTargetKb" type="number" min="10" max="10240" step="10" inputmode="numeric" />
            </label>
          </section>

          <section class="image-actions" aria-label="图片处理操作">
            <button type="button" :disabled="isProcessing" @click="processImage">
              {{ isProcessing ? '处理中' : '开始处理' }}
            </button>
            <a
              v-if="result.url"
              :href="result.url"
              :download="result.name"
              class="image-download-button"
            >
              下载图片
            </a>
            <button type="button" @click="clearImage">清空</button>
          </section>

          <section v-if="notice.message" :class="['image-notice', notice.type]">
            <strong>{{ notice.title }}</strong>
            <p>{{ notice.message }}</p>
          </section>

          <section v-if="result.url" class="image-section">
            <div class="section-header">
              <h2>处理结果</h2>
              <button type="button" @click="processImage">重新生成</button>
            </div>
            <div class="image-result-panel">
              <img :src="result.url" alt="压缩结果" />
              <div class="image-result-stats">
                <span>{{ resultSizeLabel }}</span>
                <span>{{ resultDimension }}</span>
                <span>{{ resultQualityLabel }}</span>
                <span>{{ compressionLabel }}</span>
              </div>
            </div>
          </section>
        </template>
      </section>
    `,
    setup(props, { emit }) {
      const fileInput = ref(null);
      const imageUrl = ref("");
      const sourceFile = ref(null);
      const cropPresetId = ref("original");
      const customRatioWidth = ref(1);
      const customRatioHeight = ref(1);
      const cropZoom = ref(1);
      const cropOffsetX = ref(50);
      const cropOffsetY = ref(50);
      const targetPresetId = ref("200");
      const customTargetKb = ref(300);
      const outputFormat = ref("image/jpeg");
      const isProcessing = ref(false);
      const sourceMeta = reactive({
        width: 0,
        height: 0,
      });
      const result = reactive({
        url: "",
        name: "",
        size: 0,
        width: 0,
        height: 0,
        quality: 0,
        reachedTarget: false,
      });
      const notice = reactive({
        type: "idle",
        title: "",
        message: "",
      });
      let sourceObjectUrl = "";
      let resultObjectUrl = "";
      let sourceImage = null;

      const sourceSizeLabel = computed(() => formatBytes(sourceFile.value ? sourceFile.value.size : 0));
      const resultSizeLabel = computed(() => (result.size ? formatBytes(result.size) : "-"));
      const sourceDimension = computed(() => (sourceMeta.width ? `${sourceMeta.width}x${sourceMeta.height}` : "-"));
      const resultDimension = computed(() => (result.width ? `${result.width}x${result.height}` : "-"));
      const resultQualityLabel = computed(() => (result.quality ? `质量 ${Math.round(result.quality * 100)}%` : "质量 -"));
      const compressionLabel = computed(() => {
        if (!sourceFile.value || !result.size) return "压缩 -";

        const value = Math.round((1 - result.size / sourceFile.value.size) * 100);
        return value >= 0 ? `减少 ${value}%` : `增加 ${Math.abs(value)}%`;
      });
      const previewAspect = computed(() => {
        const ratio = getSelectedRatio();
        return `${ratio.width} / ${ratio.height}`;
      });
      const previewFrameStyle = computed(() => ({
        aspectRatio: previewAspect.value,
      }));
      const previewImageStyle = computed(() => ({
        objectPosition: `${cropOffsetX.value}% ${cropOffsetY.value}%`,
        transform: `scale(${cropZoom.value})`,
        transformOrigin: `${cropOffsetX.value}% ${cropOffsetY.value}%`,
      }));
      const canMoveCrop = computed(() => cropPresetId.value !== "original" || cropZoom.value > 1);

      function goHome() {
        emit("go-home");
      }

      function triggerFilePicker() {
        if (fileInput.value) fileInput.value.click();
      }

      async function handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;

        if (!file.type || !file.type.startsWith("image/")) {
          showError("图片格式不支持", "请选择 JPG、PNG、WEBP 等图片文件。");
          return;
        }

        try {
          revokeSourceUrl();
          revokeResultUrl();
          sourceObjectUrl = URL.createObjectURL(file);
          const image = await loadImage(sourceObjectUrl);

          sourceFile.value = file;
          sourceImage = image;
          imageUrl.value = sourceObjectUrl;
          sourceMeta.width = image.naturalWidth || image.width;
          sourceMeta.height = image.naturalHeight || image.height;
          cropPresetId.value = "original";
          resetCrop();
          resetResult();
          showSuccess("图片已添加", `${file.name}，${formatBytes(file.size)}。`);
        } catch (error) {
          clearImage();
          showError("读取失败", "图片无法读取，请换一张图片再试。");
        }
      }

      function selectCropPreset(id) {
        cropPresetId.value = id;
        resetCrop();
      }

      function selectTargetPreset(id) {
        targetPresetId.value = id;
      }

      function resetCrop() {
        cropZoom.value = 1;
        cropOffsetX.value = 50;
        cropOffsetY.value = 50;
      }

      async function processImage() {
        if (!sourceImage || !sourceMeta.width || !sourceMeta.height) {
          showError("请先添加图片", "选择图片后再进行压缩。");
          return;
        }

        const targetKb = getTargetKb();
        if (!targetKb) {
          showError("目标大小不正确", "请设置 10KB 到 10240KB 之间的目标大小。");
          return;
        }

        isProcessing.value = true;
        revokeResultUrl();
        resetResult();

        try {
          const crop = buildCropRect(
            sourceMeta.width,
            sourceMeta.height,
            getSelectedRatio(),
            cropZoom.value,
            cropOffsetX.value,
            cropOffsetY.value
          );
          const processed = await compressImage(sourceImage, crop, outputFormat.value, targetKb * 1024);

          resultObjectUrl = URL.createObjectURL(processed.blob);
          result.url = resultObjectUrl;
          result.name = buildDownloadName(sourceFile.value.name, outputFormat.value);
          result.size = processed.blob.size;
          result.width = processed.width;
          result.height = processed.height;
          result.quality = processed.quality;
          result.reachedTarget = processed.blob.size <= targetKb * 1024;

          if (result.reachedTarget) {
            showSuccess("处理完成", `已压缩到 ${formatBytes(result.size)}。`);
          } else {
            showSuccess("已尽量压缩", `当前为 ${formatBytes(result.size)}，目标过小可能需要更低尺寸。`);
          }
        } catch (error) {
          showError("处理失败", "当前浏览器无法完成这张图片的压缩。");
        } finally {
          isProcessing.value = false;
        }
      }

      function clearImage() {
        revokeSourceUrl();
        revokeResultUrl();
        sourceFile.value = null;
        sourceImage = null;
        imageUrl.value = "";
        sourceMeta.width = 0;
        sourceMeta.height = 0;
        resetResult();
        notice.type = "idle";
        notice.title = "";
        notice.message = "";
      }

      function getSelectedRatio() {
        if (cropPresetId.value === "custom") {
          return {
            width: clampNumber(customRatioWidth.value, 1, 999, 1),
            height: clampNumber(customRatioHeight.value, 1, 999, 1),
          };
        }

        const preset = cropPresets.find((item) => item.id === cropPresetId.value) || cropPresets[0];
        if (preset.id === "original") {
          return {
            width: sourceMeta.width || 1,
            height: sourceMeta.height || 1,
          };
        }

        return { width: preset.width, height: preset.height };
      }

      function getTargetKb() {
        if (targetPresetId.value === "custom") {
          return clampNumber(customTargetKb.value, 10, 10240, 300);
        }

        const preset = targetPresets.find((item) => item.id === targetPresetId.value);
        return preset ? preset.kb : 200;
      }

      function resetResult() {
        result.url = "";
        result.name = "";
        result.size = 0;
        result.width = 0;
        result.height = 0;
        result.quality = 0;
        result.reachedTarget = false;
      }

      function revokeSourceUrl() {
        if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = "";
      }

      function revokeResultUrl() {
        if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
        resultObjectUrl = "";
      }

      function showSuccess(title, message) {
        notice.type = "success";
        notice.title = title;
        notice.message = message;
      }

      function showError(title, message) {
        notice.type = "error";
        notice.title = title;
        notice.message = message;
      }

      onBeforeUnmount(() => {
        revokeSourceUrl();
        revokeResultUrl();
      });

      return {
        clearImage,
        canMoveCrop,
        compressionLabel,
        cropOffsetX,
        cropOffsetY,
        cropPresetId,
        cropPresets,
        cropZoom,
        customRatioHeight,
        customRatioWidth,
        customTargetKb,
        fileInput,
        formatOptions,
        goHome,
        handleFileChange,
        imageUrl,
        isProcessing,
        notice,
        outputFormat,
        previewFrameStyle,
        previewImageStyle,
        processImage,
        resetCrop,
        result,
        resultDimension,
        resultQualityLabel,
        resultSizeLabel,
        selectCropPreset,
        selectTargetPreset,
        sourceDimension,
        sourceSizeLabel,
        targetPresetId,
        targetPresets,
        triggerFilePicker,
      };
    },
  };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  async function compressImage(image, crop, mime, targetBytes) {
    let width = Math.max(1, Math.round(crop.width));
    let height = Math.max(1, Math.round(crop.height));
    const maxSide = Math.max(width, height);

    if (maxSide > maxCanvasSide) {
      const scale = maxCanvasSide / maxSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    let lastResult = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = renderCropToCanvas(image, crop, width, height, mime);
      const encoded = await encodeCanvas(canvas, mime, targetBytes);

      lastResult = {
        blob: encoded.blob,
        quality: encoded.quality,
        width,
        height,
      };

      if (!targetBytes || encoded.blob.size <= targetBytes || Math.min(width, height) <= minCanvasSide) {
        return lastResult;
      }

      const shrink = Math.max(0.62, Math.min(0.9, Math.sqrt(targetBytes / encoded.blob.size) * 0.95));
      width = Math.max(minCanvasSide, Math.round(width * shrink));
      height = Math.max(minCanvasSide, Math.round(height * shrink));
    }

    return lastResult;
  }

  function renderCropToCanvas(image, crop, width, height, mime) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    return canvas;
  }

  async function encodeCanvas(canvas, mime, targetBytes) {
    if (mime === "image/png") {
      return {
        blob: await canvasToBlob(canvas, mime),
        quality: 1,
      };
    }

    const maxQuality = 0.92;
    const minQuality = 0.35;
    const highBlob = await canvasToBlob(canvas, mime, maxQuality);

    if (!targetBytes || highBlob.size <= targetBytes) {
      return { blob: highBlob, quality: maxQuality };
    }

    const lowBlob = await canvasToBlob(canvas, mime, minQuality);
    if (lowBlob.size > targetBytes) {
      return { blob: lowBlob, quality: minQuality };
    }

    let low = minQuality;
    let high = maxQuality;
    let bestBlob = lowBlob;
    let bestQuality = minQuality;

    for (let index = 0; index < 8; index += 1) {
      const mid = (low + high) / 2;
      const blob = await canvasToBlob(canvas, mime, mid);

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestQuality = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return { blob: bestBlob, quality: bestQuality };
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Canvas encode failed."));
        },
        mime,
        quality
      );
    });
  }

  function buildCropRect(width, height, ratio, zoomValue, offsetX, offsetY) {
    const targetRatio = ratio.width / ratio.height;
    const imageRatio = width / height;
    const zoom = clampNumber(zoomValue, 1, 3, 1);
    let cropWidth = width;
    let cropHeight = height;

    if (imageRatio > targetRatio) {
      cropWidth = height * targetRatio;
    } else if (imageRatio < targetRatio) {
      cropHeight = width / targetRatio;
    }

    cropWidth = Math.max(1, cropWidth / zoom);
    cropHeight = Math.max(1, cropHeight / zoom);

    const maxX = Math.max(0, width - cropWidth);
    const maxY = Math.max(0, height - cropHeight);

    return {
      x: maxX * (clampNumber(offsetX, 0, 100, 50) / 100),
      y: maxY * (clampNumber(offsetY, 0, 100, 50) / 100),
      width: cropWidth,
      height: cropHeight,
    };
  }

  function buildDownloadName(filename, mime) {
    const dotIndex = filename.lastIndexOf(".");
    const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename || "image";
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

    return `${base}-compressed.${ext}`;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;

    return Math.max(min, Math.min(max, number));
  }

  function formatBytes(bytes) {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;

    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  }
})(window);
