const icons = {
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',

  brand:'<path d="M3 5h8l9 9-6 6-9-9V5z"/><circle cx="9" cy="9" r="1"/><path d="M16 4v5m-2.5-2.5h5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  ticket:'<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7zM15 8v2m0 2v2m0 2v1"/>',
  spark:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2z"/>',
  external:'<path d="M13 5h6v6m0-6-9 9m7-2v6H6V7h6"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  trend:'<path d="m3 6 7 7 4-4 7 7m-6 0h6v-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  filter:'<path d="M4 7h16M7 12h10m-7 5h4"/>',
  box:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M15 6v13M6 10h6m6 0h.01m0 4h.01"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
  cup:'<path d="M4 7h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7zm12 2h2a2 2 0 1 1 0 4h-2M3 21h17"/>',
  bed:'<path d="M3 18V6m18 12v-7a2 2 0 0 0-2-2H3m0 6h18M7 9V6h5v3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
};
const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
const $ = id => document.getElementById(id);
const el = (tag, cls, value) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value != null) node.textContent = value;
  return node;
};
function link(text, url, cls) {
  const a = el('a', cls, text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
function externalArrow() {
  const arrow = el('span','offer-arrow');
  arrow.innerHTML = icon('external');
  return arrow;
}
function mark(store) {
  const badge = el('span','store-mark',store?.mark || '↗');
  badge.style.background = store?.bg || '#eee7ff';
  badge.style.color = store?.color || '#371d75';
  badge.setAttribute('aria-hidden','true');
  return badge;
}
const queryUrl = (pattern, query) => pattern
  .replace('{q}', encodeURIComponent(query))
  .replace('{slug}', encodeURIComponent(query.replace(/\s+/g, '-').toLowerCase()));
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const day = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'});
const byId = Object.fromEntries([...stores,...searchStores].map(store => [store.id, store]));
let activeSearch, searchedQuery = '', filters = {}, currentProducts = [], currentKind = '', currentCoupons = [];
let lastCouponRefresh = 0, discountRequest, toastTimer, homeRequest, homeLoadedAt = 0;
const clock = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const colorSwatches = {
  'Preto':'#27262b','Branco':'#fff','Cinza':'#95959b','Azul':'#3367aa','Verde':'#3d785d',
  'Rosa':'#ee9cb8','Roxo':'#8e63bc','Vermelho':'#c0424b','Bege':'#e0ccb1','Inox':'#c3c6cc','Preto e inox':'linear-gradient(135deg,#29282c 50%,#c3c6cc 50%)',
};
const couponStores = Object.create(null);

document.querySelectorAll('[data-icon]').forEach(node => node.innerHTML = icon(node.dataset.icon));
stores.slice(0,6).forEach(store => {
  const a = el('a','brand-card');
  a.href = '#descontos';
  a.append(mark(store), el('span','',store.name));
  a.addEventListener('click', () => {
    $('store-filter').value = store.id;
    setKind('');
    renderCoupons();
  });
  $('brand-list').append(a);
});
stores.forEach(store => $('store-filter').add(new Option(store.name,store.id)));

function setPage() {
  const page = location.hash === '#descontos' ? 'descontos' : 'comparar';
  document.querySelectorAll('.page').forEach(node => { node.hidden = node.id !== page; });
  document.querySelectorAll('[data-page]').forEach(node => {
    if (node.dataset.page === page) node.setAttribute('aria-current','page');
    else node.removeAttribute('aria-current');
  });
  if (page === 'descontos') refreshCoupons();
  else loadHome();
}
window.addEventListener('hashchange', setPage);

function renderProduct(product) {
  const card = el('article','product');
  const photo = el('div','product-photo');
  const placeholder = el('span','photo-empty','Foto indisponível');
  photo.append(placeholder);
  if (product.category) photo.append(el('span','product-category',product.category));
  const content = el('div','product-content');
  const heading = el('h3','',product.title);
  content.append(heading);
  if (product.subtitle) content.append(el('p','product-subtitle',product.subtitle));
  if (product.colors.length) {
    const colors = el('ul','product-colors');
    colors.setAttribute('aria-label','Cores encontradas nas lojas');
    product.colors.forEach(color => {
      const item = el('li','color-chip');
      const swatch = el('span','swatch');
      swatch.style.background = colorSwatches[color] || '#eee7ff';
      item.append(swatch,el('span','',color));
      colors.append(item);
    });
    content.append(colors);
  } else if (product.dimension === 'color') {
    content.append(el('p','product-subtitle','Cores não informadas pelas lojas'));
  }
  const select = el('select','variant-select');
  const selection = el('label','variant-field');
  const field = ({voltage:'Voltagem',color:'Cor',options:'Versão'})[product.dimension] || 'Versão';
  select.setAttribute('aria-label',field + ' de ' + product.title);
  product.variants.forEach((variant,index) => {
    const label = variant.known ? variant.label : variant.label + ' · ' + variant.offers[0].store;
    select.add(new Option(label,String(index)));
  });
  if (product.dimension && product.variants.length > 1) {
    selection.append(el('span','',field),select);
    content.append(selection);
  } else if (product.dimension === 'voltage' || (product.dimension === 'options' && product.variants[0].label !== 'Versão do anúncio')) {
    content.append(el('p','product-subtitle',product.variants[0].label));
  }
  const rows = el('ul','product-prices');
  rows.setAttribute('aria-label','Preços por loja');
  content.append(rows);
  if (product.query) {
    const details = el('button','product-more','Buscar em mais lojas');
    details.type = 'button';
    details.addEventListener('click',() => search(product.query));
    content.append(details);
  }
  card.append(photo,content);
  function showVariant() {
    const variant = product.variants[Number(select.value)];
    photo.querySelector('img')?.remove();
    placeholder.hidden = false;
    if (variant.image) {
      const img = el('img');
      img.alt = product.title + (product.dimension && variant.known ? ' · ' + variant.label : '');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load',() => { placeholder.hidden = true; });
      img.addEventListener('error',() => { img.remove(); placeholder.hidden = false; });
      photo.prepend(img);
      img.src = variant.image;
    }
    rows.replaceChildren();
    const compare = variant.known && variant.offers.length > 1;
    variant.offers.forEach((offer,index) => {
      const row = el('li',index === 0 && compare ? 'product-price best-price' : 'product-price');
      const a = link('',offer.url,'product-price-link');
      const store = el('span','product-store',offer.store);
      if (index === 0 && compare) store.append(el('small','','Menor preço'));
      if (offer.condition || offer.delivery) store.append(el('small','offer-meta',[offer.condition,offer.delivery].filter(Boolean).join(' · ')));
      a.append(mark(byId[offer.storeId]),store,el('strong','price-number',money.format(offer.price)),externalArrow());
      row.append(a);
      rows.append(row);
    });
  }
  select.addEventListener('change',showVariant);
  showVariant();
  return card;
}
async function loadHome() {
  if (homeRequest || Date.now() - homeLoadedAt < 300000) return;
  const status = $('home-status');
  $('reload-home').hidden = true;
  status.textContent = 'Buscando preços e fotos nos catálogos das lojas…';
  homeRequest = fetch('/api/home');
  try {
    const response = await homeRequest;
    if (!response.ok) throw new Error('home');
    const {products,checkedAt} = await response.json();
    $('product-grid').replaceChildren(...products.map(renderProduct));
    if (!products.length) {
      status.textContent = 'As lojas não retornaram preços para a vitrine agora.';
      $('reload-home').hidden = false;
      return;
    }
    homeLoadedAt = Date.now();
    status.textContent = 'Consultado em ' + clock.format(new Date(checkedAt)) + ' · Frete calculado na loja.';
  } catch {
    status.textContent = 'Não foi possível carregar a vitrine. A busca por produto continua disponível.';
    $('reload-home').hidden = false;
  } finally {
    homeRequest = null;
  }
}
$('reload-home').addEventListener('click',loadHome);

const storeKey = offer => offer.storeId || offer.store;
const filterForm = $('search-filters');
const priceMax = $('price-max');

function populateFilters(products) {
  const availableStores = new Map();
  const availableVersions = new Set();
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.known && variant.label !== 'Versão do anúncio') availableVersions.add(variant.label);
      for (const offer of variant.offers) availableStores.set(storeKey(offer),offer.store);
    }
  }
  const storeOptions = [...availableStores].sort((a,b) => a[1].localeCompare(b[1],'pt-BR'));
  $('result-store').replaceChildren(new Option('Todas as lojas',''),...storeOptions.map(([key,name]) => new Option(name,key)));
  $('result-variant').replaceChildren(new Option('Todas as versões',''),...[...availableVersions].sort((a,b) => a.localeCompare(b,'pt-BR')).map(value => new Option(value,value)));
  $('result-variant').disabled = !availableVersions.size;
  filterForm.hidden = !products.length;
}

