(function (global) {
  if (!global.Vue) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p class="fallback-message">Vue 本地依赖加载失败，请确认 src/vendor/vue/vue.global.prod.js 文件完整后刷新页面。</p>'
    );
    throw new Error("Vue is required to run the toolbox homepage.");
  }

  const { createApp, computed, onBeforeUnmount, onMounted, ref } = global.Vue;
  const tools = global.ToolboxTools || [];
  const openCountsStorageKey = "aabb-toolbox-open-counts";

  createApp({
    setup() {
      const keyword = ref("");
      const selectedCategory = ref("全部");
      const toast = ref("");
      const route = ref(getRoute());
      const openCounts = ref(loadOpenCounts());
      const settingsOpen = ref(false);
      const cacheConfirming = ref(false);
      let toastTimer = 0;
      let cacheConfirmTimer = 0;

      const greeting = computed(() => {
        const hour = new Date().getHours();

        if (hour < 6) return "夜深了";
        if (hour < 12) return "早上好";
        if (hour < 18) return "下午好";
        return "晚上好";
      });

      const activeTool = computed(() => tools.find((tool) => tool.url === route.value) || null);

      const currentToolComponent = computed(() => {
        if (!activeTool.value || !activeTool.value.component) return null;
        return activeTool.value.component;
      });

      const currentPage = computed(() => {
        if (route.value === "#/" || route.value === "") return "home";
        if (currentToolComponent.value) return "tool";
        if (activeTool.value) return "placeholder";
        return "home";
      });

      const categories = computed(() => {
        const names = tools.map((tool) => tool.category);
        return ["全部", ...new Set(names)];
      });

      const sortedTools = computed(() =>
        [...tools].sort((a, b) => getOpenCount(b.id) - getOpenCount(a.id))
      );

      const frequentTools = computed(() =>
        sortedTools.value.filter((tool) => tool.enabled).slice(0, 4)
      );

      const filteredTools = computed(() => {
        const query = keyword.value.toLowerCase();

        return sortedTools.value.filter((tool) => {
          const matchesCategory =
            selectedCategory.value === "全部" || tool.category === selectedCategory.value;
          const matchesKeyword =
            !query ||
            `${tool.name}${tool.desc}${tool.category}`.toLowerCase().includes(query);

          return matchesCategory && matchesKeyword;
        });
      });

      const placeholderTool = computed(
        () =>
          activeTool.value || {
            category: "工具",
            name: "工具",
            icon: "□",
            theme: "theme-gray",
          }
      );

      function openTool(tool) {
        if (!tool) return;

        if (!tool.enabled) {
          showToast(`${tool.name} 即将上线`);
          return;
        }

        recordOpen(tool);
        window.location.hash = tool.url;
        route.value = tool.url;
      }

      function goHome() {
        window.location.hash = "#/";
        route.value = "#/";
      }

      function setCategory(category) {
        selectedCategory.value = category;
      }

      function openSettings() {
        cacheConfirming.value = false;
        settingsOpen.value = true;
      }

      function closeSettings() {
        cacheConfirming.value = false;
        settingsOpen.value = false;
        window.clearTimeout(cacheConfirmTimer);
      }

      function clearAllCache() {
        if (!cacheConfirming.value) {
          cacheConfirming.value = true;
          window.clearTimeout(cacheConfirmTimer);
          cacheConfirmTimer = window.setTimeout(() => {
            cacheConfirming.value = false;
          }, 2600);
          showToast("再次点击确认清理");
          return;
        }

        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          cacheConfirming.value = false;
          showToast("清理失败，请稍后重试");
          return;
        }

        openCounts.value = {};
        keyword.value = "";
        selectedCategory.value = "全部";
        closeSettings();
        showToast("已清理全部缓存");
      }

      function loadOpenCounts() {
        try {
          const saved = JSON.parse(localStorage.getItem(openCountsStorageKey) || "{}");
          if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
          return Object.fromEntries(tools
            .filter((tool) => Number.isSafeInteger(saved[tool.id]) && saved[tool.id] >= 0)
            .map((tool) => [tool.id, saved[tool.id]]));
        } catch (error) {
          return {};
        }
      }

      function getOpenCount(id) {
        return openCounts.value[id] || 0;
      }

      function recordOpen(tool) {
        if (!tool || !tool.enabled) return;
        openCounts.value = {
          ...openCounts.value,
          [tool.id]: Math.min(getOpenCount(tool.id) + 1, Number.MAX_SAFE_INTEGER),
        };
        try {
          localStorage.setItem(openCountsStorageKey, JSON.stringify(openCounts.value));
        } catch (error) { /* Keep counting in this session if persistence is unavailable. */ }
      }

      function syncOpenCounts(event) {
        if (event.storageArea === localStorage && (event.key === openCountsStorageKey || event.key === null)) {
          openCounts.value = loadOpenCounts();
        }
      }

      function showToast(message) {
        toast.value = message;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          toast.value = "";
        }, 1800);
      }

      function syncRoute() {
        const nextRoute = getRoute();
        if (nextRoute === route.value) return;
        recordOpen(tools.find((tool) => tool.url === nextRoute));
        route.value = nextRoute;
      }

      onMounted(() => {
        window.addEventListener("hashchange", syncRoute);
        window.addEventListener("storage", syncOpenCounts);
        recordOpen(activeTool.value);
      });

      onBeforeUnmount(() => {
        window.removeEventListener("hashchange", syncRoute);
        window.removeEventListener("storage", syncOpenCounts);
        window.clearTimeout(cacheConfirmTimer);
      });

      return {
        activeTool,
        cacheConfirming,
        categories,
        clearAllCache,
        closeSettings,
        currentPage,
        currentToolComponent,
        filteredTools,
        frequentTools,
        getOpenCount,
        goHome,
        greeting,
        keyword,
        openSettings,
        openTool,
        placeholderTool,
        selectedCategory,
        setCategory,
        settingsOpen,
        toast,
      };
    },
  }).mount("#app");

  function getRoute() {
    return window.location.hash || "#/";
  }
})(window);
