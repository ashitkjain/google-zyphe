/**
 * PropertyDashboardShared
 *
 * Shared sub-components used by both PropertyDashboardLeft and PropertyDashboardRight.
 * Centralising here avoids circular dependency issues.
 */
import React from 'react';

export const SectionCard: React.FC<{
    id: string;
    title: string;
    icon?: string;
    iconBg?: string;
    iconColor?: string;
    subtitle?: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}> = ({ id, title, icon, iconBg = 'bg-slate-50/50', iconColor = 'text-slate-400', subtitle, badge, children, className = '', noPadding = false }) => (
    <div
        id={id}
        className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 transition-all duration-300 ${className}`}
    >
        <div className="px-5 pt-6 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {icon && (
                    <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center border border-slate-100/50`}>
                        <i className={`fa-solid ${icon} ${iconColor} text-[13px]`} />
                    </div>
                )}
                <div>
                    <h3 className="text-[18px] font-black text-slate-900 tracking-tight leading-snug">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {badge}
        </div>
        <div className={noPadding ? '' : 'px-5 pb-5 pt-1.5'}>{children}</div>
    </div>
);
