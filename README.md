# Garimpo de Preços

Comparador brasileiro de ofertas com busca por produto, preços por loja, filtros e cupons. O front-end estático e as rotas HTTP rodam no Vercel.

## Desenvolvimento local

```sh
npm ci
npm run dev
```

Use Node.js 24. O servidor local abre em `http://localhost:3000`. O build gera o site e o service worker em `dist/`.

## Ativar alertas de cupons no Vercel

1. Importe este repositório no Vercel. Use o preset **Other** e mantenha o `vercel.json` do projeto.
2. Crie um banco PostgreSQL no Neon, execute [db/notifications.sql](db/notifications.sql) no SQL Editor e configure a conexão `DATABASE_URL` no Vercel.
3. Rode `npm run push:keys` uma vez em ambiente local. Guarde o par de chaves e cadastre `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`. Use `VAPID_SUBJECT` com um contato `mailto:` válido ou a URL HTTPS pública do projeto.
4. Gere um valor aleatório para `CRON_SECRET`, por exemplo com `openssl rand -hex 32`. Cadastre-o junto com as demais variáveis no ambiente **Production** e faça um novo deploy. Para testar inscrição em Preview, configure o banco e as chaves também nesse ambiente, de preferência com um banco separado.
5. Abra o site pelo domínio HTTPS definitivo, aceite o convite **Ativar alertas** e permita a notificação no navegador. **Alertas** permite rever a preferência e desativá-la. A inscrição pertence ao navegador e ao domínio. Em iOS, adicione o site à Tela de Início e abra por lá para inscrever-se em um dispositivo compatível.

Guarde `DATABASE_URL`, `VAPID_PRIVATE_KEY` e `CRON_SECRET` no Vercel. Preserve o par VAPID entre deploys, pois os navegadores se inscrevem com a chave pública original. As variáveis `SERPAPI_API_KEY` e `APISH_API_KEY` são opcionais e ampliam a cobertura de lojas na busca.

### Como o agendamento funciona

O Vercel chama `GET /api/cron/coupons` diariamente às **12h UTC** (9h em Brasília). O cron roda em produção. Em Hobby, o horário pode variar dentro da janela da hora. O endpoint exige `Authorization: Bearer <CRON_SECRET>`.

A primeira consulta não vazia de cada fonte vira a referência inicial. O cron registra os novos códigos por loja, ignora vencidos, agrupa as novidades em um alerta e remove inscrições expiradas. Cada execução processa até 60 inscrições pendentes. Falhas temporárias ficam para a execução seguinte. Abrir um alerta leva à aba **Descontos**.

Para uma verificação manual, chame a mesma rota com o segredo carregado de forma segura no ambiente local. A resposta retorna `added`, `sent`, `removed` e `failed`. Use um banco de teste se houver assinantes reais no ambiente de produção.

As fontes de cupons são as mesmas da aba **Descontos**. Links para páginas de lojas só geram alerta quando um código válido é identificado pela integração.
