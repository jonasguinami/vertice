'use strict';

// CONFIGURAÇÃO: informe o número comercial real, com 55 + DDD + número,
// somente dígitos. Não inclua +, espaços, traços ou parênteses.
const CONFIG = Object.freeze({
  whatsappNumber: '5551996525053', // 55 + DDD + número, somente dígitos
  instagramUrl: 'https://www.instagram.com/vertice_outdoor', // URL completa do perfil oficial
  linkedinUrl: '',  // URL completa da página oficial
  themeStorageKey: 'signage-theme'
});

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// 01 — Tema persistente; funciona mesmo quando o armazenamento está bloqueado.
const themeToggle = $('#theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const readTheme = () => {
  try {
    const value = localStorage.getItem(CONFIG.themeStorageKey);
    return ['light', 'dark'].includes(value) ? value : null;
  } catch { return null; }
};
let explicitTheme = readTheme();
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const nextLabel = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.title = nextLabel;
  $('meta[name="theme-color"]').content = theme === 'dark' ? '#0b0d10' : '#ffffff';
}
applyTheme(explicitTheme || (systemTheme.matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
  explicitTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(explicitTheme);
  try { localStorage.setItem(CONFIG.themeStorageKey, explicitTheme); } catch { /* Sessão atual continua funcional. */ }
});
systemTheme.addEventListener('change', event => {
  if (!explicitTheme) applyTheme(event.matches ? 'dark' : 'light');
});

// 02 — Imagens opcionais: aceita src ou data-src, sem requisição vazia.
// O fallback permanece visível se o caminho estiver vazio ou o arquivo falhar.
$$('.media-image').forEach(img => {
  const slot = img.closest('.media-slot');
  const source = (img.getAttribute('src') || img.dataset.src || '').trim();
  const onLoad = () => slot.classList.toggle('has-image', img.naturalWidth > 0);
  img.addEventListener('load', onLoad);
  img.addEventListener('error', () => slot.classList.remove('has-image'));
  if (!source) {
    img.removeAttribute('src');
    img.setAttribute('aria-hidden', 'true');
    return;
  }
  img.removeAttribute('aria-hidden');
  if (img.getAttribute('src') !== source) img.src = source;
  if (img.complete) onLoad();
});