function renderSearchProducts() {
  const {store,version,min,max} = filters;
  const active = Object.keys(filters).length > 0;
  const visible = active ? currentProducts.flatMap(product => {
    const variants = product.variants.flatMap(variant => {
      if (version && (!variant.known || variant.label !== version)) return [];
      const offers = variant.offers.filter(offer => (!store || storeKey(offer) === store) && offer.price >= min && offer.price <= max);
      return offers.length ? [{...variant,offers}] : [];
    });
    return variants.length ? [{...product,variants}] : [];
  }) : currentProducts;
  $('order-box').hidden = visible.length < 2;
  const direction = $('order').value === 'desc' ? -1 : 1;
  const firstPrice = product => product.variants[0].offers[0].price;
  const ordered = [...visible].sort((a,b) => direction * (firstPrice(a) - firstPrice(b)));
  const list = $('offer-list');
  list.replaceChildren(...ordered.map(renderProduct));
  if (active && !visible.length) {
    const empty = el('div','filter-empty');
    empty.append(el('strong','','Nenhuma oferta com esses filtros'),el('p','','Ajuste a loja, a versão ou a faixa de preço para ver mais resultados.'));
    list.append(empty);
  }
  const summary = $('filter-status');
  summary.hidden = !active;
  summary.textContent = active ? visible.length + (visible.length === 1 ? ' produto exibido' : ' produtos exibidos') + ' após filtrar.' : '';
}

