import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../common/AppIcon';
import { Cpu, Activity, X,  } from 'lucide-react';

export const TaskManagerApp: React.FC = () => {
  const { processes, endProcess, windows } = useOS();
  const [activeTab, setActiveTab] = useState<'processes' | 'performance'>('processes');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  // Live Simulated Performance Telemetry History
  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 18, 15, 22, 19, 28, 24, 16, 20, 25]);
  const [memHistory, setMemHistory] = useState<number[]>([42, 43, 42, 45, 44, 46, 45, 47, 46, 48]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuHistory((prev) => [...prev.slice(1), Math.floor(Math.random() * 25) + 10]);
      setMemHistory((prev) => [...prev.slice(1), Math.floor(Math.random() * 6) + 43]);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const totalCpu = Math.round(cpuHistory[cpuHistory.length - 1] || 18);
  const totalMem = Math.round(memHistory[memHistory.length - 1] || 45);

  const selectedProcess = processes.find((p) => p.pid === selectedPid);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
      {/* Top Header Tabs */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === 'processes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('processes')}
          >
            Processes ({processes.length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === 'performance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
        </div>

        {activeTab === 'processes' && selectedProcess && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
            onClick={() => {
              endProcess(selectedProcess.appId);
              setSelectedPid(null);
            }}
          >
            <X className="w-3.5 h-3.5" /> End Task
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-auto p-4 select-text">
        {activeTab === 'processes' ? (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold text-slate-400 border-b border-slate-200 dark:border-white/10 select-none">
              <span className="col-span-5">Name</span>
              <span className="col-span-2">PID</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-1 text-right">CPU</span>
              <span className="col-span-2 text-right">Memory</span>
            </div>

            {processes.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No active application processes running.
              </div>
            ) : (
              processes.map((proc) => (
                <div
                  key={proc.pid}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-xl text-xs items-center cursor-pointer transition-colors ${
                    selectedPid === proc.pid
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/40'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                  }`}
                  onClick={() => setSelectedPid(proc.pid)}
                >
                  <span className="col-span-5 flex items-center gap-2 truncate">
                    <AppIcon name="Cpu" className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">{proc.name}</span>
                  </span>
                  <span className="col-span-2 font-mono text-[11px] text-slate-500">{proc.pid}</span>
                  <span className="col-span-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${proc.status === 'Running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                      {proc.status}
                    </span>
                  </span>
                  <span className="col-span-1 text-right font-mono text-[11px] font-semibold text-blue-500">
                    {proc.cpu}%
                  </span>
                  <span className="col-span-2 text-right font-mono text-[11px] text-slate-500">
                    {proc.memory} MB
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Performance Telemetry Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Metric Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-xs">CPU Usage</span>
                </div>
                <span className="text-lg font-mono font-bold text-blue-500">{totalCpu}%</span>
              </div>

              {/* Sparkline Graph */}
              <div className="h-28 flex items-end gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/5">
                {cpuHistory.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-blue-500 rounded-t transition-all duration-300"
                    style={{ height: `${val}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Memory RAM Metric Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-500" />
                  <span className="font-bold text-xs">Memory (RAM)</span>
                </div>
                <span className="text-lg font-mono font-bold text-purple-500">{totalMem}%</span>
              </div>

              {/* Sparkline Graph */}
              <div className="h-28 flex items-end gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/5">
                {memHistory.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-purple-500 rounded-t transition-all duration-300"
                    style={{ height: `${val}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
