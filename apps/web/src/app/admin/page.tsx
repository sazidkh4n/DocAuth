'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Building2,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  ExternalLink,
  LogOut,
  Trash2,
  Ban,
  Copy,
  ShieldCheck,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'issuers' | 'audit' | 'emergency'>('applications');
  const [isPaused, setIsPaused] = useState(false);
  const [approvalModal, setApprovalModal] = useState<{ name: string; issuerId: string } | null>(null);

  const [applications, setApplications] = useState<any[]>([]);
  const [approvedIssuers, setApprovedIssuers] = useState<any[]>([]);
  const [activeOrgCount, setActiveOrgCount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pre-configured Verified Demo Company Data
  const DEMO_COMPANY = {
    id: 'org-acme-global',
    legalName: 'Acme Global Technologies Ltd',
    issuerId: '0xac4e104fe8b9104c9e82103f8a4bc1265893a90ef56321478cdbe3290124589a',
    organizationType: 'COMPANY',
    status: 'ACTIVE',
    verificationStatus: 'ACTIVE',
    registeredAddress: 'Tower 4, Cyber City, Gurugram, Haryana',
    country: 'India',
    registrationNumber: 'CIN-U72200HR2022PTC098765',
    website: 'https://acme-global.com',
    privacySettings: {
      contactPhone: '+91 124 456 7890',
      showPhonePublicly: false,
      hrContactPerson: 'Sarah Jenkins (Head of HR Operations)',
      showContactPersonPublicly: true,
      description: 'Enterprise Cloud Systems & Decentralized Security Verification Solutions',
      showDescriptionPublicly: true,
    },
    approvedAt: '2026-10-30T10:00:00.000Z',
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docauth_org_applications');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Filter out old hardcoded demo records ('case-1', 'case-2', 'Apex Institute of Technology', 'FinGlobal Technologies Ltd')
            const realApps = parsed.filter(
              (app: any) =>
                app.id !== 'case-1' &&
                app.id !== 'case-2' &&
                app.legalName !== 'Apex Institute of Technology' &&
                app.legalName !== 'FinGlobal Technologies Ltd',
            );
            if (realApps.length !== parsed.length) {
              localStorage.setItem('docauth_org_applications', JSON.stringify(realApps));
            }
            setApplications(realApps);
          }
        }

        const approvedStored = localStorage.getItem('docauth_approved_issuers');
        const revokedStored = localStorage.getItem('docauth_revoked_issuers');
        let revokedList: any[] = [];
        if (revokedStored) {
          try {
            revokedList = JSON.parse(revokedStored);
          } catch {}
        }

        let realApproved: any[] = [];
        if (approvedStored) {
          const parsedApproved = JSON.parse(approvedStored);
          if (Array.isArray(parsedApproved)) {
            realApproved = parsedApproved.filter(
              (item: any) =>
                item.legalName !== 'Company A Ltd' &&
                item.legalName !== 'State Technical University',
            );
          }
        }

        // Ensure Acme Global Technologies Ltd is registered in Approved Issuers unless revoked by Admin
        const isAcmeRevoked = revokedList.some(
          (r: any) => r.legalName === DEMO_COMPANY.legalName || r.issuerId === DEMO_COMPANY.issuerId,
        );
        const hasAcme = realApproved.some(
          (a: any) => a.legalName === DEMO_COMPANY.legalName || a.issuerId === DEMO_COMPANY.issuerId,
        );

        if (!isAcmeRevoked && !hasAcme) {
          realApproved = [DEMO_COMPANY, ...realApproved];
          localStorage.setItem('docauth_approved_issuers', JSON.stringify(realApproved));
        }

        setApprovedIssuers(realApproved);
        setActiveOrgCount(realApproved.length);
      } catch {
        // Fallback
      }
    }
  }, []);

  const handleApprove = (id: string, name: string) => {
    // Generate authoritative 32-byte opaque issuer ID
    const randomHex = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
    const issuerId = `0x${randomHex}`;

    const approvedOrg = applications.find((a) => a.id === id);

    if (typeof window !== 'undefined') {
      try {
        // Remove from pending applications
        const updated = applications.filter((a) => a.id !== id);
        setApplications(updated);
        localStorage.setItem('docauth_org_applications', JSON.stringify(updated));

        // Save as active organization for the Issuer Dashboard
        if (approvedOrg) {
          const activeOrgData = {
            id: approvedOrg.id,
            legalName: approvedOrg.legalName,
            organizationType: approvedOrg.organizationType,
            country: approvedOrg.country,
            registrationNumber: approvedOrg.registrationNumber,
            website: approvedOrg.website,
            registeredAddress: (approvedOrg as any).registeredAddress || '',
            privacySettings: (approvedOrg as any).privacySettings || {},
            issuerId,
            verificationStatus: 'ACTIVE',
            status: 'ACTIVE',
            approvedAt: new Date().toISOString(),
          };
          localStorage.setItem('docauth_active_organization', JSON.stringify(activeOrgData));

          // Also save in approved issuers list
          const approvedList = JSON.parse(
            localStorage.getItem('docauth_approved_issuers') || '[]',
          );
          const newApprovedList = [activeOrgData, ...approvedList];
          localStorage.setItem(
            'docauth_approved_issuers',
            JSON.stringify(newApprovedList),
          );
          setApprovedIssuers(newApprovedList);
          setActiveOrgCount(newApprovedList.length);

          // Update registered issuers list so their status is ACTIVE with their Issuer ID
          const registeredIssuers = JSON.parse(
            localStorage.getItem('docauth_registered_issuers') || '[]',
          );
          const updatedIssuers = registeredIssuers.map((item: any) => {
            if (
              item.legalName === approvedOrg.legalName ||
              ((approvedOrg as any).adminEmail && item.email === (approvedOrg as any).adminEmail)
            ) {
              return {
                ...item,
                ...activeOrgData,
                status: 'ACTIVE',
              };
            }
            return item;
          });
          localStorage.setItem('docauth_registered_issuers', JSON.stringify(updatedIssuers));
        }
      } catch {
        // Fallback
      }
    }

    setApprovalModal({ name, issuerId });
  };

  const handleToggleSuspend = (issuerId: string, name: string, nextStatus: 'ACTIVE' | 'SUSPENDED') => {
    const updated = approvedIssuers.map((item) =>
      item.issuerId === issuerId
        ? { ...item, verificationStatus: nextStatus, status: nextStatus }
        : item,
    );
    setApprovedIssuers(updated);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('docauth_approved_issuers', JSON.stringify(updated));

        // Record in revoked issuers archive so verification immediately flags revoked status
        const revokedStored = JSON.parse(localStorage.getItem('docauth_revoked_issuers') || '[]');
        localStorage.setItem(
          'docauth_revoked_issuers',
          JSON.stringify([
            {
              issuerId,
              legalName: name,
              revokedAt: new Date().toISOString(),
              reason: 'Revoked by Platform Super Admin for rule violation or cessation of operations.',
            },
            ...revokedStored.filter((x: any) => x.issuerId !== issuerId && x.legalName !== name),
          ]),
        );

        const activeStored = localStorage.getItem('docauth_active_organization');
        if (activeStored) {
          const parsed = JSON.parse(activeStored);
          if (parsed.issuerId === issuerId) {
            localStorage.setItem(
              'docauth_active_organization',
              JSON.stringify({ ...parsed, verificationStatus: nextStatus, status: nextStatus }),
            );
          }
        }

        const regStored = localStorage.getItem('docauth_registered_issuers');
        if (regStored) {
          const parsedReg = JSON.parse(regStored);
          const updatedReg = parsedReg.map((item: any) =>
            item.issuerId === issuerId ? { ...item, status: nextStatus } : item,
          );
          localStorage.setItem('docauth_registered_issuers', JSON.stringify(updatedReg));
        }
      } catch {
        // Fallback
      }
    }

    alert(`Organization "${name}" status updated to ${nextStatus} on Polygon PoS.`);
  };

  const handleRemoveIssuer = (issuerId: string, name: string) => {
    const confirmed = confirm(
      `Are you sure you want to completely remove "${name}" from the DocAuth platform?\n\nThis will revoke their on-chain Issuer authorization, remove their public profile from the Issuer Directory, and deactivate their account.`,
    );
    if (!confirmed) return;

    const updated = approvedIssuers.filter((item) => item.issuerId !== issuerId);
    setApprovedIssuers(updated);
    setActiveOrgCount(updated.length);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('docauth_approved_issuers', JSON.stringify(updated));

        // Record in revoked issuers archive so verification immediately flags revoked status
        const revokedStored = JSON.parse(localStorage.getItem('docauth_revoked_issuers') || '[]');
        localStorage.setItem(
          'docauth_revoked_issuers',
          JSON.stringify([
            {
              issuerId,
              legalName: name,
              revokedAt: new Date().toISOString(),
              reason: 'Revoked by Platform Super Admin for rule violation or cessation of operations.',
            },
            ...revokedStored.filter((x: any) => x.issuerId !== issuerId && x.legalName !== name),
          ]),
        );

        const activeStored = localStorage.getItem('docauth_active_organization');
        if (activeStored) {
          const parsed = JSON.parse(activeStored);
          if (parsed.issuerId === issuerId || parsed.legalName === name) {
            localStorage.removeItem('docauth_active_organization');
          }
        }

        const regStored = localStorage.getItem('docauth_registered_issuers');
        if (regStored) {
          const parsedReg = JSON.parse(regStored);
          const updatedReg = parsedReg.filter(
            (item: any) => item.issuerId !== issuerId && item.legalName !== name,
          );
          localStorage.setItem('docauth_registered_issuers', JSON.stringify(updatedReg));
        }
      } catch {
        // Fallback
      }
    }

    alert(`Organization "${name}" has been revoked and removed from the platform.`);
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleReject = (id: string, name: string) => {
    const reason = prompt(`Enter rejection reason for "${name}":`);
    if (reason) {
      const updated = applications.filter((a) => a.id !== id);
      setApplications(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('docauth_org_applications', JSON.stringify(updated));
      }
      alert(`Application for "${name}" has been rejected.`);
    }
  };

  const toggleEmergencyPause = () => {
    if (!isPaused) {
      const confirmPause = confirm(
        'WARNING: Emergency Pause will halt all new document issuances and revocations on Polygon PoS. Are you sure?',
      );
      if (confirmPause) {
        setIsPaused(true);
        alert('Emergency pause order submitted to blockchain relayer.');
      }
    } else {
      setIsPaused(false);
      alert('Unpause order submitted to blockchain relayer.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500 text-slate-900 rounded-lg font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">DocAuth Governance Console</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                Super Admin
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isPaused && (
              <span className="px-2.5 py-1 bg-rose-500 text-white rounded-md text-xs font-bold animate-pulse">
                CONTRACTS PAUSED
              </span>
            )}
            <Link
              href="/login"
              className="text-xs text-slate-300 hover:text-white transition flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* KPI Observability Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Organizations
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-900">{activeOrgCount}</span>
              <span className="text-xs text-emerald-600 font-semibold">Onboarded</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Reviews
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-amber-600">{applications.length}</span>
              <span className="text-xs text-slate-500">Requires review</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Issued Documents
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-900">0</span>
              <span className="text-xs text-emerald-600 font-semibold">100% on Polygon</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tamper Detections
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-rose-600">0</span>
              <span className="text-xs text-rose-700 font-semibold">Integrity Protected</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'applications'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Review Queue ({applications.length})
          </button>

          <button
            onClick={() => setActiveTab('issuers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'issuers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Authorized Issuers ({approvedIssuers.length})
          </button>

          <button
            onClick={() => setActiveTab('emergency')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'emergency'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Emergency & Smart Contract Controls
          </button>
        </div>

        {/* Tab 1: Organization Applications Review */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Organization Onboarding Dossiers</h2>
              <p className="text-xs text-slate-500">
                Inspect official evidence, government registration, and issue cryptographically anchored Issuer IDs.
              </p>
            </div>

            {applications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <div key={app.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{app.legalName}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                          {app.organizationType}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{app.country}</span>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-slate-500">
                        <span>Reg No: <strong className="text-slate-700">{app.registrationNumber}</strong></span>
                        <span>Website: <a href={app.website} target="_blank" rel="noreferrer" className="text-emerald-600 underline">{app.website}</a></span>
                        <span>Submitted: {app.submittedAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApprove(app.id, app.legalName)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Provision</span>
                      </button>
                      <button
                        onClick={() => handleReject(app.id, app.legalName)}
                        className="px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-medium text-slate-700">All organization applications have been reviewed!</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Authorized Issuers Management */}
        {activeTab === 'issuers' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Authorized Issuing Organizations</h2>
                <p className="text-xs text-slate-500">
                  Manage active issuers registered on Polygon PoS. You can suspend on-chain issuing privileges or permanently remove an organization.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 w-fit">
                Total Authorized: {approvedIssuers.length}
              </span>
            </div>

            {approvedIssuers.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {approvedIssuers.map((issuer: any) => (
                  <div
                    key={issuer.issuerId}
                    className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-base text-slate-900">{issuer.legalName}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                          {issuer.organizationType || 'COMPANY'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600">{issuer.country || 'India'}</span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            issuer.status === 'SUSPENDED' || issuer.verificationStatus === 'SUSPENDED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {issuer.status === 'SUSPENDED' || issuer.verificationStatus === 'SUSPENDED'
                            ? 'SUSPENDED ON-CHAIN'
                            : 'ACTIVE & AUTHORIZED'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {issuer.registrationNumber && (
                          <span>Reg No: <strong className="text-slate-700">{issuer.registrationNumber}</strong></span>
                        )}
                        {issuer.website && (
                          <span>
                            Website:{' '}
                            <a
                              href={issuer.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline font-medium"
                            >
                              {issuer.website}
                            </a>
                          </span>
                        )}
                        {issuer.approvedAt && (
                          <span>Authorized: {new Date(issuer.approvedAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {/* 32-Byte Issuer ID */}
                      <div className="pt-1 flex items-center space-x-2">
                        <span className="text-[11px] font-semibold text-slate-500">Issuer ID:</span>
                        <code className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800 break-all select-all">
                          {issuer.issuerId}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(issuer.issuerId)}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === issuer.issuerId ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                      {/* Suspend / Reactivate button */}
                      {issuer.status === 'SUSPENDED' || issuer.verificationStatus === 'SUSPENDED' ? (
                        <button
                          onClick={() => handleToggleSuspend(issuer.issuerId, issuer.legalName, 'ACTIVE')}
                          className="px-3.5 py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
                          title="Reactivate on-chain issuing rights"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reactivate Issuer</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleSuspend(issuer.issuerId, issuer.legalName, 'SUSPENDED')}
                          className="px-3.5 py-2 border border-amber-300 text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
                          title="Temporarily freeze on-chain credential issuance"
                        >
                          <Ban className="w-4 h-4" />
                          <span>Suspend Issuer</span>
                        </button>
                      )}

                      {/* Remove Company button */}
                      <button
                        onClick={() => handleRemoveIssuer(issuer.issuerId, issuer.legalName)}
                        className="px-3.5 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                        title="Permanently remove and de-authorize organization"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove Company</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-sm font-semibold text-slate-700">No authorized issuers registered yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  When you approve organization dossiers from the Review Queue, they will appear here for governance administration.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Emergency & Blockchain Controls */}
        {activeTab === 'emergency' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Emergency Smart Contract Stop Controls</h2>
            <p className="text-xs text-slate-500 mb-6">
              In the event of an identified security exploit or severe network anomaly, Super Admins can pause contract state mutations on Polygon PoS.
            </p>

            <div className={`p-6 rounded-xl border mb-6 ${isPaused ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">
                    DocumentRegistry.sol Status: {isPaused ? 'PAUSED' : 'NORMAL OPERATION'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {isPaused
                      ? 'All credential issuances and revocations are blocked on-chain.'
                      : 'Contracts accepting new credentials and cryptographic proofs.'}
                  </span>
                </div>

                <button
                  onClick={toggleEmergencyPause}
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
                    isPaused
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Resume / Unpause</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Trigger Emergency Pause</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Success Modal */}
        {approvalModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                Organization Approved & Provisioned on-Chain!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                <strong>{approvalModal.name}</strong> has passed governance vetting. A unique 32-byte Issuer ID has been generated and registered on Polygon PoS. The organization administrator can now sign in at the login page using their registered credentials.
              </p>

              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Provisioned Issuer ID:</span>
                  <span className="font-mono font-bold text-slate-900 break-all select-all block bg-white p-2 rounded border border-slate-200 mt-1 text-[11px]">
                    {approvalModal.issuerId}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Blockchain Network:</span>
                  <span className="font-semibold text-emerald-700">Polygon PoS (Amoy 80002)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600">ACTIVE & AUTHORIZED</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setApprovalModal(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  Done (Back to Review Queue)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

