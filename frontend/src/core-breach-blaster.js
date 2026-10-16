/* Magnetic blaster simulation. Shared by the game and deterministic combat tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlasterCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS=1e-9,STEP=1/120;
  const AURORA=Object.freeze({descent:.3,expand:1,seedRadius:5,beamRadius:30,opacity:.6,fade:1,groundOpacity:.4});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const branches=[['blasterField','磁场扩容'],['blasterSplit','裂核追击'],['blasterPlasma','电浆残域']];
  const sprites={core:[116,115,397,394],micro:[859,234,164,163],plasma:[87,705,464,449],collapse:[699,679,485,483]};
  function levels(s){return branches.map(([key])=>clamp(s[key]||0,0,3));}
  function ready(s){return levels(s).every(n=>n>=2);}
  function interval(s){return s.rate;}
  function radius(s){return 64+16*levels(s)[0];}
  function upgrades(s){
    const descriptions=['聚怪与主爆半径 +16','追击微核 +1，命中留下0.45秒控制磁场','电浆每秒伤害 +12%基础伤害，持续2.5秒'];
    return branches.flatMap(([key,name],i)=>{
      const n=s[key]||0;
      return n>=3?[]:[{key,name,icon:'blaster',tag:'零域脉冲炮',desc:`Lv.${n} → ${n+1} · ${descriptions[i]}`,apply(){s[key]=n+1;}}];
    });
  }
  function chooseUpgrade(s,random=Math.random){
    const options=upgrades(s);if(!options.length)return null;
    const misses=s.blasterOfferMisses||(s.blasterOfferMisses={});
    const highest=Math.max(...options.map(o=>misses[o.key]||0));
    const candidates=options.filter(o=>(misses[o.key]||0)===highest);
    const chosen=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
    for(const o of options)misses[o.key]=o===chosen?0:(misses[o.key]||0)+1;
    return chosen;
  }
  // First swept segment/circle contact; t=0 also covers a muzzle inside an enemy.
  function segment(x,y,nx,ny,e,r){
    const dx=nx-x,dy=ny-y,ox=x-e.x,oy=y-e.y,rr=e.r+r,c=ox*ox+oy*oy-rr*rr;
    if(c<=0)return 0;
    const a=dx*dx+dy*dy;if(a<EPS)return null;
    const b=2*(ox*dx+oy*dy),disc=b*b-4*a*c;if(disc<0)return null;
    const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
  }
  // A guaranteed critical strike can independently roll the ordinary critical chance again.
  function resolveHit(damage,mode,chance,random=Math.random,critDamage=2){
    const guaranteed=!!(mode&&mode.guaranteed),extraCrit=!!mode&&random()<chance;
    return {amount:damage*(guaranteed?critDamage:1)*(extraCrit?critDamage:1),crit:guaranteed||extraCrit,extraCrit:guaranteed&&extraCrit};
  }
  function auroraVisual(a,time){
    const age=time-a.born,descent=clamp(age/AURORA.descent,0,1),growth=clamp((time-a.landAt)/AURORA.expand,0,1);
    const fade=clamp((time-a.impactAt)/AURORA.fade,0,1),ease=growth*growth*(3-2*growth);
    return {head:a.y-760*(1-descent),radius:AURORA.seedRadius+(a.beamRadius-AURORA.seedRadius)*ease,alpha:age<0?0:AURORA.opacity*(1-fade)};
  }
  const collapseFrame={x:72,y:54,width:1113,height:1112};
  const holeFrame={x:125,y:116,width:1005,height:1011};
  class Combat{
    constructor(options={}){
      this.options=options;this.time=0;this.cooldown=0;
      this.cores=[];this.micros=[];this.auroras=[];this.fields=[];this.flashes=[];this.microFields=[];this.controls=new Map();this.exposure=new Map();this.auroraExposure=new Map();
      this.bounds=options.bounds||{left:20,top:20,right:980,bottom:980};
    }
    enemies(){return this.options.enemies().filter(e=>e.hp>0);}
    damage(e,amount,crit=true){
      if(amount>EPS&&e.hp>0&&this.options.enemies().includes(e))this.options.damage(e,amount,crit);
    }
    burst(x,y,r,amount,crit=true){for(const e of this.enemies())if(distance(e,{x,y})<=r+e.r)this.damage(e,amount,crit);}
    cue(kind,x,y){if(this.options.cue)this.options.cue(kind,x,y);}
    fire(player,s){
      const enemies=this.enemies().filter(e=>distance(e,player)<s.range).sort((a,b)=>distance(a,player)-distance(b,player));
      if(!enemies.length)return false;
      const [field,split,plasma]=levels(s),target=enemies[0],a=Math.atan2(target.y-player.y,target.x-player.x),b=this.bounds;
      this.cores.push({x:clamp(player.x+Math.cos(a)*28,b.left,b.right),y:clamp(player.y+Math.sin(a)*28,b.top,b.bottom),
        a,state:'flight',travel:0,range:s.range,damage:s.damage,radius:radius(s),field,split,plasma,strong:false,born:this.time,trail:[]});
      player.face=a;
      const muzzle=this.cores[this.cores.length-1];this.cue('fire',muzzle.x,muzzle.y);return true;
    }
    arm(c,time){c.state='magnet';c.armedAt=time;c.detonateAt=time+.45;c.trail=[];}
    updateAuroras(start,end){
      const s=this.options.stats&&this.options.stats(),player=this.options.player&&this.options.player();
      if(s&&player&&s.blasterAwakened&&this.cooldown<=EPS){
        const enemies=this.enemies().filter(e=>distance(e,player)<s.range).sort((a,b)=>distance(a,player)-distance(b,player));
        const target=enemies.find(e=>e.kind==='boss'||e.boss)||enemies.find(e=>e.kind==='elite')||enemies[0];
        if(target){
          const at=end,landAt=at+AURORA.descent,impactAt=landAt+AURORA.expand;
          this.auroras.push({x:target.x,y:target.y,radius:radius(s)*1.5,beamRadius:AURORA.beamRadius,damage:s.damage*6,dotDamage:s.damage,born:at,landAt,impactAt,
            armedAt:impactAt,detonateAt:impactAt+3,strong:true,state:'descending',aurora:true});
          this.cooldown=10;this.cue('aurora',target.x,target.y);
        }
      }
      for(const a of this.auroras){
        if(a.state==='descending'&&end+EPS>=a.impactAt){a.state='collapse';this.burst(a.x,a.y,a.beamRadius,a.damage,{guaranteed:true});this.flashes.push({x:a.x,y:a.y,r:a.beamRadius,born:a.impactAt,life:.24,strong:true});this.cue('collapse',a.x,a.y);}
        if(end+EPS>=a.detonateAt)a.state='done';
      }
    }
    move(c,speed,dt,radius){
      const b=this.bounds,dx=Math.cos(c.a)*speed*dt,dy=Math.sin(c.a)*speed*dt;
      let t=1;
      if(dx>0)t=Math.min(t,(b.right-c.x)/dx);else if(dx<0)t=Math.min(t,(b.left-c.x)/dx);
      if(dy>0)t=Math.min(t,(b.bottom-c.y)/dy);else if(dy<0)t=Math.min(t,(b.top-c.y)/dy);
      const room=c.range===undefined?Infinity:Math.max(0,c.range-c.travel);
      if(speed*dt>room)t=Math.min(t,room/(speed*dt));
      t=clamp(t,0,1);let hit=null;
      for(const e of (c.origin&&c.target?[c.target]:this.enemies())){
        const contact=segment(c.x,c.y,c.x+dx*t,c.y+dy*t,e,radius);
        if(contact!==null&&(!hit||contact<hit.t))hit={e,t:contact};
      }
      if(hit)t*=hit.t;
      c.trail.push({x:c.x,y:c.y});if(c.trail.length>4)c.trail.shift();
      c.x+=dx*t;c.y+=dy*t;c.travel=(c.travel||0)+speed*dt*t;
      return {hit:hit&&hit.e,used:dt*t,stopped:!!hit||t<1-EPS||c.travel>=c.range-EPS};
    }
    explode(c,time){
      this.burst(c.x,c.y,c.radius,c.damage);
      this.flashes.push({x:c.x,y:c.y,r:c.radius,born:time,life:.24,strong:c.strong,vortex:true});
      this.cue('explode',c.x,c.y);
      if(c.plasma){const duration=2.5;this.fields.push({x:c.x,y:c.y,r:c.radius*.65,damage:c.damage,rate:.12*c.plasma,born:time,end:time+duration,duration});}
      const count=c.split,assigned=new Set();
      for(let i=0;i<count;i++){
        const targets=this.enemies().filter(e=>distance(e,c)<=160).sort((a,b)=>(distance(a,c)<=c.radius+a.r?1:0)-(distance(b,c)<=c.radius+b.r?1:0)||distance(a,c)-distance(b,c));
        const target=targets.find(e=>!assigned.has(e))||targets[0];if(!target)break;assigned.add(target);
        this.micros.push({x:c.x,y:c.y,origin:{x:c.x,y:c.y,radius:c.radius},target,a:Math.atan2(target.y-c.y,target.x-c.x),damage:c.damage*.3,born:time,end:time+.6,trail:[]});
      }
    }
    update(dt,active=true){
      if(!active||!Number.isFinite(dt)||dt<=0)return;
      this.controlResumeAt=this.time+Math.min(dt,Math.max(0,this.options.freezeRemaining?.()||0));
      const end=this.time+dt;
      while(this.time<end-EPS){const until=Math.min(end,this.time+STEP);this.step(this.time,until);this.time=until;}
      this.flashes=this.flashes.filter(f=>this.time-f.born<f.life);
    }
    step(start,end){
      const dt=end-start;this.cooldown=Math.max(0,this.cooldown-dt);
      this.updateAuroras(start,end);
      const exploded=[];
      for(const c of this.cores){
        if(c.state==='flight'){
          const move=this.move(c,620,dt,6);
          if(move.stopped){if(move.hit)this.damage(move.hit,c.damage*.25);this.arm(c,start+move.used);}
        }
      }
      this.applyControls(start,end);
      for(const c of this.cores)if(c.state==='magnet'&&end+EPS>=c.detonateAt){this.explode(c,c.detonateAt);exploded.push(c);}
      if(exploded.length)this.cores=this.cores.filter(c=>!exploded.includes(c));
      const microDone=[];
      for(const m of this.micros){
        const from=Math.max(start,m.born),to=Math.min(end,m.end);if(to<from)continue;
        if(!this.enemies().includes(m.target)){
          const claimed=new Set(this.micros.filter(other=>other!==m).map(other=>other.target));
          const targets=this.enemies().filter(e=>distance(e,m.origin)<=160).sort((a,b)=>(distance(a,m.origin)<=m.origin.radius+a.r?1:0)-(distance(b,m.origin)<=m.origin.radius+b.r?1:0)||distance(a,m)-distance(b,m));
          m.target=targets.find(e=>!claimed.has(e))||targets[0];
        }
        if(m.target)m.a=Math.atan2(m.target.y-m.y,m.target.x-m.x);
        const move=m.target?this.move(m,720,Math.max(0,to-from),3):{stopped:true};
        if(move.stopped||end+EPS>=m.end){
          const x=move.hit?move.hit.x:m.x,y=move.hit?move.hit.y:m.y,at=move.hit?from+move.used:to;
          this.burst(x,y,28,m.damage);this.flashes.push({x,y,r:28,born:at,life:.16});
          if(move.hit)this.microFields.push({x,y,radius:28,born:at,end:at+.45,micro:true});
          microDone.push(m);
        }
      }
      this.micros=this.micros.filter(m=>!microDone.includes(m));
      this.applyControls(start,end);
      this.microFields=this.microFields.filter(f=>f.end>end+EPS);
      for(const [e,binding] of this.controls)if(e.hp<=0||!this.options.enemies().includes(e)||this.sourceEnd(binding.source)<=end+EPS)this.controls.delete(e);
      this.updateFields(start,end);
      this.accumulateFields(this.auroras.map(a=>({x:a.x,y:a.y,r:a.radius,damage:a.dotDamage,rate:1,born:a.impactAt,end:a.detonateAt})),this.auroraExposure,start,end);
      this.auroras=this.auroras.filter(a=>a.state!=='done');
    }
    sourceStart(source){return source.micro?source.born:source.armedAt;}
    sourceEnd(source){return source.micro?source.end:source.detonateAt;}
    controlSource(e,start=this.time,end=start){
      const sources=[...this.cores.filter(c=>c.state==='magnet'),...this.microFields];
      const active=source=>sources.includes(source)&&this.sourceStart(source)<=end+EPS&&this.sourceEnd(source)>start+EPS;
      const binding=this.controls.get(e);
      if(binding&&active(binding.source))return binding.source;
      this.controls.delete(e);
      const nearest=sources.filter(source=>active(source)&&distance(e,source)<=source.radius+e.r).sort((a,b)=>distance(e,a)-distance(e,b))[0];
      if(nearest)this.controls.set(e,{source:nearest,x:e.x,y:e.y,born:Math.max(start,this.sourceStart(nearest))});
      return nearest||null;
    }
    isControlled(e){return !!this.controlSource(e);}
    movementFactor(e){
      return this.auroras.some(a=>this.time+EPS>=a.impactAt&&this.time<a.detonateAt-EPS&&distance(e,a)<=a.radius+e.r)?.4:1;
    }
    applyControls(start,end){
      if(end<=this.controlResumeAt+EPS)return;
      start=Math.max(start,this.controlResumeAt||start);
      for(const e of this.enemies()){
        const source=this.controlSource(e,start,end);if(!source)continue;
        const binding=this.controls.get(e),at=Math.min(end,this.sourceEnd(source));
        const t=clamp((at-binding.born)/.12,0,1),ease=t*t*(3-2*t),b=this.bounds;
        e.x=clamp(binding.x+(source.x-binding.x)*ease,b.left+e.r,b.right-e.r);
        e.y=clamp(binding.y+(source.y-binding.y)*ease,b.top+e.r,b.bottom-e.r);
      }
    }
    updateFields(start,end){
      this.accumulateFields(this.fields,this.exposure,start,end);
      this.fields=this.fields.filter(f=>f.end>end+EPS);
    }
    accumulateFields(sources,pendingDamage,start,end){
      const living=this.enemies();
      for(const e of living){
        const fields=sources.filter(f=>f.born<end&&f.end>start&&distance(e,f)<=f.r+e.r);
        const cuts=[...new Set([start,end,...fields.flatMap(f=>[clamp(f.born,start,end),clamp(f.end,start,end)])])].sort((a,b)=>a-b);
        let amount=0,exposure=0;
        for(let i=1;i<cuts.length;i++){
          const a=cuts[i-1],b=cuts[i],rate=Math.max(0,...fields.filter(f=>f.born<=a+EPS&&f.end>=b-EPS).map(f=>f.damage*f.rate));
          amount+=rate*(b-a);if(rate>0)exposure+=b-a;
        }
        let pending=pendingDamage.get(e);
        if(amount>0){if(!pending){pending={amount:0,time:0};pendingDamage.set(e,pending);}pending.amount+=amount;pending.time+=exposure;}
        const remains=sources.some(f=>f.born<=end&&f.end>end+EPS&&distance(e,f)<=f.r+e.r);
        if(pending&&(pending.time>=.5-EPS||!remains)){
          this.damage(e,pending.amount,false);pending.amount=0;pending.time=0;if(!remains)pendingDamage.delete(e);
        }
      }
      for(const e of pendingDamage.keys())if(!this.options.enemies().includes(e)||e.hp<=0)pendingDamage.delete(e);
    }
    clear(){
      this.cores=[];this.micros=[];this.auroras=[];this.fields=[];this.flashes=[];this.microFields=[];this.controls.clear();this.exposure.clear();this.auroraExposure.clear();this.cooldown=0;
    }
    sprite(ctx,image,key,x,y,size,alpha=1){
      ctx.save();ctx.globalAlpha*=alpha;
      if(image&&image.complete&&image.naturalWidth){const [sx,sy,sw,sh]=sprites[key];ctx.drawImage(image,sx,sy,sw,sh,x-size/2,y-size/2,size,size);}
      else{ctx.fillStyle=key==='plasma'?'rgba(112,69,224,.25)':'#68e6ff';ctx.strokeStyle='#a884ff';ctx.lineWidth=1.5;ctx.beginPath();if(key==='plasma')ctx.arc(x,y,size/2,0,Math.PI*2);else ctx.rect(x-size*.36,y-size*.36,size*.72,size*.72);ctx.fill();ctx.stroke();}
      ctx.restore();
    }
    drawRocketFlame(ctx,c){
      const micro=!!c.origin,age=Math.max(0,this.time-c.born),pulse=1+Math.sin(age*69+c.x*.07)*.13;
      const length=(micro?19:c.strong?43:34)*pulse,half=micro?3.5:c.strong?7:5.5,rear=micro?4:7;
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.globalCompositeOperation='lighter';
      const flame=ctx.createLinearGradient(-rear-length,0,-rear+2,0);
      flame.addColorStop(0,'rgba(10,64,255,0)');flame.addColorStop(.38,'rgba(26,108,255,.7)');flame.addColorStop(.8,'#42d4ff');flame.addColorStop(1,'#ebfeff');
      ctx.fillStyle=flame;ctx.shadowColor='#258fff';ctx.shadowBlur=micro?4:7;
      ctx.beginPath();ctx.moveTo(-rear+2,-half*.7);ctx.quadraticCurveTo(-rear-length*.38,-half*1.3,-rear-length,0);ctx.quadraticCurveTo(-rear-length*.4,half*1.3,-rear+2,half*.7);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#c7f9ff';ctx.beginPath();ctx.moveTo(-rear+2,-half*.38);ctx.lineTo(-rear-length*.58,0);ctx.lineTo(-rear+2,half*.38);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(85,179,255,.65)';ctx.lineWidth=micro?.7:1.2;
      for(let i=0;i<2;i++){const t=(age*6+i*.5)%1,x=-rear-length*(.4+t*.75),y=(i?1:-1)*half*(.35+t);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4*(1-t),y);ctx.stroke();}
      ctx.restore();
    }
    drawCracks(ctx,x,y,radius,alpha){
      if(alpha<=0)return;
      ctx.save();ctx.translate(x,y);ctx.globalAlpha*=alpha;ctx.lineJoin='round';
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7+(x+y)*.007,turn=(i%2?1:-1)*.12;
        const points=[{x:Math.cos(a)*radius*.58,y:Math.sin(a)*radius*.58},{x:Math.cos(a+turn)*radius*.78,y:Math.sin(a+turn)*radius*.78},{x:Math.cos(a-turn*.7)*radius*.95,y:Math.sin(a-turn*.7)*radius*.95},{x:Math.cos(a+turn*.5)*radius*1.12,y:Math.sin(a+turn*.5)*radius*1.12}];
        const path=()=>{ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);};
        ctx.beginPath();for(let j=0;j<points.length;j++){const w=3.8*(1-j/(points.length-.3)),p=points[j];if(j===0)ctx.moveTo(p.x-Math.sin(a)*w,p.y+Math.cos(a)*w);else ctx.lineTo(p.x-Math.sin(a)*w,p.y+Math.cos(a)*w);}for(let j=points.length-1;j>=0;j--){const w=3.8*(1-j/(points.length-.3)),p=points[j];ctx.lineTo(p.x+Math.sin(a)*w,p.y-Math.cos(a)*w);}ctx.closePath();ctx.fillStyle='#020b13';ctx.fill();
        path();ctx.strokeStyle='#17324a';ctx.lineWidth=1.3;ctx.stroke();path();ctx.strokeStyle='#194477';ctx.lineWidth=.55;ctx.stroke();
        const branch=points[2],ba=a+(i%2?.48:-.48),bx=branch.x+Math.cos(ba)*radius*.23,by=branch.y+Math.sin(ba)*radius*.23;
        ctx.beginPath();ctx.moveTo(branch.x,branch.y);ctx.lineTo(bx,by);ctx.strokeStyle='#030d19';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#214569';ctx.lineWidth=.55;ctx.stroke();
        ctx.fillStyle=i%2?'#193341':'#243d48';ctx.beginPath();const q=points[3];ctx.moveTo(q.x+3,q.y);ctx.lineTo(q.x+6,q.y-4);ctx.lineTo(q.x+10,q.y+1);ctx.lineTo(q.x+5,q.y+3);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    drawVortex(ctx,image,x,y,radius,phase,strong,scale=1,alpha=1){
      const r=radius*scale;if(r<=.01||alpha<=0)return;
      ctx.save();ctx.translate(x,y);ctx.globalAlpha*=alpha;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
      const halo=ctx.createRadialGradient(0,0,r*.13,0,0,r);
      halo.addColorStop(0,'rgba(1,8,27,.94)');halo.addColorStop(.38,strong?'rgba(3,22,89,.65)':'rgba(9,57,146,.24)');halo.addColorStop(.92,strong?'rgba(20,67,152,.3)':'rgba(28,117,232,.25)');halo.addColorStop(1,'rgba(65,153,255,.08)');
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.rotate(phase);
      if(image&&image.complete&&image.naturalWidth){
        if(strong)ctx.filter='brightness(0.52) saturate(1.45)';
        const f=holeFrame;ctx.drawImage(image,f.x,f.y,f.width,f.height,-r,-r,r*2,r*2);
      }else{
        // The fallback keeps a dark horizon and three inward spiral arms.
        ctx.shadowColor=strong?'#123fba':'#247cff';ctx.shadowBlur=7;ctx.lineWidth=Math.max(1.4,r*.045);ctx.strokeStyle=strong?'#1f55c2':'#42c9ff';
        for(let i=0;i<3;i++){ctx.beginPath();for(let j=0;j<=24;j++){const t=j/24,a=i*Math.PI*2/3+t*3.5,rr=r*(.64-t*.46);const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();}
      }
      ctx.restore();
      ctx.fillStyle='#02091b';ctx.beginPath();ctx.arc(0,0,r*.135,0,Math.PI*2);ctx.fill();
      ctx.shadowColor=strong?'#134bbd':'#56cfff';ctx.shadowBlur=5;ctx.strokeStyle=strong?'#2f6ed2':'#91e6ff';ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(0,0,r*.17,phase,-.18+phase+Math.PI*1.7);ctx.stroke();
      ctx.shadowBlur=0;
      ctx.restore();
    }
    drawGround(ctx,image,holeImage,collapseImage){
      for(const f of this.fields){
        const left=f.end-this.time,fade=Math.min(1,left/.3,(this.time-f.born)/.08);
        ctx.save();ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.clip();
        ctx.fillStyle='rgba(75,95,213,.12)';ctx.fill();
        this.sprite(ctx,image,'plasma',f.x,f.y,f.r*2,.36*Math.max(0,fade));ctx.restore();
      }
      for(const f of this.flashes)if(f.vortex){
        const t=clamp((this.time-f.born)/.14,0,1);
        if(f.strong)this.drawCracks(ctx,f.x,f.y,f.r,clamp((f.life-(this.time-f.born))/f.life,0,1));
        this.drawVortex(ctx,holeImage,f.x,f.y,f.r,this.time*1.44,!!f.strong,Math.pow(1-t,1.5),1-t);
      }
      for(const f of this.microFields){
        const age=Math.max(0,this.time-f.born),fade=Math.min(1,age/.06,(f.end-this.time)/.08);
        this.drawVortex(ctx,holeImage,f.x,f.y,f.radius,age*6,false,1,Math.max(0,fade)*.85);
      }
      for(const a of this.auroras)if(a.state==='descending'){
        const t=clamp(this.time-a.born,0,1);ctx.save();ctx.globalAlpha=.2+t*.35;ctx.strokeStyle='#418eff';ctx.lineWidth=1.2;
        ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(a.x,a.y,a.beamRadius-.6,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(a.x-7,a.y);ctx.lineTo(a.x+7,a.y);ctx.moveTo(a.x,a.y-7);ctx.lineTo(a.x,a.y+7);ctx.stroke();ctx.restore();
      }
      for(const a of this.auroras)if(a.state==='collapse')this.drawCollapse(ctx,collapseImage,a);
      for(const c of this.cores)if(c.state==='magnet'){
        const age=Math.max(0,this.time-c.armedAt),fraction=clamp(age/(c.detonateAt-c.armedAt),0,1);
        const emerge=clamp(age/.09,0,1),phase=age*1.44+(c.x+c.y)*.01;
        if(c.strong)this.drawCracks(ctx,c.x,c.y,c.radius,emerge*.95);
        this.drawVortex(ctx,holeImage,c.x,c.y,c.radius,phase,c.strong,1,.4+.6*emerge);
        ctx.save();ctx.translate(c.x,c.y);
        for(let i=0;i<3;i++){
          const inward=(age*2+i/3)%1,rr=c.radius*(.91-.62*inward);
          ctx.globalAlpha=Math.sin(inward*Math.PI)*.36;ctx.strokeStyle=c.strong?'#2458ae':'#54cfff';ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(0,0,rr,phase+i*2.1,phase+i*2.1+1.15);ctx.stroke();
        }
        for(let i=0;i<8;i++){
          const t=(age*1.7+i/8)%1,a=i*2.4+phase+t*2.6,r=c.radius*(.9-.72*t);
          ctx.globalAlpha=Math.sin(t*Math.PI)*.85;ctx.strokeStyle=c.strong?'#2f70cf':'#80dcff';ctx.lineWidth=1.2;
          ctx.beginPath();ctx.moveTo(Math.cos(a-.12)*(r+3),Math.sin(a-.12)*(r+3));ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.stroke();
        }
        ctx.globalAlpha=.5+fraction*.4;ctx.strokeStyle=c.strong?'#2d69c4':'#a6eeff';ctx.lineWidth=1.3;
        ctx.beginPath();ctx.arc(0,0,c.radius*.29,phase*1.3,phase*1.3+Math.PI*1.4);ctx.stroke();ctx.restore();
      }
    }
    drawCollapse(ctx,image,a){
      const age=Math.max(0,this.time-a.impactAt),r=a.radius,fade=clamp((a.detonateAt-this.time)/.35,0,1);
      ctx.save();ctx.globalAlpha*=AURORA.groundOpacity*fade;ctx.beginPath();ctx.arc(a.x,a.y,r,0,Math.PI*2);ctx.clip();
      if(image&&image.complete&&image.naturalWidth){
        const f=collapseFrame;
        ctx.drawImage(image,f.x,f.y,f.width,f.height,a.x-r,a.y-r,r*2,r*2);
      }else{
        // Broken slabs remain readable even if the new transparent artwork cannot load.
        ctx.save();ctx.translate(a.x,a.y);ctx.fillStyle='#1a123a';ctx.beginPath();
        for(let i=0;i<14;i++){const angle=i*Math.PI*2/14,rr=r*(i%2?.9:.98),x=Math.cos(angle)*rr,y=Math.sin(angle)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
        for(let i=0;i<9;i++){
          const angle=i*Math.PI*2/9,rr=r*(i%2?.64:.73),x=Math.cos(angle)*rr,y=Math.sin(angle)*rr;
          ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=i%2?'#3e3c5b':'#514c6c';ctx.strokeStyle='#090c20';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(-r*.18,-r*.17);ctx.lineTo(r*.16,-r*.14);ctx.lineTo(r*.23,r*.08);ctx.lineTo(-r*.10,r*.18);ctx.lineTo(-r*.24,r*.04);ctx.closePath();ctx.fill();ctx.stroke();
          ctx.strokeStyle='#4eacff';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-r*.18,-r*.17);ctx.lineTo(-r*.24,r*.04);ctx.lineTo(-r*.10,r*.18);ctx.stroke();ctx.restore();
        }
        ctx.restore();this.drawCracks(ctx,a.x,a.y,r,.9);
      }
      ctx.restore();
    }
    drawAurora(ctx,a){
      const visual=auroraVisual(a,this.time);if(visual.alpha<=0)return;
      const head=visual.head,top=head-760,w=visual.radius;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=visual.alpha;
      // Straight parallel sides; all yellow bloom is contained within the column radius.
      ctx.beginPath();ctx.rect(a.x-w,top,w*2,head-top+6);ctx.clip();
      const column=ctx.createLinearGradient(a.x-w,0,a.x+w,0);
      column.addColorStop(0,'#70caff');column.addColorStop(.12,'#8bd8ff');column.addColorStop(.35,'#d9f8ff');column.addColorStop(.5,'#f4fdff');column.addColorStop(.65,'#d9f8ff');column.addColorStop(.88,'#8bd8ff');column.addColorStop(1,'#70caff');
      ctx.fillStyle=column;ctx.fillRect(a.x-w,top,w*2,head-top);
      ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#ffdf60';ctx.lineWidth=Math.min(3.5,w*.35);ctx.shadowColor='#ffcd42';ctx.shadowBlur=8;
      for(const sign of [-1,1]){const x=a.x+sign*(w-ctx.lineWidth/2);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,head);ctx.stroke();}
      ctx.shadowBlur=0;ctx.fillStyle='#e8fbff';ctx.beginPath();ctx.ellipse(a.x,head,w,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    draw(ctx,image){
      for(const a of this.auroras)this.drawAurora(ctx,a);
      for(const f of this.flashes){const t=clamp((this.time-f.born)/f.life,0,1);ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle=f.strong?'#597cff':'#a9ecff';ctx.lineWidth=3*(1-t)+1;for(let i=0;i<8;i++){const angle=i*Math.PI/4+.08;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.3+.65*t),angle,angle+.42);ctx.stroke();}ctx.restore();}
      for(const c of [...this.cores,...this.micros]){
        if(c.state==='magnet')continue;
        this.drawRocketFlame(ctx,c);
        ctx.save();ctx.strokeStyle=c.strong?'rgba(36,85,190,.65)':'rgba(104,207,255,.4)';ctx.lineWidth=c.target?1:2;
        if(c.trail.length){ctx.beginPath();ctx.moveTo(c.trail[0].x,c.trail[0].y);for(const pt of c.trail)ctx.lineTo(pt.x,pt.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
        const key=c.strong?'collapse':c.origin?'micro':'core';this.sprite(ctx,image,key,c.x,c.y,c.strong?23:c.origin?10:17);
        ctx.restore();
      }
    }
  }
  return {Combat,levels,ready,interval,radius,upgrades,chooseUpgrade,segment,sprites,resolveHit,AURORA,auroraVisual,collapseFrame};
});
