import React, { lazy, Suspense } from 'react';
import type { AppId } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AdminLoginScreen } from './AdminLoginScreen';

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

const AdminPanelFallback: React.FC = () => {
  const { user, login } = useAuth();

  if (user?.role === 'admin') {
    return <div aria-hidden="true" className="h-full w-full bg-slate-950" />;
  }

  return (
    <AdminLoginScreen
      onLogin={async (email, password) => {
        const result = await login(email, password, false);
        if (result.success) {
          sessionStorage.removeItem('win11_admin_panel_locked');
        }
        return result;
      }}
    />
  );
};

interface RenderAppProps {
  appId: AppId;
  args?: Record<string, any>;
  windowId?: string;
}

export const RenderApp: React.FC<RenderAppProps> = ({ appId, args, windowId }) => {
  return (
    <Suspense fallback={null}>
      {(() => {
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
        <Suspense fallback={<AdminPanelFallback />}>
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
      })()}
    </Suspense>
  );
};
