const RSS_SOURCES = [
  {
    name: "TechCrunch",
    categories: ["AI", "内容生态", "产品发布"],
    url: "https://techcrunch.com/category/artificial-intelligence/feed/"
  },
  {
    name: "Hacker News",
    categories: ["前端", "开发工具", "内容生态"],
    url: "https://hnrss.org/frontpage"
  },
  {
    name: "The Verge",
    categories: ["硬件", "产品发布", "社交平台"],
    url: "https://www.theverge.com/rss/index.xml"
  },
  {
    name: "InfoQ",
    categories: ["云计算", "行业洞察", "开发工具"],
    url: "https://www.infoq.com/feed/"
  },
  {
    name: "Dark Reading",
    categories: ["安全", "行业洞察"],
    url: "https://www.darkreading.com/rss.xml"
  }
];

const FEED_PROXY = "https://api.allorigins.win/raw?url=";
const MAX_ITEMS_PER_SOURCE = 8;
const CATEGORY_POOL = [
  "AI",
  "前端",
  "云计算",
  "安全",
  "硬件",
  "内容生态",
  "产品发布",
  "开发工具",
  "行业洞察",
  "社交平台"
];
const MOCK_SOURCES = ["极客快讯", "科技前沿", "数智周刊", "内容观察", "产品内参", "开源情报站"];
const TITLE_PREFIX = ["重磅", "最新", "观察", "快评", "趋势", "深度", "实测", "前瞻"];
const TITLE_TOPIC = [
  "内容平台",
  "AIGC 工具链",
  "智能搜索",
  "知识社区",
  "短视频生态",
  "开发框架",
  "云原生平台",
  "数据基础设施",
  "安全防护体系",
  "创作者经济"
];
const TITLE_ACTION = ["迎来升级", "发布新方案", "进入新阶段", "加速落地", "实现突破", "持续升温", "扩展生态", "引发关注"];
const SUMMARY_TEMPLATE = [
  "多家团队围绕{topic}展开实践，重点在效率、体验和成本之间寻找平衡。",
  "行业报告显示，{topic}相关需求持续增长，平台能力与内容质量同步提升。",
  "本轮更新聚焦{topic}场景，强调稳定性、可扩展性与开发者友好体验。",
  "从案例看，{topic}已从试点走向规模化，商业化路径更加清晰。"
];

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function pickOne(list) {
  return list[randomInt(list.length)];
}

function pickSome(list, minCount, maxCount) {
  const copied = [...list];
  const count = minCount + randomInt(maxCount - minCount + 1);
  const picked = [];
  while (copied.length && picked.length < count) {
    const idx = randomInt(copied.length);
    picked.push(copied.splice(idx, 1)[0]);
  }
  return picked;
}

function generateMockTitle() {
  return `${pickOne(TITLE_PREFIX)}：${pickOne(TITLE_TOPIC)}${pickOne(TITLE_ACTION)}`;
}

function generateMockSummary(topic) {
  return pickOne(SUMMARY_TEMPLATE).replace("{topic}", topic);
}

function generateMockTime(maxDaysBack = 10) {
  const now = Date.now();
  const offsetMs = randomInt(maxDaysBack * 24 * 60 * 60 * 1000);
  return now - offsetMs;
}

function generateFallbackNews(count = 20) {
  const list = [];
  for (let i = 1; i <= count; i += 1) {
    const topic = pickOne(TITLE_TOPIC);
    const rawTime = generateMockTime(10);
    list.push({
      id: `mock-${Date.now()}-${i}-${randomInt(10000)}`,
      categories: pickSome(CATEGORY_POOL, 2, 3),
      title: generateMockTitle(),
      summary: generateMockSummary(topic),
      source: `${pickOne(MOCK_SOURCES)}（示例）`,
      time: formatTime(rawTime),
      rawTime,
      url: `https://example.com/mock-news-${i}-${randomInt(99999)}`,
      isRead: false,
      isFavorite: false
    });
  }
  list.sort((a, b) => b.rawTime - a.rawTime);
  return list;
}

const state = {
  allNews: [],
  customEntries: [],
  keyword: "",
  selectedCategories: [],
  sortOrder: "latest",
  timeRange: "all",
  statusFilter: "全部",
  loading: false
};

const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const rangeSelect = document.getElementById("rangeSelect");
const categoryTabs = document.getElementById("categoryTabs");
const statusTabs = document.getElementById("statusTabs");
const resultInfo = document.getElementById("resultInfo");
const newsGrid = document.getElementById("newsGrid");
const refreshBtn = document.getElementById("refreshBtn");

