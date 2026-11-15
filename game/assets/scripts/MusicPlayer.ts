import { Playlist } from './Playlist';
import type { MusicSource, RepeatMode } from './Playlist';

/** One persistent element. Local files and selections live only in this page. */
export class MusicPlayer {
  readonly audio = new Audio();
  readonly picker = document.createElement('input');
  readonly playlist = new Playlist();
  context: AudioContext | null = null;
  capture: MediaStreamAudioDestinationNode | null = null;
  private gain: GainNode | null = null;
  private effects: GainNode | null = null;
  private ambient: GainNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private loaded = '';
  private revision = 0;
  private listeners: AbortController | null = null;
  private fileSequence = 0;
  private replaceOnChoose = false;
  private userVolume = .55;
  private effectVolume = .45;
  private ambientVolume = .2;
  private spatial = 1;
  private duckTimer: ReturnType<typeof setTimeout> | undefined;
  private restore: {source: MusicSource; id: string; time: number} | null = null;
  continuous = false;
  message = '电台载入中，可静音出发';
  get effectiveVolume(): number { return this.gain?.gain.value ?? this.audio.volume; }
  get state(): string {
    if (this.playlist.source === 'external') return '外部播放器 · 游戏音乐已关闭';
    if (!this.playlist.current) return '歌单为空';
    if (this.playlist.current.failed) return '播放失败';
    return this.audio.paused ? '已暂停' : '播放中';
  }

  constructor() {
    this.audio.loop = false;
    this.audio.preload = 'metadata';
    this.picker.type = 'file';
    this.picker.accept = '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav';
    this.picker.multiple = true;
    this.picker.hidden = true;
    document.body.appendChild(this.picker);
    this.picker.addEventListener('change', () => {
      const files = Array.from(this.picker.files || []);
      this.picker.value = '';
      if (!files.length || this.playlist.recording) return;
      const tracks = files.map(file => ({id: 'local-' + ++this.fileSequence, name: file.name,
        url: URL.createObjectURL(file), local: true, recordable: false}));
      const retired = this.replaceOnChoose ? this.playlist.replace(tracks) : [];
      if (!this.replaceOnChoose) this.playlist.append(tracks);
      this.sync();
      this.release(retired);
      this.message = '已' + (this.replaceOnChoose ? '替换' : '追加') + '本地歌单，选择“我的音乐”收听。刷新后需重新选择文件。';
    });
    this.picker.addEventListener('cancel', () => { this.message = '已取消选曲，当前播放保持'; });
  }

  setDemo(url: string, id = 'evening', name = 'Evening on Orchard'): void {
    this.playlist.registerRadio([{id, name, url, local:false, recordable:true}]);
    this.sync();
  }

