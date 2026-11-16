import type { MusicPlayer } from './MusicPlayer';
import type { MusicSource, RepeatMode } from './Playlist';
/** Three source-specific views share the persistent player and its existing file picker. */
export class MusicPanel {
    readonly element = document.createElement('section');
    private signature = '';
    constructor(private music: MusicPlayer, close: () => void = () => { }) {
        this.element.className = 'music';
        this.element.setAttribute('aria-label', '音乐');
        this.element.innerHTML = `<header class="music-header"><h2>音乐</h2></header>
      <div class="music-sources" role="tablist" aria-label="音乐来源">
        <button role="tab" data-source="radio">游戏电台</button><button role="tab" data-source="local">本地歌曲</button><button role="tab" data-source="external">外部音乐</button>
      </div><div class="music-body">
      <section id="internal-player"><div class="music-title"><span id="source-name">游戏电台</span><span id="music-time">00:00</span></div>
        <div id="track"></div><div class="music-transport"><button id="previous">上一首</button><button id="play">播放 / 暂停</button><button id="next">下一首</button></div>
        <label class="music-volume">音乐音量 <input id="volume" aria-label="音乐音量" type="range" min="0" max="1" step=".01" value=".55"></label>
        <section id="local-import" hidden><button id="choose" class="music-primary">从手机文件选择 MP3/WAV</button>
          <p class="music-note">歌曲留在当前设备，刷新后重新选择。音乐 App 的会员下载请在对应 App 播放。</p>
          <details><summary>更多歌单操作</summary><button id="append">追加歌曲</button><button id="replace">替换本地歌单</button></details>
        </section><details id="playlist-details"><summary id="playlist-summary">电台曲目</summary><div id="playlist" role="list" aria-label="当前歌单"></div></details>
      </section>
      <section id="external-player" hidden><h3>在音乐 App 中选择与播放</h3>
        <p class="music-note">Apple Music、QQ音乐、网易云音乐、Spotify 等曲库的选曲、播放与进度由对应 App 管理。</p>
        <div class="external-mix"><label><input type="radio" name="external-mix" id="external-effects" checked>仅保留提示/环境音</label><label><input type="radio" name="external-mix" id="external-silent">游戏完全静音</label></div>
        <button id="external-prepare" class="music-primary">关闭游戏背景音乐，去音乐 App 播放</button>
        <ol class="external-steps"><li>点上方按钮，应用所选游戏声音方案。</li><li>用手机最近任务或主屏幕打开音乐 App，选曲并播放。</li><li>切回 TapTap，点下方返回按钮。遇到声音中断时，可选择游戏完全静音。</li></ol>
        <button id="external-return">我已在外部 App 播放，返回游戏</button>
      </section>
      <details class="music-settings"><summary>声音与播放设置</summary>
        <div id="internal-settings"><label>播放顺序 <select id="repeat" aria-label="播放顺序"><option value="list">列表循环</option><option value="one">单曲循环</option><option value="once">顺序播放一次</option></select></label>
          <label><input id="continuous" type="checkbox">持续聆听</label><p class="music-note">关闭时使用车载音箱，离车渐弱。</p></div>
        <label>环境音 <input id="environment-volume" aria-label="环境音量" type="range" min="0" max="1" step=".01" value=".2"></label>
        <label>提示音 <input id="effects-volume" aria-label="提示音量" type="range" min="0" max="1" step=".01" value=".45"></label>
        <label><input id="recording-music" type="checkbox">录屏用音乐模式</label>
        <p class="music-note">录屏模式使用原创游戏电台或游戏音乐静音。外部 App 的声音由系统录屏设置管理。公开分享自选歌曲时请确认录音授权。</p>
        <button id="mute-game">关闭全部游戏声音</button>
      </details><p id="music-message" class="music-note" role="status"></p><button id="music-recover" hidden>恢复游戏声音</button>
      </div><footer><button id="music-close">返回游戏</button></footer>`;
        const on = (id: string, action: () => void) => this.element.querySelector('#' + id)!.addEventListener('click', action);
        this.element.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(button => button.onclick = () => {
            this.music.source(button.dataset.source as MusicSource);
            this.render();
        });
        on('play', () => this.music.toggle());
        on('previous', () => this.music.next(-1));
        on('next', () => this.music.next());
        on('choose', () => this.music.choose());
        on('append', () => this.music.choose());
        on('replace', () => this.music.choose(true));
        on('mute-game', () => this.music.muteAll());
        on('music-recover', () => { void this.music.resumeSound(); });
        on('music-close', close);
        on('external-return', close);
        on('external-prepare', () => this.music.externalAudio(this.control<HTMLInputElement>('external-silent').checked ? 'silent' : 'effects'));
        this.control<HTMLInputElement>('external-effects').onchange = () => this.music.externalAudio('effects');
        this.control<HTMLInputElement>('external-silent').onchange = () => this.music.externalAudio('silent');
        this.input('repeat', 'change', value => this.music.repeat(value as RepeatMode));
        this.input('volume', 'input', value => this.music.volume(Number(value)));
        this.input('environment-volume', 'input', value => this.music.environmentVolume(Number(value)));
        this.input('effects-volume', 'input', value => this.music.effectsVolume(Number(value)));
        this.control<HTMLInputElement>('continuous').onchange = event => { this.music.continuous = (event.target as HTMLInputElement).checked; };
        this.control<HTMLInputElement>('recording-music').onchange = event => this.music.recording((event.target as HTMLInputElement).checked);
        this.element.addEventListener('pointerdown', event => event.stopPropagation());
    }
    private control<T extends HTMLElement>(id: string): T { return this.element.querySelector<T>('#' + id)!; }
    private input(id: string, event: string, action: (value: string) => void): void {
        this.control(id).addEventListener(event, event => action((event.target as HTMLInputElement).value));
    }
    render(): void {
        const queue = this.music.playlist, external = queue.source === 'external', local = queue.source === 'local';
        if (this.element.dataset.source !== queue.source) {
            this.control<HTMLDetailsElement>('playlist-details').open = local;
            this.element.querySelector('.music-body')!.scrollTop = 0;
        }
        this.element.dataset.source = queue.source;
        this.control('internal-player').hidden = external;
        this.control('external-player').hidden = !external;
        this.control('local-import').hidden = !local;
        this.control('internal-settings').hidden = external;
        this.element.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(button => {
            button.setAttribute('aria-selected', String(button.dataset.source === queue.source));
            button.disabled = queue.recording && button.dataset.source === 'local';
        });
        const time = Math.floor(this.music.audio.currentTime || 0);
        this.control('music-time').textContent = String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');
        this.control('source-name').textContent = local ? '本地歌曲' : '游戏电台';
        this.control('track').textContent = (queue.current?.name ?? '选择歌曲') + ' · ' + this.music.state;
        this.control('music-message').textContent = this.music.message;
        this.control('playlist-summary').textContent = (local ? '当前歌单' : '电台曲目') + ' · ' + queue.tracks.length;
        this.control<HTMLSelectElement>('repeat').value = queue.repeat;
        this.control<HTMLInputElement>('continuous').checked = this.music.continuous;
        this.control<HTMLInputElement>('recording-music').checked = queue.recording;
        for (const [id, value] of [['volume', this.music.levels.music], ['environment-volume', this.music.levels.environment], ['effects-volume', this.music.levels.effects]]) {
            this.control<HTMLInputElement>(String(id)).value = String(value);
        }
        this.control<HTMLInputElement>('external-silent').checked = this.music.levels.environment === 0 && this.music.levels.effects === 0;
        this.control<HTMLInputElement>('external-effects').checked = !this.control<HTMLInputElement>('external-silent').checked;
        this.control('music-recover').hidden = !this.music.needsResume;
        for (const id of ['choose', 'append', 'replace'])
            this.control<HTMLButtonElement>(id).disabled = queue.recording;
        const signature = JSON.stringify([queue.source, queue.recording, queue.current?.id, queue.tracks.map(track => [track.id, track.failed])]);
        if (signature === this.signature)
            return;
        this.signature = signature;
        const list = this.control('playlist');
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
}
