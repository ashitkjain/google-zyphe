import React from 'react';

interface HoverPreviewProps {
    hoveredImage: string | null;
    mousePos: { x: number, y: number };
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClose: () => void;
}

export const HoverPreview: React.FC<HoverPreviewProps> = ({
    hoveredImage, mousePos, onMouseEnter, onMouseLeave, onClose
}) => {
    if (!hoveredImage) return null;

    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="fixed z-[999] p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 ring-1 ring-black/5 flex flex-col group/preview"
            style={{
                left: Math.min(window.innerWidth - 320, mousePos.x + 20),
                top: Math.max(20, Math.min(window.innerHeight - 240, mousePos.y - 120)),
                width: '300px'
            }}
        >
            <div className="relative">
                <img src={hoveredImage} className="w-full h-auto rounded-xl" alt="Preview" />
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all shadow-lg active:scale-90"
                >
                    <i className="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>
        </div>
    );
};
