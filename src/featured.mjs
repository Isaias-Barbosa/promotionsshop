export const featured = [
  {
    id:'galaxy-a56', title:'Samsung Galaxy A56 5G', subtitle:'128 GB · 8 GB RAM', category:'Celulares',
    query:'Galaxy A56 128GB', model:/\ba56\b/, variant:'color', capacity:'128gb',
    pages:[
      ['Magalu','https://www.magazineluiza.com.br/smartphone-samsung-galaxy-a56-128gb-5g-8gb-ram-preto-67-cam-tripla-selfie-12mp/p/240095600/te/ga56/','Preto'],
      ['KaBuM!','https://www.kabum.com.br/produto/757546/smartphone-samsung-galaxy-a56-5g-128gb-8gb-ram-6-7-camera-tripla-selfie-12mp-preto','Preto'],
    ],
  },
  {
    id:'jbl-go-4', title:'Caixa de som JBL Go 4', subtitle:'Bluetooth · portátil', category:'Áudio',
    query:'JBL Go 4', model:/\bjbl\b.*\bgo\s?4\b|\bgo\s?4\b.*\bjbl\b/, variant:'color',
    pages:[
      ['KaBuM!','https://www.kabum.com.br/produto/583499/caixa-de-som-jbl-go-4-bluetooth-7-horas-de-bateria','Preto'],
      ['Carrefour','https://www.carrefour.com.br/produto/caixa-de-som-jbl-go-4-bluetooth-preta-333270002','Preto'],
      ['Americanas','https://www.americanas.com.br/jbl-go-4-caixa-de-som-bluetooth-branco-n174414h36149g49/p','Branco'],
    ],
  },
  {
    id:'air-fryer-mondial', title:'Air Fryer Mondial Family 4 L', subtitle:'AFN-40-BI', category:'Eletrodomésticos',
    query:'AFN-40-BI', model:/\bafn\s?40\s?bi\b/, variant:'voltage',
    pages:[
      ['KaBuM!','https://www.kabum.com.br/produto/157865/fritadeira-airfryer-mondial-family-inox-black-4l-127v-afn-40-bi-4012-01','Preto e inox','127 V'],
      ['Americanas','https://www.americanas.com.br/air-fryer-mondial-family-afn-40-bi-preto-e-inox-4l-com-timer-8298877-8778154/p','Preto e inox','127 V'],
    ],
  },
  {
    id:'philco-pvt491', title:'Ventilador Philco Maxx Force', subtitle:'PVT491 · 174 W', category:'Casa',
    query:'PVT491', model:/\bpvt\s?491\b/, variant:'voltage',
    pages:[
      ['Carrefour','https://www.carrefour.com.br/produto/ventilador-de-mesa-philco-40cm-pvt491-preto-220v-328515826','Preto','220 V'],
    ],
  },
  {
    id:'ps5-slim', title:'PlayStation 5 Slim', subtitle:'1 TB · leitor de disco · pacote 1000038858', category:'Games',
    query:'1000038858', model:/\b1000038858\b/, variant:null,
    pages:[
      ['KaBuM!','https://www.kabum.com.br/produto/875817/console-sony-playstation-5-slim-com-leitor-de-discos-ssd-1tb-controle-sem-fio-dualsense-2-jogos-1000038858','Branco'],
    ],
  },
];

const colorPatterns = [
  ['Preto e inox',/\b(?:preto|preta|black)\s+(?:e\s+)?inox\b|\binox black\b/],
  ['Preto',/\b(?:pret[oa]|black|grafite)\b/],
  ['Branco',/\b(?:branc[oa]|white)\b/],
  ['Cinza',/\b(?:cinza|gray|grey)\b/],
  ['Azul',/\b(?:azul|blue)\b/],
  ['Verde',/\b(?:verde|green)\b/],
  ['Rosa',/\b(?:rosa|pink)\b/],
  ['Roxo',/\b(?:rox[oa]|lilas|violeta|purple)\b/],
  ['Vermelho',/\b(?:vermelh[oa]|red)\b/],
  ['Bege',/\b(?:bege|creme|beige)\b/],
  ['Inox',/\binox\b/],
];

export function productColor(text) {
  return colorPatterns.find(([,pattern]) => pattern.test(text))?.[0] ?? null;
}

export function productVoltage(text) {
  const values = [...new Set(Array.from(text.matchAll(/\b(110|127|220)\s?v\b/g),m => m[1] === '110' ? '127' : m[1]))];
  if (/\bbivolt\b/.test(text)) return 'Bivolt';
  return values.length === 1 ? values[0] + ' V' : null;
}

