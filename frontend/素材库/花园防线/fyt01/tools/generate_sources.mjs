import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const packDir = path.resolve(toolDir, "..");
const legacyTowerDir = path.resolve(packDir, "..", "towers");
const buildDir = path.join(packDir, ".build");

const towers = [
  {
    id: "t01-pulse-gatling",
    gameId: "pulse",
    displayName: "瓶子炮",
    source: "pulse-gatling.svg",
    role: "高频单体输出；三级追加副弹",
    skill: "快速发射青柠能量弹；三级每次攻击追加一枚约 48% 伤害的副弹。",
    attackDirection: "朝目标 360° 旋转锁定",
    placement: [0.5, 0.5],
    aimPivot: [0.5, 0.5],
    muzzle: [0.91, 0.5],
    effectOrigin: [0.91, 0.5]
  },
  {
    id: "t02-cryo-emitter",
    gameId: "cryo",
    displayName: "冰冻星",
    source: "cryo-emitter.svg",
    role: "直线穿透与群体减速",
    skill: "沿目标方向释放贯穿寒流，对沿途敌人造成伤害并减速约 36%，持续约 2.5 秒。",
    attackDirection: "由星核朝目标 360° 直线发射",
    placement: [0.5, 0.85],
    aimPivot: [0.5, 0.5],
    muzzle: [0.5, 0.5],
    effectOrigin: [0.5, 0.5]
  },
  {
    id: "t03-plasma-mortar",
    gameId: "plasma",
    displayName: "火瓶子",
    source: "plasma-mortar.svg",
    role: "持续锁定与叠层增伤",
    skill: "连续命中同一目标时每次提高约 18% 伤害，最多 7 层；更换目标后重置。",
    attackDirection: "瓶口朝目标 360° 旋转锁定",
    placement: [0.5, 0.82],
    aimPivot: [0.5, 0.55],
    muzzle: [0.84, 0.31],
    effectOrigin: [0.84, 0.31]
  },
  {
    id: "t04-tesla-coil",
    gameId: "tesla",
    displayName: "水晶花",
    source: "tesla-coil.svg",
    role: "高伤单体光束与邻格增伤",
    skill: "向单体发射晶能光束，并提高相邻一格防御塔约 18%/28%/40% 的攻击力。",
    attackDirection: "由中央晶核向目标全向放射",
    placement: [0.5, 0.85],
    aimPivot: [0.5, 0.5],
    muzzle: [0.5, 0.5],
    effectOrigin: [0.5, 0.5]
  },
  {
    id: "t05-quantum-buffer",
    gameId: "buffer",
    displayName: "太阳花",
    source: "quantum-buffer.svg",
    role: "近距范围全体攻击",
    skill: "周期性释放日耀冲击波，同时伤害攻击范围内的所有敌人。",
    attackDirection: "以花芯为中心 360° 扩散",
    placement: [0.5, 0.85],
    aimPivot: [0.5, 0.5],
    muzzle: null,
    effectOrigin: [0.5, 0.5]
  }
];