filterForm.addEventListener('submit',event => {
  event.preventDefault();
  const minimum = $('price-min').valueAsNumber;
  const maximum = priceMax.valueAsNumber;
  const min = Number.isFinite(minimum) ? minimum : 0;
  const max = Number.isFinite(maximum) ? maximum : Infinity;
  if (max < min) {
    priceMax.setCustomValidity('O preço máximo deve ser maior ou igual ao mínimo.');
    priceMax.reportValidity();
    return;
  }
  const store = $('result-store').value;
  const version = $('result-variant').value;
  filters = store || version || Number.isFinite(minimum) || Number.isFinite(maximum) ? {store,version,min,max} : {};
  renderSearchProducts();
});
filterForm.addEventListener('input',() => priceMax.setCustomValidity(''));
filterForm.addEventListener('reset',() => {
  filters = {};
  priceMax.setCustomValidity('');
  renderSearchProducts();
});

const marketplaceIds = ['amazon','meli','casas','ponto'];
function renderMarketplaceLinks(query, status, offers = [], sources = {}) {
  const cards = marketplaceIds.map(id => {
    const store = byId[id];
    const count = offers.filter(offer => offer.storeId === id).length;
    const message = count
      ? count + (count === 1 ? ' oferta no Garimpo' : ' ofertas no Garimpo')
      : ({loading:'Consultando preços',unconfigured:'Busca direta na loja',available:'Sem oferta retornada nesta busca',unavailable:'Busca direta na loja'})[sources[id] || status];
    const a = link('',queryUrl(store.search,query),'marketplace-link');
    const detail = el('span','marketplace-copy');
    detail.append(el('strong','',store.name),el('small','',message));
    a.append(mark(store),detail,externalArrow());
    return a;
  });
  $('marketplace-links').replaceChildren(...cards);
}
async function search(query, {remember = true,focus = true} = {}) {
  searchedQuery = query;
  if (remember && new URLSearchParams(location.search).get('q') !== query) {
    const url = new URL(location.href);
    url.searchParams.set('q',query);
    history.pushState(null,'',url);
  }
  activeSearch?.abort();
  const controller = new AbortController();
  activeSearch = controller;
  $('query').value = query;
  $('results').hidden = false;
  $('result-title').textContent = query;
  $('result-status').textContent = 'Consultando as fontes de preços…';
  $('result-status').classList.add('loading-indicator');
  $('offer-list').setAttribute('aria-busy','true');
  filterForm.hidden = true;
  $('order').value = 'price';
  currentProducts = [];
  filterForm.reset();
  renderMarketplaceLinks(query,'loading');
  const direct = [...stores,...searchStores].filter(store => store.search && !marketplaceIds.includes(store.id)).map(store => link(store.name + ' ↗',queryUrl(store.search,query)));
  const comparisonUrl = 'https://www.google.com/search?' + new URLSearchParams({q:query,tbm:'shop',gl:'br',hl:'pt-BR'});
  $('direct-list').replaceChildren(link('Google Shopping ↗',comparisonUrl),...direct);
  if (focus) $('result-title').focus();
  try {
    const response = await fetch('/api/search?' + new URLSearchParams({q:query}),{signal:controller.signal});
    if (!response.ok) throw new Error('search');
    const data = await response.json();
    if (activeSearch !== controller) return;
    currentProducts = data.products;
    populateFilters(currentProducts);
    renderMarketplaceLinks(query,data.shoppingStatus,data.offers,data.sources);
    const unique = new Set(data.offers.map(item => item.store)).size;
    const coverage = data.wide ? '' : ' A cobertura automática é parcial.';
    $('result-status').textContent = currentProducts.length
      ? currentProducts.length + (currentProducts.length === 1 ? ' produto em ' : ' produtos em ') + unique + (unique === 1 ? ' loja.' : ' lojas.') + ' Valores anunciados, sem cálculo de frete.' + coverage
      : data.available ? 'Nenhuma oferta com preço para essa busca.' + coverage : 'A comparação automática está indisponível. Consulte os links abaixo para ver os preços.';
    renderSearchProducts();
  } catch (error) {
    if (activeSearch === controller && !controller.signal.aborted) {
      renderMarketplaceLinks(query,'unavailable');
      $('result-status').textContent = 'As fontes de preço não responderam. Você pode consultar as lojas abaixo.';
    }
  } finally {
    if (activeSearch === controller) {
      $('result-status').classList.remove('loading-indicator');
      $('offer-list').removeAttribute('aria-busy');
    }
  }
}
$('search-form').addEventListener('submit',event => {
  event.preventDefault();
  const value = $('query').value.trim().replace(/\s+/g,' ');
  if (value.length < 2) {
    $('query').setCustomValidity('Digite pelo menos dois caracteres.');
    $('query').reportValidity();
    return;
  }
  search(value);
});
$('query').addEventListener('input', () => $('query').setCustomValidity(''));
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
  $('query').setCustomValidity('');
  search(button.dataset.query);
}));
$('order').addEventListener('change',renderSearchProducts);

