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

type Stage = 'input' | 'briefing' | 'storyboarding' | 'asset_generation' | 'complete' | 'failed';

interface Scene {
    id: number;
    veo_prompt: string;
    display_voice_over: string;
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
    const [stage, setStage] = useState<Stage>('input');
    const [error, setError] = useState<string | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);

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
    
    const handleGenerate = async () => {
        if (!productImage.data || !productImage.file || !productDescription) {
            setError('Harap unggah gambar produk dan isi deskripsi.');
            return;
        }

        setStage('briefing');
        setError(null);
        setScenes([]);
        pollingRefs.current.forEach(id => clearInterval(id));
        pollingRefs.current.clear();
        
        try {
            // Step 1: AI Marketing Analyst
            const brief = await generateVideoBrief(productImage.data, productDescription, language);
            
            // Step 2: AI Storyboarder
            setStage('storyboarding');
            const storyboard = await generateVideoStoryboard(brief, language, aspectRatio);
            
            const initialScenes: Scene[] = storyboard.map((s: any, index: number) => ({
                id: index + 1,
                veo_prompt: s.veo_prompt,
                display_voice_over: s.display_voice_over,
                status: 'pending'
            }));
            setScenes(initialScenes);
            
            setStage('asset_generation');

            // Step 3: Generate Video Scenes (with audio)
            for (const scene of initialScenes) {
                processVideoScene(scene, productImage, aspectRatio);
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
            setError(message);
            setStage('failed');
        }
    };
    
    const processVideoScene = async (scene: Scene, image: { data: string; file: File; }, aspectRatio: '9:16' | '16:9') => {
        updateSceneState(scene.id, { status: 'generating' });
        try {
            const isFirstScene = scene.id === 1;
            const imageData = (isFirstScene && image.data && image.file) ? { data: image.data, mimeType: image.file.type } : undefined;
            
            const operation = await generateVideo(scene.veo_prompt, aspectRatio, imageData);
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

    const isLoading = stage === 'briefing' || stage === 'storyboarding' || stage === 'asset_generation';

    const getStageDescription = () => {
        switch(stage) {
            case 'briefing': return "Menganalisis produk & target audiens...";
            case 'storyboarding': return "Membuat storyboard & naskah (target: ~35 detik)...";
            case 'asset_generation': return "Menghasilkan video bersuara untuk setiap adegan...";
            default: return "";
        }
    }

    return (
        <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">Viral Affiliate Video Generator</h1>
                <p className="text-lg text-slate-400">Buat video afiliasi (~35 detik) secara otomatis. Cukup unggah gambar produk, berikan deskripsi, dan biarkan AI melakukan sisanya.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6 border border-slate-800">
                    <h2 className="text-xl font-bold text-cyan-400">Input & Konfigurasi</h2>
                    <ImageUploader 
                        label="1. Gambar Produk Utama" 
                        onImageUpload={(base64, file) => setProductImage({ data: base64, file: file || null })} 
                        initialImage={productImage.data}
                    />
                    <div>
                        <label htmlFor="product-desc" className="block text-slate-300 font-semibold mb-2 text-sm">2. Deskripsi Teks Produk</label>
                        <textarea 
                            id="product-desc"
                            rows={5}
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            placeholder="Tempel deskripsi produk mentah di sini..."
                            className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="language-select" className="block text-slate-300 font-semibold mb-2 text-sm">3. Bahasa</label>
                            <select id="language-select" value={language} onChange={e => setLanguage(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="indonesia">Indonesia</option>
                                <option value="english">English</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="orientation-select" className="block text-slate-300 font-semibold mb-2 text-sm">4. Orientasi</label>
                            <select id="orientation-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="9:16">9:16 (Potret)</option>
                                <option value="16:9">16:9 (Lanskap)</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 mt-auto">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg transition-all"
                        >
                            {isLoading ? 'Memproses...' : <><GenerateIcon /> Buat Video</>}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800">
                     <h2 className="text-xl font-bold text-cyan-400 mb-6">5. Hasil Video</h2>
                     {isLoading && (
                         <div className="text-center flex flex-col items-center justify-center h-full">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4 text-lg">{getStageDescription()}</p>
                            {stage === 'asset_generation' && 
                                <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4 overflow-hidden">
                                    <div className="bg-cyan-500 h-2.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                                </div>
                            }
                         </div>
                     )}
                     {error && (
                         <div className="text-center bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                            <p className="text-red-300 font-semibold">Terjadi Kesalahan</p>
                            <p className="text-slate-400 mt-2 text-sm">{error}</p>
                         </div>
                     )}
                     {(stage === 'complete' || stage === 'asset_generation') && scenes.length > 0 && (
                         <div className="space-y-6">
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <h3 className="font-semibold text-slate-300">Adegan Video ({aspectRatio})</h3>
                                {scenes.map(scene => (
                                <div key={scene.id} className="p-3 bg-slate-800/70 rounded-lg flex gap-4 items-center border border-slate-700">
                                    <div className={`flex-shrink-0 bg-slate-700 rounded-md flex items-center justify-center ${aspectRatio === '9:16' ? 'w-24 h-40' : 'w-40 h-24'}`}>
                                        {scene.status === 'complete' && scene.src ? (
                                            <video src={scene.src} controls className="w-full h-full object-cover rounded-md" />
                                        ) : (
                                            <div className="text-slate-500 text-sm">#{scene.id}</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-400 italic" title={scene.display_voice_over}>"{scene.display_voice_over}"</p>
                                        <div className="flex items-center gap-2 text-sm font-semibold mt-2">
                                            {scene.status === 'generating' || scene.status === 'polling' ? <SpinnerIcon /> : scene.status === 'complete' ? <span className="text-green-400"><CheckIcon /></span> : <span className="text-red-400"><CrossIcon /></span>}
                                            <span className="capitalize">{scene.status}</span>
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>
                            {stage === 'complete' &&
                                <button onClick={handleDownloadPackage} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                                    <PackageIcon /> <span>Unduh Paket Aset (.zip)</span>
                                </button>
                            }
                         </div>
                     )}
                     {stage === 'input' && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-600">
                            <p className="text-slate-400">Hasil video Anda akan muncul di sini.</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default ViralVideoGenerator;