const customUrlInput = document.getElementById("customUrl");
const customTitleInput = document.getElementById("customTitle");
const customSummaryInput = document.getElementById("customSummary");
const customSourceInput = document.getElementById("customSource");
const customCategoriesInput = document.getElementById("customCategories");
const customList = document.getElementById("customList");
const btnAddCustom = document.getElementById("btnAddCustom");
const btnClearCustom = document.getElementById("btnClearCustom");

const CUSTOM_STORAGE_KEY = "news_custom_entries_v1";

function getCategories(list) {
  const categories = new Set(CATEGORY_POOL);

  list.forEach((item) => {
    (item.categories || []).forEach((category) => categories.add(category));
  });

  return ["全部", ...Array.from(categories)];
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(String(str));
  } catch {
    return fallback;
  }
}

function hashString(str) {
  const s = String(str || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function normalizeUrl(url) {
  const u = new URL(String(url).trim());
  // 简化：去掉 hash，保留 search（如果有）
  u.hash = "";
  if (u.pathname.endsWith("/") && u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

function defaultTitleFromUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}`;
  } catch {
    return "自定义链接";
  }
}

function parseCategoriesInput(input) {
  const parts = String(input || "")
    .split(/[，,]/g)
    .map((x) => x.trim())
    .filter(Boolean);
  const pool = new Set(CATEGORY_POOL);
  const valid = parts.filter((p) => pool.has(p));
  return valid.length ? valid : ["内容生态"];
}

function buildCustomEntry(payload) {
  const url = normalizeUrl(payload.url);
  const rawTime = payload.rawTime ?? Date.now();

  return {
    id: `custom-${hashString(url)}`,
    url,
    title: payload.title?.trim() ? payload.title.trim() : defaultTitleFromUrl(url),
    summary: payload.summary?.trim() ? payload.summary.trim() : "",
    source: payload.source?.trim() ? payload.source.trim() : "自定义",
    categories: payload.categories?.length ? payload.categories : ["内容生态"],
    rawTime,
    time: formatTime(rawTime),
    isRead: false,
    isFavorite: false
  };
}

function loadCustomEntries() {
  const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
  const parsed = safeJsonParse(raw, []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((x) => {
      if (!x || !x.url) return null;
      const categories = Array.isArray(x.categories) ? x.categories : ["内容生态"];
      const rawTime = Number(x.rawTime) || Date.now();
      return {
        id: String(x.id || `custom-${hashString(x.url)}`),
        url: normalizeUrl(x.url),
        title: String(x.title || defaultTitleFromUrl(x.url)),
        summary: String(x.summary || ""),
        source: String(x.source || "自定义"),
        categories,
        rawTime,
        time: String(x.time || formatTime(rawTime)),
        isRead: !!x.isRead,
        isFavorite: !!x.isFavorite
      };
    })
    .filter(Boolean);
}

function saveCustomEntries(entries) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(entries));
}

function mergeBaseWithCustom(baseList) {
  // 现在左右彻底分开：右侧资讯流只展示 RSS/示例内容，不混入自定义链接。
  return baseList;
}

function syncCustomFromAllNews() {
  const byUrl = new Map(state.allNews.map((x) => [x.url, x]));
  state.customEntries = state.customEntries
    .map((custom) => {
      const found = byUrl.get(custom.url);
      if (!found) return custom;
      return {
        ...custom,
        title: found.title ?? custom.title,
        summary: found.summary ?? custom.summary,
        source: found.source ?? custom.source,
        categories: found.categories ?? custom.categories,
        rawTime: found.rawTime ?? custom.rawTime,
        time: found.time ?? custom.time,
        isRead: found.isRead ?? custom.isRead,
        isFavorite: found.isFavorite ?? custom.isFavorite
      };
    })
    .filter(Boolean);
  saveCustomEntries(state.customEntries);
}

function renderCustomList() {
  if (!customList) return;
  customList.innerHTML = "";

  if (!state.customEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无自定义链接，添加后会出现在左侧自定义列表里。";
    customList.appendChild(empty);
    return;
  }

  state.customEntries.forEach((entry) => {
    const wrap = document.createElement("div");
    wrap.className = `custom-item${entry.isRead ? " is-read" : ""}`;

    const categoryText = (entry.categories || []).join("、");
    wrap.innerHTML = `
      <div class="custom-item-main">
        <div class="custom-item-title">${escapeHtml(entry.title || defaultTitleFromUrl(entry.url))}</div>
        <div class="custom-item-sub">来源：${escapeHtml(entry.source || "自定义")} | 类别：${escapeHtml(categoryText)}</div>
        <div class="custom-item-sub">时间：${escapeHtml(entry.time || "")}</div>
      </div>
      <div class="custom-item-actions">
        <a class="mini-link-btn" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">打开</a>
        <button class="mini-danger-btn" type="button" data-action="remove-custom" data-url="${escapeHtml(entry.url)}">删除</button>
      </div>
    `;

    const removeBtn = wrap.querySelector("[data-action='remove-custom']");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const url = entry.url;
        state.customEntries = state.customEntries.filter((x) => x.url !== url);
        saveCustomEntries(state.customEntries);
        renderCustomList();
      });
    }

    customList.appendChild(wrap);
  });
}

function decodeHtml(str) {
  const text = String(str || "");
  const div = document.createElement("div");
  div.innerHTML = text;
  return div.textContent || div.innerText || "";
}

function stripHtml(str) {
  return decodeHtml(String(str || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, keyword) {
  const safeText = escapeHtml(text);
  const key = String(keyword || "").trim();
  if (!key) return safeText;

  const re = new RegExp(`(${escapeRegExp(key)})`, "gi");
  return safeText.replace(re, '<mark class="hl-mark">$1</mark>');
}

function formatTime(dateInput) {
  const date = new Date(dateInput || Date.now());
  if (Number.isNaN(date.getTime())) return "未知时间";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function guessSourceNameFromChannel(channel, fallback) {
  const title = channel?.querySelector("title")?.textContent?.trim();
  return title || fallback;
}

function parseRssXml(xmlText, sourceConfig) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error(`RSS 解析失败：${sourceConfig.name}`);
  }

  const channel = xml.querySelector("channel");
  const entries = Array.from(xml.querySelectorAll("item")).slice(0, MAX_ITEMS_PER_SOURCE);
  const sourceName = guessSourceNameFromChannel(channel, sourceConfig.name);

  return entries
    .map((item, idx) => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() || "";
      const descriptionRaw = item.querySelector("description")?.textContent || item.querySelector("content\\:encoded")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || item.querySelector("dc\\:date")?.textContent || "";
      const guid = item.querySelector("guid")?.textContent?.trim() || `${sourceConfig.name}-${idx}-${title}`;

      if (!title || !link) return null;

      return {
        id: guid,
        categories: sourceConfig.categories || ["内容生态"],
        title,
        summary: stripHtml(descriptionRaw).slice(0, 180) || "暂无摘要",
        source: sourceName,
        time: formatTime(pubDate),
        rawTime: new Date(pubDate).getTime() || Date.now(),
        url: link,
        isRead: false,
        isFavorite: false
      };
    })
    .filter(Boolean);
}

async function fetchSingleSource(sourceConfig) {
  const target = `${FEED_PROXY}${encodeURIComponent(sourceConfig.url)}`;
  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`${sourceConfig.name} 拉取失败：${response.status}`);
  }

  const xmlText = await response.text();
  return parseRssXml(xmlText, sourceConfig);
}

async function loadRealNews() {
  const settled = await Promise.allSettled(RSS_SOURCES.map((src) => fetchSingleSource(src)));
  const merged = [];
  const errors = [];

  settled.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      errors.push(`${RSS_SOURCES[idx].name}：${result.reason?.message || "请求失败"}`);
    }
  });

  // 浏览器端最低成本去重：按 URL 去重。
  const uniqueMap = new Map();
  merged.forEach((item) => {
    if (!uniqueMap.has(item.url)) uniqueMap.set(item.url, item);
  });

  const deduped = Array.from(uniqueMap.values());
  deduped.sort((a, b) => b.rawTime - a.rawTime);

  return { list: deduped, errors };
}

function parseTimeToMs(timeText) {
  const ms = new Date(String(timeText).replace(" ", "T")).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function getStatusText(item) {
  if (item.isFavorite) return "收藏";
  if (item.isRead) return "已读";
  return "未读";
}

function getRangeLabel() {
  if (state.timeRange === "24h") return "最近24小时";
  if (state.timeRange === "3d") return "最近3天";
  if (state.timeRange === "7d") return "最近7天";
  return "全部时间";
}

function getCutoffMs() {
  const now = Date.now();
  if (state.timeRange === "24h") return now - 24 * 60 * 60 * 1000;
  if (state.timeRange === "3d") return now - 3 * 24 * 60 * 60 * 1000;
  if (state.timeRange === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  return null;
}

function getProcessedNews() {
  const keyword = state.keyword.trim().toLowerCase();
  const cutoffMs = getCutoffMs();
  const filtered = state.allNews.filter((item) => {
    const selected = state.selectedCategories;
    const itemCategories = item.categories || [];
    const matchCategory =
      selected.length === 0 || selected.some((category) => itemCategories.includes(category));
    if (!matchCategory) return false;

    const statusText = getStatusText(item);
    const matchStatus = state.statusFilter === "全部" || statusText === state.statusFilter;
    if (!matchStatus) return false;

    if (cutoffMs !== null) {
      const itemTime = Number(item.rawTime) || parseTimeToMs(item.time);
      if (itemTime < cutoffMs) return false;
    }

    if (!keyword) return true;
    return [item.title, item.summary, item.source].some((field) => field.toLowerCase().includes(keyword));
  });

  filtered.sort((a, b) => {
    const tA = parseTimeToMs(a.time);
    const tB = parseTimeToMs(b.time);
    return state.sortOrder === "latest" ? tB - tA : tA - tB;
  });

  return filtered;
}

function renderTabs() {
  const categories = getCategories(state.allNews);
  categoryTabs.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    const isAll = category === "全部";
    const isActive = isAll
      ? state.selectedCategories.length === 0
      : state.selectedCategories.includes(category);
    button.className = `tab-btn${isActive ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      if (isAll) {
        state.selectedCategories = [];
      } else if (state.selectedCategories.includes(category)) {
        state.selectedCategories = state.selectedCategories.filter((c) => c !== category);
      } else {
        state.selectedCategories = [...state.selectedCategories, category];
      }
      renderTabs();
      renderNews();
    });
    categoryTabs.appendChild(button);
  });
}

