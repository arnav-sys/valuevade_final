/* JSON-LD structured data for Course schema */
export const courseJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: 'Valuevade — AI-personalised Equity Research & Finance Career Program',
  description:
    'Self-paced, AI-personalised finance career program. CFA/FRM prep, real-world Indian-market simulations, 24/7 AI tutor, mock interviews, NISM + CFI certifications. ₹1,500 lifetime.',
  provider: {
    '@type': 'Organization',
    name: 'Valuevade',
    sameAs: 'https://valuevade.com',
    url: 'https://valuevade.com',
  },
  inLanguage: 'en-IN',
  educationalLevel: 'beginner-to-intermediate',
  teaches: [
    'Financial modeling',
    'Equity research',
    'DCF valuation',
    'Ratio analysis',
    'LBO modeling',
    'CFA exam preparation',
    'FRM exam preparation',
  ],
  hasCourseInstance: [
    {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT60H',
      offers: {
        '@type': 'Offer',
        price: '1500',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: 'https://valuevade.com/start',
      },
    },
  ],
};

export const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Valuevade',
  url: 'https://valuevade.com',
  logo: 'https://valuevade.com/valuevade-logo.png',
  sameAs: [
    'https://www.linkedin.com/company/valuevade',
    'https://twitter.com/valuevade',
  ],
};
