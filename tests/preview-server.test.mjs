import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

test('explicit LAN entry serves only a stamped published build and reports the actual ephemeral port',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'ny-preview-'));
  await mkdir(join(directory,'src'));
  await Promise.all([
    writeFile(join(directory,'index.html'),'Published game'),
    writeFile(join(directory,'application.js'),'// published entry'),
    writeFile(join(directory,'src/settings.json'),'{}'),
    writeFile(join(directory,'build-info.json'),JSON.stringify({commit:'abc123test',dirty:false})),
  ]);
  const child=spawn('python3',['scripts/serve.py','--lan','--port','0','--directory',directory]);
  try {
    const output=await new Promise((resolve,reject)=>{
      let text='';
      const timeout=setTimeout(()=>reject(new Error('Preview did not become ready')),5000);
      child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('就绪')){clearTimeout(timeout);resolve(text)}});
      child.on('exit',code=>{clearTimeout(timeout);reject(new Error('LAN preview exited '+code+' '+text))});
    });
    const url=output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
    assert.ok(url,'show a usable local URL with the bound port');
    assert.match(output,/abc123test/);
    const response=await fetch(url[0]);
    assert.equal(await response.text(),'Published game');
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal((await fetch(url[0]+'.git/config')).status,404);
  } finally {
    child.kill('SIGINT');
    await rm(directory,{recursive:true,force:true});
  }
});
