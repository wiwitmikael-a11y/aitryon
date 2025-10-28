import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import ImageUploader from './ImageUploader';
import { 
    generateVideoBrief, 
    generateVideoStoryboard, 
    generateVideo,
    checkVideoOperationStatus,
    fetchAndCreateVideoUrl
} from '../services/geminiService';
import { GenerateIcon } from './icons/GenerateIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CrossIcon } from './icons/CrossIcon';
import { PackageIcon } from './icons/PackageIcon';
import { ProductionIcon } from './icons/ProductionIcon';


type Stage = 'input' | 'storyboarding' | 'storyboard_review' | 'asset_generation' | 'complete' | 'failed';

interface Scene {
    id: number;
    veo_prompt_base: string;
    display_voice_over: string;
    text_overlay: string; // New field for user input
    status: 'pending' | 'generating' | 'polling' | 'complete' | 'failed';
    src?: string;
    error?: string;
    operationName?: string;
}

const VIDEO_POLLING_INTERVAL = 10000; // 10 seconds

const ViralVideoGenerator: React.FC = () => {
    const [productImage, setProductImage] = useState<{ data: string | null; file: File | null }>({ data: null, file: null });
    const [productDescription, setProductDescription] = useState('');
    const [language, setLanguage] = useState<'indonesia' | 'english'>('indonesia');
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    
    // New creative direction states
    const [marketingAngle, setMarketingAngle] = useState('problem-solution');
    const [visualStyle, setVisualStyle] = useState('cinematic');
    const [narrationStyle, setNarrationStyle] = useState('professional');

    const [stage, setStage] = useState<Stage>('input');
    const [error, setError] = useState<string | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [brief, setBrief] = useState<any>(null);

    const pollingRefs = useRef<Map<number, number>>(new Map());

    useEffect(() => {
        return () => {
            pollingRefs.current.forEach(intervalId => clearInterval(intervalId));
        };
    }, []);

    const updateSceneState = (id: number, updates: Partial<Scene>) => {
        setScenes(prevScenes =>
            prevScenes.map(scene => (scene.id === id ? { ...scene, ...updates } : scene))
        );
    };
    
    const handleGenerateStoryboard = async () => {
        if (!productImage.data || !productImage.file || !productDescription) {
            setError('Harap unggah gambar produk dan isi deskripsi.');
            return;
        }

        setStage('storyboarding');
        setError(null);
        setScenes([]);
        setBrief(null);
        
        try {
            // Step 1: AI Marketing Analyst (with creative direction)
            const generatedBrief = await generateVideoBrief(
                productImage.data, 
                productDescription, 
                language,
                marketingAngle,
                visualStyle,
                narrationStyle
            );
            setBrief(generatedBrief);
            
            // Step 2: AI Storyboarder
            const storyboard = await generateVideoStoryboard(generatedBrief, language, aspectRatio);
            
            const initialScenes: Scene[] = storyboard.map((s: any, index: number) => ({
                id: index + 1,
                veo_prompt_base: s.veo_prompt_base,
                display_voice_over: s.display_voice_over,
                text_overlay: '', // Initialize as empty
                status: 'pending'
            }));
            setScenes(initialScenes);
            setStage('storyboard_review');

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
            setError(message);
            setStage('failed');
        }
    };
    
    const handleStartVideoGeneration = () => {
        setStage('asset_generation');
        pollingRefs.current.forEach(id => clearInterval(id));
        pollingRefs.current.clear();

        for (const scene of scenes) {
            processVideoScene(scene, productImage, aspectRatio);
        }
    };

    const processVideoScene = async (scene: Scene, image: { data: string | null; file: File | null; }, aspectRatio: '9:16' | '16:9') => {
        updateSceneState(scene.id, { status: 'generating' });

        // Construct the final, complete Veo prompt
        let finalVeoPrompt = `${scene.veo_prompt_base}.`;
        finalVeoPrompt += ` The narration voice over for this scene is: "${scene.display_voice_over}".`;
        if(scene.text_overlay) {
            finalVeoPrompt += ` Display the text overlay "${scene.text_overlay}" in a bold, eye-catching font.`;
        }
        finalVeoPrompt += ` Include elegant and suitable background music at a low volume.`

        try {
            const isFirstScene = scene.id === 1;
            const imageData = (isFirstScene && image.data && image.file) ? { data: image.data, mimeType: image.file.type } : undefined;
            
            const operation = await generateVideo(finalVeoPrompt, aspectRatio, imageData);
            if (!operation.name) throw new Error("Nama operasi video tidak ditemukan.");
            
            updateSceneState(scene.id, { status: 'polling', operationName: operation.name });
            pollVideoStatus(scene.id, operation.name);
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Gagal memulai pembuatan video.';
            updateSceneState(scene.id, { status: 'failed', error });
        }
    };
    
    const pollVideoStatus = (id: number, operationName: string) => {
        const intervalId = window.setInterval(async () => {
            try {
                const operation = await checkVideoOperationStatus(operationName);
                if (operation.done) {
                    clearInterval(intervalId);
                    pollingRefs.current.delete(id);
                    if (operation.error) throw new Error(operation.error.message);
                    
                    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (!uri) throw new Error("URI Video tidak ditemukan dalam respons operasi.");
                    
                    const src = await fetchAndCreateVideoUrl(uri);
                    updateSceneState(id, { status: 'complete', src });
                }
            } catch (err) {
                clearInterval(intervalId);
                pollingRefs.current.delete(id);
                const error = err instanceof Error ? err.message : 'Polling gagal.';
                updateSceneState(id, { status: 'failed', error });
            }
        }, VIDEO_POLLING_INTERVAL);
        pollingRefs.current.set(id, intervalId);
    };
    
    useEffect(() => {
        if (stage === 'asset_generation' && scenes.length > 0) {
            const allFinished = scenes.every(s => s.status === 'complete' || s.status === 'failed');
            if (allFinished) {
                setStage('complete');
            }
        }
    }, [scenes, stage]);
    
    const handleDownloadPackage = async () => {
        const zip = new JSZip();
        const successfulAssets = scenes.filter(a => a.status === 'complete' && a.src);

        for (const asset of successfulAssets) {
            const response = await fetch(asset.src!);
            const blob = await response.blob();
            zip.file(`scene_${asset.id}.mp4`, blob);
        }
        
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Affiliate-Video-Package-${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    const isLoading = stage === 'storyboarding' || stage === 'asset_generation';

    const getStageDescription = () => {
        switch(stage) {
            case 'storyboarding': return "Menganalisis produk & membuat storyboard...";
            case 'asset_generation': return "Menghasilkan video bersuara untuk setiap adegan...";
            default: return "";
        }
    };
    
    const handleSceneTextChange = (id: number, newText: string) => {
        updateSceneState(id, { display_voice_over: newText });
    };

    const handleSceneOverlayChange = (id: number, newText: string) => {
        updateSceneState(id, { text_overlay: newText });
    };

    return (
        <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">Viral Affiliate Video Studio</h1>
                <p className="text-lg text-slate-400">Kolaborasi dengan AI untuk membuat video afiliasi. Beri arahan, edit storyboard, dan hasilkan video yang sempurna.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6 border border-slate-800">
                    <h2 className="text-xl font-bold text-cyan-400">1. Input & Arahan Kreatif</h2>
                    <ImageUploader 
                        label="Gambar Produk Utama" 
                        onImageUpload={(base64, file) => setProductImage({ data: base64, file: file || null })} 
                        initialImage={productImage.data}
                    />
                    <div>
                        <label htmlFor="product-desc" className="block text-slate-300 font-semibold mb-2 text-sm">Deskripsi Teks Produk</label>
                        <textarea 
                            id="product-desc"
                            rows={4}
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            placeholder="Tempel deskripsi produk mentah di sini..."
                            className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors"
                        />
                    </div>
                    
                    <div className="space-y-4">
                        <h3 className="text-slate-300 font-semibold text-sm">Arahan Tambahan</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label htmlFor="angle-select" className="block text-slate-400 mb-1 text-xs">Angle Pemasaran</label>
                                <select id="angle-select" value={marketingAngle} onChange={e => setMarketingAngle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-sm">
                                    <option value="problem-solution">Problem/Solution</option>
                                    <option value="benefit-showcase">Benefit Showcase</option>
                                    <option value="unboxing">Unboxing & First Impression</option>
                                    <option value="how-to">How-To / Tutorial</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="visual-style-select" className="block text-slate-400 mb-1 text-xs">Gaya Visual</label>
                                    <select id="visual-style-select" value={visualStyle} onChange={e => setVisualStyle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-sm">
                                        <option value="cinematic">Cinematic & Mewah</option>
                                        <option value="ugc">UGC & Autentik</option>
                                        <option value="vibrant">Vibrant & Fun</option>
                                        <option value="minimalist">Minimalis & Clean</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="narration-style-select" className="block text-slate-400 mb-1 text-xs">Gaya Narasi</label>
                                    <select id="narration-style-select" value={narrationStyle} onChange={e => setNarrationStyle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-sm">
                                        <option value="professional">Profesional & Informatif</option>
                                        <option value="friendly">Santai & Ramah</option>
                                        <option value="energetic">Energik & Semangat</option>
                                        <option value="calm">Tenang & Meyakinkan</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="language-select" className="block text-slate-300 font-semibold mb-2 text-sm">Bahasa</label>
                            <select id="language-select" value={language} onChange={e => setLanguage(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="indonesia">Indonesia</option>
                                <option value="english">English</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="orientation-select" className="block text-slate-300 font-semibold mb-2 text-sm">Orientasi</label>
                            <select id="orientation-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="9:16">9:16 (Potret)</option>
                                <option value="16:9">16:9 (Lanskap)</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 mt-auto">
                        <button
                            onClick={handleGenerateStoryboard}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg transition-all"
                        >
                            {isLoading ? 'Memproses...' : <><GenerateIcon /> Buat Storyboard</>}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800">
                     <h2 className="text-xl font-bold text-cyan-400 mb-6">2. Storyboard & Hasil Video</h2>
                     {isLoading && stage !== 'asset_generation' && (
                         <div className="text-center flex flex-col items-center justify-center h-full">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4 text-lg">{getStageDescription()}</p>
                         </div>
                     )}
                     {error && (
                         <div className="text-center bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                            <p className="text-red-300 font-semibold">Terjadi Kesalahan</p>
                            <p className="text-slate-400 mt-2 text-sm">{error}</p>
                         </div>
                     )}
                     {(stage === 'storyboard_review' || stage === 'asset_generation' || stage === 'complete') && scenes.length > 0 && (
                         <div className="space-y-6">
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {stage === 'storyboard_review' && <h3 className="font-semibold text-slate-300">Tinjau & Edit Storyboard</h3>}
                                {scenes.map(scene => (
                                <div key={scene.id} className="p-4 bg-slate-800/70 rounded-lg border border-slate-700 space-y-3">
                                    <div className="flex gap-4 items-start">
                                        <div className={`flex-shrink-0 bg-slate-700 rounded-md flex items-center justify-center ${aspectRatio === '9:16' ? 'w-24 h-40' : 'w-40 h-24'}`}>
                                            {scene.status === 'complete' && scene.src ? (
                                                <video src={scene.src} controls className="w-full h-full object-cover rounded-md" />
                                            ) : (
                                                <div className='flex flex-col items-center justify-center text-center'>
                                                    <span className="text-slate-500 text-lg font-bold">#{scene.id}</span>
                                                    {(scene.status === 'generating' || scene.status === 'polling') && <SpinnerIcon />}
                                                    {scene.status === 'failed' && <span className="text-red-400"><CrossIcon /></span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-400 mb-2">Prompt Visual: <span className='italic'>"{scene.veo_prompt_base}"</span></p>
                                            <div>
                                                <label className="text-xs font-semibold text-cyan-400">Naskah Suara</label>
                                                <textarea 
                                                  value={scene.display_voice_over} 
                                                  onChange={e => handleSceneTextChange(scene.id, e.target.value)}
                                                  rows={2}
                                                  disabled={stage !== 'storyboard_review'}
                                                  className="w-full bg-slate-900/80 border border-slate-600 p-2 rounded-md text-sm text-slate-200 mt-1 disabled:bg-slate-800/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-cyan-400">Teks di Layar (Opsional)</label>
                                                <input 
                                                  type="text"
                                                  value={scene.text_overlay}
                                                  onChange={e => handleSceneOverlayChange(scene.id, e.target.value)}
                                                  placeholder="cth: Diskon 50%!"
                                                  disabled={stage !== 'storyboard_review'}
                                                  className="w-full bg-slate-900/80 border border-slate-600 p-2 rounded-md text-sm text-slate-200 mt-1 disabled:bg-slate-800/50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>
                            {stage === 'storyboard_review' &&
                                <button onClick={handleStartVideoGeneration} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                                    <ProductionIcon /> <span>Setuju & Mulai Buat Video</span>
                                </button>
                            }
                            {stage === 'complete' &&
                                <button onClick={handleDownloadPackage} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                                    <PackageIcon /> <span>Unduh Paket Aset (.zip)</span>
                                </button>
                            }
                         </div>
                     )}
                     {stage === 'input' && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-600">
                            <p className="text-slate-400">Hasil storyboard & video Anda akan muncul di sini.</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default ViralVideoGenerator;