function renderStatusTabs() {
  const statuses = ["全部", "未读", "已读", "收藏"];
  statusTabs.innerHTML = "";

  statuses.forEach((status) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-btn${state.statusFilter === status ? " active" : ""}`;
    button.textContent = status;
    button.addEventListener("click", () => {
      state.statusFilter = status;
      renderStatusTabs();
      renderNews();
    });
    statusTabs.appendChild(button);
  });
}

function updateNewsItem(id, updater) {
  state.allNews = state.allNews.map((item) => (item.id === id ? updater(item) : item));
  const updated = state.allNews.find((item) => item.id === id);
  if (!updated?.url) return;

  const idx = state.customEntries.findIndex((c) => c.url === updated.url);
  if (idx >= 0) {
    state.customEntries[idx] = {
      ...state.customEntries[idx],
      title: updated.title,
      summary: updated.summary,
      source: updated.source,
      categories: updated.categories,
      time: updated.time,
      rawTime: updated.rawTime,
      isRead: updated.isRead,
      isFavorite: updated.isFavorite
    };
    saveCustomEntries(state.customEntries);
    renderCustomList();
  }
}

function renderNews() {
  const list = getProcessedNews();
  newsGrid.innerHTML = "";
  const categoryText = state.selectedCategories.length
    ? state.selectedCategories.join("、")
    : "全部";
  resultInfo.textContent = state.loading
    ? "正在从公开 RSS 拉取资讯,请稍后..."
    : `当前分类：${categoryText}｜状态：${state.statusFilter}｜时间范围：${getRangeLabel()}｜共 ${list.length} 条资讯`;

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "未找到符合条件的资讯，试试更换分类或关键词。";
    newsGrid.appendChild(empty);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = `news-card${item.isRead ? " is-read" : ""}`;
    const statusText = getStatusText(item);
    const keyword = state.keyword;
    const highlightedTitle = highlightText(item.title, keyword);
    const highlightedSummary = highlightText(item.summary, keyword);
    const safeSource = escapeHtml(item.source);
    const safeTime = escapeHtml(item.time);
    const safeStatus = escapeHtml(statusText);
    const categoryTags = (item.categories || [])
      .map((category) => `<span class="meta-tag">分类：${escapeHtml(category)}</span>`)
      .join("");
    card.innerHTML = `
      <h3>${highlightedTitle}</h3>
      <p>${highlightedSummary}</p>
      <div class="card-meta">
        <span class="meta-tag">来源：${safeSource}</span>
        <span class="meta-tag">时间：${safeTime}</span>
        <span class="meta-tag">状态：${safeStatus}</span>
        ${categoryTags}
      </div>
      <div class="card-actions">
        <button class="mini-btn" type="button" data-action="toggle-favorite" data-id="${item.id}">
          ${item.isFavorite ? "取消收藏" : "收藏"}
        </button>
        <button class="mini-btn" type="button" data-action="toggle-read" data-id="${item.id}">
          ${item.isRead ? "标记未读" : "标记已读"}
        </button>
        <a class="link-btn" href="${item.url}" target="_blank" rel="noopener noreferrer">查看原文</a>
      </div>
    `;
    newsGrid.appendChild(card);
  });

  const actionButtons = newsGrid.querySelectorAll("[data-action]");
  actionButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.id;
      const action = event.currentTarget.dataset.action;

      if (action === "toggle-favorite") {
        updateNewsItem(id, (item) => ({ ...item, isFavorite: !item.isFavorite }));
      }
      if (action === "toggle-read") {
        updateNewsItem(id, (item) => ({ ...item, isRead: !item.isRead }));
      }

      renderNews();
    });
  });
}

function handleRefresh() {
  if (state.loading) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "刷新中...";
  state.loading = true;
  renderNews();

  loadRealNews()
    .then(({ list, errors }) => {
      const baseList = list.length ? list : generateFallbackNews(20);
      const finalList = mergeBaseWithCustom(baseList);

      // 保留本地收藏/已读状态
      const oldMap = new Map(state.allNews.map((item) => [item.url, item]));
      state.allNews = finalList.map((item) => {
        const old = oldMap.get(item.url);
        return old ? { ...item, isRead: old.isRead, isFavorite: old.isFavorite } : item;
      });

      if (!list.length) {
        resultInfo.textContent = "实时资讯暂不可用，已自动切换为内置示例资讯。";
      } else if (errors.length) {
        resultInfo.textContent = `已加载实时资讯，部分来源失败：${errors.join("；")}`;
      }
    })
    .catch((error) => {
      resultInfo.textContent = `刷新失败：${error?.message || "未知错误"}`;
    })
    .finally(() => {
      state.loading = false;
      renderTabs();
      renderStatusTabs();
      renderNews();
      renderCustomList();
      refreshBtn.disabled = false;
      refreshBtn.textContent = "手动刷新";
    });
}

function renderInitLoading() {
  state.loading = true;
  renderNews();
}

async function initData() {
  renderInitLoading();
  try {
    const { list, errors } = await loadRealNews();
    const baseList = list.length ? list : generateFallbackNews(20);
    if (!list.length) resultInfo.textContent = "实时资讯暂不可用，已展示内置示例资讯。";

    state.allNews = mergeBaseWithCustom(baseList);

    if (errors.length && list.length > 0) {
      resultInfo.textContent = `已加载 ${list.length} 条，部分来源失败：${errors.join("；")}`;
    } else if (errors.length && list.length === 0) {
      resultInfo.textContent = `实时源抓取失败，已切换示例资讯：${errors.join("；")}`;
    }
  } catch (error) {
    state.allNews = mergeBaseWithCustom(generateFallbackNews(20));
    resultInfo.textContent = `加载实时资讯失败，已切换示例资讯：${error?.message || "未知错误"}`;
  } finally {
    state.loading = false;
    renderTabs();
    renderStatusTabs();
    renderNews();
    renderCustomList();
  }
}

function init() {
  state.customEntries = loadCustomEntries();

  btnAddCustom?.addEventListener("click", () => {
    const url = customUrlInput?.value?.trim();
    if (!url) {
      alert("请输入 URL");
      return;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      alert("URL 格式不正确");
      return;
    }

    const title = customTitleInput?.value?.trim() || "";
    const summary = customSummaryInput?.value?.trim() || "";
    const source = customSourceInput?.value?.trim() || "自定义";
    const categories = parseCategoriesInput(customCategoriesInput?.value || "");

    const rawTime = Date.now();
    let entry = buildCustomEntry({
      url: parsed.toString(),
      title,
      summary,
      source,
      categories,
      rawTime
    });

    const existIdx = state.customEntries.findIndex((x) => x.url === entry.url);
    if (existIdx >= 0) {
      const old = state.customEntries[existIdx];
      entry = { ...entry, isRead: old.isRead, isFavorite: old.isFavorite };
      state.customEntries[existIdx] = entry;
    } else {
      state.customEntries.push(entry);
    }

    saveCustomEntries(state.customEntries);
    renderCustomList();
  });

  btnClearCustom?.addEventListener("click", () => {
    if (!confirm("确定清空所有自定义链接吗？")) return;
    state.customEntries = [];
    saveCustomEntries(state.customEntries);
    renderCustomList();
  });

  initData().catch(() => {});

  searchInput.addEventListener("input", (event) => {
    state.keyword = event.target.value;
    renderNews();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sortOrder = event.target.value;
    renderNews();
  });

  rangeSelect.addEventListener("change", (event) => {
    state.timeRange = event.target.value;
    renderNews();
  });

  refreshBtn.addEventListener("click", handleRefresh);
}

init();