async function copy(code, button) {
  try {
    await navigator.clipboard.writeText(code);
    $('toast').textContent = 'Cupom copiado';
  } catch {
    $('toast').textContent = 'Copie o código: ' + code;
    button.focus();
  }
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; },2600);
}
function renderCoupons() {
  const selectedStore = $('store-filter').value;
  const entries = currentCoupons
    .filter(item => Date.parse(item.expires) > Date.now())
    .map(item => ({...item, kind:'Cupom', entry:byId[item.store] || couponStores[item.store]}))
    .concat(stores.map(entry => ({...entry,store:entry.id,entry})))
    .filter(item => item.entry && (!currentKind || currentKind === item.kind) && (!selectedStore || item.store === selectedStore));
  $('coupons').replaceChildren();
  if (!entries.length) $('coupons').append(el('p','subtle','Nenhum desconto para estes filtros.'));
  for (const item of entries) {
    const card = el('article','coupon');
    const top = el('div','coupon-top');
    top.append(mark(item.entry),el('span','',item.entry.name),el('span','pill',item.code ? 'Código' : item.kind));
    const actions = el('div','coupon-actions');
    card.append(top,el('h3','',item.title),el('p','',item.description));
    if (item.code) {
      const date = el('time','', 'Até ' + day.format(new Date(item.expires)));
      date.dateTime = item.expires;
      card.append(date);
      const button = el('button','code',item.code + ' ⧉');
      button.type = 'button';
      button.setAttribute('aria-label','Copiar cupom ' + item.code);
      button.addEventListener('click',() => copy(item.code,button));
      actions.append(button);
    }
    if (item.source) {
      card.append(el('p','coupon-source','Fonte: ' + item.source + ' · link de afiliado.'));
      actions.append(link('Usar cupom ↗',item.url,'action'));
    }
    const label = item.code ? 'Ver regras' : ({Cupom:'Ver cupons',Promoção:'Ver ofertas',Encarte:'Ver encarte'})[item.kind];
    actions.append(link(label + ' ↗',item.sourceUrl || item.entry.url,'text-link'));
    card.append(actions);
    $('coupons').append(card);
  }
}
function setKind(kind) {
  currentKind = kind;
  document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.kind === kind)));
}
async function refreshCoupons() {
  renderCoupons();
  if (discountRequest || Date.now() - lastCouponRefresh < 300000) return;
  $('coupon-status').textContent = 'Consultando os códigos disponíveis…';
  discountRequest = fetch('/api/discounts').then(response => {
    if (!response.ok) throw new Error('discounts');
    return response.json();
  });
  try {
    const data = await discountRequest;
    currentCoupons = data.coupons;
    for (const item of currentCoupons) {
      if (!byId[item.store] && !couponStores[item.store] && item.storeName) {
        couponStores[item.store] = {name:item.storeName,mark:item.storeName.slice(0,2).toUpperCase(),bg:'#eee7ff',color:'#371d75',url:item.sourceUrl};
        $('store-filter').add(new Option(item.storeName,item.store));
      }
    }
    lastCouponRefresh = Date.now();
    const count = currentCoupons.length;
    $('coupon-status').textContent = count
      ? (count === 1 ? '1 código com validade publicada' : count + ' códigos com validade publicada') + ' · Consulte as páginas oficiais para mais campanhas.'
      : 'Consulte as páginas oficiais para ver as campanhas disponíveis.';
  } catch {
    $('coupon-status').textContent = 'Consulte as páginas oficiais para ver as campanhas disponíveis.';
  } finally {
    discountRequest = undefined;
    renderCoupons();
  }
}
$('store-filter').addEventListener('change',renderCoupons);
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  setKind(button.dataset.kind);
  renderCoupons();
}));
function restoreSearch() {
  if (location.hash === '#descontos') return;
  const query = (new URLSearchParams(location.search).get('q') || '').trim().replace(/\s+/g,' ');
  if (query === searchedQuery) return;
  if (query.length >= 2 && query.length <= 120) {
    search(query,{remember:false,focus:false});
  } else {
    activeSearch?.abort();
    searchedQuery = '';
    $('query').value = '';
    $('results').hidden = true;
  }
}
window.addEventListener('popstate',restoreSearch);
window.addEventListener('hashchange',restoreSearch);
setPage();
restoreSearch();
setInterval(() => { if (!$('descontos').hidden && !document.hidden) refreshCoupons(); },300000);

