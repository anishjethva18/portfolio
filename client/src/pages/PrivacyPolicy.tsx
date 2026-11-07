import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { refreshPublishedRouteSeo } from '../utils/seoMetadata';
import { privacyPolicyIntroduction, privacyPolicyLastUpdated, privacyPolicySections } from './privacyPolicyContent';
import './PrivacyPolicy.css';

export default function PrivacyPolicy() {
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    let active = true;
    void refreshPublishedRouteSeo('/privacy-policy', window.location.href)
      .then((name) => { if (active) setSiteName(name); })
      .catch((error: unknown) => console.error('[PrivacyPolicy] Public page metadata could not be loaded.', error));
    return () => { active = false; };
  }, []);

  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <nav aria-label="Main navigation" className="privacy-header-inner">
          <a className="privacy-brand" href="/app-info">{siteName}</a>
          <span className="privacy-portfolio-label">Portfolio</span>
        </nav>
      </header>

      <article className="privacy-container">
        <a href="/app-info" className="privacy-back"><ArrowLeft aria-hidden="true" size={16} /> Back to Portfolio Information</a>
        <header className="privacy-title-block">
          <p className="privacy-eyebrow"><ShieldCheck aria-hidden="true" size={15} /> Privacy and transparency</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-updated">Last updated: {privacyPolicyLastUpdated}</p>
        </header>

        <p className="privacy-introduction">{privacyPolicyIntroduction}</p>

        <nav aria-label="Table of contents" className="privacy-toc">
          <h2>On this page</h2>
          <ol>
            {privacyPolicySections.map((section, index) => (
              <li key={section.heading}>
                <a href={`#privacy-section-${index + 1}`}>{section.heading.replace(/^\d+\.\s*/, '')}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="privacy-policy-content">
          {privacyPolicySections.map((section, index) => (
            <section id={`privacy-section-${index + 1}`} key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {'contactEmail' in section && (
                <p><a href={`mailto:${section.contactEmail}`}>{section.contactEmail}</a></p>
              )}
            </section>
          ))}
        </div>
      </article>
      <footer className="privacy-footer">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <a href="/app-info">Portfolio Information</a>
      </footer>
    </main>
  );
}
