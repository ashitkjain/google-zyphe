import React, { useState, useEffect } from 'react';
import ClientSelector from './ClientSelector';
import { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from '../../services/firebaseService';
import { Lead, CalendarEvent, CRMTask } from '../../types';

type ViewMode = 'month' | 'week' | 'day';

interface ZypheCalendarProps {
    realtorId: string;
    onSwitch?: () => void;
    leads?: Lead[];
    tasks?: CRMTask[];
}

const ZypheCalendar: React.FC<ZypheCalendarProps> = ({ realtorId, onSwitch, leads = [], tasks = [] }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const fetchEvents = async () => {
            setIsFetching(true);
            const fetched = await getCalendarEvents(realtorId);
            setEvents(fetched);
            setIsFetching(false);
        };
        fetchEvents();
    }, [realtorId]);

    // Helper to normalize dates from CRM tasks
    const parseTaskDate = (val: any): Date => {
        if (!val) return new Date();
        if (typeof val.toDate === 'function') return val.toDate();
        if (val.seconds !== undefined) return new Date(val.seconds * 1000);
        return new Date(val);
    };

    // Combine fetched events with passed CRM tasks
    const allEvents = React.useMemo(() => {
        const taskEvents: CalendarEvent[] = tasks.map(task => {
            const dueDate = parseTaskDate(task.dueDate);
            const lead = leads.find(l => l.id === task.clientId || l.clientId === task.clientId);
            return {
                id: `task-${task.id}`,
                realtorId: task.realtorId,
                title: task.name,
                start: dueDate,
                end: new Date(dueDate.getTime() + 30 * 60 * 1000), // 30 mins duration
                type: 'task',
                clientId: task.clientId,
                client: lead?.fullName || '',
                description: task.comment
            };
        });

        // Filter out any duplicate tasks if they somehow exist in events already
        return [...events, ...taskEvents];
    }, [events, tasks, leads]);

    const isPast = (date: Date) => {
        return date.getTime() < new Date().getTime();
    };

    const handleSaveEvent = async (updatedEvent: CalendarEvent) => {
        if (isPast(updatedEvent.start)) {
            alert("Cannot move an event into the past.");
            return;
        }

        // Final safety check: if end is before start, set end to start + 30 mins
        let finalEvent = { ...updatedEvent, realtorId };
        if (finalEvent.end.getTime() < finalEvent.start.getTime()) {
            finalEvent.end = new Date(finalEvent.start.getTime() + 30 * 60 * 1000);
        }

        const savedId = await saveCalendarEvent(finalEvent);
        if (savedId) {
            const persistedEvent = { ...finalEvent, id: savedId };
            setEvents(prev => {
                const exists = prev.find(e => e.id === finalEvent.id || e.id === savedId);
                if (exists) {
                    return prev.map(e => (e.id === finalEvent.id || e.id === savedId) ? persistedEvent : e);
                } else {
                    return [...prev, persistedEvent];
                }
            });
            setSelectedEvent(null);
            setIsEditing(false);
        } else {
            alert("Failed to save event. Please check your connection.");
        }
    };

    const handleCreateNewEvent = (date: Date, hour?: number) => {
        const start = new Date(date);
        if (hour !== undefined) {
            start.setHours(hour, 0, 0, 0);
        } else {
            const now = new Date();
            if (date.toDateString() === now.toDateString()) {
                start.setHours(now.getHours() + 1, 0, 0, 0);
            } else {
                start.setHours(9, 0, 0, 0);
            }
        }

        if (isPast(start)) {
            alert("Cannot create events in the past.");
            return;
        }

        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

        const newEvent: CalendarEvent = {
            id: `new-${Date.now()}`,
            realtorId,
            title: 'New Event',
            start,
            end,
            type: 'appointment',
            description: ''
        };

        setSelectedEvent(newEvent);
        setIsEditing(true);
    };

    const formatTimeToInput = (date: Date) => {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const updateTimeFromInput = (originalDate: Date, timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const newDate = new Date(originalDate);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
    };

    const handleStartTimeChange = (newTimeStr: string) => {
        if (!selectedEvent) return;
        const originalDuration = selectedEvent.end.getTime() - selectedEvent.start.getTime();
        const newStart = updateTimeFromInput(selectedEvent.start, newTimeStr);
        const newEnd = new Date(newStart.getTime() + originalDuration);
        setSelectedEvent({ ...selectedEvent, start: newStart, end: newEnd });
    };

    const handleEndTimeChange = (newTimeStr: string) => {
        if (!selectedEvent || !newTimeStr) return;
        const newEnd = updateTimeFromInput(selectedEvent.end, newTimeStr);
        setSelectedEvent({ ...selectedEvent, end: newEnd });
    };

    const formatDateToInput = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDateChange = (dateStr: string) => {
        if (!selectedEvent) return;
        const [y, m, d] = dateStr.split('-').map(Number);

        const newStart = new Date(selectedEvent.start);
        newStart.setFullYear(y, m - 1, d);

        const newEnd = new Date(selectedEvent.end);
        newEnd.setFullYear(y, m - 1, d);

        setSelectedEvent({ ...selectedEvent, start: newStart, end: newEnd });
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        const success = await deleteCalendarEvent(eventId);
        if (success) {
            setEvents(prev => prev.filter(e => e.id !== eventId));
            setSelectedEvent(null);
        } else {
            alert("Failed to delete event. Please check your connection.");
        }
    };

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return (day + 6) % 7; // Adjust Sunday (0) to 6, Monday (1) to 0, etc.
    };

    const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-8 px-4">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 leading-none">
                            {viewMode === 'day' ? currentDate.getDate() : ''} {monthNames[currentDate.getMonth()]}
                        </h2>
                        <span className="text-indigo-600 font-bold tracking-widest uppercase text-xs">
                            {currentDate.getFullYear()} • {viewMode} view
                        </span>
                    </div>

                    <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm ml-4">
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
                                else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
                                else newDate.setDate(newDate.getDate() - 1);
                                setCurrentDate(newDate);
                            }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-600 active:scale-90"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-5 py-2 text-xs font-black text-slate-900 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
                                else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
                                else newDate.setDate(newDate.getDate() + 1);
                                setCurrentDate(newDate);
                            }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-600 active:scale-90"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-200/50 p-1.5 rounded-[20px] shadow-inner backdrop-blur-sm">
                        {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-[14px] transition-all duration-300 ${viewMode === mode
                                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100 scale-105'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    {onSwitch && (
                        <button
                            onClick={onSwitch}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-[14px] text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg transition-all group"
                            title="Switch Calendar System"
                        >
                            <i className="fa-solid fa-arrows-rotate text-xs group-hover:rotate-180 transition-transform duration-500"></i>
                            <span className="text-[10px] font-black uppercase tracking-widest">Sync External</span>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const prevMonthDays = getDaysInMonth(year, month - 1);

        const cells = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const isWeekend = (firstDay - 1 - i) >= 5;
            cells.push(
                <div key={`prev-${i}`} className={`min-h-[140px] p-4 border border-slate-100 ${isWeekend ? 'bg-slate-200/40' : 'bg-slate-50/40'} text-slate-300`}>
                    <span className="text-sm font-bold opacity-50">{prevMonthDays - i}</span>
                </div>
            );
        }

        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dayOfWeek = (date.getDay() + 6) % 7;
            const isWeekend = dayOfWeek >= 5;
            const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;

            const dayEvents = allEvents.filter(e => {
                const eDate = e.start instanceof Date ? e.start : (typeof e.start.toDate === 'function' ? e.start.toDate() : new Date(e.start.seconds * 1000));
                return eDate.getDate() === i &&
                    eDate.getMonth() === month &&
                    eDate.getFullYear() === year;
            });

            cells.push(
                <div
                    key={i}
                    onDoubleClick={() => handleCreateNewEvent(date)}
                    className={`min-h-[140px] p-4 border border-slate-100 group transition-all relative cursor-pointer ${isToday ? 'bg-indigo-50/30' : ''} ${isWeekend ? 'bg-slate-100/40' : ''} hover:bg-white`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-bold transition-all inline-flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white w-8 h-8 rounded-xl shadow-lg shadow-indigo-200' : 'text-slate-600 group-hover:text-indigo-600 group-hover:scale-110'}`}>
                            {i}
                        </span>
                        {isToday && (
                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-100 px-2 py-1 rounded-full">Today</span>
                        )}
                    </div>
                    <div className="space-y-1">
                        {dayEvents.map(event => (
                            <div
                                key={event.id}
                                onClick={() => { setSelectedEvent(event); setIsEditing(true); }}
                                className={`p-1.5 text-[10px] font-bold rounded-lg border break-words whitespace-normal shadow-sm cursor-pointer hover:scale-[1.02] transition-transform ${event.type === 'open-house' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    event.type === 'task' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}
                            >
                                <i className={`fa-solid ${event.type === 'open-house' ? 'fa-house-chimney' : event.type === 'task' ? 'fa-list-check' : 'fa-handshake'} mr-1.5 opacity-60`}></i>
                                {event.client && (
                                    <span className="text-indigo-600 font-black mr-1">
                                        [{event.client}]
                                    </span>
                                )}
                                {event.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border border-slate-200/50 overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                    {daysOfWeek.map(day => (
                        <div key={day} className="py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells}
                </div>
            </div>
        );
    };

    const renderTimeGrid = (numColumns: number, columnDateFetcher: (colIdx: number) => Date) => {
        return (
            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200/50 overflow-hidden relative">
                {/* Header */}
                <div className="flex border-b border-slate-100 bg-slate-50/90 backdrop-blur-md sticky top-0 z-50">
                    <div className="w-20 border-r border-slate-100"></div>
                    {Array.from({ length: numColumns }).map((_, i) => {
                        const date = columnDateFetcher(i);
                        const isToday = date.toDateString() === new Date().toDateString();
                        const dayOfWeek = (date.getDay() + 6) % 7;
                        const isWeekend = dayOfWeek >= 5;
                        return (
                            <div key={i} className={`flex-1 py-6 text-center border-r border-slate-100 last:border-r-0 relative ${isWeekend ? 'bg-slate-200/30' : ''}`}>
                                {isToday && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600"></div>
                                )}
                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {daysOfWeek[dayOfWeek]}
                                </div>
                                <div className={`text-xl font-black inline-flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white w-10 h-10 rounded-2xl shadow-lg shadow-indigo-100' : 'text-slate-900'}`}>
                                    {date.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Grid */}
                <div className="relative">
                    <div className="flex">
                        {/* Time labels */}
                        <div className="w-20 border-r border-slate-100 bg-slate-50/20">
                            {hours.map(hour => (
                                <div key={hour} className="h-20 text-[10px] font-bold text-slate-400 text-right pr-4 py-2 uppercase tracking-tighter">
                                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                </div>
                            ))}
                        </div>

                        {/* Columns */}
                        {Array.from({ length: numColumns }).map((_, i) => {
                            const date = columnDateFetcher(i);
                            const isToday = date.toDateString() === new Date().toDateString();
                            const isWeekend = ((date.getDay() + 6) % 7) >= 5;

                            // Current time line calculation
                            const now = new Date();
                            const currentHour = now.getHours() + (now.getMinutes() / 60);
                            const relativeNow = currentHour >= 6 ? currentHour - 6 : currentHour + 18;

                            return (
                                <div key={i} className={`flex-1 relative border-r border-slate-50 last:border-r-0 group ${isWeekend ? 'bg-slate-100/40' : ''}`}>
                                    {isToday && (
                                        <div
                                            className="absolute left-0 right-0 z-40 pointer-events-none flex items-center"
                                            style={{ top: `${relativeNow * 80}px` }}
                                        >
                                            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm -ml-1"></div>
                                            <div className="flex-1 border-t-2 border-rose-500 border-dotted shadow-[0_1px_2px_rgba(244,63,94,0.2)]"></div>
                                        </div>
                                    )}
                                    {hours.map(hour => (
                                        <div
                                            key={hour}
                                            onDoubleClick={() => handleCreateNewEvent(date, hour)}
                                            className="h-20 border-b border-slate-50 relative group-hover:bg-indigo-50/10 transition-colors cursor-crosshair"
                                        >
                                            {/* Half hour line */}
                                            <div className="absolute top-1/2 left-0 right-0 border-t border-slate-50/50 border-dashed"></div>
                                        </div>
                                    ))}

                                    {/* Real Events */}
                                    {allEvents.filter(e => {
                                        const eDate = e.start instanceof Date ? e.start : (typeof e.start.toDate === 'function' ? e.start.toDate() : new Date(e.start.seconds * 1000));
                                        return eDate.toDateString() === date.toDateString();
                                    }).map(event => {
                                        const eStart = event.start instanceof Date ? event.start : (typeof event.start.toDate === 'function' ? event.start.toDate() : new Date(event.start.seconds * 1000));
                                        const eEnd = event.end instanceof Date ? event.end : (typeof event.end.toDate === 'function' ? event.end.toDate() : new Date(event.end.seconds * 1000));

                                        const startHour = eStart.getHours() + (eStart.getMinutes() / 60);
                                        const endHour = eEnd.getHours() + (eEnd.getMinutes() / 60);
                                        const duration = endHour - startHour;

                                        const relativeStart = startHour >= 6 ? startHour - 6 : startHour + 18;

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => { setSelectedEvent(event); setIsEditing(true); }}
                                                style={{
                                                    top: `${relativeStart * 80}px`,
                                                    height: `${duration * 80}px`
                                                }}
                                                className={`absolute left-2 right-2 p-2 rounded-lg shadow-sm z-10 hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden border ${event.type === 'open-house' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    event.type === 'task' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                    }`}
                                            >
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                                                    {eStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="font-bold text-[11px] leading-tight break-words whitespace-normal">
                                                    {event.client && (
                                                        <span className="text-indigo-600 font-black mr-1">
                                                            [{event.client}]
                                                        </span>
                                                    )}
                                                    {event.title}
                                                </div>
                                                {event.type === 'task' && event.description && (
                                                    <div className="text-[9px] mt-1 opacity-70 font-medium italic break-words whitespace-normal">
                                                        {event.description}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderWeekView = () => {
        const getWeekDate = (idx: number) => {
            const date = new Date(currentDate);
            const day = date.getDay(); // 0 (Sun) to 6 (Sat)
            const mondayDiff = day === 0 ? -6 : 1 - day;
            const monday = new Date(date.setDate(date.getDate() + mondayDiff));
            return new Date(monday.setDate(monday.getDate() + idx));
        };
        return renderTimeGrid(7, getWeekDate);
    };

    const renderDayView = () => {
        return renderTimeGrid(1, () => currentDate);
    };

    return (
        <div className="flex-1 bg-[#F8FAFC]">
            <div className="p-12 max-w-screen-2xl mx-auto">
                {renderHeader()}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {isFetching ? (
                        <div className="flex flex-col items-center justify-center py-40 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Schedule...</p>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'month' && renderMonthView()}
                            {viewMode === 'week' && renderWeekView()}
                            {viewMode === 'day' && renderDayView()}
                        </>
                    )}
                </div>

                <div className="mt-12 flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white">
                    <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div> Appointments
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Open Houses
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div> Tasks
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Details / Edit Layer */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                        <div className={`h-3 ${selectedEvent.type === 'open-house' ? 'bg-emerald-500' :
                            selectedEvent.type === 'task' ? 'bg-amber-500' :
                                'bg-indigo-500'
                            }`} />

                        <div className="p-10">
                            <div className="flex justify-between items-start mb-8 gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 block">
                                            Event Details
                                        </span>
                                        {isPast(selectedEvent.start) && (
                                            <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-rose-100 italic">
                                                Past Event
                                            </span>
                                        )}
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            rows={1}
                                            className="text-xl font-bold text-slate-900 border-b border-slate-100 focus:border-indigo-600 outline-none w-full pb-1 bg-transparent resize-none overflow-hidden"
                                            defaultValue={selectedEvent.title}
                                            onChange={(e) => {
                                                setSelectedEvent({ ...selectedEvent, title: e.target.value });
                                                // Auto-resize
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                        />
                                    ) : (
                                        <h3 className="text-xl font-bold text-slate-900 break-words">{selectedEvent.title}</h3>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <i className="fa-solid fa-calendar-day"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Date</p>
                                        {isEditing ? (
                                            <input
                                                type="date"
                                                className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                                value={formatDateToInput(selectedEvent.start)}
                                                onChange={(e) => handleDateChange(e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-slate-900 font-semibold">
                                                {selectedEvent.start.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <i className="fa-solid fa-clock-rotate-left"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Time Range</p>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(selectedEvent.start)}
                                                    onChange={(e) => handleStartTimeChange(e.target.value)}
                                                />
                                                <span className="text-slate-400 font-semibold">to</span>
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(selectedEvent.end)}
                                                    onChange={(e) => handleEndTimeChange(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-slate-900 font-semibold">
                                                {selectedEvent.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {selectedEvent.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <i className="fa-solid fa-user-tie"></i>
                                    </div>
                                    <div className="flex-1 relative">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Client</p>
                                        {isEditing ? (
                                            <ClientSelector
                                                leads={leads}
                                                selectedClientId={selectedEvent.clientId}
                                                onSelect={(id, name) => setSelectedEvent({ ...selectedEvent, clientId: id, client: name })}
                                            />
                                        ) : (
                                            <p className="text-slate-900 font-semibold">{selectedEvent.client || "No client assigned"}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mt-1">
                                        <i className="fa-solid fa-align-left"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Description</p>
                                        {isEditing ? (
                                            <textarea
                                                className="w-full text-slate-600 font-medium border border-slate-100 rounded-2xl p-4 focus:border-indigo-600 outline-none min-h-[100px]"
                                                defaultValue={selectedEvent.description}
                                                onChange={(e) => setSelectedEvent({ ...selectedEvent, description: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-slate-600 font-medium leading-relaxed">
                                                {selectedEvent.description || "No description provided for this event."}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex gap-4">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => handleSaveEvent(selectedEvent)}
                                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 py-2.5 bg-slate-50 text-slate-400 rounded-xl font-bold uppercase tracking-wider text-[11px] hover:text-slate-600 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {!isPast(selectedEvent.start) && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-sm hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group"
                                            >
                                                <i className="fa-solid fa-pen-to-square text-slate-400 group-hover:text-indigo-600"></i> Edit
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteEvent(selectedEvent.id)}
                                            className="flex-1 py-2.5 bg-white border border-rose-100 text-rose-500 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <i className="fa-solid fa-trash-can opacity-60"></i> {isPast(selectedEvent.start) ? 'Cancel Past Event' : 'Delete'}
                                        </button>
                                        <button
                                            onClick={() => setSelectedEvent(null)}
                                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] hover:bg-slate-800 transition-all"
                                        >
                                            Close
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZypheCalendar;
