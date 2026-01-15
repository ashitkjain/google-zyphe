import React from 'react';

interface LeadsHeaderProps {
    activeTab: 'Buyer' | 'Seller';
    setActiveTab: (tab: 'Buyer' | 'Seller') => void;
    onCreateLead: (initialUpdates?: any) => void;
}

const LeadsHeader: React.FC<LeadsHeaderProps> = ({ activeTab, setActiveTab, onCreateLead }) => {
    return (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex-shrink-0 w-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Tab Switcher */}
                    <div className="flex bg-slate-200/50 p-1 rounded-xl items-center mr-4">
                        <button
                            onClick={() => setActiveTab('Buyer')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Buyer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-user-tag"></i>
                            Buyer
                        </button>
                        <button
                            onClick={() => setActiveTab('Seller')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Seller' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-house-chimney-user"></i>
                            Seller
                        </button>
                    </div>

                    <button
                        onClick={() => onCreateLead({ leadType: activeTab })}
                        className={`mr-4 w-8 h-8 rounded-full text-white flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 ${activeTab === 'Buyer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        title={`Create New ${activeTab} Lead`}
                    >
                        <i className="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadsHeader;
