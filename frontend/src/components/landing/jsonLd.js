/**
 * JSON-LD structured-data helpers.
 * ------------------------------------------------------------------
 * Per Prompt-4 of the Aug-2026 SEO/GEO rebuild:
 *  - HOMEPAGE (/) ships EducationalOrganization + FAQPage.
 *  - COURSE DETAILS (/course/:id) ships Course + BreadcrumbList + FAQPage.
 *  - NO aggregateRating, NO Review markup anywhere.
 *  - FAQ schema is generated from the SAME source array that renders the
 *    visible FAQ — never duplicate the strings; changing the visible
 *    accordion must automatically change the schema.
 */

// ---------- Homepage: EducationalOrganization ----------
export const homeOrgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'Valuevade',
  url: 'https://valuevade.com',
  logo: 'https://valuevade.com/valuevade-logo.png',
  description:
    'AI-personalised equity research and financial modelling education platform for Indian finance students.',
  email: 'support@valuevade.com',
  sameAs: [
    'https://www.instagram.com/valuevade/',
    'https://www.linkedin.com/company/valuevade',
    'https://x.com/valuevade',
  ],
};

// ---------- Course details: Course ----------
export function buildCourseJsonLd(courseUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Equity Research Analyst Program',
    description:
      'Self-paced online equity research and financial modelling course for Indian finance students: 21 modules, 239 hands-on sessions on Indian companies, 3 capstone projects, NISM Series XV certification preparation, and a certificate of completion.',
    url: courseUrl,
    provider: {
      '@type': 'EducationalOrganization',
      name: 'Valuevade',
      sameAs: 'https://valuevade.com',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT60H',
    },
    offers: {
      '@type': 'Offer',
      price: '1500',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      category: 'Paid',
    },
    educationalCredentialAwarded: 'Valuevade Certificate of Completion',
    inLanguage: 'en',
  };
}

// ---------- Course details: BreadcrumbList ----------
export function buildCourseBreadcrumbJsonLd(courseUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',
        item: 'https://valuevade.com/' },
      { '@type': 'ListItem', position: 2, name: 'Courses',
        item: 'https://valuevade.com/courses' },
      { '@type': 'ListItem', position: 3, name: 'Equity Research Analyst Program',
        item: courseUrl },
    ],
  };
}

// ---------- FAQPage (used on both pages) ----------
export function buildFaqPageJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (faqs || []).map((f) => ({
      '@type': 'Question',
      name: f.question || f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer || f.a,
      },
    })),
  };
}
