
(function () {
  'use strict';
  if (!window.HTMLDialogElement) return;
  // Stable block anchors let both languages return to the same reading position.
  const readingBlocks = Array.from(document.querySelectorAll('.page__content h1, .page__content h2, .page__content li, .research-figure, .research-paper-index'));
  readingBlocks.forEach((el, i) => { if (!el.id) el.id = 'reading-block-' + i; });
  const languageLinks = document.querySelectorAll('.language-switch a');
  const positionKey = 'homepage-language-position';
  function readingPosition() {
    if (window.scrollY < 80) return { id: '', offset: 0 };
    let current = readingBlocks[0];
    for (const el of readingBlocks) {
      if (el.getBoundingClientRect().top <= 60) current = el;
      else break;
    }
    return current ? { id: current.id, offset: Math.round(current.getBoundingClientRect().top) } : { id: '', offset: 0 };
  }
  let lastPosition = { id: '', offset: 0 };
  function updateLanguageLinks() {
    const position = readingPosition();
    lastPosition = position;
    languageLinks.forEach(link => {
      const url = new URL(link.href);
      url.hash = position.id;
      link.href = url.href;
    });
  }
  let pendingScroll = false;
  window.addEventListener('scroll', () => {
    if (pendingScroll) return;
    pendingScroll = true;
    requestAnimationFrame(() => { updateLanguageLinks(); pendingScroll = false; });
  }, { passive: true });
  languageLinks.forEach(link => {
    let selectedPosition;
    link.addEventListener('pointerdown', () => { selectedPosition = lastPosition; }, true);
    link.addEventListener('click', e => {
      const position = selectedPosition || lastPosition;
      selectedPosition = null;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const target = new URL(link.href);
      target.hash = position.id;
      if (target.pathname === location.pathname) return;
      try { sessionStorage.setItem(positionKey, JSON.stringify({ path: target.pathname, ...position, time: Date.now() })); } catch (_) {}
      // Restore after layout settles instead of competing with native hash scrolling.
      target.hash = "";
      location.assign(target.href);
    }, true);
  });
  async function restoreLanguagePosition() {
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(positionKey) || 'null');
      if (!saved || saved.path !== location.pathname) { updateLanguageLinks(); return; }
      sessionStorage.removeItem(positionKey);
    } catch (_) { updateLanguageLinks(); return; }
    if (Date.now() - saved.time > 60000) { updateLanguageLinks(); return; }
    if (document.fonts) await document.fonts.ready;
    const main = document.querySelector("#main");
    if (main && main.getAnimations) await Promise.all(main.getAnimations().map(animation => animation.finished.catch(() => {})));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = saved.id && document.getElementById(saved.id);
      if (target) {
        window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - saved.offset, behavior: 'instant' });
        history.replaceState(null, '', location.pathname + location.search + '#' + saved.id);
      }
      else if (!saved.id) window.scrollTo({ top: 0, behavior: 'instant' });
      updateLanguageLinks();
    }));
  }
  if (document.readyState === 'complete') restoreLanguagePosition();
  else window.addEventListener('load', restoreLanguagePosition, { once: true });
  updateLanguageLinks();
  document.querySelectorAll('#site-nav a[href*="#"], .research-paper-index a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const header = document.querySelector('.masthead');
      const clearance = (header ? header.getBoundingClientRect().height : 0) + 12;
      window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - clearance, behavior: 'smooth' });
      history.pushState(null, '', url.hash);
    }, true);
  });

  const chinese = document.documentElement.lang === 'zh';
  const translations = {'Copy':'复制','Copied!':'已复制','Close':'关闭','Loading citation…':'正在加载引用…','Citation copied.':'引用已复制。','Could not load this citation. Please try again.':'无法加载引用，请重试。','Citation selected. Press Ctrl+C or Command+C to copy.':'已选中引用，请按 Ctrl+C 或 Command+C 复制。','Research overview':'研究概览'};
  const text = value => chinese ? (translations[value] || value) : value;
  const localize = dialog => { if (chinese) dialog.querySelectorAll('h2, button').forEach(el => { el.textContent = text(el.textContent); }); };
  let previousFocus;
  const modal = document.createElement('dialog');
  modal.className = 'homepage-dialog';
  modal.setAttribute('aria-labelledby', 'citation-dialog-title');
  modal.innerHTML = '<div class="homepage-dialog-header"><h2 id="citation-dialog-title">BibTeX</h2><button type="button" class="citation-copy" disabled>Copy</button><button type="button" class="dialog-close" aria-label="Close dialog">Close</button></div><p class="homepage-dialog-status" role="status" aria-live="polite"></p><pre tabindex="0"></pre>';
  localize(modal);
  document.body.appendChild(modal);
  const pre = modal.querySelector('pre');
  const copy = modal.querySelector('.citation-copy');
  const status = modal.querySelector('[role="status"]');
  function wire(dialog) {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      const r = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => { if (previousFocus) previousFocus.focus(); });
  }
  wire(modal);
  let request;
  document.querySelectorAll('.publication-list a[href$=".bib"]').forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', async e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      previousFocus = link;
      if (request) request.abort();
      request = new AbortController();
      pre.textContent = text('Loading citation…');
      status.textContent = '';
      copy.disabled = true;
      copy.textContent = text('Copy');
      modal.showModal();
      try {
        const response = await fetch(link.href, { signal: request.signal });
        if (!response.ok) throw new Error('Citation unavailable');
        const citation = await response.text();
        if (!/^\s*@\w+\s*[({]/.test(citation)) throw new Error('Invalid citation');
        pre.textContent = citation.trim();
        copy.disabled = false;
      } catch (error) {
        if (error.name === 'AbortError') return;
        pre.textContent = '';
        status.textContent = text('Could not load this citation. Please try again.');
      }
    });
  });
  modal.addEventListener('close', () => { if (request) request.abort(); });
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(pre.textContent);
      copy.textContent = text('Copied!');
      status.textContent = text('Citation copied.');
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = text('Citation selected. Press Ctrl+C or Command+C to copy.');
    }
  });
  const figure = document.querySelector('.research-figure');
  if (figure) {
    const imageDialog = document.createElement('dialog');
    imageDialog.className = 'homepage-dialog research-image-dialog';
    imageDialog.setAttribute('aria-labelledby', 'research-dialog-title');
    imageDialog.innerHTML = '<div class="homepage-dialog-header"><h2 id="research-dialog-title">Research overview</h2><button type="button" class="dialog-close" aria-label="Close research overview">Close</button></div>';
    const img = figure.querySelector('img').cloneNode(true);
    localize(imageDialog);
    imageDialog.appendChild(img);
    document.body.appendChild(imageDialog);
    wire(imageDialog);
    figure.setAttribute('aria-haspopup', 'dialog');
    figure.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // Capture before the theme's image-preview handler to avoid two overlays.
      e.stopImmediatePropagation();
      previousFocus = figure;
      if (!imageDialog.open) imageDialog.showModal();
    }, true);
  }
})();
