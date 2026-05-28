import React, { useState, useEffect, useRef } from "react";
import { LyricsLine, KaraokeProject } from "../types";
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, HelpCircle, Save, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Step2Props {
  project: KaraokeProject;
  updateProject: (updated: Partial<KaraokeProject>) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Step2Align({ project, updateProject, onPrev, onNext }: Step2Props) {
  const [lines, setLines] = useState<LyricsLine[]>(project.lines || []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  
  // Tap-Sync State
  const [tapActiveIndex, setTapActiveIndex] = useState<number>(0);
  const [isTappingMode, setIsTappingMode] = useState(false);
  const [chainShifting, setChainShifting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync state with HTML5 Audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);

      // Find which line is active based on currentTime
      const activeIdx = lines.findIndex(
        (line) => time >= line.startTime && time <= line.endTime
      );
      if (activeIdx !== -1) {
        setActiveLineIdx(activeIdx);
      } else {
        // If not exactly inside any line, find the closest upcoming or previous
        setActiveLineIdx(null);
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [lines]);

  // Load audio on mount or URL change
  useEffect(() => {
    if (audioRef.current && project.originalAudioUrl) {
      audioRef.current.load();
    }
  }, [project.originalAudioUrl]);

  // Keyboard shortcut listener for spacebar during tapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Prevent window scrolling when hitting space
        e.preventDefault();
        
        if (isTappingMode) {
          handleTapSync();
        } else {
          togglePlay();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTappingMode, tapActiveIndex]);

  // Autoscroll the active line or tap active line into view
  useEffect(() => {
    if (!lineContainerRef.current) return;
    const targetIdx = isTappingMode ? tapActiveIndex : (activeLineIdx ?? 0);
    const activeElement = document.getElementById(`line-item-${targetIdx}`);
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLineIdx, tapActiveIndex, isTappingMode]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => console.error("Error playing audio:", err));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const setTime = parseFloat(e.target.value);
    audio.currentTime = setTime;
    setCurrentTime(setTime);
  };

  // Adjust timings of lines manually
  const modifyTime = (idx: number, field: "startTime" | "endTime", delta: number) => {
    let newLines = [...lines];

    if (chainShifting) {
      // Shift all lines from idx onwards by delta
      for (let i = idx; i < newLines.length; i++) {
        newLines[i] = {
          ...newLines[i],
          startTime: Math.max(0, parseFloat((newLines[i].startTime + delta).toFixed(2))),
          endTime: Math.max(0, parseFloat((newLines[i].endTime + delta).toFixed(2))),
        };
        // Keep logical boundary (end >= start)
        if (newLines[i].endTime < newLines[i].startTime) {
          newLines[i].endTime = newLines[i].startTime + 0.5;
        }
      }
    } else {
      newLines[idx] = {
        ...newLines[idx],
        [field]: Math.max(0, parseFloat((newLines[idx][field] + delta).toFixed(2))),
      };
      // Keep logical boundary (end >= start)
      if (newLines[idx].endTime < newLines[idx].startTime) {
        newLines[idx].endTime = newLines[idx].startTime + 0.5;
      }
    }

    setLines(newLines);
  };

  // Tap sync logic
  const handleTapSync = () => {
    if (!audioRef.current) return;
    const time = parseFloat(audioRef.current.currentTime.toFixed(2));

    const newLines = [...lines];

    if (tapActiveIndex < lines.length) {
      // Set start time for current line
      newLines[tapActiveIndex].startTime = time;

      // Close the previous line's end time if it was during a gap
      if (tapActiveIndex > 0) {
        // Assume previous line ends right when this one starts or slightly before
        newLines[tapActiveIndex - 1].endTime = Math.max(newLines[tapActiveIndex - 1].startTime + 0.2, time - 0.1);
      }

      // Estimate default end for current line
      newLines[tapActiveIndex].endTime = time + 3.0;

      setLines(newLines);

      // Scroll list item and advance INDEX
      if (tapActiveIndex === lines.length - 1) {
        // Last line is tapped, conclude
        newLines[tapActiveIndex].endTime = parseFloat((time + 4.0).toFixed(2));
        setLines(newLines);
        setIsTappingMode(false);
      } else {
        setTapActiveIndex(prev => prev + 1);
      }
    }
  };

  const startTapMode = () => {
    setIsTappingMode(true);
    setTapActiveIndex(0);
    // Restart audio at 0 to tap-along smoothly!
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const saveAndNext = () => {
    updateProject({ lines });
    onNext();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <div id="step-2-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto py-4">
      
      {/* Coluna Esquerda: Player de Áudio & Timeline Manual */}
      <div className="lg:col-span-8 flex flex-col gap-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold tracking-wider uppercase">Passo 2 de 4</span>
            <h2 className="text-xl font-sans font-bold text-white">Sincronizador Studio</h2>
            <p className="text-sm text-slate-400 mt-1">
              Ajuste precisamente o tempo de cada frase cantada. Siga pela IA ou use o tempo por toque.
            </p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-mono text-slate-550">Música Original</span>
            <span className="block text-sm font-sans font-semibold text-slate-300 truncate max-w-[180px]">
              {project.title || "Sem título"}
            </span>
          </div>
        </div>

        {/* Player Flutuante da Sincronização */}
        <div className="bg-slate-950 rounded-xl p-5 border border-slate-850 flex items-center gap-4">
          <button
            id="studio-play-pause-btn"
            onClick={togglePlay}
            className="p-4 rounded-full bg-indigo-650 hover:bg-indigo-500 font-bold hover:scale-105 transition-all text-white shadow-xl shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
          </button>

          <div className="flex-1">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-1.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              id="timeline-seek-range"
              type="range"
              min={0}
              max={duration || 100}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-lg bg-slate-800 accent-indigo-500 cursor-pointer"
            />
          </div>

          <audio ref={audioRef} src={project.originalAudioUrl || ""} preload="auto" />
        </div>

        {/* Lista de Letras para ajuste individual */}
        <div className="flex flex-col gap-3 flex-1 col-span-1">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center px-1 gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wide block">Tabela de Letras</span>
              <span className="text-[11px] text-slate-500 block mt-1">Clique nas setas para pré-ajuste fino de tempos</span>
            </div>
            
            {/* Toggle Switch para Ajuste em Cadeia */}
            <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-705 transition-all select-none">
              <input
                type="checkbox"
                checked={chainShifting}
                onChange={(e) => setChainShifting(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:bg-slate-500 peer-checked:after:bg-indigo-400 after:border-slate-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-indigo-950/40 peer-checked:border-indigo-500/50"></div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-slate-350 uppercase leading-none">Ajuste de Fluxo (Cadeia)</span>
                <span className="text-[9px] text-slate-500 leading-none mt-1">Desloca todo o restante da tabela</span>
              </div>
            </label>
          </div>

          <div
            id="lines-editor-scroll-container"
            ref={lineContainerRef}
            className="flex-1 max-h-[420px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
          >
            {lines.map((line, idx) => {
              const isActive = activeLineIdx === idx;
              const isTapActive = isTappingMode && tapActiveIndex === idx;

              return (
                <div
                  key={line.id}
                  id={`line-item-${idx}`}
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border transition-all ${
                    isTapActive
                      ? "border-yellow-500/65 bg-yellow-500/5 shadow-yellow-500/5 shadow-md"
                      : isActive
                      ? "border-indigo-500 bg-indigo-500/10 shadow-indigo-500/5 shadow-md"
                      : "border-slate-800/80 bg-slate-950"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                    <span className="text-[10px] font-mono text-slate-500 w-5 text-right font-semibold">{idx + 1}</span>
                    <p className={`text-sm font-sans truncate ${isActive ? "text-indigo-300 font-semibold" : isTapActive ? "text-yellow-400 font-semibold" : "text-slate-200"}`}>
                      {line.text}
                    </p>
                  </div>

                  {/* Timings Control */}
                  <div className="flex items-center gap-4 mt-2 md:mt-0 ml-8 md:ml-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Início</span>
                      <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 py-1 px-3 mt-1 shadow-inner">
                        <button
                          onClick={() => modifyTime(idx, "startTime", -0.5)}
                          className="text-xs font-mono text-slate-400 hover:text-red-400 px-1.5 hover:font-bold transition-colors cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <span className="text-xs font-mono text-indigo-400 font-semibold tracking-tight px-2 min-w-[50px] text-center">
                          {line.startTime.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => modifyTime(idx, "startTime", 0.5)}
                          className="text-xs font-mono text-slate-400 hover:text-emerald-400 px-1.5 hover:font-bold transition-colors cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Fim</span>
                      <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 py-1 px-3 mt-1 shadow-inner">
                        <button
                          onClick={() => modifyTime(idx, "endTime", -0.5)}
                          className="text-xs font-mono text-slate-400 hover:text-red-400 px-1.5 hover:font-bold transition-colors cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <span className="text-xs font-mono text-indigo-400 font-semibold tracking-tight px-2 min-w-[50px] text-center">
                          {line.endTime.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => modifyTime(idx, "endTime", 0.5)}
                          className="text-xs font-mono text-slate-400 hover:text-emerald-400 px-1.5 hover:font-bold transition-colors cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coluna Direita: Assistente de Toque (Tap Sync) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        
        {/* Caixa de Ação do Tap Sync */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col gap-6">
          <div>
            <h3 className="text-md font-sans font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              Sincronização por Toque
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Esqueça controles manuais! Toque no botão no exato momento em que cada frase inicia para ajustar dinamicamente.
            </p>
          </div>

          {!isTappingMode ? (
            <button
              id="start-tap-mode-btn"
              onClick={startTapMode}
              className="w-full py-4 px-4 bg-slate-800/80 hover:bg-slate-755 text-slate-200 rounded-xl border border-slate-700 hover:border-indigo-500/50 font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/5"
            >
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              Reset & Toque (Do Início)
            </button>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <span className="block text-[10px] font-mono text-slate-500 uppercase font-semibold">Linha Atual Mapeada:</span>
                <p className="text-sm text-yellow-550 font-bold mt-1 animate-pulse">
                  "{lines[tapActiveIndex]?.text || "Fim"}"
                </p>
                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  Próxima: "{lines[tapActiveIndex + 1]?.text || "Fim da música"}"
                </div>
              </div>

              {/* GRANDE BOTÃO DE TOQUE */}
              <motion.button
                id="tap-sync-action-btn"
                whileTap={{ scale: 0.96 }}
                onClick={handleTapSync}
                className="w-full h-32 rounded-xl flex flex-col items-center justify-center gap-3 text-white cursor-pointer bg-gradient-to-br from-indigo-600 to-indigo-550 shadow-xl shadow-indigo-600/20"
              >
                <span className="text-md font-sans font-black uppercase tracking-wider">MARCAR AGORA</span>
                <span className="text-[10px] font-mono text-indigo-100 opacity-80 bg-black/20 px-3 py-1 rounded-full">
                  [ Barra de Espaço ]
                </span>
              </motion.button>

              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Progresso: {tapActiveIndex}/{lines.length}</span>
                <button
                  onClick={() => setIsTappingMode(false)}
                  className="text-red-400 hover:text-red-350 hover:underline cursor-pointer font-medium"
                >
                  Cancelar Toque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Informações Auxiliares */}
        <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 mt-auto">
          <span className="block text-xs font-mono text-slate-450 mb-1 font-semibold">💡 Dica de Mapeamento:</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            Se a IA acertou a maioria dos tempos, você pode simplesmente usar as setas de ajuste fino de <b className="text-slate-400">[-0.5s]</b> e <b className="text-slate-400">[+0.5s]</b> para ajustar confortavelmente as transições!
          </p>
        </div>

        {/* Botões de Ação Final */}
        <div className="flex items-center gap-4 mt-4">
          <button
            id="align-back-btn"
            onClick={onPrev}
            className="flex-1 py-4 bg-slate-800/50 hover:bg-slate-705 text-slate-300 rounded-xl border border-slate-700 hover:border-slate-500 transition-all font-semibold cursor-pointer text-center text-sm"
          >
            Voltar
          </button>
          
          <button
            id="align-next-btn"
            onClick={saveAndNext}
            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xl shadow-indigo-600/20 font-semibold transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle className="w-5 h-5 text-indigo-200" />
            Salvar & Continuar
          </button>
        </div>

      </div>
    </div>
  );
}
