/* Optional localhost-only static server. Run: node design-preview/server.cjs */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname,port=Number(process.env.ALTO_PREVIEW_PORT||4174);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.stat(target,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(target).pipe(res);
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`ALTO preview: http://127.0.0.1:${port}/review.html\nDirect panel: http://127.0.0.1:${port}/#home`));
