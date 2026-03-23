"use strict";

// ====== 工具函数 ======
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getWeekStart(date) {
  const tmp = new Date(date);
  const day = tmp.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // 0 for Monday
  tmp.setDate(tmp.getDate() - diff);
  tmp.setHours(0, 0, 0, 0);
  return tmp;
}
function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ====== 存储层 ======
const STORAGE_KEY = "weekly-planner-v1";
const THOUGHTS_KEY = "daily-thoughts-v1";
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadThoughts() {
  try {
    const raw = localStorage.getItem(THOUGHTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveThoughts(data) {
  localStorage.setItem(THOUGHTS_KEY, JSON.stringify(data));
}

// ====== 新增：导出完整数据（统一备份） ======
function exportAllData() {
  return {
    version: "1.0",          // 版本标识，便于未来扩展
    tasks: loadAll(),        // 原 storage 数据
    thoughts: loadThoughts() // 感想数据
  };
}

function normalizeThoughtEntries(iso) {
  const raw = thoughts[iso];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    return [{ id: uid(), createdAt: Date.now(), content: raw.trim() }];
  }
  return [];
}
function weekKey(date) {
  const ws = getWeekStart(date);
  return `wk:${formatDateISO(ws)}`;
}

// 数据结构：
// {
//   "wk:2026-03-16": {
//     goals: [{ id, title, done }],
//     notes: "text",
//     days: {
//       "2026-03-16": [{ id, title, done }],
//       ...
//     }
//   }
// }

function ensureWeek(storage, ws) {
  const key = weekKey(ws);
  if (!storage[key]) {
    const dates = getWeekDates(getWeekStart(ws)).map(formatDateISO);
    storage[key] = {
      goals: [],
      notes: "",
      days: Object.fromEntries(dates.map(d => [d, []]))
    };
  }
  return storage[key];
}

// ====== 视图与交互 ======
const els = {
  monthRangeLabel: document.getElementById("monthRangeLabel"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  todayBtn: document.getElementById("todayBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  monthGrid: document.getElementById("monthGrid"),
  weeklyGoalsList: document.getElementById("weeklyGoalsList"),
  newWeeklyGoalInput: document.getElementById("newWeeklyGoalInput"),
  addWeeklyGoalBtn: document.getElementById("addWeeklyGoalBtn"),
  weeklyNotes: document.getElementById("weeklyNotes"),
  saveThoughtBtn: document.getElementById("saveThoughtBtn"),
  thoughtPreview: document.getElementById("thoughtPreview"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  printBtn: document.getElementById("printBtn"),
  weekProgress: document.getElementById("weekProgress"),
  quickAddBtn: document.getElementById("quickAddBtn"),
  addDialog: document.getElementById("addDialog"),
  addDateInput: document.getElementById("addDateInput"),
  addTitleInput: document.getElementById("addTitleInput"),
  addCancelBtn: document.getElementById("addCancelBtn"),
  addConfirmBtn: document.getElementById("addConfirmBtn"),
  contextMenu: document.getElementById("contextMenu"),
  exportMenu: document.getElementById("exportMenu"),
};

const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

let currentDate = new Date();
let storage = loadAll();
let thoughts = loadThoughts();
let selectedThoughtDate = formatDateISO(new Date());

// ====== 移动端拖拽状态管理 ======
let dragState = {
  active: false,
  task: null,          // 被拖拽的任务对象
  sourceDate: null,    // 源日期 (ISO)
  sourceNode: null,    // 源 DOM 节点
  clone: null,         // 跟随手指的克隆元素
  targetDate: null,    // 当前高亮的目标日期 (ISO)
  targetEl: null       // 当前高亮的目标格子元素
};

function getMonthStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthGrid(date) {
  // 以周一为一周起点，生成6行*7列的日期格
  const startOfMonth = getMonthStart(date);
  const startDay = (startOfMonth.getDay() + 6) % 7; // 0 for Monday
  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startDay);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function renderMonth() {
  const ms = getMonthStart(currentDate);
  const label = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}`;
  els.monthRangeLabel.textContent = label;

  // 侧边栏：目标 + 每日感想（始终显示当前周的目标，不受月份浏览影响）
  const ws = getWeekStart(new Date());
  const wk = ensureWeek(storage, ws);
  renderWeeklyGoals(wk);
  loadThoughtForDate(selectedThoughtDate);

  // 更新月份进度条
  updateMonthProgress();

  // 渲染月网格
  els.monthGrid.innerHTML = "";
  const tpl = document.getElementById("monthDayTemplate");
  const days = getMonthGrid(currentDate);
  const currentMonth = currentDate.getMonth();
  days.forEach((d) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const iso = formatDateISO(d);
    node.dataset.date = iso;
    const isOutside = d.getMonth() !== currentMonth;
    if (isOutside) node.classList.add("outside");

    // 检查是否是今天，如果是则添加高亮类
    const today = new Date();
    const isToday = d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (isToday) node.classList.add("today-highlight");

    const dateLabel = node.querySelector(".md-date");
    dateLabel.textContent = String(d.getDate());
    dateLabel.style.cursor = "pointer";
    dateLabel.title = "查看当天每日感想";
    dateLabel.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedThoughtDate = iso;
      loadThoughtForDate(iso);
    });
    const addBtn = node.querySelector(".add-day-task-btn");
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOutside) return;
      openAddDialog(iso);
    });

    const listEl = node.querySelector(".task-list");
    listEl.dataset.date = iso;
    setupDropzone(listEl);

    // 读取任务：从对应周的数据结构中取
    const wkForDay = ensureWeek(storage, d);
    const tasks = wkForDay.days[iso] || [];
    renderTasks(listEl, tasks);

    els.monthGrid.appendChild(node);
  });

  updateProgress();
}

// ====== 性能优化：仅更新任务勾选状态 ======
function updateTaskDoneUI(task, node, newDone) {
  const check = node.querySelector(".task-check");
  const titleEl = node.querySelector(".task-title");
  if (newDone) {
    node.classList.add("done");
    titleEl.style.textDecoration = "line-through";
    titleEl.style.color = "var(--muted)";
  } else {
    node.classList.remove("done");
    titleEl.style.textDecoration = "none";
    titleEl.style.color = "var(--fg)";
  }
  check.checked = newDone; // 同步复选框状态
}

// ====== 移动端触摸拖拽辅助函数 ======
function createDragClone(taskNode, taskText) {
  const clone = taskNode.cloneNode(true);
  clone.style.position = "fixed";
  clone.style.top = "-1000px";
  clone.style.left = "-1000px";
  clone.style.opacity = "0.8";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = "1000";
  clone.style.width = taskNode.offsetWidth + "px";
  clone.style.backgroundColor = "var(--bg)";
  clone.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  document.body.appendChild(clone);
  return clone;
}

function updateDragClonePosition(clone, touchX, touchY) {
  if (!clone) return;
  clone.style.top = (touchY - clone.offsetHeight / 2) + "px";
  clone.style.left = (touchX - clone.offsetWidth / 2) + "px";
}

function findTargetDateFromTouch(touch) {
  const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
  for (let el of elements) {
    const dayCell = el.closest(".month-day");
    if (dayCell && !dayCell.classList.contains("outside")) {
      return {
        el: dayCell,
        date: dayCell.dataset.date
      };
    }
  }
  return null;
}

function clearDragHighlights() {
  if (dragState.targetEl) {
    dragState.targetEl.style.outline = "";
    dragState.targetEl = null;
  }
  dragState.targetDate = null;
}

function highlightTarget(targetEl) {
  if (dragState.targetEl && dragState.targetEl !== targetEl) {
    dragState.targetEl.style.outline = "";
  }
  if (targetEl) {
    targetEl.style.outline = "2px solid var(--primary)";
    dragState.targetEl = targetEl;
    dragState.targetDate = targetEl.dataset.date;
  } else {
    clearDragHighlights();
  }
}

function cancelDrag() {
  if (dragState.active) {
    dragState.active = false;
    if (dragState.clone) {
      dragState.clone.remove();
      dragState.clone = null;
    }
    if (dragState.sourceNode) {
      dragState.sourceNode.classList.remove("dragging");
    }
    clearDragHighlights();
    dragState.task = null;
    dragState.sourceDate = null;
    dragState.sourceNode = null;
    dragState.targetDate = null;
  }
}

function performMove() {
  if (!dragState.task || !dragState.sourceDate || !dragState.targetDate) return false;
  if (dragState.sourceDate === dragState.targetDate) return false;

  // 获取源任务列表和目标任务列表
  const sourceDate = new Date(dragState.sourceDate);
  const targetDate = new Date(dragState.targetDate);
  const wkSource = ensureWeek(storage, sourceDate);
  const wkTarget = ensureWeek(storage, targetDate);
  const sourceList = wkSource.days[dragState.sourceDate] || [];
  const targetList = wkTarget.days[dragState.targetDate] || [];

  const idx = sourceList.findIndex(t => t.id === dragState.task.id);
  if (idx >= 0) {
    const [moved] = sourceList.splice(idx, 1);
    targetList.push(moved);
    saveAll(storage);
    renderMonth(); // 重绘整个月视图以更新两个格子的内容
    return true;
  }
  return false;
}

// ====== 为任务节点绑定触摸事件 ======
function bindTouchEvents(node, task, listEl, tasks) {
  node.addEventListener("touchstart", (e) => {
    // 阻止页面滚动和默认菜单
    e.preventDefault();
    if (dragState.active) return;

    // 记录拖拽状态
    dragState.active = true;
    dragState.task = task;
    dragState.sourceDate = listEl.dataset.date;
    dragState.sourceNode = node;
    node.classList.add("dragging");

    // 创建克隆元素
    const taskText = node.querySelector(".task-title").innerText;
    dragState.clone = createDragClone(node, taskText);

    // 获取触摸点初始位置
    const touch = e.touches[0];
    updateDragClonePosition(dragState.clone, touch.clientX, touch.clientY);
  });

  node.addEventListener("touchmove", (e) => {
    if (!dragState.active) return;
    e.preventDefault();
    const touch = e.touches[0];
    updateDragClonePosition(dragState.clone, touch.clientX, touch.clientY);

    // 查找目标日期格子
    const target = findTargetDateFromTouch(touch);
    if (target && target.date !== dragState.targetDate) {
      highlightTarget(target.el);
    } else if (!target) {
      clearDragHighlights();
    }
  });

  node.addEventListener("touchend", (e) => {
    if (!dragState.active) return;
    e.preventDefault();

    // 如果有高亮的目标格子，执行移动
    let moved = false;
    if (dragState.targetDate && dragState.targetDate !== dragState.sourceDate) {
      moved = performMove();
    }

    // 清理拖拽状态
    cancelDrag();

    // 如果移动成功，已通过 renderMonth 刷新，否则无需额外操作
    if (moved) {
      // 刷新后，当前拖拽的节点已经消失，无需额外操作
    }
  });

  node.addEventListener("touchcancel", (e) => {
    cancelDrag();
  });
}

function renderTasks(listEl, tasks) {
  const taskTpl = document.getElementById("taskItemTemplate");
  listEl.innerHTML = "";
  tasks.forEach((task) => {
    const node = taskTpl.content.firstElementChild.cloneNode(true);
    const check = node.querySelector(".task-check");
    const titleEl = node.querySelector(".task-title");
    const btnUp = node.querySelector(".up");
    const btnDown = node.querySelector(".down");
    const btnEdit = node.querySelector(".edit");
    const btnDel = node.querySelector(".delete");

    titleEl.textContent = task.title;
    check.checked = !!task.done;
    if (task.done) {
      node.classList.add("done");
      titleEl.style.textDecoration = "line-through";
      titleEl.style.color = "var(--muted)";
    } else {
      node.classList.remove("done");
      titleEl.style.textDecoration = "none";
      titleEl.style.color = "var(--fg)";
    }

    node.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, {
        type: "task",
        taskRef: task,
        listRef: tasks,
        listElRef: listEl
      });
    });

    // 桌面端拖拽（保留）
    node.addEventListener("dragstart", (e) => {
      node.classList.add("dragging");
      e.dataTransfer.setData("text/plain", JSON.stringify({
        id: task.id,
        fromDate: listEl.dataset.date
      }));
      e.dataTransfer.effectAllowed = "move";
    });
    node.addEventListener("dragend", () => {
      node.classList.remove("dragging");
    });

    // 性能优化：勾选时只更新 UI，不重绘整个列表
    check.addEventListener("change", () => {
      const newDone = check.checked;
      task.done = newDone;
      updateTaskDoneUI(task, node, newDone);
      saveAll(storage);
      updateProgress();
    });

    btnDel.addEventListener("click", () => {
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        tasks.splice(idx, 1);
        saveAll(storage);
        renderTasks(listEl, tasks);
        updateProgress();
      }
    });
    btnUp.addEventListener("click", () => {
      const i = tasks.findIndex(t => t.id === task.id);
      if (i > 0) {
        [tasks[i - 1], tasks[i]] = [tasks[i], tasks[i - 1]];
        saveAll(storage);
        renderTasks(listEl, tasks);
      }
    });
    btnDown.addEventListener("click", () => {
      const i = tasks.findIndex(t => t.id === task.id);
      if (i < tasks.length - 1) {
        [tasks[i + 1], tasks[i]] = [tasks[i], tasks[i + 1]];
        saveAll(storage);
        renderTasks(listEl, tasks);
      }
    });
    btnEdit.addEventListener("click", () => {
      titleEl.setAttribute("contenteditable", "true");
      titleEl.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) sel.collapse(titleEl, 1);
    });
    titleEl.addEventListener("blur", () => {
      if (titleEl.isContentEditable) {
        const newTitle = titleEl.textContent.trim();
        task.title = newTitle || task.title;
        titleEl.removeAttribute("contenteditable");
        saveAll(storage);
        renderTasks(listEl, tasks);
      }
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        titleEl.textContent = task.title;
        titleEl.blur();
      }
    });

    // 移动端触摸拖拽
    bindTouchEvents(node, task, listEl, tasks);

    listEl.appendChild(node);
  });
}

function setupDropzone(listEl) {
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const { id, fromDate } = JSON.parse(data);
    const ws = getWeekStart(currentDate);
    const wk = ensureWeek(storage, ws);
    if (fromDate === listEl.dataset.date) return;
    const fromList = wk.days[fromDate] || [];
    const toList = wk.days[listEl.dataset.date] || [];
    const index = fromList.findIndex(t => t.id === id);
    if (index >= 0) {
      const [moved] = fromList.splice(index, 1);
      toList.push(moved);
      saveAll(storage);
      renderMonth();
    }
  });
}

function renderWeeklyGoals(weekData) {
  const ul = els.weeklyGoalsList;
  ul.innerHTML = "";
  weekData.goals.forEach((goal, i) => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.style.display = "flex";
    main.style.alignItems = "center";
    main.style.gap = "8px";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!goal.done;
    const title = document.createElement("span");
    title.textContent = goal.title;
    if (goal.done) {
      title.style.textDecoration = "line-through";
      title.style.color = "var(--muted)";
    }
    main.appendChild(check);
    main.appendChild(title);

    check.addEventListener("change", () => {
      goal.done = check.checked;
      saveAll(storage);
      renderWeeklyGoals(weekData);
      updateProgress();
    });
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, {
        type: "goal",
        index: i,
        listRef: weekData.goals,
        rerender: () => renderWeeklyGoals(weekData)
      });
    });

    li.appendChild(main);
    ul.appendChild(li);
  });
}

let currentDayProgress = 0; // 跟踪当天进度，避免重复触发礼花

function updateProgress() {
  // 仅统计"今天"的任务完成度
  const today = new Date();
  const iso = formatDateISO(today);
  const wk = ensureWeek(storage, today);
  const list = wk.days[iso] || [];
  const total = list.length;
  const done = list.filter(t => t.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const textEl = els.weekProgress.querySelector(".progress-text");
  const barInner = els.weekProgress.querySelector(".bar-inner");
  textEl.textContent = `今日完成度：${percent}%`;
  barInner.style.width = `${clamp(percent, 0, 100)}%`;

  // 只有进度从非100%变为100%时才触发礼花效果
  if (percent === 100 && total > 0 && currentDayProgress !== 100) {
    fireConfetti();
  }

  // 更新当前进度跟踪
  currentDayProgress = percent;
}

// ====== 礼花效果 ======
function fireConfetti() {
  var count = 200;
  var defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}
function updateMonthProgress() {
  // 计算本月进度
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // 获取本月的第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate(); // 本月总天数
  const dayOfMonth = today.getDate();    // 今天是本月第几天

  const monthPercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const progressInner = document.getElementById("monthProgressInner");
  const progressText = document.getElementById("monthProgressText");

  if (progressInner && progressText) {
    progressInner.style.width = `${clamp(monthPercent, 0, 100)}%`;
    progressText.textContent = `${monthPercent}%`;
  }
}
function loadThoughtForDate(iso) {
  const entries = normalizeThoughtEntries(iso);
  thoughts[iso] = entries;
  els.weeklyNotes.value = "";

  if (!entries.length) {
    els.thoughtPreview.innerHTML = `<div class="empty-thought">${iso}：暂无每日感想</div>`;
    return;
  }

  const html = entries
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((item, index) => {
      const dt = new Date(item.createdAt);
      const t = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      return `
        <div class="thought-item" data-thought-index="${index}" data-thought-date="${iso}">
          <div class="thought-time">${iso} ${t}</div>
          <div class="thought-content">${item.content}</div>
        </div>
      `;
    })
    .join("");
  els.thoughtPreview.innerHTML = html;

  // 为感想条目添加右键菜单事件
  const thoughtItems = els.thoughtPreview.querySelectorAll('.thought-item');
  thoughtItems.forEach((item) => {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const index = parseInt(item.dataset.thoughtIndex);
      const thoughtDate = item.dataset.thoughtDate;
      openContextMenu(e.clientX, e.clientY, {
        type: "thought",
        index: index,
        date: thoughtDate,
        itemRef: item
      });
    });
  });
}

function saveCurrentThought() {
  const content = els.weeklyNotes.value.trim();
  const entries = normalizeThoughtEntries(selectedThoughtDate);
  if (content) entries.push({ id: uid(), createdAt: Date.now(), content });
  thoughts[selectedThoughtDate] = entries;
  saveThoughts(thoughts);
  loadThoughtForDate(selectedThoughtDate);
}

// ====== 事件绑定 ======
els.prevMonthBtn.addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  renderMonth();
});
els.nextMonthBtn.addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  renderMonth();
});
els.todayBtn.addEventListener("click", () => {
  currentDate = new Date();
  renderMonth();
});
els.addWeeklyGoalBtn.addEventListener("click", () => {
  const title = els.newWeeklyGoalInput.value.trim();
  if (!title) return;
  const ws = getWeekStart(currentDate);
  const wk = ensureWeek(storage, ws);
  wk.goals.push({ id: uid(), title, done: false });
  els.newWeeklyGoalInput.value = "";
  saveAll(storage);
  renderWeeklyGoals(wk);
  updateProgress();
});
els.newWeeklyGoalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    els.addWeeklyGoalBtn.click();
  }
});
els.saveThoughtBtn.addEventListener("click", () => {
  saveCurrentThought();
});

// 主题切换
const THEME_KEY = "weekly-planner-theme";
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  // 跟随系统
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
let currentTheme = loadTheme();
applyTheme(currentTheme);
els.themeToggleBtn.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

// 导出 / 导入 / 打印
function flattenTasksForExport() {
  const lines = [];
  const weekKeys = Object.keys(storage).sort();
  weekKeys.forEach((wkKey) => {
    const weekData = storage[wkKey];
    if (!weekData || !weekData.days) return;
    Object.keys(weekData.days).sort().forEach((dateKey) => {
      const tasks = weekData.days[dateKey] || [];
      tasks.forEach((task) => {
        lines.push({ date: dateKey, title: task.title, done: !!task.done });
      });
    });
  });
  return lines;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

els.exportBtn.addEventListener("click", () => {
  toggleExportMenu();
});

// ====== 修改导入逻辑：支持统一备份格式 ======
els.importInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    // 判断是否为统一备份格式（包含 tasks 和 thoughts）
    if (json && typeof json === "object") {
      if (json.tasks !== undefined && json.thoughts !== undefined) {
        // 新格式：完整备份
        storage = json.tasks;
        thoughts = json.thoughts;
        saveAll(storage);
        saveThoughts(thoughts);
        alert("导入成功（完整备份）");
      } else {
        // 旧格式：仅包含 tasks 数据
        storage = json;
        saveAll(storage);
        // 感想数据保持不变，提示用户
        alert("导入成功（仅任务数据，感想未变更）");
      }
      // 刷新界面
      renderMonth();
      loadThoughtForDate(selectedThoughtDate);
    } else {
      alert("文件格式不正确，请使用有效的 JSON 文件");
    }
  } catch (err) {
    console.error("导入失败", err);
    alert("导入失败，请确认为有效的 JSON 文件");
  }
  e.target.value = "";
});

els.printBtn.addEventListener("click", () => {
  window.print();
});

// 统一添加任务对话框
function openAddDialog(dateIso) {
  els.addDialog.hidden = false;
  const d = dateIso ? new Date(dateIso) : new Date(currentDate);
  els.addDateInput.value = formatDateISO(d);
  els.addTitleInput.value = "";
  els.addTitleInput.focus();
}
function closeAddDialog() {
  els.addDialog.hidden = true;
}
els.quickAddBtn.addEventListener("click", () => openAddDialog());
els.addCancelBtn.addEventListener("click", () => closeAddDialog());
els.addConfirmBtn.addEventListener("click", () => {
  const iso = els.addDateInput.value;
  const title = els.addTitleInput.value.trim();
  if (!iso || !title) return;
  const date = new Date(iso);
  const wk = ensureWeek(storage, date);
  const list = wk.days[iso] || (wk.days[iso] = []);
  list.push({ id: uid(), title, done: false });
  saveAll(storage);
  closeAddDialog();
  renderMonth();
});

// 点击某一天打开对话框快速添加
document.addEventListener("click", (e) => {
  if (!e.target.closest(".task")) {
    // 关闭任务内联操作（已改为气泡菜单，这里仅负责关闭菜单）
    closeContextMenu();
  }
  const day = e.target.closest(".month-day");
  const ignoreOpen = e.target.closest(".task, .icon-btn, input, button, .dialog, .md-date");
  if (day && day.classList.contains("outside")) return;
  if (day && els.monthGrid.contains(day) && !ignoreOpen) {
    openAddDialog(day.dataset.date);
  }
  if (!e.target.closest("#exportMenu") && e.target !== els.exportBtn) {
    hideExportMenu();
  }
});

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  // 先计算当前进度（不触发礼花）
  const today = new Date();
  const iso = formatDateISO(today);
  const wk = ensureWeek(storage, today);
  const list = wk.days[iso] || [];
  const total = list.length;
  const done = list.filter(t => t.done).length;
  currentDayProgress = total === 0 ? 0 : Math.round((done / total) * 100);

  // 然后正常渲染界面
  renderMonth();
  updateMonthProgress();
});

// ====== 气泡菜单（右键） ======
let currentContext = null; // { type, ... }
function openContextMenu(x, y, context) {
  currentContext = context;
  const m = els.contextMenu;

  // 根据类型动态显示按钮
  const buttons = m.querySelectorAll('button[data-action]');
  buttons.forEach(btn => {
    const action = btn.dataset.action;
    if (context.type === 'thought') {
      // 感想条目只显示编辑和删除
      btn.style.display = (action === 'edit' || action === 'delete') ? '' : 'none';
    } else {
      // 任务和目标显示所有按钮
      btn.style.display = '';
    }
  });

  m.hidden = false;
  positionFloating(m, x, y);
}
function closeContextMenu() {
  els.contextMenu.hidden = true;
  currentContext = null;
}
function positionFloating(el, x, y) {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  el.style.left = Math.min(x + pad, vw - el.offsetWidth - pad) + "px";
  el.style.top = Math.min(y + pad, vh - el.offsetHeight - pad) + "px";
}
els.contextMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || !currentContext) return;
  const action = btn.dataset.action;
  if (currentContext.type === "task") {
    const { taskRef, listRef, listElRef } = currentContext;
    const idx = listRef.findIndex(t => t.id === taskRef.id);
    if (action === "up" && idx > 0) {
      [listRef[idx - 1], listRef[idx]] = [listRef[idx], listRef[idx - 1]];
    } else if (action === "down" && idx < listRef.length - 1) {
      [listRef[idx + 1], listRef[idx]] = [listRef[idx], listRef[idx + 1]];
    } else if (action === "edit") {
      const val = prompt("编辑任务：", taskRef.title);
      if (val !== null) {
        const t = val.trim();
        if (t) taskRef.title = t;
      }
    } else if (action === "delete") {
      if (idx >= 0) listRef.splice(idx, 1);
    }
    saveAll(storage);
    renderTasks(listElRef, listRef);
    updateProgress();
  } else if (currentContext.type === "goal") {
    const { index, listRef, rerender } = currentContext;
    if (action === "up" && index > 0) {
      [listRef[index - 1], listRef[index]] = [listRef[index], listRef[index - 1]];
    } else if (action === "down" && index < listRef.length - 1) {
      [listRef[index + 1], listRef[index]] = [listRef[index], listRef[index + 1]];
    } else if (action === "edit") {
      const val = prompt("编辑感想：", listRef[index].content);
      if (val !== null) {
        const t = val.trim();
        if (t) listRef[index].content = t;
      }
    } else if (action === "delete") {
      listRef.splice(index, 1);
    }
    saveAll(storage);
    rerender();
    updateProgress();
  } else if (currentContext.type === "thought") {
    const { index, date } = currentContext;
    const entries = normalizeThoughtEntries(date);
    if (action === "edit") {
      const val = prompt("编辑感想：", entries[index].content);
      if (val !== null) {
        const t = val.trim();
        if (t) entries[index].content = t;
      }
    } else if (action === "delete") {
      entries.splice(index, 1);
    }
    thoughts[date] = entries;
    saveThoughts(thoughts);
    loadThoughtForDate(selectedThoughtDate);
  }
  closeContextMenu();
});
window.addEventListener("resize", () => closeContextMenu());
window.addEventListener("scroll", () => closeContextMenu(), true);

// ====== 导出菜单 ======
function toggleExportMenu() {
  const menu = els.exportMenu;
  if (!menu.hidden) { menu.hidden = true; return; }
  const rect = els.exportBtn.getBoundingClientRect();
  menu.style.left = rect.left + "px";
  menu.style.top = (rect.bottom + 6) + "px";
  menu.hidden = false;
}
function hideExportMenu() {
  els.exportMenu.hidden = true;
}

// 生成Markdown月度报告
function generateMarkdownReport() {
  const now = new Date();
  const exportTime = now.toISOString().replace('T', ' ').slice(0, 19);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthStr = `${year}年${month}月`;

  // 获取本月目标
  const ws = getWeekStart(new Date());
  const wk = ensureWeek(storage, ws);
  const goals = wk.goals || [];

  // 计算月度进度
  const monthStart = getMonthStart(currentDate);
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();
  const passedDays = Math.min(now.getDate(), totalDays);
  const timeProgress = Math.round((passedDays / totalDays) * 100);

  // 每日任务完成率
  let totalTasks = 0;
  let completedTasks = 0;
  Object.values(storage).forEach(week => {
    Object.values(week.days).forEach(dayTasks => {
      dayTasks.forEach(task => {
        totalTasks++;
        if (task.done) completedTasks++;
      });
    });
  });
  const taskCompletionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // 月目标完成率
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.done).length;
  const goalCompletionRate = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

  // 记录感想天数
  const thoughtDays = Object.keys(thoughts).filter(iso => normalizeThoughtEntries(iso).length > 0).length;

  // 生成进度条
  const progressBar = (percent) => '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));

  // 月度概览
  let md = `# 个人计划月度报告 - ${monthStr}\n\n`;
  md += `**导出时间**：${exportTime}\n\n---\n\n`;
  md += `## 一、月度概览\n\n`;
  md += `### 本月目标\n`;
  goals.forEach(goal => {
    md += `- [${goal.done ? 'x' : ' '}] ${goal.title}\n`;
  });
  md += `\n### 月度进度\n`;
  md += `- 时间进度：${timeProgress}% ${progressBar(timeProgress)}\n`;
  md += `- 每日任务总的完成率：${taskCompletionRate}% ${progressBar(taskCompletionRate)}\n`;
  md += `- 月目标完成率：${goalCompletionRate}% ${progressBar(goalCompletionRate)}\n\n`;
  md += `### 整体统计\n`;
  md += `- 总任务数：${totalTasks} 个\n`;
  md += `- 已完成任务：${completedTasks} 个（${taskCompletionRate}%）\n`;
  md += `- 总目标数：${totalGoals} 个\n`;
  md += `- 已完成目标：${completedGoals} 个（${goalCompletionRate}%）\n`;
  md += `- 记录感想天数：${thoughtDays} 天\n\n---\n\n`;

  // 周度详情
  md += `## 二、周度详情\n\n`;
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    daysInMonth.push(new Date(d));
  }
  const weeks = [];
  for (let i = 0; i < daysInMonth.length; i += 7) {
    weeks.push(daysInMonth.slice(i, i + 7));
  }

  weeks.forEach((week, index) => {
    const weekStart = week[0];
    const weekEnd = week[week.length - 1];
    const weekStartStr = formatDateISO(weekStart).slice(5);
    const weekEndStr = formatDateISO(weekEnd).slice(5);
    const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    md += `### 第${index + 1}周：${weekStartStr} - ${weekEndStr}\n\n`;
    md += `#### 每日任务清单\n`;
    md += `| 日期 | 星期 | 任务 | 状态 |\n`;
    md += `|------|------|------|------|\n`;
    week.forEach(day => {
      const iso = formatDateISO(day);
      const weekDay = weekDayNames[day.getDay()];
      const dateStr = iso.slice(5);
      const wkKey = weekKey(day);
      const dayTasks = storage[wkKey]?.days[iso] || [];
      if (dayTasks.length === 0) {
        md += `| ${dateStr} | ${weekDay} | 无任务 | - |\n`;
      } else {
        dayTasks.forEach(task => {
          md += `| ${dateStr} | ${weekDay} | ${task.title} | ${task.done ? '✓' : '✗'} |\n`;
        });
      }
    });
    md += `\n#### 每日感想\n`;
    week.forEach(day => {
      const iso = formatDateISO(day);
      const dayThoughts = normalizeThoughtEntries(iso);
      if (dayThoughts.length > 0) {
        dayThoughts.forEach(thought => {
          const timeStr = new Date(thought.timestamp).toLocaleString();
          md += `> **${iso.slice(5)} ${weekDayNames[day.getDay()]} ${timeStr.slice(11, 16)}**  \n`;
          md += `> ${thought.content.replace(/\n/g, '\n> ')}\n\n`;
        });
      }
    });
    md += `---\n\n`;
  });

  md += `*报告生成时间：${exportTime}*\n`;

  return md;
}

els.exportMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-format]");
  if (!btn) return;
  const fmt = btn.dataset.format;
  hideExportMenu();
  const stamp = Date.now();
  if (fmt === "json") {
    // 修改：导出完整备份（任务 + 感想）
    const fullData = exportAllData();
    const dataStr = JSON.stringify(fullData, null, 2);
    downloadBlob(dataStr, "application/json;charset=utf-8", `planner-full-${stamp}.json`);
  } else if (fmt === "markdown") {
    const md = generateMarkdownReport();
    downloadBlob(md, "text/markdown;charset=utf-8", `monthly-report-${stamp}.md`);
  } else if (fmt === "word") {
    const rows = flattenTasksForExport();
    const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>个人计划导出</title></head>
<body>
<h1>个人计划导出</h1>
<p>导出时间：${new Date().toLocaleString()}</p>
<table border="1" cellspacing="0" cellpadding="6">
<thead><tr><th>日期</th><th>事项</th><th>状态</th> </thead>
<tbody>
${rows.map((r) => `<tr><td>${r.date}</td><td>${r.title}</td><td>${r.done ? "已完成" : "未完成"}</td></tr>`).join("")}
</tbody>
</table>
</body></html>`;
    downloadBlob(html, "application/msword;charset=utf-8", `planner-${stamp}.doc`);
  } else if (fmt === "pdf") {
    alert("将打开打印窗口，请在目标打印机中选择“另存为 PDF”。");
    window.print();
  }
});