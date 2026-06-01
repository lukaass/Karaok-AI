import React, { useState, useEffect, useRef } from "react";
import { KaraokeProject } from "../types";
import { Play, Pause, Download, RefreshCw, Film, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

interface Step4Props {
  project: KaraokeProject;
  onReset: () => void;
}

export default function Step4Export({ project, onReset }: Step4Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Recording / Export state
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [exportedVideoBlobUrl, setExportedVideoBlobUrl] = useState<string | null>(null);

  // Transcoding states
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [mp4BlobUrl, setMp4BlobUrl] = useState<string | null>(null);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);

  // Watermark / Branding states
  const [watermarkType, setWatermarkType] = useState<"none" | "text" | "logo">("none");
  const [watermarkText, setWatermarkText] = useState("KARAOKÊ AI");
  const [watermarkPosition, setWatermarkPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.6);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Sync state & focus tracking
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [syncMetric, setSyncMetric] = useState<{
    fps: number;
    driftMs: number;
    rating: "excelente" | "estável" | "alerta" | "crítico";
  }>({ fps: 30, driftMs: 0, rating: "excelente" });
  const [showFocusWarning, setShowFocusWarning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const recordingStartTimeRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(0);

  // Detect window focus / tab visibility changes to warn about canvas throttling desync risk
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        setShowFocusWarning(true);
      }
    };
    const handleBlur = () => {
      if (isRecording) {
        setShowFocusWarning(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isRecording]);

  // Load image if bgType is AI or custom
  useEffect(() => {
    if ((project.bgType === "ai" || project.bgType === "custom") && project.bgValue) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = project.bgValue;
      img.onload = () => {
        bgImageRef.current = img;
      };
    }
  }, [project.bgType, project.bgValue]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFrame = () => {
      const audio = audioRef.current;
      const playhead = audio ? audio.currentTime : currentTime;
      if (audio) {
        setCurrentTime(playhead);
      }

      // Timing, FPS, and Sync status computation
      const now = performance.now();
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = now;
      }
      frameCountRef.current += 1;

      if (now - fpsTimerRef.current >= 1000) {
        const calculatedFps = Math.round((frameCountRef.current * 1000) / (now - fpsTimerRef.current));
        
        let drift = 0;
        if (isRecording && recordingStartTimeRef.current && audio) {
          const elapsedReal = (now - recordingStartTimeRef.current) / 1000;
          const elapsedAudio = audio.currentTime;
          drift = Math.abs(elapsedReal - elapsedAudio) * 1000;
        }

        let rating: "excelente" | "estável" | "alerta" | "crítico" = "excelente";
        if (drift > 355 || calculatedFps < 18) {
          rating = "crítico";
        } else if (drift > 155 || calculatedFps < 24) {
          rating = "alerta";
        } else if (drift > 55) {
          rating = "estável";
        }

        setSyncMetric({
          fps: calculatedFps,
          driftMs: Math.round(drift),
          rating
        });

        frameCountRef.current = 0;
        fpsTimerRef.current = now;
      }
      lastFrameTimeRef.current = now;

      // 1. Draw Background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (project.bgType === "gradient") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        
        let colors = ["#0b0f19", "#1e1b4b", "#2e1065"]; // defaults
        if (project.bgValue) {
          const colorMatches = [...project.bgValue.matchAll(/(#[0-9a-fA-F]{3,6})/g)];
          if (colorMatches.length >= 2) {
            colors = colorMatches.map(m => m[1]);
          }
        }

        if (colors.length === 2) {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1]);
        } else if (colors.length >= 3) {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(0.5, colors[1]);
          grad.addColorStop(1, colors[2]);
        } else {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[0]);
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bgImageRef.current && bgImageRef.current.complete) {
        ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        // Fallback plain deep space background
        ctx.fillStyle = "#0c1020";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Translucent shadow tint for better contrast
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Resolve Active & Next Line
      const lines = project.lines || [];
      let activeLineIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (playhead >= lines[i].startTime && playhead <= lines[i].endTime) {
          activeLineIdx = i;
          break;
        }
      }

      // Find the next line
      let nextLineIdx = -1;
      if (activeLineIdx !== -1) {
        nextLineIdx = activeLineIdx + 1 < lines.length ? activeLineIdx + 1 : -1;
      } else {
        // Not currently in a line, find the immediately upcoming line
        nextLineIdx = lines.findIndex(l => l.startTime > playhead);
      }

      // Draw active line and next line
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // UPPER DECORATIVE METADATA (Artist & Title)
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillText(
        `${project.title || "Sem título"} - ${project.artist || "Artistas"} (Karaokê AI)`,
        canvas.width / 2,
        45
      );

      // DRAW THE LINES
      if (activeLineIdx !== -1) {
        const activeLine = lines[activeLineIdx];
        const text = activeLine.text;

        // Calculate progress wipe ratio
        const duration = activeLine.endTime - activeLine.startTime;
        const elapsed = playhead - activeLine.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / duration));

        // Center position
        const y = canvas.height / 2 - 15;

        const fontSize = project.lyricFontSize || 34;

        if (project.highlightMode === "simple") {
          // Simple Highlight Mode: entire active phrase immediately highlighted
          ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
          ctx.fillStyle = "#facc15"; // gold yellow
          ctx.fillText(text, canvas.width / 2, y);
        } else {
          // Progressive Mode: wipe crawling highlight
          // Base text (white)
          ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, canvas.width / 2, y);

          // Highlight layer (using clipping mask)
          const textWidth = ctx.measureText(text).width;
          if (progress > 0) {
            ctx.save();
            ctx.beginPath();
            const drawWidth = textWidth * progress;
            const rectY = y - fontSize * 1.15;
            const rectHeight = fontSize * 2.3;
            ctx.rect(canvas.width / 2 - textWidth / 2, rectY, drawWidth, rectHeight);
            ctx.clip();

            // Gold/Emerald karaoke wipe color
            ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
            ctx.fillStyle = "#facc15"; // gold yellow
            ctx.fillText(text, canvas.width / 2, y);
            ctx.restore();
          }
        }

        // Draw upcoming line if exists
        if (nextLineIdx !== -1 && nextLineIdx < lines.length) {
          const nextFontSize = Math.round(fontSize * 0.65);
          ctx.font = `bold ${nextFontSize}px "Inter", sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
          ctx.fillText(lines[nextLineIdx].text, canvas.width / 2, canvas.height / 2 + 55);
        }
      } else {
        // Intro or Instrumental interlude
        const introFontSize = Math.round((project.lyricFontSize || 34) * 0.76);
        ctx.font = `italic ${introFontSize}px "Inter", sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

        if (nextLineIdx !== -1 && nextLineIdx < lines.length) {
          const secsToStart = Math.ceil(lines[nextLineIdx].startTime - playhead);
          if (secsToStart > 0 && secsToStart <= 5) {
            ctx.fillText(`Preparar em ${secsToStart}s...`, canvas.width / 2, canvas.height / 2 - 20);
          } else {
            ctx.fillText("♬ Solo Instrumental ♬", canvas.width / 2, canvas.height / 2 - 20);
          }
          
          // Show upcoming line faint in background
          const nextFontSize = Math.round((project.lyricFontSize || 34) * 0.65);
          ctx.font = `bold ${nextFontSize}px "Inter", sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillText(lines[nextLineIdx].text, canvas.width / 2, canvas.height / 2 + 45);
        } else {
          ctx.fillText("♬ Karaokê Concluído ♬", canvas.width / 2, canvas.height / 2 - 10);
        }
      }

      // 3. Draw Watermark / Logo Branding
      if (watermarkType !== "none") {
        ctx.save();
        ctx.globalAlpha = watermarkOpacity;
        
        let x = 0;
        let y = 0;
        let alignment: CanvasTextAlign = "center";
        const marginX = 50;
        const marginY = 50;

        if (watermarkPosition === "top-left") {
          x = marginX;
          y = marginY + 12;
          alignment = "left";
        } else if (watermarkPosition === "top-right") {
          x = canvas.width - marginX;
          y = marginY + 12;
          alignment = "right";
        } else if (watermarkPosition === "bottom-left") {
          x = marginX;
          y = canvas.height - marginY;
          alignment = "left";
        } else if (watermarkPosition === "bottom-right") {
          x = canvas.width - marginX;
          y = canvas.height - marginY;
          alignment = "right";
        }

        ctx.textAlign = alignment;
        ctx.textBaseline = "middle";

        if (watermarkType === "text" && watermarkText.trim()) {
          // Precise high-contrast display text
          ctx.font = 'bold 18px "JetBrains Mono", sans-serif';
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1.5;
          ctx.shadowOffsetY = 1.5;

          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillText(watermarkText.toUpperCase(), x, y);
        } else if (watermarkType === "logo" && logoImageRef.current && logoImageRef.current.complete) {
          // Scale logo elements automatically keeping aspect-ratio
          const maxW = 120;
          const maxH = 60;
          const img = logoImageRef.current;
          let w = img.width;
          let h = img.height;
          
          const ratio = Math.min(maxW / w, maxH / h, 1);
          w = w * ratio;
          h = h * ratio;

          let drawX = x;
          let drawY = y - h / 2;

          if (alignment === "right") {
            drawX = x - w;
          } else if (alignment === "center") {
            drawX = x - w / 2;
          }

          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          ctx.drawImage(img, drawX, drawY, w, h);
        }
        ctx.restore();
      }

      // Handle running record progression indicator
      if (isRecording && audio) {
        const percentage = Math.round((audio.currentTime / audio.duration) * 100);
        setRecordProgress(percentage);
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    animationFrameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [project, currentTime, isRecording, watermarkType, watermarkText, watermarkPosition, watermarkOpacity, logoSrc]);

  useEffect(() => {
    // Synchronize media audio event durations
    const audio = audioRef.current;
    if (!audio) return;

    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      if (isRecording) {
        stopRecording();
      }
    };

    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isRecording]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const seekToTime = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekToTime(parseFloat(e.target.value));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setLogoSrc(src);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
          logoImageRef.current = img;
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearLogo = () => {
    setLogoSrc(null);
    logoImageRef.current = null;
  };

  const handleConvertWebmToMp4 = async () => {
    if (!exportedVideoBlobUrl) return;
    try {
      setIsTranscoding(true);
      setTranscodeProgress(0);
      setTranscodeError(null);

      const ffmpeg = new FFmpeg();

      ffmpeg.on("log", ({ message }) => {
        console.log("FFmpeg Log:", message);
      });

      ffmpeg.on("progress", ({ progress }) => {
        setTranscodeProgress(Math.round(progress * 100));
      });

      // Use single-threaded version which does not require COOP/COEP headers
      const coreURL = "https://unpkg.com/@ffmpeg/core-single@0.12.6/dist/umd/ffmpeg-core.js";
      const wasmURL = "https://unpkg.com/@ffmpeg/core-single@0.12.6/dist/umd/ffmpeg-core.wasm";

      await ffmpeg.load({
        coreURL: await toBlobURL(coreURL, "text/javascript"),
        wasmURL: await toBlobURL(wasmURL, "application/wasm"),
      });

      const webmData = await fetchFile(exportedVideoBlobUrl);
      await ffmpeg.writeFile("input.webm", webmData);

      // Transcode WebM to MP4 with high compatibility container format
      await ffmpeg.exec([
        "-i", "input.webm",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:v", "1800k",
        "-b:a", "128k",
        "output.mp4"
      ]);

      const data = await ffmpeg.readFile("output.mp4");
      const mp4Blob = new Blob([data], { type: "video/mp4" });
      const mp4Url = URL.createObjectURL(mp4Blob);
      
      setMp4BlobUrl(mp4Url);
      setIsTranscoding(false);
    } catch (err: any) {
      console.error("Erro na transcodificação para MP4:", err);
      setTranscodeError(err?.message || "Ocorreu um erro ao transcodificar o vídeo.");
      setIsTranscoding(false);
    }
  };

  // 3. RECORDER CORE - Captures playback audio + Canvas frames into WebM
  const startRecording = async () => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    try {
      setIsRecording(true);
      setRecordProgress(0);
      setExportedVideoBlobUrl(null);
      setMp4BlobUrl(null);
      setTranscodeProgress(0);
      setTranscodeError(null);
      recordedChunksRef.current = [];

      // Seek playback to zero and pause to sync properly
      audio.currentTime = 0;
      setCurrentTime(0);
      audio.pause();

      // Create browser Web Audio graph to capture element clean output stream
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      
      const sourceNode = audioCtx.createMediaElementSource(audio);
      const destStreamNode = audioCtx.createMediaStreamDestination();
      
      // Wire audio graph - splits vocal backing to BOTH listener and recorder!
      sourceNode.connect(destStreamNode);
      sourceNode.connect(audioCtx.destination);

      // Capture frames at 30fps
      const canvasStream = canvas.captureStream(30);

      // Combine video tracks and synthesized audio tracks
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...destStreamNode.stream.getAudioTracks()
      ];
      
      const combinedStream = new MediaStream(combinedTracks);

      // Use VP8 / VP9 or H264 depending on browser compatibility
      let options = { mimeType: "video/webm;codecs=vp9,opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm;codecs=vp8,opus" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm" };
      }

      const recorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const streamBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const videoURL = URL.createObjectURL(streamBlob);
        setExportedVideoBlobUrl(videoURL);
        setIsRecording(false);
        setRecordProgress(100);
      };

      // Play audio and start recording simultaneously
      recordingStartTimeRef.current = performance.now();
      lastFrameTimeRef.current = performance.now();
      frameCountRef.current = 0;
      fpsTimerRef.current = performance.now();
      setShowFocusWarning(false);
      setSyncMetric({ fps: 30, driftMs: 0, rating: "excelente" });

      await audio.play();
      setIsPlaying(true);
      recorder.start(1000); // chunk every 1 sec

    } catch (err) {
      console.error("Erro ao iniciar a gravação do canvas:", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleResetApp = () => {
    // Revoke current blobs to keep clean state and memory
    if (exportedVideoBlobUrl) {
      URL.revokeObjectURL(exportedVideoBlobUrl);
    }
    if (mp4BlobUrl) {
      URL.revokeObjectURL(mp4BlobUrl);
    }
    onReset();
  };

  return (
    <div id="step-4-container" className="flex flex-col gap-8 max-w-5xl mx-auto py-2">
      
      {/* Visual Header do Layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider uppercase">Passo Final — Estúdio de Exportação</span>
          <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2 mt-0.5">
            <Film className="w-5 h-5 text-indigo-400" />
            Produzir Vídeo de Karaokê
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Grave a prévia em tempo real com a música instrumental sobreposta. O arquivo final de vídeo será salvo na sua máquina.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-850 self-start">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400">Canal Ativo de Produção</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Esquerda: O Player de Renderização do Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl shadow-black/15">
            {/* O Canvas real onde o Karaokê é desenhado */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-inner border border-slate-850">
              <canvas
                id="karaoke-export-canvas"
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full object-contain bg-slate-950"
              />
            </div>

            {/* BARRA DE PROGRESSO PERSISTENTE (LINHA DO TEMPO) */}
            <div className="mt-3.5 space-y-1.5" id="persistent-timeline-container">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  {isRecording ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-ping inline-block" />
                      <span className="text-red-400 font-bold">Gravando Karaokê</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                      <span className="text-indigo-400">Linha do Tempo (Verificação / Prévia)</span>
                    </>
                  )}
                </span>
                <span className="font-semibold text-slate-300">
                  {isRecording ? (
                    <span className="text-red-400 font-bold">{recordProgress}% completo</span>
                  ) : (
                    `${Math.floor(currentTime / 60)}:${(Math.floor(currentTime % 60) + "").padStart(2, "0")} / ${Math.floor(duration / 60)}:${(Math.floor(duration % 60) + "").padStart(2, "0")}`
                  )}
                </span>
              </div>

              {/* A trilha interativa do progresso */}
              <div
                id="persistent-timeline-bar"
                onClick={(e) => {
                  if (isRecording) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekToTime(ratio * (duration || 1));
                }}
                onMouseDown={(e) => {
                  if (isRecording) return;
                  setIsDraggingProgress(true);
                }}
                onMouseMove={(e) => {
                  if (isDraggingProgress && !isRecording) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    seekToTime(ratio * (duration || 1));
                  }
                }}
                onMouseUp={() => setIsDraggingProgress(false)}
                onMouseLeave={() => setIsDraggingProgress(false)}
                className={`relative h-2.5 w-full rounded-lg overflow-hidden border border-slate-800 transition-all ${
                  isRecording ? "cursor-not-allowed bg-red-950/20" : "cursor-pointer bg-slate-950 hover:border-slate-700 hover:shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                }`}
              >
                {/* Visual ticks / Marks every 10% */}
                <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20 px-4">
                  {[...Array(9)].map((_, i) => (
                    <span key={i} className="h-full w-[1px] bg-slate-550" />
                  ))}
                </div>

                {/* Preenchimento do progresso */}
                <div
                  className={`absolute top-0 bottom-0 left-0 transition-all duration-75 ${
                    isRecording
                      ? "bg-gradient-to-r from-red-650 to-rose-500 animate-pulse"
                      : "bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400"
                  }`}
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />

                {/* Cursor indicador de arrasto */}
                {!isRecording && duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_white] pointer-events-none"
                    style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
                  />
                )}
              </div>
            </div>

            {/* Controle da Linha do Tempo de Pré-visualização */}
            <div className="flex items-center justify-between gap-4 mt-4 bg-slate-950 rounded-xl p-3 border border-slate-850">
              <button
                id="export-play-btn"
                onClick={togglePlay}
                disabled={isRecording}
                className={`p-3 rounded-full bg-indigo-650 hover:bg-indigo-500 text-white shadow-md active:scale-95 transition-all cursor-pointer ${
                  isRecording ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <input
                  id="preview-scrubber"
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={isRecording}
                  className={`w-full h-1 bg-slate-800 accent-indigo-500 rounded-lg cursor-pointer ${
                    isRecording ? "opacity-35 cursor-not-allowed" : ""
                  }`}
                />
              </div>

              <div className="text-xs font-mono text-slate-400 shrink-0 pr-1">
                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60) + "").padStart(2, "0")}
              </div>
            </div>

            <audio ref={audioRef} src={project.playbackAudioUrl || ""} />
          </div>
        </div>

        {/* Direita: Painel de Gravação e Baixar */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col gap-6 justify-between flex-1">
            
            <div className="space-y-4">
              <h3 className="text-md font-sans font-bold text-white">Criar e Exportar</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ao clicar em "Gravar Karaokê", a música instrumental será iniciada desde o começo e a IA do navegador gravará todos os quadros de vídeo e áudio da prévia em tempo real.
              </p>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-850 text-xs text-slate-400 space-y-2.5 font-mono">
                <div className="flex justify-between border-b border-slate-850 pb-1.5">
                  <span className="text-slate-500">Música:</span>
                  <span className="text-white truncate max-w-[160px] font-sans font-semibold">{project.title}</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5">
                  <span className="text-slate-500">Formato:</span>
                  <span className="text-white font-semibold">WebM (Audio + Video)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa de Quadros:</span>
                  <span className="text-white font-semibold">30 FPS (HD 720p)</span>
                </div>
              </div>

              {/* SEÇÃO DE MARCA D'ÁGUA / LOGOTIPO PERSONALIZADO */}
              <div className="border border-slate-800/80 bg-slate-950/45 rounded-xl p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-indigo-400">Personalizar Marca d'água</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Insira um logotipo ou texto personalizado para assinar o seu vídeo.</p>
                </div>

                <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
                  {(["none", "text", "logo"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={isRecording}
                      onClick={() => setWatermarkType(type)}
                      className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        watermarkType === type
                          ? "bg-indigo-650 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {type === "none" ? "Nenhum" : type === "text" ? "Texto" : "Logotipo"}
                    </button>
                  ))}
                </div>

                {watermarkType === "text" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-450 uppercase">Texto Personalizado</label>
                    <input
                      type="text"
                      maxLength={32}
                      disabled={isRecording}
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Ex: MEU KARAOKÊ"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-650 placeholder-slate-600 font-mono disabled:opacity-40"
                    />
                  </div>
                )}

                {watermarkType === "logo" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-450 uppercase block">Imagem do Logotipo (PNG/JPG)</label>
                    {logoSrc ? (
                      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={logoSrc}
                            alt="Logo preview"
                            className="w-10 h-10 object-contain rounded bg-slate-950 border border-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 truncate max-w-[130px] font-mono">Logo carregado</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRecording}
                          onClick={handleClearLogo}
                          className="text-[10px] bg-red-950/20 hover:bg-red-950/45 text-red-400 px-2.5 py-1 rounded border border-red-900/30 font-medium transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 hover:border-indigo-500/50 rounded-lg py-4 px-3 bg-slate-900/40 cursor-pointer transition-all hover:bg-slate-900/80 group">
                        <Sparkles className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors mb-1" />
                        <span className="text-[10px] text-slate-400 text-center font-sans">Selecionar arquivo de imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isRecording}
                          onChange={handleLogoUpload}
                        />
                      </label>
                    )}
                  </div>
                )}

                {watermarkType !== "none" && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-450 uppercase block">Posicionamento</label>
                      <select
                        disabled={isRecording}
                        value={watermarkPosition}
                        onChange={(e) => setWatermarkPosition(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-indigo-650 cursor-pointer font-sans disabled:opacity-40"
                      >
                        <option value="top-left">Sup. Esquerdo</option>
                        <option value="top-right">Sup. Direito</option>
                        <option value="bottom-left">Inf. Esquerdo</option>
                        <option value="bottom-right">Inf. Direito</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-slate-450 uppercase">
                        <span>Opacidade</span>
                        <span className="text-indigo-400 font-bold">{Math.round(watermarkOpacity * 100)}%</span>
                      </div>
                      <div className="flex items-center h-8">
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          disabled={isRecording}
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-850 accent-indigo-500 rounded-lg cursor-pointer disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PAINEL DE VERIFICAÇÃO DE SINCRONIA EM TEMPO REAL */}
              <div id="sync-verification-telemetry" className="bg-slate-950 rounded-xl p-4 border border-slate-850 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Tempo Real: Sincronia</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                    syncMetric.rating === "excelente" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    syncMetric.rating === "estável" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                    syncMetric.rating === "alerta" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse" : 
                    "bg-rose-500/15 text-rose-500 border border-rose-500/20 animate-bounce"
                  }`}>
                    {isRecording ? syncMetric.rating : "pronto"}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-900">
                  <div>
                    <span className="text-slate-500">Quadros:</span>{" "}
                    <span className={`font-semibold ${isRecording && syncMetric.fps < 24 ? "text-amber-500" : "text-white"}`}>
                      {isRecording ? `${syncMetric.fps} FPS` : "30 FPS"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Desvio Áudio:</span>{" "}
                    <span className={`font-semibold ${isRecording && syncMetric.driftMs > 150 ? "text-rose-500" : "text-white"}`}>
                      {isRecording ? `${syncMetric.driftMs}ms` : "0ms"}
                    </span>
                  </div>
                </div>

                {/* ALERTA DE PERDA DE FOCO COBRINDO THROTTLING DO NAVEGADOR */}
                {showFocusWarning && isRecording && (
                  <div className="bg-rose-950/20 text-rose-300 p-2.5 rounded-lg border border-rose-900/40 text-[10px] leading-relaxed font-sans mt-2">
                    ⚠️ <strong>Aviso de Monitoramento:</strong> Mantenha esta aba aberta e ativa na tela. Trocar de aba reduz a taxa de quadros e causa atraso ou perda de sincronização no vídeo final.
                  </div>
                )}
              </div>
            </div>

            {/* STATUS DO RECORDER */}
            <div className="my-auto py-2">
              {isRecording ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="absolute inset-0 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
                    />
                    <span className="text-xs font-mono font-bold text-indigo-400">{recordProgress}%</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 animate-pulse font-bold">
                    🔴 GRAVANDO ARQUIVO DE SINAL...
                  </span>
                  <button
                    id="stop-rec-btn"
                    onClick={stopRecording}
                    className="mt-1 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-450 border border-red-500/30 text-xs font-mono rounded-lg cursor-pointer"
                  >
                    Encerrar Gravação Cedo
                  </button>
                </div>
              ) : exportedVideoBlobUrl ? (
                <div className="flex flex-col items-center text-center gap-3 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                  {mp4BlobUrl ? (
                    <>
                      <div className="p-2.5 rounded-full bg-emerald-500/10 mb-1">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <span className="text-sm font-sans font-bold text-emerald-400">Convertido para MP4 com sucesso!</span>
                      <p className="text-[11px] text-slate-400">
                        O vídeo do seu Karaokê foi transcodificado para o formato MP4, pronto para reproduzir em qualquer dispositivo.
                      </p>
                    </>
                  ) : isTranscoding ? (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="absolute inset-0 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-400">{transcodeProgress}%</span>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-300 font-bold uppercase animate-pulse">
                        🔄 Transcodificando em tempo real...
                      </span>
                      <p className="text-[10px] text-slate-400 max-w-[260px]">
                        Isso é feito localmente no seu navegador sem enviar nenhum dado para a nuvem. Por favor, aguarde.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-2.5 rounded-full bg-indigo-500/10 mb-1">
                        <Film className="w-8 h-8 text-indigo-400" />
                      </div>
                      <span className="text-sm font-sans font-bold text-indigo-400">Vídeo composto com sucesso!</span>
                      <p className="text-[11px] text-slate-400 mb-1">
                        Formato gravado: WebM (Audio & Vídeo). Você pode converter para MP4 de alta compatibilidade no seu navegador abaixo.
                      </p>
                      
                      {transcodeError && (
                        <div className="bg-red-950/20 text-red-400 p-2 border border-red-900/30 rounded text-[10px] w-full text-center">
                          ⚠️ {transcodeError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleConvertWebmToMp4}
                        className="w-full py-2 px-3 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-400 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-all text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Transcodificar para MP4 (Recomendado)
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 font-mono text-xs">
                  Aguardando gravação...
                </div>
              )}
            </div>

            {/* BOTÕES DE GRAVAR E DOWNLOAD */}
            <div className="space-y-3 mt-auto">
              {!exportedVideoBlobUrl && !isRecording && (
                <button
                  id="start-rec-btn"
                  onClick={startRecording}
                  className="w-full py-4 bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-650 hover:to-rose-600 text-white rounded-xl font-bold shadow-xl shadow-red-600/15 transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  <Film className="w-5 h-5" />
                  Gravar & Gerar Karaokê
                </button>
              )}

              {exportedVideoBlobUrl && !isTranscoding && (
                <>
                  {mp4BlobUrl ? (
                    <a
                      href={mp4BlobUrl}
                      download={`karaoke_${project.title ? project.title.toLowerCase().replace(/\s+/g, "_") : "music"}.mp4`}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-center text-sm"
                    >
                      <Download className="w-5 h-5" />
                      Baixar Vídeo (Formato MP4)
                    </a>
                  ) : (
                    <a
                      href={exportedVideoBlobUrl}
                      download={`karaoke_${project.title ? project.title.toLowerCase().replace(/\s+/g, "_") : "music"}.webm`}
                      className="w-full py-4 bg-slate-700 hover:bg-slate-650 text-white rounded-xl font-bold shadow-xl shadow-slate-800/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-center text-sm"
                    >
                      <Download className="w-5 h-5" />
                      Baixar Vídeo Original (WebM)
                    </a>
                  )}
                </>
              )}

              {isTranscoding && (
                <div className="w-full py-4 bg-slate-850 text-slate-400 rounded-xl font-bold flex items-center justify-center gap-2 text-sm cursor-not-allowed">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Transcodificando ({transcodeProgress}%) ...
                </div>
              )}

              <button
                id="reset-studio-btn"
                onClick={handleResetApp}
                disabled={isTranscoding}
                className="w-full py-3.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-slate-500 transition-colors font-semibold cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Criar Novo Karaokê
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
