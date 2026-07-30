(function (global) {
  if (!global.Vue) return;

  const { computed, reactive, ref } = global.Vue;
  const fieldsStorageKey = "aabb-toolbox-random-fields";
  const resultStorageKey = "aabb-toolbox-random-result";
  const maxFields = 20;

  const typeOptions = [
    { value: "string", label: "字符" },
    { value: "number", label: "数字" },
  ];

  const stringRules = [
    { value: "chineseName", label: "姓名" },
    { value: "namePinyin", label: "名字拼音" },
    { value: "account", label: "账号 下划线" },
    { value: "accountPrefix", label: "账号 前缀" },
    { value: "accountPinyin", label: "账号 拼音" },
    { value: "accountPhoneTail", label: "账号 手机尾号" },
    { value: "digitsText", label: "纯数字字符" },
    { value: "lettersLower", label: "小写字母" },
    { value: "lettersUpper", label: "大写字母" },
    { value: "alphanumeric", label: "字母+数字" },
    { value: "mobile", label: "手机号" },
    { value: "email", label: "邮箱" },
    { value: "workEmail", label: "企业邮箱" },
    { value: "qqEmail", label: "QQ 邮箱" },
    { value: "dateYmd", label: "日期 YYYY-MM-DD" },
    { value: "dateCompact", label: "日期 YYYYMMDD" },
    { value: "dateSlash", label: "日期 YYYY/MM/DD" },
    { value: "dateCn", label: "日期 中文" },
    { value: "dateTime", label: "时间 yyyy-MM-dd HH:mm:ss" },
    { value: "dateTimeSlash", label: "时间 yyyy/MM/dd HH:mm" },
    { value: "isoDateTime", label: "ISO 时间" },
    { value: "uuid", label: "UUID" },
    { value: "orderNo", label: "订单号" },
    { value: "ip", label: "IP 地址" },
    { value: "url", label: "URL" },
    { value: "password", label: "密码" },
    { value: "address", label: "中文地址" },
    { value: "fullAddress", label: "详细地址" },
    { value: "cityAddress", label: "城市区域" },
    { value: "sceneText", label: "场景文字" },
    { value: "remarkText", label: "备注文字" },
    { value: "randomText", label: "随机字符串" },
  ];

  const numberRules = [
    { value: "integer", label: "整数" },
    { value: "decimal", label: "小数" },
    { value: "longId", label: "Long ID" },
    { value: "digitsNumber", label: "固定位数字" },
    { value: "timestampMs", label: "时间戳毫秒" },
    { value: "timestampSecond", label: "时间戳秒" },
    { value: "amount", label: "金额" },
    { value: "quantity", label: "数量" },
    { value: "age", label: "年龄" },
    { value: "statusCode", label: "状态码" },
    { value: "pageNo", label: "页码" },
    { value: "pageSize", label: "分页大小" },
    { value: "score", label: "分数" },
    { value: "percent", label: "百分比" },
    { value: "sortNo", label: "排序号" },
  ];

  const ruleMap = {
    string: stringRules,
    number: numberRules,
  };

  const defaultFields = [
    { key: "name", valueType: "string", rule: "chineseName" },
    { key: "username", valueType: "string", rule: "accountPinyin" },
    { key: "phone", valueType: "string", rule: "mobile" },
    { key: "createTime", valueType: "string", rule: "dateTime" },
    { key: "userId", valueType: "number", rule: "longId" },
  ];

  const quickPresets = [
    { key: "name", valueType: "string", rule: "chineseName", label: "姓名" },
    { key: "realNamePinyin", valueType: "string", rule: "namePinyin", label: "拼音" },
    { key: "username", valueType: "string", rule: "accountPinyin", label: "账号" },
    { key: "phone", valueType: "string", rule: "mobile", label: "手机号" },
    { key: "email", valueType: "string", rule: "email", label: "邮箱" },
    { key: "companyEmail", valueType: "string", rule: "workEmail", label: "企业邮箱" },
    { key: "birthday", valueType: "string", rule: "dateYmd", label: "生日" },
    { key: "requestId", valueType: "string", rule: "uuid", label: "UUID" },
    { key: "orderNo", valueType: "string", rule: "orderNo", label: "订单号" },
    { key: "address", valueType: "string", rule: "fullAddress", label: "地址" },
    { key: "remark", valueType: "string", rule: "sceneText", label: "文字" },
    { key: "amount", valueType: "number", rule: "amount", label: "金额" },
    { key: "pageNum", valueType: "number", rule: "pageNo", label: "页码" },
    { key: "pageSize", valueType: "number", rule: "pageSize", label: "分页" },
  ];

  global.RandomGeneratorTool = {
    name: "RandomGeneratorTool",
    props: {
      tool: {
        type: Object,
        required: true,
      },
    },
    emits: ["go-home"],
    template: `
      <section>
        <header class="app-header tool-header">
          <section class="tool-nav">
            <button class="icon-button nav-back" type="button" aria-label="返回首页" @click="goHome">
              <span class="back-icon"></span>
            </button>
            <div class="tool-title">
              <p class="eyebrow">{{ tool.category }}</p>
              <h1>{{ tool.name }}</h1>
            </div>
            <button class="text-action" type="button" @click="loadDefaults">示例</button>
          </section>
        </header>

        <section class="random-overview" aria-label="随机生成概览">
          <div>
            <span>{{ fields.length }}</span>
            <p>字段</p>
          </div>
          <div>
            <span>{{ enabledRuleCount }}</span>
            <p>规则</p>
          </div>
          <div>
            <span>{{ resultSize }}</span>
            <p>字符</p>
          </div>
        </section>

        <section class="random-section">
          <div class="section-header">
            <h2>常用字段</h2>
            <button type="button" :disabled="fields.length >= maxFields" @click="addField">添加</button>
          </div>
          <div class="random-preset-row">
            <button
              v-for="preset in quickPresets"
              :key="preset.key + preset.rule"
              type="button"
              :disabled="fields.length >= maxFields"
              @click="addPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </section>

        <section class="random-section">
          <div class="section-header">
            <h2>字段配置</h2>
            <button type="button" @click="clearFields">清空</button>
          </div>

          <div class="random-field-list">
            <article v-for="(field, index) in fields" :key="field.id" class="random-field-card">
              <button
                class="random-delete"
                type="button"
                aria-label="删除字段"
                :disabled="fields.length <= 1"
                @click="deleteField(index)"
              >
                删除
              </button>

              <div class="random-field-main">
                <label class="random-key-field">
                  <span>字段</span>
                  <input
                    v-model.trim="field.key"
                    type="text"
                    maxlength="32"
                    autocapitalize="off"
                    autocomplete="off"
                    placeholder="fieldName"
                    @input="saveFields"
                  />
                </label>

                <button class="random-sample-chip" type="button" @click="refreshFieldSample(index)">
                  <span>示例</span>
                  <strong>{{ formatSample(field.sample) }}</strong>
                </button>
              </div>

              <div class="random-field-controls">
                <label class="random-type-select">
                  <span>类型</span>
                  <select :value="field.valueType" @change="setFieldType(index, $event.target.value)">
                    <option
                      v-for="option in typeOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label class="random-rule-select">
                  <span>规则</span>
                  <select v-model="field.rule" @change="updateFieldRule(index)">
                    <option
                      v-for="rule in rulesFor(field.valueType)"
                      :key="rule.value"
                      :value="rule.value"
                    >
                      {{ rule.label }}
                    </option>
                  </select>
                </label>
              </div>
            </article>
          </div>
        </section>

        <section class="random-actions" aria-label="随机生成操作">
          <button type="button" @click="generateJson">生成 JSON</button>
          <button type="button" :disabled="!resultJson.trim()" @click="copyJson">复制</button>
          <button type="button" @click="resetAll">重置</button>
        </section>

        <section v-if="notice.message" :class="['random-notice', notice.type]">
          <strong>{{ notice.title }}</strong>
          <p>{{ notice.message }}</p>
        </section>

        <section class="random-section">
          <div class="section-header">
            <h2>生成结果</h2>
            <button type="button" :disabled="!resultJson.trim()" @click="copyJson">复制</button>
          </div>
          <textarea
            v-model="resultJson"
            class="random-json-output"
            spellcheck="false"
            readonly
            placeholder="{ }"
          ></textarea>
        </section>
      </section>
    `,
    setup(props, { emit }) {
      const fields = ref(loadFields());
      const resultJson = ref(localStorage.getItem(resultStorageKey) || "");
      const notice = reactive({
        type: "idle",
        title: "",
        message: "",
      });

      const enabledRuleCount = computed(() => stringRules.length + numberRules.length);
      const resultSize = computed(() => formatSize(resultJson.value));

      function goHome() {
        emit("go-home");
      }

      function rulesFor(type) {
        return ruleMap[type] || stringRules;
      }

      function saveFields() {
        localStorage.setItem(fieldsStorageKey, JSON.stringify(normalizeFields(fields.value)));
      }

      function addField() {
        if (fields.value.length >= maxFields) {
          showError("字段已达上限", `最多支持 ${maxFields} 个字段。`);
          return;
        }

        fields.value.push(createField({ key: getUniqueKey("param", fields.value) }));
        saveFields();
      }

      function addPreset(preset) {
        if (fields.value.length >= maxFields) {
          showError("字段已达上限", `最多支持 ${maxFields} 个字段。`);
          return;
        }

        fields.value.push(
          createField({
            key: getUniqueKey(preset.key, fields.value),
            valueType: preset.valueType,
            rule: preset.rule,
          })
        );
        saveFields();
      }

      function deleteField(index) {
        if (fields.value.length <= 1) return;

        fields.value.splice(index, 1);
        saveFields();
      }

      function clearFields() {
        fields.value = [createField({ key: "param" })];
        resultJson.value = "";
        localStorage.removeItem(resultStorageKey);
        saveFields();
        showSuccess("已清空", "字段配置已重置。");
      }

      function setFieldType(index, type) {
        const field = fields.value[index];
        if (!field || field.valueType === type) return;

        field.valueType = type;
        field.rule = rulesFor(type)[0].value;
        field.sample = generateValue(field);
        saveFields();
      }

      function updateFieldRule(index) {
        const field = fields.value[index];
        if (!field) return;

        field.sample = generateValue(field);
        saveFields();
      }

      function refreshFieldSample(index) {
        const field = fields.value[index];
        if (!field) return;

        field.sample = generateValue(field);
      }

      function generateJson() {
        const checked = validateFields(fields.value);

        if (!checked.ok) {
          showError(checked.title, checked.message);
          return;
        }

        const result = {};
        const context = createGenerationContext();
        checked.fields.forEach((field) => {
          result[field.key] = generateValue(field, context);
        });

        resultJson.value = JSON.stringify(result, null, 2);
        localStorage.setItem(resultStorageKey, resultJson.value);
        showSuccess("生成完成", "随机参数 JSON 已更新。");
      }

      async function copyJson() {
        if (!resultJson.value.trim()) {
          generateJson();
        }

        if (!resultJson.value.trim()) return;

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(resultJson.value);
          } else {
            fallbackCopy(resultJson.value);
          }
          showSuccess("已复制", "JSON 已复制到剪贴板。");
        } catch (error) {
          try {
            fallbackCopy(resultJson.value);
            showSuccess("已复制", "JSON 已复制到剪贴板。");
          } catch (fallbackError) {
            showError("复制失败", "当前浏览器限制了剪贴板访问。");
          }
        }
      }

      function loadDefaults() {
        fields.value = defaultFields.map(createField);
        saveFields();
        generateJson();
      }

      function resetAll() {
        fields.value = defaultFields.map(createField);
        resultJson.value = "";
        localStorage.removeItem(resultStorageKey);
        saveFields();
        showSuccess("已重置", "字段配置已恢复默认。");
      }

      function showSuccess(title, message) {
        notice.type = "success";
        notice.title = title;
        notice.message = message;
      }

      function showError(title, message) {
        notice.type = "error";
        notice.title = title;
        notice.message = message;
      }

      return {
        addField,
        addPreset,
        clearFields,
        copyJson,
        deleteField,
        enabledRuleCount,
        fields,
        generateJson,
        goHome,
        loadDefaults,
        maxFields,
        notice,
        quickPresets,
        resetAll,
        resultJson,
        resultSize,
        rulesFor,
        saveFields,
        setFieldType,
        typeOptions,
        updateFieldRule,
        refreshFieldSample,
        formatSample,
      };
    },
  };

  function loadFields() {
    try {
      const cached = JSON.parse(localStorage.getItem(fieldsStorageKey) || "[]");
      const normalized = normalizeFields(cached);
      if (normalized.length > 0) return normalized.map(createField);
    } catch (error) {
      return defaultFields.map(createField);
    }

    return defaultFields.map(createField);
  }

  function normalizeFields(fields) {
    if (!Array.isArray(fields)) return [];

    return fields
      .slice(0, maxFields)
      .map((field) => {
        const valueType = field && field.valueType === "number" ? "number" : "string";
        const rules = ruleMap[valueType];
        const rule = rules.some((item) => item.value === field.rule) ? field.rule : rules[0].value;

        return {
          key: String((field && field.key) || "").trim().slice(0, 32),
          valueType,
          rule,
        };
      })
      .filter((field) => field.key);
  }

  function createField(field) {
    const valueType = field && field.valueType === "number" ? "number" : "string";
    const rules = ruleMap[valueType];
    const rule = rules.some((item) => item.value === field.rule) ? field.rule : rules[0].value;

    return {
      id: createId(),
      key: String((field && field.key) || "param").slice(0, 32),
      valueType,
      rule,
      sample: generateValue({ valueType, rule }),
    };
  }

  function validateFields(fields) {
    const normalized = normalizeFields(fields);

    if (normalized.length === 0) {
      return { ok: false, title: "字段不能为空", message: "请至少保留一个字段。" };
    }

    const keys = new Set();
    for (const field of normalized) {
      if (keys.has(field.key)) {
        return { ok: false, title: "字段重复", message: `${field.key} 已存在。` };
      }
      keys.add(field.key);
    }

    return { ok: true, fields: normalized };
  }

  function createGenerationContext() {
    return {
      accountSuffix: randomInt(10, 99),
      date: null,
      name: null,
      phone: null,
    };
  }

  function generateValue(field, context) {
    if (field.valueType === "number") {
      return generateNumberValue(field.rule, context);
    }

    return generateStringValue(field.rule, context);
  }

  function generateStringValue(rule, context) {
    switch (rule) {
      case "chineseName":
        return randomChineseName(context);
      case "namePinyin":
        return randomNamePinyin(context);
      case "account":
        return randomAccount();
      case "accountPrefix":
        return randomPrefixAccount();
      case "accountPinyin":
        return randomPinyinAccount(context);
      case "accountPhoneTail":
        return randomPhoneTailAccount(context);
      case "digitsText":
        return randomDigits(8);
      case "lettersLower":
        return randomLetters(10, "lower");
      case "lettersUpper":
        return randomLetters(10, "upper");
      case "alphanumeric":
        return randomString(12);
      case "mobile":
        return getContextPhone(context);
      case "email":
        return randomEmail("normal", context);
      case "workEmail":
        return randomEmail("work", context);
      case "qqEmail":
        return randomEmail("qq");
      case "dateYmd":
        return formatDate(getContextDate(context), "yyyy-MM-dd");
      case "dateCompact":
        return formatDate(getContextDate(context), "yyyyMMdd");
      case "dateSlash":
        return formatDate(getContextDate(context), "yyyy/MM/dd");
      case "dateCn":
        return formatDate(getContextDate(context), "yyyy年MM月dd日");
      case "dateTime":
        return formatDate(getContextDate(context), "yyyy-MM-dd HH:mm:ss");
      case "dateTimeSlash":
        return formatDate(getContextDate(context), "yyyy/MM/dd HH:mm");
      case "isoDateTime":
        return getContextDate(context).toISOString();
      case "uuid":
        return randomUuid();
      case "orderNo":
        return `NO${formatDate(getContextDate(context), "yyyyMMdd")}${randomDigits(8)}`;
      case "ip":
        return `${randomInt(10, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
      case "url":
        return `https://api.example.com/${randomString(6).toLowerCase()}`;
      case "password":
        return `${randomString(8)}${randomInt(10, 99)}!`;
      case "address":
        return randomAddress("district");
      case "fullAddress":
        return randomAddress("full");
      case "cityAddress":
        return randomAddress("city");
      case "sceneText":
        return randomMeaningfulText("scene");
      case "remarkText":
        return randomMeaningfulText("remark");
      case "randomText":
      default:
        return randomString(12);
    }
  }

  function generateNumberValue(rule, context) {
    switch (rule) {
      case "decimal":
        return Number((Math.random() * 1000).toFixed(2));
      case "longId":
        return Number(`${randomInt(100000, 999999)}${randomDigits(9)}`);
      case "digitsNumber":
        return randomInt(100000, 999999);
      case "timestampMs":
        return getContextDate(context).getTime();
      case "timestampSecond":
        return Math.floor(getContextDate(context).getTime() / 1000);
      case "amount":
        return Number((randomInt(1, 999999) / 100).toFixed(2));
      case "quantity":
        return randomInt(1, 999);
      case "age":
        return randomInt(18, 65);
      case "statusCode":
        return pick([0, 1, 2, 10, 20, 100, 200]);
      case "pageNo":
        return randomInt(1, 20);
      case "pageSize":
        return pick([10, 20, 30, 50, 100]);
      case "score":
        return randomInt(0, 100);
      case "percent":
        return Number((Math.random() * 100).toFixed(2));
      case "sortNo":
        return randomInt(1, 999);
      case "integer":
      default:
        return randomInt(1, 9999);
    }
  }

  function randomChineseName(context) {
    const name = getContextName(context);

    return `${name.family}${name.given}`;
  }

  function randomNamePinyin(context) {
    return getContextName(context).pinyin;
  }

  function randomPinyinAccount(context) {
    const suffix = context ? context.accountSuffix : randomInt(10, 99);

    return `${randomNamePinyin(context).replace(/_/g, "")}${suffix}`;
  }

  function randomPrefixAccount() {
    return `${pick(["dev", "test", "admin", "student", "teacher", "operator"])}${randomInt(1000, 9999)}`;
  }

  function randomAccount() {
    return `${pick(["dev", "test", "user", "api", "qa"])}_${randomString(5).toLowerCase()}${randomInt(10, 99)}`;
  }

  function randomPhoneTailAccount(context) {
    return `${pick(["u", "m", "app"])}${getContextPhone(context).slice(-8)}`;
  }

  function randomEmail(type, context) {
    if (type === "qq") return `${randomDigits(randomInt(6, 10))}@qq.com`;

    const local = type === "work" ? randomPinyinAccount(context) : randomAccount().replace(/_/g, ".");
    const domains =
      type === "work"
        ? ["aabb.com", "example.cn", "company.com", "service.cn"]
        : ["example.com", "test.com", "demo.cn", "mail.cn"];

    return `${local}@${pick(domains)}`;
  }

  function randomMobile() {
    return `${pick(["130", "131", "135", "136", "137", "138", "139", "150", "151", "152", "157", "158", "159", "176", "177", "178", "185", "186", "187", "188"])}${randomDigits(8)}`;
  }

  function getContextName(context) {
    if (!context) return pickName();
    if (!context.name) context.name = pickName();

    return context.name;
  }

  function getContextPhone(context) {
    if (!context) return randomMobile();
    if (!context.phone) context.phone = randomMobile();

    return context.phone;
  }

  function randomAddress(type) {
    const city = pick([
      { name: "北京市", districts: ["朝阳区", "海淀区", "丰台区"] },
      { name: "上海市", districts: ["浦东新区", "徐汇区", "静安区"] },
      { name: "杭州市", districts: ["西湖区", "滨江区", "余杭区"] },
      { name: "深圳市", districts: ["南山区", "福田区", "宝安区"] },
      { name: "成都市", districts: ["武侯区", "锦江区", "高新区"] },
      { name: "南京市", districts: ["鼓楼区", "秦淮区", "建邺区"] },
    ]);
    const district = pick(city.districts);

    if (type === "city") return `${city.name}${district}`;
    if (type === "full") {
      return `${city.name}${district}${pick(["科技路", "人民路", "望江路", "星河街", "文一路"])}${randomInt(1, 199)}号${randomInt(1, 20)}栋${randomInt(101, 2808)}室`;
    }

    return `${city.name}${district}${randomInt(1, 99)}号`;
  }

  function randomMeaningfulText(type) {
    if (type === "remark") {
      const subjects = ["接口联调", "回归验证", "测试账号", "订单流程", "权限校验", "数据同步", "消息推送", "支付回调", "登录校验", "报表导出"];
      const actions = ["已完成", "待确认", "保持有效", "需要复核", "自动生成", "正在处理", "已提交", "已归档", "等待重试", "通过校验"];
      const details = ["请关注日志", "无需人工处理", "仅用于测试", "可重复执行", "下次发布验证", "保留原始数据", "同步测试环境", "按默认流程", "结果已记录", "稍后继续跟进"];

      return `${pick(subjects)}${pick(actions)}，${pick(details)}`;
    }

    const modifiers = ["蓝色", "清晨", "温柔", "明亮", "安静", "浅金色", "雨后的", "薄雾里", "夏日", "深夜"];
    const subjects = ["花", "云", "灯光", "树影", "湖面", "风", "街角", "纸船", "星光", "窗帘"];
    const actions = ["在摇曳", "缓慢流动", "轻轻闪烁", "慢慢展开", "悄然落下", "向远处延伸", "映在水面", "穿过小巷", "停在窗边", "被微风托起"];

    return `${pick(modifiers)}的${pick(subjects)}${pick(actions)}`;
  }

  function pickName() {
    return pick([
      { family: "李", given: "明轩", pinyin: "li_mingxuan" },
      { family: "王", given: "一诺", pinyin: "wang_yinuo" },
      { family: "张", given: "思源", pinyin: "zhang_siyuan" },
      { family: "刘", given: "雨桐", pinyin: "liu_yutong" },
      { family: "陈", given: "浩然", pinyin: "chen_haoran" },
      { family: "杨", given: "嘉怡", pinyin: "yang_jiayi" },
      { family: "赵", given: "晨曦", pinyin: "zhao_chenxi" },
      { family: "黄", given: "子涵", pinyin: "huang_zihan" },
      { family: "周", given: "俊杰", pinyin: "zhou_junjie" },
      { family: "林", given: "欣妍", pinyin: "lin_xinyan" },
    ]);
  }

  function randomDate() {
    const now = Date.now();
    const range = 1000 * 60 * 60 * 24 * 900;

    return new Date(now - randomInt(0, range));
  }

  function getContextDate(context) {
    if (!context) return randomDate();
    if (!context.date) context.date = randomDate();

    return context.date;
  }

  function formatDate(date, pattern) {
    const values = {
      yyyy: String(date.getFullYear()),
      MM: pad2(date.getMonth() + 1),
      dd: pad2(date.getDate()),
      HH: pad2(date.getHours()),
      mm: pad2(date.getMinutes()),
      ss: pad2(date.getSeconds()),
    };

    return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => values[token]);
  }

  function randomUuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = randomInt(0, 15);
      const nibble = char === "x" ? value : (value & 0x3) | 0x8;

      return nibble.toString(16);
    });
  }

  function getUniqueKey(baseKey, fields) {
    const keys = new Set(fields.map((field) => field.key));
    if (!keys.has(baseKey)) return baseKey;

    let index = 2;
    while (keys.has(`${baseKey}${index}`)) {
      index += 1;
    }

    return `${baseKey}${index}`;
  }

  function randomString(length) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    for (let index = 0; index < length; index += 1) {
      result += chars.charAt(randomInt(0, chars.length - 1));
    }

    return result;
  }

  function randomLetters(length, type) {
    const chars = type === "upper" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "abcdefghijklmnopqrstuvwxyz";
    let result = "";

    for (let index = 0; index < length; index += 1) {
      result += chars.charAt(randomInt(0, chars.length - 1));
    }

    return result;
  }

  function randomDigits(length) {
    let result = "";

    for (let index = 0; index < length; index += 1) {
      result += String(randomInt(0, 9));
    }

    return result;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(items) {
    return items[randomInt(0, items.length - 1)];
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatSize(text) {
    const count = text.length;
    if (count === 0) return "0";
    if (count < 1000) return `${count}`;

    return `${(count / 1000).toFixed(1)}k`;
  }

  function formatSample(value) {
    const text = String(value);
    if (text.length <= 18) return text;

    return `${text.slice(0, 17)}...`;
  }

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
})(window);
