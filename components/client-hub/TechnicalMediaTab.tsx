import React from 'react';
import { listAdminVideos } from '../../services/firebase/storage';

const TechnicalMediaTab: React.FC = () => {
    const p = {
        title: 'Technical Media',
        date: 'Feb 2026',
        volume: 'Vol 01 / No. 06'
    };

    const [videos, setVideos] = React.useState<{ name: string, url: string, summary: string, timestamp: number }[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedVideo, setSelectedVideo] = React.useState<{ url: string, name: string, summary: string } | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    React.useEffect(() => {
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
    }, []);

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
                    <h1 className="text-3xl font-light text-slate-900 tracking-tight">Technical Media & Demonstrations</h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Visual documentation and architectural walkthroughs of the Zyphe technical ecosystem.
                    </p>
                </div>
            </div>

            <article className="space-y-12 relative mt-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        <span>{p.volume}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span>{p.date}</span>
                    </div>
                    <h2 className="text-4xl font-serif font-black text-slate-900 leading-tight max-w-4xl">
                        {p.title}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium italic">
                        Visual demonstrations and multimedia documentation of the Zyphe technical ecosystem. Click any card to play inline.
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Loading Technical Media...</span>
                    </div>
                ) : videos.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-24 text-center space-y-4">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto text-slate-200 shadow-sm">
                            <i className="fa-solid fa-cloud-moon text-3xl"></i>
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-black text-slate-900">No media assets found</p>
                            <p className="text-sm text-slate-500 font-medium">Contact the Admin to upload technical walkthroughs or architecture summaries.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {videos.map((v, i) => (
                            <div
                                key={i}
                                onClick={() => setSelectedVideo({ url: v.url, name: v.name, summary: v.summary })}
                                className="group bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 flex flex-col cursor-pointer"
                            >
                                <div className="aspect-video bg-slate-900 relative overflow-hidden">
                                    <video
                                        src={v.url}
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        preload="metadata"
                                        muted
                                        onMouseOver={(e) => e.currentTarget.play()}
                                        onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                    />
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-500">
                                            <i className="fa-solid fa-play text-xl ml-1"></i>
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                                        <div className="px-2 py-1 rounded-sm bg-indigo-600 text-[8px] font-black text-white uppercase tracking-widest">
                                            HD Playback
                                        </div>
                                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Click to Expand</span>
                                    </div>
                                </div>
                                <div className="p-8 flex-1 flex flex-col gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                                            <i className="fa-solid fa-calendar-day"></i>
                                            {new Date(v.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <h4 className="text-[15px] font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                                            {v.name.split('_').slice(1).join(' ').replace(/\.[^/.]+$/, "") || v.name}
                                        </h4>
                                    </div>
                                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed line-clamp-3">
                                        {v.summary}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Inline Theater Modal */}
                {selectedVideo && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
                        <div
                            className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
                            onClick={() => setSelectedVideo(null)}
                        />
                        <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                            <video
                                ref={videoRef}
                                src={selectedVideo.url}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-6 right-6 flex gap-3">
                                <button
                                    onClick={handleMaximize}
                                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-indigo-600 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform hover:scale-110"
                                    title="Maximize to Fullscreen"
                                >
                                    <i className="fa-solid fa-expand text-lg"></i>
                                </button>
                                <button
                                    onClick={() => setSelectedVideo(null)}
                                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black shadow-xl transition-all hover:rotate-90 hover:bg-slate-100"
                                    title="Close Player"
                                >
                                    <i className="fa-solid fa-times text-lg"></i>
                                </button>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 p-8 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    {selectedVideo.name.split('_').slice(1).join(' ').replace(/\.[^/.]+$/, "") || selectedVideo.name}
                                </h3>
                                <p className="text-slate-400 text-sm mt-2 max-w-3xl line-clamp-2 font-medium">
                                    {selectedVideo.summary}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </article>
        </div>
    );
};

export default TechnicalMediaTab;
