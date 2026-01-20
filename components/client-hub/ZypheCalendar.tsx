import React, { useState, useEffect } from 'react';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'appointment' | 'open-house' | 'task';
    client?: string;
    description?: string;
}

interface ZypheCalendarProps {
    onSwitch?: () => void;
}

const ZypheCalendar: React.FC<ZypheCalendarProps> = ({ onSwitch }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([
        {
            id: '1',
            title: 'Property Showing: 123 Maple St.',
            start: new Date(new Date().setHours(13, 0, 0, 0)),
            end: new Date(new Date().setHours(14, 30, 0, 0)),
            type: 'appointment',
            client: 'John Smith',
            description: 'Show the backyard and master suite specifically.'
        },
        {
            id: '2',
            title: 'Open House: 456 Oak Ave',
            start: new Date(new Date().setDate(new Date().getDate() + 2)),
            end: new Date(new Date().setDate(new Date().getDate() + 2)),
            type: 'open-house',
            description: 'Provide refreshments.'
        }
    ]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [activeNotification, setActiveNotification] = useState<CalendarEvent | null>(null);
    const [notifiedEventIds, setNotifiedEventIds] = useState<Set<string>>(new Set());

    // Check for upcoming events every minute
    useEffect(() => {
        const checkEvents = () => {
            const now = new Date();
            const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

            events.forEach(event => {
                if (notifiedEventIds.has(event.id)) return;

                // If event starts precisely in the 15-16 minute window from now
                const timeDiff = event.start.getTime() - now.getTime();
                const minutesDiff = timeDiff / 60000;

                if (minutesDiff > 0 && minutesDiff <= 15) {
                    setActiveNotification(event);
                    setNotifiedEventIds(prev => new Set(prev).add(event.id));

                    // Auto-hide notification after 10 seconds
                    setTimeout(() => setActiveNotification(null), 10000);
                }
            });
        };

        const interval = setInterval(checkEvents, 60000); // Check every minute
        checkEvents(); // Initial check

        return () => clearInterval(interval);
    }, [events, notifiedEventIds]);

    const handleSaveEvent = (updatedEvent: CalendarEvent) => {
        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        setSelectedEvent(null);
        setIsEditing(false);
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
        if (!selectedEvent) return;
        const newEnd = updateTimeFromInput(selectedEvent.end, newTimeStr);
        if (newEnd.getTime() < selectedEvent.start.getTime()) return;
        setSelectedEvent({ ...selectedEvent, end: newEnd });
    };

    const handleDeleteEvent = (eventId: string) => {
        if (confirm('Are you sure you want to delete this event?')) {
            setEvents(prev => prev.filter(e => e.id !== eventId));
            setSelectedEvent(null);
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
                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-[20px] text-slate-400 hover:text-indigo-600 hover:shadow-lg transition-all"
                            title="Switch Calendar System"
                        >
                            <i className="fa-solid fa-right-from-bracket text-xs rotate-180"></i>
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

            const dayEvents = events.filter(e =>
                e.start.getDate() === i &&
                e.start.getMonth() === month &&
                e.start.getFullYear() === year
            );

            cells.push(
                <div key={i} className={`min-h-[140px] p-4 border border-slate-100 group transition-all relative ${isWeekend ? 'bg-slate-100/40' : ''} hover:bg-white`}>
                    <span className={`text-sm font-bold transition-all inline-flex items-center justify-center mb-2 ${isToday ? 'bg-indigo-600 text-white w-8 h-8 rounded-xl shadow-lg shadow-indigo-200' : 'text-slate-600 group-hover:text-indigo-600 group-hover:scale-110'}`}>
                        {i}
                    </span>
                    <div className="space-y-1">
                        {dayEvents.map(event => (
                            <div
                                key={event.id}
                                onDoubleClick={() => { setSelectedEvent(event); setIsEditing(true); }}
                                className={`p-1.5 text-[10px] font-bold rounded-lg border truncate shadow-sm cursor-pointer hover:scale-[1.02] transition-transform ${event.type === 'open-house' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    event.type === 'task' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}
                            >
                                <i className={`fa-solid ${event.type === 'open-house' ? 'fa-house-chimney' : event.type === 'task' ? 'fa-list-check' : 'fa-handshake'} mr-1.5 opacity-60`}></i>
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
            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200/50 overflow-hidden flex flex-col h-[700px]">
                {/* Header */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <div className="w-20 border-r border-slate-100"></div>
                    {Array.from({ length: numColumns }).map((_, i) => {
                        const date = columnDateFetcher(i);
                        const isToday = date.toDateString() === new Date().toDateString();
                        const dayOfWeek = (date.getDay() + 6) % 7;
                        const isWeekend = dayOfWeek >= 5;
                        return (
                            <div key={i} className={`flex-1 py-6 text-center border-r border-slate-100 last:border-r-0 ${isWeekend ? 'bg-slate-200/30' : ''}`}>
                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {daysOfWeek[dayOfWeek]}
                                </div>
                                <div className={`text-xl font-black ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
                                    {date.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto relative scrollbar-hide">
                    <div className="flex min-h-full">
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
                            const isWeekend = ((date.getDay() + 6) % 7) >= 5;
                            return (
                                <div key={i} className={`flex-1 relative border-r border-slate-50 last:border-r-0 group ${isWeekend ? 'bg-slate-100/40' : ''}`}>
                                    {hours.map(hour => (
                                        <div key={hour} className="h-20 border-b border-slate-50 relative group-hover:bg-indigo-50/10 transition-colors">
                                            {/* Half hour line */}
                                            <div className="absolute top-1/2 left-0 right-0 border-t border-slate-50/50 border-dashed"></div>
                                        </div>
                                    ))}

                                    {/* Real Events */}
                                    {events.filter(e => e.start.toDateString() === date.toDateString()).map(event => {
                                        const startHour = event.start.getHours() + (event.start.getMinutes() / 60);
                                        const endHour = event.end.getHours() + (event.end.getMinutes() / 60);
                                        const duration = endHour - startHour;

                                        const relativeStart = startHour >= 6 ? startHour - 6 : startHour + 18;

                                        return (
                                            <div
                                                key={event.id}
                                                onDoubleClick={() => { setSelectedEvent(event); setIsEditing(false); }}
                                                style={{
                                                    top: `${relativeStart * 80}px`,
                                                    height: `${duration * 80}px`
                                                }}
                                                className={`absolute left-2 right-2 p-3 rounded-2xl shadow-xl z-10 hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden border ${event.type === 'open-house' ? 'bg-emerald-600/90 border-emerald-500' :
                                                    event.type === 'task' ? 'bg-amber-600/90 border-amber-500' :
                                                        'bg-indigo-600/90 border-indigo-500'
                                                    } text-white`}
                                            >
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                                                    {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="font-bold text-xs">{event.title}</div>
                                                {event.client && (
                                                    <div className="text-[10px] mt-2 flex items-center gap-1 opacity-90 font-medium">
                                                        <i className="fa-solid fa-user-tag text-[8px]"></i> {event.client}
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
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] relative">
            {/* Upcoming Event Notification */}
            {activeNotification && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md animate-in fade-in slide-in-from-top-8 duration-500">
                    <div className="mx-4 bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl flex items-center gap-5 border border-slate-800 backdrop-blur-xl">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 animate-pulse ${activeNotification.type === 'open-house' ? 'bg-emerald-500' :
                            activeNotification.type === 'task' ? 'bg-amber-500' :
                                'bg-indigo-500'
                            }`}>
                            <i className="fa-solid fa-bell text-xl"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Upcoming in 15m</p>
                            <h4 className="font-bold truncate">{activeNotification.title}</h4>
                            <p className="text-xs text-slate-400 font-medium">Starts at {activeNotification.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button
                            onClick={() => setActiveNotification(null)}
                            className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
                        >
                            <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>
            )}

            <div className="p-12 max-w-screen-2xl mx-auto">
                {renderHeader()}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {viewMode === 'month' && renderMonthView()}
                    {viewMode === 'week' && renderWeekView()}
                    {viewMode === 'day' && renderDayView()}
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
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">
                                        Event Details
                                    </span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="text-3xl font-black text-slate-900 border-b-2 border-slate-100 focus:border-indigo-600 outline-none w-full pb-1"
                                            defaultValue={selectedEvent.title}
                                            onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                                        />
                                    ) : (
                                        <h3 className="text-3xl font-black text-slate-900">{selectedEvent.title}</h3>
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
                                        <i className="fa-solid fa-clock-rotate-left"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Time Range</p>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(selectedEvent.start)}
                                                    onChange={(e) => handleStartTimeChange(e.target.value)}
                                                />
                                                <span className="text-slate-400 font-bold">to</span>
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(selectedEvent.end)}
                                                    onChange={(e) => handleEndTimeChange(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-slate-900 font-bold">
                                                {selectedEvent.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {selectedEvent.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {selectedEvent.client && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-user-tie"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Client</p>
                                            <p className="text-slate-900 font-bold">{selectedEvent.client}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mt-1">
                                        <i className="fa-solid fa-align-left"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Description</p>
                                        {isEditing ? (
                                            <textarea
                                                className="w-full text-slate-600 font-medium border-2 border-slate-100 rounded-2xl p-4 focus:border-indigo-600 outline-none min-h-[100px]"
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
                                            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-8 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex-1 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-sm hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <i className="fa-solid fa-pen-to-square text-slate-400 group-hover:text-indigo-600"></i> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEvent(selectedEvent.id)}
                                            className="flex-1 py-4 bg-white border border-rose-100 text-rose-500 rounded-2xl font-black uppercase tracking-widest shadow-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <i className="fa-solid fa-trash-can opacity-60"></i> Delete
                                        </button>
                                        <button
                                            onClick={() => setSelectedEvent(null)}
                                            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
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
