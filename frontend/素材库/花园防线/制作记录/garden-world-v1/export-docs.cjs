// Export current default attributes directly from the game; no gameplay state is changed.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../../..');
const html=fs.readFileSync(path.join(root,'frontend/src/core-breach-legacy.html'),'utf8');
const config=name=>new Function(html.match(new RegExp('const '+name+' = \\{[\\s\\S]*?\\n\\};'))[0]+';return '+name+';')();
const towers=config('TOWER_CONFIGS'),enemies=config('ENEMY_TYPES');
const destination=path.join(root,'设计说明/花园防线');fs.mkdirSync(destination,{recursive:true});
const n=value=>Number(value.toFixed(4));
const up=value=>Math.ceil(value-1e-9);
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.join(' | ')+' |').join('\n');
const clock='本文记录当前代码的默认值。时间、移速和每秒输出均以游戏模拟时间计；主循环 `dt = 现实时间 × 倍速 × 0.5`，所以1x下1模拟秒约对应2现实秒。射程和速度按画布 `scaleRatio` 等比缩放。伤害、生命、费用、移速和参考范围默认向上取整；攻速、时间及倍率保留小数精度。百分比以整数向上显示，实际计算保留原比例。屏幕缩放与移动坐标允许小数。持续火焰累计小数余量后按整数扣血，避免逐帧取整改变输出。玩家自定义配置、邻格增伤、超频和怪物防御会改变实战值。';
const artRoot='../../frontend/素材库/花园防线/';
const source='[游戏源代码](../../frontend/src/core-breach-legacy.html)';
const towerMeta={
 pulse:{role:'快速单体 / 二连发',shape:'绿色圆润豆荚、琥珀种芯、奶油色炮口与托叶；各级逐渐增加种芯和叶冠，朝目标转向。',folder:'seed-cannon',sheet:'cannons-v1.png',mechanics:'优先瞄准射程内沿路线走得最远的可见怪物。压缩阶段参考60ms，完整动作最长320ms；动作周期随攻击间隔缩短，超频时进一步压缩。\n\n一级、二级每轮一发；三级首发出膛后延迟300ms向同一对象射出第二发，伤害为首发最终伤害的80%，飞行速度为首发的92%。首发暴击会同步提高第二发伤害，第二发不单独掷暴击。多个待发的第二发独立排队。目标死亡或离场后，第二发保留视觉命中但不再次扣血；首发蓄力期间目标失效会重新选敌。',tips:'适合长直路段和漏怪补刀。与霜晶冰冻星组合延长目标驻留时间；在紫晶连锁花邻格布置可提升伤害。三级收益集中在同目标二连发。',effect:'种子弹与飞行尾迹保留2倍视觉尺寸；命中特效取消整体2倍放大，接触闪光采用0.48格、撞击星采用0.58格，种壳与叶片采用其他花园塔相同的尺寸基准。碎片扩散距离、护盾接触弧和花粉不再整体放大；轨迹、出膛闪光、接触闪光、种子硬壳碎片、叶片和尘屑仍调用实际素材。命中位于渲染身体边缘，视觉轻推不会改变怪物路线。'},
 cryo:{role:'雪球单体伤害 / 冰面范围减速',shape:'冰蓝五角星、暖金星核与青绿托叶；二级增加晶芽，三级强化冰冠。',folder:'ice-star',sheet:'towers-v1.png',mechanics:'可直接瞄准尚未显形的薄荷忍者。常态蓄力100ms投出一枚雪球，完整动作最长420ms；雪球飞行速度300 × scaleRatio，轻微抛物弧只影响视觉。\n\n雪球对锁定目标造成一次伤害，命中后以目标逻辑位置生成冰面。冰面仅减速，不产生持续伤害或额外范围伤害；重叠冰面速度系数相乘，最低保留20%移速。离开冰面立即按当前覆盖层重新计算速度。目标已死亡或离场时不再扣血，但仍在雪球记录的落点生成冰面并播放命中。护盾吸收伤害仍可留下冰面。\n\n实际攻击频率由冰面基础持续时间反推：`1 / max(0.5, slowDuration) × 等级频率系数`，不使用配置 fireRate 作为独立频率，也不乘0.7。',tips:'布置在路线交叉口或拐弯处，使多个怪物经过同一片冰面。适合显形忍者、压制风叶斥候，并帮助焰籽喷火瓶维持锁定。',effect:'雪球、冰晶尾迹、冰片、霜叶与雪粒使用透明图集；冰面有出生、稳定和消散阶段，显示范围对应真实减速半径。'},
 tesla:{role:'连锁伤害 / 邻格增伤',shape:'向上生长的雷电紫晶花苞、两侧分叉晶角与两片绿叶底座；中心金色闪电纹在小尺寸下也清楚。一级双晶角，二级增加金色侧芽与中间晶芽，三级形成三叉雷电晶冠。',folder:'crystal-flower',sheet:'towers-v2.png',effectSheet:'effects-v2.png',mechanics:'首个目标遵循最远路线进度优先，普通瞄准跳过未显形忍者。每次命中后，从当前目标周围选择最近且未被本轮命中的怪物继续传递。每个目标承受完整本轮伤害，没有逐跳衰减；连锁后续筛选不额外检查隐身，因此可以跳到隐身怪物。\n\n邻格增伤覆盖周围八格（含对角线），不作用于自身；多座紫晶连锁花同时覆盖时取最大增伤百分比，不相加。花的邻格增伤不提升攻速与射程。',tips:'靠近密集路线，让短距离连锁覆盖多个目标。把主输出塔摆在邻格，优先覆盖更多输出位；分散过远的怪物难以完成连锁。',effect:'五姿态晶枝动作：待机舒展、蓄力内收、释放时晶角张开并出现短闪电、后坐和恢复。金白色锯齿电弧、分叉电花、带闪电纹的晶片与叶片、雷纹增伤环使用二版素材。电弧端点追随渲染位置，连锁范围依然使用逻辑坐标。'},
 plasma:{role:'持续单体火焰 / 3秒锁定增伤',shape:'橙红种芯瓶、短奶油瓶颈与绿色托叶；瓶内火种为一、二、三颗，瓶口朝向目标。',folder:'fire-bottle',sheet:'towers-v1.png',mechanics:'持续锁定一个可见目标；旧目标仍在射程内时保留它。锁定时间从0增长到3秒，伤害线性增加到峰值；切换、死亡或丢失目标后从0重新蓄力。\n\n每帧连续扣血而不是发射离散子弹：`基础DPS = 等级伤害 × 有效攻速`，`峰值DPS = 基础DPS × (1 + rampPerHit × maxRampStacks × 1.3^(等级-1))`。当前 rampPerHit=0.18、maxRampStacks=7；这两个字段参与连续增伤幅度，不代表实际逐发叠层。积分计算跨帧蓄力面积，维持不同刷新率下输出一致。\n\n持续火焰不单独进行15%随机暴击；超频提升有效频率后会提高持续输出。配置 bulletSpeed=720 是历史字段，当前持续光束不使用它。',tips:'适合高血量南瓜骑士与首领。优先覆盖长路段，搭配冰面减速，让同一目标停留至少3模拟秒；频繁换目标会损失增伤收益。',effect:'真实火焰条带从瓶口延伸到目标，宽度随蓄力增长；命中节拍约0.16秒，调用火星、火片、叶片、接触爆闪及余辉素材。'},
 buffer:{role:'以自身为中心的范围群攻',shape:'金黄色日耀花瓣、棕金花盘和绿色托叶；二级增加花芽，三级形成奶油花尖双层冠。',folder:'sunflower',sheet:'towers-v1.png',mechanics:'先找到射程内可见目标触发攻击，再同时结算自身半径范围内所有存活怪物，没有目标数量上限。范围判定使用怪物逻辑中心，不逐个等待扩散环到达。\n\n每轮暴击只掷一次，若触发则所有目标使用相同的1.8倍最终伤害；暴击标识只在首个命中对象显示。范围内的未显形忍者可被顺带击中，但它不能独自触发普通瞄准。日耀扩散动画不产生第二次伤害。',tips:'适合路线交汇处、成群的绿芽小方和泡泡园丁分裂后的密集目标。范围较短，应以覆盖路段数作为布置依据。',effect:'以真实射程生成火焰扩散环，内部保留半透明黄色火焰光晕、余辉与小火苗，随外圈一同扩散和消退；塔体与怪物仍清晰可辨。花瓣射线、花瓣碎片、叶片、种屑和花粉均来自图集。'}
};
const enemyMeta={
 crawler:{role:'基础成群怪物',look:'浅绿圆润方体、两片嫩芽、奶油背带裤与小脚。',mechanics:'沿路径移动，无特殊防御或技能。泡泡园丁死亡后生成的三个小方也使用此类型，继承当前路径进度，构造血量额外乘0.6。',tips:'豆荚种子炮负责单体清理，日耀太阳花处理密集群体。'},
 scout:{role:'快速突进怪物',look:'天青薄荷方体、短叶翅、浅金围巾和头顶嫩芽。',mechanics:'实际已启用的区别是高移速与5%减伤。配置 evasion=0.25 为25%闪避设定，当前命中/伤害代码没有执行随机闪避；应视为预留参数，不能据此计算当前生存能力。翅膀是造型，不改变行走路径或绕过道路。',tips:'用霜晶冰冻星减速，豆荚种子炮补刀，防止快速穿过短射程防区。'},
 phantom:{role:'隐身突袭怪物',look:'薰衣草紫方体、紫色兜帽、薄荷叶尖与小魔杖。',mechanics:'未显形时身体以25%透明度显示，除霜晶冰冻星外的防御塔普通瞄准会跳过它。受到伤害后显形2.5秒；冰冻星可以直接锁定，连锁和范围攻击可以在满足触发条件时顺带伤害它。EMP设置显形4秒后调用takeDamage，takeDamage当前会重新赋值为2.5秒，所以实际计时以2.5秒为准。第0关始终显形。',tips:'用霜晶冰冻星先显形，再让其他输出塔集火；EMP也可以破局。'},
 replicator:{role:'死亡分裂怪物',look:'玫粉方体、浅粉围裙、绿叶领结与两枚泡泡装饰。',mechanics:'正式关卡死亡时生成3只绿芽小方，每只构造HP额外乘0.6，从死亡位置附近继续原路线，继承已走进度。小方的血量由当时关卡、波次与0.6重新计算，不是母体血量的60%。母体和后续小方分别结算各自击败奖励。第0关禁用分裂、积分和奖励，保持单怪测试。',tips:'日耀太阳花与紫晶连锁花适合处理分裂后出现的密集目标，冰面能限制后续小方。'},
 shielder:{role:'护盾重甲怪物',look:'粉蓝骑士方体、奶油叶盔、绿色叶盾与浅色腰甲。',mechanics:'出生时获得120点独立护盾，护盾先承受经过防御折减的伤害，超出的部分扣生命。当前不恢复护盾，也没有向附近怪物提供护盾的逻辑；shieldAura字段实际只用于启用自身初始护盾。EMP先将护盾置0，再造成280点无视防御的伤害。',tips:'持续输出可破盾；EMP直接清除护盾。盾被完全吸收的种子/雪球命中仍显示接触效果，但不闪烁身体受伤层。'},
 titan:{role:'高血量重装怪物',look:'南瓜橙方体、玉绿叶帽、琥珀肩甲和短木耙。',mechanics:'45%减伤，普通伤害只承受55%；没有额外技能或范围攻击。脚步会周期性扬起轻尘，木耙仅为辨识造型。',tips:'焰籽喷火瓶保持锁定达到满蓄力，搭配霜晶冰冻星延长灼烧时间；EMP可无视45%防御。'},
 boss_overlord:{role:'第10波首领',look:'玫红方体、三尖花冠、短玫瑰披肩、玉叶领饰与玫瑰权杖。',mechanics:'正式第10波生成1只，波次队列额外生命系数1.5。进入终点扣5点花园生命。bossSkill=emp 表示设计中的花粉脉冲干扰，当前更新逻辑没有首领施法、范围干扰或塔停机行为，文档不将其作为已生效能力。',tips:'长路线集中持续伤害，使用超频强化主输出；EMP可以伤害并眩晕它。'},
 boss_devourer:{role:'第20波终局首领',look:'夜莓紫方体、金叶礼帽、短绒紫披风、绿叶胸针与收拢的紫色伞杖。',mechanics:'正式第20波生成1只，波次队列额外生命系数2。进入终点扣5点花园生命。bossSkill=shieldShift 为设计预留，目前没有跃迁或自动生成护盾逻辑，出生护盾为0；翅膀、礼帽和伞杖只用于辨识。',tips:'利用霜晶冰冻星与焰籽喷火瓶形成长时间输出窗口，配合邻格紫晶增伤和主输出超频。'}
};
const towerFiles=[],enemyFiles=[];
for(const [type,c] of Object.entries(towers)) {
 const m=towerMeta[type],filename='防御塔_'+c.name+'.md';towerFiles.push([type,c.name,filename]);
 const rows=[1,2,3].map(level=>{
  const g=1.3**(level-1),damage=up(c.damage*c.levelDamage[level-1]),rate=type==='cryo'?1/Math.max(.5,c.slowDuration)*g:c.fireRate*c.levelRate[level-1]*.7;
  const investment=c.cost+c.upgradeCosts.slice(0,level-1).reduce((a,b)=>a+b,0);
  return ['Lv.'+level,n(damage),n(rate),n(1/rate),up(c.range*c.levelRange[level-1]),level===1?c.cost:c.upgradeCosts[level-2],investment,up(investment*.75)];
 });
 let extra='';
 if(type==='cryo')extra=table(['等级','单层减速（整数显示）','冰面半径','冰面持续秒'],[1,2,3].map(l=>['Lv.'+l,up(Math.min(.8,c.slowRate*1.3**(l-1))*100)+'%',up(c.splashRadius*1.3**(l-1)),n(c.slowDuration*1.3**(l-1))]));
 if(type==='tesla')extra=table(['等级','总命中上限（含首目标）','单跳距离','邻格增伤（整数显示）'],[1,2,3].map(l=>['Lv.'+l,c.chainTargets[l-1],up(c.chainRange*1.3**(l-1)),up(c.buffDmg*1.3**(l-1)*100)+'%']));
 if(type==='plasma')extra=table(['等级','初始DPS（整数显示）','3秒峰值DPS（整数显示）','峰值倍率'],[1,2,3].map(l=>{const g=1.3**(l-1),d=up(c.damage*c.levelDamage[l-1])*c.fireRate*c.levelRate[l-1]*.7,b=1+c.rampPerHit*c.maxRampStacks*g;return['Lv.'+l,up(d),up(d*b),n(b)+'倍'];}));
 if(type==='pulse')extra='默认种子飞行速度680，第二发626，均乘scaleRatio；三级非暴击首发100、第二发80，一轮合计180。';
 if(type==='buffer')extra='范围内目标数量没有上限。一级、二级、三级单目标普通伤害分别为51、82、131。';
 const crit=type==='plasma'?'持续光束不掷随机暴击。':'攻击轮次暴击概率15%、倍率1.8；表格按非暴击列出。';
 const doc=`# ${c.name}\n\n- 类型：防御塔；代码标识：\`${type}\`。\n- 定位：${m.role}。\n- 默认版记录：2026-10-13；数据来源：${source}。\n\n## 概念与外观\n\n${m.shape}\n\n${c.desc}\n\n## 三级属性\n\n${clock}\n\n${table(['等级','单次/基础伤害','有效频率/秒','间隔/秒','参考射程','建造/本次升级','累计投入','出售返还'],rows)}\n\n基础伤害系数为1 / 1.6 / 2.56，频率和射程系数为1 / 1.3 / 1.69。${crit}超频期间有效攻速乘3.5。出售按累计投入的75%向上取整返还，默认配置价格如表。\n\n## 专属属性\n\n${extra}\n\n## 攻击与技能规则\n\n${m.mechanics}\n\n## 动作与命中表现\n\n${m.effect}\n\n塔体使用三级、每级五姿态图集：待机、蓄力、释放、后坐和恢复。系统开启减少动态效果时保留静态塔体与清晰的接触反馈。\n\n## 布置与测试建议\n\n${m.tips}\n\n第0关选择本塔、任意等级与单一怪物；建议生命设为2000，先用静止目标观察，再启用移动和慢放。第0关免费建造与升级、限制一座塔，击败或离场后0.8模拟秒补怪，不结算正式关卡星级。\n\n## 素材与实现\n\n- [塔体图集](${artRoot}${m.folder}/${m.sheet})\n- [攻击与打击图集](${artRoot}${m.folder}/${m.effectSheet||'effects-v1.png'})\n- 实现：\`DefensiveTower\` 与对应素材绘制模块。\n- 维护约定：后续同类设计文档统一保存于本目录，名称格式为\`防御塔_中文名字.md\`；更新数值时同时更新此文档及游戏图鉴。\n`;
 fs.writeFileSync(path.join(destination,filename),doc);
}
for(const [type,c] of Object.entries(enemies)) {
 const category=c.isBoss?'精英怪':'普通怪';const m=enemyMeta[type],filename=category+'_'+c.name+'.md';enemyFiles.push([type,c.name,filename]);
 const radius=c.isBoss?c.radius:18,first=[100,110,121].map(b=>up(b*c.hpMultiplier));
 const attrs=[['生命倍率',c.hpMultiplier+'倍'],['防御减伤',n(c.defense*100)+'%'],['承受普通伤害',n((1-c.defense)*100)+'%'],['配置移速',c.speed],['有效移速（scaleRatio=1）',up(c.speed*.7)+' / 模拟秒'],['1x现实参考移速（scaleRatio=1）',n(up(c.speed*.7)*.5)+' / 秒'],['配置半径',c.radius],['运行逻辑半径',radius+' × scaleRatio'],['初始护盾',c.shieldAura?120:0],['击败能量',c.reward],['击败积分',c.score],['进入终点扣生命',c.isBoss?5:1],['类型',category]];
 let boss='';
 if(c.isBoss){const w=type==='boss_overlord'?10:20,k=type==='boss_overlord'?1.5:2;boss='\n\n'+table(['正式出场波次','队列额外系数','花圃01生命','花圃02生命','花圃03生命'],[[w,k,...[100,110,121].map(b=>up(b*c.hpMultiplier*Math.pow(1.12,w-1)*Math.pow(1.14,w-1)*k))]])+'\n\n该表按默认配置和正式波次队列计算，不含自定义配置。';}
 const sheet=c.isBoss?'bosses-v2.png':'creeps-v1.png';
 fs.writeFileSync(path.join(destination,filename),`# ${c.name}\n\n- 类型：${category}；代码标识：\`${type}\`。\n- 定位：${m.role}。\n- 默认版记录：2026-10-13；数据来源：${source}。\n\n## 角色与造型\n\n${m.look}所有怪物采用有厚度的圆润小方体、深色竖眼和清晰表情，与植物守卫、草地和暖色石板路统一。\n\n## 默认属性\n\n${clock}\n\n${table(['属性','默认值'],attrs)}\n\n普通怪物运行时统一使用18 × scaleRatio逻辑半径，配置中的原始radius列为设定数据；首领使用自身配置半径。素材的帽子、翅膀与武器不扩大命中判定。\n\n## 生命计算与波次成长\n\n构造器公式：\`HP = ceil(关卡基础HP × 生命倍率 × 1.12^(波次-1) × hpScale)\`。三张正式地图基础HP分别为100、110、121。正式波次队列又传入\`hpScale = 1.14^(波次-1)\`，因此普通正式生成叠乘两项波次成长；首领还有专属额外系数。\n\n${table(['基准参考','花圃01','花圃02','花圃03'],[['第1波、hpScale=1',...first]])}\n\n参考行只用于比较类型，不代表本怪物一定在第1波出场。${boss}\n\n## 能力与行为\n\n${m.mechanics}\n\n伤害先按防御折减并向上取整，再消耗护盾，最后扣生命；持续火焰先累积各来源的小数余量，按累计结果整数扣血，EMP无视防御。到达终点按表扣花园生命。正式击败后积分立即增加，能量通过飞行金币结算。\n\n## 动作与受击反馈\n\n每种怪物有待机、左步行走、右步行走和受击四姿态；沿路线移动时保持直立，行走姿态随步频交替。实际生命受伤时受击姿态持续0.14模拟秒，护盾完全吸收伤害时不触发生命受伤姿态。静止、眩晕或系统减少动态效果下使用待机；隐身、护盾、霜晶、眩晕及血条由独立层绘制。\n\n## 应对与测试建议\n\n${m.tips}\n\n第0关可选择此怪物与任意单塔，生命由测试配置直接覆盖（默认300，范围1–1000000），可切换静止/移动并慢放。测试中怪物始终显形、关闭分裂、不发能量和积分；击败或到达终点后0.8模拟秒自动补一只，不扣花园生命。\n\n## 素材与实现\n\n- [四姿态怪物图集](${artRoot}monsters/${sheet})\n- [源矩形与身体锚点](${artRoot}monsters/layout-v1.json)\n- 绘制模块：[garden-world-art.js](../../frontend/src/arcade/garden-world-art.js)。\n- 实现：\`ENEMY_TYPES.${type}\`、\`CreepEnemy\` 和正式波次队列。\n- 维护约定：后续同类设计文档统一保存于本目录，名称格式为\`${category}_中文名字.md\`；实际规则和设计预留字段应分别标明。\n`);
}
fs.writeFileSync(path.join(destination,'README.md'),`# 花园防线 · 设计说明\n\n本目录统一保存花园防线的角色、塔、地图和效果设计说明。防御塔文件使用\`防御塔_名字.md\`，普通怪文件使用\`普通怪_名字.md\`，精英怪文件使用\`精英怪_名字.md\`；未来地图文档使用\`地图_名字.md\`。代码标识保持稳定，中文名称同步游戏界面。\n\n当前含5座防御塔、6种普通怪、2种精英怪（首领），记录日期2026-10-13。数值从游戏默认配置读取，机制按当前实现说明。\n\n## 防御塔\n\n${table(['代码类型','中文名','文档'],towerFiles.map(([t,name,file])=>[t,name,'['+file+']('+file+')']))}\n\n## 普通怪\n\n${table(['代码类型','中文名','文档'],enemyFiles.filter(([t])=>!enemies[t].isBoss).map(([t,name,file])=>[t,name,'['+file+']('+file+')']))}\n\n## 精英怪\n\n荆棘女王与夜莓伯爵归为精英怪，保留其首领定位。\n\n${table(['代码类型','中文名','文档'],enemyFiles.filter(([t])=>enemies[t].isBoss).map(([t,name,file])=>[t,name,'['+file+']('+file+')']))}\n\n## 数值口径\n\n${clock}\n\n怪物正式波次生命同时使用构造器1.12成长和队列1.14成长；闪避、首领干扰/跃迁为当前未执行的预留参数，相关文档已标明。\n\n## 美术素材\n\n素材保存于[游戏素材目录](../../frontend/素材库/花园防线/)，分类、来源与使用情况见[素材索引](../../frontend/素材库/花园防线/README.md)。本轮使用内置image_gen生成原始PNG，保留透明alpha，再由游戏按源矩形绘制。\n\n- [怪物与地图提示词](../../frontend/素材库/花园防线/制作记录/garden-world-v1/prompts.json)\n- [三座新塔提示词](../../frontend/素材库/花园防线/制作记录/garden-towers-v1/prompts.json)\n- [三塔实际战斗画面](../../frontend/素材库/花园防线/制作记录/garden-towers-v1/combat-preview.png)\n\n后续新增或更新角色设计时先维护本目录，并同步配置、图鉴、素材锚点和有意义的规则验证。\n`);
console.log('Exported',towerFiles.length+enemyFiles.length,'character documents + README to',destination);

fs.appendFileSync(path.join(destination,'README.md'),'\n## 地图与美术\n\n- [地图_花圃与路径.md](地图_花圃与路径.md)\n- [美术_素材与动作规范.md](美术_素材与动作规范.md)\n- [美术_紫晶连锁花雷电二版.md](美术_紫晶连锁花雷电二版.md)\n');
fs.appendFileSync(path.join(destination,'README.md'),'\n## 交互规则\n\n- [交互_设备识别与全屏.md](交互_设备识别与全屏.md)\n');
