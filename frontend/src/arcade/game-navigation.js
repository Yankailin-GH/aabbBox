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
    const start = document.querySelector("#screen-home .home-top-actions, #start .start-panel, #start .start-card, #start .panel-body");
    const homeExit = start && start.querySelector("[data-game-exit]");
    if (homeExit) homeExit.addEventListener("click", exit);
    else button(start, "退出游戏", exit);
    if (!document.getElementById("btn-home-fullscreen")) global.GameDisplay.addFullscreenButton(start);
    if (document.querySelector(".game-shell .game-bar")) {
      const bar = document.querySelector(".game-shell .game-bar");
      bar.style.gridTemplateColumns = "44px 44px 44px minmax(0,1fr) 44px";
      bar.style.gap = "6px";
      const fullscreen = global.GameDisplay.addFullscreenButton(bar);
      bar.prepend(fullscreen);
      const back = button(bar, "退出", exit);
      bar.prepend(back);
    }
    const paused = document.querySelector("#paused .pause-panel, #paused .panel-body");
    global.GameDisplay.addFullscreenButton(paused);
    const penultimate = paused && paused.querySelector("[data-pause-penultimate]");
    if (penultimate) paused.appendChild(penultimate);
    button(paused, "返回游戏首页", () => {
      const back = document.querySelector("#quit, #back-start");
      if (back) back.click();
    });
    button(document.querySelector(".success-sheet"), "返回游戏首页", () => global.location.reload());

    // Embedded games request fullscreen from their launch component instead.
    // A standalone mobile page must request it during a user interaction.
    if (global.top === global && !document.getElementById("btn-home-fullscreen")) {
      let requested = false;
      document.addEventListener("click", event => {
        if (requested || !event.target.closest("#start-btn, #start-button, #phasePrompt")) return;
        requested = true;
        global.GameDisplay.requestFullscreen();
      }, true);
    }
  });
})(window);