const pushInvite = $('push-invite');
const pushMenu = $('push-menu');
const pushAction = $('push-action');
const pushDismiss = $('push-dismiss');
const pushStatus = $('push-status');
const pushSupported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushPreference = 'garimpo:coupon-invite-dismissed';
let pushRegistration, pushKey, pushSubscription, pushError;
let inviteDismissed = false;
try { inviteDismissed = localStorage.getItem(pushPreference) === '1'; } catch {}

function showPushInvite(open) {
  pushInvite.hidden = !open;
  pushMenu.setAttribute('aria-expanded',String(open));
}

function renderPushStatus() {
  const blocked = pushSupported && Notification.permission === 'denied';
  pushAction.hidden = !(pushRegistration && pushKey) || (blocked && !pushSubscription);
  pushAction.textContent = pushSubscription ? 'Desativar alertas' : 'Ativar alertas';
  pushDismiss.textContent = pushSubscription || pushAction.hidden ? 'Fechar' : 'Agora não';
  pushStatus.textContent = pushError || (!pushSupported ? 'Este navegador não oferece notificações para o site.'
    : blocked ? 'A permissão foi bloqueada. Você pode alterá-la nas configurações do navegador.'
    : pushSubscription ? 'Alertas ativos neste navegador.'
    : pushKey ? 'O navegador avisa quando forem encontrados novos cupons, mesmo com o site fechado.'
    : 'O serviço de alertas está indisponível no momento.');
}

