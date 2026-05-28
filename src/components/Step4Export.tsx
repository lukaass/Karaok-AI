import React, { useState, useEffect, useRef } from "react";
import { KaraokeProject } from "../types";
import { Play, Pause, Download, RefreshCw, Film, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

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

      // 1. Draw Background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (project.bgType === "gradient") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        // Default to preset 1 colors if parsing isn't direct
        grad.addColorStop(0, "#0b0f19");
        grad.addColorStop(0.5, "#1e1b4b");
        grad.addColorStop(1, "#2e1065");
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

        if (project.highlightMode === "simple") {
          // Simple Highlight Mode: entire active phrase immediately highlighted
          ctx.font = 'bold 34px "Inter", sans-serif';
          ctx.fillStyle = "#facc15"; // gold yellow
          ctx.fillText(text, canvas.width / 2, y);
        } else {
          // Progressive Mode: wipe crawling highlight
          // Base text (white)
          ctx.font = 'bold 34px "Inter", sans-serif';
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, canvas.width / 2, y);

          // Highlight layer (using clipping mask)
          const textWidth = ctx.measureText(text).width;
          if (progress > 0) {
            ctx.save();
            ctx.beginPath();
            const drawWidth = textWidth * progress;
            ctx.rect(canvas.width / 2 - textWidth / 2, y - 40, drawWidth, 80);
            ctx.clip();

            // Gold/Emerald karaoke wipe color
            ctx.font = 'bold 34px "Inter", sans-serif';
            ctx.fillStyle = "#facc15"; // gold yellow
            ctx.fillText(text, canvas.width / 2, y);
            ctx.restore();
          }
        }

        // Draw upcoming line if exists
        if (nextLineIdx !== -1 && nextLineIdx < lines.length) {
          ctx.font = 'bold 22px "Inter", sans-serif';
          ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
          ctx.fillText(lines[nextLineIdx].text, canvas.width / 2, canvas.height / 2 + 55);
        }
      } else {
        // Intro or Instrumental interlude
        ctx.font = 'italic 26px "Inter", sans-serif';
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

        if (nextLineIdx !== -1 && nextLineIdx < lines.length) {
          const secsToStart = Math.ceil(lines[nextLineIdx].startTime - playhead);
          if (secsToStart > 0 && secsToStart <= 5) {
            ctx.fillText(`Preparar em ${secsToStart}s...`, canvas.width / 2, canvas.height / 2 - 20);
          } else {
            ctx.fillText("♬ Solo Instrumental ♬", canvas.width / 2, canvas.height / 2 - 20);
          }
          
          // Show upcoming line faint in background
          ctx.font = 'bold 22px "Inter", sans-serif';
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillText(lines[nextLineIdx].text, canvas.width / 2, canvas.height / 2 + 45);
        } else {
          ctx.fillText("♬ Karaokê Concluído ♬", canvas.width / 2, canvas.height / 2 - 10);
        }
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
  }, [project, currentTime, isRecording]);

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
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
                  <div className="p-2.5 rounded-full bg-emerald-500/10 mb-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <span className="text-sm font-sans font-bold text-emerald-400">Vídeo composto com sucesso!</span>
                  <p className="text-[11px] text-slate-400">
                    O vídeo foi sincronizado. Clique no botão de download abaixo para fazer o download do arquivo de vídeo.
                  </p>
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

              {exportedVideoBlobUrl && (
                <a
                  href={exportedVideoBlobUrl}
                  download={`karaoke_${project.title ? project.title.toLowerCase().replace(/\s+/g, "_") : "music"}.webm`}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-center text-sm"
                >
                  <Download className="w-5 h-5" />
                  Baixar Vídeo do Karaokê
                </a>
              )}

              <button
                id="reset-studio-btn"
                onClick={handleResetApp}
                className="w-full py-3.5 bg-slate-800/50 hover:bg-slate-705 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-slate-500 transition-colors font-semibold cursor-pointer flex items-center justify-center gap-2 text-sm"
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
