export interface AudioIntent {
  source: string;
  wantsPlayback: boolean;
  music: number;
  environment: number;
  effects: number;
  contextState: string | null;
}

/** Decide graph and recovery needs without changing the user's playback intent. */
export function audioPolicy(intent: AudioIntent) {
  const bgm = intent.source !== 'external' && intent.wantsPlayback && intent.music > 0;
  const channels = bgm || intent.environment > 0 || intent.effects > 0;
  return { channels, bgm, recovery: channels && intent.contextState !== null && intent.contextState !== 'running' };
}
