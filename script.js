(() => {
  const API_URL = "https://api.freeapi.app/api/v1/public/youtube/videos";
  const PAGE_SIZE = 12;

  const state = {
    all: [],       // every video, normalized
    filtered: [],  // after search filter + sort
    sortBy: "date",
    query: "",
    page: 1,
    loaded: false,
  };

  const els = {
    grid: document.getElementById("grid"),
    status: document.getElementById("statusBar"),
    empty: document.getElementById("emptyState"),
    clearFilter: document.getElementById("clearFilter"),
    search: document.getElementById("searchInput"),
    flags: document.querySelectorAll(".flag"),
    prev: document.getElementById("prevPage"),
    next: document.getElementById("nextPage"),
    pageInfo: document.getElementById("pageInfo"),
    termCmd: document.getElementById("termCmd"),
  };

  // ---------- helpers ----------

  function parseISODuration(iso) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    if (!m) return "0:00";
    const h = parseInt(m[1] || "0", 10);
    const min = parseInt(m[2] || "0", 10);
    const s = parseInt(m[3] || "0", 10);
    if (h > 0) {
      return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${min}:${String(s).padStart(2, "0")}`;
  }

  function compactNumber(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    const units = [
      { v: 1e9, s: "B" },
      { v: 1e6, s: "M" },
      { v: 1e3, s: "K" },
    ];
    for (const u of units) {
      if (n >= u.v) {
        const val = n / u.v;
        return `${val >= 100 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, "")}${u.s}`;
      }
    }
    return String(n);
  }

  function timeAgo(dateStr) {
    const then = new Date(dateStr).getTime();
    const now = Date.now();
    const diffSec = Math.max(1, Math.floor((now - then) / 1000));
    const units = [
      [60, "second"],
      [60, "minute"],
      [24, "hour"],
      [30, "day"],
      [12, "month"],
      [Infinity, "year"],
    ];
    let value = diffSec;
    let unit = "second";
    let divisor = 1;
    for (const [amount, name] of units) {
      if (value < amount) { unit = name; break; }
      value = Math.floor(value / amount);
      unit = name;
    }
    return `${value} ${unit}${value !== 1 ? "s" : ""} ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function initials(name) {
    return (name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  // ---------- data ----------

  async function fetchPage(page) {
    const res = await fetch(`${API_URL}?page=${page}&limit=20`);
    if (!res.ok) throw new Error(`request failed: ${res.status}`);
    const json = await res.json();
    return json.data;
  }

  function normalize(rawItem) {
    const v = rawItem.items;
    return {
      id: v.id,
      title: v.snippet?.title || "untitled",
      channel: v.snippet?.channelTitle || "unknown",
      publishedAt: v.snippet?.publishedAt,
      thumb:
        v.snippet?.thumbnails?.medium?.url ||
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.default?.url,
      duration: parseISODuration(v.contentDetails?.duration),
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
    };
  }

  async function loadAll() {
    setStatus("$ fetching videos …");
    try {
      const first = await fetchPage(1);
      const items = [...first.data];
      const totalPages = first.totalPages || 1;

      const rest = [];
      for (let p = 2; p <= totalPages; p++) rest.push(fetchPage(p));
      const restResults = await Promise.all(rest);
      restResults.forEach((r) => items.push(...r.data));

      state.all = items.map(normalize);
      state.loaded = true;
      setStatus(`$ ${state.all.length} videos indexed`);
      applyFilterSort();
    } catch (err) {
      console.error(err);
      setStatus(`$ error: could not reach freeapi.app — ${err.message}`, true);
    }
  }

  // ---------- render ----------

  function setStatus(text, isError = false) {
    els.status.textContent = text;
    els.status.classList.toggle("is-error", isError);
  }

  function skeletonCard() {
    const div = document.createElement("div");
    div.className = "card skeleton";
    div.innerHTML = `
      <div class="card__thumb"></div>
      <div class="card__body">
        <div class="card__avatar"></div>
        <div class="card__meta" style="flex:1">
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      </div>`;
    return div;
  }

  function renderSkeletons(n = 12) {
    els.grid.innerHTML = "";
    els.empty.classList.add("hidden");
    for (let i = 0; i < n; i++) els.grid.appendChild(skeletonCard());
  }

  function cardTemplate(v) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `${v.title} by ${v.channel}`);

    card.innerHTML = `
      <div class="card__thumb">
        <img src="${escapeHtml(v.thumb)}" alt="" loading="lazy" />
        <span class="card__duration">${v.duration}</span>
        <div class="card__play">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="rgba(11,15,20,0.65)"/>
            <path d="M18 14L30 22L18 30V14Z" fill="#E7EDF3"/>
          </svg>
        </div>
      </div>
      <div class="card__body">
        <div class="card__avatar">${escapeHtml(initials(v.channel))}</div>
        <div class="card__meta">
          <h3 class="card__title">${escapeHtml(v.title)}</h3>
          <p class="card__channel">${escapeHtml(v.channel)}</p>
          <p class="card__stats">
            <span>${compactNumber(v.views)} views</span>
            <span class="dot">·</span>
            <span>${timeAgo(v.publishedAt)}</span>
            <span class="dot">·</span>
            <span class="likes">&#9650; ${compactNumber(v.likes)}</span>
          </p>
        </div>
      </div>`;

    const open = () => window.open(`https://www.youtube.com/watch?v=${v.id}`, "_blank", "noopener");
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    return card;
  }

  function renderGrid() {
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filtered.slice(start, start + PAGE_SIZE);

    els.grid.innerHTML = "";

    if (pageItems.length === 0) {
      els.empty.classList.remove("hidden");
    } else {
      els.empty.classList.add("hidden");
      pageItems.forEach((v) => els.grid.appendChild(cardTemplate(v)));
    }

    renderPager();
    renderStatus();
    renderTermline();
  }

  function renderStatus() {
    if (!state.loaded) return;
    const q = state.query ? ` matching "${state.query}"` : "";
    setStatus(`$ ${state.filtered.length} video${state.filtered.length === 1 ? "" : "s"}${q}`);
  }

  function renderTermline() {
    const flagArg = { date: "--sort=date", views: "--sort=views", likes: "--sort=likes" }[state.sortBy];
    const grepArg = state.query ? ` | grep -i "${state.query}"` : "";
    els.termCmd.textContent = `ls ${flagArg}${grepArg}`;
  }

  function renderPager() {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    els.pageInfo.textContent = `page ${state.page} / ${totalPages}`;
    els.prev.disabled = state.page <= 1;
    els.next.disabled = state.page >= totalPages;
  }

  // ---------- filter / sort ----------

  function applyFilterSort() {
    let items = state.all;

    if (state.query) {
      const q = state.query.toLowerCase();
      items = items.filter(
        (v) => v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q)
      );
    }

    const sorted = [...items];
    if (state.sortBy === "date") {
      sorted.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } else if (state.sortBy === "views") {
      sorted.sort((a, b) => b.views - a.views);
    } else if (state.sortBy === "likes") {
      sorted.sort((a, b) => b.likes - a.likes);
    }

    state.filtered = sorted;
    state.page = 1;
    renderGrid();
  }

  // ---------- events ----------

  let searchDebounce;
  els.search.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.query = e.target.value.trim();
      applyFilterSort();
    }, 200);
  });

  els.clearFilter.addEventListener("click", () => {
    els.search.value = "";
    state.query = "";
    applyFilterSort();
    els.search.focus();
  });

  els.flags.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.flags.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.sortBy = btn.dataset.sort;
      applyFilterSort();
    });
  });

  els.prev.addEventListener("click", () => {
    if (state.page > 1) { state.page--; renderGrid(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  els.next.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page < totalPages) { state.page++; renderGrid(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  // ---------- init ----------

  renderSkeletons();
  loadAll();
})();
