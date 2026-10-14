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
