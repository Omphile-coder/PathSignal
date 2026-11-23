import {createServer} from 'node:http'
import {readFile,realpath} from 'node:fs/promises'
import {dirname,join,resolve,sep,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'cache/browser-targeted')
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.wasm':'application/wasm','.onnx':'application/octet-stream','.bin':'application/octet-stream'}
createServer(async(req,res)=>{
  if(req.method!=='GET'){res.writeHead(405).end();return}
  try{
    const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname)
    const file=await realpath(join(root,name==='/'?'index.html':name))
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
    const data=await readFile(file)
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}).end(data)
  }catch{res.writeHead(404).end('Not found')}
}).listen(5192,'127.0.0.1',()=>console.log('Internal model check: http://127.0.0.1:5192'))
