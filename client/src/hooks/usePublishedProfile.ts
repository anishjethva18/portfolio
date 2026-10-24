import { useEffect, useState } from 'react';
import { PORTFOLIO_USER } from '../data/portfolioData';

export interface PublishedProfile {
  name: string;
  title: string;
  tagline: string;
  bio: string;
  avatar: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  github: string;
  linkedin: string;
  instagram: string;
  twitter: string;
  hiringStatus: 'hidden' | 'available' | 'open' | 'unavailable';
  socialLinks: Array<{ label: string; url: string; visible?: boolean }>;
}

interface PublishedSiteSettings {
  portfolioVersion?: string;
}

type ProfilePayload = Partial<PublishedProfile> & {
  contactVisibility?: Record<string, boolean>;
  socials?: Partial<Pick<PublishedProfile, 'github' | 'linkedin' | 'instagram' | 'twitter'>>;
};

interface ProfileResponse extends ProfilePayload {
  profile?: ProfilePayload;
  content?: { profile?: ProfilePayload };
  siteSettings?: PublishedSiteSettings;
}

const DEFAULT_PROFILE: PublishedProfile = {
  ...PORTFOLIO_USER,
  phone: '',
  twitter: '',
  hiringStatus: 'hidden',
  socialLinks: [],
};

export const usePublishedProfile = () => {
  const [profile, setProfile] = useState<PublishedProfile>(DEFAULT_PROFILE);
  const [siteSettings, setSiteSettings] = useState<PublishedSiteSettings>({});

  useEffect(() => {
    let active = true;
    const syncProfile = (data: ProfileResponse) => {
      const publishedProfile = data?.profile || data?.content?.profile || data;
      if (publishedProfile && typeof publishedProfile === 'object' && active) {
        const visibility = publishedProfile.contactVisibility || {};
        const socials = publishedProfile.socials || publishedProfile;
        setProfile((current) => ({
          ...current,
          ...publishedProfile,
          email: visibility.email === false ? '' : publishedProfile.email ?? current.email,
          phone: visibility.phone === false ? '' : publishedProfile.phone ?? current.phone,
          location: visibility.location === false ? '' : publishedProfile.location ?? current.location,
          github: visibility.github === false ? '' : socials.github ?? current.github,
          linkedin: visibility.linkedin === false ? '' : socials.linkedin ?? current.linkedin,
          instagram: visibility.instagram === false ? '' : socials.instagram ?? current.instagram,
          twitter: visibility.twitter === false ? '' : socials.twitter ?? current.twitter,
          socialLinks: Array.isArray(publishedProfile.socialLinks)
            ? publishedProfile.socialLinks.filter((link) => link?.visible !== false)
            : current.socialLinks,
        }));
      }
      if (data?.siteSettings && active) setSiteSettings(data.siteSettings);
    };
    const refreshProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error(`Published profile could not be loaded (HTTP ${response.status}).`);
        syncProfile(await response.json() as ProfileResponse);
      } catch (error) {
        console.error('[usePublishedProfile] Published profile could not be loaded.', error);
      }
    };
    const handlePublished = (event: Event) => syncProfile((event as CustomEvent<ProfileResponse>).detail);

    void refreshProfile();
    window.addEventListener('portfolio-content-published', handlePublished);
    window.addEventListener('portfolio-data-updated', refreshProfile);
    return () => {
      active = false;
      window.removeEventListener('portfolio-content-published', handlePublished);
      window.removeEventListener('portfolio-data-updated', refreshProfile);
    };
  }, []);

  return { profile, siteSettings };
};
