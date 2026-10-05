/**
 * VolunteersScreen — /volunteers
 *
 * Team & Member Management Screen.
 * Manage all portal users (Super Admins, Admins, Volunteers / Verification Agents).
 * Features:
 *  - Create login accounts & Firestore profiles directly in 1 click
 *  - Change user roles (Volunteer ↔ Admin ↔ Super Admin)
 *  - Activate / Suspend member accounts
 *  - Delete member accounts safely with confirmation
 *  - Filter by role & search by name, email, or ID
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Mail, Hash, ShieldCheck,
  Loader2, AlertCircle, UsersRound, X, Check,
  ToggleLeft, ToggleRight, Eye, EyeOff, KeyRound,
  Shield, UserCheck, Search, Copy, CheckCheck, Trash2,
  AlertTriangle, ChevronDown, RefreshCw, UserCog,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  getAllUsers,
  createPortalUser,
  updateVolunteerStatus,
  updateUserRole,
  deleteUserProfile,
} from '../../services/volunteerService';
import { getAssignmentsForUser } from '../../services/assignmentService';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_ROLE_STYLES,
  USER_STATUSES,
  USER_STATUS_STYLES,
} from '../../types/user';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const s = USER_ROLE_STYLES[role] ?? USER_ROLE_STYLES.VERIFICATION_AGENT;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {USER_ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusDot({ status }) {
  const s = USER_STATUS_STYLES[status] ?? USER_STATUS_STYLES.INACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === USER_STATUSES.ACTIVE ? 'bg-emerald-600' : 'bg-stone-400'}`} />
      {status === USER_STATUSES.ACTIVE ? 'Active' : 'Suspended'}
    </span>
  );
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ onAdded, onClose, creatorUid }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: USER_ROLES.VERIFICATION_AGENT,
    userId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const set = (f) => (e) => {
    setForm((p) => ({ ...p, [f]: e.target.value }));
    setError('');
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((p) => ({ ...p, password: pwd }));
    setShowPassword(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Full name is required.');
    if (!form.email.trim()) return setError('Email is required.');
    if (!form.password || form.password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }

    setSaving(true);
    try {
      await createPortalUser({
        name:      form.name.trim(),
        email:     form.email.trim(),
        password:  form.password,
        role:      form.role,
        userId:    form.userId.trim() || undefined,
        createdBy: creatorUid,
      });
      onAdded({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
    } catch (err) {
      console.error('[AddUser]', err);
      setError(err.message || 'Failed to create user account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-11 px-3.5 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all';
  const labelCls = 'block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-['Poppins',sans-serif] animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-100 bg-white shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-stone-900 leading-tight">Add New Team Member</h2>
            <p className="text-[12px] text-stone-500 mt-0.5">Creates login credentials and access permissions</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="add-user-form" onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className={labelCls}>Assign Role *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: USER_ROLES.VERIFICATION_AGENT,
                    label: 'Volunteer',
                    sub: 'QR & Verify',
                    icon: UserCheck,
                    activeStyle: 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20',
                  },
                  {
                    id: USER_ROLES.ADMIN,
                    label: 'Admin',
                    sub: 'Manage Events',
                    icon: ShieldCheck,
                    activeStyle: 'border-sky-500 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20',
                  },
                  {
                    id: USER_ROLES.SUPER_ADMIN,
                    label: 'Super Admin',
                    sub: 'Full Access',
                    icon: Shield,
                    activeStyle: 'border-violet-500 bg-violet-50/70 text-violet-900 ring-2 ring-violet-500/20',
                  },
                ].map((item) => {
                  const isSelected = form.role === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, role: item.id }))}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected ? item.activeStyle : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className="w-4 h-4" />
                        {isSelected && <span className="w-2 h-2 rounded-full bg-amber-600" />}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold leading-tight">{item.label}</div>
                        <div className="text-[10px] opacity-75">{item.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className={labelCls}>Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Navadeep Das"
                className={inputCls}
                autoFocus
                required
              />
            </div>

            {/* Email & ID Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="user@yatraseva.local"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Custom ID (Optional)</label>
                <input
                  type="text"
                  value={form.userId}
                  onChange={set('userId')}
                  placeholder={
                    form.role === USER_ROLES.SUPER_ADMIN
                      ? 'e.g. ADM-101'
                      : form.role === USER_ROLES.ADMIN
                        ? 'e.g. MGR-101'
                        : 'e.g. VOL-101'
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                  Initial Password *
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Generate Strong Password</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min 6 characters"
                  className={`${inputCls} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                The member will use this email and password to log in.
              </p>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 bg-stone-50 border-t border-stone-200/70">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl border border-stone-200 bg-white text-stone-600 text-[14px] font-medium hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-user-form"
              disabled={saving}
              className="flex-[2] h-12 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70 transition-all cursor-pointer shadow-md shadow-amber-900/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Member Account</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Change Role Modal ────────────────────────────────────────────────────────

function ChangeRoleModal({ user, currentUid, onRoleChanged, onClose }) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const isSelf = user.uid === currentUid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedRole === user.role) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateUserRole(user.uid, selectedRole);
      onRoleChanged(user.uid, selectedRole);
    } catch (err) {
      console.error('[ChangeRole]', err);
      setError(err.message || 'Failed to update role. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-['Poppins',sans-serif] animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col">
        
        <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <UserCog className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-stone-900 leading-tight">Change Member Role</h3>
              <p className="text-[12px] text-stone-500">{user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {isSelf && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Warning:</strong> You are changing your own role. Changing to a non-Super Admin role will restrict your management access.
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {[
              {
                id: USER_ROLES.VERIFICATION_AGENT,
                label: 'Volunteer (Verification Agent)',
                desc: 'Can scan devotee QR passes and verify attendance / goodie kits for assigned events.',
                icon: UserCheck,
                style: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20',
              },
              {
                id: USER_ROLES.ADMIN,
                label: 'Admin (Event Manager)',
                desc: 'Can create events, manage schedules, scan passes, and view event summaries.',
                icon: ShieldCheck,
                style: 'border-sky-500 bg-sky-50/70 text-sky-950 ring-2 ring-sky-500/20',
              },
              {
                id: USER_ROLES.SUPER_ADMIN,
                label: 'Super Admin',
                desc: 'Full unrestricted control over all Yatras, devotee datasets, and team members.',
                icon: Shield,
                style: 'border-violet-500 bg-violet-50/70 text-violet-950 ring-2 ring-violet-500/20',
              },
            ].map((r) => {
              const isSelected = selectedRole === r.id;
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected ? r.style : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold leading-snug">{r.label}</p>
                    <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                  {isSelected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl border border-stone-200 bg-white text-stone-600 text-[13px] font-medium hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || selectedRole === user.role}
              className="flex-1 h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Role'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

function DeleteUserModal({ user, onDeleted, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteUserProfile(user.uid);
      onDeleted(user.uid);
    } catch (err) {
      console.error('[DeleteUser]', err);
      setError('Failed to delete member profile. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-['Poppins',sans-serif] animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-red-200 overflow-hidden flex flex-col p-6 text-center">
        
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-7 h-7" />
        </div>

        <h3 className="text-[17px] font-bold text-stone-900 mb-1">Remove Team Member?</h3>
        <p className="text-[13px] text-stone-600 mb-2">
          Are you sure you want to remove <strong className="text-stone-900">{user.name}</strong> ({user.email})?
        </p>
        <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 mb-5">
          This will remove their portal profile and all event assignments.
        </p>

        {error && (
          <div className="mb-4 text-red-700 text-[12px] bg-red-50 p-2 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 h-11 rounded-2xl border border-stone-200 bg-white text-stone-600 text-[13px] font-medium hover:bg-stone-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Remove'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({
  user,
  currentUid,
  assignmentCount,
  onToggleStatus,
  onChangeRole,
  onDelete,
  toggling,
}) {
  const isActive = user.status === USER_STATUSES.ACTIVE;
  const [copied, setCopied] = useState(false);
  const isSelf = user.uid === currentUid;

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(user.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleIcon = user.role === USER_ROLES.SUPER_ADMIN
    ? Shield
    : user.role === USER_ROLES.ADMIN
      ? ShieldCheck
      : UserCheck;

  const Icon = roleIcon;

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-xs transition-shadow">
      {/* Top row: Name, ID, status toggle */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            user.role === USER_ROLES.SUPER_ADMIN
              ? 'bg-violet-100 text-violet-700'
              : user.role === USER_ROLES.ADMIN
                ? 'bg-sky-100 text-sky-700'
                : 'bg-amber-100 text-amber-700'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[14px] font-bold text-stone-900 leading-tight truncate">{user.name}</p>
              {isSelf && (
                <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded-md">
                  You
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">{user.userId || '—'}</p>
          </div>
        </div>

        {/* Status Toggle */}
        <button
          onClick={() => onToggleStatus(user.uid, isActive ? USER_STATUSES.SUSPENDED : USER_STATUSES.ACTIVE)}
          disabled={toggling === user.uid || isSelf}
          className={`shrink-0 cursor-pointer disabled:opacity-40 transition-colors ${
            isSelf ? 'cursor-not-allowed' : ''
          }`}
          aria-label={isActive ? 'Suspend account' : 'Activate account'}
          title={isSelf ? 'Cannot suspend your own active account' : isActive ? 'Active — Click to Suspend' : 'Suspended — Click to Activate'}
        >
          {toggling === user.uid
            ? <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            : isActive
              ? <ToggleRight className="w-6 h-6 text-emerald-600 hover:text-emerald-700" />
              : <ToggleLeft className="w-6 h-6 text-stone-400 hover:text-stone-600" />
          }
        </button>
      </div>

      {/* Meta row: Email & copy */}
      <div className="flex items-center justify-between gap-2 text-[12px] text-stone-500 bg-stone-50/80 px-3 py-1.5 rounded-xl">
        <div className="flex items-center gap-1.5 min-w-0">
          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span className="truncate font-mono text-[11px]">{user.email}</span>
        </div>
        <button
          onClick={handleCopyEmail}
          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer shrink-0"
          title="Copy email"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Badges + Actions bar */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <RoleBadge role={user.role} />
          <StatusDot status={user.status} />
          {user.role === USER_ROLES.VERIFICATION_AGENT && (
            <span className="text-[11px] text-stone-400 flex items-center gap-1 ml-1">
              <Hash className="w-3 h-3" />
              <span>{assignmentCount} event{assignmentCount !== 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        {/* Action buttons: Change Role & Delete */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => onChangeRole(user)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
            title="Change Role"
          >
            <UserCog className="w-3 h-3 text-amber-700" />
            <span>Change Role</span>
          </button>

          {!isSelf && (
            <button
              onClick={() => onDelete(user)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Delete Member"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function VolunteersScreen() {
  const navigate         = useNavigate();
  const { firebaseUser } = useAuth();

  const [users, setUsers]                 = useState([]);
  const [assignmentCounts, setCounts]     = useState({}); // uid → count
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [showAddModal, setAddModal]       = useState(false);
  const [roleUserModal, setRoleUserModal] = useState(null); // user object to edit role
  const [deleteUserModal, setDeleteModal] = useState(null); // user object to delete
  const [successMsg, setSuccess]          = useState('');
  const [toggling, setToggling]           = useState(null); // uid being toggled
  const [filterRole, setFilterRole]       = useState('ALL'); // 'ALL' | 'VERIFICATION_AGENT' | 'ADMIN' | 'SUPER_ADMIN'
  const [searchQuery, setSearchQuery]     = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllUsers();
      setUsers(data);
      setLoading(false); // Unblock UI immediately!

      // Load assignment counts in parallel in the background
      const counts = {};
      Promise.all(data.map(async (u) => {
        try {
          const assignments = await getAssignmentsForUser(u.uid);
          counts[u.uid] = assignments.length;
        } catch {
          counts[u.uid] = 0;
        }
      })).then(() => {
        setCounts(counts);
      });
    } catch (err) {
      console.error('[VolunteersScreen]', err);
      setError('Unable to load team members. Check your connection.');
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdded = (createdUser) => {
    setAddModal(false);
    setSuccess(`Account created for ${createdUser.name} (${USER_ROLE_LABELS[createdUser.role] || createdUser.role}).`);
    setTimeout(() => setSuccess(''), 5000);
    loadUsers();
  };

  const handleRoleChanged = (uid, newRole) => {
    setRoleUserModal(null);
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role: newRole } : u));
    setSuccess(`Member role updated to ${USER_ROLE_LABELS[newRole] || newRole}.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleDeleted = (deletedUid) => {
    setDeleteModal(null);
    setUsers((prev) => prev.filter((u) => u.uid !== deletedUid));
    setSuccess('Member account removed successfully.');
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleToggleStatus = async (uid, newStatus) => {
    setToggling(uid);
    try {
      await updateVolunteerStatus(uid, newStatus);
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error('[toggleStatus]', err);
    } finally {
      setToggling(null);
    }
  };

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = filterRole === 'ALL' || u.role === filterRole;
      if (!matchRole) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.userId && u.userId.toLowerCase().includes(q))
      );
    });
  }, [users, filterRole, searchQuery]);

  const roleCounts = useMemo(() => {
    return {
      ALL: users.length,
      VERIFICATION_AGENT: users.filter((u) => u.role === USER_ROLES.VERIFICATION_AGENT).length,
      ADMIN: users.filter((u) => u.role === USER_ROLES.ADMIN).length,
      SUPER_ADMIN: users.filter((u) => u.role === USER_ROLES.SUPER_ADMIN).length,
    };
  }, [users]);

  return (
    <>
      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onAdded={handleAdded}
          onClose={() => setAddModal(false)}
          creatorUid={firebaseUser?.uid}
        />
      )}

      {/* Change Role Modal */}
      {roleUserModal && (
        <ChangeRoleModal
          user={roleUserModal}
          currentUid={firebaseUser?.uid}
          onRoleChanged={handleRoleChanged}
          onClose={() => setRoleUserModal(null)}
        />
      )}

      {/* Delete User Modal */}
      {deleteUserModal && (
        <DeleteUserModal
          user={deleteUserModal}
          onDeleted={handleDeleted}
          onClose={() => setDeleteModal(null)}
        />
      )}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

        {/* Top Header */}
        <header className="shrink-0 pt-4 px-5 pb-3 flex items-center justify-between gap-3 bg-white/70 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-amber-800 active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold text-stone-900 leading-tight">Team &amp; Access Management</h1>
              <p className="text-[12px] text-stone-500">Manage all volunteers, administrators &amp; roles</p>
            </div>
          </div>

          <button
            onClick={() => setAddModal(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[12px] font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </header>

        {/* Search & Role Filter Row */}
        <div className="px-4 sm:px-6 pt-4 pb-2">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="w-full h-10 pl-10 pr-4 text-[13px] bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200/90 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter Dropdown Box */}
            <div className="relative shrink-0">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-10 pl-3 pr-8 text-[12px] sm:text-[13px] font-semibold bg-white hover:bg-stone-50 text-stone-800 rounded-xl border border-stone-200/90 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
              >
                <option value="ALL">All Roles ({roleCounts.ALL})</option>
                <option value={USER_ROLES.VERIFICATION_AGENT}>Volunteers ({roleCounts.VERIFICATION_AGENT})</option>
                <option value={USER_ROLES.ADMIN}>Admins ({roleCounts.ADMIN})</option>
                <option value={USER_ROLES.SUPER_ADMIN}>Super Admins ({roleCounts.SUPER_ADMIN})</option>
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-12">
          <div className="max-w-xl mx-auto space-y-3 pt-1">

            {successMsg && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />{successMsg}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
                  <span className="text-[12px] text-stone-400 font-medium">Loading team members…</span>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[13px] text-stone-600">{error}</p>
                <button
                  onClick={loadUsers}
                  className="px-5 h-9 rounded-xl bg-stone-900 text-white text-[12px] font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredUsers.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <UsersRound className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-stone-800">
                    {searchQuery ? 'No matching members found' : 'No members found'}
                  </p>
                  <p className="text-[12px] text-stone-500 mt-1 max-w-[240px]">
                    {searchQuery ? 'Try modifying your search or filter.' : 'Add your first volunteer or admin to get started.'}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-5 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />Add Member
                  </button>
                )}
              </div>
            )}

            {!loading && !error && filteredUsers.length > 0 && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    {filteredUsers.length} member{filteredUsers.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={loadUsers}
                    className="text-[11px] text-stone-400 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>
                {filteredUsers.map((u) => (
                  <UserCard
                    key={u.uid}
                    user={u}
                    currentUid={firebaseUser?.uid}
                    assignmentCount={assignmentCounts[u.uid] ?? 0}
                    onToggleStatus={handleToggleStatus}
                    onChangeRole={(user) => setRoleUserModal(user)}
                    onDelete={(user) => setDeleteModal(user)}
                    toggling={toggling}
                  />
                ))}
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
