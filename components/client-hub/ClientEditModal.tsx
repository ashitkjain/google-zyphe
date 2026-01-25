import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';

interface ClientEditModalProps {
    client: any; // Using any to handle both UserProfile and Lead variations
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<Lead>) => Promise<void>;
}

type Tab = 'Identity' | 'Lead Info' | 'Criteria' | 'Property' | 'Financials' | 'Transaction';

const ClientEditModal: React.FC<ClientEditModalProps> = ({ client, isOpen, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<Tab>('Identity');
    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    const safeDateToInput = (date: any): string => {
        if (!date) return '';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    useEffect(() => {
        if (client) {
            setFormData({
                // Identity
                firstName: client.firstName || '',
                lastName: client.lastName || '',
                legalName: client.legalName || '',
                email: client.email || client.primaryContact?.email || '',
                phone: client.phone || client.primaryContact?.phone || '',
                preferredMethod: client.primaryContact?.preferredMethod || 'Email',
                mobile: client.primaryContact?.mobile || '', // Assuming extra fields might exist
                clientPhotoUrl: client.clientPhotoUrl || client.primaryContact?.clientPhotoUrl || '',
                homeAddress: client.primaryContact?.homeAddress || '',

                // Lead Info
                leadType: client.leadType || 'Buyer',
                source: client.source || client.leadInfo?.origin || '', // Handle legacy/flat fields
                referralType: client.leadInfo?.referralType || '',
                campaign: client.leadInfo?.campaign || '',
                customerMessage: client.leadInfo?.customerMessage || '',
                engagementScore: client.engagementScore || 'Cold',
                status: client.status || 'New',
                funnelStage: client.funnelStage || 'Leads',

                // Criteria (Buyer)
                motivation: client.motivation || '',
                targetTimeline: client.targetTimeline || '',
                personaProfile: client.personaProfile || '',
                mustHaves: client.searchCriteria?.mustHaves || '',
                locations: client.searchCriteria?.locations || '',
                dealBreakers: client.searchCriteria?.dealBreakers || '',
                leaseEndDate: safeDateToInput(client.leaseEndDate),

                // Property (Seller)
                sellWhen: client.sellWhen || '',
                listingAddress: client.listingStatus?.property?.address || client.propertyAddress || '',
                estimatedValue: client.listingStatus?.estimatedValue || '',
                occupancyStatus: client.listingStatus?.occupancyStatus || '',

                // Financials
                budgetMax: client.financialVitals?.budgetMax || client.maxPrice || '',
                budgetRange: client.leadInfo?.budgetRange || '',
                preApprovalStatus: client.financialVitals?.preApprovalStatus || false,
                isAllCash: client.financialVitals?.isAllCash || false,

                // Transaction
                inquiryAddress: client.leadInfo?.inquiryProperty?.address || client.subjectProperty || '',
                offerPrice: client.activeOffer?.price || '',
                inspectionEnd: safeDateToInput(client.criticalDates?.inspectionEnd),
                appraisalDate: safeDateToInput(client.criticalDates?.appraisalDate),
                closingDate: safeDateToInput(client.criticalDates?.closingDate),
                closingHealth: client.closingHealth || 'On Track'
            });
        }
    }, [client, isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates: any = {
                // Top Level
                firstName: formData.firstName,
                lastName: formData.lastName,
                legalName: formData.legalName,
                email: formData.email,
                phone: formData.phone,
                leadType: formData.leadType,
                engagementScore: formData.engagementScore,
                status: formData.status,
                funnelStage: formData.funnelStage,
                motivation: formData.motivation,
                targetTimeline: formData.targetTimeline,
                personaProfile: formData.personaProfile,
                source: formData.source,
                sellWhen: formData.sellWhen,
                closingHealth: formData.closingHealth,

                // Nested Objects Construction
                primaryContact: {
                    ...(client.primaryContact || {}),
                    email: formData.email,
                    phone: formData.phone,
                    preferredMethod: formData.preferredMethod,
                    clientPhotoUrl: formData.clientPhotoUrl,
                    homeAddress: formData.homeAddress
                },

                leadInfo: {
                    ...(client.leadInfo || {}),
                    referralType: formData.referralType,
                    campaign: formData.campaign,
                    customerMessage: formData.customerMessage,
                    budgetRange: formData.budgetRange,
                    inquiryProperty: {
                        ...(client.leadInfo?.inquiryProperty || {}),
                        address: formData.inquiryAddress
                    }
                },

                searchCriteria: {
                    ...(client.searchCriteria || {}),
                    mustHaves: formData.mustHaves,
                    locations: formData.locations,
                    dealBreakers: formData.dealBreakers
                },

                financialVitals: {
                    ...(client.financialVitals || {}),
                    budgetMax: Number(formData.budgetMax) || 0,
                    preApprovalStatus: formData.preApprovalStatus,
                    isAllCash: formData.isAllCash
                },

                listingStatus: {
                    ...(client.listingStatus || {}),
                    estimatedValue: Number(formData.estimatedValue) || 0,
                    occupancyStatus: formData.occupancyStatus,
                    property: {
                        ...(client.listingStatus?.property || {}),
                        address: formData.listingAddress
                    }
                },

                criticalDates: {
                    ...(client.criticalDates || {}),
                    inspectionEnd: formData.inspectionEnd ? new Date(formData.inspectionEnd) : null,
                    appraisalDate: formData.appraisalDate ? new Date(formData.appraisalDate) : null,
                    closingDate: formData.closingDate ? new Date(formData.closingDate) : null
                }
            };

            // Legacy/Flat mappings if needed for backward compatibility
            if (formData.inquiryAddress) updates.subjectProperty = formData.inquiryAddress;
            if (formData.listingAddress) updates.propertyAddress = formData.listingAddress;
            if (formData.leaseEndDate) updates.leaseEndDate = new Date(formData.leaseEndDate);
            if (formData.clientPhotoUrl) updates.clientPhotoUrl = formData.clientPhotoUrl;

            // Handle Active Offer Updates (Simple)
            if (formData.offerPrice) {
                updates.activeOffer = {
                    ...(client.activeOffer || {}),
                    price: Number(formData.offerPrice)
                };
            }

            await onSave(updates);
            onClose();
        } catch (error) {
            console.error("Failed to save client updates:", error);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const renderInput = (label: string, field: string, type: string = 'text', placeholder: string = '', options: string[] = []) => (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            {type === 'select' ? (
                <div className="relative">
                    <select
                        value={formData[field]}
                        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                    >
                        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                </div>
            ) : type === 'textarea' ? (
                <textarea
                    rows={3}
                    value={formData[field]}
                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    placeholder={placeholder}
                />
            ) : type === 'checkbox' ? (
                <div className="flex items-center gap-3 py-2">
                    <button
                        onClick={() => setFormData({ ...formData, [field]: !formData[field] })}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${formData[field] ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}
                    >
                        {formData[field] && <i className="fa-solid fa-check text-xs"></i>}
                    </button>
                    <span className="text-sm font-semibold text-slate-700">{placeholder || label}</span>
                </div>
            ) : (
                <input
                    type={type}
                    value={formData[field]}
                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder={placeholder}
                />
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 h-[80vh] flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                            <i className="fa-solid fa-user-pen text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Edit Client Details</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Update information for {client.firstName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-8 pt-4 border-b border-slate-100 flex gap-6 overflow-x-auto flex-shrink-0">
                    {(['Identity', 'Lead Info', 'Criteria', 'Property', 'Financials', 'Transaction'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 border-b-2 font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Form Content (Scrollable) */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        {activeTab === 'Identity' && (
                            <>
                                {renderInput('First Name', 'firstName')}
                                {renderInput('Last Name', 'lastName')}
                                {renderInput('Legal Name', 'legalName')}
                                {renderInput('Email Address', 'email', 'email')}
                                {renderInput('Phone Number', 'phone', 'tel')}
                                {renderInput('Preferred Method', 'preferredMethod', 'select', '', ['Email', 'Phone', 'SMS', 'WhatsApp'])}
                                {renderInput('Client Photo URL', 'clientPhotoUrl', 'url')}
                                {renderInput('Home Address', 'homeAddress')}
                            </>
                        )}

                        {activeTab === 'Lead Info' && (
                            <>
                                {renderInput('Lead Type', 'leadType', 'select', '', ['Buyer', 'Seller'])}
                                {renderInput('Status', 'status', 'select', '', [
                                    'New', 'Qualified', 'Attempted to Contact',
                                    'Meeting Fixed', 'Broker Agreement Sent',
                                    'Broker Agreement Signed', 'Actively Searching', 'Showing',
                                    'Offer', 'In Contract'
                                ])}
                                {renderInput('Funnel Stage', 'funnelStage', 'select', '', ['Leads', 'Nurture', 'Active Search', 'Offer', 'Closing', 'Closed', 'Archived'])}
                                {renderInput('Engagement Score', 'engagementScore', 'select', '', ['Cold', 'Warm', 'Hot', 'Stale'])}
                                {renderInput('Source / Origin', 'source')}
                                {renderInput('Referral Type', 'referralType')}
                                {renderInput('Campaign Name', 'campaign')}
                                <div className="col-span-2">
                                    {renderInput('Customer Message', 'customerMessage', 'textarea')}
                                </div>
                            </>
                        )}

                        {activeTab === 'Criteria' && (
                            <>
                                {renderInput('Target Timeline', 'targetTimeline', 'select', '', ['ASAP', '1-3 Months', '3-6 Months', '6-12 Months', 'Just Browsing'])}
                                {renderInput('Persona Profile', 'personaProfile', 'select', '', ['First-Time', 'Investor', 'Past Client', 'Relocation'])}
                                {renderInput('Target Locations', 'locations')}
                                {renderInput('Lease End Date', 'leaseEndDate', 'date')}
                                <div className="col-span-2">
                                    {renderInput('Primary Motivation', 'motivation', 'textarea')}
                                </div>
                                <div className="col-span-2">
                                    {renderInput('Must Haves / Requirements', 'mustHaves', 'textarea')}
                                </div>
                                <div className="col-span-2">
                                    {renderInput('Deal Breakers', 'dealBreakers', 'textarea')}
                                </div>
                            </>
                        )}

                        {activeTab === 'Property' && (
                            <>
                                <div className="col-span-2 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs font-medium mb-4">
                                    <i className="fa-solid fa-circle-info mr-2"></i>
                                    These fields are primarily for Listing/Seller clients.
                                </div>
                                {renderInput('Listing Address', 'listingAddress')}
                                {renderInput('Sell timeframe', 'sellWhen')}
                                {renderInput('Estimated Value ($)', 'estimatedValue', 'number')}
                                {renderInput('Occupancy Status', 'occupancyStatus')}
                            </>
                        )}

                        {activeTab === 'Financials' && (
                            <>
                                {renderInput('Max Budget ($)', 'budgetMax', 'number')}
                                {renderInput('Budget Range', 'budgetRange')}
                                {renderInput('Pre-Approved?', 'preApprovalStatus', 'checkbox')}
                                {renderInput('All Cash Buyer?', 'isAllCash', 'checkbox')}
                            </>
                        )}

                        {activeTab === 'Transaction' && (
                            <>
                                {renderInput('Inquiry / Subject Property', 'inquiryAddress')}
                                {renderInput('Active Offer Price ($)', 'offerPrice', 'number')}
                                {renderInput('Inspection Deadline', 'inspectionEnd', 'date')}
                                {renderInput('Appraisal Deadline', 'appraisalDate', 'date')}
                                {renderInput('Closing Date', 'closingDate', 'date')}
                                {renderInput('Closing Health', 'closingHealth', 'select', '', ['On Track', 'Delayed', 'At Risk', 'Rescinded'])}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-all"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <i className="fa-solid fa-circle-notch animate-spin"></i> Saving...
                            </>
                        ) : (
                            <>Save Changes</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientEditModal;
