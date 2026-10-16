import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(packDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function sha256(relativePath) {
  const bytes = fs.readFileSync(path.join(packDir, relativePath));
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const frameRows = {
  idle: { row: 0, frames: 6, durationMs: 120, loop: true },
  "attack-pre": { row: 1, frames: 4, durationMs: 80, loop: false },
  attack: { row: 2, frames: 6, durationMs: 80, loop: false, event: { frame: 2, name: "fire" } },
  "attack-post": { row: 3, frames: 4, durationMs: 100, loop: false }
};

for (const tower of manifest.towers) {
  for (const level of tower.levels) {
    const atlasMeta = {
      schemaVersion: 1,
      image: path.basename(level.atlas),
      size: [768, 512],
      cellSize: [128, 128],
      grid: [6, 4],
      rotated: false,
      trimmed: false,
      pivot: tower.placement,
      anchors: tower.anchors,
      animations: {}
    };
    for (const [name, config] of Object.entries(frameRows)) {
      atlasMeta.animations[name] = {
        durationMs: config.durationMs,
        loop: config.loop,
        event: config.event ?? null,
        frames: Array.from({ length: config.frames }, (_, frame) => ({
          frame: { x: frame * 128, y: config.row * 128, w: 128, h: 128 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
          sourceSize: { w: 128, h: 128 },
          pivot: { x: tower.placement[0], y: tower.placement[1] }
        }))
      };
    }
    fs.writeFileSync(path.join(packDir, level.atlasMetadata), `${JSON.stringify(atlasMeta, null, 2)}\n`);
    level.sha256 = {
      source: sha256(level.source),
      master: sha256(level.master),
      icon: sha256(level.icon),
      detail: sha256(level.detail),
      atlas: sha256(level.atlas),
      atlasMetadata: sha256(level.atlasMetadata)
    };
  }
  tower.previewSha256 = sha256(tower.preview);
}

manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Updated atlas metadata and SHA-256 checksums.");
