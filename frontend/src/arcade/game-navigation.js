(function (global) {
  "use strict";
  const homeUrl = new URL("../../index.html#/", document.currentScript.src).href;
  function exit() {
    if (global.speechSynthesis) global.speechSynthesis.cancel();
    global.top.location.href = homeUrl;
  }
  function button(parent, label, action) {
    if (!parent) return;
    const element = document.createElement("button");
    element.type = "button";
    element.className = "game-navigation-button";
    element.textContent = label;
    element.addEventListener("click", action);
    parent.appendChild(element);
    return element;
  }
  global.GameNavigation = { exit, button };
  document.addEventListener("DOMContentLoaded", () => {
    const start = document.querySelector("#screen-home .home-top-actions, #start .start-panel, #start .start-card");
    button(start, "退出游戏", exit);
    if (document.querySelector(".game-shell .game-bar")) {
      const bar = document.querySelector(".game-shell .game-bar");
      bar.style.gridTemplateColumns = "44px 44px minmax(0,1fr) 44px";
      bar.style.gap = "6px";
      const back = button(bar, "退出", exit);
      bar.prepend(back);
    }
    button(document.querySelector("#paused .pause-panel"), "返回游戏首页", () => {
      const back = document.querySelector("#quit, #back-start");
      if (back) back.click();
    });
    button(document.querySelector("#upgrade .upgrade-head"), "返回游戏首页", () => {
      document.getElementById("quit").click();
      const upgrade = document.getElementById("upgrade");
      upgrade.classList.remove("show");
      upgrade.setAttribute("aria-hidden", "true");
      upgrade.inert = true;
    });
    button(document.querySelector(".success-sheet"), "返回游戏首页", () => global.location.reload());
  });
})(window);
