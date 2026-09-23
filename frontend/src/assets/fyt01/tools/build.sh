#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
pack_dir=${script_dir:h}
build_dir="$pack_dir/.build"
chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
renderer="$build_dir/render_assets"

mkdir -p "$build_dir" "$build_dir/atlas-png" "$build_dir/logs"
mkdir -p "$pack_dir/masters/towers" "$pack_dir/runtime/atlases" "$pack_dir/runtime/icons"
mkdir -p "$pack_dir/runtime/detail" "$pack_dir/previews"

node "$script_dir/generate_sources.mjs"

clang -fobjc-arc "$script_dir/render_assets.m" -o "$renderer" \
  -framework AppKit -framework ImageIO -framework UniformTypeIdentifiers

capture_svg() {
  local input=$1
  local output=$2
  local width=$3
  local height=$4
  local name=${output:t:r}
  local profile
  profile=$(mktemp -d "/tmp/fyt01-chrome-${name}.XXXXXX")
  rm -f "$output"
  "$chrome_bin" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --hide-scrollbars \
    --disable-background-networking \
    --disable-component-update \
    --disable-sync \
    --metrics-recording-only \
    --no-first-run \
    --user-data-dir="$profile" \
    --default-background-color=00000000 \
    --screenshot="$output" \
    --window-size="$width,$height" \
    "file://$input" >"$build_dir/logs/${name}.log" 2>&1 &
  local chrome_pid=$!
  local ready=0
  for _ in {1..150}; do
    if [[ -s "$output" ]]; then
      ready=1
      break
    fi
    sleep 0.1
  done
  kill "$chrome_pid" >/dev/null 2>&1 || true
  wait "$chrome_pid" >/dev/null 2>&1 || true
  if [[ "$ready" -ne 1 ]]; then
    cat "$build_dir/logs/${name}.log"
    return 1
  fi
}

towers=(
  t01-pulse-gatling
  t02-cryo-emitter
  t03-plasma-mortar
  t04-tesla-coil
  t05-quantum-buffer
)

if [[ "${FYT01_REUSE_RENDERS:-0}" != "1" || ! -s "$build_dir/masters.png" ]]; then
  capture_svg "$build_dir/masters.svg" "$build_dir/masters.png" 5120 3072
fi

for row in {0..2}; do
  level=$((row + 1))
  for column in {0..4}; do
    tower=${towers[$((column + 1))]}
    master_dir="$pack_dir/masters/towers/$tower/lv$level"
    mkdir -p "$master_dir"
    rm -f "$master_dir/base.png"
    "$renderer" crop "$build_dir/masters.png" "$master_dir/base.png" \
      $((column * 1024)) $((row * 1024)) 1024 1024
    sips --resampleHeightWidth 512 512 "$master_dir/base.png" \
      --out "$pack_dir/runtime/detail/$tower-lv$level@2x.png" >/dev/null
    sips --resampleHeightWidth 128 128 "$master_dir/base.png" \
      --out "$pack_dir/runtime/icons/$tower-lv$level@2x.png" >/dev/null
  done
done

states=(idle attack-pre attack attack-post)
frame_counts=(6 4 6 4)

for tower in $towers; do
  for level in {1..3}; do
    atlas_master="$build_dir/atlas-png/$tower-lv$level.png"
    if [[ "${FYT01_REUSE_RENDERS:-0}" != "1" || ! -s "$atlas_master" ]]; then
      capture_svg "$build_dir/atlas-svg/$tower-lv$level.svg" "$atlas_master" 3072 2048
    fi
    sips --resampleHeightWidth 512 768 "$atlas_master" \
      --out "$pack_dir/runtime/atlases/$tower-lv$level@2x.png" >/dev/null

    for row in {0..3}; do
      state=${states[$((row + 1))]}
      frame_count=${frame_counts[$((row + 1))]}
      state_dir="$pack_dir/masters/towers/$tower/lv$level/$state"
      mkdir -p "$state_dir"
      for ((frame = 0; frame < frame_count; frame++)); do
        frame_name=$(printf "frame-%02d.png" "$frame")
        rm -f "$state_dir/$frame_name"
        "$renderer" crop "$atlas_master" "$state_dir/$frame_name" \
          $((frame * 512)) $((row * 512)) 512 512
      done
    done
  done

  gif_frames=()
  idle_dir="$pack_dir/masters/towers/$tower/lv3/idle"
  pre_dir="$pack_dir/masters/towers/$tower/lv3/attack-pre"
  attack_dir="$pack_dir/masters/towers/$tower/lv3/attack"
  post_dir="$pack_dir/masters/towers/$tower/lv3/attack-post"
  for cycle in 1 2; do
    for frame in {0..5}; do gif_frames+=("$idle_dir/$(printf 'frame-%02d.png' "$frame")"); done
  done
  for frame in {0..3}; do gif_frames+=("$pre_dir/$(printf 'frame-%02d.png' "$frame")"); done
  for frame in {0..5}; do gif_frames+=("$attack_dir/$(printf 'frame-%02d.png' "$frame")"); done
  for frame in {0..3}; do gif_frames+=("$post_dir/$(printf 'frame-%02d.png' "$frame")"); done
  for frame in {0..5}; do gif_frames+=("$idle_dir/$(printf 'frame-%02d.png' "$frame")"); done
  "$renderer" gif "$pack_dir/previews/$tower-attack-demo.gif" 384 0.12 $gif_frames
done

node "$script_dir/finalize_manifest.mjs"

echo "fyt01 asset pack built at $pack_dir"
