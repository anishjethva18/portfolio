import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { PORTFOLIO_USER, EXPERIENCES, EDUCATION } from '../../data/portfolioData';
import { MapPin, Mail, Github, Linkedin, Instagram, Twitter, Download, Briefcase, GraduationCap, Award, Sparkles, ExternalLink, CheckCircle2, Zap } from 'lucide-react';
import { SkillBrandIcon } from '../common/SkillBrandIcon';
import { SkillCategoryIcon } from '../common/SkillCategoryIcon';

interface AboutProfileData {
  name: string;
  title: string;
  location: string;
  avatar: string;
  bio: string;
  email: string;
  phone?: string;
  website?: string;
  github: string;
  linkedin: string;
  instagram: string;
  twitter?: string;
  tagline?: string;
  hiringStatus?: 'hidden' | 'available' | 'open' | 'unavailable';
  contactVisibility?: Record<string, boolean>;
  socialLinks?: Array<{ label: string; url: string; visible?: boolean }>;
  skills: Array<{
    id?: string;
    title: string;
    icon?: string;
    iconImage?: string;
    active?: boolean;
    order?: number;
    skills: Array<{ id?: string; name: string; iconIdentifier?: string; active?: boolean; order?: number }>;
  }>;
  goals: string[];
  publicRepos: number;
  totalStars: number;
  followers: number;
  experiences: Array<{
    role: string;
    company: string;
    location: string;
    period: string;
    description: string[];
    skills: string[];
    visible?: boolean;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    period: string;
    details: string;
    achievements?: string[];
    visible?: boolean;
  }>;
  certifications: Array<{ title: string; provider?: string; description?: string; image?: string; artLabel?: string; artDetail?: string; link?: string; visible?: boolean }>;
  capabilities: Array<{ title: string; icon?: string; description?: string; visible?: boolean }>;
}

const DEFAULT_PROFILE_DATA: AboutProfileData = {
  name: PORTFOLIO_USER.name,
  title: PORTFOLIO_USER.title,
  location: PORTFOLIO_USER.location,
  avatar: PORTFOLIO_USER.avatar,
  bio: PORTFOLIO_USER.bio,
  email: PORTFOLIO_USER.email,
  github: PORTFOLIO_USER.github,
  linkedin: PORTFOLIO_USER.linkedin,
  instagram: PORTFOLIO_USER.instagram || '',
  phone: '',
  website: '',
  twitter: '',
  tagline: '',
  skills: [],
  goals: [...PORTFOLIO_USER.goals],
  publicRepos: 24,
  totalStars: 142,
  followers: 88,
  experiences: EXPERIENCES.map((e) => ({
    role: e.role,
    company: e.company,
    location: e.location,
    period: e.period,
    description: [...e.description],
    skills: [...e.skills],
  })),
  education: EDUCATION.map((edu) => ({
    degree: edu.degree,
    institution: edu.institution,
    period: edu.period,
    details: edu.details,
  })),
  certifications: [],
  capabilities: [],
};

