import React from 'react';
import { CRMTask } from '../../types';

interface TaskBoardProps {
    tasks: CRMTask[];
}

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TaskBoard: React.FC<TaskBoardProps> = ({ tasks }) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Today's Focus</h2>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse flex items-center gap-2">
                        <i className="fa-solid fa-brain text-indigo-500"></i> AI Priority Sorting Active
                    </span>
                    <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Add Task</button>
                </div>
            </div>

            <div className="flex-1 p-10 max-w-5xl mx-auto w-full overflow-y-auto">
                <div className="space-y-6">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-xl group hover:border-indigo-200 transition-all flex items-center gap-8 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-2 h-full ${task.priority === 'Urgent' ? 'bg-rose-500' : task.priority === 'High' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                <i className={`fa-solid ${task.type === 'Call' ? 'fa-phone' : task.type === 'Email' ? 'fa-envelope' : 'fa-calendar'} text-2xl`}></i>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-1">
                                    <h4 className="text-xl font-black text-slate-900 tracking-tight">{task.title}</h4>
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${task.priority === 'Urgent' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                        }`}>{task.priority}</span>
                                </div>
                                <p className="text-slate-500 font-medium">{task.description}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Due {formatDate(task.dueDate)}</div>
                                <button className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">Complete Item</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TaskBoard;
