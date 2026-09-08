import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, ShieldCheck, UserCheck, Key, Lock, CheckCircle2, Building, Mail, LogOut } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onLogout,
}) => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'operator' | 'analyst'>(currentUser.role);
  const [customEmail, setCustomEmail] = useState(currentUser.email);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    // If email is pichet.kea@gmail.com, force admin role assignment
    const isAdminAccount = customEmail.trim().toLowerCase() === 'pichet.kea@gmail.com';
    const finalRole = isAdminAccount ? 'admin' : selectedRole;

    onUpdateUser({
      ...currentUser,
      email: customEmail.trim() || 'pichet.kea@gmail.com',
      name: isAdminAccount ? 'Pichet Kea' : customEmail.split('@')[0],
      role: finalRole,
    });
    onClose();
  };

  const handleSetAdminQuick = () => {
    setCustomEmail('pichet.kea@gmail.com');
    setSelectedRole('admin');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-600/40 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Google Account & RBAC Profile</h3>
              <p className="text-xs text-slate-400">Identity & Role-Based Access Control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Active Google Account Card */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center ring-2 ring-blue-400/50">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-100">{currentUser.name}</span>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Google Connected
                </span>
              </div>
              <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" />
                <span>{currentUser.email}</span>
              </div>
            </div>
          </div>

          {/* Admin Designation Notice */}
          <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Key className="w-3.5 h-3.5" />
              Designated Project Administrator
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              Account <strong>pichet.kea@gmail.com</strong> is configured as the primary <strong>Admin</strong> for this project with full cable configuration, AI audit, and threshold management privileges.
            </p>
          </div>

          {/* Role Selection & Permissions Matrix */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">Assigned Security Role</label>
            <div className="space-y-2">
              {/* Admin */}
              <div
                onClick={() => setSelectedRole('admin')}
                className={`p-2.5 rounded-lg border cursor-pointer transition ${
                  selectedRole === 'admin'
                    ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/40 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    Administrator (Admin)
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">Full Access</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Can modify & overwrite subsea cable circuits, update restricted zones, trigger AI analytics, and manage incident logs.
                </p>
              </div>

              {/* Operator */}
              <div
                onClick={() => setSelectedRole('operator')}
                className={`p-2.5 rounded-lg border cursor-pointer transition ${
                  selectedRole === 'operator'
                    ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/40 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    Maritime Watch Operator
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono">Operational</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Can monitor real-time map, inspect AIS traces, filter alarms, and export incident reports.
                </p>
              </div>

              {/* Analyst */}
              <div
                onClick={() => setSelectedRole('analyst')}
                className={`p-2.5 rounded-lg border cursor-pointer transition ${
                  selectedRole === 'analyst'
                    ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/40 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-200 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-purple-400" />
                    Statistical Data Analyst
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">Read & Analytics</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Access to statistical analytics, density breakdowns, and AI threat summarization.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            {onLogout && (
              <button
                id="btn-modal-logout"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-semibold text-xs transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleSaveProfile}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
