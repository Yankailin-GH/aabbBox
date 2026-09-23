# AABB Toolbox H5

移动端 H5 工具箱，使用 HTML、CSS 和 Vue 3 构建。游戏区包含果果拼拼乐、裂隙远征、花园防线、深渊采样、荒原车队、天穹守望、影域潜行和熔核锻造，并保留计分板、图片处理与开发辅助等工具。

## 本地预览

直接用浏览器打开 `index.html` 即可预览。

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
