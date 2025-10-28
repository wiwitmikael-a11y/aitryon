import React, { useState } from 'react';
import { getTradingMandate } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { GenerateIcon } from './icons/GenerateIcon';

const QuantitativeFundManager: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            setError('Please provide analysis or a command.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            const result = await getTradingMandate(prompt);
            setResponse(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const isMandate = response && response.status === 'MANDATE_INITIATED';

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
             <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">AI Quant Fund Manager</h1>
                <p className="text-lg text-slate-400">Provide market analysis to an AI fund manager and receive structured trading mandates.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">Input Command</h2>
                    <p className="text-slate-400 mb-4 text-sm">Provide market analysis, ask for a trade suggestion, or give a direct command. The AI Fund Manager will respond with a structured JSON Mandate if a trade is initiated.</p>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., 'Analisis teknikal BTC/USDT menunjukkan potensi breakout. Harap ajukan proposal trade long dengan risk/reward yang baik.'"
                        className="w-full h-48 p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors text-slate-200 flex-grow"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !prompt.trim()}
                        className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg shadow-cyan-500/10 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <SpinnerIcon /> : <><GenerateIcon/> <span>Submit to AI Fund Manager</span></>}
                    </button>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 min-h-[400px]">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">AI Response</h2>
                    {isLoading && (
                        <div className="flex justify-center items-center py-8 h-full">
                            <div className="text-center">
                                <SpinnerIcon />
                                <p className="text-slate-400 mt-2">Processing command...</p>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-900/20 p-4 rounded-lg text-red-300 border border-red-500/30">
                            <p className="font-bold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}
                    {response && (
                        <div>
                            {isMandate ? (
                                <>
                                    <p className="text-green-400 font-semibold mb-2">JSON MANDATE INITIATED:</p>
                                    <pre className="bg-slate-800/70 p-4 rounded-lg text-sm text-slate-200 overflow-x-auto border border-slate-700">
                                        <code>
                                            {JSON.stringify(response, null, 2)}
                                        </code>
                                    </pre>
                                </>
                            ) : (
                                 <>
                                    <p className="text-slate-300 font-semibold mb-2">Text Response:</p>
                                    <div className="bg-slate-800/70 p-4 rounded-lg text-sm text-slate-200 border border-slate-700">
                                        {typeof response === 'object' ? JSON.stringify(response, null, 2) : response}
                                    </div>
                                 </>
                            )}
                        </div>
                    )}
                    {!isLoading && !error && !response && (
                        <div className="text-center text-slate-600 py-8">
                            <p>The AI's response will be displayed here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuantitativeFundManager;