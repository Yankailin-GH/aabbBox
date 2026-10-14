(function (global) {
  "use strict";

  // Device identity stays independent of window size and screen orientation.
  function isDesktop() {
    const nav = global.navigator;
    const agent = nav.userAgent || "";
    const platform = nav.platform || "";
    const touchPoints = nav.maxTouchPoints || 0;

    if (nav.userAgentData && nav.userAgentData.mobile) return false;
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|IEMobile|BlackBerry|BB10|Silk|Kindle|webOS/i.test(agent)) return false;
    // iPadOS can identify itself as a Mac when requesting desktop websites.
    if (/Mac/i.test(platform + " " + agent) && touchPoints > 1) return false;
    // A touch-capable Windows computer still uses the desktop entry policy.
    if (/Win|Mac|Linux|CrOS/i.test(platform + " " + agent)) return true;

    const touchOnly = touchPoints > 0 && global.matchMedia
      && global.matchMedia("(pointer: coarse) and (hover: none)").matches;
    return !touchOnly;
  }

  function fullscreenDocument() {
    try { return global.top.document; } catch (error) { return global.document; }
  }

  function isFullscreen() {
    const doc = fullscreenDocument();
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
  }

  async function requestFullscreen(automatic = true) {
    if (automatic && isDesktop()) return false;
    const doc = fullscreenDocument();
    const root = doc.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen || root.mozRequestFullScreen || root.msRequestFullscreen;
    if (!isFullscreen() && request) {
      try { await request.call(root); } catch (error) { /* The game remains in its window when native fullscreen is blocked. */ }
    }
    if (!isDesktop() && global.screen && global.screen.orientation && global.screen.orientation.lock) {
      try { await global.screen.orientation.lock("portrait"); } catch (error) { /* Orientation locking is optional. */ }
    }
    return isFullscreen();
  }

  async function exitFullscreen() {
    const doc = fullscreenDocument();
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
    if (isFullscreen() && exit) {
      try { await exit.call(doc); } catch (error) { /* Keep the game available if the browser rejects the request. */ }
    }
    if (global.screen && global.screen.orientation && global.screen.orientation.unlock) {
      try { global.screen.orientation.unlock(); } catch (error) { /* Orientation locking is optional. */ }
    }
  }

  function toggleFullscreen() {
    return isFullscreen() ? exitFullscreen() : requestFullscreen(false);
  }

  function addFullscreenButton(parent) {
    if (!parent) return;
    const button = global.document.createElement("button");
    button.type = "button";
    button.className = "game-navigation-button game-fullscreen-button";
    const update = () => {
      button.textContent = isFullscreen() ? "退出全屏" : "全屏";
      button.setAttribute("aria-label", isFullscreen() ? "退出全屏" : "进入全屏");
    };
    button.addEventListener("click", () => { toggleFullscreen().then(update); });
    const doc = fullscreenDocument();
    doc.addEventListener("fullscreenchange", update);
    doc.addEventListener("webkitfullscreenchange", update);
    // Parent documents can outlive an iframe after the game is closed.
    global.addEventListener("pagehide", () => {
      doc.removeEventListener("fullscreenchange", update);
      doc.removeEventListener("webkitfullscreenchange", update);
    }, { once: true });
    update();
    parent.appendChild(button);
    return button;
  }

  global.GameDisplay = Object.freeze({ isDesktop, isFullscreen, requestFullscreen, exitFullscreen, toggleFullscreen, addFullscreenButton });
})(window);
