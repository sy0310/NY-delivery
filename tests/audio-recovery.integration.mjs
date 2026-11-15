import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Inspect the actual published HUD around mute-all and explicit effects-only recovery.
const muted=await readFile(process.argv[2],'utf8');
const recovered=await readFile(process.argv[3],'utf8');
assert.match(muted,/Context suspended · music 0 environment 0 effects 0/);
assert.match(muted,/gain 0\.000/);
assert.match(recovered,/Context running · music 0 environment 0 effects 1/);
assert.match(recovered,/Audio 0\.00 s/);
assert.match(recovered,/Single player · paused/);
console.log('Actual recovery passed — all-muted graph suspended and effects resumed with BGM still paused');
