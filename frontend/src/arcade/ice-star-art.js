(function (global) {
  'use strict';
  const script = document.currentScript;
  const root = script ? new URL('../assets/garden/ice-star/', script.src).href : './assets/garden/ice-star/';
  const towers = new Image(), effects = new Image();
  towers.src = root + 'towers-v1.png'; effects.src = root + 'effects-v1.png';
  const poses = ['idle', 'charge', 'release', 'recoil', 'recover'];
  // 主体源矩形保留原 alpha；花芯锚点独立于每帧不同的留白与伸缩。
  const towerFrames = [
    [[56,116,248,209,187,225],[366,126,211,198,480,228],[639,116,258,209,766,225],[949,127,223,198,1072,228],[1249,115,247,212,1378,225]],
    [[57,414,249,217,183,525],[367,427,216,202,480,528],[638,416,264,215,766,526],[951,428,231,203,1070,526],[1250,413,247,219,1375,525]],
    [[53,695,254,228,184,808],[363,714,225,204,478,813],[639,696,271,227,766,810],[946,716,241,206,1070,813],[1244,695,256,228,1375,808]]
  ];
  const effectFrames = {
    snowball:[89,113,198,193], trail:[417,156,343,131], muzzle:[872,96,218,231], contact:[1236,100,215,215],
    impact:[61,397,258,240], iceA:[422,429,140,181], iceB:[590,433,116,178],
    leafA:[820,464,119,136], leafB:[1020,481,93,113],
    snowA:[1300,432,64,60], snowB:[1236,500,69,65], snowC:[1372,533,55,52],
    snowD:[1423,477,50,48], snowE:[1305,570,34,34],
    patchBirth:[61,767,265,155], patchActive:[388,713,356,234], patchFade:[801,720,328,213],
    twinkle:[1190,797,76,86], twinkleLarge:[1284,768,119,124], twinkleSmall:[1413,789,74,84]
  };
  const motion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function drawEffect(ctx,name,x,y,width,height,anchorX=0.5,anchorY=0.5) {
    const rect=effectFrames[name];
    if (!rect || !effects.complete || !effects.naturalWidth) return false;
    ctx.drawImage(effects,...rect,x-width*anchorX,y-height*anchorY,width,height);
    return true;
  }
  function drawTower(ctx,level,pose,size) {
    if (!towers.complete || !towers.naturalWidth) return false;
    const row=towerFrames[Math.max(0,Math.min(2,level-1))];
    const frame=row[Math.max(0,poses.indexOf(pose))], scale=size*0.96/row[0][2];
    ctx.drawImage(towers,frame[0],frame[1],frame[2],frame[3],
      (frame[0]-frame[4])*scale,(frame[1]-frame[5])*scale,frame[2]*scale,frame[3]*scale);
    return true;
  }
  function paintPreview(canvas) {
    const ctx=canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save();
    ctx.translate(canvas.width*0.52,canvas.height*0.52);
    drawTower(ctx,Number(canvas.dataset.iceLevel)||1,'idle',Math.min(canvas.width,canvas.height)*0.9);
    ctx.restore();
  }
  function paintPreviews(rootElement) {
    (rootElement||document).querySelectorAll('canvas[data-ice-level]').forEach(paintPreview);
  }
  towers.addEventListener('load',()=>paintPreviews());
  global.addEventListener('DOMContentLoaded',()=>paintPreviews());
  global.IceStarArt={drawTower,drawEffect,paintPreview,paintPreviews,towerFrames,effectFrames,root,
    get reducedMotion(){return !!(motion&&motion.matches);}};
})(window);
