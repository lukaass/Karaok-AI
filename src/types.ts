export interface LyricsLine {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
}

export interface KaraokeProject {
  title: string;
  artist: string;
  originalAudioUrl: string | null;
  originalAudioName: string | null;
  playbackAudioUrl: string | null;
  playbackAudioName: string | null;
  lyrics: string;
  lines: LyricsLine[];
  bgType: "gradient" | "custom" | "ai";
  bgValue: string; // CSS gradient class or background Image URL (Base64/external)
  highlightMode?: "progressive" | "simple";
  lyricFontSize?: number;
  videoExportedUrl: string | null;
}

export type AppStep = "INFO" | "ALIGN" | "PLAYBACK" | "EXPORT";
