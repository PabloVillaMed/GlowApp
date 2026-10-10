/* GlowSelect — the app's own dropdowns (2.18).

   On Android the WebView opens a <select> as the system's plain list dialog:
   the one thing in GlowApp that did not look like GlowApp. Each <select>
   stays in the page — it keeps the value, the label, the change events and
   every line of app.js that reads or sets it — but it is hidden, and a
   button drawn like the app's fields shows the choice. Tapping the button
   opens a list in the app's colours, anchored to it (below, or above when
   there is more room there), above any sheet, and gone again on a choice,
   a tap outside, Escape or Android's back.

   Keyboard: Enter, Space or the arrows open it; the arrows, Home and End
   move; Enter or Space choose; Escape closes without a change; Tab closes
   and moves on; typing jumps to the option that starts that way. A screen
   reader hears a button that opens a listbox, named by the select's label.

   Setting select.value or selectedIndex from code updates the button; so do
   options added, removed or relabelled (a language change). */
(function (global) {
  'use strict';

  const doc = global.document;
  const reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const states = new WeakMap();
  let uid = 0;
  let current = null;                  // the list that is open, if any

  const CHEVRON = '<svg class="gs-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';
  const CHECK = '<svg class="gs-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const textOf = (option) => (option.label || option.textContent || '').trim();
  const nextId = (stem) => stem + '-' + (++uid);

  /* ── Turning a select into a GlowSelect ── */
  function enhance(select) {
    if (!select || states.has(select) || select.multiple || select.size > 1) return;
    if (!select.id) select.id = nextId('gs');
    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'gs-trigger';
    trigger.id = select.id + '-gs';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const value = doc.createElement('span');
    value.className = 'gs-value';
    value.id = trigger.id + '-value';
    trigger.appendChild(value);
    trigger.insertAdjacentHTML('beforeend', CHEVRON);

    select.classList.add('gs-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.insertAdjacentElement('afterend', trigger);

    const state = { select, trigger, value, popup: null, active: -1, typed: '', typedAt: 0, closing: 0 };
    states.set(select, state);
    nameTrigger(state);

    // The page's own code keeps talking to the select: when it sets a value,
    // the button follows; focusing it focuses the button.
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return VALUE.get.call(this); },
      set(v) { VALUE.set.call(this, v); sync(state); },
    });
    Object.defineProperty(select, 'selectedIndex', {
      configurable: true,
      get() { return INDEX.get.call(this); },
      set(v) { INDEX.set.call(this, v); sync(state); },
    });
    select.focus = (opts) => trigger.focus(opts);
    new MutationObserver(() => sync(state)).observe(select, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'label', 'selected', 'hidden'],
    });

    trigger.addEventListener('click', () => {
      if (Date.now() - state.closing < 250) return;       // the tap that just closed it
      if (current === state) close(true);
      else open(state);
    });
    trigger.addEventListener('keydown', (evt) => {
      if (['ArrowDown', 'ArrowUp'].includes(evt.key) || (evt.altKey && evt.key === 'ArrowDown')) {
        evt.preventDefault();
        open(state);
      }
    });
    // A label's tap went to the select; now it focuses the button instead.
    (select.labels ? Array.from(select.labels) : []).forEach((label) => {
      label.addEventListener('click', (evt) => {
        if (evt.target.closest && evt.target.closest('.gs-trigger')) return;
        evt.preventDefault();
        trigger.focus();
      });
    });
    sync(state);
  }

  // The button is named by the select's label (or the label's visible text,
  // when the label wraps the field) and then by its current value.
  function nameTrigger(state) {
    const label = state.select.labels && state.select.labels[0];
    if (!label) return;
    let named = label;
    if (label.contains(state.select)) {
      named = label.querySelector('.field-label, .sr-only, span') || label;
    }
    if (!named.id) named.id = nextId('gs-label');
    state.labelId = named.id;
    state.trigger.setAttribute('aria-labelledby', named.id + ' ' + state.value.id);
  }

  function sync(state) {
    const select = state.select;
    const option = select.options[INDEX.get.call(select)];
    const text = option ? textOf(option) : '';
    if (state.value.textContent !== text) state.value.textContent = text;
    state.trigger.disabled = select.disabled;
    state.trigger.hidden = select.hidden;
    if (current === state) render(state);
  }

  /* ── The list ── */
  function render(state) {
    const popup = state.popup;
    popup.textContent = '';
    const selected = INDEX.get.call(state.select);
    let index = 0;
    const add = (option, parent) => {
      const row = doc.createElement('div');
      row.className = 'gs-option';
      row.id = state.trigger.id + '-opt-' + index;
      row.setAttribute('role', 'option');
      row.dataset.index = String(index);
      row.setAttribute('aria-selected', String(index === selected));
      if (option.disabled) row.setAttribute('aria-disabled', 'true');
      row.insertAdjacentHTML('afterbegin', CHECK);
      const text = doc.createElement('span');
      text.className = 'gs-text';
      text.textContent = textOf(option);
      row.appendChild(text);
      parent.appendChild(row);
      index++;
    };
    Array.from(state.select.children).forEach((child) => {
      if (child.tagName === 'OPTGROUP') {
        const group = doc.createElement('div');
        group.setAttribute('role', 'group');
        const head = doc.createElement('div');
        head.className = 'gs-group';
        head.id = nextId('gs-group');
        head.textContent = child.label;
        group.setAttribute('aria-labelledby', head.id);
        group.appendChild(head);
        Array.from(child.children).forEach((option) => add(option, group));
        popup.appendChild(group);
      } else if (child.tagName === 'OPTION') {
        add(child, popup);
      }
    });
    setActive(state, state.active >= 0 && state.active < index ? state.active : selected, false);
  }

  const rows = (state) => Array.from(state.popup.querySelectorAll('.gs-option'));

  function setActive(state, index, scroll) {
    const list = rows(state);
    if (!list.length) return;
    index = Math.max(0, Math.min(list.length - 1, index));
    list.forEach((row, i) => { if (i === index) row.setAttribute('data-active', ''); else row.removeAttribute('data-active'); });
    state.active = index;
    state.popup.setAttribute('aria-activedescendant', list[index].id);
    if (scroll !== false) list[index].scrollIntoView({ block: 'nearest' });
  }

  // The next option that can be chosen, from index, in direction step.
  function step(state, from, delta) {
    const list = rows(state);
    for (let i = from + delta; i >= 0 && i < list.length; i += delta) {
      if (list[i].getAttribute('aria-disabled') !== 'true') return i;
    }
    return from;
  }

  function place(state) {
    const popup = state.popup;
    const r = state.trigger.getBoundingClientRect();
    const view = global.visualViewport;
    const vw = global.innerWidth;
    const vh = view ? view.height : global.innerHeight;
    const margin = 8;
    // As wide as its longest option (at least the button, at most the
    // screen), growing leftwards from a button that sits on the right.
    // Each option measured on one line; a little slack for an emoji whose
    // font is still arriving.
    popup.style.width = 'max-content';
    popup.classList.add('gs-measure');
    const wide = Math.ceil(popup.getBoundingClientRect().width) + 10;
    popup.classList.remove('gs-measure');
    const width = Math.min(vw - margin * 2, Math.max(r.width, 180, wide));
    popup.style.width = width + 'px';
    const left = r.left + width > vw - margin ? r.right - width : r.left;
    popup.style.left = Math.round(Math.max(margin, Math.min(left, vw - margin - width))) + 'px';
    popup.style.maxHeight = 'none';
    const natural = popup.scrollHeight + 2;
    const below = vh - r.bottom - margin - 6;
    const above = r.top - margin - 6;
    const up = natural > below && above > below;
    const height = Math.min(natural, Math.max(120, up ? above : below), 360);
    popup.style.maxHeight = height + 'px';
    popup.style.top = Math.round(up ? r.top - 6 - height : r.bottom + 6) + 'px';
    popup.dataset.side = up ? 'up' : 'down';
  }

  function open(state) {
    if (current && current !== state) close(false);
    if (current === state || state.select.disabled) return;
    const popup = doc.createElement('div');
    popup.className = 'gs-popup';
    popup.id = state.trigger.id + '-list';
    popup.setAttribute('role', 'listbox');
    popup.tabIndex = -1;
    if (state.labelId) popup.setAttribute('aria-labelledby', state.labelId);
    state.popup = popup;
    state.active = -1;
    current = state;
    render(state);
    // Inside the select's sheet when it has one: a modal sheet makes the
    // rest of the page inert, and a list outside it could be seen but not
    // touched. In the top layer when the browser has one (above the sheet);
    // otherwise at the top of the stack.
    (state.select.closest('dialog') || doc.body).appendChild(popup);
    if (canPopover) {
      popup.setAttribute('popover', 'manual');
      popup.showPopover();
    }
    place(state);
    setActive(state, state.active);
    state.trigger.setAttribute('aria-expanded', 'true');
    state.trigger.setAttribute('aria-controls', popup.id);
    popup.addEventListener('keydown', (evt) => onKey(state, evt));
    popup.addEventListener('click', (evt) => {
      const row = evt.target.closest('.gs-option');
      if (row && row.getAttribute('aria-disabled') !== 'true') choose(state, Number(row.dataset.index));
    });
    popup.addEventListener('pointermove', (evt) => {
      const row = evt.target.closest('.gs-option');
      if (row && evt.pointerType === 'mouse') setActive(state, Number(row.dataset.index), false);
    });
    popup.focus({ preventScroll: true });
    if (reduce.matches) popup.classList.add('is-open');
    else global.requestAnimationFrame(() => global.requestAnimationFrame(() => { if (current === state) popup.classList.add('is-open'); }));
    doc.addEventListener('pointerdown', onOutside, true);
    global.addEventListener('resize', onResize);
    global.addEventListener('scroll', onScroll, true);
  }

  function close(refocus) {
    const state = current;
    if (!state) return false;
    current = null;
    state.closing = Date.now();
    const popup = state.popup;
    state.popup = null;
    state.trigger.setAttribute('aria-expanded', 'false');
    state.trigger.removeAttribute('aria-controls');
    doc.removeEventListener('pointerdown', onOutside, true);
    global.removeEventListener('resize', onResize);
    global.removeEventListener('scroll', onScroll, true);
    const gone = () => {
      if (canPopover && popup.matches(':popover-open')) popup.hidePopover();
      popup.remove();
    };
    if (reduce.matches) gone();
    else {
      popup.classList.remove('is-open');
      popup.classList.add('is-closing');
      global.setTimeout(gone, 130);
    }
    if (refocus) state.trigger.focus({ preventScroll: true });
    return true;
  }

  function choose(state, index) {
    const select = state.select;
    const before = INDEX.get.call(select);
    close(true);
    if (index === before) return;
    INDEX.set.call(select, index);
    sync(state);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onKey(state, evt) {
    const list = rows(state);
    switch (evt.key) {
      case 'ArrowDown': evt.preventDefault(); setActive(state, step(state, state.active, 1)); return;
      case 'ArrowUp': evt.preventDefault(); setActive(state, step(state, state.active, -1)); return;
      case 'Home': evt.preventDefault(); setActive(state, step(state, -1, 1)); return;
      case 'End': evt.preventDefault(); setActive(state, step(state, list.length, -1)); return;
      case 'PageDown': evt.preventDefault(); setActive(state, Math.min(list.length - 1, state.active + 5)); return;
      case 'PageUp': evt.preventDefault(); setActive(state, Math.max(0, state.active - 5)); return;
      case 'Enter': case ' ':
        evt.preventDefault();
        if (list[state.active] && list[state.active].getAttribute('aria-disabled') !== 'true') choose(state, state.active);
        return;
      case 'Escape': evt.preventDefault(); evt.stopPropagation(); close(true); return;
      case 'Tab': close(true); return;           // focus is back on the button; Tab moves on from there
      default:
        if (evt.key.length === 1 && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
          const now = Date.now();
          state.typed = (now - state.typedAt < 700 ? state.typed : '') + fold(evt.key);
          state.typedAt = now;
          const texts = list.map((row) => fold(row.textContent));
          const start = state.typed.length === 1 ? state.active + 1 : state.active;
          for (let k = 0; k < texts.length; k++) {
            const i = (start + k) % texts.length;
            if (texts[i].startsWith(state.typed) && list[i].getAttribute('aria-disabled') !== 'true') { setActive(state, i); break; }
          }
        }
    }
  }

  function onOutside(evt) {
    if (!current) return;
    if (current.popup.contains(evt.target) || current.trigger.contains(evt.target)) return;
    close(false);
  }
  function onResize() { if (current) place(current); }
  function onScroll(evt) {
    if (current && !current.popup.contains(evt.target)) close(false);
  }

  // A sheet behind an open list must not take the Escape meant for the list.
  doc.addEventListener('cancel', (evt) => {
    if (current) { evt.preventDefault(); close(true); }
  }, true);

  global.GlowSelect = {
    enhance: enhance,
    enhanceAll: (root) => Array.from((root || doc).querySelectorAll('select')).forEach(enhance),
    close: () => close(true),
    isOpen: () => !!current,
    sync: (select) => { const s = states.get(select); if (s) sync(s); },
  };
})(window);
