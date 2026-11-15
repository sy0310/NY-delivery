export type MusicSource = 'radio' | 'local' | 'external';
export type RepeatMode = 'list' | 'one' | 'once';
export interface Track {
  id: string;
  name: string;
  url: string;
  local: boolean;
  recordable: boolean;
  failed?: boolean;
}

/** In-memory selection and URL ownership, independent of browser audio timing. */
export class Playlist {
  private radio: Track[] = [];
  private local: Track[] = [];
  private selected = {radio: '', local: ''};
  private activeSource: MusicSource = 'radio';
  private savedSource: MusicSource = 'radio';
  recording = false;
  repeat: RepeatMode = 'list';
  wantsPlayback = false;

  get source(): MusicSource { return this.activeSource; }
  get tracks(): readonly Track[] {
    if (this.activeSource === 'external') return [];
    if (this.activeSource === 'local') return this.recording ? [] : this.local;
    return this.recording ? this.radio.filter(track => track.recordable) : this.radio;
  }
  get current(): Track | undefined {
    if (this.activeSource === 'external') return undefined;
    return this.tracks.find(track => track.id === this.selected[this.activeSource]) ?? this.tracks[0];
  }
  get localURLs(): string[] { return [...new Set(this.local.map(track => track.url))]; }

  registerRadio(tracks: Track[]): void {
    for (const track of tracks) if (!this.radio.some(existing => existing.id === track.id)) this.radio.push({...track});
  }
  append(tracks: Track[]): void { this.local.push(...tracks.map(track => ({...track}))); }
  replace(tracks: Track[]): string[] {
    const previous = this.localURLs;
    this.local = tracks.map(track => ({...track}));
    return previous.filter(url => !this.localURLs.includes(url));
  }
  remove(id: string): string[] { return this.replace(this.local.filter(track => track.id !== id)); }
  setSource(source: MusicSource): boolean {
    if (this.recording && source === 'local') return false;
    this.activeSource = source;
    if (source === 'external') this.wantsPlayback = false;
    return true;
  }
  select(id: string): boolean {
    if (this.activeSource === 'external' || !this.tracks.some(track => track.id === id)) return false;
    this.selected[this.activeSource] = id;
    const current = this.current;
    if (current) current.failed = false;
    return true;
  }
  next(direction = 1): void {
    const tracks = this.tracks;
    if (!tracks.length) { this.wantsPlayback = false; return; }
    const index = tracks.findIndex(track => track.id === this.current?.id);
    this.select(tracks[(index + direction + tracks.length) % tracks.length].id);
  }
  ended(): void {
    if (this.repeat === 'one') return;
    const index = this.tracks.findIndex(track => track.id === this.current?.id);
    if (this.repeat === 'once' && index === this.tracks.length - 1) { this.wantsPlayback = false; return; }
    this.next();
  }
  failCurrent(): void {
    const current = this.current;
    if (current) current.failed = true;
    const tracks = this.tracks;
    const index = tracks.findIndex(track => track.id === current?.id);
    for (let offset = 1; offset <= tracks.length; offset++) {
      const candidate = tracks[(index + offset) % tracks.length];
      if (!candidate.failed) { this.select(candidate.id); return; }
    }
    this.wantsPlayback = false;
  }
  setRecording(enabled: boolean): void {
    if (this.recording === enabled) return;
    this.recording = enabled;
    if (enabled) {
      this.savedSource = this.activeSource;
      if (this.activeSource === 'local') this.activeSource = 'radio';
    } else this.activeSource = this.savedSource;
  }
}
