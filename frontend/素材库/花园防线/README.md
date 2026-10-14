# 花园防线 · 素材索引

对应 [花园防线设计说明](../../../设计说明/花园防线/README.md)。当前 PNG 图集由内置 image_gen 生成，保留透明 Alpha；游戏按校准后的源矩形和锚点绘制。

| 目录或文件 | 用途与使用情况 |
| --- | --- |
| `seed-cannon/` | 豆荚种子炮当前塔体、弹丸和命中特效 |
| `ice-star/` | 霜晶冰冻星当前塔体、雪球、冰面及裁切元数据 |
| `crystal-flower/` | 紫晶连锁花；当前使用 `towers-v2.png` 和 `effects-v2.png`，v1 保留为历史资料 |
| `fire-bottle/` | 焰籽喷火瓶当前塔体与持续火焰特效 |
| `sunflower/` | 日耀太阳花当前塔体与日耀扩散特效 |
| `monsters/` | 普通怪当前使用 `creeps-v1.png`，首领使用 `bosses-v2.png`；含身体锚点和源矩形，首领 v1 为历史资料 |
| `terrain/` | 当前地面纹理图集 |
| `remaining-towers-layout-v1.json`、`remaining-towers-layout-v2.json` | 三座花园塔的图集元数据；当前绘制采用 v2 校准数据 |
| [fyt01](fyt01/README.md) | 由本项目 SVG 原型生成的早期素材包；保留母版、帧序列、运行图集、预览和工具，当前主要使用花园图集，代码仍保留该包的回退路径 |
| `towers/` | 本项目早期 SVG 塔体及火瓶升级图；供历史菜单素材和 fyt01 生成工具使用 |
| `制作记录/` | 概念图、提示词、图集制作记录与实机预览；子目录保留版本标识 |

当前角色定位、属性、动作和命中规则见 [美术与动作规范](../../../设计说明/花园防线/美术_素材与动作规范.md)。制作记录中的旧版设计参数仅为历史记录。

## 工具入口

- 预览与 PNG 导出服务：`python3 frontend/素材库/花园防线/制作记录/garden-world-v1/preview-server.py`（在仓库根目录执行）。
- 怪物裁切校准：`制作记录/garden-world-v1/calibrate-layout.py`，运行会更新怪物元数据和绘制模块中的布局。
- 默认属性文档导出：`制作记录/garden-world-v1/export-docs.cjs`，运行会重写相关角色说明及目录索引。
- 历史素材包构建：`zsh frontend/素材库/花园防线/fyt01/tools/build.sh`（在仓库根目录执行）。
