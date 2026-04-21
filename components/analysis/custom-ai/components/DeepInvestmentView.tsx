import React from 'react';
import { DeepInvestmentResearchResult, ChartPoint } from '../../../../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

interface DeepInvestmentViewProps {
    data: DeepInvestmentResearchResult;
}

const SimpleChart: React.FC<{
    data: ChartPoint[];
    title?: string;
    metric1: string;
    metric2?: string;
}> = ({ data, title, metric1, metric2 }) => {
    if (!data || data.length === 0) return null;

    const formatYAxis = (value: number, metricName: string) => {
        if (metricName.toLowerCase().includes('price')) {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
            return `$${value}`;
        }
        return value.toString();
    };

    const formatDataLabel = (value: number, metricName: string) => {
        if (metricName.toLowerCase().includes('price')) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (metricName.toLowerCase().includes('days')) {
            return `${value} days`;
        }
        return value.toString();
    };

    return (
        <div className="w-full h-80 mt-6 mb-4">
            {title && (
                <div className="flex flex-col items-center mb-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{title}</div>
                    <div className="flex gap-6 items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-[#16a34a] rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{metric1}</span>
                        </div>
                        {metric2 && (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-0.5 border-t-2 border-dashed border-[#2563eb]"></div>
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{metric2}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="label"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontWeight: 800 }}
                        dy={15}
                    />
                    <YAxis
                        yAxisId="left"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#16a34a', fontWeight: 800 }}
                        tickFormatter={(v) => formatYAxis(v, metric1)}
                    />
                    {metric2 && (
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#2563eb', fontWeight: 800 }}
                            tickFormatter={(v) => formatYAxis(v, metric2)}
                        />
                    )}
                    <Tooltip
                        contentStyle={{
                            borderRadius: '20px',
                            border: 'none',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            padding: '16px'
                        }}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="value"
                        name={metric1}
                        stroke="#16a34a"
                        strokeWidth={4}
                        dot={{ r: 8, fill: '#16a34a', strokeWidth: 4, stroke: '#fff' }}
                        activeDot={{ r: 10, strokeWidth: 0 }}
                    >
                        <LabelList
                            dataKey="value"
                            position="top"
                            offset={18}
                            formatter={(v: any) => formatDataLabel(v, metric1)}
                            style={{ fill: '#0f172a', fontSize: '12px', fontWeight: 900 }}
                        />
                    </Line>
                    {metric2 && (
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="value2"
                            name={metric2}
                            stroke="#2563eb"
                            strokeWidth={3}
                            strokeDasharray="8 6"
                            dot={{ r: 8, fill: '#2563eb', strokeWidth: 4, stroke: '#fff' }}
                            activeDot={{ r: 10, strokeWidth: 0 }}
                        >
                            <LabelList
                                dataKey="value2"
                                position="top"
                                offset={18}
                                formatter={(v: any) => formatDataLabel(v, metric2)}
                                style={{ fill: '#2563eb', fontSize: '12px', fontWeight: 900 }}
                            />
                        </Line>
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export const DeepInvestmentView: React.FC<DeepInvestmentViewProps> = ({ data }) => {
    const cleanText = (text: any): any => {
        if (!text) return text;
        if (Array.isArray(text)) return text.map(item => cleanText(item));
        if (typeof text !== 'string') return text;

        let cleaned = text.trim();

        // 1. Handle potential triple-wrapped JSON or stringified entities
        if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
            try {
                const unquoted = JSON.parse(cleaned);
                if (typeof unquoted === 'string') cleaned = unquoted.trim();
            } catch (e) { }
        }

        // 2. If the string is a raw JSON object string (fallback artifact)
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            try {
                const parsed = JSON.parse(cleaned);
                if (parsed.content) return cleanText(parsed.content);
            } catch (e) { }
        }

        // 3. Normalize escapes
        cleaned = cleaned
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\/"/g, '"');

        // 4. Truncate at meta-data leakage (the "JSON scaffolding" that leaks from GenAI)
        // We look for where the markdown narrative ends and the JSON format resumes
        const leakMarkers = [
            /\n[ \t]*"structured_report":/i,
            /\n[ \t]*"type":\s*"OBJECT"/i,
            /\n[ \t]*"properties":/i,
            /\n[ \t]*"content":/i,
            /\n[ \t]*"macroeconomic_indicators":/i
        ];

        for (const pattern of leakMarkers) {
            const match = cleaned.match(pattern);
            if (match && match.index !== undefined) {
                cleaned = cleaned.substring(0, match.index);
                break;
            }
        }

        // 5. Line-level strip: remove trailing lines that are pure JSON punctuation.
        // e.g. lines containing only ", }, }, ... that slip through step 4.
        const jsonPunctLine = /^[\s"{}\[\],\.]+$/;
        const lines = cleaned.split('\n');
        while (lines.length > 0 && jsonPunctLine.test(lines[lines.length - 1])) {
            lines.pop();
        }
        cleaned = lines.join('\n');

        // 6. Char-level aggressive cleanup of any remaining trailing punctuation residue.
        let prev;
        do {
            prev = cleaned;
            cleaned = cleaned.trim().replace(/["}\s,\]]+$/, '');
        } while (cleaned !== prev && cleaned.length > 0);

        return cleaned;
    };

    // PRE-COMPUTE CITATION FALLBACK MAP from the content's Sources section.
    // When the AI's structured `citations` array is empty or missing,
    // we parse the markdown Sources section to extract source descriptions.
    const contentSourceMap: Record<string, string> = {};
    if (typeof data.content === 'string') {
        const sourceSectionMatch = data.content.match(/##?\s*Sources?\s*\n([\s\S]*?)(?:\n##?\s|$)/i);
        if (sourceSectionMatch) {
            const sourceLines = sourceSectionMatch[1].split('\n');
            for (const line of sourceLines) {
                const lineMatch = line.match(/[*\-•]\s*\[cite:\s*([\d,\s]+)\]\s*(.+)/);
                if (lineMatch) {
                    const nums = lineMatch[1].split(',').map(n => n.trim());
                    const description = lineMatch[2].trim();
                    nums.forEach(n => { contentSourceMap[n] = description; });
                }
            }
        }
    }

    const renderTable = (lines: string[], key: any) => {
        const parseRow = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headerRow = parseRow(lines[0]);
        // Filter out rows that are just separators like |---|---|
        const bodyRows = lines.slice(1).filter(l => !l.match(/^[|\s-:]+$/)).map(parseRow);

        // If the second line was a header separator, and we started at slice(1), 
        // we might have the header as the first data row. Let's be safer.
        const actualDataRows = lines.length > 2 && lines[1].includes('---') ? lines.slice(2).map(parseRow) : lines.slice(1).map(parseRow);

        return (
            <div key={key} className="my-8 overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50">
                            <tr>
                                {headerRow.map((cell, i) => (
                                    <th key={i} className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                                        {renderTextWithBold(cell)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {actualDataRows.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                    {row.map((cell, j) => (
                                        <td key={j} className={`p-4 text-xs ${j === 0 ? 'font-black text-slate-900' : 'text-slate-600'}`}>
                                            {renderTextWithBold(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderMarkdown = (content: any) => {
        if (typeof content !== 'string') return JSON.stringify(content, null, 2);

        const processedContent = cleanText(content);
        if (processedContent.trim() === '') return null;

        const lines = processedContent.split('\n');
        const elements: any[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Skip leading empty lines or initial horizontal rules
            if (elements.length === 0 && (trimmedLine === '' || trimmedLine === '---' || trimmedLine === '***')) {
                i++;
                continue;
            }

            // Skip lines that are pure JSON punctuation leakage (e.g. `"`, `}`, `},`, `...`)
            if (/^[\s"{}[\],\.]+$/.test(trimmedLine) && trimmedLine !== '') {
                i++;
                continue;
            }

            // Skip memo-style header lines the AI adds (DATE:, TO:, FROM:, RE:, SUBJECT:, CC:)
            if (/^(DATE|TO|FROM|RE|SUBJECT|CC)\s*:/i.test(trimmedLine)) {
                i++;
                continue;
            }

            // Table detection
            if (trimmedLine.startsWith('|')) {
                const tableLines: string[] = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }
                if (tableLines.length >= 2) {
                    elements.push(renderTable(tableLines, `table-${i}`));
                    continue;
                } else {
                    tableLines.forEach((tl, idx) => {
                        elements.push(<p key={`table-fallback-${i}-${idx}`} className="mb-4 leading-[1.8] text-gray-700 font-medium">{renderTextWithBold(tl)}</p>);
                    });
                    continue;
                }
            }

            // Horizontal rule
            if (trimmedLine === '---') {
                i++;
                continue;
            }
            // Skip H1 — it's the big document title the AI always emits, redundant with UI context
            else if (line.startsWith('# ')) {
                i++;
                continue;
            }
            // Skip the ## Sources section entirely — rendered separately by the Sources panel below
            else if (line.startsWith('## ') && line.slice(3).trim().match(/^sources?$/i)) {
                // Consume all lines until the next ## heading or end of content
                i++;
                while (i < lines.length && !lines[i].startsWith('## ') && !lines[i].startsWith('# ')) {
                    i++;
                }
                continue;
            }
            else if (line.startsWith('## ')) {
                const title = line.slice(3).trim();
                const isMicroMarkets = title.toLowerCase().includes('micro-market');
                const isLocalRisks = title.toLowerCase().includes('local risk');
                elements.push(
                    <div key={i} className={`mt-6 mb-2`}>
                        <div className="flex items-center gap-3">
                            {isMicroMarkets && <i className="fa-solid fa-archway text-indigo-400 text-sm"></i>}
                            {isLocalRisks && <i className="fa-solid fa-triangle-exclamation text-rose-400 text-sm animate-pulse"></i>}
                            <h2 className={`text-2xl font-black tracking-tight ${isLocalRisks ? 'text-rose-600' : 'text-gray-800'}`}>
                                {isMicroMarkets ? 'Neighborhood Intelligence: ' : ''}{title}
                            </h2>
                        </div>
                    </div>
                );
            }
            else if (line.startsWith('### ')) {
                elements.push(
                    <div key={i} className="flex items-center gap-2 mt-6 mb-3">
                        <div className="w-1 h-6 bg-indigo-500 rounded-full opacity-20"></div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">{line.slice(4)}</h3>
                    </div>
                );
            }
            // Bullet points (with nesting support)
            else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                // Calculate nesting depth from leading whitespace
                const leadingSpaces = line.length - line.trimStart().length;
                const depth = Math.floor(leadingSpaces / 2); // 2 spaces = 1 level
                const bulletContent = trimmedLine.slice(2);
                const isSubBullet = depth > 0;
                const marginLeft = isSubBullet ? `${1 + depth * 1.5}rem` : '1rem';
                elements.push(
                    <div key={i} className="flex gap-3 mb-2" style={{ marginLeft }}>
                        <span className={`mt-1.5 flex-shrink-0 ${isSubBullet ? 'text-slate-300 text-[8px]' : 'text-indigo-400'}`}>
                            {isSubBullet ? '◦' : '•'}
                        </span>
                        <div className={`flex-1 ${isSubBullet ? 'text-gray-600' : ''}`}>
                            {renderTextWithBold(bulletContent)}
                        </div>
                    </div>
                );
            }
            // Paragraph
            else if (trimmedLine === '') {
                elements.push(<div key={i} className="h-2" />);
            }
            else {
                elements.push(
                    <p key={i} className="mb-4 leading-[1.8] text-gray-700 font-medium">
                        {renderTextWithBold(line)}
                    </p>
                );
            }
            i++;
        }
        return elements;
    };

    const renderTextWithBold = (text: string) => {
        // Split on citations, markdown links, and bold markers
        const parts = text.split(/(\[cite:[\s\d,]+\]|\[[^\]]+\]\([^)]+\)|\*\*.*?\*\*|__.*?__)/);

        const citationMap = data.structured_report?.citations || [];

        return parts.map((part, i) => {
            // [cite: 1, 2, 3] — inline citation badges
            if (part.startsWith('[cite:')) {
                const numbers = part.replace('[cite:', '').replace(']', '').split(',').map(n => n.trim()).filter(Boolean);

                return (
                    <span key={i} className="inline-flex flex-wrap gap-1 items-center mx-1">
                        {numbers.map((num, idx) => {
                            const citation = citationMap.find(c => String(c.id) === num);
                            const sourceName = citation?.name || contentSourceMap[num] || null;
                            const url = citation?.url;

                            const getHostname = (u: string) => {
                                try { return new URL(u).hostname.replace('www.', ''); }
                                catch { return null; }
                            };
                            const label = url ? (getHostname(url) || sourceName?.split(/[,.]/, 1)[0] || num)
                                : (sourceName ? sourceName.split(/[,.]/, 1)[0] : num);

                            const badgeClass = `inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black border border-indigo-100/50 transition-all align-middle shadow-sm group/cite ${url ? 'cursor-pointer hover:bg-indigo-500 hover:text-white' : 'cursor-default hover:bg-indigo-100'
                                }`;

                            const inner = (
                                <>
                                    <i className={`fa-solid ${url ? 'fa-arrow-up-right-from-square' : 'fa-bookmark'} text-[7px] opacity-50 group-hover/cite:opacity-100`}></i>
                                    <span className="max-w-[120px] truncate">{label}</span>
                                </>
                            );

                            return url ? (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={badgeClass}
                                    title={sourceName || url}
                                >
                                    {inner}
                                </a>
                            ) : (
                                <span key={idx} className={badgeClass} title={sourceName || `Source ${num}`}>
                                    {inner}
                                </span>
                            );
                        })}
                    </span>
                );
            }
            // Markdown hyperlink [label](url)
            const mdLinkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (mdLinkMatch) {
                return (
                    <a
                        key={i}
                        href={mdLinkMatch[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 font-semibold transition-colors"
                    >
                        {mdLinkMatch[1]}
                    </a>
                );
            }
            // Bold **text** or __text__
            if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
                return <strong key={i} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="pb-6 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden p-6 pt-0">
                <div className="prose prose-slate max-w-none mt-0 pt-0">
                    <div className="text-gray-700 font-sans font-normal leading-[1.7] text-[14.5px] selection:bg-indigo-100 selection:text-indigo-900">

                        {data.structured_report ? (
                            <div className="space-y-6 [&>*:first-child]:mt-0">
                                {/* Macro & Market Sections — Flattened to full width */}
                                <div className="flex flex-col gap-6">
                                    <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 mt-0">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                <i className="fa-solid fa-chart-line text-indigo-600 text-[16px]"></i>
                                            </div>
                                            <h3 className="text-[18px] font-black text-slate-800 tracking-tight">Macroeconomics</h3>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-[14.5px] text-slate-600 mb-6 font-medium leading-relaxed">{cleanText(data.structured_report.macroeconomic_indicators?.summary)}</p>
                                                <ul className="space-y-3">
                                                    {data.structured_report.macroeconomic_indicators?.details?.map((d, i) => (
                                                        <li key={i} className="flex gap-2.5 text-[13px] text-slate-500 leading-relaxed font-medium">
                                                            <i className="fa-solid fa-circle-check text-indigo-400 text-[9px] mt-1 flex-shrink-0" />
                                                            {cleanText(d)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                {data.structured_report.macroeconomic_indicators?.chart_data ? (
                                                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm h-full flex flex-col justify-center">
                                                        <SimpleChart
                                                            data={data.structured_report.macroeconomic_indicators.chart_data.points}
                                                            title={data.structured_report.macroeconomic_indicators.chart_data.title}
                                                            metric1={data.structured_report.macroeconomic_indicators.chart_data.metric1}
                                                            metric2={data.structured_report.macroeconomic_indicators.chart_data.metric2}
                                                        />
                                                    </div>
                                                ) : data.structured_report.macroeconomic_indicators?.visual_hint && (
                                                    <div className="h-full min-h-[250px] bg-slate-900/5 rounded-[2rem] border border-slate-200 border-dashed flex flex-col items-center justify-center p-10 transition-all hover:bg-slate-900/[0.07]">
                                                        <i className="fa-solid fa-chart-area text-slate-200 text-5xl mb-4"></i>
                                                        <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest text-center max-w-xs">{cleanText(data.structured_report.macroeconomic_indicators.visual_hint)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                                <i className="fa-solid fa-house-chimney-window text-violet-600 text-[16px]"></i>
                                            </div>
                                            <h3 className="text-[18px] font-black text-slate-800 tracking-tight">Market Dynamics</h3>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-[14.5px] text-slate-600 mb-6 font-medium leading-relaxed">{cleanText(data.structured_report.market_dynamics?.summary)}</p>
                                                <ul className="space-y-3">
                                                    {data.structured_report.market_dynamics?.details?.map((d, i) => (
                                                        <li key={i} className="flex gap-2.5 text-[13px] text-slate-500 leading-relaxed font-medium">
                                                            <i className="fa-solid fa-circle-check text-violet-400 text-[9px] mt-1 flex-shrink-0" />
                                                            {cleanText(d)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                {data.structured_report.market_dynamics?.chart_data ? (
                                                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm h-full flex flex-col justify-center">
                                                        <SimpleChart
                                                            data={data.structured_report.market_dynamics.chart_data.points}
                                                            title={data.structured_report.market_dynamics.chart_data.title}
                                                            metric1={data.structured_report.market_dynamics.chart_data.metric1}
                                                            metric2={data.structured_report.market_dynamics.chart_data.metric2}
                                                        />
                                                    </div>
                                                ) : data.structured_report.market_dynamics?.visual_hint && (
                                                    <div className="h-full min-h-[250px] bg-slate-900/5 rounded-[2rem] border border-slate-200 border-dashed flex flex-col items-center justify-center p-10 transition-all hover:bg-slate-900/[0.07]">
                                                        <i className="fa-solid fa-chart-bar text-slate-200 text-5xl mb-4"></i>
                                                        <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest text-center max-w-xs">{cleanText(data.structured_report.market_dynamics.visual_hint)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {data.structured_report.pro_forma && (
                                    <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white overflow-hidden relative group">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <i className="fa-solid fa-calculator text-8xl text-indigo-400"></i>
                                        </div>
                                        <div className="relative">
                                            <div className="flex items-center gap-3 mb-8">
                                                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                                <h3 className="text-xl font-black uppercase tracking-widest">Financial Pro-Forma (P&L)</h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Purchase Price</span>
                                                        <span className="text-2xl font-black text-indigo-400 font-mono">${(data.structured_report.pro_forma.purchase_price || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Gross Annual Rent</span>
                                                        <span className="text-2xl font-black text-emerald-400 font-mono">${(data.structured_report.pro_forma.gross_rent || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="pt-4">
                                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Expense Breakdown</div>
                                                        <div className="space-y-3">
                                                            {Object.entries(data.structured_report.pro_forma.expenses || {}).map(([key, value]) => (
                                                                <div key={key} className="flex justify-between text-sm">
                                                                    <span className="text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                                                                    <span className="font-mono text-slate-200">-${Number(value || 0).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col justify-center gap-8 bg-slate-800/50 p-8 rounded-3xl border border-slate-700">
                                                    <div className="text-center">
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Net Operating Income</div>
                                                        <div className="text-5xl font-black text-white font-mono tracking-tighter">${(data.structured_report.pro_forma.noi || 0).toLocaleString()}</div>
                                                    </div>
                                                    <div className="h-px bg-slate-700 w-2/3 mx-auto"></div>
                                                    <div className="text-center">
                                                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Market Cap Rate</div>
                                                        <div className="text-4xl font-black text-white font-mono">{(Number(data.structured_report.pro_forma.cap_rate || 0) * 100).toFixed(2)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {data.structured_report.value_add_strategies && data.structured_report.value_add_strategies.length > 0 && (
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Value-Add Strategy (The Alpha)</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {data.structured_report.value_add_strategies.map((strategy, i) => (
                                                <div key={i} className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col gap-6 group">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{cleanText(strategy.name)}</h4>
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                            <i className="fa-solid fa-arrow-trend-up"></i>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{cleanText(strategy.description)}</p>
                                                    <div className="grid grid-cols-2 gap-4 mt-auto">
                                                        <div className="p-4 bg-slate-50 rounded-2xl">
                                                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Cost</div>
                                                            <div className="text-sm font-black text-slate-700">{strategy.est_cost}</div>
                                                        </div>
                                                        <div className="p-4 bg-emerald-50 rounded-2xl">
                                                            <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Rent Alpha</div>
                                                            <div className="text-sm font-black text-emerald-700">+{strategy.est_incremental_rent}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {data.structured_report.school_intelligence && (
                                    <div className="p-10 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <i className="fa-solid fa-graduation-cap text-indigo-500 text-xl"></i>
                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">School Intelligence Arbitrage</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                            <div className="md:col-span-2">
                                                <p className="text-slate-600 font-medium leading-relaxed mb-6">{cleanText(data.structured_report.school_intelligence.summary)}</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {data.structured_report.school_intelligence.proficiency_metrics?.map((m, i) => (
                                                        <div key={i} className="px-4 py-2 bg-white rounded-full border border-indigo-100 text-xs font-bold text-indigo-600 flex items-center gap-2 shadow-sm">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                            {cleanText(m)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="p-6 bg-white rounded-3xl border border-indigo-200/50 shadow-sm flex flex-col justify-center text-center">
                                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Rating vs. Performance</div>
                                                <div className="text-xs font-black text-slate-800 italic leading-relaxed">"{cleanText(data.structured_report.school_intelligence.rating_vs_performance_gap)}"</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {data.structured_report.comparative_analysis && (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Regional Competitive Grid</h3>
                                        </div>
                                        <div className="overflow-hidden border border-slate-100 rounded-[2rem] shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50">
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Market</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Median Price</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Age</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Draw</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 bg-white">
                                                    {data.structured_report.comparative_analysis.map((comp, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-6 font-black text-slate-900">{comp.market}</td>
                                                            <td className="p-6 font-mono text-sm text-slate-600">{comp.median_price}</td>
                                                            <td className="p-6 text-sm text-slate-500 font-medium">{comp.inventory_age}</td>
                                                            <td className="p-6 text-xs text-indigo-500 font-black uppercase tracking-wider">{comp.primary_draw}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-slate-950 rounded-[2rem] text-white flex-1 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                                <i className="fa-solid fa-compass text-8xl"></i>
                                            </div>
                                            <div className="relative">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <i className="fa-solid fa-compass text-indigo-400"></i>
                                                    <h3 className="text-lg font-black uppercase tracking-widest">Investment Outlook</h3>
                                                </div>
                                                <div className="space-y-6">
                                                    <div>
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 font-mono">Short-Term (12M)</div>
                                                        <p className="text-sm text-slate-300 font-medium leading-relaxed">{cleanText(data.structured_report.investment_outlook?.short_term || 'Analyzing...')}</p>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2 font-mono">Long-Term (5Y)</div>
                                                        <p className="text-sm text-slate-300 font-medium leading-relaxed">{cleanText(data.structured_report.investment_outlook?.long_term || 'Analyzing...')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-rose-50 rounded-[2.5rem] border border-rose-100 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
                                                <h3 className="text-xl font-black text-rose-900 uppercase tracking-widest">Institutional Risks</h3>
                                            </div>
                                            <p className="text-rose-800/80 mb-6 text-sm font-medium leading-relaxed">{cleanText(data.structured_report.local_risks?.summary)}</p>
                                            <ul className="space-y-3">
                                                {data.structured_report.local_risks?.risk_factors?.map((r, i) => (
                                                    <li key={i} className="text-xs text-rose-700 font-bold flex gap-3 items-start">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-300 mt-1 flex-shrink-0"></span>
                                                        {cleanText(r)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Full Grounded Analyst Report */}
                                <div className="pt-12 border-t border-slate-100 mt-12">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Analyst Narrative & Sources</h3>
                                    </div>
                                    <div className="opacity-80">
                                        {renderMarkdown(data.content)}
                                    </div>
                                </div>

                                {/* Sources Panel */}
                                {(() => {
                                    // Parse all source lines from the markdown Sources section
                                    const parsedSources: { name: string; url?: string }[] = [];
                                    if (typeof data.content === 'string') {
                                        const srcMatch = data.content.match(/##?\s*Sources?\s*\n([\s\S]*?)(?:\n##?\s|$)/i);

                                        if (srcMatch) {
                                            srcMatch[1].split('\n').forEach(line => {
                                                const trimmed = line.trim();
                                                if (!trimmed || /^[*\-•\s]+$/.test(trimmed)) return;

                                                // Strip leading bullet + [cite: N] prefix to get name
                                                const strippedName = trimmed
                                                    .replace(/^[*\-•\d.]+\s*/, '')
                                                    .replace(/^\[cite:[\d,\s]+\]\s*/i, '')
                                                    .trim();

                                                // Try to extract a URL
                                                const mdLink = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
                                                const descUrl = line.match(/[—–-]+\s*(https?:\/\/[^\s),>"]+)/);
                                                const bareUrl = line.match(/(https?:\/\/[^\s),>"]+)/);
                                                const url = mdLink?.[2] || descUrl?.[1] || bareUrl?.[1];

                                                if (strippedName) parsedSources.push({ name: strippedName, url });
                                            });
                                        }
                                    }

                                    // Also pull structured citations with URLs
                                    (data.structured_report?.citations || []).forEach((c: any) => {
                                        if (c.url && !parsedSources.some(s => s.url === c.url)) {
                                            parsedSources.push({ name: c.name || c.url, url: c.url });
                                        }
                                    });

                                    if (parsedSources.length === 0) return null;

                                    const getHostname = (url: string) => {
                                        try { return new URL(url).hostname.replace('www.', ''); }
                                        catch { return url.slice(0, 40); }
                                    };

                                    return (
                                        <div className="mt-10 pt-8 border-t border-slate-100">
                                            <div className="flex items-center gap-2 mb-4">
                                                <i className="fa-solid fa-link text-slate-300 text-xs"></i>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sources</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {parsedSources.map((src, i) => {
                                                    const label = src.url ? getHostname(src.url) : src.name.split(/[,.(]/)[0].trim().slice(0, 48);
                                                    const chipClass = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-500 transition-all group";
                                                    return src.url ? (
                                                        <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" title={src.name}
                                                            className={chipClass + " hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer"}>
                                                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
                                                            <span className="max-w-[160px] truncate">{label}</span>
                                                        </a>
                                                    ) : (
                                                        <span key={i} title={src.name} className={chipClass + " cursor-default"}>
                                                            <i className="fa-solid fa-bookmark text-[9px] opacity-30"></i>
                                                            <span className="max-w-[160px] truncate">{label}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : data.content ? (
                            renderMarkdown(data.content)
                        ) : (Object.keys(data).some(k => /^\d+$/.test(k))) ? (
                            // Auto-heal mangled character maps from previous spread bugs
                            renderMarkdown(
                                Object.entries(data)
                                    .filter(([k]) => /^\d+$/.test(k))
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([_, v]) => v)
                                    .join('')
                            )
                        ) : (
                            <div className="p-8 bg-rose-50 rounded-2xl border border-rose-100">
                                <h3 className="text-rose-900 font-black mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    Data Transparency Check
                                </h3>
                                <p className="text-rose-700 text-sm mb-4">The research content field is empty, but a record exists. Below is the raw data for diagnostic purposes:</p>
                                <pre className="p-4 bg-white/50 rounded-xl text-xs font-mono overflow-auto max-h-96">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sources Panel — always rendered outside content branches */}
                {(() => {
                    const contentStr = typeof data.content === 'string' ? data.content
                        : Object.keys(data).some(k => /^\d+$/.test(k))
                            ? Object.entries(data).filter(([k]) => /^\d+$/.test(k)).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([_, v]) => v).join('')
                            : '';

                    if (!contentStr) return null;

                    const parsedSources: { name: string; url?: string }[] = [];

                    // Scan EVERY line for numbered markdown links: `N. [name]( url)` or `N. [name](url)`
                    // The AI uses Vertex AI redirect URLs with optional leading space
                    contentStr.split('\n').forEach(line => {
                        // Match: optional bullet/number prefix, then [label]( url) allowing whitespace before url
                        const linkMatch = line.match(/\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/);
                        if (linkMatch) {
                            const name = linkMatch[1].trim();
                            const url = linkMatch[2].trim();
                            // Dedupe by url
                            if (!parsedSources.some(s => s.url === url)) {
                                parsedSources.push({ name, url });
                            }
                        }
                    });

                    // Also try structured citations with URLs
                    (data.structured_report?.citations || []).forEach((c: any) => {
                        if (c.url && !parsedSources.some(s => s.url === c.url))
                            parsedSources.push({ name: c.name || c.url, url: c.url });
                    });

                    if (parsedSources.length === 0) return null;

                    const getHostname = (url: string) => {
                        try { return new URL(url).hostname.replace('www.', ''); }
                        catch { return url.slice(0, 40); }
                    };

                    return (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fa-solid fa-link text-slate-300 text-xs"></i>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sources</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {parsedSources.map((src, i) => {
                                    // Show the [name] the AI gave (e.g. "zillow.com") — it's already a domain label
                                    const label = src.name.length > 40 ? getHostname(src.url!) : src.name;
                                    const base = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-500 transition-all group";
                                    return src.url ? (
                                        <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" title={src.url}
                                            className={base + " hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer"}>
                                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
                                            <span className="max-w-[180px] truncate">{label}</span>
                                        </a>
                                    ) : (
                                        <span key={i} title={src.name} className={base + " cursor-default"}>
                                            <i className="fa-solid fa-bookmark text-[9px] opacity-30"></i>
                                            <span className="max-w-[200px] truncate">{src.name.slice(0, 48)}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                <div className="pt-8 border-t border-gray-50">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        Source: Zyphe AI Research
                    </div>
                </div>
            </div>

            <style>{`
                .prose div {
                    color: #334155;
                }
                .prose strong {
                    color: #0f172a;
                    font-weight: 800;
                }
                .prose h1 { font-size: 22px; }
                .prose h2 { font-size: 19px; }
                .prose h3 { font-size: 17px; }
                .prose h1, .prose h2, .prose h3 {
                    color: #1e293b;
                    font-weight: 900;
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                }
            `}</style>
        </div>
    );
};
