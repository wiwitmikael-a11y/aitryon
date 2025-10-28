import React, { useState } from 'react';
import { getTradingMandate } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';

const QuantitativeFundManager: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [mandate, setMandate] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            setError('Please provide analysis or a command.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setMandate(null);

        try {
            const result = await getTradingMandate(prompt);
            setMandate(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">Input Command</h2>
                <p className="text-slate-400 mb-4 text-sm">Provide market analysis, ask for a trade suggestion, or give a direct command. The AI Fund Manager will respond with a structured JSON Mandate if a trade is initiated.</p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'Analisis teknikal BTC/USDT menunjukkan potensi breakout. Harap ajukan proposal trade long dengan risk/reward yang baik.'"
                    className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors text-slate-200"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !prompt.trim()}
                    className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 flex items-center justify-center"
                >
                    {isLoading ? <SpinnerIcon /> : 'Submit to AI Fund Manager'}
                </button>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg min-h-[200px]">
                 <h2 className="text-2xl font-bold text-cyan-400 mb-4">AI Response</h2>
                 {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="text-center">
                            <SpinnerIcon />
                            <p className="text-slate-400 mt-2">Processing command...</p>
                        </div>
                    </div>
                 )}
                 {error && (
                    <div className="bg-red-900/20 p-4 rounded-lg text-red-400">
                        <p className="font-bold">Error:</p>
                        <p>{error}</p>
                    </div>
                 )}
                 {mandate && (
                    <div>
                        <p className="text-green-400 font-semibold mb-2">JSON MANDATE INITIATED:</p>
                        <pre className="bg-slate-900/70 p-4 rounded-lg text-sm text-slate-200 overflow-x-auto">
                            <code>
                                {JSON.stringify(mandate, null, 2)}
                            </code>
                        </pre>
                    </div>
                 )}
                 {!isLoading && !error && !mandate && (
                    <div className="text-center text-slate-500 py-8">
                        <p>The AI's response will be displayed here.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default QuantitativeFundManager;
