// Editorial B2B positioning, separate from the published student syllabus.
// Upcoming course outlines are explicitly labelled proposed in the interface.
const profiles = {
  'Equity Research': {
    summary: 'Build a shared research standard across your team—from financial statements and valuation to source-grounded, AI-assisted investment analysis.',
    audience: 'Research teams, investment analysts, associates and research managers',
    outcomes: ['Create a consistent approach to financial statement analysis.', 'Challenge valuation assumptions with scenarios and sensitivity checks.', 'Produce evidence-led research briefs with clear reviewer sign-off.'],
    application: 'A company research brief and valuation model, with an assumptions log and a documented review process.',
    topics: ['Financial statements & earnings quality', 'DCF & comparable valuations', 'Sector analysis & investment thesis', 'AI-assisted research & verification'],
    art: '/brand/er-certs-art.webp',
  },
  'Investment Banking': {
    summary: 'Align deal teams around financial analysis, valuation and decision-ready transaction materials.',
    audience: 'Corporate finance teams, transaction analysts and deal-support associates',
    outcomes: ['Use a common framework for evaluating a transaction.', 'Make valuation assumptions transparent to reviewers.', 'Structure concise, decision-ready deal materials.'],
    application: 'A proposed transaction brief connecting commercial context, valuation assumptions and key diligence questions.',
    topics: ['Transaction analysis', 'Valuation frameworks', 'Deal materials', 'Diligence & review'],
    art: '/brand/career-art.webp',
  },
  'Private Equity': {
    summary: 'Develop a common language for investment screening, diligence and deal evaluation across your investment team.',
    audience: 'Investment teams, diligence analysts and portfolio-company finance teams',
    outcomes: ['Evaluate investment theses against supporting evidence.', 'Connect deal assumptions to risks and value-creation levers.', 'Prepare structured investment committee discussions.'],
    application: 'A proposed investment screening memo with diligence priorities, risk assessment and a value-creation hypothesis.',
    topics: ['Investment screening', 'Diligence priorities', 'Deal structure', 'Value-creation analysis'],
    art: '/brand/certs-art.webp',
  },
  'Financial Modelling': {
    summary: 'Build consistent modelling practices so finance teams can explain the numbers, test assumptions and review each other’s work.',
    audience: 'FP&A teams, finance analysts, business planners and model reviewers',
    outcomes: ['Structure models around clear, traceable assumptions.', 'Compare scenarios with consistent model logic.', 'Introduce checks that make review and handover easier.'],
    application: 'A proposed driver-based financial model with an assumptions sheet, scenario analysis and review checklist.',
    topics: ['Model structure', 'Linked financial statements', 'Scenario analysis', 'Model checks & governance'],
    art: '/brand/claude-art.webp',
  },
  'Portfolio Management': {
    summary: 'Strengthen the investment process with a shared approach to allocation, risk discussion and portfolio review.',
    audience: 'Investment teams, portfolio analysts and risk-review professionals',
    outcomes: ['Connect portfolio decisions to an explicit investment mandate.', 'Communicate risk and concentration with greater clarity.', 'Create a repeatable framework for portfolio reviews.'],
    application: 'A proposed portfolio review pack covering allocation rationale, risk exposures and monitoring priorities.',
    topics: ['Investment mandates', 'Asset allocation', 'Risk & performance', 'Portfolio review'],
    art: '/brand/roadmap-art.webp',
  },
  'Wealth Management': {
    summary: 'Help advisory teams structure clearer client conversations around goals, suitability and portfolio decisions.',
    audience: 'Wealth advisory teams, relationship managers and client-service professionals',
    outcomes: ['Frame recommendations around client goals and constraints.', 'Explain risk and trade-offs consistently.', 'Document a clear rationale for ongoing client reviews.'],
    application: 'A proposed client-review framework linking goals, risk considerations and an evidence-based recommendation rationale.',
    topics: ['Client goals & suitability', 'Portfolio construction', 'Risk communication', 'Advisory review practices'],
    art: '/brand/certs-art.webp',
  },
};

export const courseProfile = course => profiles[course.category] || {
  summary: `Develop your team’s capability in ${course.title.toLowerCase()}, with a learning scope agreed around your business needs.`,
  audience: 'Finance professionals and team leaders',
  outcomes: ['Agree a common quality standard.', 'Practise applying the learning to team workflows.', 'Review the work against agreed success criteria.'],
  application: 'A practical team assignment, with scope and review criteria agreed in your proposal.',
  topics: [], art: '/brand/er-certs-art.webp',
};