import { Accordion,AccordionContent,AccordionItem,AccordionTrigger } from '../ui/accordion';

const questions={
  course:[
    ['Is this a course or an agent implementation?','This tab covers training for your people: finance fundamentals, valuation, AI-assisted research and workflow design. Commissioning a Valuevade-built agent is a separate service in the AI Agents tab.'],
    ['What level of finance or AI experience does the team need?','We start by discussing your team’s roles and current skills. The depth and emphasis should match the cohort; advanced modelling and automation topics can be scoped around the team’s starting point.'],
    ['Can we focus on our sector or specific workflows?','Share the sector, common tasks and desired outputs in your enquiry. Any tailored exercises, delivery format and programme scope are agreed in the proposal. Do not include confidential files in the enquiry.'],
    ['Does the team price include custom AI agents?','No. The seat calculator is an indicative course-training estimate only. Agent design, implementation, integrations and ongoing support need their own scope and quotation. Sample prices are labelled until final rates are approved.'],
    ['Will AI replace the analytical work?','No. The course emphasises source checks, model assumptions and defensible reasoning. AI can help structure and draft work; the analyst remains accountable for the judgement.'],
  ],
  agents:[
    ['Are these ready-to-use agents I can buy instantly?','The page describes proposed Valuevade-built workflow implementations. Enquire to confirm availability, capabilities, dependencies and delivery scope. The illustrations are not live agents connected to your systems.'],
    ['Can an agent work with our Excel files or accounting system?','Share your current tools and the task you want to improve. File formats, connectors, permissions and integration feasibility must be assessed during scoping; no connector is assumed to be included.'],
    ['How will confidential financial data be handled?','Before any data is shared, agree the hosting approach, access controls, retention and provider terms. We do not claim an isolated tenant, zero retention or a no-training guarantee on this page; those requirements belong in your implementation agreement.'],
    ['Can the agent post entries or make investment decisions on its own?','These workflows are designed around human review. The proposed scope does not include autonomous investment decisions or unreviewed financial postings. Approval responsibilities are defined before rollout.'],
    ['How is implementation priced?','Agent pricing is scope-based, not per training seat. The proposal considers the workflow, input sources, integrations, review steps and support requirements. The course calculator is not an agent price.'],
    ['Can our team learn to build and govern these workflows instead?','Yes—choose the Course tab to explore in-house capability training. Training and implementation can also be discussed together, with the deliverables and pricing clearly separated.'],
  ],
};
export const BusinessFAQ=({offering})=> <section className="be-section be-faq" data-testid={`${offering}-faq`}><div className="be-section-heading"><div><p className="biz-eyebrow">BEFORE WE TALK</p><h2>A few important details.</h2></div><p>Clear scope. Informed decisions.</p></div><Accordion type="single" collapsible className="be-faq-list">{questions[offering].map(([q,a],i)=><AccordionItem value={String(i)} key={q} data-testid={`${offering}-faq-item-${i}`}><AccordionTrigger data-testid={`${offering}-faq-question-${i}`}>{q}</AccordionTrigger><AccordionContent data-testid={`${offering}-faq-answer-${i}`}>{a}</AccordionContent></AccordionItem>)}</Accordion></section>;