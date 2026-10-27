import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Trash2, UserPlus } from 'lucide-react';
import { AdminPagination } from './AdminPagination';
import { useResponsivePageSize } from '../../hooks/useResponsivePageSize';

export const UserManagement: React.FC<{
    users: any[];
    onCreate: (user: { name: string; email: string; password: string; role: 'admin' }) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
    onEnable: (id: string) => Promise<void>;
    currentUserId: string;
}> = ({ users, onCreate, onDelete, onEnable, currentUserId }) => {
    const [newUser, setNewUser] = useState<{ name: string; email: string; password: string; role: 'admin' }>({ name: '', email: '', password: '', role: 'admin' });
    const [creating, setCreating] = useState(false);
    const [showNewUserPassword, setShowNewUserPassword] = useState(false);
    const [formError, setFormError] = useState('');
    const [userPendingDelete, setUserPendingDelete] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [page, setPage] = useState(1);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);
    const pageSize = useResponsivePageSize(10, 56, tableBodyRef);
    const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visibleUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(users.length / pageSize))));
    }, [users.length, pageSize]);

    const createUser = async (event: React.FormEvent) => {
        event.preventDefault();
        if (creating) return;
        setCreating(true);
        setFormError('');
        try {
            if (await onCreate(newUser)) {
                setNewUser({ name: '', email: '', password: '', role: 'admin' });
                setShowNewUserPassword(false);
            }
            else setFormError('Account was not created. Review the error notification.');
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : 'Account could not be created.');
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!userPendingDelete || deleting) return;
        setDeleting(true);
        setDeleteError('');
        try {
            if (await onDelete(userPendingDelete.id)) setUserPendingDelete(null);
            else setDeleteError('The account was not deleted. Please try again.');
        } catch (cause) {
            setDeleteError(cause instanceof Error ? cause.message : 'The account could not be deleted.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <form onSubmit={(event) => void createUser(event)} className="admin-content-card grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                <input required maxLength={120} placeholder="Full name" aria-label="New account name" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                <input required type="email" maxLength={254} placeholder="Email" aria-label="New account email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                <div className="relative flex h-11 min-w-0 items-center">
                    <input required type={showNewUserPassword ? 'text' : 'password'} minLength={8} maxLength={1024} autoComplete="new-password" placeholder="At least 8 characters" aria-label="New account password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} className="admin-user-password-input h-full w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 pr-10 text-xs text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                    <button type="button" onClick={() => setShowNewUserPassword((visible) => !visible)} aria-label={showNewUserPassword ? 'Hide initial password' : 'Show initial password'} title={showNewUserPassword ? 'Hide password' : 'Show password'} className="admin-password-eye-toggle admin-user-password-toggle relative z-10 -ml-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">
                        {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <button disabled={creating} className="admin-action-button inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-3 text-xs font-bold text-white hover:brightness-105 disabled:opacity-50">
                    <UserPlus size={15} />{creating ? 'Adding…' : 'Add Admin'}
                </button>
                {formError && <p role="alert" className="text-xs text-rose-300 sm:col-span-2 lg:col-span-4">{formError}</p>}
            </form>
            <div className="admin-users-table overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="p-3">Email</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody ref={tableBodyRef} className="admin-users-table-body text-slate-700">
                        {visibleUsers.map(user => (
                            <tr key={user.id}>
                                <td data-label="Email" className="p-3 break-all">{user.email}</td>
                                <td data-label="Role" className="p-3">
                                    <span className="current-user-role inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold">Admin</span>
                                </td>
                                <td data-label="Status" className="p-3">
                                    {user.disabled ? (
                                        <div className="inline-flex items-center gap-2">
                                            <span className="admin-user-status admin-user-status--disabled inline-flex min-h-10 items-center rounded-lg border px-2 py-1">Disabled</span>
                                            <button type="button" onClick={() => void onEnable(user.id)} className="admin-action-button min-h-10 rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Enable</button>
                                        </div>
                                    ) : (
                                        <span className="admin-user-status admin-user-status--protected inline-flex min-h-10 items-center rounded-lg border px-2 py-1">Protected</span>
                                    )}
                                </td>
                                <td data-label="Actions" className="p-3">
                                    {user.id === currentUserId ? (
                                        <span className="px-2 text-[10px] font-semibold text-slate-500">Current account</span>
                                    ) : (
                                        <button type="button" onClick={() => { setDeleteError(''); setUserPendingDelete(user); }} aria-label={`Delete ${user.email}`} title="Delete user" className="admin-user-delete inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 font-semibold">
                                            <Trash2 size={15} /> <span>Delete</span>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <AdminPagination page={currentPage} pageSize={pageSize} totalItems={users.length} onPageChange={setPage} />
            {userPendingDelete && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !deleting && setUserPendingDelete(null)}>
                    <section role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-description" className="my-auto max-h-[calc(100%-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-[#11141c] p-4 shadow-2xl sm:p-5">
                        <h3 id="delete-user-title" className="text-base font-bold text-white">Delete account?</h3>
                        <p id="delete-user-description" className="mt-2 break-all text-sm text-slate-300">This permanently deletes {userPendingDelete.email} and signs that account out of all devices.</p>
                        {deleteError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{deleteError}</p>}
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" disabled={deleting} onClick={() => setUserPendingDelete(null)} className="admin-modal-cancel min-h-10 rounded-lg px-4 text-xs font-semibold transition-colors disabled:opacity-50">Cancel</button>
                            <button type="button" disabled={deleting} onClick={() => void confirmDelete()} className="admin-modal-danger inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white transition-colors disabled:opacity-50">
                                {deleting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Trash2 size={14} />}
                                {deleting ? 'Deleting…' : 'Delete account'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};
