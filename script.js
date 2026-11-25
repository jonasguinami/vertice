'use strict';

// CONFIGURAÇÃO: informe o número comercial real, com 55 + DDD + número,
// somente dígitos. Não inclua +, espaços, traços ou parênteses.
const CONFIG = Object.freeze({
  whatsappNumber: '',
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

// 03 — Scrollspy: atualiza a seção ativa sem alterar o histórico do navegador.
const navLinks = $$('.dock a[href^="#"]');
const sections = navLinks.map(link => ({ link, section: $(link.getAttribute('href')) }));
let scrollPending = false;
function updateActiveSection() {
  const line = window.innerHeight * 0.36;
  let active = sections[0];
  for (const entry of sections) {
    if (entry.section.getBoundingClientRect().top <= line) active = entry;
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12) {
    active = sections[sections.length - 1];
  }
  for (const entry of sections) {
    const selected = entry === active;
    entry.link.classList.toggle('is-active', selected);
    if (selected) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
  scrollPending = false;
}
function scheduleScrollspy() {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(updateActiveSection);
}
window.addEventListener('scroll', scheduleScrollspy, { passive: true });
window.addEventListener('resize', scheduleScrollspy, { passive: true });
window.addEventListener('load', scheduleScrollspy);
updateActiveSection();

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
  const allowed = {
    campaign: ['Divulgação de marca', 'Promoção relâmpago', 'Lançamento', 'Tráfego local', 'Outro objetivo'],
    duration: ['15 dias', '1 mês', '3 meses', '6 meses', 'Plano contínuo'],
    creative: ['Sim, já possuo', 'Preciso de criação']
  };
  if (!allowed.campaign.includes(campaign) || !allowed.duration.includes(duration) || !allowed.creative.includes(creative)) {
    showError('Selecione o objetivo, o período de veiculação e a situação da arte ou vídeo.');
    return;
  }
  const number = CONFIG.whatsappNumber.trim();
  if (!/^55[1-9]\d[2-9]\d{7,8}$/.test(number)) {
    showError('O número de atendimento ainda não foi configurado. Não foi possível abrir o WhatsApp.');
    return;
  }
  const message = [
    'Olá! Gostaria de solicitar uma proposta de veiculação publicitária em mídia DOOH.',
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
