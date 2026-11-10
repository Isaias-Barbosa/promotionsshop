export const stores = [
  ['amazon','Amazon','a.','#ffe8c8','#754007','https://www.amazon.com.br/s?k={q}','https://www.amazon.com.br/coupons','Cupom','Cupons por produto','Consulte os itens elegíveis e ative o desconto na Amazon.'],
  ['meli','Mercado Livre','ML','#fff4ad','#604d03','https://lista.mercadolivre.com.br/{slug}','https://www.mercadolivre.com.br/l/cupons-todos-os-dias','Cupom','Central de cupons','Consulte os cupons e as regras de resgate da sua conta.'],
  ['casas','Casas Bahia','CB','#dcecff','#164f9b','https://www.casasbahia.com.br/{slug}/b','https://www.casasbahia.com.br/c?Filtro=D77622&Ordenacao=maisVendidos','Cupom','Cupons da Casas Bahia','Consulte os produtos participantes e as condições do cupom na loja.'],
  ['americanas','Americanas','A','#ffe0e5','#a60931','https://www.americanas.com.br/s?q={q}','https://www.americanas.com.br/especial/cupom-de-desconto-americanas?chave=dk_hm_ats_2_6_cuponeria','Cupom','Central de cupons','Confira as condições e os códigos divulgados pela Americanas.'],
  ['magalu','Magalu','M','#d9edff','#0955a1','https://www.magazineluiza.com.br/busca/{q}/','https://especiais.magazineluiza.com.br/cupom-de-desconto/','Cupom','Cupons Magalu','Consulte as campanhas do site e os produtos participantes.'],
  ['havan','Havan','H','#dfeafa','#10488f','https://www.havan.com.br/catalogsearch/result/?q={q}','https://www.havan.com.br/promo/','Promoção','Promoções Havan','Veja a seleção promocional e confira as condições de entrega.'],
  ['carrefour','Carrefour','C','#dcefff','#15579e','https://mercado.carrefour.com.br/s?q={q}','https://mercado.carrefour.com.br/cupons','Cupom','Cupons Carrefour Mercado','Consulte códigos e valor mínimo por categoria.'],
  ['assai','Assaí','AS','#ffe7cb','#8b370e',null,'https://www.assai.com.br/ofertas','Encarte','Jornal de ofertas Assaí','Escolha a loja da sua região para conferir o encarte.'],
  ['atacadao','Atacadão','AT','#e2f4cc','#31651a',null,'https://www.atacadao.com.br/loja/brasilia-asa-norte','Encarte','Encarte de Brasília · Asa Norte','Veja folhetos e datas na unidade. Confira outras lojas no site.'],
  ['kabum','KaBuM!','K!','#ffeadc','#9c3a0a','https://www.kabum.com.br/busca/{slug}','https://www.kabum.com.br/hotsite/cupons/','Cupom','Cupons KaBuM!','Consulte os códigos, os produtos elegíveis e as condições de uso na loja.'],
].map(([id,name,mark,bg,color,search,url,kind,title,description]) => ({id,name,mark,bg,color,search,url,kind,title,description}));

export const searchStores = [
  {id:'ponto',name:'Ponto Frio',mark:'PF',bg:'#ffe0e5',color:'#a60931',search:'https://www.pontofrio.com.br/{slug}/b'},
  {id:'casaevideo',name:'Casa&Video',mark:'CV',bg:'#ffe9dc',color:'#8b370e',search:'https://www.casaevideo.com.br/{q}?map=ft',catalog:'https://www.casaevideo.com.br',intelligent:true},
  {id:'lebiscuit',name:'Le Biscuit',mark:'LB',bg:'#ffe5e6',color:'#a60931',search:'https://www.lebiscuit.com.br/{q}?map=ft',catalog:'https://www.lebiscuit.com.br',intelligent:true},
  {id:'camicado',name:'Camicado',mark:'CA',bg:'#eee7ff',color:'#371d75',search:'https://www.camicado.com.br/busca?q={q}',catalog:'https://www.camicado.com.br',intelligent:true},
  {id:'fastshop',name:'Fast Shop',mark:'FS',bg:'#e1ebf2',color:'#23425b',search:'https://www.fastshop.com.br/{q}?map=ft',catalog:'https://www.fastshop.com.br',intelligent:true},
  {id:'philco',name:'Philco',mark:'PH',bg:'#e1ebf2',color:'#23425b',search:'https://www.philco.com.br/{q}?map=ft',catalog:'https://www.philco.com.br'},
  {id:'electrolux',name:'Electrolux',mark:'EL',bg:'#dfeafa',color:'#10488f',search:'https://loja.electrolux.com.br/{q}?map=ft',catalog:'https://loja.electrolux.com.br'},
  {id:'mondial',name:'Mondial',mark:'MO',bg:'#ffe9dc',color:'#8b370e',search:'https://www.mondial.com.br/{q}?map=ft',catalog:'https://www.mondial.com.br',intelligent:true},
  {id:'brastemp',name:'Brastemp',mark:'BR',bg:'#ffe9dc',color:'#8b370e',search:'https://www.brastemp.com.br/{q}?map=ft',catalog:'https://www.brastemp.com.br',intelligent:true},
];

export const seedCoupons = [{
  store: 'americanas', code: 'VEMPROAPP15', title: 'R$ 15 de desconto no app',
  description: 'Compras acima de R$ 100. Para primeira compra ou clientes sem compras há mais de 12 meses. Consulte as exclusões.',
  expires: '2026-12-01T02:59:59Z', checked: '2026-11-09',
}];