const animations = [
  { name: "idle", frames: 6, durationMs: 120, loop: true },
  { name: "attack-pre", frames: 4, durationMs: 80, loop: false },
  { name: "attack", frames: 6, durationMs: 80, loop: false, event: { frame: 2, name: "fire" } },
  { name: "attack-post", frames: 4, durationMs: 100, loop: false }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fmt(value) {
  return Number(value).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

// 升级件沿武器轴镜像或沿核心等角分布，避免悬空圆点和零碎虚线。
function upgradeDecoration(gameId, level) {
  if (gameId === "plasma") return "";
  if (level === 1) return "";
  const max = level === 3;
  const repeat = (count, cx, cy, part) => Array.from({ length: count }, (_, i) =>
    `<g transform="rotate(${i * 360 / count} ${cx} ${cy})">${part}</g>`).join("");
  let parts = "";
  if (gameId === "pulse") {
    // 横向炮身以 y=120 为对称轴；金色只用于嵌入的能量轨。
    const rail = max
      ? '<path d="M61 94Q64 80 81 80H144Q154 80 164 91L157 99H76Z" fill="#B8F66D" stroke="#218F48" stroke-width="4"/><path d="M82 87H139" stroke="#FFF29A" stroke-width="5" stroke-linecap="round"/><path d="M69 95H152" stroke="#E9FFC0" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M69 101Q73 94 83 94H145L157 102H82Z" fill="#D6FF91" stroke="#2BA448" stroke-width="3"/><path d="M88 99H139" stroke="#FFF5AE" stroke-width="3" stroke-linecap="round"/>';
    parts = rail + `<g transform="translate(0 240) scale(1 -1)">${rail}</g>`;
    if (max) parts += '<path d="M179 105H211M179 135H211" stroke="#196F42" stroke-width="8" stroke-linecap="round"/><path d="M182 105H210M182 135H210" stroke="#EDFFAA" stroke-width="4" stroke-linecap="round"/>';
  } else if (gameId === "cryo") {
    parts = repeat(5, 120, 121, max
      ? '<path d="M120 47L130 81L120 96L110 81Z" fill="#E9FFFF" stroke="#268EBE" stroke-width="3"/><path d="M120 54V83" stroke="#83E8F4" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M120 68L126 87L120 99L114 87Z" fill="#DFFFFF" stroke="#3BAACD" stroke-width="2.5"/>');
    if (max) parts += '<circle cx="120" cy="121" r="25" fill="#E5FFFF" stroke="#288FBD" stroke-width="4"/><circle cx="120" cy="121" r="16" fill="#FFF18A" stroke="#DAB346" stroke-width="3"/><path d="M114 116L120 110L126 116L120 129Z" fill="#FFFFFF" opacity=".85"/>';
  } else if (gameId === "plasma") {
    const fin = max
      ? '<path d="M65 104Q62 82 77 76L111 77L146 94L140 103Z" fill="#FFB957" stroke="#C74B32" stroke-width="4"/><path d="M80 85L102 86L127 96" stroke="#FFF1AC" stroke-width="5" stroke-linecap="round"/><path d="M67 100H139" stroke="#E77835" stroke-width="3"/>'
      : '<path d="M74 106Q73 92 86 91L129 96L140 106Z" fill="#FFD276" stroke="#D26732" stroke-width="3"/><path d="M88 98L121 101" stroke="#FFF3AD" stroke-width="4" stroke-linecap="round"/>';
    parts = `<g transform="rotate(-30 120 126)">${fin}<g transform="translate(0 252) scale(1 -1)">${fin}</g>` +
      (max ? '<rect x="176" y="102" width="11" height="48" rx="5.5" fill="#FFE99B" stroke="#BF4A30" stroke-width="3"/><path d="M195 117H209M195 135H209" stroke="#FFF5B7" stroke-width="4" stroke-linecap="round"/>' : '') + '</g>';
  } else if (gameId === "tesla") {
    const facet = max
      ? '<path d="M120 38L145 62L120 73L95 62Z" fill="#FCE9FF" stroke="#9251C4" stroke-width="3"/><path d="M120 43V68" stroke="#CF8AE5" stroke-width="3"/>'
      : '<path d="M120 44L137 60L120 67L103 60Z" fill="#EEC7FA" stroke="#9D60C9" stroke-width="2.5"/>';
    parts = repeat(5, 120, 121, facet);
    if (max) parts += '<path d="M87 106L80 127L88 150M153 106L160 127L152 150" stroke="#FFF2A0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  } else if (gameId === "buffer") {
    parts = repeat(8, 120, 120, max
      ? '<path d="M120 28C105 43 110 61 120 67C130 61 135 43 120 28Z" fill="#FFF3AE" stroke="#D99038" stroke-width="3"/><path d="M120 39V57" stroke="#FFD068" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M120 39C113 48 113 57 120 61C127 57 127 48 120 39Z" fill="#FFEFB0"/>');
    if (max) parts += '<circle cx="120" cy="120" r="46" fill="none" stroke="#D98D35" stroke-width="4"/><circle cx="120" cy="120" r="40" fill="none" stroke="#FFF4AB" stroke-width="4"/><path d="M120 97L127 113L143 120L127 127L120 143L113 127L97 120L113 113Z" fill="#FFF8CB" stroke="#E5AF47" stroke-width="3" stroke-linejoin="round"/>';
  }
  return `<g id="upgrade-lv${level}" stroke-linejoin="round">${parts}</g>`;
}

function pulseChassis(level) {
  const bodyHeight = [42, 54, 66][level - 1];
  const bodyY = 120 - bodyHeight / 2;
  const radius = bodyHeight / 2 - 1;
  const nozzleHeight = bodyHeight * 0.72;
  const nozzleY = 120 - nozzleHeight / 2;
  const capHeight = bodyHeight * 0.56;
  const capY = 120 - capHeight / 2;
  const highlightY = bodyY + bodyHeight * 0.34;
  const shineY = bodyY + bodyHeight * 0.26;
  const shineRx = 12 + bodyHeight * 0.08;
  const shineRy = 4 + bodyHeight * 0.05;

  return `<g id="pulse-chassis" filter="url(#shadow)" stroke-linejoin="round">
    <path d="M${fmt(28 + radius)} ${fmt(bodyY)}H156C178 ${fmt(bodyY)} 181 ${fmt(nozzleY)} 198 ${fmt(nozzleY)}H207C219 ${fmt(nozzleY)} 228 ${fmt(nozzleY + nozzleHeight * 0.25)} 228 120C228 ${fmt(120 + nozzleHeight * 0.25)} 219 ${fmt(nozzleY + nozzleHeight)} 207 ${fmt(nozzleY + nozzleHeight)}H198C181 ${fmt(nozzleY + nozzleHeight)} 178 ${fmt(bodyY + bodyHeight)} 156 ${fmt(bodyY + bodyHeight)}H${fmt(28 + radius)}C28 ${fmt(bodyY + bodyHeight)} 28 ${fmt(bodyY + bodyHeight)} 28 120C28 ${fmt(bodyY)} 28 ${fmt(bodyY)} ${fmt(28 + radius)} ${fmt(bodyY)}Z" fill="url(#cannon-body)" stroke="#209F43" stroke-width="8"/>
    <rect x="204" y="${fmt(capY)}" width="23" height="${fmt(capHeight)}" rx="${fmt(capHeight * 0.36)}" fill="#B1F468" stroke="#209F43" stroke-width="5"/>
    <path d="M55 ${fmt(highlightY)}C70 ${fmt(highlightY - bodyHeight * 0.22)} 91 ${fmt(highlightY - bodyHeight * 0.26)} 111 ${fmt(highlightY - bodyHeight * 0.2)}" stroke="#F4FFB1" stroke-width="${fmt(Math.max(8, bodyHeight * 0.16))}" stroke-linecap="round" opacity=".58"/>
    <ellipse cx="65" cy="${fmt(shineY)}" rx="${fmt(shineRx)}" ry="${fmt(shineRy)}" transform="rotate(-20 65 ${fmt(shineY)})" fill="white" opacity=".68"/>
    <path d="M107 96H131L129 108V114C129 120 135 125 139 132C145 143 136 154 121 154C106 154 97 143 103 132C107 125 110 120 110 114L107 96Z" transform="translate(120 120) scale(.72) rotate(90) translate(-120 -120)" fill="url(#bottle-mark)" stroke="#D8AD29" stroke-width="4"/>
    <path d="M106 132C114 128 128 128 136 132" transform="translate(120 120) scale(.72) rotate(90) translate(-120 -120)" stroke="#FFF7A4" stroke-width="4" stroke-linecap="round" opacity=".68"/>
  </g>`;
}

function addUpgrade(baseSvg, tower, level) {
  if (tower.gameId === "plasma") {
    return fs.readFileSync(path.join(legacyTowerDir, `fire-bottle-lv${level}.svg`), "utf8");
  }
  const comment = `<!-- fyt01 ${tower.id} level ${level}; generated from ${tower.source} -->`;
  const withLevelChassis = tower.gameId === "pulse"
    ? baseSvg.replace(/<g id="pulse-chassis"[\s\S]*?<\/g>/, pulseChassis(level))
    : baseSvg;
  return withLevelChassis.replace(/<svg([^>]*)>/, `<svg$1>\n  ${comment}`)
    .replace(/<\/svg>\s*$/, `  ${upgradeDecoration(tower.gameId, level)}\n</svg>\n`);
}

function stateTransform(name, index, count, radial) {
  const t = count <= 1 ? 0 : index / (count - 1);
  let tx = 0;
  let ty = 0;
  let rotation = 0;
  let sx = 1;
  let sy = 1;
  if (name === "idle") {
    const wave = Math.sin((index / count) * Math.PI * 2);
    ty = -1.6 * wave;
    rotation = radial ? 1.2 * wave : 0.8 * wave;
    sx = 1 - 0.008 * wave;
    sy = 1 + 0.012 * wave;
  } else if (name === "attack-pre") {
    const ease = t * t;
    sx = radial ? 1 - 0.035 * ease : 1 - 0.055 * ease;
    sy = 1 + 0.05 * ease;
    tx = radial ? 0 : -3.5 * ease;
    rotation = radial ? -2.2 * ease : -1.2 * ease;
  } else if (name === "attack") {
    const recoil = [0.35, 0.8, 1, 0.72, 0.32, 0][index] ?? 0;
    sx = radial ? 1 + 0.075 * recoil : 1 - 0.045 * recoil;
    sy = radial ? 1 + 0.075 * recoil : 1 + 0.035 * recoil;
    tx = radial ? 0 : -7 * recoil;
    ty = radial ? -2 * recoil : 4 * recoil;
    rotation = radial ? 3.5 * recoil : -2.3 * recoil;
  } else if (name === "attack-post") {
    const rebound = [1, -0.4, 0.18, 0][index] ?? 0;
    sx = 1 + 0.025 * rebound;
    sy = 1 - 0.018 * rebound;
    tx = radial ? 0 : 2.4 * rebound;
    rotation = radial ? -1.4 * rebound : 0.9 * rebound;
  }
  return { tx, ty, rotation, sx, sy };
}

function attackEffect(gameId, state, index) {
  if (state !== "attack") return "";
  const alpha = [0.12, 0.55, 1, 0.7, 0.3, 0.05][index] ?? 0;
  const scale = [0.55, 0.82, 1.18, 1, 0.76, 0.45][index] ?? 1;
  const common = `opacity="${fmt(alpha)}" transform="scale(${fmt(scale)})"`;
  if (gameId === "pulse") {
    return `<g ${common} transform-origin="218px 120px"><circle cx="218" cy="120" r="17" fill="#FFF8A3"/><circle cx="234" cy="111" r="9" fill="#D8FF64"/></g>`;
  }
  if (gameId === "cryo") {
    return `<g opacity="${fmt(alpha)}"><path d="M120 121H230" stroke="#DFFFFF" stroke-width="18" stroke-linecap="round"/><path d="M132 121H231" stroke="#65DFFF" stroke-width="7" stroke-linecap="round"/><circle cx="120" cy="121" r="${fmt(24 * scale)}" fill="none" stroke="#F6FFFF" stroke-width="7"/></g>`;
  }
  if (gameId === "plasma") {
    return `<g ${common} transform-origin="211px 83px"><circle cx="211" cy="83" r="20" fill="#FFF49A"/><path d="M220 83L239 73L232 92Z" fill="#FFB541"/></g>`;
  }
  if (gameId === "tesla") {
    return `<g opacity="${fmt(alpha)}"><circle cx="120" cy="121" r="${fmt(34 * scale)}" fill="none" stroke="#FFF58A" stroke-width="8"/><path d="M120 121L153 110L171 124L201 105L232 116" stroke="#F7D9FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return `<g opacity="${fmt(alpha)}"><circle cx="120" cy="120" r="${fmt(67 + 24 * scale)}" fill="none" stroke="#FFF19A" stroke-width="${fmt(10 * scale)}"/><circle cx="120" cy="120" r="${fmt(82 + 18 * scale)}" fill="none" stroke="#FFB43F" stroke-width="5"/></g>`;
}

function animatedSvg(levelSvg, tower, animation, frameIndex) {
  const defsEnd = levelSvg.indexOf("</defs>");
  const split = defsEnd >= 0 ? defsEnd + "</defs>".length : levelSvg.indexOf(">") + 1;
  const prefix = levelSvg.slice(0, split);
  const body = levelSvg.slice(split).replace(/<\/svg>\s*$/, "");
  const radial = ["cryo", "tesla", "buffer"].includes(tower.gameId);
  const transform = stateTransform(animation.name, frameIndex, animation.frames, radial);
  const transformCenterY = tower.gameId === "pulse" ? 120 : 126;
  const matrix = `translate(${fmt(transform.tx)} ${fmt(transform.ty)}) translate(120 ${transformCenterY}) rotate(${fmt(transform.rotation)}) scale(${fmt(transform.sx)} ${fmt(transform.sy)}) translate(-120 -${transformCenterY})`;
  return `${prefix}\n<g transform="${matrix}">${body}${attackEffect(tower.gameId, animation.name, frameIndex)}</g>\n</svg>\n`;
}

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function atlasSvg(frameSvgs, cellSize = 512) {
  const columns = 6;
  const rows = 4;
  const images = [];
  animations.forEach((animation, row) => {
    for (let frame = 0; frame < animation.frames; frame += 1) {
      const key = `${animation.name}-${String(frame).padStart(2, "0")}`;
      images.push(`<image href="${dataUri(frameSvgs.get(key))}" x="${frame * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}"/>`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cellSize}" height="${rows * cellSize}" viewBox="0 0 ${columns * cellSize} ${rows * cellSize}">${images.join("")}</svg>\n`;
}

ensureDir(buildDir);
ensureDir(path.join(buildDir, "atlas-svg"));
ensureDir(path.join(packDir, "source", "towers"));
ensureDir(path.join(packDir, "metadata", "towers"));

const generated = [];
for (const tower of towers) {
  const original = fs.readFileSync(path.join(legacyTowerDir, tower.source), "utf8");
  const levels = [];
  for (let level = 1; level <= 3; level += 1) {
    const levelSvg = addUpgrade(original, tower, level);
    const sourceDir = path.join(packDir, "source", "towers", tower.id);
    ensureDir(sourceDir);
    const sourcePath = path.join(sourceDir, `lv${level}.svg`);
    fs.writeFileSync(sourcePath, levelSvg);

    const frameSvgs = new Map();
    for (const animation of animations) {
      for (let frame = 0; frame < animation.frames; frame += 1) {
        frameSvgs.set(
          `${animation.name}-${String(frame).padStart(2, "0")}`,
          animatedSvg(levelSvg, tower, animation, frame)
        );
      }
    }
    const atlasSourcePath = path.join(buildDir, "atlas-svg", `${tower.id}-lv${level}.svg`);
    fs.writeFileSync(atlasSourcePath, atlasSvg(frameSvgs));
    levels.push({
      level,
      source: path.relative(packDir, sourcePath),
      master: `masters/towers/${tower.id}/lv${level}/base.png`,
      icon: `runtime/icons/${tower.id}-lv${level}@2x.png`,
      detail: `runtime/detail/${tower.id}-lv${level}@2x.png`,
      atlas: `runtime/atlases/${tower.id}-lv${level}@2x.png`,
      atlasMetadata: `runtime/atlases/${tower.id}-lv${level}@2x.json`
    });
  }

  const metadata = {
    schemaVersion: 1,
    packId: "fyt01",
    unitId: tower.id,
    gameId: tower.gameId,
    displayName: tower.displayName,
    role: tower.role,
    skill: tower.skill,
    levelCount: 3,
    sourceSize: [1024, 1024],
    runtimeCellSize: [128, 128],
    detailSize: [512, 512],
    fps: 12,
    facingZeroDeg: "right",
    coordinates: "top-left origin; +x right; +y down; normalized 0..1",
    anchors: {
      placement: tower.placement,
      aimPivot: tower.aimPivot,
      muzzle: tower.muzzle,
      effectOrigin: tower.effectOrigin
    },
    attackDirection: tower.attackDirection,
    animations,
    levels: levels
  };
  fs.writeFileSync(
    path.join(packDir, "metadata", "towers", `${tower.id}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`
  );
  generated.push({ ...tower, levels });
}

const manifest = {
  schemaVersion: 1,
  packId: "fyt01",
  generatedAt: new Date().toISOString(),
  sourceReference: "User-provided 476x331 screenshot used only for style direction; existing project SVGs are the production source.",
  license: "Project-local derivative assets; inherits the source SVG ownership and license.",
  display: { battlefieldCssPx: 64, detailCssPx: 240 },
  masters: { size: [1024, 1024], format: "RGBA PNG", colorSpace: "sRGB", alpha: "straight" },
  runtime: { cellSize: [128, 128], atlasGrid: [6, 4], textureFilter: "linear", rotated: false },
  towers: generated.map(({ source, ...tower }) => ({ ...tower, preview: `previews/${tower.id}-attack-demo.gif` }))
};
fs.writeFileSync(path.join(packDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const baseImages = [];
for (let level = 1; level <= 3; level += 1) {
  towers.forEach((tower, column) => {
    const svg = fs.readFileSync(path.join(packDir, "source", "towers", tower.id, `lv${level}.svg`), "utf8");
    baseImages.push(`<image href="${dataUri(svg)}" x="${column * 1024}" y="${(level - 1) * 1024}" width="1024" height="1024"/>`);
  });
}
fs.writeFileSync(
  path.join(buildDir, "masters.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="5120" height="3072" viewBox="0 0 5120 3072">${baseImages.join("")}</svg>\n`
);

console.log(`Prepared ${towers.length * 3} level sources and ${towers.length * 3} animation atlases.`);