export function buildProductCard(product, offers, normalize) {
  const groups = new Map();
  const colors = new Set();
  for (const offer of offers) {
    const title = normalize(offer.title);
    if (product.model && !offer.featuredPage && (!product.model.test(title) || (product.capacity && !title.split(' ').includes(product.capacity)))) continue;
    if (product.model && /\b(?:capa|estojo|case|suporte|peca|reposicao|usad[oa]|open box|reembalad[oa]|recondicionad[oa]|adesivo)\b/.test(title + ' ' + normalize(offer.condition || ''))) continue;
    if (product.variant === 'color' && /\b(?:kit|combo|pelicula|carregador|bateria portatil)\b/.test(title)) continue;
    const color = offer.color || productColor(title);
    const voltage = offer.voltage || productVoltage(title);
    if (color) colors.add(color);
    const specs = product.variant === 'options' ? offer.variantLabel
      : product.variant === 'color' ? color : product.variant === 'voltage' ? voltage : 'Versão padrão';
    const label = specs || (product.variant === 'color' ? 'Cor não informada' : 'Voltagem não informada');
    const known = product.variant === 'options' ? offer.variantKnown : !!specs;
    const key = known ? (offer.variantKey || label) : label + ' · ' + offer.store + ' · ' + offer.url;
    if (!groups.has(key)) groups.set(key, {id:key,label,known,offers:new Map()});
    const group = groups.get(key);
    const storeKey = offer.storeId || offer.store;
    const existing = group.offers.get(storeKey);
    if (!existing || offer.price < existing.price || (offer.price === existing.price && !existing.image && offer.image)) {
      group.offers.set(storeKey,offer);
    }
  }
  const variants = [...groups.values()].map(({id,label,known,offers}) => {
    const rows = [...offers.values()].sort((a,b) => a.price - b.price);
    return {id,label,known,image:rows.find(row => row.image)?.image ?? null,offers:rows};
  }).sort((a,b) => Number(b.known) - Number(a.known) || b.offers.length - a.offers.length || Number(!!b.image) - Number(!!a.image) || a.offers[0].price - b.offers[0].price);
  if (!variants.length) return null;
  return {id:product.id,title:product.title,subtitle:product.subtitle,category:product.category,query:product.query,dimension:product.variant,colors:[...colors],variants};
}

// Unit sizes and common technical standards are not manufacturer model codes.
const modelCode = /\b(?:[a-z]{1,8}\d{2,}[a-z0-9]*|\d{2,}[a-z]{2,}[a-z0-9]*)\b/g;
const sizeOrStandard = /^(?:\d+(?:gb|tb|cm|mm|ml|mg|kg|pol|hz|mhz|ghz|mp|mah|wh|wifi)|wifi\d+|ip\d+|ddr\d+|usb\d+|hdmi\d+|uhd\d+)$/;
const itemType = /\b(?:capa|estojo|case|suporte|pecas?|reposicao|tampas?|pratos?|armarios?|nichos?|pelicula|carregador|resistencia|bateria portatil|adesivo|kit|combo|brinquedos?|infantil)\b/;
const voltageProduct = /\b(?:microondas|ventilador|forno|air fryer|airfryer|fritadeira|cafeteira|geladeira|freezer|lava loucas|lavadora|secadora|liquidificador)\b/;
const identitySpecs = /\b(?:\d+(?:gb|tb|cm|mm|ml|kg|l|pol)|[345]g|pro|max|plus|ultra|mini|lite|slim)\b/g;

function searchIdentity(offer, title, normalize, knownBrands) {
  const condition = normalize(offer.condition || '');
  const type = title.match(itemType)?.[0];
  if (type) return 'listing:' + offer.url;

  const curated = featured.find(product => product.model.test(title) && (!product.capacity || title.split(' ').includes(product.capacity)));
  if (curated) return 'featured:' + curated.id + ':' + condition;

  const candidates = (title.match(modelCode) || []).filter(code => !sizeOrStandard.test(code));
  const brand = normalize(offer.brand || '') || knownBrands.find(name => (' ' + title + ' ').includes(' ' + name + ' '));
  if (candidates.length && brand) {
    const specTitle = title.replace(/(\d+)\s*litros?\b/g,'$1l');
    const specs = [...new Set(specTitle.match(identitySpecs) || [])].sort().join(' ');
    return ['model',brand,candidates[0],specs,condition].join(':');
  }
  if (offer.gtin) return 'gtin:' + offer.gtin + ':' + condition;
  return 'listing:' + offer.url;
}

export function buildSearchCards(offers, normalize) {
  const models = new Map();
  const knownBrands = [...new Set(offers.map(offer => normalize(offer.brand || '')).filter(Boolean))].sort((a,b) => b.length - a.length);
  for (const offer of offers) {
    const title = normalize(offer.title);
    const key = searchIdentity(offer,title,normalize,knownBrands);
    if (!models.has(key)) models.set(key,[]);
    models.get(key).push({...offer,color:offer.color || productColor(title),voltage:offer.voltage || productVoltage(title)});
  }

  return [...models].map(([id,rows]) => {
    const variesByColor = rows.some(row => row.color);
    const variesByVoltage = rows.some(row => row.voltage || voltageProduct.test(normalize(row.title)));
    const options = rows.map(row => {
      const labels = [];
      if (variesByColor) labels.push(row.color || 'Cor não informada');
      if (variesByVoltage) labels.push(row.voltage || 'Voltagem não informada');
      const label = labels.join(' · ');
      const complete = !!label && (!variesByColor || !!row.color) && (!variesByVoltage || !!row.voltage);
      return {
        ...row,
        variantLabel:label || 'Versão do anúncio',
        variantKnown:complete || !!row.gtin,
        variantKey:complete ? label : label + ':' + (row.gtin || row.url),
      };
    });
    const group = featured.find(product => id.startsWith('featured:' + product.id + ':'));
    let title = rows[0].title.split(' · ')[0];
    if (rows.length > 1 && variesByVoltage) title = title.replace(/\b(?:(?:110|127|220)\s*v|bivolt)\b/gi,'').replace(/\s+/g,' ').trim();
    if (new Set(rows.map(row => row.color)).size > 1) {
      const firstColor = rows[0].color;
      if (firstColor) title = title.replace(new RegExp('\\b' + firstColor.replace(/o$/i,'[oa]') + '\\b','gi'),'').replace(/\s+/g,' ').replace(/[\s,–-]+$/g,'');
    }
    return buildProductCard({
      id,title:group?.title || title,subtitle:group?.subtitle,
      category:group?.category || '',variant:'options',
    },options,normalize);
  }).filter(Boolean);
}
