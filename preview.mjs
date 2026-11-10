import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import catalog from './src/worker.mjs';
import { handlePush, handleCouponCron } from './src/push.mjs';

const portArg = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArg >= 0 && process.argv[portArg + 1]) || 3000);
const files = {
  '/':['index.html','text/html; charset=utf-8'],
  '/sw.js':['sw.js','text/javascript; charset=utf-8'],
  '/push-icon.svg':['push-icon.svg','image/svg+xml'],
};
createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://' + req.headers.host);
    const file = files[url.pathname];
    if (req.method === 'GET' && file) {
      res.writeHead(200,{'Content-Type':file[1]});
      res.end(await readFile(new URL('./dist/' + file[0],import.meta.url)));
      return;
    }
    const request = new Request(url,{method:req.method,headers:req.headers,
      ...(['GET','HEAD'].includes(req.method) ? {} : {body:req,duplex:'half'}),
    });
    const handler = url.pathname === '/api/push' ? handlePush
      : url.pathname === '/api/cron/coupons' ? handleCouponCron : request => catalog.fetch(request,process.env);
    const reply = await handler(request);
    res.writeHead(reply.status,Object.fromEntries(reply.headers));
    res.end(Buffer.from(await reply.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Erro interno');
  }
}).listen(port,'0.0.0.0');
