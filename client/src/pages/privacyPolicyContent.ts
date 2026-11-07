export const privacyPolicyLastUpdated = 'November 4, 2026';
export const privacyPolicyIntroduction = 'This policy describes information processed when you visit Anish Jethva’s portfolio or submit its contact form. It reflects the application’s current implementation; some operational details, such as provider log retention, depend on the services configured for deployment.';

export const privacyPolicySections = [
  {
    heading: '1. Information submitted through the contact form',
    paragraphs: [
      'The contact form asks for your name, email address, subject, and message. When a submission is processed, the server also records its timestamp, request IP address, user-agent string, and delivery status. The message and contact details are stored in the application and may be available to the site administrator in the protected contact-management area.',
    ],
  },
  {
    heading: '2. How information is used',
    paragraphs: [
      'Contact information and message content are used to review and respond to your inquiry, maintain its delivery or reply status, and operate the contact service. The portfolio also records usage analytics events, such as page visits and app interactions. The analytics implementation uses a random visitor identifier stored in your browser’s local storage and records event and page details on the server. Analytics event records do not store the request IP address or user-agent.',
    ],
  },
  {
    heading: '3. Email processing and Gmail OAuth',
    paragraphs: [
      'Contact submissions are sent using the email provider configured by the site operator. The code supports Gmail API with OAuth 2.0, Gmail SMTP, other SMTP services, and Resend; the active production provider is determined by private deployment configuration and cannot be identified from this public page. If Gmail API OAuth is configured, the server uses its OAuth credentials to send the inquiry email and check the configured account profile. The application code sends email and does not search or retrieve inbox message bodies. Your submitted name, email address, subject, and message are included in the inquiry email and handled by the configured email provider under its own terms and policies.',
    ],
  },
  {
    heading: '4. Retention and deletion',
    paragraphs: [
      'Contact records are held in application memory and, when the database is connected, persisted in the contact database. The repository does not define an automatic expiry period for these records; authorized administration can delete individual contact records. Analytics records can be cleared through the administrator’s analytics reset function and are not configured with a fixed automatic expiry in the application. Hosting, database, and email-provider logs or backups may have separate retention periods that are not configured by this application.',
    ],
  },
  {
    heading: '5. Security',
    paragraphs: [
      'The contact endpoint validates submissions and applies rate limiting. Contact history and administration actions require administrator authentication. Email credentials are read from server-side configuration rather than the public frontend. These application controls do not establish the security or retention settings of the hosting, database, or email providers, and no internet transmission or storage method can be guaranteed completely secure.',
    ],
  },
  {
    heading: '6. Service providers and external links',
    paragraphs: [
      'The portfolio is designed to use Netlify for frontend hosting, Render for the backend, and MongoDB for persistent application records. Contact email may be processed by the provider selected in the server configuration, including Google Gmail, Resend, or an SMTP provider. Actual deployment configuration and each provider’s own practices are outside this repository. This website also links to external sites, which have their own privacy policies.',
    ],
  },
  {
    heading: '7. Browser storage',
    paragraphs: [
      'The analytics visitor identifier is stored in local storage, not a cookie. The browser may also store data needed by the portfolio application. You can remove local storage through your browser settings; doing so may reset locally saved application data.',
    ],
  },
  {
    heading: '8. Privacy requests',
    paragraphs: [
      'You may contact the site owner to ask about or request deletion of information you submitted through the contact form. Any request is subject to applicable legal obligations and information retained in provider systems or backups.',
    ],
  },
  {
    heading: '9. Contact',
    paragraphs: [
      'For privacy questions or requests, contact:',
    ],
    contactEmail: 'anish.jethva2006@gmail.com',
  },
] as const;
