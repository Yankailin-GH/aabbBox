# AABB Toolbox H5

移动端 H5 工具箱，使用 HTML、CSS 和 Vue 3 构建。当前已接入打牌计分板工具。

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
```

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
