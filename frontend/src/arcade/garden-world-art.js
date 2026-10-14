(function(global) {
  'use strict';
  const root = new URL('../../素材库/花园防线/', document.currentScript.src).href;
  const layout = /* MONSTER_LAYOUT */ {"crawler":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[65,10,193,194,161.25,117.12,159.65],[383,14,186,190,467.5,117.75,145.7],[686,13,186,191,793.0,117.25,142.6],[1001,14,181,186,1085.75,122.38,144.15]]},"scout":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[31,211,262,195,158.75,319.0,159.65],[355,212,250,201,458.0,317.75,142.6],[655,212,247,201,800.75,318.12,141.05],[983,220,245,190,1091.25,322.12,137.95]]},"phantom":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[54,425,229,189,158.5,526.0,155.0],[375,424,214,192,457.0,529.12,142.6],[667,423,216,193,800.5,528.62,142.6],[1002,427,213,189,1087.25,531.88,141.05]]},"replicator":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[46,627,227,192,159.75,728.75,162.75],[353,624,221,196,456.75,727.5,147.25],[680,624,221,196,798.0,727.88,148.8],[987,634,216,182,1090.5,731.38,139.5]]},"shielder":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[58,827,223,212,158.75,954.88,162.75],[372,828,210,211,453.5,953.25,145.7],[673,828,210,211,802.0,953.62,148.8],[1002,834,214,205,1085.0,957.25,151.9]]},"titan":{"sheet":"creeps","filename":"creeps-v1.png","frames":[[36,1043,266,200,153.75,1151.25,162.75],[351,1043,264,200,454.0,1152.25,148.8],[672,1043,256,201,800.5,1151.75,145.7],[981,1051,259,192,1085.5,1157.5,142.6]]},"boss_overlord":{"sheet":"bosses","filename":"bosses-v2.png","frames":[[38,145,359,335,204.75,334.5,246.45],[424,144,327,342,555.5,333.38,229.4],[779,148,382,338,983.75,333.88,227.85],[1170,189,347,296,1327.5,347.38,223.2]]},"boss_devourer":{"sheet":"bosses","filename":"bosses-v2.png","frames":[[32,585,339,346,195.5,785.62,244.9],[423,587,341,351,555.25,784.0,227.85],[791,586,359,352,982.5,785.38,226.3],[1189,610,335,329,1329.75,797.38,218.55]]}};
  const sheets = {};
  for (const name of ['creeps', 'bosses']) {
    const image = new Image(); image.src = root + 'monsters/' + (name === 'bosses' ? 'bosses-v2.png' : 'creeps-v1.png');
    image.addEventListener('load', () => paintPreviews()); sheets[name] = image;
  }
  const terrain = new Image(); terrain.src = root + 'terrain/tiles-v1.png';
  const motion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const poses = ['idle', 'walkLeft', 'walkRight', 'hit'];
  function drawEnemy(ctx, type, pose, bodyHalfSize) {
    const entry = layout[type], image = entry && sheets[entry.sheet];
    if (!image || !image.complete || !image.naturalWidth) return false;
    const frame = entry.frames[Math.max(0, poses.indexOf(pose))];
    // Scale by the body, not hat/weapon bounds: the game's original hit radius is preserved.
    const scale = bodyHalfSize * 2 / entry.frames[0][6];
    ctx.drawImage(image, ...frame.slice(0, 4), (frame[0] - frame[4]) * scale,
      (frame[1] - frame[5]) * scale, frame[2] * scale, frame[3] * scale);
    return true;
  }
  function tileIndex(kind, gx, gy) {
    const hash = Math.abs(gx * 37 + gy * 61);
    if (kind === 'path') return 3 + hash % 3;
    return hash % 11 === 0 ? 6 + (gx + gy) % 3 : hash % 3;
  }
  function drawTile(ctx, kind, gx, gy, x, y, size) {
    if (!terrain.complete || !terrain.naturalWidth) return false;
    const index = tileIndex(kind, gx, gy), unit = terrain.naturalWidth / 3;
    ctx.drawImage(terrain, index % 3 * unit, Math.floor(index / 3) * unit, unit, unit, x, y, size + .25, size + .25);
    return true;
  }
  function drawPath(ctx, gx, gy, x, y, size, pathTiles) {
    if (!terrain.complete || !terrain.naturalWidth) return false;
    const top = pathTiles.has(`${gx},${gy-1}`), right = pathTiles.has(`${gx+1},${gy}`),
      bottom = pathTiles.has(`${gx},${gy+1}`), left = pathTiles.has(`${gx-1},${gy}`);
    const r = size * .13, tl = !top && !left ? r : 0, tr = !top && !right ? r : 0,
      br = !bottom && !right ? r : 0, bl = !bottom && !left ? r : 0;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x+tl,y);
    ctx.lineTo(x+size-tr,y); ctx.quadraticCurveTo(x+size,y,x+size,y+tr);
    ctx.lineTo(x+size,y+size-br); ctx.quadraticCurveTo(x+size,y+size,x+size-br,y+size);
    ctx.lineTo(x+bl,y+size); ctx.quadraticCurveTo(x,y+size,x,y+size-bl);
    ctx.lineTo(x,y+tl); ctx.quadraticCurveTo(x,y,x+tl,y); ctx.closePath(); ctx.clip();
    drawTile(ctx,'path',gx,gy,x,y,size); ctx.restore();
    // A quiet grass lip on exposed edges; connected path tiles have no grid seams.
    ctx.save(); ctx.translate(x+size*.5,y+size*.5); ctx.strokeStyle='#8ead60';ctx.lineWidth=size*.022;ctx.lineCap='round';
    [top,right,bottom,left].forEach((connected,side)=>{
      if (connected) return; ctx.save();ctx.rotate(side*Math.PI/2);
      const at = (Math.abs(gx*37+gy*61+side*13)%5-2)*size*.13;
      ctx.beginPath();ctx.moveTo(at,-size*.43);ctx.quadraticCurveTo(at-size*.035,-size*.48,at-size*.055,-size*.49);
      ctx.moveTo(at,-size*.43);ctx.lineTo(at+size*.012,-size*.50);
      ctx.moveTo(at,-size*.43);ctx.lineTo(at+size*.045,-size*.48);ctx.stroke();ctx.restore();
    });ctx.restore();return true;
  }
  function paintPreview(canvas) {
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
    ctx.translate(canvas.width*.5,canvas.height*.547);ctx.scale(canvas.width/85.333,canvas.height/85.333);
    drawEnemy(ctx,canvas.dataset.enemy,'idle',19.2);ctx.restore();
  }
  function paintPreviews() { document.querySelectorAll('canvas[data-enemy]').forEach(paintPreview); }
  global.addEventListener('DOMContentLoaded',paintPreviews);
  global.GardenWorldArt={drawEnemy,drawTile,drawPath,tileIndex,paintPreviews,layout,root,
    get reducedMotion(){return !!(motion&&motion.matches);}};
})(window);