  private unlock(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.capture = this.context.createMediaStreamDestination();
    this.gain = this.bus(this.userVolume);
    this.effects = this.bus(this.effectVolume);
    this.ambient = this.bus(0);
    this.context.createMediaElementSource(this.audio).connect(this.gain);
    this.audio.volume = 1;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < samples.length; index++) {
      last = last * .97 + (Math.random() * 2 - 1) * .015;
      samples[index] = last;
    }
    this.noise = this.context.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noise.connect(this.ambient);
    this.noise.start();
  }

  private bus(volume: number): GainNode {
    const gain = this.context!.createGain();
    gain.gain.value = volume;
    gain.connect(this.context!.destination);
    gain.connect(this.capture!);
    return gain;
  }

  async play(): Promise<void> {
    if (!this.playlist.current || this.playlist.source === 'external') {
      this.message = this.playlist.source === 'external' ? '请在外部音乐 App 中自行播放' : '请选择可用歌单';
      return;
    }
    this.playlist.current.failed = false;
    this.playlist.wantsPlayback = false;
    this.sync();
    this.playlist.wantsPlayback = true;
    await this.playCurrent(this.revision);
  }

  private async playCurrent(revision: number): Promise<void> {
    try {
      this.unlock();
      await this.context!.resume();
      if (revision !== this.revision || !this.playlist.wantsPlayback) return;
      await this.audio.play();
      if (revision !== this.revision) return;
      if (!this.playlist.wantsPlayback) this.audio.pause();
      else this.message = this.playlist.current?.name ?? '正在播放';
    } catch {
      if (revision === this.revision) this.message = '播放尚未开始，请点击播放重试或切换曲目';
    }
  }

  toggle(): void {
    if (this.audio.paused) void this.play();
    else { this.playlist.wantsPlayback = false; this.audio.pause(); }
  }
  choose(replace = false): void {
    if (this.playlist.recording) { this.message = '录屏模式使用已确认电台曲目，本地歌单已保留'; return; }
    this.replaceOnChoose = replace;
    this.picker.click();
  }
  source(source: MusicSource): void {
    if (!this.playlist.setSource(source)) return;
    this.sync();
    if (source === 'external') this.message = '内部 BGM 已关闭。请自行开启外部 App，手机共存需真机验证。';
  }
  next(direction = 1): void { this.playlist.next(direction); this.sync(true); }
  select(id: string): void { if (this.playlist.select(id)) this.sync(true); }
  remove(id: string): void { const retired = this.playlist.remove(id); this.sync(); this.release(retired); }
  repeat(mode: RepeatMode): void { this.playlist.repeat = mode; }
  recording(enabled: boolean): void {
    if (enabled === this.playlist.recording) return;
    if (enabled) this.restore = {source:this.playlist.source, id:this.playlist.current?.id ?? '', time:this.audio.currentTime || 0};
    this.playlist.setRecording(enabled);
    const restore = !enabled ? this.restore : null;
    if (restore && this.playlist.source === restore.source) this.playlist.select(restore.id);
    this.sync(Boolean(restore), restore?.time);
    if (!enabled) this.restore = null;
    this.message = enabled ? '录屏模式 · 仅使用项目原创电台或静音。外部与系统声音由录屏工具控制。' : '已恢复此前歌单，播放选择保持';
  }

  private sync(force = false, time = 0): void {
    const track = this.playlist.current;
    if (!force && this.loaded === (track?.id ?? '')) return;
    this.listeners?.abort();
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    const revision = ++this.revision;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.loaded = track?.id ?? '';
    if (!track) { this.message = this.state; return; }
    this.audio.src = track.url;
    const expectedURL = this.audio.src;
    const current = () => revision === this.revision && this.playlist.current?.id === track.id;
    this.audio.addEventListener('loadedmetadata', () => {
      if (current() && time > 0 && Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.min(time, Math.max(0, this.audio.duration - .05));
    }, {signal, once:true});
    this.audio.addEventListener('ended', () => {
      if (!current()) return;
      this.playlist.ended();
      if (this.playlist.wantsPlayback) this.sync(true);
    }, {signal});
    this.audio.addEventListener('error', () => {
      if (!current() || (this.audio.currentSrc && this.audio.currentSrc !== expectedURL)) return;
      const wanted = this.playlist.wantsPlayback;
      this.playlist.failCurrent();
      this.message = '曲目无法播放，已标记。可切换电台或重新选择 MP3 / WAV。';
      if (wanted && this.playlist.wantsPlayback) this.sync();
    }, {signal});
    this.audio.load();
    this.message = track.name;
    if (this.playlist.wantsPlayback) void this.playCurrent(revision);
  }

  private release(urls: string[]): void {
    for (const url of urls) if (!this.playlist.localURLs.includes(url) && this.audio.getAttribute('src') !== url) URL.revokeObjectURL(url);
  }
  volume(value: number): void {
    this.userVolume = Math.max(0, Math.min(1, value));
    clearTimeout(this.duckTimer);
    this.duckTimer = undefined;
    if (this.gain && this.context) this.gain.gain.cancelScheduledValues(this.context.currentTime);
    this.mix();
  }
  effectsVolume(value: number): void {
    this.effectVolume = Math.max(0, Math.min(1, value));
    if (this.effects) this.effects.gain.value = this.effectVolume;
  }
  environmentVolume(value: number): void { this.ambientVolume = Math.max(0, Math.min(1, value)); }
  update(inCar: boolean, distance: number, speed = 0): void {
    this.spatial = inCar || this.continuous ? 1 : Math.max(.08, 1 / (1 + distance * .35));
    this.mix();
    if (this.ambient && this.context) this.ambient.gain.setTargetAtTime(this.ambientVolume * (inCar ? .2 + Math.abs(speed) * .05 : .15), this.context.currentTime, .3);
  }
  private mix(): void {
    const target = this.userVolume * this.spatial;
    if (this.gain && this.context) {
      if (!this.duckTimer) this.gain.gain.setTargetAtTime(target, this.context.currentTime, .12);
    } else this.audio.volume = target;
  }
  chime(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    if (this.gain) {
      clearTimeout(this.duckTimer);
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.userVolume * this.spatial * .78, now, .035);
      this.gain.gain.setTargetAtTime(this.userVolume * this.spatial, now + .28, .08);
      this.duckTimer = setTimeout(() => { this.duckTimer = undefined; this.mix(); }, 380);
    }
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.setValueAtTime(880, now + .1);
    envelope.gain.setValueAtTime(.07, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + .3);
    oscillator.connect(envelope);
    envelope.connect(this.effects);
    oscillator.start();
    oscillator.stop(now + .35);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  dispose(): void {
    this.listeners?.abort();
    ++this.revision;
    clearTimeout(this.duckTimer);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.picker.remove();
    this.noise?.stop();
    for (const url of this.playlist.localURLs) URL.revokeObjectURL(url);
    void this.context?.close();
  }
}
