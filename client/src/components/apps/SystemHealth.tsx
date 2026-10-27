import React from 'react';
import { Activity, Database, HardDrive, Server, RefreshCw, Mail } from 'lucide-react';
import { formatAdminDateTime } from '../../utils/dateTime';

interface SystemHealthData {
    status: string;
    service: string;
    version: string;
    environment: string;
    platform: string;
    nodeVersion: string;
    uptimeSeconds: number;
    timestamp: string;
    database: { status: string; latencyMs: number | null; host: string; name: string; readyState: number };
    storage: { status: string; userCapturesExist: boolean; adminArchiveExist: boolean };
    email?: { status: string };
    memory: { rssMB: number; heapUsedMB: number; heapTotalMB: number };
}

const uptimeLabel = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
};

export const SystemHealth: React.FC<{
    health: SystemHealthData | null;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}> = ({ health, onRefresh, isRefreshing = false }) => {
    if (!health) return <div role="status" className="text-slate-500">Loading system health data…</div>;

    const services = [
        {
            name: 'API Server',
            status: health.status === 'healthy' ? 'Healthy' : 'Degraded',
            detail: `${health.nodeVersion} · ${health.environment}`,
            icon: Server,
            healthy: health.status === 'healthy',
        },
        {
            name: 'MongoDB',
            status: health.database.status,
            detail: health.database.latencyMs === null ? 'Ping unavailable' : `${health.database.latencyMs} ms ping`,
            icon: Database,
            healthy: health.database.status === 'connected' && health.database.latencyMs !== null,
        },
        {
            name: 'Storage',
            status: health.storage.status,
            detail: `Captures ${health.storage.userCapturesExist ? 'available' : 'missing'} · archive ${health.storage.adminArchiveExist ? 'available' : 'missing'}`,
            icon: HardDrive,
            healthy: health.storage.status === 'healthy',
        },
        {
            name: 'Email delivery',
            status: health.email?.status === 'configured' ? 'Configured' : 'Not configured',
            detail: health.email?.status === 'configured' ? 'An email provider is configured; verify delivery with the test email action.' : 'Configure Resend, Google OAuth, or SMTP to send message replies.',
            icon: Mail,
            healthy: health.email?.status === 'configured',
        },
    ];

    const details = [
        ['Service', health.service],
        ['Platform', health.platform],
        ['Runtime', health.nodeVersion],
        ['Environment', health.environment],
        ['Process uptime', uptimeLabel(health.uptimeSeconds)],
        ['Memory (RSS)', `${health.memory.rssMB} MB`],
        ['Heap usage', `${health.memory.heapUsedMB} / ${health.memory.heapTotalMB} MB`],
        ['Last updated', formatAdminDateTime(health.timestamp)],
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#11141c] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-300">Live Polling Active (Every 15s)</span>
                    <span className="text-[11px] text-slate-500">· Last sync: {formatAdminDateTime(health.timestamp)}</span>
                </div>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh Now
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {services.map((service) => (
                    <article key={service.name} className="min-w-0 rounded-2xl border border-slate-800 bg-[#11141c] p-5">
                        <div className="flex items-start gap-4">
                            <service.icon className={service.healthy ? 'shrink-0 text-emerald-400' : 'shrink-0 text-rose-400'} size={22} />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{service.name}</p>
                                <p className={`mt-1 text-sm font-bold ${service.healthy ? 'text-emerald-300' : 'text-rose-300'}`}>{service.status}</p>
                                <p className="mt-2 break-words text-[11px] text-slate-400">{service.detail}</p>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            <section className="rounded-2xl border border-slate-800 bg-[#11141c] p-5 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                    <Activity className="text-sky-400" size={20} />
                    <div>
                        <h3 className="text-base font-bold text-white">Live process details</h3>
                        <p className="text-[11px] text-slate-500">Collected from the current server process and MongoDB health check.</p>
                    </div>
                </div>
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
