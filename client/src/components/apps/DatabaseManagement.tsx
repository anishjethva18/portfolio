import React from 'react';
import { Database, HardDrive, Layers, Shield, Table } from 'lucide-react';

export const DatabaseManagement: React.FC<{ metrics: any; health: any }> = ({ metrics, health }) => {
    if (!metrics || !health) {
        return <div role="status" className="text-slate-500">Loading database status…</div>;
    }

    const stats = [
        { label: 'Users', count: metrics.usersCount, icon: Shield, color: 'text-blue-400' },
        { label: 'Projects', count: metrics.projectsCount, icon: Layers, color: 'text-emerald-400' },
        { label: 'Contacts', count: metrics.contactsCount, icon: Table, color: 'text-amber-400' },
        { label: 'Captures', count: metrics.totalCaptures, icon: HardDrive, color: 'text-purple-400' },
    ];
    const database = health.database;
    const details = [
        ['Connection state', database.status],
        ['MongoDB host', database.host],
        ['Database name', database.name],
        ['Driver state', String(database.readyState)],
        ['Latest ping', database.latencyMs === null ? 'Unavailable' : `${database.latencyMs} ms`],
    ];

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-[#11141c] p-5 sm:p-7">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Database className="shrink-0 text-emerald-400" size={28} />
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-white">MongoDB</h3>
                            <p className="break-all text-xs text-slate-500">{database.name} · {database.host}</p>
                        </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${database.status === 'connected' && database.latencyMs !== null ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                        {database.status}
                    </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map((stat) => (
                        <article key={stat.label} className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
                            <stat.icon className={`${stat.color} mb-3`} size={20} />
                            <p className="text-xl font-black text-white">{stat.count}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-[#11141c] p-5 sm:p-7">
                <h3 className="mb-3 text-base font-bold text-white">Connection details</h3>
                <dl className="grid gap-x-8 sm:grid-cols-2">
                    {details.map(([label, value]) => (
                        <div key={label} className="flex min-w-0 justify-between gap-4 border-b border-slate-800/70 py-3 last:border-0">
                            <dt className="shrink-0 text-xs text-slate-400">{label}</dt>
                            <dd className="min-w-0 break-all text-right text-xs font-semibold text-slate-200">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>
        </div>
    );
};
