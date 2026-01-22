import React, { useState, useEffect, useRef } from 'react';
import { Lead } from '../../types';
import { getTransactionDocuments, addTransactionDocument, updateTransactionDocument, deleteTransactionDocument, getTransactionByClientId, seedDocumentsForTransaction, TransactionDocument, getTransactions, uploadTransactionDocumentFile, getDocumentDownloadUrl, addDocumentVersion } from '../../services/firebaseService';

interface DocumentsTabProps {
    lead: Lead;
    realtorId: string;
}

const ActionsDropdown: React.FC<{
    doc: TransactionDocument;
    onEdit: (doc: TransactionDocument) => void;
    onDelete: (id: string) => void;
    onUploadVersion: (doc: TransactionDocument) => void;
    onView: (doc: TransactionDocument) => void;
}> = ({ doc, onEdit, onDelete, onUploadVersion, onView }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
                title="Actions"
            >
                <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden ml-[-100px]">
                    <div className="py-1">
                        {doc.storage_path && (
                            <button
                                onClick={() => { onView(doc); setIsOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                            >
                                <i className="fa-solid fa-eye w-4"></i> Preview
                            </button>
                        )}
                        <button
                            onClick={() => { onUploadVersion(doc); setIsOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-cloud-arrow-up w-4"></i> Upload Version
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button
                            onClick={() => { onEdit(doc); setIsOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-pen w-4"></i> Rename / Edit
                        </button>
                        <button
                            onClick={() => { onDelete(doc.id); setIsOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-trash w-4"></i> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Main Component
const DocumentsTab: React.FC<DocumentsTabProps> = ({ lead, realtorId }) => {
    // ... (Keep existing state)
    const [documents, setDocuments] = useState<TransactionDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<TransactionDocument>>({});
    const [isAdding, setIsAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null); // Track which doc we are uploading to

    // ... (Keep existing useEffects and lifecycle)
    const MOCK_DOCUMENTS: TransactionDocument[] = [
        { id: 'm1', transaction_id: 'mock', name: 'Mock Contract', category: 'Contract', status: 'Completed', comments: 'Signed', updated_at: new Date() }
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
                    console.log("[DocumentsTab] Setting documents:", docsData);
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


    // Format Date Helper
    const formatDate = (val: any) => {
        if (!val) return '--';
        if (val.toDate) return val.toDate().toLocaleDateString(); // Firestore Timestamp
        if (val instanceof Date) return val.toLocaleDateString();
        return new Date(val).toLocaleDateString();
    };


    const handleEdit = (doc: TransactionDocument) => {
        setEditingId(doc.id);
        setEditForm(doc);
    };

    const handleSave = async (id: string) => {
        if (!transactionId) return;
        try {
            await updateTransactionDocument(transactionId, id, editForm);
            // Optiimistic update (including timestamp)
            setDocuments(documents.map(d => d.id === id ? { ...d, ...editForm, updated_at: new Date() } as TransactionDocument : d));
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

    // Trigger file input for a specific doc (or new doc)
    const triggerUpload = (docId: string | null = null) => {
        setUploadTargetId(docId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!transactionId || !event.target.files?.length) return;
        if (transactionId === 'mock_tx_id') {
            alert("Cannot upload files to mock transaction. Please create a real transaction first.");
            return;
        }

        const file = event.target.files[0];
        try {
            if (uploadTargetId) {
                // CASE A: Existing Document -> Create New Version
                const updatedDoc = await addDocumentVersion(transactionId, uploadTargetId, file);
                if (updatedDoc) {
                    // Update local state with the FULL updated document (including version number)
                    setDocuments(docs => docs.map(d => d.id === uploadTargetId ? updatedDoc : d));
                } else {
                    alert("Failed to add document version.");
                }
            } else {
                // CASE B: New Document (in form) -> Upload and Prepare Form
                const result = await uploadTransactionDocumentFile(transactionId, file);
                if (result) {
                    setEditForm(prev => ({
                        ...prev,
                        storage_path: result.storage_path,
                        file_type: result.file_type,
                        file_name: result.file_name,
                        file_hash: result.file_hash,
                        name: prev.name || file.name
                    }));
                }
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("File upload failed. Please try again.");
        } finally {
            // Reset
            setUploadTargetId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleViewFile = async (doc: TransactionDocument) => {
        if (!doc.storage_path) return;
        try {
            const url = await getDocumentDownloadUrl(doc.storage_path);
            if (url) {
                window.open(url, '_blank');
            } else {
                alert("Could not retrieve secure link for this file.");
            }
        } catch (error) {
            console.error("Error viewing file:", error);
        }
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
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

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

            <div className="overflow-x-auto pb-40"> {/* pb-40 for dropdown space */}
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Comments</th>
                            <th className="px-6 py-4 text-center">Attachment</th>
                            <th className="px-6 py-4">Last Updated</th>
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
                                    <button
                                        onClick={() => triggerUpload(null)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${editForm.storage_path ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                                        title={editForm.file_name ? `Replace ${editForm.file_name}` : "Upload File"}
                                    >
                                        <i className={`fa-solid ${editForm.storage_path ? 'fa-check' : 'fa-paperclip'}`}></i>
                                    </button>
                                    {editForm.file_name && (
                                        <div className="text-[9px] text-slate-400 mt-1 max-w-[80px] truncate mx-auto">
                                            {editForm.file_name}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    Now
                                </td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    <button onClick={handleAdd} className="text-emerald-500 hover:text-emerald-600 font-bold text-xs uppercase">Save</button>
                                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-500 font-bold text-xs uppercase">Cancel</button>
                                </td>
                            </tr>
                        )}
                        {documents.length === 0 && !isAdding && (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center">
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
                                            {/* In edit mode, we don't allow file replace via this icon to keep it simple, use actions instead or just re-upload in normal view */}
                                            <i className="fa-solid fa-ban text-slate-200" title="File replacement available in main view"></i>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            --
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
                                            {doc.storage_path ? (
                                                <button
                                                    onClick={() => handleViewFile(doc)}
                                                    className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                                                    title={`View ${doc.file_name || 'Attachment'}`}
                                                >
                                                    <i className="fa-regular fa-file-pdf"></i>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => triggerUpload(doc.id)}
                                                    className="w-8 h-8 rounded-full bg-slate-50 text-slate-300 border border-dashed border-slate-300 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500 hover:border-indigo-300 transition-all"
                                                    title="Upload Document"
                                                >
                                                    <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                            {formatDate(doc.updated_at || doc.created_at)}
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end">
                                            <ActionsDropdown
                                                doc={doc}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onUploadVersion={(d) => triggerUpload(d.id)}
                                                onView={handleViewFile}
                                            />
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
