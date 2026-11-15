import type { MusicPlayer } from './MusicPlayer';
import type { MusicSource, RepeatMode } from './Playlist';

/** Player-facing controls. User filenames are assigned only through textContent. */
export class MusicPanel {
  readonly element = document.createElement('section');
  private signature = '';
  constructor(private music: MusicPlayer) {
    this.element.className = 'music';
    this.element.innerHTML = `<div class="music-title"><span>ORCHARD RADIO</span><span id="music-time">00:00</span></div>
      <div id="track"></div><button id="play">播放 / 暂停</button><button id="previous">上一首</button><button id="next">下一首</button>
      <div class="music-details"><label>来源 <select id="music-source" aria-label="音乐来源"><option value="radio">游戏电台</option><option value="local">我的音乐</option><option value="external">使用外部播放器</option></select></label>
      <label>顺序 <select id="repeat" aria-label="播放顺序"><option value="list">列表循环</option><option value="one">单曲循环</option><option value="once">顺序播放一次</option></select></label>
      <div><button id="choose">追加 MP3 / WAV</button><button id="replace">替换本地歌单</button></div>
      <p class="music-note">从系统文件选择 MP3/WAV，仅在此设备播放，不上传。音乐 App 收藏和会员缓存需由相应 App 播放。请选择你有权播放的音频，公开录屏或直播时另行确认授权。刷新后需重新选取文件。</p>
      <div id="playlist" role="list" aria-label="当前歌单"></div>
      <label>音乐 <input id="volume" aria-label="音乐音量" type="range" min="0" max="1" step=".01" value=".55"></label>
      <label>环境 <input id="environment-volume" aria-label="环境音量" type="range" min="0" max="1" step=".01" value=".2"></label>
      <label>提示 <input id="effects-volume" aria-label="提示音量" type="range" min="0" max="1" step=".01" value=".45"></label>
      <div><label><input id="continuous" type="checkbox">持续聆听</label><span class="music-note">关闭时使用车载音箱，离车渐弱</span></div>
      <label><input id="recording-music" type="checkbox">录屏用音乐模式</label>
      <button id="mute-game">关闭全部游戏声音</button>
      <p class="music-note">录屏模式仅控制游戏自身音轨。外部播放器及系统录音由录屏工具控制。手机外部 App 共存尚待真机验证，可独立关闭三种声音。</p>
      <p id="music-message" role="status"></p></div>`;
    const on = (id: string, action: () => void) => this.element.querySelector('#' + id)!.addEventListener('click', action);
    on('play', () => this.music.toggle());
    on('previous', () => this.music.next(-1));
    on('next', () => this.music.next());
    on('choose', () => this.music.choose());
    on('replace', () => this.music.choose(true));
    on('mute-game', () => this.music.muteAll());
    this.input('music-source', 'change', value => this.music.source(value as MusicSource));
    this.input('repeat', 'change', value => this.music.repeat(value as RepeatMode));
    this.input('volume', 'input', value => this.music.volume(Number(value)));
    this.input('environment-volume', 'input', value => this.music.environmentVolume(Number(value)));
    this.input('effects-volume', 'input', value => this.music.effectsVolume(Number(value)));
    this.element.querySelector<HTMLInputElement>('#continuous')!.onchange = event => { this.music.continuous = (event.target as HTMLInputElement).checked; };
    this.element.querySelector<HTMLInputElement>('#recording-music')!.onchange = event => this.music.recording((event.target as HTMLInputElement).checked);
    this.element.addEventListener('pointerdown', event => event.stopPropagation());
  }
  private input(id: string, event: string, action: (value: string) => void): void {
    this.element.querySelector('#' + id)!.addEventListener(event, event => action((event.target as HTMLInputElement).value));
  }
  render(): void {
    const queue = this.music.playlist;
    const time = Math.floor(this.music.audio.currentTime || 0);
    this.text('music-time', String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0'));
    this.text('track', (queue.current?.name ?? '选择音乐') + ' · ' + this.music.state);
    this.text('music-message', this.music.message);
    (this.element.querySelector('#music-source') as HTMLSelectElement).value = queue.source;
    (this.element.querySelector('#repeat') as HTMLSelectElement).value = queue.repeat;
    (this.element.querySelector('#recording-music') as HTMLInputElement).checked = queue.recording;
    for (const [id, value] of [['volume',this.music.levels.music],['environment-volume',this.music.levels.environment],['effects-volume',this.music.levels.effects]]) {
      (this.element.querySelector('#'+id) as HTMLInputElement).value = String(value);
    }
    for (const id of ['choose', 'replace']) (this.element.querySelector('#' + id) as HTMLButtonElement).disabled = queue.recording;
    const signature = JSON.stringify([queue.source, queue.recording, queue.current?.id, queue.tracks.map(track => [track.id, track.failed])]);
    if (signature === this.signature) return;
    this.signature = signature;
    const list = this.element.querySelector('#playlist')!;
    list.replaceChildren();
    for (const track of queue.tracks) {
      const row = document.createElement('div');
      row.className = 'playlist-row';
      row.setAttribute('role', 'listitem');
      const select = document.createElement('button');
      select.textContent = (track.id === queue.current?.id ? '▶ ' : '') + track.name + (track.failed ? ' · 无法播放' : '');
      select.onclick = () => this.music.select(track.id);
      row.appendChild(select);
      if (track.local) {
        const remove = document.createElement('button');
        remove.textContent = '移除';
        remove.setAttribute('aria-label', '移除 ' + track.name);
        remove.onclick = () => this.music.remove(track.id);
        row.appendChild(remove);
      }
      list.appendChild(row);
    }
  }
  private text(id: string, text: string): void { this.element.querySelector('#' + id)!.textContent = text; }
}
