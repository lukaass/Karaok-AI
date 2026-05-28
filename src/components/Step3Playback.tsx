import React, { useState } from "react";
import { KaraokeProject } from "../types";
import { Music, Image as ImageIcon, Sparkles, Upload, ArrowLeft, ArrowRight, Paintbrush, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Step3Props {
  project: KaraokeProject;
  updateProject: (updated: Partial<KaraokeProject>) => void;
  onPrev: () => void;
  onNext: () => void;
}

const PRESETS = [
  { name: "Cosmic Indigo", value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)" },
  { name: "Cyber Aurora", value: "linear-gradient(135deg, #18181b 0%, #2e1065 40%, #064e3b 100%)" },
  { name: "Warm Sunset", value: "linear-gradient(135deg, #09090b 0%, #450a0a 50%, #180828 100%)" },
  { name: "Acoustic Teal", value: "linear-gradient(135deg, #020617 0%, #032b30 65%, #1e1b4b 100%)" },
];

export default function Step3Playback({ project, updateProject, onPrev, onNext }: Step3Props) {
  const [bgType, setBgType] = useState<"gradient" | "custom" | "ai">(project.bgType || "gradient");
  const [bgValue, setBgValue] = useState<string>(project.bgValue || PRESETS[0].value);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Playback drag state
  const [playbackDragActive, setPlaybackDragActive] = useState(false);
  const [highlightMode, setHighlightMode] = useState<"progressive" | "simple">(project.highlightMode || "progressive");

  // Playback upload
  const handlePlaybackUpload = (file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("Por favor, envie um arquivo de áudio válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    updateProject({
      playbackAudioUrl: url,
      playbackAudioName: file.name,
    });
    setError(null);
  };

  const handleCustomBgUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, envie um arquivo de imagem válido (PNG, JPG, JPEG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      setBgType("custom");
      setBgValue(b64);
    };
    reader.readAsDataURL(file);
  };

  // Generate background from IA
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      setError("Digite uma descrição de imagem antes de continuar.");
      return;
    }
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!response.ok) {
        let msg = "Erro de processamento da imagem.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            msg = errData.error;
          }
        } catch (inner) {}
        throw new Error(msg);
      }

      const data = await response.json();
      setBgType("ai");
      setBgValue(data.imageUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não foi possível gerar a imagem do plano de fundo com IA. Sinta-se à vontade para escolher uma das paletas dinâmicas abaixo ou enviar a sua foto.");
    } finally {
      setGenerating(false);
    }
  };

  const selectGradient = (val: string) => {
    setBgType("gradient");
    setBgValue(val);
  };

  const finishStep = () => {
    if (!project.playbackAudioUrl) {
      setError("Faça o upload do Playback (áudio instrumental) para criar o karaokê final.");
      return;
    }
    updateProject({
      bgType,
      bgValue,
      highlightMode,
    });
    onNext();
  };

  return (
    <div id="step-3-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto py-4">
      
      {/* Coluna Esquerda: Playback Track e Temas Estáticos */}
      <div className="lg:col-span-7 flex flex-col gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10">
        <div className="border-b border-slate-800 pb-4">
          <span className="text-[10px] font-mono text-indigo-400 font-semibold tracking-wider uppercase">Passo 3 de 4</span>
          <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2 mt-0.5">
            <Music className="w-5 h-5 text-indigo-400" />
            Playback do Karaokê
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Forneça a trilha de playback (música instrumental ou base sem vocal) e configure o visual de fundo estático.
          </p>
        </div>

        {/* Upload de Playback */}
        <div className="flex flex-col gap-3">
          <label className="block text-xs font-mono text-slate-450 uppercase tracking-wider font-bold">Passo 1: Upload do Playback</label>
          <div
            id="drag-drop-zone-playback"
            onDragEnter={(e) => { e.preventDefault(); setPlaybackDragActive(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setPlaybackDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setPlaybackDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handlePlaybackUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              playbackDragActive
                ? "border-indigo-500 bg-indigo-500/10"
                : project.playbackAudioUrl
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "border-slate-800 bg-slate-955 hover:border-slate-700/80"
            }`}
            onClick={() => document.getElementById("playback-file-input")?.click()}
          >
            <input
              id="playback-file-input"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handlePlaybackUpload(e.target.files[0]);
                }
              }}
            />

            <div className={`p-3.5 rounded-xl mb-3 ${project.playbackAudioUrl ? "bg-emerald-500/10" : "bg-slate-805"}`}>
              <Music className={`w-8 h-8 ${project.playbackAudioUrl ? "text-emerald-400" : "text-indigo-450"}`} />
            </div>

            {project.playbackAudioUrl ? (
              <div className="flex flex-col gap-0.5 max-w-full">
                <span className="text-sm text-emerald-450 font-semibold animate-pulse">Playback carregado!</span>
                <span className="text-xs text-slate-450 font-mono truncate px-4">
                  {project.playbackAudioName}
                </span>
                <span className="text-xs text-indigo-400 hover:underline mt-2">Mudar arquivo de playback</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-slate-300 font-medium">Arraste a música instrumental ou clique aqui</span>
                <span className="text-xs text-slate-500 font-mono">Suporta qualquer arquivo de áudio de fundo</span>
              </div>
            )}
          </div>
        </div>

        {/* Escolha do Visual de Fundo */}
        <div className="flex flex-col gap-4 mt-2">
          <label className="block text-xs font-mono text-slate-450 uppercase tracking-wider font-bold">Passo 2: Escolha de Fundo Estático</label>
          
          {/* Navegação de Tipo de Background */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
            <button
              onClick={() => setBgType("gradient")}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                bgType === "gradient" ? "bg-slate-900 border border-slate-800 text-indigo-400 shadow-inner" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              Gradients
            </button>
            <button
              onClick={() => setBgType("ai")}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                bgType === "ai" ? "bg-slate-900 border border-slate-800 text-indigo-400 shadow-inner" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gerar com IA
            </button>
            <button
              onClick={() => setBgType("custom")}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                bgType === "custom" ? "bg-slate-900 border border-slate-800 text-indigo-400 shadow-inner" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Customizado
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* GRADIENT PRESETS */}
            {bgType === "gradient" && (
              <motion.div
                key="gradient"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="grid grid-cols-2 gap-3"
              >
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => selectGradient(p.value)}
                    style={{ background: p.value }}
                    className={`h-20 rounded-xl relative border cursor-pointer group shadow-md transition-all ${
                      bgValue === p.value ? "border-white ring-2 ring-indigo-500/20 scale-[1.01]" : "border-slate-800 hover:border-slate-500"
                    }`}
                  >
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono font-semibold bg-black/60 text-white px-2.5 py-1 rounded-lg backdrop-blur-sm">
                      {p.name}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}

            {/* GENERATE BACK WITH AI */}
            {bgType === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-col gap-3"
              >
                <div className="flex gap-2">
                  <input
                    id="ai-prompt-input"
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: A synthwave retro grid at sunset with purple palm trees and space sky"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/10 transition-all"
                  />
                  <button
                    onClick={handleGenerateAI}
                    disabled={generating}
                    className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    {generating ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full"
                      />
                    ) : (
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                    )}
                    Gerar
                  </button>
                </div>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  Gerado pelo modelo <b className="text-slate-400">gemini-2.5-flash-image</b>. Use termos em inglês para melhores resultados estéticos!
                </p>
              </motion.div>
            )}

            {/* CUSTOM IMAGE UPLOAD */}
            {bgType === "custom" && (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="grid grid-cols-1"
              >
                <div
                  id="custom-bg-dropzone"
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCustomBgUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById("bg-file-input")?.click()}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-955 hover:border-slate-700/85"
                  }`}
                >
                  <input
                    id="bg-file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCustomBgUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <ImageIcon className="w-8 h-8 text-indigo-400 mb-2" />
                  <span className="text-sm text-slate-300 font-medium">Faça o upload do seu cartão de fundo</span>
                  <span className="text-xs text-slate-500 font-mono mt-0.5">Suporta PNG, JPG e JPEG de alta qualidade</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Estilo do Destaque da Letra (Novo) */}
        <div className="flex flex-col gap-3 mt-4 border-t border-slate-800/80 pt-5">
          <label className="block text-xs font-mono text-slate-450 uppercase tracking-wider font-bold">Passo 3: Estilo de Destaque da Letra</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHighlightMode("progressive")}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                highlightMode === "progressive"
                  ? "border-indigo-505 bg-indigo-950/20 ring-1 ring-indigo-500/20"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-850"
              }`}
            >
              <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                Progressivo (Varrer)
              </span>
              <span className="text-[11px] text-slate-400 font-sans leading-normal">
                A letra é preenchida gradualmente em amarelo da esquerda para a direita de acordo com o compasso da música.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setHighlightMode("simple")}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                highlightMode === "simple"
                  ? "border-indigo-550/60 bg-indigo-950/20 ring-1 ring-indigo-500/20"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-850"
              }`}
            >
              <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                Destaque Simples (Frase)
              </span>
              <span className="text-[11px] text-slate-400 font-sans leading-normal">
                A frase inteira ganha cor de destaque (amarelo) imediatamente assim que o tempo dela começa, sem preenchimento gradual.
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* Coluna Direita: Prévia do Estilo de Imagem */}
      <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
        
        {/* Painel de Visualização Estático Real */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col gap-5 flex-1 justify-between">
          <div>
            <h3 className="text-md font-sans font-bold text-white">Visualização de Tela</h3>
            <p className="text-xs text-slate-400 mt-1">
              Esta é a tela estática que será gravada para sobrepor a letra do seu karaokê final.
            </p>
          </div>

          <div
            id="karaoke-static-preview"
            style={{
              backgroundImage: bgType === "gradient" ? bgValue : `url(${bgValue})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            className="aspect-video w-full rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center p-6 relative shadow-inner"
          >
            {/* Sombra de letras tradicional no karaokê */}
            <div className="absolute inset-0 bg-black/25 pointer-events-none" />

            <div className="text-center z-10 select-none">
              <span className="text-[10px] font-mono text-indigo-300 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-850 tracking-wider font-bold">
                PRÉVIA DO LAYOUT: {highlightMode === "progressive" ? "PROGRESSIVO" : "DESTAQUE SIMPLES"}
              </span>
              
              <div className="flex flex-col items-center mt-3.5">
                {highlightMode === "progressive" ? (
                  <div className="relative inline-block text-xl font-sans font-black text-white px-2 tracking-tight leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap">
                    {/* Background white text */}
                    <span className="opacity-40">Olha que coisa mais linda</span>
                    {/* Golden progress overlay */}
                    <div className="absolute left-2 top-0 bottom-0 overflow-hidden whitespace-nowrap text-yellow-400" style={{ width: "55%" }}>
                      Olha que coisa mais linda
                    </div>
                  </div>
                ) : (
                  <p className="text-xl font-sans font-black text-yellow-400 tracking-tight leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    Olha que coisa mais linda
                  </p>
                )}
                
                <p className="text-sm font-sans font-medium text-slate-400 opacity-60 leading-normal drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] mt-1.5">
                  Mais cheia de graça
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-350 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Botões de Ação Final do Passo 3 */}
          <div className="flex gap-4 mt-6">
            <button
              id="playback-back-btn"
              onClick={onPrev}
              className="flex-1 py-4 bg-slate-800/50 hover:bg-slate-705 text-slate-300 rounded-xl border border-slate-700 hover:border-slate-500 transition-all font-semibold cursor-pointer text-center text-sm"
            >
              Voltar
            </button>
            <button
              id="playback-next-btn"
              onClick={finishStep}
              className="flex-1 py-4 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl shadow-xl shadow-indigo-650/20 font-semibold transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
