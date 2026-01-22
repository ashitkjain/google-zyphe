import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import { getTransactionDocuments, addTransactionDocument, updateTransactionDocument, deleteTransactionDocument, getTransactionByClientId, seedDocumentsForTransaction, TransactionDocument, getTransactions } from '../../services/firebaseService';

interface DocumentsTabProps {
    lead: Lead;
    realtorId: string;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ lead, realtorId }) => {
    const [documents, setDocuments] = useState<TransactionDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<TransactionDocument>>({});
    const [isAdding, setIsAdding] = useState(false);

    const MOCK_DOCUMENTS: TransactionDocument[] = [
        { id: 'm1', transaction_id: 'mock', name: 'Mock Contract', category: 'Contract', status: 'Completed', comments: 'Signed' }
    ];

    useEffect(() => {
        const fetchTransactionAndDocuments = async () => {
            setLoading(true);
            try {
                // 1. Precise Query by clientId
                let tx = await getTransactionByClientId(lead.id, realtorId);

                // 2. Fallback: Search all realtor transactions by address
                if (!tx) {
                    const allTransactions = await getTransactions(realtorId);
                    tx = allTransactions.find(t =>
                        t.property?.address === (lead.subjectProperty || lead.propertyAddress)
                    ) || null;
                }

                if (tx) {
                    setTransactionId(tx.id);
                    const docsData = await getTransactionDocuments(tx.id);
                    setDocuments(docsData);
                } else {
                    setTransactionId('mock_tx_id');
                    setDocuments(MOCK_DOCUMENTS);
                }
            } catch (error) {
                console.error("Error fetching documents:", error);
                setDocuments([]);
            } finally {
                setLoading(false);
            }
        };

        if (lead.id) {
            fetchTransactionAndDocuments();
        } else {
            setDocuments(MOCK_DOCUMENTS);
            setLoading(false);
            setTransactionId('mock_tx_id');
        }
    }, [lead.id, realtorId, lead.subjectProperty, lead.propertyAddress]);

    const handleEdit = (doc: TransactionDocument) => {
        setEditingId(doc.id);
        setEditForm(doc);
    };

    const handleSave = async (id: string) => {
        if (!transactionId) return;
        try {
            await updateTransactionDocument(transactionId, id, editForm);
            setDocuments(documents.map(d => d.id === id ? { ...d, ...editForm } as TransactionDocument : d));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating document:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!transactionId || !window.confirm("Are you sure you want to delete this document record?")) return;
        try {
            await deleteTransactionDocument(transactionId, id);
            setDocuments(documents.filter(d => d.id !== id));
        } catch (error) {
            console.error("Error deleting document:", error);
        }
    };

    const handleAdd = async () => {
        if (!transactionId) return;
        const newDoc: Partial<TransactionDocument> = {
            name: 'New Document',
            category: 'Other',
            status: 'Pending',
            comments: '',
            ...editForm
        };
        try {
            const added = await addTransactionDocument(transactionId, newDoc);
            if (added) {
                setDocuments([...documents, added]);
                setIsAdding(false);
                setEditForm({});
            }
        } catch (error) {
            console.error("Error adding document:", error);
        }
    };

    const handleSeedData = async () => {
        if (!transactionId || transactionId === 'mock_tx_id') return;
        setLoading(true);
        await seedDocumentsForTransaction(transactionId);
        const docsData = await getTransactionDocuments(transactionId);
        setDocuments(docsData);
        setLoading(false);
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-rose-100 text-rose-600 border-rose-200';
            case 'Completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
            case 'Rejected': return 'bg-slate-800 text-white border-slate-900';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!transactionId) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-file-circle-exclamation text-4xl text-slate-300 mb-4"></i>
                <h3 className="text-lg font-bold text-slate-600">No Transaction Record</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2">Create a transaction record to manage documents.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {transactionId && transactionId !== 'mock_tx_id' && (
                        <button
                            onClick={handleSeedData}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                            title="Upload mock documents to firebase"
                        >
                            <i className="fa-solid fa-cloud-upload"></i>
                            Seed Data
                        </button>
                    )}
                    <button
                        onClick={() => { setIsAdding(true); setEditForm({ status: 'Pending', category: 'Contract' }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Add Document
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Comments</th>
                            <th className="px-6 py-4 text-center">Attachment</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isAdding && (
                            <tr className="bg-indigo-50/30">
                                <td className="px-6 py-4">
                                    <input
                                        type="text"
                                        placeholder="Document Name"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        autoFocus
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="text"
                                        placeholder="Category"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.category || ''}
                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.status || 'Pending'}
                                        onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="text"
                                        placeholder="Comments"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.comments || ''}
                                        onChange={e => setEditForm({ ...editForm, comments: e.target.value })}
                                    />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button className="text-slate-300 cursor-not-allowed">
                                        <i className="fa-solid fa-paperclip"></i>
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    <button onClick={handleAdd} className="text-emerald-500 hover:text-emerald-600 font-bold text-xs uppercase">Save</button>
                                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-500 font-bold text-xs uppercase">Cancel</button>
                                </td>
                            </tr>
                        )}
                        {documents.length === 0 && !isAdding && (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <i className="fa-solid fa-folder-open text-2xl text-slate-200"></i>
                                        <p className="text-sm font-bold text-slate-400">No documents found</p>
                                        <p className="text-[10px] text-slate-300 uppercase tracking-widest">Click "Add Document" or "Seed Data" to begin</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {documents.map(doc => (
                            <tr key={doc.id} className="group hover:bg-slate-50/50 transition-all">
                                {editingId === doc.id ? (
                                    <>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.name || ''}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.category || ''}
                                                onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.status || 'Pending'}
                                                onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Rejected">Rejected</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.comments || ''}
                                                onChange={e => setEditForm({ ...editForm, comments: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <i className="fa-solid fa-paperclip text-slate-300"></i>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2 text-sm">
                                            <button onClick={() => handleSave(doc.id)} className="text-indigo-600 hover:text-indigo-700 font-bold text-xs uppercase">Save</button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-500 font-bold text-xs uppercase">Cancel</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{doc.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusBadgeColor(doc.status)}`}>
                                                {doc.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">{doc.comments || '--'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                <i className="fa-solid fa-paperclip"></i>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(doc)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors">
                                                <i className="fa-solid fa-pen text-[10px]"></i>
                                            </button>
                                            <button onClick={() => handleDelete(doc.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors">
                                                <i className="fa-solid fa-trash text-[10px]"></i>
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DocumentsTab;
