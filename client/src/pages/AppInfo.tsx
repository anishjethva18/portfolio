import { useEffect, useState, type MouseEvent } from 'react';
import {
  BriefcaseBusiness,
  Calculator,
  Camera,
  Cpu,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Gamepad2,
  Globe2,
  Image,
  Mail,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { AppId } from '../types';
import { getPublicApplicationRoutes, type ApplicationRoute } from '../utils/applicationRoutes';
import { refreshPublishedRouteSeo } from '../utils/seoMetadata';

interface PublicProfile {
  name?: string;
  email?: string;
  socials?: Record<string, string>;
  socialLinks?: Array<{ label: string; url: string }>;
  siteSettings?: { disabledApps?: AppId[] };
}

const applicationIcons = {
  about: UserRound,
  calculator: Calculator,
  camera: Camera,
  contact: Mail,
  explorer: FolderOpen,
  photos: Image,
  minesweeper: Gamepad2,
  notepad: NotebookPen,
  projects: BriefcaseBusiness,
  recycle: Trash2,
  resume: FileCheck2,
  snake: Sparkles,
  settings: Settings2,
  taskmanager: Cpu,
  terminal: Terminal,
  admin: ShieldCheck,
  browser: Globe2,
} satisfies Record<AppId, typeof UserRound>;

const safeContactHref = (value: string): string | null => {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const loadProfile = async (): Promise<PublicProfile> => {
  const response = await fetch('/api/profile', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Published profile could not be loaded (HTTP ${response.status}).`);
  return response.json() as Promise<PublicProfile>;
};

const getDisabledApps = (profile: PublicProfile): AppId[] => (
  Array.isArray(profile.siteSettings?.disabledApps)
    ? profile.siteSettings.disabledApps.filter((appId): appId is AppId => typeof appId === 'string')
    : []
);

export default function AppInfo() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [siteName, setSiteName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [navigationError, setNavigationError] = useState('');

  useEffect(() => {
    let active = true;
    void refreshPublishedRouteSeo('/app-info', window.location.href)
      .then((name) => { if (active) setSiteName(name); })
      .catch((error: unknown) => console.error('[AppInfo] Public page metadata could not be loaded.', error));
    void loadProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((error: unknown) => {
        console.error('[AppInfo] Published profile could not be loaded.', error);
        if (active) setProfileError(error instanceof Error ? error.message : 'Published profile could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  const availableApps = profile ? getPublicApplicationRoutes(getDisabledApps(profile)) : [];
  const displaySiteName = siteName || profile?.name || '';
  const contacts = [
    profile?.email ? { label: 'Email', href: safeContactHref(`mailto:${profile.email}`) } : null,
    ...Object.entries(profile?.socials || {}).map(([label, url]) => ({ label, href: safeContactHref(url) })),
    ...(profile?.socialLinks || []).map(({ label, url }) => ({ label, href: safeContactHref(url) })),
  ].filter((contact): contact is { label: string; href: string } => Boolean(contact?.href));

  const handleApplicationNavigation = async (
    event: MouseEvent<HTMLAnchorElement>,
    route: ApplicationRoute,
  ) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setNavigationError('');
    try {
      const currentProfile = await loadProfile();
      setProfile(currentProfile);
      if (!getPublicApplicationRoutes(getDisabledApps(currentProfile)).some((item) => item.appId === route.appId)) {
        setNavigationError(`${route.app.name} is no longer published for visitors.`);
        return;
      }
      window.location.assign(route.path);
    } catch (error) {
      console.error('[AppInfo] Application availability could not be rechecked.', error);
      setNavigationError('Application availability could not be verified. Please try again.');
    }
  };

  return (
    <main className="h-dvh overflow-y-auto overscroll-y-contain bg-[#f7f9fc] font-sans text-slate-900 selection:bg-sky-200">
      <header className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/app-info" className="rounded-sm font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700">{displaySiteName}</a>
          <span className="text-sm font-medium text-slate-500">Portfolio</span>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
        <section className="max-w-3xl pb-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700 sm:text-sm">{displaySiteName} · Portfolio</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl md:text-6xl">An Interactive Windows 11 Portfolio</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            A desktop-inspired website for exploring Anish Jethva’s professional portfolio. Visitors can open the published applications from the desktop or application links below to view portfolio information and tools.
          </p>
        </section>

        <section aria-labelledby="website-heading" className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-16 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Globe2 aria-hidden="true" className="h-5 w-5" /></span>
            <div>
              <h2 id="website-heading" className="text-xl font-semibold tracking-tight text-slate-950">About this website</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">A public portfolio presented through an interactive desktop interface.</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Website owner</dt><dd className="mt-2 font-semibold text-slate-900">Anish Jethva</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Website type</dt><dd className="mt-2 font-semibold text-slate-900">Personal portfolio</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purpose</dt><dd className="mt-2 font-medium leading-6 text-slate-800">Showcase professional background, projects, skills, and contact information</dd></div>
          </dl>
        </section>

        <section aria-labelledby="applications-heading" className="mt-14 sm:mt-16">
          <h2 id="applications-heading" className="text-2xl font-semibold tracking-tight text-slate-950">Portfolio applications</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            These applications provide focused ways to explore the portfolio. This list includes only public applications currently published in the Admin Panel.
          </p>
          {(profileError || navigationError) && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{navigationError || `Published applications are temporarily unavailable. ${profileError}`}</p>}
          <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4">
            {availableApps.map((route) => (
              <li key={route.appId}>
                <a
                  href={route.path}
                  onClick={(event) => void handleApplicationNavigation(event, route)}
                  aria-label={`Open ${route.app.name}`}
                  className="group flex h-full min-h-28 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:min-h-32 sm:p-5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 transition-colors group-hover:bg-white">
                    {(() => {
                      const Icon = applicationIcons[route.appId];
                      return <Icon aria-hidden="true" className="h-5 w-5" />;
                    })()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{route.app.name}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">{route.description}</span>
                  </span>
                  <ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-sky-700" />
                </a>
              </li>
            ))}
            {profile && availableApps.length === 0 && <li className="text-sm text-slate-600">No public portfolio applications are currently published.</li>}
          </ul>
        </section>

        <section aria-labelledby="support-heading" className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-16 sm:p-8">
          <h2 id="support-heading" className="text-xl font-semibold tracking-tight text-slate-950">Privacy and support</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">For questions about the website or its content, contact the developer using a published contact method.</p>
          {contacts.length > 0 ? (
            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {contacts.map((contact, index) => (
                <li key={`${contact.label}-${contact.href}-${index}`}>
                  <a href={contact.href} target={contact.href.startsWith('mailto:') ? undefined : '_blank'} rel={contact.href.startsWith('mailto:') ? undefined : 'noreferrer'} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                    {contact.label}<ExternalLink aria-hidden="true" className="ml-2 h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          ) : !profileError ? <p className="mt-4 text-sm text-slate-600">Published developer contact information is currently unavailable.</p> : null}
          <a href="/privacy-policy" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Privacy Policy
          </a>
        </section>
      </div>
      <footer className="border-t border-slate-200 bg-white/70 px-5 py-5 text-center text-sm text-slate-500 sm:px-8">
        © {new Date().getFullYear()} {displaySiteName}
      </footer>
    </main>
  );
}
