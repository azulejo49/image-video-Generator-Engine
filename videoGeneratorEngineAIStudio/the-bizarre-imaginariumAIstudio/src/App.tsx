/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Upload, Video, Image as ImageIcon, Play, Sparkles, AlertTriangle, Eye, Terminal, Clock } from 'lucide-react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type GenerationMode = 'text-to-video' | 'image-to-video' | 'video-to-video';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  // Code Block 1: UI Components State & Global States
  // The React state hooks below manage what mode we are in, text inputs, user media for Image-To-Video, and overall generation status.
  const [mode, setMode] = useState<GenerationMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isFreakifying, setIsFreakifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState('');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Code Block 2: Freakify API Call
  // Uses Gemini 3.1 Pro Preview to enhance user simple prompts into elaborate Director's cut descriptions 
  const handleFreakify = async () => {
    if (!prompt) return;
    setIsFreakifying(true);
    setError(null);
    try {
      let apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey === "undefined" || apiKey === "null" || !apiKey) {
         apiKey = "";
      }
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are the master of 'The Bizarre Imaginarium'. Your job is to take user prompts and expand them into highly descriptive, surreal, eerie, and visually striking "director's cut" video prompts. Do not use conversational filler, just return the vividly enhanced visual prompt. Focus on lighting, weird textures, impossible geometry, surrealism, and haunting aesthetics. Keep it strictly focused on visual generation.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: { systemInstruction }
      });

      setEnhancedPrompt(response.text || "");
    } catch (err: any) {
      let errorMsg = err.message || 'The video did not answer. Try again.';
      if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
        errorMsg = "Invalid Gemini API Key. Please select or configure a valid API Key.";
        if (window.aistudio?.openSelectKey) {
            window.aistudio.openSelectKey().catch(console.error);
        }
      }
      setError(errorMsg);
    } finally {
      setIsFreakifying(false);
    }
  };

  // Code Block 3: Video Generation Setup and Request 
  // Evaluates state and hits the backend to initiate Veo video generation.
  const handleGenerate = async () => {
    let finalPrompt = enhancedPrompt || prompt;
    
    // Connect selected duration and modifiers to the core app's prompt
    const duration = selectedDuration === 'Custom' ? customDuration : selectedDuration;
    if (duration) {
      finalPrompt += `, Duration: ${duration}`;
    }
    if (specialInstructions) {
      finalPrompt += `\nSpecial Instructions: ${specialInstructions}`;
    }
    if (selectedModifiers.length > 0) {
      finalPrompt += `, Modifiers: ${selectedModifiers.join(', ')}`;
    }

    if (!finalPrompt && mode === 'text-to-video') {
      setError("Please enter a concept to visualize.");
      return;
    }
    if ((mode === 'image-to-video' || mode === 'video-to-video') && !mediaFile) {
      setError("Please provide the source media.");
      return;
    }

    if (window.aistudio?.hasSelectedApiKey) {
       const hasKey = await window.aistudio.hasSelectedApiKey();
       if (!hasKey) {
          await window.aistudio.openSelectKey();
       }
    }

    let apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey === "undefined" || apiKey === "null" || !apiKey) {
       apiKey = "";
    }
    
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);

    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('mode', mode);
    if (mediaFile) {
       formData.append('media', mediaFile);
    }

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: apiKey ? { 'x-goog-api-key': apiKey } : {},
        body: formData,
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Non-JSON response from server:", text);
        throw new Error(res.ok ? "Server returned invalid response." : `Server error: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
      
      setVideoUrl(data.videoUrl);
    } catch (err: any) {
      let errorMsg = err.message || 'Generation failed. The connection to the bizarre domain was severed.';
      if (errorMsg.includes("Invalid Gemini API Key") || errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("Veo")) {
        if (window.aistudio?.openSelectKey) {
            window.aistudio.openSelectKey().catch(console.error);
        }
        errorMsg = "Your current API Key does not support Veo 2.0. Please use the Gemini app directly to generate this video.";
      }
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Code Block 4: UI View Render logic
  // Here we divide the screen into two main panes: the controls side and the canvas.
  return (
    <div className="bg-[#0A0A0A] text-white min-h-screen font-sans flex flex-col p-4 md:p-8">
      <div className="max-w-[1440px] w-full mx-auto flex flex-col flex-grow">
      {/* Header Navigation */}
      <header className="flex justify-between items-baseline border-b border-white/20 pb-4 mb-4 md:mb-8 shrink-0">
        <div className="text-xs tracking-[0.3em] font-medium uppercase">EST. 2026 / VOLUME 01</div>
        <nav className="hidden md:flex gap-12 text-[10px] uppercase tracking-widest">
          <span className="hover:line-through transition-all cursor-pointer">Manifesto</span>
          <span className="hover:line-through transition-all cursor-pointer">Archive</span>
          <span className="hover:line-through transition-all cursor-pointer">Lab</span>
          <span className="opacity-50 cursor-pointer">Membership</span>
        </nav>
      </header>

      {/* Main Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow">
        
        {/* Code Block 5: Action Controls (UI elements the user interacts with) */}
        {/* Left: Editorial Title & Controls */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <h1 className="text-5xl md:text-7xl font-serif italic leading-[0.85] tracking-tighter mb-6">
              The<br/>Bizarre<br/><span className="pl-4 md:pl-8">Imaginarium</span>
            </h1>
            <p className="text-xs text-white/60 leading-relaxed max-w-[280px] mb-8 md:mb-12">
              A neural gateway for the unconventional. Transmuting subconscious impulses into fluid visual nightmares.
            </p>

            {/* Application Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mb-6 p-4 border border-white/20 flex flex-col items-start gap-3"
                >
                  <div className="flex items-start gap-3 text-[10px] uppercase tracking-widest text-white/80">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p className="leading-tight">{error}</p>
                  </div>
                  {error.includes("Gemini app") && (
                    <a
                      href={`https://gemini.google.com/app?q=${encodeURIComponent('Create a video: ' + (enhancedPrompt || prompt))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-[10px] uppercase font-bold tracking-widest bg-white text-black px-4 py-2 hover:bg-white/90 transition-colors"
                    >
                       Open Gemini App (Video Generator)
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Media Upload Area (Conditional) */}
            <AnimatePresence mode="popLayout">
              {mode !== 'text-to-video' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div 
                    className={cn(
                      "border border-white/20 p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 relative group overflow-hidden bg-transparent hover:border-white",
                      previewUrl ? "border-white/50" : ""
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      accept={mode === 'image-to-video' ? "image/*" : "video/*"}
                      onChange={handleFileChange}
                    />
                    
                    {previewUrl ? (
                      <div className="relative w-full aspect-video z-0 flex items-center justify-center border border-white/10 p-2">
                        {mode === 'image-to-video' ? (
                          <img src={previewUrl} className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-30 transition-opacity" />
                        ) : (
                          <video src={previewUrl} className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-30 transition-opacity" muted loop playsInline />
                        )}
                        <div className="absolute inset-0 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-white text-black px-4 py-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                             <Upload size={12} /> Replace Media
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                          Provide Sacrifice
                        </p>
                        <p className="text-xs text-white/60 italic font-serif">
                          Click to select {mode === 'image-to-video' ? 'an image' : 'a video'} file
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generation Interface */}
            <div className="space-y-6">
              <div className="group border border-white/20 p-4 focus-within:border-white transition-colors relative">
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2 flex items-center justify-between">
                  <span>Subconscious Prompt</span>
                  {enhancedPrompt && <Sparkles size={10} className="text-white" />}
                </label>
                <textarea
                  className="bg-transparent w-full resize-none text-sm outline-none h-24 italic placeholder:text-white/20 font-serif"
                  placeholder="e.g. Victorian clockwork jellyfish dissolving into liquid static..."
                  value={enhancedPrompt || prompt}
                  onChange={(e) => {
                    if (enhancedPrompt) {
                      setEnhancedPrompt('');
                      setPrompt(e.target.value);
                    } else {
                      setPrompt(e.target.value);
                    }
                  }}
                />
                
                {!enhancedPrompt && (
                  <button
                    onClick={handleFreakify}
                    disabled={isFreakifying || !prompt}
                    className="absolute bottom-2 right-2 text-[9px] uppercase tracking-widest border border-white/20 px-3 py-1 bg-[#0A0A0A] text-white hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 z-10"
                  >
                    {isFreakifying ? 'Divining...' : 'Freakify'}
                  </button>
                )}
                {enhancedPrompt && (
                   <button 
                     onClick={() => setEnhancedPrompt('')}
                     className="absolute bottom-2 right-2 text-[9px] uppercase tracking-widest border border-white/20 px-3 py-1 bg-white text-black hover:bg-white/80 transition-colors z-10"
                   >
                     Revert
                   </button>
                )}
              </div>
              
              <div className="flex flex-col gap-4">
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/20 p-4 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 resize-y text-sm font-mono min-h-[80px]"
                  placeholder="[Optional] Special Instructions (e.g. dramatic lighting, slow motion, specific camera angle...)"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (!prompt && mode === 'text-to-video') || ((mode === 'image-to-video' || mode === 'video-to-video') && !mediaFile)}
                  className="w-full bg-white text-black py-4 text-[10px] uppercase font-bold tracking-widest hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? 'Transmuting...' : 'Ignite Evolution'}
                </button>
              </div>
            </div>
            {/* Code Block 8: Video Duration & Secondary Actions (UI) */}
            <div className="mt-8 space-y-6">
              {/* Duration Selector */}
              <div className="space-y-3">
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40">Duration of Video-Output</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['5 seconds', '10 seconds', 'Up to 1 min.', 'Up to 5 min.', 'Up to 10 min.'].map((dur, i) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedDuration(dur === selectedDuration ? null : dur)}
                      className={cn(
                        "border py-2 text-[10px] uppercase tracking-widest transition-colors",
                         selectedDuration === dur ? "border-white bg-white text-black font-bold" : "border-white/20 text-white hover:border-white/60 hover:bg-white/5"
                      )}
                    >
                      {dur}
                    </button>
                  ))}
                  
                  {/* Custom Duration Input */}
                  <div className="relative flex">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock size={12} className={selectedDuration === 'Custom' ? "text-black" : "text-white/40"} />
                    </div>
                    <input
                       type="text"
                       placeholder="Custom..."
                       value={customDuration}
                       onChange={(e) => {
                         setCustomDuration(e.target.value);
                         if (e.target.value && selectedDuration !== 'Custom') {
                             setSelectedDuration('Custom');
                         } else if (!e.target.value) {
                             setSelectedDuration(null);
                         }
                       }}
                       onFocus={() => {
                          if (selectedDuration !== 'Custom') setSelectedDuration('Custom');
                       }}
                       className={cn(
                         "w-full border py-2 pl-8 pr-2 text-[10px] uppercase tracking-widest transition-colors outline-none",
                         selectedDuration === 'Custom' ? "border-white bg-white text-black font-bold placeholder:text-black/50" : "border-white/20 bg-transparent text-white hover:border-white/60 placeholder:text-white/40"
                       )}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <label className="block text-[9px] uppercase tracking-[0.2em] text-white/40">Modifiers & Actions</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Create', 'Extend Video', 'Join this Scene', 'Transcript Editing',
                    'Face + Voice Swaps', 'Face Swaps ONLY', 'Change Non-Identity Characteristics',
                    'Language Translation (Regen)', 'Add Non-verbal Audio', 'Accent & Dialect Shifting (Regen)',
                    'Speech Speed Control (Regen)', 'Tone Changes (Regen)', 'Video Explainer'
                  ].map((action, j) => {
                    const isSelected = selectedModifiers.includes(action);
                    return (
                    <button 
                      key={j} 
                      onClick={() => setSelectedModifiers(prev => prev.includes(action) ? prev.filter(m => m !== action) : [...prev, action])}
                      className={cn(
                        "border px-3 py-1 text-[9px] uppercase tracking-wider transition-colors",
                        isSelected ? "border-white bg-white text-black font-bold" : "border-white/20 bg-[#0A0A0A] hover:bg-white/10"
                      )}
                    >
                      {action}
                    </button>
                  )})}
                </div>
              </div>
            </div>

          </div>

          <div className="hidden lg:block text-[10px] tracking-wider text-white/40 mt-8 uppercase">
            MODEL: {mode.toUpperCase()}-LATTICE-v4.2<br/>
            STATUS: {isGenerating ? 'PROCESSING' : 'IDLE'}
          </div>
        </div>

        {/* Code Block 6: Preview Canvas (Where the generated video is displayed) */}
        {/* Right: Preview Display & Mode Selector */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {/* Video / Preview Container */}
          <div className="relative flex-grow bg-[#111] border border-white/10 group overflow-hidden min-h-[400px] lg:min-h-0 flex items-center justify-center">
             {videoUrl ? (
                <video 
                  src={videoUrl} 
                  autoPlay 
                  loop 
                  controls 
                  className="w-full h-full object-contain"
                />
              ) : isGenerating ? (
                <GeneratingState />
              ) : (
                <div className="flex flex-col items-center gap-4 text-white/40 p-8 text-center max-w-sm">
                  <div className="font-serif italic text-xl">The canvas is video.</div>
                  <p className="text-[10px] uppercase tracking-widest">
                    Await the transmission to witness your reality fracture.
                  </p>
                </div>
              )}
            
            {/* Overlay Controls */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex gap-2">
              <span className="px-3 py-1 bg-white text-black text-[9px] font-bold uppercase tracking-tighter hidden md:block">4K CINEMATIC</span>
              <span className="px-3 py-1 border border-white/20 text-white text-[9px] font-bold uppercase tracking-tighter">{mode === 'text-to-video' ? 'TXT2VID' : mode === 'image-to-video' ? 'IMG2VID' : 'VID2VID'}</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-3 mt-4 lg:mt-8 border-t border-white/20 shrink-0">
             <ModeButton 
               active={mode === 'text-to-video'} 
               onClick={() => setMode('text-to-video')}
               number="01"
               label="Text-to-Video"
             />
             <ModeButton 
               active={mode === 'image-to-video'} 
               onClick={() => setMode('image-to-video')}
               number="02"
               label="Image-Video"
               className="border-l border-white/20 px-4 md:px-6"
             />
             <ModeButton 
               active={mode === 'video-to-video'} 
               onClick={() => setMode('video-to-video')}
               number="03"
               label="Video-to-Video"
               className="border-l border-white/20 px-4 md:px-6"
             />
          </div>
        </div>
      </main>

      {/* Bottom Metadata Rail */}
      <footer className="hidden md:flex justify-between items-end mt-8 pt-4 border-t border-white/10 shrink-0">
        <div className="flex gap-16">
            <div>
                <div className="text-[8px] text-white/40 uppercase mb-1 tracking-widest">Latent Space</div>
                <div className="text-[10px] tabular-nums tracking-widest">4.229.001.08</div>
            </div>
            <div>
                <div className="text-[8px] text-white/40 uppercase mb-1 tracking-widest">Energy Level</div>
                <div className="text-[10px] tabular-nums tracking-widest underline decoration-white/50">HIGH FLUX</div>
            </div>
        </div>
        <div className="text-[9px] text-white/40 italic flex items-center gap-2 uppercase">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-white' : 'bg-white/40'} ${isGenerating ? 'animate-pulse' : ''}`}></div>
            SYSTEMS {isGenerating ? 'TRANSMUTING / CONSUMING COMPUTE' : 'NOMINAL / WAITING FOR INPUT'}
        </div>
      </footer>
      </div>
    </div>
  );
}

