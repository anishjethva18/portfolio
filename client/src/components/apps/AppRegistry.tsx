import React, { lazy, Suspense } from 'react';
import type { AppId } from '../../types';
import { AlertCircle, RefreshCw } from 'lucide-react';

const AboutApp = lazy(() => import('./AboutApp').then((module) => ({ default: module.AboutApp })));
const ProjectsApp = lazy(() => import('./ProjectsApp').then((module) => ({ default: module.ProjectsApp })));
const ResumeViewerApp = lazy(() => import('./ResumeViewerApp').then((module) => ({ default: module.ResumeViewerApp })));
const ContactApp = lazy(() => import('./ContactApp').then((module) => ({ default: module.ContactApp })));
const FileExplorerApp = lazy(() => import('./FileExplorerApp').then((module) => ({ default: module.FileExplorerApp })));
const TerminalApp = lazy(() => import('./TerminalApp').then((module) => ({ default: module.TerminalApp })));
const BrowserApp = lazy(() => import('./BrowserApp').then((module) => ({ default: module.BrowserApp })));
const NotepadApp = lazy(() => import('./NotepadApp').then((module) => ({ default: module.NotepadApp })));
const SettingsApp = lazy(() => import('./SettingsApp').then((module) => ({ default: module.SettingsApp })));
const TaskManagerApp = lazy(() => import('./TaskManagerApp').then((module) => ({ default: module.TaskManagerApp })));
const RecycleBinApp = lazy(() => import('./RecycleBinApp').then((module) => ({ default: module.RecycleBinApp })));
const MinesweeperApp = lazy(() => import('./MinesweeperApp').then((module) => ({ default: module.MinesweeperApp })));
const SnakeApp = lazy(() => import('./SnakeApp').then((module) => ({ default: module.SnakeApp })));
const CalculatorApp = lazy(() => import('./CalculatorApp').then((module) => ({ default: module.CalculatorApp })));
const CameraApp = lazy(() => import('./CameraApp').then((module) => ({ default: module.CameraApp })));
const MediaApp = lazy(() => import('./MediaApp').then((module) => ({ default: module.MediaApp })));
const AdminPanelApp = lazy(() => import('./AdminPanelApp').then((module) => ({ default: module.AdminPanelApp })));

const AppLoadingFallback: React.FC<{ appId: AppId }> = ({ appId }) => (
  <div
    aria-busy="true"
    aria-label={`${appId} app`}
    className="h-full min-h-32 w-full bg-slate-50/80 dark:bg-slate-950/40"
  />
);

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; appId: AppId },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[AppRegistry] ${this.props.appId} failed to render.`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="flex h-full min-h-32 flex-col items-center justify-center gap-3 bg-slate-50 p-5 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-200">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold">This app could not be opened.</p>
          <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload portfolio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const renderAppContent = (appId: AppId, args?: Record<string, any>, windowId?: string) => {
  switch (appId) {
    case 'about':
      return <AboutApp />;
    case 'projects':
      return <ProjectsApp />;
    case 'resume':
      return <ResumeViewerApp initialResumeUrl={args?.initialResumeUrl} />;
    case 'contact':
      return (
        <ContactApp
          initialMessage={args?.message}
          initialSubject={args?.subject}
          initialAttachments={args?.attachments || (args?.file ? [args.file] : undefined)}
        />
      );
    case 'explorer':
      return <FileExplorerApp windowId={windowId} initialPath={args?.initialPath || args?.path} />;
    case 'terminal':
      return <TerminalApp />;
    case 'browser':
      return <BrowserApp initialUrl={args?.initialUrl} windowId={windowId} />;
    case 'notepad':
      return <NotepadApp filePath={args?.filePath} fileContent={args?.fileContent} windowId={windowId} />;
    case 'settings':
      return <SettingsApp initialTab={args?.tab} />;
    case 'taskmanager':
      return <TaskManagerApp />;
    case 'recycle':
      return <RecycleBinApp />;
    case 'minesweeper':
      return <MinesweeperApp />;
    case 'snake':
      return <SnakeApp />;
    case 'calculator':
      return <CalculatorApp />;
    case 'camera':
      return <CameraApp />;
    case 'photos':
      return (
        <MediaApp
          filePath={args?.filePath}
          initialMediaId={args?.initialMediaId || args?.mediaId}
          initialMediaUrl={args?.initialMediaUrl}
          initialMediaName={args?.initialMediaName}
          initialMediaExtension={args?.initialMediaExtension}
        />
      );
    case 'admin':
      return (
        <Suspense fallback={<AppLoadingFallback appId="admin" />}>
          <AdminPanelApp windowId={windowId} />
        </Suspense>
      );
    default:
      return (
        <div className="p-8 text-center text-xs text-slate-400">
          Application {appId} is under development.
        </div>
      );
  }
};

interface RenderAppProps {
  appId: AppId;
  args?: Record<string, any>;
  windowId?: string;
}

export const RenderApp: React.FC<RenderAppProps> = ({ appId, args, windowId }) => (
  <AppErrorBoundary appId={appId}>
    <Suspense fallback={<AppLoadingFallback appId={appId} />}>
      {renderAppContent(appId, args, windowId)}
    </Suspense>
  </AppErrorBoundary>
);
