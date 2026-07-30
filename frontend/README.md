# AABB Toolbox H5

移动端 H5 工具箱，使用 HTML、CSS 和 Vue 3 构建。当前已接入打牌计分板、幸运转盘、JSON 格式化、随机生成、图片压缩、提词器等工具。

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
