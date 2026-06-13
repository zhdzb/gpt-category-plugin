// ==UserScript==
// @name         ChatGPT 自定义会话分类 - Fixed 按钮版
// @namespace    chatgpt-custom-category
// @version      0.5.0
// @description  为 ChatGPT 增加本地会话分类、折叠、备注、颜色、导入导出功能。使用 fixed 按钮打开管理弹窗，不再侵入左侧栏布局。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'chatgpt_custom_category_data_v1';

  const LAUNCHER_ID = 'cgpt-category-launcher';
  const MODAL_ID = 'cgpt-category-modal';

  const ALL_CATEGORY_NAME = '全部';
  const DEFAULT_CATEGORY_NAME = '未分类';

  const DEFAULT_DATA = {
    version: 1,
    categories: {
      [DEFAULT_CATEGORY_NAME]: {
        color: '#8e8e93',
        collapsed: false,
      },
    },
    conversations: {},
    ui: {
      activeCategory: ALL_CATEGORY_NAME,
    },
  };

  const PRESET_COLORS = [
    '#4f8cff',
    '#ff9500',
    '#34c759',
    '#af52de',
    '#ff3b30',
    '#00c7be',
    '#ffcc00',
    '#8e8e93',
  ];

  function loadData() {
    const raw = GM_getValue(STORAGE_KEY, DEFAULT_DATA);
    return normalizeData(raw);
  }

  function saveData(data) {
    GM_setValue(STORAGE_KEY, normalizeData(data));
  }

  function normalizeData(input) {
    const data = input && typeof input === 'object' ? input : {};

    const categories = {
      ...DEFAULT_DATA.categories,
      ...(data.categories && typeof data.categories === 'object' ? data.categories : {}),
    };

    Object.keys(categories).forEach(name => {
      const meta = categories[name];

      if (!meta || typeof meta !== 'object') {
        categories[name] = {
          color: randomColor(),
          collapsed: false,
        };
        return;
      }

      categories[name] = {
        color: typeof meta.color === 'string' && meta.color ? meta.color : randomColor(),
        collapsed: Boolean(meta.collapsed),
      };
    });

    if (!categories[DEFAULT_CATEGORY_NAME]) {
      categories[DEFAULT_CATEGORY_NAME] = {
        color: '#8e8e93',
        collapsed: false,
      };
    }

    const conversations = {};

    if (data.conversations && typeof data.conversations === 'object') {
      Object.entries(data.conversations).forEach(([id, item]) => {
        if (!id || !item || typeof item !== 'object') return;

        const category = item.category || DEFAULT_CATEGORY_NAME;

        if (!categories[category]) {
          categories[category] = {
            color: randomColor(),
            collapsed: false,
          };
        }

        conversations[id] = {
          title: item.title || '未命名会话',
          href: item.href || `/c/${id}`,
          category,
          note: item.note || '',
          color: item.color || '',
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Date.now(),
          lastSeenAt: Number(item.lastSeenAt) || Date.now(),
        };
      });
    }

    const activeCategory = data.ui?.activeCategory || ALL_CATEGORY_NAME;

    return {
      version: 1,
      categories,
      conversations,
      ui: {
        activeCategory:
          activeCategory === ALL_CATEGORY_NAME || categories[activeCategory]
            ? activeCategory
            : ALL_CATEGORY_NAME,
      },
    };
  }

  function randomColor() {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
  }

  function getConversationIdFromHref(href) {
    if (!href) return null;

    const match = href.match(/\/c\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function normalizeHref(href) {
    try {
      const url = new URL(href, location.origin);
      return url.pathname + url.search + url.hash;
    } catch {
      return href;
    }
  }

  function isOwnElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    return Boolean(
      element.id === LAUNCHER_ID ||
        element.id === MODAL_ID ||
        element.closest?.(`#${LAUNCHER_ID}`) ||
        element.closest?.(`#${MODAL_ID}`)
    );
  }

  function getConversationLinks() {
    let candidates = Array.from(document.querySelectorAll('aside a[href*="/c/"]'));

    if (candidates.length === 0) {
      candidates = Array.from(document.querySelectorAll('nav a[href*="/c/"]'));
    }

    if (candidates.length === 0) {
      candidates = Array.from(document.querySelectorAll('a[href*="/c/"]'));
    }

    const map = new Map();

    candidates.forEach(link => {
      if (isOwnElement(link)) return;

      const href = link.getAttribute('href');
      const id = getConversationIdFromHref(href);

      if (!id) return;
      if (map.has(id)) return;

      map.set(id, link);
    });

    return Array.from(map.values());
  }

  function extractTitleFromLink(link) {
    const cloned = link.cloneNode(true);

    cloned.querySelectorAll('[data-cgpt-custom]').forEach(el => {
      el.remove();
    });

    const text = cloned.textContent?.replace(/\s+/g, ' ').trim();

    return text || '未命名会话';
  }

  function scanConversations() {
    const data = loadData();
    const links = getConversationLinks();

    let changed = false;
    const now = Date.now();

    links.forEach(link => {
      const href = link.getAttribute('href');
      const id = getConversationIdFromHref(href);

      if (!id) return;

      const title = extractTitleFromLink(link);
      const normalizedHref = normalizeHref(href);

      if (!data.conversations[id]) {
        data.conversations[id] = {
          title,
          href: normalizedHref,
          category: DEFAULT_CATEGORY_NAME,
          note: '',
          color: '',
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        };

        changed = true;
        return;
      }

      const item = data.conversations[id];

      if (!item.category) {
        item.category = DEFAULT_CATEGORY_NAME;
        changed = true;
      }

      if (!data.categories[item.category]) {
        data.categories[item.category] = {
          color: randomColor(),
          collapsed: false,
        };
        changed = true;
      }

      if (title && title !== item.title) {
        item.title = title;
        item.updatedAt = now;
        changed = true;
      }

      if (normalizedHref && normalizedHref !== item.href) {
        item.href = normalizedHref;
        item.updatedAt = now;
        changed = true;
      }

      item.lastSeenAt = now;
    });

    if (changed) {
      saveData(data);
    }

    updateLauncherCount(data);

    return data;
  }

  function getConversationColor(data, id) {
    const item = data.conversations[id];

    if (!item) return '#8e8e93';
    if (item.color) return item.color;

    return data.categories[item.category]?.color || '#8e8e93';
  }

  function ensureLauncher() {
    let launcher = document.getElementById(LAUNCHER_ID);

    if (launcher) return launcher;

    launcher = document.createElement('button');
    launcher.id = LAUNCHER_ID;
    launcher.dataset.cgptCustom = '1';
    launcher.type = 'button';
    launcher.innerHTML = `
      <span class="cgpt-launcher-icon">☰</span>
      <span class="cgpt-launcher-text">分类</span>
      <span class="cgpt-launcher-count">0</span>
    `;

    launcher.addEventListener('click', () => {
      openManagerModal({ scan: true });
    });

    document.body.appendChild(launcher);

    return launcher;
  }

  function updateLauncherCount(data = loadData()) {
    const launcher = document.getElementById(LAUNCHER_ID);
    if (!launcher) return;

    const countEl = launcher.querySelector('.cgpt-launcher-count');
    if (!countEl) return;

    countEl.textContent = String(Object.keys(data.conversations || {}).length);
  }

  function openManagerModal(options = {}) {
    const { scan = true } = options;
    const data = scan ? scanConversations() : loadData();

    const modal = openModal(buildManagerModalHtml(data));

    modal.addEventListener('click', event => {
      const target = event.target.closest('[data-manager-action]');
      if (!target) return;

      const action = target.dataset.managerAction;

      if (action === 'close') {
        closeModal();
        return;
      }

      if (action === 'refresh') {
        closeModal();
        openManagerModal({ scan: true });
        return;
      }

      if (action === 'select-category') {
        const latest = loadData();
        latest.ui.activeCategory = target.dataset.category || ALL_CATEGORY_NAME;
        saveData(latest);

        closeModal();
        openManagerModal({ scan: false });
        return;
      }

      if (action === 'toggle-category') {
        toggleCategory(target.dataset.category);
        closeModal();
        openManagerModal({ scan: false });
        return;
      }

      if (action === 'new-category') {
        closeModal();
        createCategory();
        openManagerModal({ scan: false });
        return;
      }

      if (action === 'edit-category-color') {
        editCurrentCategoryColor();
        return;
      }

      if (action === 'edit-conversation') {
        closeModal();
        openConversationEditor(target.dataset.id);
        return;
      }

      if (action === 'export-json') {
        exportJson();
        return;
      }

      if (action === 'import-json') {
        importJson();
        return;
      }
    });
  }

  function buildManagerModalHtml(data) {
    const activeCategory = data.ui.activeCategory || ALL_CATEGORY_NAME;
    const categoryNames = [ALL_CATEGORY_NAME, ...Object.keys(data.categories)];

    const categoryListHtml = categoryNames
      .map(name => {
        const activeClass = name === activeCategory ? 'cgpt-manager-cat-active' : '';

        const count =
          name === ALL_CATEGORY_NAME
            ? Object.keys(data.conversations).length
            : Object.values(data.conversations).filter(item => item.category === name).length;

        const color =
          name === ALL_CATEGORY_NAME
            ? '#8e8e93'
            : data.categories[name]?.color || '#8e8e93';

        return `
          <button
            class="cgpt-manager-cat ${activeClass}"
            data-manager-action="select-category"
            data-category="${escapeHtml(name)}"
          >
            <span class="cgpt-manager-cat-left">
              <span class="cgpt-dot" style="background:${escapeHtml(color)}"></span>
              <span class="cgpt-manager-cat-name">${escapeHtml(name)}</span>
            </span>
            <span class="cgpt-manager-cat-count">${count}</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="cgpt-modal-card cgpt-manager-card">
        <div class="cgpt-modal-header">
          <div>
            <strong>ChatGPT 自定义分类</strong>
            <div class="cgpt-modal-subtitle">
              本地管理会话分类、备注、颜色与 JSON 备份
            </div>
          </div>

          <button class="cgpt-modal-close" data-manager-action="close">×</button>
        </div>

        <div class="cgpt-manager-layout">
          <div class="cgpt-manager-sidebar">
            <div class="cgpt-manager-sidebar-title">分类</div>
            ${categoryListHtml}
          </div>

          <div class="cgpt-manager-content">
            <div class="cgpt-manager-toolbar">
              <button class="cgpt-btn" data-manager-action="refresh">刷新会话</button>
              <button class="cgpt-btn" data-manager-action="new-category">新建分类</button>
              <button class="cgpt-btn" data-manager-action="edit-category-color">分类颜色</button>
              <button class="cgpt-btn" data-manager-action="export-json">导出 JSON</button>
              <button class="cgpt-btn" data-manager-action="import-json">导入 JSON</button>
            </div>

            <div class="cgpt-manager-list">
              ${buildGroupedConversationHtml(data)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildGroupedConversationHtml(data) {
    const activeCategory = data.ui.activeCategory || ALL_CATEGORY_NAME;

    const entries = Object.entries(data.conversations)
      .filter(([, item]) => {
        if (activeCategory === ALL_CATEGORY_NAME) return true;
        return item.category === activeCategory;
      })
      .sort((a, b) => {
        const aTime = a[1].updatedAt || a[1].lastSeenAt || 0;
        const bTime = b[1].updatedAt || b[1].lastSeenAt || 0;
        return bTime - aTime;
      });

    if (entries.length === 0) {
      return `<div class="cgpt-empty">当前分类暂无会话。可以先点击“刷新会话”，或在左侧栏加载更多历史会话后再试。</div>`;
    }

    const groups = {};

    entries.forEach(([id, item]) => {
      const category = item.category || DEFAULT_CATEGORY_NAME;

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push([id, item]);
    });

    const orderedCategoryNames = [
      ...Object.keys(data.categories).filter(name => groups[name]),
      ...Object.keys(groups).filter(name => !data.categories[name]),
    ];

    return orderedCategoryNames
      .map(category => {
        const meta = data.categories[category] || {
          color: '#8e8e93',
          collapsed: false,
        };

        const items = groups[category] || [];
        const collapsed = Boolean(meta.collapsed);

        const itemHtml = collapsed
          ? ''
          : items
              .map(([id, item]) => {
                const color = getConversationColor(data, id);
                const note = item.note
                  ? `<div class="cgpt-manager-note">${escapeHtml(item.note)}</div>`
                  : '';

                return `
                  <div class="cgpt-manager-item">
                    <div class="cgpt-manager-item-main">
                      <a class="cgpt-manager-title" href="${escapeHtml(item.href)}">
                        <span class="cgpt-dot" style="background:${escapeHtml(color)}"></span>
                        <span>${escapeHtml(item.title)}</span>
                      </a>

                      <button
                        class="cgpt-btn cgpt-small-btn"
                        data-manager-action="edit-conversation"
                        data-id="${escapeHtml(id)}"
                      >
                        编辑
                      </button>
                    </div>

                    <div class="cgpt-manager-meta">
                      <span>分类：${escapeHtml(item.category || DEFAULT_CATEGORY_NAME)}</span>
                      ${
                        item.color
                          ? '<span>使用会话颜色</span>'
                          : '<span>使用分类颜色</span>'
                      }
                    </div>

                    ${note}
                  </div>
                `;
              })
              .join('');

        return `
          <div class="cgpt-category-section">
            <div
              class="cgpt-category-title"
              data-manager-action="toggle-category"
              data-category="${escapeHtml(category)}"
            >
              <span class="cgpt-category-name">
                <span class="cgpt-category-dot" style="background:${escapeHtml(meta.color)}"></span>
                <span class="cgpt-category-text">${escapeHtml(category)}</span>
                <span class="cgpt-count">${items.length}</span>
              </span>

              <span class="cgpt-category-arrow">${collapsed ? '▶' : '▼'}</span>
            </div>

            <div class="cgpt-category-items">
              ${itemHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function createCategory() {
    const name = prompt('请输入新分类名称：');

    if (!name) return;

    const category = name.trim();

    if (!category) return;

    const data = loadData();

    if (!data.categories[category]) {
      data.categories[category] = {
        color: randomColor(),
        collapsed: false,
      };
    }

    data.ui.activeCategory = category;

    saveData(data);
    updateLauncherCount(data);
  }

  function toggleCategory(category) {
    if (!category) return;

    const data = loadData();

    if (!data.categories[category]) {
      data.categories[category] = {
        color: randomColor(),
        collapsed: false,
      };
    }

    data.categories[category].collapsed = !data.categories[category].collapsed;

    saveData(data);
  }

  function openConversationEditor(id) {
    const data = loadData();
    const item = data.conversations[id];

    if (!item) return;

    const categoryOptions = Object.keys(data.categories)
      .map(name => {
        const selected = name === item.category ? 'selected' : '';

        return `
          <option value="${escapeHtml(name)}" ${selected}>
            ${escapeHtml(name)}
          </option>
        `;
      })
      .join('');

    const currentColor = item.color || getConversationColor(data, id);
    const useCategoryColorChecked = item.color ? '' : 'checked';

    const modal = openModal(`
      <div class="cgpt-modal-card">
        <div class="cgpt-modal-header">
          <div>
            <strong>编辑会话</strong>
            <div class="cgpt-modal-subtitle">${escapeHtml(item.title)}</div>
          </div>

          <button class="cgpt-modal-close" data-modal-action="close">×</button>
        </div>

        <div class="cgpt-form">
          <label>
            <span>标题</span>
            <input id="cgpt-edit-title" value="${escapeHtml(item.title)}" />
          </label>

          <label>
            <span>分类</span>
            <select id="cgpt-edit-category">
              ${categoryOptions}
            </select>
          </label>

          <label>
            <span>新分类</span>
            <input id="cgpt-edit-new-category" placeholder="可选：输入后会创建并使用该分类" />
          </label>

          <label>
            <span>颜色标记</span>
            <input id="cgpt-edit-color" type="color" value="${escapeHtml(currentColor)}" />
          </label>

          <label class="cgpt-checkbox-row">
            <input id="cgpt-edit-use-category-color" type="checkbox" ${useCategoryColorChecked} />
            <span>使用分类默认颜色</span>
          </label>

          <label>
            <span>备注</span>
            <textarea id="cgpt-edit-note" rows="5">${escapeHtml(item.note || '')}</textarea>
          </label>

          <div class="cgpt-modal-actions">
            <button class="cgpt-btn" data-modal-action="back-manager">返回管理</button>
            <button class="cgpt-btn" data-modal-action="close">关闭</button>
            <button class="cgpt-btn cgpt-primary" data-modal-action="save-conversation">保存</button>
          </div>
        </div>
      </div>
    `);

    const colorInput = modal.querySelector('#cgpt-edit-color');
    const useCategoryColorInput = modal.querySelector('#cgpt-edit-use-category-color');
    const categorySelect = modal.querySelector('#cgpt-edit-category');

    if (colorInput && useCategoryColorInput) {
      colorInput.addEventListener('input', () => {
        useCategoryColorInput.checked = false;
      });

      colorInput.addEventListener('change', () => {
        useCategoryColorInput.checked = false;
      });
    }

    if (categorySelect && colorInput && useCategoryColorInput) {
      categorySelect.addEventListener('change', () => {
        if (!useCategoryColorInput.checked) return;

        const latest = loadData();
        const category = categorySelect.value;
        const categoryColor = latest.categories[category]?.color || '#8e8e93';

        colorInput.value = categoryColor;
      });
    }

    if (useCategoryColorInput && colorInput) {
      useCategoryColorInput.addEventListener('change', () => {
        if (!useCategoryColorInput.checked) return;

        const latest = loadData();
        const category = categorySelect?.value || item.category || DEFAULT_CATEGORY_NAME;
        const categoryColor = latest.categories[category]?.color || '#8e8e93';

        colorInput.value = categoryColor;
      });
    }

    modal.addEventListener('click', event => {
      const target = event.target.closest('[data-modal-action]');
      if (!target) return;

      const action = target.dataset.modalAction;

      if (action === 'close') {
        closeModal();
        return;
      }

      if (action === 'back-manager') {
        closeModal();
        openManagerModal({ scan: false });
        return;
      }

      if (action === 'save-conversation') {
        const latest = loadData();
        const latestItem = latest.conversations[id];

        if (!latestItem) {
          closeModal();
          return;
        }

        const title = document.getElementById('cgpt-edit-title').value.trim();
        const selectedCategory = document.getElementById('cgpt-edit-category').value;
        const newCategory = document.getElementById('cgpt-edit-new-category').value.trim();
        const color = document.getElementById('cgpt-edit-color').value;
        const useCategoryColor = document.getElementById('cgpt-edit-use-category-color').checked;
        const note = document.getElementById('cgpt-edit-note').value.trim();

        const finalCategory = newCategory || selectedCategory || DEFAULT_CATEGORY_NAME;

        if (!latest.categories[finalCategory]) {
          latest.categories[finalCategory] = {
            color: randomColor(),
            collapsed: false,
          };
        }

        latestItem.title = title || latestItem.title;
        latestItem.category = finalCategory;
        latestItem.note = note;
        latestItem.color = useCategoryColor ? '' : color;
        latestItem.updatedAt = Date.now();

        latest.ui.activeCategory = finalCategory;

        saveData(latest);
        updateLauncherCount(latest);

        closeModal();
        openManagerModal({ scan: false });
      }
    });
  }

  function editCurrentCategoryColor() {
    const data = loadData();
    const category = data.ui.activeCategory;

    if (!category || category === ALL_CATEGORY_NAME) {
      alert('请先在左侧选择一个具体分类，不能给“全部”设置颜色。');
      return;
    }

    if (!data.categories[category]) {
      alert('分类不存在。');
      return;
    }

    closeModal();

    const currentColor = data.categories[category].color || '#8e8e93';

    const modal = openModal(`
      <div class="cgpt-modal-card">
        <div class="cgpt-modal-header">
          <div>
            <strong>设置分类颜色</strong>
            <div class="cgpt-modal-subtitle">${escapeHtml(category)}</div>
          </div>

          <button class="cgpt-modal-close" data-modal-action="close">×</button>
        </div>

        <div class="cgpt-form">
          <label>
            <span>分类名称</span>
            <input value="${escapeHtml(category)}" disabled />
          </label>

          <label>
            <span>分类颜色</span>
            <input id="cgpt-category-color-input" type="color" value="${escapeHtml(currentColor)}" />
          </label>

          <div class="cgpt-color-preview-row">
            <span>预览</span>
            <span
              id="cgpt-category-color-preview"
              class="cgpt-color-preview"
              style="background:${escapeHtml(currentColor)}"
            ></span>
          </div>

          <div class="cgpt-modal-actions">
            <button class="cgpt-btn" data-modal-action="back-manager">返回管理</button>
            <button class="cgpt-btn" data-modal-action="close">关闭</button>
            <button class="cgpt-btn cgpt-primary" data-modal-action="save-category-color">保存</button>
          </div>
        </div>
      </div>
    `);

    const colorInput = modal.querySelector('#cgpt-category-color-input');
    const preview = modal.querySelector('#cgpt-category-color-preview');

    if (colorInput && preview) {
      colorInput.addEventListener('input', () => {
        preview.style.background = colorInput.value;
      });

      colorInput.addEventListener('change', () => {
        preview.style.background = colorInput.value;
      });
    }

    modal.addEventListener('click', event => {
      const target = event.target.closest('[data-modal-action]');
      if (!target) return;

      const action = target.dataset.modalAction;

      if (action === 'close') {
        closeModal();
        return;
      }

      if (action === 'back-manager') {
        closeModal();
        openManagerModal({ scan: false });
        return;
      }

      if (action === 'save-category-color') {
        const latest = loadData();

        if (!latest.categories[category]) {
          latest.categories[category] = {
            color: '#8e8e93',
            collapsed: false,
          };
        }

        latest.categories[category].color = colorInput?.value || currentColor;

        saveData(latest);
        updateLauncherCount(latest);

        closeModal();
        openManagerModal({ scan: false });
      }
    });
  }

  function exportJson() {
    const data = loadData();
    const content = JSON.stringify(data, null, 2);

    const blob = new Blob([content], {
      type: 'application/json;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `chatgpt-custom-categories-${formatDateForFileName(new Date())}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function importJson() {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'application/json';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];

      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        if (!imported || typeof imported !== 'object') {
          alert('JSON 格式不正确。');
          return;
        }

        const confirmed = confirm('导入后会与当前数据合并。同 ID 会话会被导入数据覆盖，是否继续？');

        if (!confirmed) return;

        const current = loadData();

        const next = normalizeData({
          version: 1,
          categories: {
            ...current.categories,
            ...(imported.categories || {}),
          },
          conversations: {
            ...current.conversations,
            ...(imported.conversations || {}),
          },
          ui: {
            ...current.ui,
            ...(imported.ui || {}),
          },
        });

        saveData(next);
        updateLauncherCount(next);

        closeModal();
        openManagerModal({ scan: false });

        alert('导入完成。');
      } catch (error) {
        console.error(error);
        alert('导入失败，请检查 JSON 文件。');
      }
    });

    input.click();
  }

  function openModal(html) {
    closeModal();

    const modal = document.createElement('div');

    modal.id = MODAL_ID;
    modal.dataset.cgptCustom = '1';

    modal.innerHTML = `
      <div class="cgpt-modal-mask"></div>
      <div class="cgpt-modal-body">
        ${html}
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.cgpt-modal-mask').addEventListener('click', closeModal);

    return modal;
  }

  function closeModal() {
    const old = document.getElementById(MODAL_ID);

    if (old) {
      old.remove();
    }
  }

  function formatDateForFileName(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${y}${m}${d}-${h}${min}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectStyle() {
    GM_addStyle(`
      #${LAUNCHER_ID} {
        position: fixed;
        left: 16px;
        bottom: 88px;
        z-index: 99999;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(128, 128, 128, 0.35);
        background: Canvas;
        color: CanvasText;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        font-size: 13px;
        color-scheme: light dark;
      }

      #${LAUNCHER_ID}:hover {
        background: rgba(128, 128, 128, 0.16);
      }

      .cgpt-launcher-icon {
        font-size: 14px;
        opacity: 0.85;
      }

      .cgpt-launcher-text {
        font-weight: 600;
      }

      .cgpt-launcher-count {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(128, 128, 128, 0.18);
        font-size: 11px;
        opacity: 0.9;
      }

      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 999999;
      }

      .cgpt-modal-mask {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
      }

      .cgpt-modal-body {
        position: absolute;
        inset: 40px;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        pointer-events: none;
      }

      .cgpt-modal-card {
        width: min(720px, 92vw);
        max-height: calc(100vh - 80px);
        overflow: auto;
        pointer-events: auto;
        border-radius: 14px;
        border: 1px solid rgba(128, 128, 128, 0.35);
        background: Canvas;
        color: CanvasText;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        color-scheme: light dark;
      }

      .cgpt-manager-card {
        width: min(1080px, 94vw);
      }

      .cgpt-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(128, 128, 128, 0.25);
      }

      .cgpt-modal-subtitle {
        margin-top: 4px;
        font-size: 12px;
        opacity: 0.65;
        max-width: 720px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .cgpt-modal-close {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
      }

      .cgpt-manager-layout {
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        min-height: min(620px, calc(100vh - 160px));
      }

      .cgpt-manager-sidebar {
        border-right: 1px solid rgba(128, 128, 128, 0.25);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
      }

      .cgpt-manager-sidebar-title {
        padding: 6px 8px;
        font-size: 12px;
        opacity: 0.65;
      }

      .cgpt-manager-cat {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border: 1px solid transparent;
        background: transparent;
        color: inherit;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        text-align: left;
      }

      .cgpt-manager-cat:hover,
      .cgpt-manager-cat-active {
        background: rgba(128, 128, 128, 0.14);
        border-color: rgba(128, 128, 128, 0.25);
      }

      .cgpt-manager-cat-left {
        min-width: 0;
        display: flex;
        align-items: center;
      }

      .cgpt-manager-cat-name {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .cgpt-manager-cat-count {
        flex: 0 0 auto;
        opacity: 0.65;
        font-size: 12px;
      }

      .cgpt-manager-content {
        padding: 12px;
        min-width: 0;
        overflow: hidden;
      }

      .cgpt-manager-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .cgpt-manager-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: min(540px, calc(100vh - 250px));
        overflow-y: auto;
        padding-right: 4px;
      }

      .cgpt-manager-list::-webkit-scrollbar,
      .cgpt-manager-sidebar::-webkit-scrollbar,
      .cgpt-modal-card::-webkit-scrollbar {
        width: 6px;
      }

      .cgpt-manager-list::-webkit-scrollbar-thumb,
      .cgpt-manager-sidebar::-webkit-scrollbar-thumb,
      .cgpt-modal-card::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.35);
        border-radius: 999px;
      }

      .cgpt-category-section {
        border: 1px solid rgba(128, 128, 128, 0.22);
        border-radius: 10px;
        overflow: hidden;
        flex: 0 0 auto;
      }

      .cgpt-category-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 9px 10px;
        cursor: pointer;
        user-select: none;
        background: rgba(128, 128, 128, 0.08);
      }

      .cgpt-category-title:hover {
        background: rgba(128, 128, 128, 0.13);
      }

      .cgpt-category-name {
        min-width: 0;
        flex: 1;
        display: flex;
        align-items: center;
        overflow: hidden;
      }

      .cgpt-category-text {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-weight: 600;
      }

      .cgpt-category-arrow {
        flex: 0 0 auto;
        opacity: 0.75;
      }

      .cgpt-category-dot,
      .cgpt-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        margin-right: 6px;
        flex: 0 0 auto;
      }

      .cgpt-count {
        opacity: 0.55;
        margin-left: 4px;
        flex: 0 0 auto;
      }

      .cgpt-category-items {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .cgpt-manager-item {
        border-top: 1px solid rgba(128, 128, 128, 0.18);
        padding: 10px;
        min-width: 0;
      }

      .cgpt-manager-item:first-child {
        border-top: none;
      }

      .cgpt-manager-item-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
      }

      .cgpt-manager-title {
        display: flex;
        align-items: center;
        color: inherit;
        text-decoration: none;
        font-weight: 600;
        min-width: 0;
      }

      .cgpt-manager-title:hover {
        text-decoration: underline;
      }

      .cgpt-manager-title span:last-child {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .cgpt-manager-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
        opacity: 0.72;
        font-size: 12px;
      }

      .cgpt-manager-note {
        margin-top: 8px;
        padding: 8px;
        border-radius: 8px;
        background: rgba(128, 128, 128, 0.1);
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .cgpt-form {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .cgpt-form label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
      }

      .cgpt-form input,
      .cgpt-form select,
      .cgpt-form textarea {
        border: 1px solid rgba(128, 128, 128, 0.35);
        border-radius: 8px;
        padding: 8px;
        background: Canvas;
        color: CanvasText;
        font: inherit;
        box-sizing: border-box;
        color-scheme: light dark;
      }

      .cgpt-form select option {
        background: Canvas;
        color: CanvasText;
      }

      .cgpt-form input:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .cgpt-checkbox-row {
        flex-direction: row !important;
        align-items: center;
      }

      .cgpt-checkbox-row input {
        width: auto;
      }

      .cgpt-color-preview-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
      }

      .cgpt-color-preview {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid rgba(128, 128, 128, 0.35);
      }

      .cgpt-modal-actions {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
      }

      .cgpt-btn {
        border: 1px solid rgba(128, 128, 128, 0.35);
        background: transparent;
        color: inherit;
        border-radius: 7px;
        padding: 5px 9px;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
      }

      .cgpt-btn:hover {
        background: rgba(128, 128, 128, 0.12);
      }

      .cgpt-small-btn {
        padding: 3px 7px;
        flex: 0 0 auto;
      }

      .cgpt-primary {
        background: rgba(79, 140, 255, 0.18);
        border-color: rgba(79, 140, 255, 0.45);
      }

      .cgpt-empty {
        padding: 18px;
        opacity: 0.65;
        text-align: center;
        border: 1px dashed rgba(128, 128, 128, 0.3);
        border-radius: 10px;
      }

      @media (prefers-color-scheme: dark) {
        #${LAUNCHER_ID},
        .cgpt-modal-card,
        .cgpt-form input,
        .cgpt-form select,
        .cgpt-form textarea {
          background: #2f2f2f;
          color: #ffffff;
        }

        .cgpt-form select option {
          background: #2f2f2f;
          color: #ffffff;
        }
      }

      @media (prefers-color-scheme: light) {
        #${LAUNCHER_ID},
        .cgpt-modal-card,
        .cgpt-form input,
        .cgpt-form select,
        .cgpt-form textarea {
          background: #ffffff;
          color: #111111;
        }

        .cgpt-form select option {
          background: #ffffff;
          color: #111111;
        }
      }

      @media (max-width: 760px) {
        #${LAUNCHER_ID} {
          left: 12px;
          bottom: 72px;
        }

        .cgpt-modal-body {
          inset: 16px;
        }

        .cgpt-manager-layout {
          grid-template-columns: 1fr;
        }

        .cgpt-manager-sidebar {
          border-right: none;
          border-bottom: 1px solid rgba(128, 128, 128, 0.25);
          max-height: 180px;
        }

        .cgpt-manager-list {
          max-height: calc(100vh - 360px);
        }
      }
    `);
  }

  function init() {
    injectStyle();
    ensureLauncher();
    updateLauncherCount(loadData());

    setTimeout(() => {
      scanConversations();
    }, 1200);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updateLauncherCount(loadData());
      }
    });
  }

  init();
})();
