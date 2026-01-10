import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
    analyzeImageSafety, generateStorySegment, loginUser, registerUser,
    saveUserKey, getUserInfo, signInWithGoogle, supabase, syncGoogleUser
} from './services/AiService';
import { User, LogOut, Settings, Key, Lock, Mail, Eye, EyeOff, ArrowRight, Trash2, ShieldCheck, Upload, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';

const App = () => {
    const [step, setStep] = useState('upload');
    const [images, setImages] = useState([]);
    const [tone, setTone] = useState('Adventure');
    const [story, setStory] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [processingStep, setProcessingStep] = useState('');

    // Auth & User State
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [isAuthOpen, setIsAuthOpen] = useState(!localStorage.getItem('token'));
    const [authMode, setAuthMode] = useState('login'); // login, register
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [authForm, setAuthForm] = useState({ email: '', password: '' });
    const [userGeminiKey, setUserGeminiKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // 1. Check for local token (Email/Pass users)
        if (token) {
            fetchUserProfile();
        }

        // 2. Listen for Auth Changes (Handles Google OAuth Redirects & Logins)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !token) {
                console.log('[Auth] Google Session detected, syncing...');
                try {
                    const data = await syncGoogleUser(session.user.email);
                    localStorage.setItem('token', data.token);
                    setToken(data.token);
                    setHasKey(data.hasKey);
                    setIsAuthOpen(false);
                } catch (err) {
                    setError('Failed to sync Google account');
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [token]);

    const fetchUserProfile = async () => {
        try {
            const data = await getUserInfo(token);
            setUser(data);
            setHasKey(data.hasKey);
        } catch (err) {
            handleLogout();
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const service = authMode === 'login' ? loginUser : registerUser;
            const data = await service(authForm.email, authForm.password);

            if (authMode === 'login') {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                setHasKey(data.hasKey);
                setIsAuthOpen(false);
            } else {
                setAuthMode('login');
                alert('Registration successful! Please login.');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (err) {
            setError('Google sign in failed');
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('token');
        await supabase.auth.signOut();
        setToken(null);
        setUser(null);
        setIsAuthOpen(true);
        setStep('upload');
        setImages([]);
        setStory([]);
    };

    const handleSaveKey = async (e) => {
        e.preventDefault();
        try {
            await saveUserKey(token, userGeminiKey);
            setHasKey(true);
            setIsSettingsOpen(false);
            setUserGeminiKey('');
            alert('API Key saved securely!');
        } catch (err) {
            alert(err.message);
        }
    };
    const onDrop = (acceptedFiles) => {
        const newImages = acceptedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            id: Math.random().toString(36).substr(2, 9),
            status: 'pending', // pending, safe, unsafe
        }));
        setImages(prev => [...prev, ...newImages].slice(0, 20));
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 20
    });

    const runSafetyChecks = async () => {
        setStep('processing');
        const updatedImages = [...images];

        for (let i = 0; i < updatedImages.length; i++) {
            setProcessingStep(`Scanning Safety: ${updatedImages[i].file.name}...`);
            const result = await analyzeImageSafety(updatedImages[i].file, token);

            if (result.safe) {
                setProcessingStep(`Studying Subject & Mood...`);
                await new Promise(r => setTimeout(r, 800)); // Extra "study" time
            }

            updatedImages[i].status = result.safe ? 'safe' : 'unsafe';
            updatedImages[i].metadata = result.metadata;
            updatedImages[i].reason = result.reason;
            setImages([...updatedImages]);
        }

        setStep('review');
        setProcessingStep('');
    };

    const generateStory = async () => {
        setStep('story');
        setIsGenerating(true);
        const safeImages = images.filter(img => img.status === 'safe');
        let storySegments = [];

        for (let i = 0; i < safeImages.length; i++) {
            const segment = await generateStorySegment(safeImages[i].metadata, tone, storySegments.join(' '), i, token);
            storySegments.push(segment);
            setStory([...storySegments]);
        }

        setIsGenerating(false);
        confetti();
    };

    const handleShare = async () => {
        const shareData = {
            title: 'My ImagiStory Journey',
            text: `Check out my ${tone} travel story! \n\n ${story.join('\n\n')}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.text);
                alert('Story copied to clipboard!');
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    };

    const downloadPDF = async () => {
        const doc = new jsPDF();
        const safeImages = images.filter(img => img.status === 'safe');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(79, 70, 229); // Primary Indigo
        doc.text("My ImagiStory Journey", 20, 25);

        doc.setFontSize(14);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139);
        doc.text(`A ${tone} Odyssey`, 20, 35);

        let y = 50;
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const textWidth = 100;
        const imgWidth = 60;
        const spacing = 10;

        for (let i = 0; i < story.length; i++) {
            const segment = story[i].replace(/\*\*/g, '').replace(/\*/g, ''); // Clean markdown
            const img = safeImages[i];

            // Check if we need a new page
            if (y > 220) {
                doc.addPage();
                y = 25;
            }

            // Draw Segment Index
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`CHAPTER ${i + 1}`, margin, y);
            y += 8;

            // Draw Text (Left)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            const lines = doc.splitTextToSize(segment, textWidth);
            doc.text(lines, margin, y);

            const textHeight = (lines.length * 7);

            // Draw Image (Right)
            if (img) {
                try {
                    // We can use the blob URL directly or convert to base64
                    // Since it's local, standard fetch works
                    const imgResponse = await fetch(img.preview);
                    const blob = await imgResponse.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });

                    doc.addImage(base64, 'JPEG', margin + textWidth + spacing, y - 5, imgWidth, imgWidth * 0.75);
                } catch (e) {
                    console.error("PDF Image Error:", e);
                }
            }

            y += Math.max(textHeight, 50) + 20;
        }

        doc.save("my-travel-story.pdf");
    };

    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    return (
        <div className="app-container">
            <header className="flex justify-between items-center px-8 py-6">
                <div>
                    <motion.h1
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                    >
                        ImagiStory AI
                    </motion.h1>
                    <p className="text-muted text-xs">Transform memories into epic narratives</p>
                </div>

                {user && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${!hasKey ? 'bg-red-500/10 text-red-500 animate-pulse' : 'hover:bg-white/5 text-muted hover:text-white'}`}
                        >
                            <Settings size={20} />
                            {!hasKey && <span className="text-xs font-bold">Add API Key</span>}
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <User size={14} className="text-primary" />
                            <span className="text-sm font-medium text-slate-300">{user.email.split('@')[0]}</span>
                        </div>
                        <button onClick={handleLogout} className="p-2 text-muted hover:text-red-400 transition-colors">
                            <LogOut size={20} />
                        </button>
                    </div>
                )}
            </header>

            <main className="wizard-card">
                <AnimatePresence mode="wait">
                    {step === 'upload' && (
                        <motion.div
                            key="upload"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                        >
                            <div {...getRootProps()} className="dropzone">
                                <input {...getInputProps()} />
                                <Upload size={48} className="mb-4 text-primary" />
                                <h3>{isDragActive ? "Drop them here!" : "Upload your vacation photos"}</h3>
                                <p className="text-muted">Drag & drop or click to select (Max 20)</p>
                            </div>

                            {images.length > 0 && (
                                <div className="mt-8">
                                    <div className="image-grid">
                                        {images.map(img => (
                                            <div key={img.id} className="preview-thumb">
                                                <img src={img.preview} alt="preview" />
                                                <button onClick={() => removeImage(img.id)} className="remove-btn">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={runSafetyChecks} className="btn btn-primary w-full">
                                        Proceed to Safety Check <ArrowRight size={18} className="inline ml-2" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 'processing' && (
                        <motion.div key="processing" className="text-center py-20">
                            <ShieldCheck size={64} className="mx-auto mb-6 text-primary animate-pulse" />
                            <h2>Deep Image Analysis</h2>
                            <p className="text-secondary mb-2">{processingStep || "Google Cloud Vision is analyzing your photos..."}</p>
                            <p className="text-muted text-sm mb-8">Detecting subjects, lighting, and cultural sentiments...</p>
                            <div className="image-grid opacity-50">
                                {images.map(img => (
                                    <div key={img.id} className={`preview-thumb ${img.status === 'pending' ? 'processing' : ''}`}>
                                        <img src={img.preview} alt="preview" />
                                        {img.status === 'safe' && <ShieldCheck className="safety-badge text-green-500" />}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 'review' && (
                        <motion.div key="review">
                            <h2>Review Your Photos</h2>
                            <p className="text-muted mb-6">Select the tone for your story before we begin.</p>

                            <div className="tone-selector flex gap-4 mb-8">
                                {['Adventure', 'Romantic', 'Humorous', 'Mysterious', 'Inspirational'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTone(t)}
                                        className={`btn ${tone === t ? 'btn-primary' : 'btn-secondary'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="image-grid">
                                {images.map(img => (
                                    <div key={img.id} className={`preview-thumb ${img.status === 'unsafe' ? 'opacity-30 border-red-500' : ''}`}>
                                        <img src={img.preview} alt="preview" />
                                        {img.status === 'unsafe' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-2 text-center text-[10px] text-red-400">
                                                {img.reason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button onClick={() => setStep('upload')} className="btn btn-secondary">Back</button>
                                <button
                                    onClick={() => hasKey ? generateStory() : setIsSettingsOpen(true)}
                                    className="btn btn-primary flex-grow"
                                >
                                    {hasKey ? 'Generate AI Story' : 'Add API Key to Generate'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'story' && (
                        <motion.div key="story">
                            <div className="flex justify-between items-center mb-8">
                                <h2>Your {tone} Odyssey</h2>
                                <div className="flex gap-2">
                                    <button onClick={downloadPDF} className="btn btn-secondary"><Download size={18} /></button>
                                    <button onClick={handleShare} className="btn btn-secondary"><Share2 size={18} /></button>
                                </div>
                            </div>

                            <div className="story-timeline space-y-12">
                                {story.map((segment, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={i}
                                        className="flex gap-8 items-start"
                                    >
                                        <div className="w-1/3 rounded-2xl overflow-hidden shadow-xl border-4 border-white/10">
                                            <img src={images.filter(img => img.status === 'safe')[i]?.preview} alt="scene" className="w-full" />
                                        </div>
                                        <div className="w-2/3 pt-4">
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-xs uppercase font-bold tracking-widest bg-primary-soft text-primary px-2 py-half rounded-full">
                                                    {images.filter(img => img.status === 'safe')[i]?.metadata?.sentiment}
                                                </span>
                                                <span className="text-xs uppercase font-bold tracking-widest bg-secondary-soft text-secondary px-2 py-half rounded-full">
                                                    {images.filter(img => img.status === 'safe')[i]?.metadata?.lighting}
                                                </span>
                                            </div>
                                            <div className="text-lg leading-relaxed font-light italic text-slate-200">
                                                {segment.split('**').map((part, idx) =>
                                                    idx % 2 === 1 ? <strong key={idx} className="text-white font-semibold">{part}</strong> :
                                                        part.split('*').map((subPart, subIdx) =>
                                                            subIdx % 2 === 1 ? <em key={subIdx} className="text-primary-light">{subPart}</em> : subPart
                                                        )
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                                {isGenerating && (
                                    <div className="text-center py-8">
                                        <div className="animate-bounce inline-block">🖋️</div>
                                        <p className="text-muted">Gemini is weaving your memories into words...</p>
                                    </div>
                                )}
                            </div>

                            {!isGenerating && (
                                <button onClick={() => setStep('upload')} className="btn btn-primary w-full mt-12">Create New Story</button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <footer className="mt-8 text-center text-muted text-sm px-4">
                <p>🔒 Privacy Checked: Your personal Gemini API key is encrypted and used only for your requests.</p>
            </footer>

            {/* Auth Modal */}
            <AnimatePresence>
                {isAuthOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full"
                        >
                            <h2 className="text-center mb-2">{authMode === 'login' ? 'Welcome Back' : 'Join ImagiStory'}</h2>
                            <p className="text-center text-muted text-sm mb-8">Login to manage your own Gemini API keys</p>

                            <form onSubmit={handleAuth} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={authForm.email}
                                            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-primary outline-none transition-all"
                                            placeholder="traveler@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={authForm.password}
                                            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-primary outline-none transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                                <button type="submit" className="btn btn-primary w-full py-4 text-lg font-bold">
                                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            </form>

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-900 px-4 text-slate-500 font-bold tracking-widest">Or continue with</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                className="w-full bg-white text-slate-900 hover:bg-slate-200 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>

                            <p className="mt-6 text-center text-sm text-slate-400">
                                {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                                <button
                                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                    className="ml-2 text-primary hover:underline font-bold"
                                >
                                    {authMode === 'login' ? 'Sign Up' : 'Login'}
                                </button>
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">AI Settings</h3>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white">✕</button>
                            </div>

                            <p className="text-sm text-slate-400 mb-6">
                                We use your own Gemini API key for story generation. This key is **encrypted** and never shared.
                            </p>

                            <form onSubmit={handleSaveKey} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gemini API Key</label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={userGeminiKey}
                                            onChange={(e) => setUserGeminiKey(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-primary outline-none transition-all font-mono"
                                            placeholder="AIza..."
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                        Go to <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a> to get your free key.
                                    </p>
                                </div>

                                <button type="submit" className="btn btn-primary w-full py-4 text-lg font-bold">
                                    Save Key Securely
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;