// Code Block 7: Helper Components
// Reusable presentation elements such as ModeButton and GeneratingState loader

// Subcomponents

function ModeButton({ active, number, label, onClick, className }: { active: boolean, number: string, label: string, onClick: () => void, className?: string }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "py-4 md:py-6 group cursor-pointer hover:bg-white/5 transition-colors flex flex-col",
        active ? "opacity-100" : "opacity-40",
        className
      )}
    >
      <span className="text-[9px] block text-white/40 mb-1">MODE {number}</span>
      <span className={cn(
        "text-xs font-medium uppercase tracking-widest transition-all",
        active ? "underline underline-offset-8 pl-2" : "group-hover:pl-2"
      )}>
        {label}
      </span>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#050505] to-[#1a1a1a] flex items-center justify-center">
            <div className="w-4/5 h-4/5 border border-white/5 relative overflow-hidden">
                <motion.div 
                  className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"
                  animate={{ opacity: [0.1, 0.4, 0.1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/20"
                  animate={{ rotate: [45, 225] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
                <motion.div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/40"
                  animate={{ rotate: [-12, -192] }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                
                <div className="absolute bottom-8 left-8 flex items-end gap-4 text-white/80">
                    <div className="w-px h-12 bg-white/50"></div>
                    <div className="text-[20px] md:text-[40px] font-serif flex items-baseline gap-2 italic">
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      >
                         REC
                      </motion.span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
