import { useState } from "react";
import { KaraokeProject, AppStep } from "./types";
import Step1Lyrics from "./components/Step1Lyrics";
import Step2Align from "./components/Step2Align";
import Step3Playback from "./components/Step3Playback";
import Step4Export from "./components/Step4Export";
import { Music, AlertTriangle, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const INITIAL_PROJECT: KaraokeProject = {
  title: "",
  artist: "",
  originalAudioUrl: null,
  originalAudioName: null,
  playbackAudioUrl: null,
  playbackAudioName: null,
  lyrics: "",
  lines: [],
  bgType: "gradient",
  bgValue: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
  highlightMode: "progressive",
  lyricFontSize: 34,
  videoExportedUrl: null,
};

export default function App() {
  const [project, setProject] = useState<KaraokeProject>(INITIAL_PROJECT);
  const [step, setStep] = useState<AppStep>("INFO");

  const updateProject = (updated: Partial<KaraokeProject>) => {
    setProject((prev) => ({ ...prev, ...updated }));
  };

  const handleReset = () => {
    // Revoke any loaded object URLs to clean memory
    if (project.originalAudioUrl) URL.revokeObjectURL(project.originalAudioUrl);
    if (project.playbackAudioUrl) URL.revokeObjectURL(project.playbackAudioUrl);
    if (project.bgValue && project.bgValue.startsWith("blob:")) URL.revokeObjectURL(project.bgValue);
    
    setProject(INITIAL_PROJECT);
    setStep("INFO");
  };

  const stepsList: { key: AppStep; label: string; desc: string }[] = [
    { key: "INFO", label: "Musica & Letra", desc: "Análise inteligente" },
    { key: "ALIGN", label: "Sincronizador", desc: "Ajuste manual ou toque" },
    { key: "PLAYBACK", label: "Base & Plano de Fundo", desc: "IA ou customizado" },
    { key: "EXPORT", label: "Exportador", desc: "Composição final" },
  ];

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative overflow-hidden selection:bg-indigo-550/30 selection:text-white">
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-650/5 blur-[120px] pointer-events-none" />

      {/* Main Studio Header */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleReset}>
          <div className="w-10 h-10 bg-indigo-650 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-650/20 transition-transform active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">EchoSync Studio</h1>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Karaoke Video Generator</p>
          </div>
        </div>

        {/* Steps navigation aligned in center/right */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-3 bg-slate-950/70 p-1 rounded-xl border border-slate-850">
            {stepsList.map((s, idx) => {
              const isActive = s.key === step;
              const isPast = stepsList.findIndex((item) => item.key === step) > idx;

              return (
                <div key={s.key} className="flex items-center">
                  <button
                    onClick={() => {
                      if (isPast || s.key === "INFO" || (project.lines.length > 0 && idx <= stepsList.findIndex(item => item.key === step))) {
                        setStep(s.key);
                      }
                    }}
                    disabled={project.lines.length === 0 && s.key !== "INFO"}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-all text-xs font-medium cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-indigo-400 border border-slate-800 shadow-inner"
                        : isPast
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <span className="opacity-60 font-mono">0{idx + 1}</span>
                    <span>{s.label.split(" ")[0]}</span>
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="px-3.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {step === "EXPORT" ? "PRONTO PARA EXPORTAR" : "SESSÃO ATIVA"}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Workbench */}
      <main className="flex-1 px-4 md:px-8 py-6 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full"
          >
            {step === "INFO" && (
              <Step1Lyrics
                project={project}
                updateProject={updateProject}
                onNext={() => setStep("ALIGN")}
              />
            )}
            {step === "ALIGN" && (
              <Step2Align
                project={project}
                updateProject={updateProject}
                onPrev={() => setStep("INFO")}
                onNext={() => setStep("PLAYBACK")}
              />
            )}
            {step === "PLAYBACK" && (
              <Step3Playback
                project={project}
                updateProject={updateProject}
                onPrev={() => setStep("ALIGN")}
                onNext={() => setStep("EXPORT")}
              />
            )}
            {step === "EXPORT" && (
              <Step4Export
                project={project}
                onReset={handleReset}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Informacional */}
      <footer className="border-t border-slate-950 py-4 px-6 bg-slate-950/20 text-center font-mono text-[10px] text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} Karaokê AI Studio. Todos os dados temporários são purgados após a criação do vídeo.</span>
          <div className="flex gap-4">
            <span className="text-slate-500 hover:text-slate-400">Offline-First Renderer</span>
            <span className="text-slate-500">Gemini Generative System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
