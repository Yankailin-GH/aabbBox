(function (global) {
  'use strict';

  // 用源矩形直接读取透明素材；避免整张设计板缩进一个炮塔图标。
  const root = './assets/garden/seed-cannon/';
  const effects = new Image();
  effects.src = root + 'effects-v1.png';
  const cannons = new Image();
  cannons.src = root + 'cannons-v1.png';
  const poses = ['idle', 'compress', 'release', 'recoil', 'recover'];
  // 炮体矩形在导入最终图集后校准。每帧使用同一个瞄准轴和绘制比例。
  const towerFrames = [
    [[26,196,277,141], [358,205,223,130], [630,199,287,137], [952,197,257,138], [1262,198,253,138]],
    [[26,448,277,142], [357,456,227,133], [628,451,292,139], [954,450,260,140], [1261,451,255,139]],
    [[26,709,277,141], [355,716,228,135], [628,711,293,142], [953,710,261,142], [1260,712,255,140]]
  ];
  const effectFrames = {
    seed: [487, 464, 243, 123], secondary: [870, 481, 176, 88],
    trail: [1120, 455, 384, 137], muzzle: [65, 700, 276, 242],
    contact: [496, 712, 204, 210], impact: [862, 705, 200, 220],
    shellA: [1203, 744, 93, 82], shellB: [1231, 806, 105, 82],
    leafA: [1346, 722, 81, 75], leafB: [1373, 822, 65, 69],
    pollen: [1304, 715, 30, 30]
  };
  const motionQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function drawRect(ctx, image, rect, x, y, width, height, anchorX, anchorY) {
    if (!image.complete || !image.naturalWidth || !rect) return false;
    ctx.drawImage(image, rect[0], rect[1], rect[2], rect[3],
      x - width * anchorX, y - height * anchorY, width, height);
    return true;
  }

  function drawEffect(ctx, name, x, y, width, height, anchorX = 0.5, anchorY = 0.5) {
    return drawRect(ctx, effects, effectFrames[name], x, y, width, height, anchorX, anchorY);
  }

  function drawTower(ctx, level, pose, size) {
    const row = towerFrames[Math.max(0, Math.min(2, level - 1))];
    if (!row) return false;
    const frame = row[poses.indexOf(pose) < 0 ? 0 : poses.indexOf(pose)];
    // 生成帧的留白不同。先对齐公共画布，再由时间轴控制压缩与后坐。
    const width = size * 0.94, height = width * row[0][3] / row[0][2];
    return drawRect(ctx, cannons, frame, 0, 0, width, height, 0.5, 0.5);
  }

  function paintPreview(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    drawTower(ctx, Number(canvas.dataset.seedLevel) || 1, 'idle', Math.min(canvas.width, canvas.height) * 0.96);
    ctx.restore();
  }

  function paintPreviews(rootElement) {
    (rootElement || document).querySelectorAll('canvas[data-seed-level]').forEach(paintPreview);
  }

  cannons.addEventListener('load', () => paintPreviews());
  global.addEventListener('DOMContentLoaded', () => paintPreviews());
  global.SeedCannonArt = {
    drawTower, drawEffect, paintPreview, paintPreviews,
    get reducedMotion() { return !!(motionQuery && motionQuery.matches); },
    // 导入工具与测试使用的源数据；图像原有 alpha 不做阈值裁剪。
    towerFrames, effectFrames, root
  };
})(window);
