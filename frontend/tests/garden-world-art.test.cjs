const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'../src'),html=fs.readFileSync(path.join(root,'core-breach-legacy.html'),'utf8');
const config=new Function(html.match(/const ENEMY_TYPES = \{[\s\S]*?\n\};/)[0]+';return ENEMY_TYPES;')();
const calls=[],motion={matches:false};
class ImageStub{constructor(){this.complete=true;this.naturalWidth=1536;}set src(value){this.url=value;if(value.includes('creeps')||value.includes('tiles'))this.naturalWidth=1254;}addEventListener(){}}
const scope={URL,Image:ImageStub,document:{currentScript:{src:'http://localhost/arcade/garden-world-art.js'},querySelectorAll:()=>[]},window:{matchMedia:()=>motion,addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'arcade/garden-world-art.js'),'utf8'),scope);const art=scope.window.GardenWorldArt;
const ctx=new Proxy({drawImage(...args){calls.push(args);}}, {get:(target,key)=>key in target?target[key]:()=>{},set:()=>true});
const Enemy=new Function('ENEMY_TYPES','COMBAT_SPEED_MULTIPLIER','GARDEN_WORLD_ART','SEED_CANNON_ART','sounds',html.slice(html.indexOf('class CreepEnemy {'),html.indexOf('class IcePatch {'))+';return CreepEnemy;')(config,.7,art,{reducedMotion:false},{playExplosion(){}});
const game=()=>({currentMapIndex:0,wave:1,scaleRatio:1,particles:[],floatTexts:[],totalDamage:0,getStageBaseHp:()=>100,createParticleBurst(){},createFloatingText(){}});

test('32 calibrated poses cover every shipped enemy without clipping source bounds',()=>{
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/garden/monsters/layout-v1.json'),'utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(art.layout)),metadata);assert.equal(Object.keys(metadata).length,8);
 for(const [key,entry] of Object.entries(metadata)) {
  assert(config[key]);assert.equal(entry.frames.length,4);const png=fs.readFileSync(path.join(root,'assets/garden/monsters',entry.filename)),width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.equal(png[25],6,'transparent RGBA');
  for(const f of entry.frames){assert(f[0]>=0&&f[1]>=0&&f[0]+f[2]<=width&&f[1]+f[3]<=height);assert(f[4]>=f[0]&&f[4]<f[0]+f[2]);assert(f[5]>=f[1]&&f[5]<f[1]+f[3]);assert(f[6]>100);}
  for(const pose of ['idle','walkLeft','walkRight','hit']){calls.length=0;assert.equal(art.drawEnemy(ctx,key,pose,20),true);const args=calls[0],f=entry.frames[['idle','walkLeft','walkRight','hit'].indexOf(pose)];assert(Math.abs(args[7]-f[2]*40/entry.frames[0][6])<1e-10);assert(Math.abs(args[5]-(f[0]-f[4])*40/entry.frames[0][6])<1e-10);}
 }
});

test('enemy gait, injury and reduced motion select actual poses while preserving hit radius',()=>{
 for(const type of Object.keys(config)) {
  const e=new Enemy(type,1,[{x:0,y:0},{x:0,y:200}],game()),radius=e.getSeedHitRadius(),entry=art.layout[type];e.lateralOffset=0;
  for(const [cycle,index] of [[1,2],[-1,1]]){e.walkCycle=cycle;calls.length=0;e.drawGardenBlock(ctx);assert.equal(calls[0][1],entry.frames[index][0]);assert.equal(e.getSeedHitRadius(),radius);}
  e.gardenPoseHitTime=.14;calls.length=0;e.drawGardenBlock(ctx);assert.equal(calls[0][1],entry.frames[3][0]);
  motion.matches=true;calls.length=0;e.drawGardenBlock(ctx);assert.equal(calls[0][1],entry.frames[0][0]);assert.equal(e.getRenderPosition().y,e.y);motion.matches=false;
  e.gardenPoseHitTime=0;e.speed=0;calls.length=0;e.drawGardenBlock(ctx);assert.equal(calls[0][1],entry.frames[0][0]);
 }
});

test('fully shielded hits do not produce a body injury pose; damage and movement remain unchanged',()=>{
 const g=game(),e=new Enemy('shielder',1,[{x:0,y:0},{x:0,y:200}],g),tower={type:'tesla'};
 e.takeDamage(100,'tesla',g,false,tower);assert.equal(e.hp,185);assert.equal(e.shield,45);assert.equal(e.gardenPoseHitTime,0);
 e.takeDamage(100,'tesla',g,false,tower);assert.equal(e.hp,155);assert.equal(e.shield,0);assert.equal(e.gardenPoseHitTime,.14);
 e.update(.15,g);assert.equal(e.gardenPoseHitTime,0);assert.equal(e.y,Math.ceil(45*.7)*.15);assert.equal(e.radius,18);
});

test('path and grass use separate texture cells, keep joins open and never change buildable coordinates',()=>{
 const route=new Set(['3,0','3,1','3,2']);const before=[...route];
 for(let x=0;x<7;x++)for(let y=0;y<12;y++) {
  const grass=art.tileIndex('grass',x,y),road=art.tileIndex('path',x,y);assert([0,1,2,6,7,8].includes(grass));assert([3,4,5].includes(road));assert.equal(grass,art.tileIndex('grass',x,y));
  calls.length=0;assert(art.drawTile(ctx,'grass',x,y,x*50,y*50,50));assert.equal(calls[0][3],418);assert(art.drawPath(ctx,x,y,x*50,y*50,50,route));
 }assert.deepEqual([...route],before);
});
