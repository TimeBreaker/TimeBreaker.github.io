
(function () {
  'use strict';
  if (!window.HTMLDialogElement) return;
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