export const AboutApp: React.FC = () => {
  const { openApp } = useOS();
  const [profile, setProfile] = useState<AboutProfileData>(DEFAULT_PROFILE_DATA);
  const [activeSkillCategory, setActiveSkillCategory] = useState('all');
  const visibleSkillCategories = profile.skills
    .filter((category) => category.active !== false)
    .map((category) => ({ ...category, skills: (category.skills || []).filter((skill) => skill.active !== false && skill.name?.trim()) }))
    .filter((category) => category.skills.length > 0)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const displayedSkillCategories = activeSkillCategory === 'all'
    ? visibleSkillCategories
    : visibleSkillCategories.filter((category) => category.title === activeSkillCategory);

  useEffect(() => {
    const syncProfile = (data: any) => {
      const profileData = data?.profile || data;
      if (!profileData?.name) return;
      const socials = profileData.socials || profileData;
      const visibility = profileData.contactVisibility || {};
      setProfile((prev) => ({
          ...prev,
          name: profileData.name ?? prev.name,
          title: profileData.title ?? prev.title,
          location: visibility.location === false ? '' : profileData.location ?? prev.location,
          avatar: profileData.avatar ?? prev.avatar,
          bio: profileData.bio ?? prev.bio,
          email: visibility.email === false ? '' : profileData.email ?? prev.email,
          phone: visibility.phone === false ? '' : profileData.phone ?? prev.phone,
          website: profileData.website ?? prev.website,
          tagline: profileData.tagline ?? prev.tagline,
          github: visibility.github === false ? '' : socials.github ?? prev.github,
          linkedin: visibility.linkedin === false ? '' : socials.linkedin ?? prev.linkedin,
          instagram: visibility.instagram === false ? '' : socials.instagram ?? prev.instagram,
          twitter: visibility.twitter === false ? '' : socials.twitter ?? profileData.twitter ?? prev.twitter,
          hiringStatus: profileData.hiringStatus ?? prev.hiringStatus,
          contactVisibility: visibility,
          socialLinks: Array.isArray(profileData.socialLinks) ? profileData.socialLinks.filter((link: any) => link?.visible !== false) : prev.socialLinks,
          goals: Array.isArray(profileData.goals) ? profileData.goals : prev.goals,
          experiences: Array.isArray(data?.experiences) ? data.experiences.filter((item: any) => item?.visible !== false) : prev.experiences,
          education: Array.isArray(data?.education) ? data.education.filter((item: any) => item?.visible !== false) : prev.education,
          certifications: Array.isArray(data?.certifications) ? data.certifications.filter((item: any) => item?.visible !== false) : prev.certifications,
          capabilities: Array.isArray(data?.capabilities) ? data.capabilities.filter((item: any) => item?.visible !== false) : prev.capabilities,
          skills: Array.isArray(data?.skills) ? data.skills : prev.skills,
          publicRepos: profileData.stats?.publicRepos ?? prev.publicRepos,
          totalStars: profileData.stats?.totalStars ?? prev.totalStars,
          followers: profileData.stats?.followers ?? prev.followers,
        }));
    };
    const refreshProfile = () => fetch('/api/profile')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Profile details could not be loaded (HTTP ${response.status}).`);
        syncProfile(await response.json());
      })
      .catch((error: unknown) => console.error('[AboutApp] Profile details could not be loaded.', error));
    void refreshProfile();
    const handlePublished = (event: Event) => syncProfile((event as CustomEvent).detail);
    window.addEventListener('portfolio-content-published', handlePublished);
    window.addEventListener('portfolio-data-updated', refreshProfile);
    return () => {
      window.removeEventListener('portfolio-content-published', handlePublished);
      window.removeEventListener('portfolio-data-updated', refreshProfile);
    };
  }, []);

  useEffect(() => {
    const syncPublishedProfile = (event: Event) => {
      const profileUpdate = (event as CustomEvent<{ avatar?: string; name?: string; bio?: string }>).detail;
      if (!profileUpdate) return;
      setProfile((current) => ({ ...current, ...profileUpdate }));
    };
    window.addEventListener('win11_profile_updated', syncPublishedProfile);
    return () => window.removeEventListener('win11_profile_updated', syncPublishedProfile);
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto space-y-6 select-text font-sans">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 sm:p-9 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src={profile.avatar || '/avatar.png'} alt={profile.name} onError={(e) => { e.currentTarget.src = '/avatar.png'; }} className="h-24 w-24 self-center rounded-2xl object-cover ring-4 ring-white/20 shadow-xl sm:self-auto" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{profile.name}</h1>
            <p className="mt-1 text-sm font-semibold text-blue-200">{profile.title}</p>
            {profile.location && <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-300 sm:justify-start"><MapPin className="h-3.5 w-3.5" />{profile.location}</p>}
            {profile.hiringStatus && profile.hiringStatus !== 'hidden' && <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${profile.hiringStatus === 'available' ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200' : profile.hiringStatus === 'open' ? 'border-amber-300/30 bg-amber-400/10 text-amber-200' : 'border-slate-300/30 bg-slate-400/10 text-slate-200'}`}><span className={`h-2 w-2 rounded-full ${profile.hiringStatus === 'unavailable' ? 'bg-slate-400' : `motion-safe:animate-pulse ${profile.hiringStatus === 'available' ? 'bg-emerald-400' : 'bg-amber-400'}`}`} />{profile.hiringStatus === 'available' ? 'Available for work' : profile.hiringStatus === 'open' ? 'Open to opportunities' : 'Not available'}</span>}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {profile.github && <a href={profile.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"><Github className="h-3.5 w-3.5" />GitHub</a>}
              {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>}
              {profile.instagram && <a href={profile.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"><Instagram className="h-3.5 w-3.5" />Instagram</a>}
              {profile.twitter && <a href={profile.twitter} target="_blank" rel="noreferrer" aria-label="X / Twitter" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"><Twitter className="h-3.5 w-3.5" />X / Twitter</a>}
              {(profile.socialLinks || []).filter((link) => link.visible !== false && link.label?.trim() && /^https?:\/\//i.test(link.url || '')).map((link, index) => <a key={`${link.label}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"><ExternalLink className="h-3.5 w-3.5" />{link.label}</a>)}
              <button onClick={() => openApp('resume')} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-sky-50"><Download className="h-3.5 w-3.5" />View resume</button>
              <button onClick={() => openApp('contact')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-400"><Mail className="h-3.5 w-3.5" />Contact</button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 dark:border-white/10 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Sparkles className="h-4 w-4 text-blue-500"/>Biography</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{profile.bio}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Award className="h-4 w-4 text-indigo-500"/>Focus areas</h2>
          <ul className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-300">{profile.goals.map((goal, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"/>{goal}</li>)}</ul>
        </section>
      </div>

      {profile.education.length > 0 && <section className="space-y-3 pb-10">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><GraduationCap className="h-5 w-5 text-indigo-500"/>Education</h2>
        {profile.education.map((item, index) => <article key={`${item.degree}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.degree}</h3><p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">{item.institution}</p><p className="mt-2 text-xs text-slate-500">{item.details}</p>{item.achievements?.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-300">{item.achievements.map((achievement, i) => <li key={i}>{achievement}</li>)}</ul> : null}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{item.period}</span></article>)}
      </section>}

      {visibleSkillCategories.length > 0 && <section className="space-y-4 pb-2">
        <header>
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white"><Zap className="h-5 w-5 text-sky-500" />Skills &amp; Toolkit</h2>
          <p className="mt-1 pl-7 text-xs text-slate-500 dark:text-slate-400">Technologies I work with</p>
        </header>
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter skill categories">
          <button type="button" onClick={() => setActiveSkillCategory('all')} aria-pressed={activeSkillCategory === 'all'} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${activeSkillCategory === 'all' ? 'bg-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>All</button>
          {visibleSkillCategories.map((category, index) => <button key={category.id || `${category.title}-${index}`} type="button" onClick={() => setActiveSkillCategory(category.title)} aria-pressed={activeSkillCategory === category.title} className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${activeSkillCategory === category.title ? 'bg-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            {category.iconImage ? <img src={category.iconImage} alt="" className="h-4 w-4 object-contain" /> : <SkillCategoryIcon name={category.icon} category={category.title} className="h-4 w-4" />}
            {category.title}
          </button>)}
        </nav>
        <div className="grid gap-4 lg:grid-cols-2">
          {displayedSkillCategories.map((category, index) => <article key={category.id || `${category.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-4">
            <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900 dark:border-white/10 dark:text-white">
              {category.iconImage ? <img src={category.iconImage} alt="" className="h-5 w-5 object-contain" /> : <SkillCategoryIcon name={category.icon} category={category.title} className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              {category.title}
            </h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {category.skills.map((skill, skillIndex) => <li key={skill.id || `${skill.name}-${skillIndex}`} title={skill.name} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 px-1.5 py-2 text-center shadow-sm dark:border-white/5 dark:bg-slate-950/40">
                <SkillBrandIcon name={skill.name} iconIdentifier={skill.iconIdentifier} className="h-8 w-8" />
                <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-800 dark:text-slate-200">{skill.name}</span>
              </li>)}
            </ul>
          </article>)}
        </div>
      </section>}

      {profile.capabilities.length > 0 && <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Sparkles className="h-5 w-5 text-sky-500" />Capabilities</h2>
        <div className="grid gap-3 sm:grid-cols-2">{profile.capabilities.map((capability, index) => <article key={`${capability.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900"><h3 className="text-sm font-bold text-slate-900 dark:text-white">{capability.title}</h3>{capability.description && <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{capability.description}</p>}</article>)}</div>
      </section>}

      {profile.experiences.length > 0 && <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Briefcase className="h-5 w-5 text-blue-500"/>Experience</h2>
        {profile.experiences.map((exp, index) => <article key={`${exp.role}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{exp.role}</h3><p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{exp.period}</span></div><ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{exp.description.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul><div className="mt-3 flex flex-wrap gap-1.5">{exp.skills.map((skill: string, i: number) => <span key={i} className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300">{skill}</span>)}</div></article>)}
      </section>}

      {profile.certifications.some((item) => item.visible !== false) && <section className="space-y-3 pb-10">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Award className="h-5 w-5 text-amber-500"/>Certifications</h2>
        <div className="grid gap-3 sm:grid-cols-2">{profile.certifications.filter((item) => item.visible !== false).map((item, index) => <article key={`${item.title}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          {item.image && <img src={item.image} alt={`${item.title} certificate`} className="aspect-[16/9] w-full bg-slate-100 object-contain dark:bg-slate-800" />}
          <div className="p-4"><h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>{item.provider && <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">{item.provider}</p>}{item.description && <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>}{(item.artLabel || item.artDetail) && <p className="mt-2 text-[10px] text-slate-500">{[item.artLabel, item.artDetail].filter(Boolean).join(' · ')}</p>}{item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">View certificate<ExternalLink className="h-3.5 w-3.5" /></a>}</div>
        </article>)}</div>
      </section>}
    </div>
  );
};