async function initializePush() {
  if (!pushSupported) { renderPushStatus(); return; }
  try {
    const response = await fetch('/api/push');
    if (!response.ok) throw new Error('push configuration');
    const config = await response.json();
    if (config.enabled && config.publicKey) {
      const registration = await navigator.serviceWorker.register('/sw.js');
      pushRegistration = registration.active ? registration : await navigator.serviceWorker.ready;
      pushKey = Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')), character => character.charCodeAt(0));
      pushSubscription = await pushRegistration.pushManager.getSubscription();
      if (!pushSubscription && !inviteDismissed && Notification.permission === 'default') showPushInvite(true);
    }
  } catch {
    pushKey = null;
  }
  renderPushStatus();
}

async function savePushSubscription(method,subscription) {
  const response = await fetch('/api/push',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription)});
  if (!response.ok) throw new Error('subscription');
}

pushMenu.addEventListener('click',() => {
  showPushInvite(pushInvite.hidden);
  if (!pushInvite.hidden) (pushAction.hidden ? pushDismiss : pushAction).focus();
});
pushDismiss.addEventListener('click',() => {
  try { localStorage.setItem(pushPreference,'1'); } catch {}
  showPushInvite(false);
  pushMenu.focus();
});
pushAction.addEventListener('click',async () => {
  pushAction.disabled = true;
  pushError = null;
  let pending;
  try {
    if (pushSubscription) {
      await savePushSubscription('DELETE',pushSubscription);
      await pushSubscription.unsubscribe();
      pushSubscription = null;
    } else {
      pending = await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKey});
      await savePushSubscription('POST',pending);
      pushSubscription = pending;
    }
  } catch {
    if (pending) await pending.unsubscribe().catch(() => {});
    pushError = Notification.permission === 'denied' ? null : 'Não foi possível salvar a preferência. Tente novamente.';
  } finally {
    pushAction.disabled = false;
    renderPushStatus();
    if (pushAction.hidden) pushDismiss.focus();
  }
});
renderPushStatus();
initializePush();
