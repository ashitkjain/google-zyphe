import React, { useEffect } from 'react';

interface GoogleAdProps {
    slotId: string;
    format?: 'auto' | 'fluid' | 'rectangle' | 'vertical';
    layout?: string;
    style?: React.CSSProperties;
    className?: string;
    label?: string; // For debugging/preview purposes
}

const GoogleAd: React.FC<GoogleAdProps> = ({ slotId, format = 'auto', layout, style, className, label }) => {
    useEffect(() => {
        // Placeholder for development
        if (isDev) return;

        try {
            // Check if there's an available 'ins' tag that doesn't have an ad yet
            const ads = document.querySelectorAll('ins.adsbygoogle:not([data-ad-status="filled"])');
            if (ads.length > 0) {
                (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                (window as any).adsbygoogle.push({});
            }
        } catch (e) {
            console.error('AdSense error:', e);
        }
    }, []);

    // Placeholder for development - REMOVE or COMMENT OUT in production if real ads are active
    const isDev = true;

    return (
        <div className={`google-ad-container my-8 flex justify-center ${className || ''}`} style={style}>
            {isDev ? (
                <div className="w-full bg-slate-100 border border-slate-200 text-slate-400 flex flex-col items-center justify-center text-xs font-bold uppercase tracking-widest p-4 rounded-lg min-h-[100px]" style={style}>
                    <span className="mb-2">Advertisement</span>
                    <span className="text-[9px] opacity-60">{label || 'Ad Unit'}</span>
                </div>
            ) : (
                <ins
                    className="adsbygoogle"
                    style={{ display: 'block', ...style }}
                    data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // TODO: Replace with user's AdSense Client ID
                    data-ad-slot={slotId}
                    data-ad-format={format}
                    data-full-width-responsive="true"
                    data-ad-layout={layout}
                ></ins>
            )}
        </div>
    );
};

export default GoogleAd;
