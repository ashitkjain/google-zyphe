import React, { useState } from 'react';
import { listAdminVideos } from '../../services/firebase/storage';
import RecommenderPaper from './RecommenderPaper';
import ContextGraphPaper from './ContextGraphPaper';

type ContentType = 'recommender_system' | 'context_graph' | 'media';

interface TechnicalHubTabProps {
    initialTab?: ContentType;
    setActiveTab?: (tab: any) => void;
    onNavigate?: (view: any, path: string) => void;
}

const TechnicalHubTab: React.FC<TechnicalHubTabProps> = ({ initialTab, setActiveTab, onNavigate }) => {
    const [activeTab, setLocalActiveTab] = useState<ContentType>(initialTab || 'media');
    const [videos, setVideos] = React.useState<{ name: string, url: string, summary: string, timestamp: number }[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedVideo, setSelectedVideo] = React.useState<{ url: string, name: string, summary: string } | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const papers = [
        { id: 'recommender_system', title: 'An Intelligent Context Aware Recommender System for Real Estate', date: 'Feb 2026', volume: 'Vol 01 / No. 04' },
        { id: 'context_graph', title: 'The Zyphe "Context Graph"', date: 'Feb 2026', volume: 'Vol 01 / No. 05' },
    ];

    React.useEffect(() => {
        if (activeTab === 'media' && videos.length === 0) {
            const fetchVideos = async () => {
                try {
                    const videoData = await listAdminVideos();
                    setVideos(videoData);
                } catch (error) {
                    console.error("Failed to fetch videos:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchVideos();
        }
    }, [activeTab]);

    const handleMaximize = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            } else if ((videoRef.current as any).webkitRequestFullscreen) {
                (videoRef.current as any).webkitRequestFullscreen();
            }
        }
    };

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-200 pb-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-light text-slate-900 tracking-tight">Technical Knowledge Hub</h1>
                    <div className="flex gap-4 mt-4">
                        <button 
                            onClick={() => setLocalActiveTab('media')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'media' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        > Media </button>
                        <button 
                            onClick={() => setLocalActiveTab('recommender_system')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'recommender_system' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        > Architecture </button>
                        <button 
                            onClick={() => setLocalActiveTab('context_graph')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'context_graph' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        > Context Graph </button>
                    </div>
                </div>
            </div>

            {activeTab === 'media' ? (
                <div className="space-y-12">
                     {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-medium">No media assets found</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {videos.map((v, i) => (
                                <div key={i} onClick={() => setSelectedVideo({ url: v.url, name: v.name, summary: v.summary })} className="group bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:shadow-2xl transition-all cursor-pointer">
                                     <div className="aspect-video bg-slate-900 relative">
                                        <video src={v.url} className="w-full h-full object-cover opacity-80" muted preload="metadata" />
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900/80 to-transparent" />
                                    </div>
                                    <div className="p-8">
                                        <h4 className="text-[15px] font-black text-slate-900">{v.name.split('_').slice(1).join(' ').replace(/\.[^/.]+$/, "") || v.name}</h4>
                                        <p className="text-[12px] text-slate-500 mt-2 line-clamp-3">{v.summary}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : activeTab === 'recommender_system' ? (
                <RecommenderPaper p={papers[0]} />
            ) : (
                <ContextGraphPaper p={papers[1]} setActiveTab={setActiveTab} onNavigate={onNavigate} />
            )}

            {selectedVideo && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={() => setSelectedVideo(null)} />
                    <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10">
                        <video ref={videoRef} src={selectedVideo.url} controls autoPlay className="w-full h-full object-contain" />
                        <button onClick={() => setSelectedVideo(null)} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white flex items-center justify-center text-black">
                            <i className="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechnicalHubTab;