// 03 — ScrollSpy e indicador deslizante da dock. Galeria, planos e pontos
// pertencem à mesma área de navegação (Pontos), preservando os quatro atalhos.
const dock = $('.dock');
const navLinks = $$('.dock-item', dock);
const sections = navLinks.map(link => ({ link, section: $(link.getAttribute('href')) }));
let scrollPending = false;
let clickTarget = null;
let clickTimer = 0;
let clickStart = 0;
let clickDestination = 0;
let drag = null;
let suppressClickUntil = 0;
function moveSlider(link) {
  const parent = dock.getBoundingClientRect();
  const rect = link.getBoundingClientRect();
  dock.style.setProperty('--slider-x', `${rect.left - parent.left - dock.clientLeft}px`);
  dock.style.setProperty('--slider-y', `${rect.top - parent.top - dock.clientTop}px`);
  dock.style.setProperty('--slider-w', `${rect.width}px`);
  dock.style.setProperty('--slider-h', `${rect.height}px`);
  dock.classList.add('slider-ready');
}
function setActive(link) {
  for (const item of navLinks) {
    const selected = item === link;
    item.classList.toggle('is-active', selected);
    if (selected) item.setAttribute('aria-current', 'location');
    else item.removeAttribute('aria-current');
  }
  moveSlider(link);
}
function releaseClick() {
  clickTarget = null;
  clearTimeout(clickTimer);
  scheduleScrollspy();
}
function updateActiveSection() {
  scrollPending = false;
  // ScrollSpy não disputa a posição da pílula com o gesto ativo.
  if (drag?.active) { renderDrag(drag.x); return; }
  if (clickTarget) {
    setActive(clickTarget);
    // Mantém a pílula no destino enquanto ocorre a rolagem suave.
    if (Math.abs(window.scrollY - clickDestination) <= 3 || Math.abs(clickStart - clickDestination) <= 3) releaseClick();
    return;
  }
  const line = Math.max(100, window.innerHeight * 0.36);
  let active = sections[0];
  for (const entry of sections) {
    if (entry.section.getBoundingClientRect().top <= line) active = entry;
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12) active = sections[sections.length - 1];
  setActive(active.link);
}
function scheduleScrollspy() {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(updateActiveSection);
}
for (const { link, section } of sections) {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    clearTimeout(clickTimer);
    clickTarget = link;
    clickStart = window.scrollY;
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    clickDestination = Math.max(0, Math.min(section.getBoundingClientRect().top + clickStart - padding, document.documentElement.scrollHeight - window.innerHeight));
    setActive(link);
    clickTimer = window.setTimeout(releaseClick, 1200);
    // O navegador continua responsável pela âncora, URL e histórico.
  });
}
// Pointer Events unificam mouse, toque e caneta, sem eventos duplicados.
// Um toque/clique simples mantém o comportamento nativo da âncora.
const DRAG_THRESHOLD = 6;
function itemAt(x) {
  // Se estiver sobre um item, prioriza seus limites reais; em lacunas, o mais próximo.
  const hit = navLinks.find(item => {
    const rect = item.getBoundingClientRect();
    return x >= rect.left && x <= rect.right;
  });
  if (hit) return hit;
  return navLinks.reduce((best, item) => {
    const a = best.getBoundingClientRect();
    const b = item.getBoundingClientRect();
    return Math.abs(x - (b.left + b.width / 2)) < Math.abs(x - (a.left + a.width / 2)) ? item : best;
  });
}
function renderDrag(x) {
  const parent = dock.getBoundingClientRect();
  const rects = navLinks.map(item => item.getBoundingClientRect());
  const centers = rects.map(rect => rect.left + rect.width / 2);
  const center = Math.max(centers[0], Math.min(x, centers[centers.length - 1]));
  let i = 0;
  while (i < centers.length - 2 && center > centers[i + 1]) i++;
  const a = rects[i], b = rects[i + 1];
  const t = (center - centers[i]) / (centers[i + 1] - centers[i] || 1);
  const width = a.width + (b.width - a.width) * t;
  dock.style.setProperty('--slider-x', `${center - width / 2 - parent.left - dock.clientLeft}px`);
  dock.style.setProperty('--slider-y', `${a.top - parent.top - dock.clientTop}px`);
  dock.style.setProperty('--slider-w', `${width}px`);
  dock.style.setProperty('--slider-h', `${a.height + (b.height - a.height) * t}px`);
  dock.classList.add('slider-ready');
}
dock.addEventListener('pointerdown', event => {
  if (drag || !event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  suppressClickUntil = 0;
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, active: false };
});
window.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
  if (!drag.active) {
    if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    drag.active = true;
    clickTarget = null;
    clearTimeout(clickTimer);
    dock.classList.add('is-dragging');
    // Captura mantém o controle mesmo se o ponteiro sair da dock.
    try { dock.setPointerCapture(event.pointerId); } catch { /* listeners globais continuam ativos */ }
  }
  drag.x = event.clientX;
  renderDrag(drag.x);
  if (event.cancelable) event.preventDefault();
}, { passive: false });
function finishDrag(event, cancelled = false) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  const current = drag;
  drag = null;
  if (!current.active) return;
  const target = itemAt(cancelled ? current.x : event.clientX);
  dock.classList.remove('is-dragging');
  // Consolida a posição atual antes de iniciar a transição de encaixe.
  $('.dock-slider', dock).getBoundingClientRect();
  suppressClickUntil = performance.now() + 700;
  if (dock.hasPointerCapture(current.id)) dock.releasePointerCapture(current.id);
  if (cancelled) { updateActiveSection(); return; }
  // Reutiliza a âncora e a lógica de ScrollSpy, incluindo URL e histórico.
  target.click();
}
window.addEventListener('pointerup', event => finishDrag(event));
window.addEventListener('pointercancel', event => finishDrag(event, true));
dock.addEventListener('lostpointercapture', event => {
  if (event.target === dock) finishDrag(event, true);
});
window.addEventListener('blur', () => finishDrag(null, true));
dock.addEventListener('dragstart', event => event.preventDefault());
dock.addEventListener('click', event => {
  // Ignora o clique físico residual do arrasto, mas não o teclado ou target.click().
  if (event.detail > 0 && performance.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
window.addEventListener('wheel', releaseClick, { passive: true });
window.addEventListener('touchstart', event => { if (!dock.contains(event.target)) releaseClick(); }, { passive: true });
window.addEventListener('keydown', event => { if (['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' '].includes(event.key) && !['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName)) releaseClick(); });
window.addEventListener('scroll', scheduleScrollspy, { passive: true });
window.addEventListener('resize', scheduleScrollspy, { passive: true });
window.addEventListener('load', scheduleScrollspy);
if ('ResizeObserver' in window) new ResizeObserver(scheduleScrollspy).observe(dock);
if (document.fonts) document.fonts.ready.then(scheduleScrollspy);
updateActiveSection();

// Logo: se o PNG ainda não estiver na pasta, mantenha a marca textual visível.
$$('.brand-logo').forEach(img => {
  img.addEventListener('error', () => { img.hidden = true; });
  if (img.complete && !img.naturalWidth) img.hidden = true;
});

// Redes sociais: não inventa perfis. Habilita somente URLs HTTPS configuradas.
function isValidWhatsapp(number) { return /^55[1-9]\d[2-9]\d{7,8}$/.test(number); }
function safeSocialUrl(value, domain) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : '';
  } catch { return ''; }
}
const socialUrls = {
  instagram: safeSocialUrl(CONFIG.instagramUrl, 'instagram.com'),
  linkedin: safeSocialUrl(CONFIG.linkedinUrl, 'linkedin.com'),
  whatsapp: isValidWhatsapp(CONFIG.whatsappNumber.trim()) ? `https://wa.me/${CONFIG.whatsappNumber.trim()}` : ''
};
$$('[data-social]').forEach(link => {
  const url = socialUrls[link.dataset.social];
  if (!url) return;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.removeAttribute('aria-disabled');
  link.title = link.getAttribute('aria-label');
});

// 04 — Diálogos nativos: foco, Escape, fundo inerte e retorno ao acionador.
const quoteDialog = $('#quote-dialog');
const legalDialog = $('#legal-dialog');
const dialogs = [quoteDialog, legalDialog];
const focusReturn = new WeakMap();
function openDialog(dialog, trigger) {
  if (dialog.open) return;
  focusReturn.set(dialog, trigger || document.activeElement);
  dialog.showModal();
  document.body.classList.add('modal-open');
}
function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}
for (const dialog of dialogs) {
  $$('[data-close]', dialog).forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
  // Só fecha quando o clique é no backdrop, não no conteúdo do diálogo.
  let backdropDown = false;
  const isBackdrop = event => {
    if (event.target !== dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => { backdropDown = isBackdrop(event); });
  dialog.addEventListener('click', event => {
    if (backdropDown && isBackdrop(event)) closeDialog(dialog);
    backdropDown = false;
  });
  dialog.addEventListener('close', () => {
    if (!dialogs.some(item => item.open)) document.body.classList.remove('modal-open');
    const trigger = focusReturn.get(dialog);
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
}
$$('[data-quote]').forEach(button => button.addEventListener('click', () => {
  // Preserva o rascunho e altera somente o interesse indicado pelo CTA.
  if (button.dataset.plan) $('#plan').value = button.dataset.plan;
  if (button.dataset.point) $('#point').value = button.dataset.point;
  resetFeedback();
  openDialog(quoteDialog, button);
  $('#full-name').focus({ preventScroll: true });
}));
const legalTitles = { terms: 'Termos de Uso', privacy: 'Política de Privacidade' };
$$('[data-legal]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.legal;
  const template = $(`#${key}-template`);
  if (!Object.hasOwn(legalTitles, key) || !template) return;
  $('#legal-title').textContent = legalTitles[key];
  $('#legal-body').replaceChildren(template.content.cloneNode(true));
  // Pode abrir sobre o orçamento sem perder os dados preenchidos.
  openDialog(legalDialog, button);
  legalDialog.scrollTop = 0;
}));

// 05 — Validação, formatação e abertura do WhatsApp sem backend.
const form = $('#quote-form');
const formError = $('#form-error');
const fallback = $('#whatsapp-fallback');
const textFields = ['name', 'company', 'segment'];
function showError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}
function resetFeedback() {
  showError('');
  fallback.hidden = true;
  fallback.removeAttribute('href');
}
form.addEventListener('input', event => {
  if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  resetFeedback();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  resetFeedback();
  // Normaliza espaços e impede campos obrigatórios compostos apenas por espaços.
  for (const key of textFields) {
    const field = form.elements.namedItem(key);
    field.value = field.value.trim().replace(/\s+/g, ' ');
    const min = key === 'name' ? 3 : 2;
    field.setCustomValidity(field.value.length < min ? `Informe pelo menos ${min} caracteres.` : '');
  }
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  // Confere as opções aceitas, além da validação HTML nativa.
  const campaign = data.get('campaign');
  const duration = data.get('duration');
  const creative = data.get('creative');
  const plan = data.get('plan');
  const point = data.get('point');
  const allowed = {
    campaign: ['Divulgação de marca', 'Promoção relâmpago', 'Lançamento', 'Tráfego local', 'Outro objetivo'],
    duration: ['15 dias', '1 mês', '3 meses', '6 meses', 'Plano contínuo'],
    creative: ['Sim, já possuo', 'Preciso de criação'],
    plan: ['', 'Básico', 'Destaque', 'Premium'],
    point: ['', 'Pop Center — Porto Alegre', 'Intercity Canoas — Canoas']
  };
  if (!allowed.campaign.includes(campaign) || !allowed.duration.includes(duration) || !allowed.creative.includes(creative)) {
    showError('Selecione o objetivo, o período de veiculação e a situação da arte ou vídeo.');
    return;
  }
  if (!allowed.plan.includes(plan) || !allowed.point.includes(point)) {
    showError('Selecione um plano e ponto válidos ou deixe como ainda não definido.');
    return;
  }
  const number = CONFIG.whatsappNumber.trim();
  if (!isValidWhatsapp(number)) {
    showError('O número de atendimento ainda não foi configurado. Não foi possível abrir o WhatsApp.');
    return;
  }
  const message = [
    'Olá! Gostaria de solicitar uma proposta de veiculação publicitária em mídia DOOH da Vértice Mídia.',
    '',
    '*DADOS DO ANUNCIANTE*',
    `Responsável: ${data.get('name')}`,
    `Empresa / Marca: ${data.get('company')}`,
    `Segmento: ${data.get('segment')}`,
    '',
    '*INFORMAÇÕES DA CAMPANHA*',
    `Objetivo: ${campaign}`,
    `Período de veiculação: ${duration}`,
    `Arte / Vídeo: ${creative}`,
    `Plano de interesse: ${plan || 'Ainda não definido'}`,
    `Ponto de interesse: ${point || 'Ainda não definido'}`,
    '',
    'Gostaria de conhecer os pontos de mídia disponíveis, a frequência de inserções, os planos e os valores de veiculação.'
  ].join('\n');
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  // Ação síncrona do usuário; o link visível serve de alternativa se houver bloqueio.
  fallback.href = url;
  fallback.hidden = false;
  window.open(url, '_blank', 'noopener,noreferrer');
  // Não limpa os campos: o usuário pode revisar ou tentar abrir novamente.
});
$('#year').textContent = String(new Date().getFullYear());
