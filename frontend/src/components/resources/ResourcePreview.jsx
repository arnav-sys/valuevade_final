import { BarChart3, FileText, Sparkles, Layers, MessagesSquare } from 'lucide-react';
import { CATEGORIES } from '../enterprise/api';

export const SAMPLE_RESOURCES = [
  ['DCF & scenario model','A structured starting point for assumptions, free cash flow forecasts and valuation sensitivities.',['Assumptions schedule','DCF structure','Scenario comparison']],
  ['Equity research report','Shape an investment thesis with business analysis, valuation, risks and source references.',['Investment thesis outline','Risk checklist','Valuation summary']],
  ['The finance prompt library','Source-grounded prompts for financial analysis, concall review and research synthesis.',['Concall extraction prompts','Financial-analysis prompts','Verification checklist']],
  ['Sector study framework','Organise the drivers, unit economics and industry questions that matter to your coverage.',['Industry structure','Key driver map','Peer comparison framework']],
  ['Analyst interview prep kit','Structure technical practice, behavioural stories and a concise investment pitch.',['Technical practice outline','STAR story framework','Stock-pitch structure']],
].map(([title,description,includes],i)=>({id:`sample-${i}`,title,description,includes,category:CATEGORIES[i],sample:true,price_paise:0}));
const ICONS = [BarChart3,FileText,Sparkles,Layers,MessagesSquare];
export const ResourcePreview = ({ item }) => {
  const index=Math.max(0,CATEGORIES.indexOf(item.category)); const Icon=ICONS[index];
  return <div className={`resource-art resource-art-${index}`} data-testid={`resource-preview-${item.id}`}>
    <div className="resource-art-top"><span>VALUEVADE / TOOLKIT</span><Icon size={22}/></div>
    <div className="resource-paper"><span className="resource-paper-label">{['MODEL / DCF','RESEARCH NOTE','PROMPT / RESEARCH','SECTOR / FRAMEWORK','INTERVIEW / PREP'][index]}</span>
      {index===0 ? <div className="resource-mini-sheet">{['Year','Y1','Y2','Y3','Growth','8%','10%','12%','WACC','12%','12%','12%','Scenario','Base','Bull','Bear'].map((x,i)=><span key={i}>{x}</span>)}</div> : <><strong>{['','The investment thesis','Role. Context. Task.','Find the drivers.','Tell a sharper story.'][index]}</strong><div className="resource-paper-lines"><i/><i/><i/></div><div className="resource-paper-check">{['','Business → Value → Risk','Source → Extract → Verify','Demand → Margins → Returns','Situation → Action → Result'][index]}</div></>}
    </div><small>ILLUSTRATIVE CATEGORY PREVIEW</small>
  </div>;
};