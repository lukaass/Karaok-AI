import React, { useState } from "react";
import { KaraokeProject } from "../types";
import { Music, FileText, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface Step1Props {
  project: KaraokeProject;
  updateProject: (updated: Partial<KaraokeProject>) => void;
  onNext: () => void;
}

const TEMPLATE_SONGS = [
  {
    title: "Garota de Ipanema",
    artist: "Antônio Carlos Jobim & Vinícius de Moraes",
    lyrics: `Olha que coisa mais linda
Mais cheia de graça
É ela, menina
Que vem e que passa
Num doce balanço
A caminho do mar

Moça do corpo dourado
Do sol de Ipanema
O seu balançado
É mais que um poema
É a coisa mais linda
Que eu já vi passar`,
  },
  {
    title: "Parabéns a Você",
    artist: "Tradicional brasileiro",
    lyrics: `Parabéns a você
Nesta data querida
Muitas felicidades
Anos de vida

É big, é big
É big, é big, é big
É hora, é hora
É hora, é hora, é hora
Rá-tim-bum!`,
  }
];

export default function Step1Lyrics({ project, updateProject, onNext }: Step1Props) {
  const [lyricsText, setLyricsText] = useState(project.lyrics || "");
  const [title, setTitle] = useState(project.title || "");
  const [artist, setArtist] = useState(project.artist || "");
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAudioUpload = (file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("Por favor, selecione um arquivo de áudio válido (MP3, WAV, etc.).");
      return;
    }
    const url = URL.createObjectURL(file);
    updateProject({
      originalAudioUrl: url,
      originalAudioName: file.name,
    });
    setError(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudioUpload(e.dataTransfer.files[0]);
    }
  };

  const loadTemplate = (idx: number) => {
    const template = TEMPLATE_SONGS[idx];
    setTitle(template.title);
    setArtist(template.artist);
    setLyricsText(template.lyrics);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!lyricsText.trim()) {
      setError("Insira a letra da música antes de continuar.");
      return;
    }
    if (!project.originalAudioUrl) {
      setError("Faça o upload da música original para análise.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artist,
          lyrics: lyricsText,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha na chamada da API para analisar a letra.");
      }

      const data = await response.json();
      
      // Map response lines to state
      const processedLines = (data.lines || []).map((l: any, i: number) => ({
        id: `line_${Date.now()}_${i}`,
        text: l.text,
        startTime: l.startTime,
        endTime: l.endTime,
      }));

      updateProject({
        title,
        artist,
        lyrics: lyricsText,
        lines: processedLines,
      });

      onNext();
    } catch (err: any) {
      console.error(err);
      setError("Não foi possível alinhar a letra de forma automática. Continuando com rascunho de tempos neutro...");
      
      // Fallback: split into lines and add 5s gaps
      const defaultLines = lyricsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text, i) => ({
          id: `line_${Date.now()}_${i}`,
          text,
          startTime: i * 5,
          endTime: i * 5 + 4,
        }));

      updateProject({
        title,
        artist,
        lyrics: lyricsText,
        lines: defaultLines,
      });

      // Show temporary and still proceed
      setTimeout(() => {
        onNext();
      }, 1500);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div id="step-1-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto py-4">
      {/* Esquerda: Formulário de Informações */}
      <div className="lg:col-span-7 flex flex-col gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10">
        <div>
          <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Letra & Informações
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Forneça a música original para análise do tempo e a respectiva letra.
          </p>
        </div>

        {/* Templates Rápidos */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-mono">Exemplos Rápidos:</span>
          {TEMPLATE_SONGS.map((song, idx) => (
            <button
              key={idx}
              id={`template-btn-${idx}`}
              onClick={() => loadTemplate(idx)}
              className="text-xs font-mono bg-slate-800/50 hover:bg-slate-700/70 text-slate-300 px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer"
            >
              🚀 {song.title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-450 mb-1.5">Título da Música</label>
            <input
              id="title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Garota de Ipanema"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-450 mb-1.5">Artista / Banda</label>
            <input
              id="artist-input"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ex: Tom Jobim"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <label className="block text-xs font-mono text-slate-450 mb-1.5">Letra da Música (Copie e cole aqui)</label>
          <textarea
            id="lyrics-textarea"
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            placeholder="Cole a letra linha por linha..."
            rows={10}
            className="w-full flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500/80 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none font-sans leading-relaxed min-h-[220px]"
          />
        </div>
      </div>

      {/* Direita: Importação de Áudio Original e Análise */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* Upload de Música Original */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/10 flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-400" />
              Música Original
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Forneça o arquivo de áudio original para que a IA possa analisar e mapear o tempo da letra com precisão.
            </p>
          </div>

          <div
            id="drag-drop-zone-original"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive
                ? "border-indigo-500 bg-indigo-500/10"
                : project.originalAudioUrl
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "border-slate-800 bg-slate-955 hover:border-slate-700/80"
            }`}
            onClick={() => document.getElementById("audio-file-input")?.click()}
          >
            <input
              id="audio-file-input"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleAudioUpload(e.target.files[0]);
                }
              }}
            />

            <div className={`p-4 rounded-xl mb-3 ${project.originalAudioUrl ? "bg-emerald-500/10" : "bg-slate-800"}`}>
              <Music className={`w-8 h-8 ${project.originalAudioUrl ? "text-emerald-400" : "text-indigo-400"}`} />
            </div>

            {project.originalAudioUrl ? (
              <div className="flex flex-col gap-1 max-w-full">
                <span className="text-sm text-emerald-450 font-semibold">Áudio carregado!</span>
                <span className="text-xs text-slate-400 font-mono truncate px-4">
                  {project.originalAudioName}
                </span>
                <span className="text-xs text-indigo-400 hover:underline mt-2">Clique para trocar</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-slate-300 font-medium">Arraste a música ou clique aqui</span>
                <span className="text-xs text-slate-500 font-mono">Suporta MP3, WAV, M4A, etc.</span>
              </div>
            )}
          </div>

          {project.originalAudioUrl && (
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-850">
              <span className="block text-[10px] font-mono text-slate-500 uppercase mb-1.5">Prévia do Áudio</span>
              <audio id="original-audio-player" src={project.originalAudioUrl} controls className="w-full h-8" />
            </div>
          )}
        </div>

        {/* Alerta / Erros */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl flex gap-3 text-sm ${
              error.includes("Continuando")
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                : "bg-red-500/10 border border-red-500/20 text-red-350"
            }`}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Botão de Estimar / Continuar */}
        <button
          id="analyze-submit-button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className={`w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 font-semibold transition-all cursor-pointer shadow-xl ${
            analyzing
              ? "bg-indigo-700/50 text-slate-300 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-[0.99]"
          }`}
        >
          {analyzing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-slate-300 border-t-white rounded-full"
              />
              <span>Analisando e Alinhando com Inteligência Artificial...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
              <span>Analisar Letra & Mapear Tempos</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 mt-auto">
          <span className="block text-xs font-mono text-slate-400 mb-1">💡 Como funciona:</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nossa IA analisa a estrutura das palavras e prevê o ritmo de canto para criar um rascunho de tempos inicial. No próximo passo, você poderá refinar e ajustar perfeitamente o tempo ouvindo o áudio!
          </p>
        </div>
      </div>
    </div>
  );
}
