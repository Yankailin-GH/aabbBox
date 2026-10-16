# AABB Toolbox H5

移动端 H5 工具箱，使用 HTML、CSS 和 Vue 3 构建。游戏区包含果果拼拼乐、西游星球、弹壳打工、花园防线、深渊采样、荒原车队、天穹守望、影域潜行和熔核锻造，并保留计分板、图片处理与开发辅助等工具。

## 本地预览

直接用浏览器打开 `index.html` 即可预览。

首页使用项目内的 Vue 文件，无需连接 CDN 或执行依赖构建。也可以在 `frontend/` 目录执行 `python3 -m http.server 8080`，然后访问 `http://localhost:8080/`。

## Vue 本地依赖

- 固定版本：Vue 3.5.44，使用包含模板编译器的生产版 `vue.global.prod.js`。
- 文件路径：`src/vendor/vue/vue.global.prod.js`。
- 来源：官方 npm 包 `https://registry.npmjs.org/vue/-/vue-3.5.44.tgz`，下载后校验 npm 包的 SHA-512 完整性。
- 许可：MIT，原始许可保存在 `src/vendor/vue/LICENSE`。
- 更新时从指定版本的官方 npm 包提取 `dist/vue.global.prod.js` 和 `LICENSE`，并同步更新这里的版本说明。部署脚本会随 `frontend/` 一起上传本地依赖。

## 项目品牌素材

- AABB 标识：`src/assets/brand/aabb-logo.png`，用户提供的 PNG 原图。
- 标签页图标：`src/assets/brand/favicon.ico`，已用于首页与独立游戏页面。
- 素材来源、尺寸及引用方式见 [品牌素材说明](src/assets/brand/README.md)。

## 游戏素材库

游戏素材统一保存到 `素材库/游戏名/`，中文游戏名与仓库根目录的 `设计说明/游戏名/` 一致。在用 PNG、SVG、GIF、图集和相关元数据按角色或用途保留子目录；未使用素材、历史母版、逐帧图片、提示词、概念图、预览和生成工具统一移到根目录 `离线素材库/游戏名/`，不参与打包。

查看 [素材库索引](素材库/README.md) 可进入每个游戏的素材目录及设计说明。在线素材库位于 `frontend/` 内，保留原 URL；打包前自动核对引用并在在线／离线库之间移动文件。动态拼接素材与元数据规则保存在 `scripts/asset-rules.json`。仅使用 Canvas 或 CSS 绘制的游戏也保留分类目录，并在索引中说明当前状态。

## 工具使用次数

首页将各工具的打开次数保存在当前浏览器的 `localStorage`（键为 `aabb-toolbox-open-counts`），工具卡片右下角显示次数，并按次数从高到低排列；次数相同保持工具配置原有顺序。搜索和分类筛选沿用该排序。

顶部快捷入口显示使用次数最高的四个已启用工具，不受搜索和分类筛选影响；点击可直接打开工具。次数相同（包括尚无使用记录）时按配置原有顺序补足四个，已启用工具不足四个则全部显示。底部不再显示或记录“最近使用”。

从卡片或顶部快捷入口打开工具，以及通过工具链接或浏览器前进、后退进入工具时，每次进入记一次；刷新工具页面也记一次。尚未启用的工具不计数。“清理全部缓存”同时清空次数。浏览器禁止存储时，本次页面会话仍可计数和排序，但刷新后无法保留。

## 目录结构

```text
frontend/
  index.html
  src/
    main.js
    styles/
      base.css
      components.css
      home.css
    tools/
      index.js
      scoreboard/
        component.js
        style.css
      lucky-wheel/
        component.js
        style.css
      json-format/
        component.js
        style.css
      random-generator/
        component.js
        style.css
      image-compress/
        component.js
        style.css
      mini-tools/
        component.js
        style.css
      teleprompter/
        component.js
        style.css
      core-breach-game/
        component.js
        style.css
      arcade-games/
        component.js
        style.css
    arcade/
      arcade-kit.js
      arcade-kit.css
```

`mini-tools/` 里集中放置轻量工具实现，包括 AABB 盒子、颜色取样、色板生成、渐变生成、阴影圆角、单位换算、日期计算、JWT 解析、Base64、URL 参数、正则测试、待办清单、番茄计时、文本去重和速记便签。

## 添加工具

1. 在 `src/tools/your-tool/` 下创建工具自己的 `component.js` 和 `style.css`。
2. 在 `index.html` 里引入新工具的 CSS 和组件 JS。
3. 在 `src/tools/index.js` 里注册工具信息：

```js
{
  id: "tool-id",
  name: "工具名称",
  desc: "简短描述",
  category: "分类",
  icon: "□",
  theme: "theme-blue",
  url: "#/tools/tool-id",
  component: window.YourTool,
  enabled: true
}
```

## 素材分库与打包

```bash
python3 scripts/manage_assets.py audit  # 只读检查
python3 scripts/manage_assets.py sync   # 按当前运行引用整理两库
./pack.sh                             # 本地生成 frontend 压缩包
./pack.sh --output /绝对路径/frontend.tar.gz
```

以上命令在项目根目录执行，需Python 3.9+，不依赖 npm 构建。重新使用离线素材时只需在运行代码中引用其原 `素材库/游戏名/原路径`，同步或打包会将其恢复到在线库。缺失素材、动态规则失效或同名冲突会停止打包。`deploy.sh` 调用同一打包入口，离线资料不会上传。完整规则及来源见[离线素材库](../离线素材库/README.md)。

### 打包大小与上传进度

打包、同步和检查命令的大小统一按十进制MB显示（1 MB = 1,000,000字节），保留两位小数，例如 `onlineSize: "38.02 MB"`、`unpackedSize: "41.24 MB"`、`archiveSize: "39.19 MB"`；文件数量仍为整数。

`./deploy.sh` 上传时按文件显示简单百分比，如 `[upload] aabbbox_frontend.tar.gz 25%`。免密与密码登录均可显示，重定向到日志时同样逐行输出；只有上传成功才打印100%，失败保留错误信息并停止后续部署。进度使用Python标准库和现有scp，不需要额外安装pv或远端rsync；`./pack.sh`只生成本地包。
