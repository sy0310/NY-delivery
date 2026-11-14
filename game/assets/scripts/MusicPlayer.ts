/** One HTMLAudioElement across every vehicle and walking transition. */
export class MusicPlayer {
  readonly audio = new Audio();
  readonly picker = document.createElement('input');
  context: AudioContext | null = null;
  capture: MediaStreamAudioDestinationNode | null = null;
  private gain: GainNode | null = null;
  private tracks: { name: string; url: string; local: boolean }[] = [];
  private index = 0;
  private userVolume = .55;
  private targetGain = .55;
  private duckUntil = 0;
  continuous = false;
  message = '演示曲目载入中';
  get effectiveVolume(): number { return this.gain?.gain.value ?? this.audio.volume; }

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.picker.type = 'file';
    this.picker.accept = '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav';
    this.picker.multiple = true;
    this.picker.hidden = true;
    document.body.appendChild(this.picker);
    this.picker.addEventListener('change', () => {
      const files = Array.from(this.picker.files || []);
      if (!files.length) return;
      for (const track of this.tracks.filter(t => t.local)) URL.revokeObjectURL(track.url);
      this.tracks = this.tracks.filter(t => !t.local);
      this.index = this.tracks.length;
      this.tracks.push(...files.map(file => ({ name: file.name, url: URL.createObjectURL(file), local: true })));
      this.picker.value = '';
      this.loadCurrent();
    });
    this.picker.addEventListener('cancel', () => { this.message = '已取消选曲，继续当前曲目'; });
    this.audio.addEventListener('error', () => { this.message = '无法播放该文件，请重新选 MP3 / WAV 或切回演示曲'; });
  }

  setDemo(url: string): void {
    this.tracks.unshift({ name: 'Evening on Orchard · Original demo', url, local: false });
    if (!this.audio.src) this.audio.src = url;
    this.message = '演示曲已就绪，点击播放或选择本地歌曲';
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.userVolume;
      this.capture = this.context.createMediaStreamDestination();
      this.context.createMediaElementSource(this.audio).connect(this.gain);
      this.gain.connect(this.context.destination);
      this.gain.connect(this.capture);
    }
    void this.context.resume();
  }

  async play(): Promise<void> {
    this.unlock();
    try {
      await this.audio.play();
      this.message = this.tracks[this.index]?.name || '正在播放';
    } catch {
      this.message = '播放未开始，请选一首有效曲目后再次点击播放';
    }
  }

  toggle(): void {
    if (this.audio.paused) void this.play();
    else this.audio.pause();
  }

  choose(): void {
    this.unlock();
    this.picker.click();
  }

  next(): void {
    if (!this.tracks.length) return;
    this.index = (this.index + 1) % this.tracks.length;
    this.loadCurrent();
  }

  private loadCurrent(): void {
    this.audio.src = this.tracks[this.index].url;
    this.audio.load();
    void this.play();
  }

  volume(value: number): void { this.userVolume = Math.max(0, Math.min(1, value)); }

  update(inCar: boolean, distance: number): void {
    const spatial = inCar || this.continuous ? 1 : Math.max(.08, 1 / (1 + distance * .35));
    this.targetGain = this.userVolume * spatial * (performance.now() < this.duckUntil ? .24 : 1);
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.targetGain, this.context.currentTime, .18);
    else this.audio.volume = this.targetGain;
  }

  chime(): void {
    if (!this.context || !this.capture) return;
    this.duckUntil = performance.now() + 1400;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, this.context.currentTime);
    oscillator.frequency.setValueAtTime(880, this.context.currentTime + .12);
    gain.gain.setValueAtTime(.08, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + .45);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    gain.connect(this.capture);
    oscillator.start();
    oscillator.stop(this.context.currentTime + .5);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  dispose(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.picker.remove();
    for (const track of this.tracks.filter(t => t.local)) URL.revokeObjectURL(track.url);
    void this.context?.close();
  }
}
