# fyt01 塔防美术素材包

`fyt01` 是基于项目现有五座塔 SVG 原型制作的独立素材包。用户提供的截图仅用于确认“圆润、高饱和、糖果釉面”的休闲塔防方向；截图中的界面文字不构成本素材包的制作指令。

## 已交付内容

- 五座塔、每座三级外观，共 15 张 `1024x1024` 透明 PNG 母版。
- 每级四段透明 PNG 帧序列：`idle` 6 帧、`attack-pre` 4 帧、`attack` 6 帧、`attack-post` 4 帧。
- 每级一份 `128px` 单元格运行图集及 JSON 帧数据。
- `128x128` 战场图标和 `512x512` 菜单详情图。
- 每座塔一段约 `3.84s` 的三级攻击演示 GIF。
- 每座塔的锚点、发射点、技能、方向与动画事件元数据。
- 可重复运行的源生成及渲染工具。

## 五塔设定

| ID | 名称 | 定位与技能 | 攻击方向 |
|---|---|---|---|
| `t01-pulse-gatling` | 瓶子炮 | 高频单体；三级追加约 48% 伤害的副弹 | 炮口朝目标旋转，360° |
| `t02-cryo-emitter` | 冰冻星 | 直线穿透；减速约 36%，持续约 2.5s | 星核朝目标直线发射，360° |
| `t03-plasma-mortar` | 火瓶子 | 持续锁定；每次命中叠加约 18%，最多 7 层 | 瓶口朝目标旋转，360° |
| `t04-tesla-coil` | 水晶 | 单体晶能光束；相邻塔增伤约 18%/28%/40% | 中央晶核全向放射 |
| `t05-quantum-buffer` | 太阳花 | 周期性日耀脉冲，攻击范围内全部敌人 | 花芯中心 360° 扩散 |

三级升级被保留。Lv.1 保留轻量基础轮廓；Lv.2 增加对称嵌入式护轨、晶面或花瓣纹；Lv.3 强化成对护翼、五向晶面与八向日耀纹。取消悬空圆点、虚线环和通用底部等级珠。升级装饰不会改变公共画布和落地点。

## 目录

```text
fyt01/
  source/towers/<tower-id>/lv1.svg ... lv3.svg
  masters/towers/<tower-id>/lv<n>/base.png
  masters/towers/<tower-id>/lv<n>/<state>/frame-00.png ...
  runtime/atlases/<tower-id>-lv<n>@2x.png/.json
  runtime/icons/<tower-id>-lv<n>@2x.png
  runtime/detail/<tower-id>-lv<n>@2x.png
  metadata/towers/<tower-id>.json
  previews/<tower-id>-attack-demo.gif
  docs/ANIMATION.md
  docs/TECHNICAL.md
  manifest.json
  preview.html
  tools/
```

## 视觉规范

- 正视略俯视；完整无遮挡；主体约占画布 75%-82%。
- 粗而干净的同色系深色轮廓，不使用纯黑描边。
- 左上高光、右下柔和暗部；圆润玩具与糖果釉面质感。
- 透明背景；无文字、UI、地台、水印、人物或写实材质。
- 战场按约 `64 CSS px` 显示，使用 `128x128 @2x` 图标或图集单元。
- 菜单按约 `240 CSS px` 显示，使用 `512x512 @2x` 详情图。

## 使用说明

打开 `preview.html` 可查看三级静态图与攻击 GIF。当前游戏已接入五塔三级外观：瓶子炮播放运行图集，其余四塔使用对应等级图标，配合 Canvas 呼吸、后坐力和战斗特效。建造菜单、检视图标与详情图均使用同一套素材。火瓶子按原图右上 30° 的炮轴修正转向；加载失败时保留原有 Canvas 绘制。

重新生成素材：

```bash
zsh frontend/src/assets/fyt01/tools/build.sh
```

生成过程只写入 `fyt01`，不会覆盖原有 `frontend/src/assets/towers/*.svg`。

