(function (global) {
  if (!global.Vue) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p class="fallback-message">Vue 加载失败，请检查网络或改用本地依赖构建。</p>'
    );
    throw new Error("Vue is required to run the toolbox homepage.");
  }

  const { createApp, computed, onBeforeUnmount, onMounted, ref } = global.Vue;
  const tools = global.ToolboxTools || [];
  const recentStorageKey = "aabb-toolbox-recent";

  createApp({
    setup() {
      const keyword = ref("");
      const selectedCategory = ref("全部");
      const toast = ref("");
      const route = ref(getRoute());
      const recentIds = ref(loadRecentIds());
      let toastTimer = 0;

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

      const filteredTools = computed(() => {
        const query = keyword.value.toLowerCase();

        return tools.filter((tool) => {
          const matchesCategory =
            selectedCategory.value === "全部" || tool.category === selectedCategory.value;
          const matchesKeyword =
            !query ||
            `${tool.name}${tool.desc}${tool.category}`.toLowerCase().includes(query);

          return matchesCategory && matchesKeyword;
        });
      });

      const recentTools = computed(() =>
        recentIds.value.map((id) => tools.find((tool) => tool.id === id)).filter(Boolean)
      );

      const placeholderTool = computed(
        () =>
          activeTool.value || {
            category: "工具",
            name: "工具",
            icon: "□",
            theme: "theme-gray",
          }
      );

      const quickActions = computed(() => [
        {
          label: "最新",
          icon: "★",
          theme: "theme-blue",
          run: () => {
            const latest = tools.find((tool) => tool.badge === "New") || tools[0];
            openTool(latest);
          },
        },
        {
          label: "开发",
          icon: "</>",
          theme: "theme-green",
          run: () => setCategory("开发"),
        },
        {
          label: "设计",
          icon: "◒",
          theme: "theme-pink",
          run: () => setCategory("设计"),
        },
        {
          label: "效率",
          icon: "✓",
          theme: "theme-orange",
          run: () => setCategory("效率"),
        },
      ]);

      function openTool(tool) {
        if (!tool) return;
        pushRecent(tool.id);

        if (!tool.enabled) {
          showToast(`${tool.name} 即将上线`);
          return;
        }

        window.location.hash = tool.url;
        route.value = tool.url;
      }

      function goHome() {
        window.location.hash = "#/";
        route.value = "#/";
      }

      function handleQuickAction(action) {
        action.run();
      }

      function setCategory(category) {
        selectedCategory.value = category;
      }

      function clearRecent() {
        recentIds.value = [];
        localStorage.removeItem(recentStorageKey);
        showToast("已清空最近使用");
      }

      function pushRecent(id) {
        recentIds.value = [id, ...recentIds.value.filter((item) => item !== id)].slice(0, 4);
        localStorage.setItem(recentStorageKey, JSON.stringify(recentIds.value));
      }

      function loadRecentIds() {
        try {
          return JSON.parse(localStorage.getItem(recentStorageKey) || "[]");
        } catch (error) {
          return [];
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
        route.value = getRoute();
      }

      onMounted(() => {
        window.addEventListener("hashchange", syncRoute);
      });

      onBeforeUnmount(() => {
        window.removeEventListener("hashchange", syncRoute);
      });

      return {
        activeTool,
        categories,
        clearRecent,
        currentPage,
        currentToolComponent,
        filteredTools,
        goHome,
        greeting,
        handleQuickAction,
        keyword,
        openTool,
        placeholderTool,
        quickActions,
        recentTools,
        selectedCategory,
        setCategory,
        toast,
      };
    },
  }).mount("#app");

  function getRoute() {
    return window.location.hash || "#/";
  }
})(window);
