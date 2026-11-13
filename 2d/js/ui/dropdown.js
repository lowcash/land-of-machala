/*
 * Shared custom dropdown: one button + body-level listbox for every <select>.
 * UMD: window.Dropdown in the browser; require() in node tests.
 *
 *   Dropdown.enhance(select, opts) → { destroy, refresh, open, close }
 *   Dropdown.auto(root) → observe + enhance every select (data-dd="off" opt-out)
 *   Pure helpers (no DOM): foldText, optionModel, filterModel, moveIndex, wantsSearch
 *
 * Native <select> stays the source of truth (value, change, options, disabled).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Dropdown = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var win = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});
  var SEARCH_THRESHOLD = 8;
  var EMPTY_TEXT = "Nic nenalezeno";
  var SEARCH_PLACEHOLDER = "Hledat…";
  var SEARCH_LABEL = "Hledat";
  var UID = 0;

  function foldText(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  /**
   * Flatten <select> children into { groups: [{ label, options: [{ value, label, disabled, index }] }], flat, count }.
   * index is the option's index in select.options.
   */
  function optionModel(select) {
    var groups = [];
    var flat = [];
    var cur = { label: "", options: [] };
    var kids = select ? select.children : [];
    var i, el, j, opt, item;
    function pushGroup() {
      if (cur.options.length) groups.push(cur);
      cur = { label: "", options: [] };
    }
    for (i = 0; i < kids.length; i++) {
      el = kids[i];
      if (el.tagName === "OPTGROUP") {
        pushGroup();
        cur = { label: el.label || "", options: [] };
        for (j = 0; j < el.children.length; j++) {
          opt = el.children[j];
          if (opt.tagName !== "OPTION") continue;
          item = {
            value: opt.value,
            label: opt.textContent || opt.label || opt.value,
            disabled: !!opt.disabled,
            index: opt.index,
            group: cur.label,
          };
          cur.options.push(item);
          flat.push(item);
        }
        pushGroup();
      } else if (el.tagName === "OPTION") {
        if (groups.length && cur.options.length === 0 && groups[groups.length - 1]) {
          /* continue orphan options into a new unlabeled group after a closed optgroup */
        }
        item = {
          value: el.value,
          label: el.textContent || el.label || el.value,
          disabled: !!el.disabled,
          index: el.index,
          group: "",
        };
        cur.options.push(item);
        flat.push(item);
      }
    }
    pushGroup();
    return { groups: groups, flat: flat, count: flat.length };
  }

  /** Filter model by query (diacritics-insensitive). Disabled options are omitted from the interactive list. */
  function filterModel(model, query) {
    var q = foldText(query);
    var groups = [];
    var flat = [];
    model.groups.forEach(function (g) {
      var opts = g.options.filter(function (o) {
        if (o.disabled) return false;
        return !q || foldText(o.label).indexOf(q) >= 0;
      });
      if (opts.length) {
        groups.push({ label: g.label, options: opts });
        opts.forEach(function (o) { flat.push(o); });
      }
    });
    return {
      groups: groups,
      flat: flat,
      empty: !!q && flat.length === 0,
      query: !!q,
    };
  }

  /** Keyboard active index: delta ±1, "home", "end"; skips nothing (flat is already enabled-only when filtered). */
  function moveIndex(active, flatLen, key) {
    if (!flatLen) return -1;
    if (key === "home") return 0;
    if (key === "end") return flatLen - 1;
    if (active < 0) return key === "up" ? flatLen - 1 : 0;
    if (key === "down") return Math.min(flatLen - 1, active + 1);
    if (key === "up") return Math.max(0, active - 1);
    return active;
  }

  function wantsSearch(select, opts) {
    opts = opts || {};
    if (opts.search === true) return true;
    if (opts.search === false) return false;
    var attr = select && select.getAttribute && select.getAttribute("data-dd-search");
    if (attr === "on") return true;
    if (attr === "off") return false;
    var n = opts.count != null ? opts.count : (select && select.options ? select.options.length : 0);
    var thr = opts.threshold != null ? opts.threshold : SEARCH_THRESHOLD;
    return n >= thr;
  }

  function typeAheadIndex(flat, active, ch, startFrom) {
    var needle = foldText(ch);
    if (!needle || !flat.length) return active;
    var i, n = flat.length, from = startFrom == null ? active + 1 : startFrom;
    for (i = 0; i < n; i++) {
      var idx = (from + i) % n;
      if (foldText(flat[idx].label).charAt(0) === needle.charAt(0)) return idx;
    }
    return active;
  }

  /* ––––– DOM enhance (browser only) ––––– */

  function hideSelect(select) {
    select.classList.add("dd-src");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("aria-hidden", "true");
  }

  function selectedLabel(select) {
    var opt = select.options[select.selectedIndex];
    if (!opt) return "";
    return opt.textContent || opt.label || opt.value || "";
  }

  function enhance(select, opts) {
    if (!select || select.tagName !== "SELECT") return null;
    opts = opts || {};
    if (select._dd) return select._dd;
    if (typeof document === "undefined") return null;

    var uid = "dd-" + (++UID);
    var button = opts.button || null;
    var ownButton = !button;
    var wrap = null;
    var pop = document.createElement("div");
    var search = document.createElement("input");
    var listEl = document.createElement("div");
    var isOpen = false;
    var active = -1;
    var flat = [];
    var optionEls = [];
    var model = optionModel(select);
    var useSearch = wantsSearch(select, {
      search: opts.search,
      count: model.count,
      threshold: opts.threshold,
    });
    var emptyText = opts.emptyText || EMPTY_TEXT;
    var destroyed = false;

    hideSelect(select);

    if (ownButton) {
      wrap = document.createElement("span");
      /* Copy select classes onto the wrap, but never dd-src (sr-only) or sel (chrome on the button). */
      var copied = (select.className || "")
        .replace(/\bdd-src\b/g, "")
        .replace(/\bsel\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
      wrap.className = "dd" + (copied ? " " + copied : "");
      wrap.classList.add("dd-wrap");
      button = document.createElement("button");
      button.type = "button";
      button.className = "dd-btn sel";
      if (select.id) button.id = select.id + "-dd";
      var lab = select.getAttribute("aria-label");
      if (lab) button.setAttribute("aria-label", lab);
      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select);
      wrap.appendChild(button);
    } else {
      button.classList.add("dd-btn");
    }

    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", uid + "-list");

    pop.className = "dd-pop" + (opts.popClass ? " " + opts.popClass : "");
    pop.hidden = true;
    pop.id = uid + "-pop";

    search.type = "search";
    search.className = "dd-search";
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-expanded", "true");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", uid + "-list");
    search.setAttribute("aria-label", opts.searchLabel || SEARCH_LABEL);
    search.placeholder = opts.searchPlaceholder || SEARCH_PLACEHOLDER;
    search.autocomplete = "off";
    search.spellcheck = false;

    listEl.className = "dd-list";
    listEl.id = uid + "-list";
    listEl.setAttribute("role", "listbox");
    var listLab = select.getAttribute("aria-label") || button.getAttribute("aria-label") || "Volby";
    listEl.setAttribute("aria-label", listLab);

    if (useSearch) pop.appendChild(search);
    pop.appendChild(listEl);
    document.body.appendChild(pop);

    function syncDisabled() {
      var off = !!select.disabled;
      button.disabled = off;
      if (off && isOpen) close(false);
    }

    function syncLabel() {
      var text = selectedLabel(select);
      button.textContent = text;
      var base = select.getAttribute("aria-label");
      if (base) button.setAttribute("aria-label", base + (text ? ": " + text : ""));
    }

    function remPx() {
      try {
        return parseFloat(win.getComputedStyle(document.documentElement).fontSize) || 16;
      } catch (_) {
        return 16;
      }
    }

    /** Widest option row (unconstrained), including pop + row padding. */
    function measureOptionContentWidth() {
      var names = pop.querySelectorAll(".dd-name");
      var saved = [];
      var i;
      for (i = 0; i < names.length; i++) {
        saved.push({
          overflow: names[i].style.overflow,
          maxWidth: names[i].style.maxWidth,
          width: names[i].style.width,
        });
        names[i].style.overflow = "visible";
        names[i].style.maxWidth = "none";
        names[i].style.width = "auto";
      }
      var prevWidth = pop.style.width;
      var prevMax = pop.style.maxWidth;
      var prevMin = pop.style.minWidth;
      pop.style.width = "max-content";
      pop.style.maxWidth = "none";
      pop.style.minWidth = "0";
      var contentW = Math.ceil(Math.max(pop.scrollWidth, pop.getBoundingClientRect().width));
      pop.style.width = prevWidth;
      pop.style.maxWidth = prevMax;
      pop.style.minWidth = prevMin;
      for (i = 0; i < names.length; i++) {
        names[i].style.overflow = saved[i].overflow;
        names[i].style.maxWidth = saved[i].maxWidth;
        names[i].style.width = saved[i].width;
      }
      return contentW;
    }

    function syncOptionTitles() {
      var names = pop.querySelectorAll(".dd-name");
      for (var i = 0; i < names.length; i++) {
        var el = names[i];
        var full = el.textContent || "";
        if (el.scrollWidth > el.clientWidth + 1) el.title = full;
        else el.removeAttribute("title");
      }
    }

    function place() {
      if (opts.mobileSheet && win.matchMedia && win.matchMedia("(max-width: 600px)").matches) {
        pop.style.left = "";
        pop.style.top = "";
        pop.style.width = "";
        pop.style.maxHeight = "";
        return;
      }
      var r = button.getBoundingClientRect();
      var vw = win.innerWidth || document.documentElement.clientWidth;
      var vh = win.innerHeight || document.documentElement.clientHeight;
      /* Floor: 10rem and 160px (smoke / readable options at small root font-size). */
      var minFloor = Math.max(10 * remPx(), 160, opts.minWidth || 0);
      var contentW = measureOptionContentWidth();
      var w = Math.max(r.width, contentW, minFloor);
      w = Math.min(w, Math.max(minFloor, vw - 16));
      pop.style.width = w + "px";
      var left = Math.max(8, Math.min(r.left, vw - w - 8));
      pop.style.left = left + "px";
      var below = r.bottom + 6;
      var spaceBelow = vh - below - 12;
      var spaceAbove = r.top - 12;
      var maxH = Math.min(320, Math.max(160, Math.max(spaceBelow, spaceAbove)));
      pop.style.maxHeight = maxH + "px";
      if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        pop.style.top = Math.max(8, r.top - 6 - maxH) + "px";
      } else {
        pop.style.top = below + "px";
        pop.style.maxHeight = Math.max(120, spaceBelow) + "px";
      }
      syncOptionTitles();
    }

    function setActive(i, scroll) {
      if (!flat.length) {
        active = -1;
        search.removeAttribute("aria-activedescendant");
        return;
      }
      active = Math.max(0, Math.min(flat.length - 1, i));
      optionEls.forEach(function (o, k) {
        o.classList.toggle("active", k === active);
      });
      var id = optionEls[active].id;
      if (useSearch) search.setAttribute("aria-activedescendant", id);
      else button.setAttribute("aria-activedescendant", id);
      if (scroll && optionEls[active].scrollIntoView) {
        optionEls[active].scrollIntoView({ block: "nearest" });
      }
    }

    function optionEl(it) {
      var idx = flat.length;
      var o = document.createElement("div");
      o.id = uid + "-opt-" + idx;
      o.className = "dd-opt";
      o.setAttribute("role", "option");
      o.setAttribute("aria-selected", it.value === select.value ? "true" : "false");
      if (it.disabled) {
        o.classList.add("disabled");
        o.setAttribute("aria-disabled", "true");
      }
      var name = document.createElement("span");
      name.className = "dd-name";
      name.textContent = it.label;
      o.appendChild(name);
      if (it.hint || (opts.showGroupHint && it.group)) {
        var hint = document.createElement("span");
        hint.className = "dd-hint";
        hint.textContent = it.hint || it.group;
        o.appendChild(hint);
      }
      o.addEventListener("click", function (e) {
        e.preventDefault();
        if (!it.disabled) choose(it.value);
      });
      o.addEventListener("pointermove", function () {
        if (!it.disabled && active !== idx) setActive(idx, false);
      });
      flat.push(it);
      optionEls.push(o);
      return o;
    }

    function rows() {
      model = optionModel(select);
      useSearch = wantsSearch(select, {
        search: opts.search,
        count: model.count,
        threshold: opts.threshold,
      });
      if (useSearch && search.parentNode !== pop) pop.insertBefore(search, listEl);
      if (!useSearch && search.parentNode === pop) pop.removeChild(search);

      var filtered = filterModel(model, useSearch ? search.value : "");
      if (opts.sections && typeof opts.sections === "function") {
        filtered = opts.sections(model, useSearch ? search.value : "", filterModel, foldText);
      }

      listEl.textContent = "";
      flat = [];
      optionEls = [];
      filtered.groups.forEach(function (sec) {
        var group = document.createElement("div");
        group.className = "dd-group";
        group.setAttribute("role", "group");
        if (sec.label) {
          group.setAttribute("aria-label", sec.label);
          var h = document.createElement("div");
          h.className = "dd-sec";
          h.setAttribute("aria-hidden", "true");
          h.textContent = sec.label;
          group.appendChild(h);
        }
        sec.options.forEach(function (it) {
          var row = it;
          if (filtered.query && it.group && opts.showGroupHint !== false) {
            row = {
              value: it.value,
              label: it.label,
              disabled: it.disabled,
              index: it.index,
              group: it.group,
              hint: it.hint || it.group,
            };
          }
          group.appendChild(optionEl(row));
        });
        listEl.appendChild(group);
      });
      if (filtered.empty) {
        var none = document.createElement("div");
        none.className = "dd-empty";
        none.textContent = emptyText;
        listEl.appendChild(none);
      }
    }

    function close(refocus) {
      if (!isOpen) return;
      isOpen = false;
      pop.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-activedescendant");
      if (refocus) button.focus();
    }

    function openPop() {
      if (isOpen || select.disabled) return;
      isOpen = true;
      search.value = "";
      pop.hidden = false;
      button.setAttribute("aria-expanded", "true");
      rows();
      place();
      var at = -1;
      for (var i = 0; i < flat.length; i++) {
        if (flat[i].value === select.value) { at = i; break; }
      }
      setActive(at < 0 ? 0 : at, true);
      if (useSearch) search.focus();
      else button.focus();
    }

    function choose(value) {
      close(true);
      if (String(value) === String(select.value)) return;
      select.value = value;
      syncLabel();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function onButtonKey(e) {
      if (select.disabled) return;
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!isOpen) openPop();
        else if (e.key === "ArrowDown") setActive(moveIndex(active, flat.length, "down"), true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) openPop();
        else setActive(moveIndex(active, flat.length, "up"), true);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close(true);
      } else if (e.key === "Home" && isOpen) {
        e.preventDefault();
        setActive(moveIndex(active, flat.length, "home"), true);
      } else if (e.key === "End" && isOpen) {
        e.preventDefault();
        setActive(moveIndex(active, flat.length, "end"), true);
      } else if (!useSearch && isOpen && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActive(typeAheadIndex(flat, active, e.key), true);
      }
    }

    function onSearchKey(e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive(moveIndex(active, flat.length, e.key === "ArrowDown" ? "down" : "up"), true);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActive(moveIndex(active, flat.length, "home"), true);
      } else if (e.key === "End") {
        e.preventDefault();
        setActive(moveIndex(active, flat.length, "end"), true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (active >= 0 && flat[active]) choose(flat[active].value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "Tab") {
        close(false);
      }
    }

    function onDocPointer(e) {
      if (!isOpen) return;
      if (pop.contains(e.target) || button.contains(e.target)) return;
      close(false);
    }

    function onResize() {
      if (isOpen) place();
    }

    function onScroll() {
      if (isOpen) place();
    }

    button.addEventListener("click", function () {
      if (isOpen) close(true);
      else openPop();
    });
    button.addEventListener("keydown", onButtonKey);
    search.addEventListener("input", function () {
      rows();
      setActive(0, false);
    });
    search.addEventListener("keydown", onSearchKey);
    document.addEventListener("pointerdown", onDocPointer, true);
    win.addEventListener("resize", onResize);
    win.addEventListener("scroll", onScroll, true);

    var mo = new MutationObserver(function () {
      syncDisabled();
      syncLabel();
      if (isOpen) rows();
    });
    mo.observe(select, {
      attributes: true,
      attributeFilter: ["disabled"],
      childList: true,
      subtree: true,
      characterData: true,
    });

    select.addEventListener("change", syncLabel);

    syncLabel();
    syncDisabled();

    var api = {
      refresh: function () {
        syncLabel();
        syncDisabled();
        if (isOpen) { rows(); place(); }
      },
      open: openPop,
      close: function () { close(true); },
      update: function (label) {
        if (label != null) button.textContent = label;
        else syncLabel();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        close(false);
        mo.disconnect();
        document.removeEventListener("pointerdown", onDocPointer, true);
        win.removeEventListener("resize", onResize);
        win.removeEventListener("scroll", onScroll, true);
        if (pop.parentNode) pop.parentNode.removeChild(pop);
        if (ownButton && wrap && wrap.parentNode) {
          wrap.parentNode.insertBefore(select, wrap);
          wrap.parentNode.removeChild(wrap);
        }
        select.classList.remove("dd-src");
        select.removeAttribute("tabindex");
        select.removeAttribute("aria-hidden");
        delete select._dd;
      },
    };
    select._dd = api;
    return api;
  }

  function shouldSkip(select) {
    if (!select || select.tagName !== "SELECT") return true;
    if (select.getAttribute("data-dd") === "off") return true;
    if (select._dd) return true;
    return false;
  }

  function auto(rootEl) {
    if (typeof document === "undefined") return { destroy: function () {} };
    var scope = rootEl || document;
    function scan(node) {
      if (!node) return;
      if (node.tagName === "SELECT") {
        if (!shouldSkip(node)) enhance(node);
        return;
      }
      if (node.querySelectorAll) {
        var list = node.querySelectorAll("select");
        for (var i = 0; i < list.length; i++) {
          if (!shouldSkip(list[i])) enhance(list[i]);
        }
      }
    }
    scan(scope);
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === "childList") {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) scan(n);
          });
        }
      });
    });
    mo.observe(scope === document ? document.documentElement : scope, {
      childList: true,
      subtree: true,
    });
    return {
      destroy: function () { mo.disconnect(); },
    };
  }

  return {
    SEARCH_THRESHOLD: SEARCH_THRESHOLD,
    foldText: foldText,
    optionModel: optionModel,
    filterModel: filterModel,
    moveIndex: moveIndex,
    wantsSearch: wantsSearch,
    typeAheadIndex: typeAheadIndex,
    enhance: enhance,
    auto: auto,
  };
});
