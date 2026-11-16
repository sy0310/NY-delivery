import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../game/assets/scripts/MusicPlayer.ts';

class Element extends EventTarget {
  paused = true;
  currentTime = 31;
  volume = 1;
  src = '';
  playCalls = 0;
  playGate = null;
  async play() {
    this.playCalls++;
    if(this.playGate) await this.playGate.promise;
    this.paused = false;
  }
  pause() {this.paused = true;}
  load() {}
  removeAttribute(name) {if(name==='src') this.src='';}
  getAttribute(name) {return name==='src' ? this.src : null;}
  remove() {}
}
const parameter = value => ({value,cancelScheduledValues(){},setValueAtTime(next){this.value=next;},setTargetAtTime(next){this.value=next;}});
class DeferredContext extends EventTarget {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 4;
  destination = {};
  resumeCalls = 0;
  suspendCalls = 0;
  gate = Promise.withResolvers();
  async resume() {
    this.resumeCalls++;
    await this.gate.promise;
    this.state='running';this.dispatchEvent(new Event('statechange'));
  }
  async suspend() {this.suspendCalls++;this.state='suspended';this.dispatchEvent(new Event('statechange'));}
  async close() {this.state='closed';}
  createGain() {return {gain:parameter(0),connect(){}};}
  createMediaStreamDestination() {return {};}
  createMediaElementSource() {return {connect(){}};}
  createBuffer(channels,length) {return {getChannelData(){return new Float32Array(length);}};}
  createBufferSource() {return {connect(){},start(){},stop(){}};}
}
async function flush() {for(let tick=0;tick<12;tick++) await Promise.resolve();}
function fixture(t) {
  const previous = new Map(['Audio','AudioContext','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const document = new EventTarget();
  document.body={appendChild(){}};
  document.createElement=()=>new Element();
  Object.assign(globalThis,{Audio:Element,AudioContext:DeferredContext,document});
  const player=new MusicPlayer();player.setDemo('/original.mp3');
  t.after(()=>{
    player.dispose();
    for(const [key,descriptor] of previous) {
      if(descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });
  return player;
}
function assertMuted(player,wanted) {
  assert.deepEqual(player.levels,{music:0,environment:0,effects:0});
  assert.equal(player.context.state,'suspended');
  assert.equal(player.audio.paused,true);
  assert.equal(player.playlist.wantsPlayback,wanted);
  assert.equal(player.audio.currentTime,31);
  assert.equal(player.playlist.current.id,'evening');
  assert.equal(player.message,'全部游戏声音已关闭，可在外部 App 中自行播放');
  assert.equal(player.needsResume,false);
}

test('play awaiting context resume cannot override a later mute-all',async t=>{
  const player=fixture(t),pending=player.play();
  await flush();assert.equal(player.context.resumeCalls,1);
  player.muteAll();player.context.gate.resolve();await pending;await flush();
  assertMuted(player,true);
});
test('explicit sound recovery awaiting resume preserves a later mute and pause intent',async t=>{
  const player=fixture(t),pending=player.resumeSound();
  await flush();assert.equal(player.context.resumeCalls,1);
  player.muteAll();player.context.gate.resolve();await pending;await flush();
  assertMuted(player,false);
});
test('the first gesture recovery rechecks mute-all after its deferred resume',async t=>{
  const player=fixture(t);
  document.dispatchEvent(new Event('pointerdown'));await flush();
  assert.equal(player.context.resumeCalls,1);
  player.muteAll();player.context.gate.resolve();await flush();
  assertMuted(player,false);
});
test('effects-only recovery retains the paused music element and original playback intent',async t=>{
  const player=fixture(t),pending=player.play();await flush();
  player.muteAll();player.context.gate.resolve();await pending;await flush();
  player.effectsVolume(.4);await player.resumeSound();await flush();
  assert.equal(player.context.state,'running');
  assert.equal(player.audio.paused,true);
  assert.equal(player.playlist.wantsPlayback,true);
  assert.equal(player.audio.playCalls,0);
  assert.equal(player.needsResume,false);
});
test('mute-all wins even when the media play promise completes after context recovery',async t=>{
  const player=fixture(t),recovery=player.resumeSound();await flush();
  player.context.gate.resolve();await recovery;
  player.audio.playGate=Promise.withResolvers();
  const pending=player.play();await flush();assert.equal(player.audio.playCalls,1);
  player.muteAll();player.audio.playGate.resolve();await pending;await flush();
  assertMuted(player,true);
});
test('explicit recovery waiting for media playback preserves the later all-muted message',async t=>{
  const player=fixture(t),starting=player.play();await flush();
  player.context.gate.resolve();await starting;
  player.audio.pause();player.audio.playGate=Promise.withResolvers();
  const pending=player.resumeSound();await flush();
  assert.equal(player.audio.playCalls,2);
  player.muteAll();player.audio.playGate.resolve();await pending;await flush();
  assertMuted(player,true);
});
test('overlapping old recovery and a new effects-only request finish in the latest policy',async t=>{
  const player=fixture(t),pending=player.play();await flush();
  player.muteAll();player.effectsVolume(.4);
  const recovery=player.resumeSound();
  player.context.gate.resolve();await Promise.all([pending,recovery]);await flush();
  assert.equal(player.context.state,'running');
  assert.equal(player.audio.paused,true);
  assert.equal(player.playlist.wantsPlayback,true);
  assert.equal(player.audio.currentTime,31);
});
