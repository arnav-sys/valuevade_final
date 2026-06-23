# MODULE 16: AI for Finance & Equity Research — From Fundamentals to Full Automation

*Tagline: AI won't replace analysts. But an analyst who can build AI workflows will replace ten who can't.*

## Learning Outcome

After this module you will understand how AI actually works, write investment-grade
prompts, kill hallucinations with grounding and verification, and use AI across every stage of the research
process — filings, modelling, screening, valuation, data analysis. You will then go beyond chat: you'll chain
tools into workflows, understand and deploy AI agents, build no-code automations that run while you sleep,
and even build your own small AI tools on top of an API. By the end you can design a system that
automates the bulk of the equity research and finance workflow end-to-end — multiplying your output 10x
— while never publishing a number you haven't verified yourself. The final session teaches you to package
all of this so it makes you the obvious hire.


*Sessions in this module: 20, across 5 parts.*


---

## 🧱 PART A — AI Foundations (understand the machine before you trust it)

Session 16.1 — AI 101 for Non-Tech Analysts: How LLMs Actually Work (No Maths, Pure Intuition)
Session 16.2 — Inside the Machine: Tokens, Context Windows, Memory & Why AI "Drifts"
Session 16.3 — The AI Tool Landscape: Choosing the Right Model & Tool for Every Job

✍️ PART B — Prompt Engineering Mastery (the single highest-ROI skill)
Session 16.4 — Prompt Engineering Foundations: The Anatomy of an Investment-Grade Prompt
Session 16.5 — Advanced Prompting: Chain-of-Thought, Few-Shot, Personas & Structured Outputs
Session 16.6 — Grounding & Guardrails: Killing Hallucinations and Forcing Verification
Session 16.7 — Your Finance Prompt Library: Reusable Templates That Compound


---

## 📑 PART C — AI Across the Research Workflow (apply it to the real job)

Session 16.8 — AI-Powered Fundamental Research: Annual Reports, Concalls & Filings at Speed
Session 16.9 — AI for Data Analysis: Spreadsheets, Charts & the Code Interpreter
Session 16.10 — Your AI Financial Modelling Assistant: 3-Statement Models Done Right
Session 16.11 — Sector Screening & Idea Generation at Scale Using AI

Session 16.12 — Valuation Automation: DCF, Comps & Scenario Analysis with AI


---

## 🤖 PART D — Workflows, Agents & Automation (the leap from user to builder)

Session 16.13 — From Tools to Pipelines: Building Multi-Step AI Research Workflows
Session 16.14 — AI Agents Explained: From Chatbots to Autonomous Analysts
Session 16.15 — No-Code Automation: Zapier, Make & n8n for Finance Workflows
Session 16.16 — Building Your Own AI Tools: APIs, Custom GPTs, Projects & Mini-Apps


---

## 🚀 PART E — Full Automation & Standing Out (the system and the career)

Session 16.17 — The Fully Automated Equity Research Engine (End-to-End Capstone Workflow)
Session 16.18 — Automating the Wider Finance Function: Monitoring, Reporting & Alerts
Session 16.19 — Your AI Analyst Operating System: The 10x Productivity Engine
Session 16.20 — Standing Out: Showcasing Your AI Skills in Your Resume, CV & Interviews


> ⚠️ **Note:** A note that governs this entire module: AI tools are assistants, not analysts. They generate text

that sounds authoritative, including numbers that can be completely wrong. In finance — where you
put your name on a recommendation and a regulator holds you accountable — every figure, quote,
and claim from an AI must be verified against the primary source before it goes anywhere near a
report. This is even more true once you automate: an agent that runs unsupervised can produce a
hundred wrong outputs as easily as one. Speed without verification isn't productivity; it's a liability at
scale. Treat every "Human Edge" note in this module as the real lesson.

> 🛠️ **Tools note:** Tools evolve fast. The tool names, model versions, and features below were accurate at the time

of writing, but AI products change constantly — new models, renamed features, shifted pricing. Treat
every specific capability as a starting point and check each tool's current documentation. The
principles in this module (how LLMs work, how to prompt, how to verify, how to design a workflow)
long outlive any individual tool.


---

## 🧱 PART A — AI FOUNDATIONS

You cannot safely automate a tool you don't understand. Part A gives you an accurate mental model of
what an LLM is, what it can and can't do, how it processes your input, and how to pick the right tool. Skip
this and every later session becomes a leap of blind faith. Master it and everything downstream becomes
obvious.


---

## Session 16.1: AI 101 for Non-Tech Analysts —

How LLMs Actually Work

"An AI can write a flawless-sounding research report on a company that doesn't exist. Understanding
why is the first thing that keeps you employed."


### 🎣 Hook — "The Confident Liar"

Here's the most important fact about AI you'll ever learn: it can be completely wrong while sounding
completely sure.

A large language model (LLM) doesn't know things the way a database does. It predicts the next likely
word.

So when it doesn't know an answer, it doesn't stop — it generates a plausible-sounding one. This is called a
"hallucination."

In finance, a confident, wrong number isn't a quirk. It's a career risk.


> **🧠 Remember: An LLM predicts words, not truth — it can be fluent and false at the same time.**


### 🔬 Deep Dive — "How an LLM Actually Works (No Maths)"

Strip away the jargon, and the mechanism is simple.

It was trained on a massive pile of text — books, articles, websites, code, filings.
From that, it learned the patterns of how words follow each other in human writing.
Give it a prompt, and it predicts the most likely next word, then the next, and so on, one piece at a time.
It has no live internet and no memory of facts unless you connect those tools or paste the data in
yourself.
"Training" happened once, in the past — so its built-in knowledge has a cutoff date and gets stale.
It's pattern completion at enormous scale — not understanding, not looking things up, not reasoning the
way a person does.

The magic isn't that it knows things. The magic is that predicting the next word well enough, across trillions
of examples, produces output that often looks like knowledge and reasoning. Often — not always. That gap
is your entire job.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Create accounts on three tools: Claude (Anthropic — strong at long documents and reasoning),
ChatGPT (OpenAI — versatile general assistant), and Perplexity (AI search with citations to live

sources).
2. Ask the same finance question in all three and compare the answers — notice where they differ.
Differences are a flashing sign that you must verify.
3. Take one number each gave you and trace it to a primary source (a BSE/NSE filing or the company's
investor-relations page).
4. Ask each tool its knowledge cutoff date, and note that anything after it is a blind spot.
5. Save the verification-forcing prompt above somewhere you'll reuse it.


> ⏱️ Time saved: Understanding the tool correctly now saves you from a catastrophic error later — the kind

that turns a 4-hour report into a retraction. The best time investment in the module.


### ⚡ Copy-Paste Prompts

Use these to practise the right habits from day one. Notice that each one builds in a verification step.


**1. Explain-a-concept prompt (learning):**


```
You are a finance educator. Explain [concept, e.g. "deferred tax liability"]
to a B.Com student in simple terms, using one Indian example with ₹ figures.
Keep it under 150 words. At the end, list the 1–2 facts I should double-check
against a textbook or filing before I rely on this.
```


**2. The verification-forcing prompt (use on ANY factual answer):**


```
For each numerical claim or fact in your previous answer, tell me:
(a) how confident you are, and
(b) exactly which primary source I should check to confirm it
(e.g. the company's annual report, BSE filing, or RBI website).
Do not invent sources. If you are unsure, say so explicitly.
```


**3. The "draft, don't assert" prompt:**


```
Draft a 3-bullet summary of [topic]. Mark any number, date, or name
you are not certain about with a       ⚠️ flag so I know what to verify.
4. The "what's your cutoff" reality check:
```


What is your knowledge cutoff date? For [Company / topic], what important
developments might have happened AFTER your cutoff that you wouldn't know about?
List what I should search for to get current information.


> **🧠 Remember: An LLM is trained once on text patterns and completes them — that's the whole engine,**

and its knowledge is frozen at a cutoff.


### 💡 Concept — "Prediction, Not Retrieval"

This is the mental model that fixes everything: AI is autocomplete on steroids, not a search engine.

A search engine retrieves a document that exists. An LLM generates words that seem right.

Picture a brilliant improv actor who's read every book but remembers none perfectly. Ask a question and
they'll perform a confident, fluent answer — sometimes spot-on, sometimes invented, and they'll never tell
you which.

Once you see AI as a predictor, you stop trusting it blindly and start verifying. Every habit in this module
flows from this one idea.


**The human edge — what stays yours**


AI predicts; it doesn't know, and it doesn't care whether it's right. You do. The analyst supplies three things
AI never can: accountability (your name and registration are on the report, not the model's), judgment
(deciding whether an answer even makes sense), and verification (the discipline to check). An LLM will
happily generate a beautiful, wrong report. Catching that is the entire job — and it stays the job no matter
how advanced the tools become.


> **🧠 Remember: AI generates plausible text; it doesn't retrieve verified facts — so it's a draft, never a source.**


### ⚠️ Mistake — "Trusting the AI's Numbers"

The single most dangerous habit: copying an AI-generated financial figure straight into a model or report.

Students do it because the number looks specific and the tone sounds authoritative.

But an LLM can invent a revenue figure, a growth rate, a margin, even a citation — and present every one
as fact, with the same calm confidence it uses for things it has right.

Put a hallucinated number in a research report and you don't just look careless; you mislead investors and
breach your professional duty. The fact that "the AI said so" is not a defence anyone will accept.


> **🧠 Remember: Never trust an AI number — verify every figure against the company filing or a primary**

source.


### 📊 Real World — "When AI Invented the Evidence"

In a now-famous 2023 case in the US, lawyers submitted a court filing that cited several past cases to
support their argument.

The problem: an AI chatbot had fabricated those cases. They didn't exist. The lawyers were sanctioned and
publicly humiliated.

The lesson transfers exactly to finance. Swap "court case" for "revenue figure" or "management quote."

An analyst who pastes an unverified AI number into a report is one bad filing away from the same
humiliation — and a regulatory problem with their name on it.


> **🧠 Remember: AI has fabricated evidence in the real world — assume it can fabricate your numbers too,**

and check.


### 📋 Summary — "AI 101 — Key Takeaways"

This session in 60 seconds:

1. An LLM predicts the next word; it doesn't know facts and can hallucinate confidently.
2. It learned text patterns from training data — pattern completion, not retrieval — and its knowledge is
frozen at a cutoff date.
3. Treat AI as autocomplete on steroids, not a search engine — a draft, never a source.
4. Beginners trust AI numbers; analysts verify every figure against primary sources.
5. The model sounds equally confident whether it's right or wrong — confidence carries zero information
about accuracy.

What you can now do: Use AI tools with the correct mental model — leaning on them for drafts and speed
while verifying every fact yourself.


> **🧠 Remember: AI is a fluent, fallible assistant — useful for everything except being trusted unverified.**


### 🎨 Visual — "How an LLM Predicts the Next Word"

Create a dark-themed infographic with a navy background (#02073D). On the left, show an input prompt
box in glowing blue (#246BFD) reading: "Reliance's main business is…". An arrow flows right into a central
glowing "prediction engine" shape (purple #6A5CFF) labelled "LLM: predicts most likely next word." From
the engine, show three candidate next-words floating out with probability bars beside them — "oil & gas
(62%)", "retail (24%)", "telecom (14%)" — with the highest-probability one highlighted. A caption below the
engine in Lavender White (#F5ECFF): "It picks likely words, one at a time — it is NOT looking up a
database." On the right, a contrasting faded panel with a database/magnifying-glass icon crossed out,
labelled "      ❌ Not retrieval." At the bottom, a pink (#FF6AC1) warning strip: "Plausible ≠ True. Always verify."
Label every element in white text. Title at top: "How an LLM Predicts the Next Word." Style: clean, minimal,
professional financial infographic.

What this visual shows: It makes the core mechanism unforgettable — the student sees the AI choosing
likely words rather than retrieving facts, which is exactly why verification is non-negotiable.


> **🧠 Remember: AI builds answers word-by-word from probability — picture that, and you'll always verify.**


### ❓ Quiz (5 Questions)


**Q1. At its core, how does a large language model produce an answer?**
a) It looks up the answer in a verified database
- b) It predicts the most likely next word, one at a time, from
patterns in its training data
- c) It searches the live internet for every answer
- d) It calculates the answer
mathematically with certainty


> ✅ **Answer:**
- b) 📝 Why: An LLM is a next-word predictor trained on text patterns. It doesn't retrieve verified

facts, which is why it can sound right while being wrong.


**Q2. An AI confidently gives you a specific revenue figure for Titan. What should you do?**
a) Paste it straight into your model — it's specific, so it's reliable
- b) Verify it against Titan's actual filing
before using it
- c) Trust it because the AI sounded certain
- d) Average it with another AI's figure


> ✅ **Answer:**
- b) 📝 Why: Specificity and confidence are not accuracy. AI can hallucinate numbers, so every

figure must be traced to a primary source.


**Q3. The term "hallucination" in AI refers to:**
a) The AI getting tired
- b) The AI generating plausible-sounding but false or fabricated information
- c) A visual
glitch on screen
- d) The AI refusing to answer


> ✅ **Answer:**
- b) 📝 Why: A hallucination is fabricated output presented as fact. It's the central risk when

using AI for finance.


**Q4. True or False: Because an LLM is trained on huge amounts of data, you can trust it as a**
reliable source for current financial figures without checking.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: Training data is frozen at a cutoff and can be stale, and the model can

fabricate. It's a drafting tool, never a primary source — always verify.


**Q5. Fill in the blank: The principle that an AI's output is only as good as the prompt and data**
you give it is summed up by the phrase "_ in, _ out."

> ✅ **Answer:** Garbage in, garbage out 📝 Why: Weak inputs and context produce unreliable outputs. Your

input quality and verification are the real levers on usefulness.


---

## Session 16.2: Inside the Machine — Tokens,

Context Windows, Memory & Why AI "Drifts"

"People blame the AI for getting worse halfway through a long chat. The AI didn't get worse. It ran out
of room to remember — and nobody told them that's how it works."


### 🎣 Hook — "Why Your AI Forgets"

You paste a long annual report, ask three sharp questions, and the answers are great. Then on the fourth
question it starts contradicting itself or forgetting what you said earlier.

It feels like the AI got dumber. It didn't. It hit a limit.

An LLM can only "see" a certain amount of text at once — its context window. Go past it, and the earliest
things you said quietly fall out of view.

Understanding this one limit explains 90% of frustrating AI behaviour — and tells you exactly how to avoid
it.


> **🧠 Remember: AI doesn't get tired or lazy — it has a fixed memory window, and old text silently drops out**

when you exceed it.


### 🔬 Deep Dive — "Tokens, Context, and the Window"

A few mechanical facts that make you dramatically better at using AI:

Tokens are the pieces an LLM reads — roughly ¾ of a word each in English (so 1,000 words ≈ 1,300–
1,500 tokens). The model counts tokens, not words.
The context window is the maximum number of tokens the model can hold in view at once — your
prompt, the documents you pasted, and its own replies all count toward it.
Modern models have large windows (tens to hundreds of thousands of tokens — a big window can hold
a whole annual report), but they are still finite.
Within a single chat, the model re-reads the whole visible conversation every time it answers —
that's how it "remembers" earlier turns. There is no separate memory; the chat history is the memory.
When the conversation grows past the window, the oldest content gets truncated — and the model can
no longer use what it can't see.
Longer inputs also cost more (in paid tools) and can dilute focus: bury one key instruction in 50 pages
and the model may under-weight it.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Take a long document (an annual report or a 20-page concall) and paste it into a large-context model
with one precise question.
2. Ask five follow-up questions, then deliberately ask something that requires your very first instruction —
notice whether it still "remembers."
3. Run the "summarise so I can start fresh" prompt, open a new chat, paste the summary, and confirm the
new chat continues seamlessly.
4. Re-do one earlier task using the tight context-block template instead of a rambling prompt, and
compare the sharpness of the answers.
5. Adopt the rule: new task → new chat → curated context block.


> ⏱️ Time saved: Mastering window management eliminates the single biggest source of wasted AI time —

confused, drifting, self-contradicting chats. You stop fighting the tool and start directing it.


### ⚡ Copy-Paste Prompts


**1. The context-block template (paste at the start of any research task):**


CONTEXT FOR THIS TASK — use only what's below, ignore anything outside it.
Company: [name, ticker, sector]
My goal: [e.g. "build a quick investment view"]
Verified key figures (from filings): [revenue, margin, debt, etc.]
Constraints: [e.g. "Indian listed company, FY24 data, ₹ crore"]

```
What I want from you now: [the specific task]
```


**2. The "summarise so I can start fresh" prompt (run before opening a new chat):**


```
We've covered a lot. Produce a compact handoff summary I can paste into a
NEW chat to continue this work: the company, the verified numbers we
established, the decisions we made, and the open questions. Keep it under
250 words and include only what a fresh chat would genuinely need.
```


**3. The "stay grounded in what I gave you" guardrail:**


```
Answer using ONLY the document/data I pasted above. If the answer isn't
in that text, say "not in the provided material" rather than guessing
from general knowledge.
```


> **🧠 Remember: Everything the model can use must fit inside its token window at once — prompt,**

documents, and its own answers included.


### 💡 Concept — "The Whiteboard, Not the Brain"

Think of a chat as a whiteboard, not a brain.

Everything written on the whiteboard is visible and usable. When the board fills up, you must wipe the top to
write at the bottom — and whatever you wiped is gone.

The model has no long-term memory of you between separate chats unless a specific "memory" feature is
switched on (some tools have one). By default, a new chat is a blank whiteboard — it remembers nothing
from yesterday.

This is why pros start a fresh chat for a fresh task (a clean board), and paste a short summary of what
matters rather than relying on the AI to "recall" a long past conversation.


**The human edge — what stays yours**


The model manages tokens; you manage meaning. Deciding what belongs on the whiteboard — which five
numbers matter, which context is noise, when to wipe and restart — is editorial judgment, and it's entirely
yours. An analyst who curates context tightly will get sharper output from a weaker model than a careless
user gets from the best model on earth. The tool has a memory limit; your job is to make every token in that
limit count.


> **🧠 Remember: A chat is a whiteboard that the AI re-reads each turn — wipe it for a new task, and don't**

expect memory across separate chats unless a memory feature is on.


### ⚠️ Mistake — "The Never-Ending Mega-Chat"

Students run one enormous chat for days — research, modelling, drafting, casual questions, all in a single
thread.

They do it because starting over feels wasteful, and they assume more history means more context.

But a bloated thread fills the window with irrelevant old text, pushes important earlier instructions out of
view, makes answers slower and more confused, and increases the odds the model loses the plot. The AI
starts mixing up companies, reusing stale numbers, and contradicting itself.

The fix is discipline: one clean chat per focused task, with a short, pasted-in context block at the top.


> **🧠 Remember: A giant catch-all chat sabotages itself — keep one focused chat per task and feed it a tight**

context block.


### 📊 Real World — "Why Pros Paste Context Every Time"

Watch an experienced AI user and you'll notice a habit: at the start of a task, they paste a compact "here's
what you need to know" block — the company, the verified key numbers, the goal — even though they
"discussed it before."

They're not being forgetful. They're managing the window deliberately. They know the model only uses
what's currently in front of it, so they put exactly what's needed on the board and nothing else.

In a research setting, this is the difference between an AI that confidently mixes up two companies' margins
and one that stays laser-accurate. The skill isn't remembering more — it's controlling what the model sees.


> **🧠 Remember: Top users feed the AI a fresh, curated context block each task — they manage the window**

instead of hoping the AI remembers.


### 📋 Summary — "Inside the Machine — Key Takeaways"

This session in 60 seconds:

1. Tokens are the units an LLM reads (~¾ of a word); the model counts tokens, not words.
2. The context window is the finite amount of text the model can see at once — prompt, documents, and
its own replies all count.
3. Within a chat, the model re-reads the whole visible history each turn — that is its memory; there's no
separate store.
4. Exceed the window and the oldest text silently drops out, causing "drift," contradictions, and forgotten
instructions.
5. The fix is window management: one clean chat per task, a tight curated context block, and a fresh start
when things get bloated.

What you can now do: Diagnose and prevent AI "drift," structure long-document work to fit the window, and
control exactly what the model sees so its answers stay accurate.


> **🧠 Remember: Manage the window and you manage the AI — give it the right context, not the most**

context.


### 🎨 Visual — "The Context Window Whiteboard"

Create a dark-themed infographic with a navy background (#02073D). Show a large rectangular
"whiteboard" outlined in glowing blue (#246BFD) labelled "CONTEXT WINDOW — everything the AI can
see at once." Inside it, stack labelled blocks from top to bottom: a purple (#6A5CFF) block "Your system
instruction / role," a blue block "Pasted annual report (big!)," a blue block "Your questions," and a pink
(#FF6AC1) block "The AI's own replies." Show a dotted line near the top labelled "WINDOW FULL — text
above here gets wiped," with a faded, greyed-out block sliding off the top edge labelled "   ❌ Forgotten: your
earliest instruction." To the right, a small token-counter gauge in Lavender White (#F5ECFF) showing
"1,000 words ≈ 1,400 tokens." A caption at the bottom in white: "The AI re-reads this whole board every
turn. Fill it with junk and it forgets what matters." Title at top: "The Context Window Whiteboard." Style:
clean, minimal, professional financial infographic.

What this visual shows: It makes the abstract "context window" physical — students see old text falling off
the board, which explains drift and motivates the habit of curating context.


> **🧠 Remember: Picture a whiteboard that overflows from the top — that image alone will fix most of your AI**

frustrations.


### ❓ Quiz (5 Questions)


**Q1. What is a "context window"?**
a) The screen area where you type
- b) The maximum amount of text (in tokens) the model can see and use
at once
- c) A pop-up that shows the AI's sources
- d) The time limit on a conversation


> ✅ **Answer:**
- b) 📝 Why: The context window is the finite token budget holding your prompt, pasted

documents, and the model's replies. Everything the model uses must fit inside it.


**Q2. Roughly how do tokens relate to words in English?**
a) One token equals exactly one word
- b) One token is roughly three-quarters of a word, so 1,000 words ≈
~1,300–1,500 tokens
- c) One token equals one letter
- d) Tokens are unrelated to text length


> ✅ **Answer:**
- b) 📝 Why: Tokens are sub-word pieces averaging about ¾ of a word. Knowing this helps you

estimate whether a document will fit the window.


**Q3. Within a single chat, how does the model "remember" earlier messages?**
a) It stores them in a permanent database about you
- b) It re-reads the whole visible conversation each time
it answers — the history is the memory
- c) It memorises them forever across all chats
- d) It doesn't
remember anything within a chat


> ✅ **Answer:**
- b) 📝 Why: There's no separate memory by default — the model re-processes the visible

thread every turn, which is why exceeding the window causes forgetting.


**Q4. True or False: Running one enormous chat for every task gives the AI more useful**
context and better answers.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: A bloated thread fills the window with noise, pushes key instructions out of

view, and causes drift. One focused chat per task with a curated context block works far better.


**Q5. Fill in the blank: The pro habit for keeping AI answers accurate is to give it the _ context,**
not the _ context.

> ✅ **Answer:** right / most 📝 Why: Curating exactly what the model needs beats dumping everything in.

Quality and relevance of context beat sheer quantity.


---

## Session 16.3: The AI Tool Landscape —

Choosing the Right Model & Tool for Every Job

"Asking 'which AI is best?' is like asking 'which vehicle is best?' Best for what — a city commute, a
cargo haul, or a mountain trail? The pro owns a small, deliberate fleet."


### 🎣 Hook — "There Is No 'Best AI'"

Beginners want one answer: which tool should I use? The honest answer is it depends on the job — and
that's not a dodge, it's the whole skill.

A model that's brilliant at reasoning over a 200-page filing may be the wrong choice for finding today's
news. A tool that searches the live web with citations is the wrong choice for crunching a spreadsheet.

The people who get 10x more from AI aren't using a secret tool. They've learned which tool fits which task
— and they switch without friction.


> **🧠 Remember: There's no single best AI — there's the right tool for each job, and knowing the map is the**

edge.


### 🔬 Deep Dive — "The Categories of AI Tools (and What Each Is For)"

You don't need fifty tools. You need to understand a handful of categories and keep one good option in
each. As of writing, the landscape looks like this:

Frontier chat assistants (Claude, ChatGPT, Gemini): general-purpose reasoning, writing, analysis,
coding help. Your workhorses. Each has strengths — long-document reasoning, broad capability, deep
integration with a specific ecosystem — but all three are strong generalists.
AI search engines (Perplexity, and search modes built into the chat assistants): answer questions
using the live web and show citations. Use these whenever recency matters — news, current prices,
recent filings — then verify the sources.
AI data analysts (the code-interpreter/data-analysis modes inside the chat assistants; standalone tools
like Julius): upload a spreadsheet or CSV and have them compute, chart, and explore real numbers
using actual code, not word-prediction.
AI knowledge/note tools (Notion AI and similar): organise, summarise, and query your own notes and
documents inside a workspace.
AI presentation builders (Gamma, Beautiful.ai): turn finished, verified content into a deck fast.
AI voice/transcription tools: transcribe a concall or meeting audio into text you can then analyse.

Automation platforms (Zapier, Make, n8n — covered later): wire tools together so steps run
automatically.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Set up one tool in each of the three core categories: a frontier chat assistant, an AI search engine, and
an AI data analyst (or the data mode of your assistant).
2. Take one research question and deliberately route each part to the right tool: news via search, filing
analysis via the chat assistant, numbers via the data tool.
3. Try the classic mistake on purpose — ask a no-web model for today's news — and watch how it fails or
hedges, so you never do it for real.
4. Write a one-line note for each tool: "use this for ___."
5. Pin your three-tool stack somewhere visible.


> ⏱️ Time saved: Picking the right tool first time avoids the most common AI dead-ends — stale "news,"

fabricated current facts, and arithmetic errors — saving you the rework and the risk of trusting a bad
answer.


### ⚡ Copy-Paste Prompts


**1. The "is this the right tool?" self-check (ask yourself, not the AI):**


Before I prompt, I answer three questions:
1. Does this need CURRENT info? → use a live-search tool, not native knowledge.
2. Does this need EXACT calculation on real numbers? → use a data/code tool.
3. Is the answer in a document I have? → paste it and force "use only this."
If none apply, a plain chat assistant is fine.


**2. The model-comparison prompt (run the same task across tools):**


[Paste an identical finance question into Claude, ChatGPT, and Perplexity.]
Then compare: where do the answers agree, where do they differ, and which
gave sources? Treat every disagreement as a flag to verify from the filing.


**3. The "route this task" prompt (when unsure):**


```
I want to [describe the task, e.g. "find this company's latest quarterly
results and chart the margin trend"]. Break it into steps and tell me, for
each step, which TYPE of AI tool is best suited — live search, document
reasoning, or data analysis — and why.
```


> **🧠 Remember: Keep one good tool per category — chat assistant, live search, data analyst, notes, decks**

— and reach for the category the task demands.


### 💡 Concept — "Native Knowledge vs Live Web vs Your Documents"

The most important distinction when picking a tool is where the answer comes from. There are three
sources, and mixing them up is where people go wrong:

Native (training) knowledge — what the model learned during training. Great for concepts and
explanations; stale and unverifiable for current facts. (Plain chat assistant, no web.)
Live web — fetched in real time, with links. Right for anything recent or factual-and-changing. (AI
search tools / search modes.)
Your own documents — the exact text you provide (a pasted filing, an uploaded spreadsheet). The
most reliable, because you control the source — but the model can still misread it, so you still check.

A huge share of AI mistakes come from asking a no-web model for a live fact, or trusting native knowledge
for something that needed a primary source. Match the source to the question.


**The human edge — what stays yours**


Tools are commoditised — everyone can access the same fleet. What isn't commoditised is the judgment of
which tool a task needs, when an answer smells wrong, and whether the output is good enough to use.
Routing work intelligently across tools, and knowing the limits of each, is a skill you build, not a feature you
buy. The map is free; reading it well is the analyst's contribution.


> **🧠 Remember: Decide where the answer must come from — native knowledge, live web, or your own**

documents — then pick the tool that draws from that source.


### ⚠️ Mistake — "Using a Hammer for Every Screw"

Students pick one tool, get comfortable, and force it to do everything — including the jobs it's worst at.

They do it out of loyalty and the hassle of learning others.

So they ask a no-web chatbot for "the latest news on this stock" (it confidently invents or gives stale
information), or paste numbers into a pure text model and trust its mental arithmetic (LLMs are notoriously
shaky at exact calculation without a code tool). Then they conclude "AI is unreliable for finance" — when
really they used the wrong category of tool.

The fix is a fleet, not a favourite.


> **🧠 Remember: Forcing one tool onto every task is why people wrongly decide "AI doesn't work" — match**

the tool to the job instead.


### 📊 Real World — "The Three-Tool Minimum for a Finance Student"

In practice, a finance student covering Indian stocks can do almost everything with three tools chosen
across categories:

A frontier chat assistant with a large context window to read filings and concalls and draft notes.
An AI search engine to pull the latest news and locate official filings, with citations to verify.
An AI data analyst (or the data mode of the chat assistant) to turn a financials spreadsheet into charts
and ratios using real computation.

Add a notes tool and a deck builder and you have a complete, near-free research stack that would have
needed a small team a decade ago. The point isn't the specific brands — it's having one reliable option in
each category and knowing when to switch.


> **🧠 Remember: Three categories — chat assistant, live search, data analyst — cover the bulk of a student's**

research needs.


### 📋 Summary — "The AI Tool Landscape — Key Takeaways"

This session in 60 seconds:

1. There's no single best AI — there's the right tool for each task, and knowing the categories is the skill.
2. The main categories: frontier chat assistants, AI search engines, AI data analysts, notes tools, deck
builders, transcription, and automation platforms.
3. The key distinction is the source of the answer: native training knowledge, the live web, or your own
documents — match the source to the question.
4. Beginners force one tool onto every job and wrongly conclude AI is unreliable; pros keep a small
deliberate fleet.
5. A finance student can cover most needs with three tools — a chat assistant, a live-search tool, and a
data analyst.

What you can now do: Choose the right AI tool for any research task based on what the task actually
needs, and avoid the classic mismatch errors.


> **🧠 Remember: Own a small fleet, know each tool's lane, and switch without friction — that's most of what**

"being good at AI" means.


### 🎨 Visual — "The AI Tool Map"

Create a dark-themed infographic with a navy background (#02073D). In the centre, a glowing blue
(#246BFD) hub labelled "THE TASK — what does it actually need?" Radiating out as labelled spokes to
category nodes: a purple (#6A5CFF) node "REASON OVER A DOCUMENT → Chat assistant (large
context)," a blue node "GET CURRENT FACTS → AI search engine (cites web)," a purple node "CRUNCH
NUMBERS → AI data analyst (real code)," a pink (#FF6AC1) node "ORGANISE NOTES → AI knowledge
tool," a pink node "BUILD A DECK → AI presentation tool," and a blue node "TRANSCRIBE AUDIO → AI
transcription." Along the bottom, a Lavender White (#F5ECFF) strip showing the three answer-sources as
small icons: "         🧠 Native knowledge (stale) | 🌐 Live web (verify) | 📄 Your documents (most reliable)." A

white caption: "Match the source to the question. Match the tool to the task." Title at top: "The AI Tool Map."
Style: clean, minimal, professional financial infographic.

What this visual shows: It turns tool selection into a simple decision map — start from the task, follow the
spoke — and reinforces the all-important "where does the answer come from" distinction.


> **🧠 Remember: Start from the task at the centre and follow the right spoke — that's how pros pick a tool in**

seconds.


### ❓ Quiz (5 Questions)


**Q1. What's the best answer to "which AI tool is the best?"**
a) Whichever is most expensive
- b) It depends on the task — keep one good tool per category and match it
to the job
- c) Always use the same single tool for consistency
- d) The newest one, always


> ✅ **Answer:**
- b) 📝 Why: Different categories of tool excel at different jobs. The skill is matching the tool to

what the task actually requires.


**Q2. You need this quarter's results and the latest news on a stock. Which tool type fits?**
a) A plain chat assistant with no web access
- b) An AI search engine (or search mode) that uses the live web
and cites sources
- c) A presentation builder
- d) A note-organising tool


> ✅ **Answer:**
- b) 📝 Why: Current, changing facts require live web access with citations. A no-web model

would give stale or fabricated information.


**Q3. For exact calculations and charts on a financials spreadsheet, the right tool type is:**
a) A pure text chat model doing mental arithmetic
- b) An AI data analyst / code-interpreter tool that computes
with real code
- c) An AI search engine
- d) A transcription tool


> ✅ **Answer:**
- b) 📝 Why: LLMs are unreliable at exact arithmetic on their own. A data/code tool runs actual

computations on your numbers.


**Q4. True or False: The most reliable source for an AI answer is usually the model's own**
training knowledge.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: Your own provided documents are typically the most reliable source (you

control them), then the cited live web. Native training knowledge is stale and unverifiable for current facts.


**Q5. Fill in the blank: A classic AI mistake is using a no-web chatbot to get __ information,**
which it can't reliably provide.

> ✅ **Answer:** current / live / up-to-date 📝 Why: Native-knowledge models have a frozen cutoff. Anything

recent must come from a live-search tool, not the model's memory.

✍️ PART B — PROMPT ENGINEERING MASTERY
Prompt engineering is the single highest-ROI skill in this module. The same model gives a vague, useless
answer or a sharp, sourced one depending entirely on how you ask. Part B takes you from the anatomy of a
basic prompt, through advanced techniques the pros use, to a verification-first discipline that keeps AI
output safe for finance — and ends with you building a reusable prompt library that turns every good prompt
into a permanent asset.


---

## Session 16.4: Prompt Engineering Foundations

— The Anatomy of an Investment-Grade Prompt

"The difference between a useless answer and a brilliant one usually isn't the AI. It's the five seconds
you spent — or didn't — writing the prompt."


### 🎣 Hook — "Same AI, Two Completely Different Answers"

Type "tell me about Asian Paints" and you get a bland Wikipedia-style paragraph — possibly out of date,
definitely generic.

Now give the AI a role, the actual data, a precise task, a format, and constraints — and the same model
produces a crisp, structured, useful analysis.

Nothing changed but the prompt. The model didn't get smarter; your instructions did.

Prompt engineering is simply learning to ask in a way that gets investment-grade output. It's the cheapest
skill with the biggest payoff in this whole module.


> **🧠 Remember: Output quality tracks prompt quality far more than tool choice — how you ask is the lever.**


### 🔬 Deep Dive — "The Five Parts of a Great Prompt (R-C-T-F-C)"

A strong prompt almost always contains five elements. Remember them as R-C-T-F-C:

Role — tell the AI who to be. "You are a forensic accountant" / "You are a sell-side equity analyst." A
role focuses its tone, vocabulary, and priorities.
Context — give it the real material and situation. The actual filing text, the verified numbers, who the
output is for. Context is where most prompts are too thin.
Task — state precisely what to do. Not "analyse this" but "identify the three largest year-on-year margin
changes and the stated reason for each."
Format — specify the shape of the output. A table, five bullets, a 200-word note, inverted-pyramid
order. Format turns a wall of text into something usable.
Constraints — set the rules and guardrails. Word limits, "use only the text I provide," "flag anything
uncertain," "do not invent numbers," "quote under 15 words."

Miss any one and quality drops. Nail all five and even a modest model performs like an expert assistant.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Take a vague one-liner you'd normally type and rewrite it with all five R-C-T-F-C parts.
2. Run both versions on the same task and put the outputs side by side — the gap is your lesson.

3. Use the "rewrite my weak prompt" prompt on two more rough asks and study what it adds.
4. Build one fully formed R-C-T-F-C prompt for a task you do often (e.g. concall analysis) and save it.
5. For the rest of the week, refuse to send any bare one-liner for real work.


> ⏱️ Time saved: A well-structured prompt gets a usable answer first time instead of three rounds of "no, I

meant…". You convert ten seconds of structure into a saved half-hour of back-and-forth on every
meaningful task.


### ⚡ Copy-Paste Prompts


**1. The R-C-T-F-C master template (fill the brackets for any task):**


```
ROLE: You are a [e.g. sell-side equity analyst covering Indian FMCG].
CONTEXT: [paste the real document/data + verified key figures + who this is for].
TASK: [state precisely what to do, e.g. "identify the 3 largest YoY margin
moves and the stated reason for each"].
FORMAT: [the exact output shape, e.g. "a 3-row table: item | change | reason"].
CONSTRAINTS: Use ONLY the material I provided. Do not invent any numbers.
Flag anything uncertain with     ⚠️. Keep quotes under 15 words.
2. The "rewrite my weak prompt" prompt (make the AI improve your ask):
```


```
Here is a prompt I wrote: "[paste your rough prompt]".
Rewrite it as a strong prompt using Role, Context, Task, Format, and
Constraints. Point out what context or guardrails I forgot to include.
```


**3. The concall analysis prompt (a fully built R-C-T-F-C example):**


```
ROLE: You are an experienced buy-side analyst.
CONTEXT: Below is the transcript of [Company]'s latest earnings call. [paste]
TASK: Extract (1) management's tone — confident or hedging — with evidence;
(2) every forward-looking number they gave; (3) any analyst question they
dodged.
FORMAT: Three labelled sections, bullets under each.
CONSTRAINTS: Quote exact words for any number (under 15 words). Use only the
transcript. I will verify every figure — do not estimate or fill gaps.
```


> **🧠 Remember: Role, Context, Task, Format, Constraints — five parts, and the thin one is usually Context**

or Constraints.


### 💡 Concept — "Specificity Is Everything"

The master principle beneath R-C-T-F-C is specificity. Vague in, vague out.

"Summarise this company" could mean a hundred things. "In 5 bullets, summarise this company's revenue
mix by segment, its biggest risk, and management's stated FY25 priority, using only the pasted MD&A" can
mean only one.

Analogy: it's the difference between telling an intern "do some research" versus handing them a one-line
brief with a deadline and a deliverable. The sharper the brief, the better the work — and the AI is the most
literal intern you'll ever manage.

Every word you add that narrows the target raises the quality of what comes back.


**The human edge — what stays yours**


A prompt encodes your thinking — what matters, what the output should contain, what must never be
assumed. The AI executes the brief; designing the brief is analysis. A vague thinker writes vague prompts
and gets vague work; a sharp analyst writes sharp prompts because they already know what a good
answer looks like. The tool will never out-think your brief — which is exactly why the brief is yours to own.


> **🧠 Remember: Specificity is the engine of prompt quality — narrow the target and the answer sharpens.**


### ⚠️ Mistake — "The Lazy One-Liner"

The most common prompting error is the bare, contextless request: "What's a good growth rate for Titan?"
or "Summarise this annual report."

Students do it because it's quick and it sometimes half-works.

But a one-liner gives the model no role, no real data, no format, and no guardrails — so it falls back on
generic, averaged, possibly-stale output, and may invent specifics to fill the gaps. You then either get a
weak answer or, worse, a confident wrong one.

The fix costs ten seconds: add the missing R-C-T-F-C elements, especially the real context and the
constraints.


> **🧠 Remember: A lazy one-liner gets a lazy answer — spend ten seconds adding role, real context, format,**

and constraints.


### 📊 Real World — "Prompting as Delegation"

The best framing comes from management: a prompt is a delegation brief to a fast, capable, literal-minded
assistant who knows a lot in general but nothing about your specific situation unless you tell it.

A good manager doesn't say "handle the client." They say who the client is, what's been agreed, what
outcome they want, by when, and what not to do. The output is predictably good because the brief was
good.

Finance professionals who are strong with AI essentially became good delegators. They write the brief
once, well, and reuse it — which is exactly what a prompt library (Session 16.7) is.


> **🧠 Remember: Treat each prompt as a brief to a literal new hire — brief it fully and the work comes back**

right.


### 📋 Summary — "Prompt Engineering Foundations — Key Takeaways"

This session in 60 seconds:

1. The same model gives bland or brilliant output depending entirely on the prompt — how you ask is the
lever.
2. Strong prompts contain five parts: Role, Context, Task, Format, Constraints (R-C-T-F-C).
3. The usually-missing parts are real Context and explicit Constraints (guardrails).
4. The master principle is specificity — vague in, vague out; narrow the target to sharpen the answer.
5. Think of a prompt as a delegation brief to a literal, capable assistant who knows nothing of your
specifics until told.

What you can now do: Write structured, investment-grade prompts using R-C-T-F-C that reliably produce
sharp, usable, guard-railed output.


> **🧠 Remember: Brief the AI like a literal new hire — Role, Context, Task, Format, Constraints — and the**

quality follows.


### 🎨 Visual — "The Anatomy of an Investment-Grade Prompt"

Create a dark-themed infographic with a navy background (#02073D). Show a single large "prompt card" in
the centre, outlined in glowing blue (#246BFD), dissected into five stacked, colour-coded bands with labels
and a one-line example each: Band 1 (purple #6A5CFF) "ROLE — 'You are a forensic accountant.'" Band 2
(blue #246BFD) "CONTEXT — '[pasted FY24 notes + verified figures].'" Band 3 (purple) "TASK — 'List the
3 biggest red flags with the line reference.'" Band 4 (pink #FF6AC1) "FORMAT — 'A table: flag | quote (<15
words) | why it matters.'" Band 5 (pink) "CONSTRAINTS — 'Use only my text. Flag uncertainty. No invented
numbers.'" To the right, two small contrasting output thumbnails: a faded grey one labelled "     ❌ One-liner →
generic, maybe fabricated," and a glowing one labelled "           ✅ R-C-T-F-C → sharp, sourced, usable." A
Lavender White (#F5ECFF) caption at the bottom: "Five parts. Ten seconds. Ten times the output." Title at
top: "The Anatomy of an Investment-Grade Prompt." Style: clean, minimal, professional financial
infographic.

What this visual shows: It turns the abstract R-C-T-F-C framework into a concrete, copyable template and
shows the payoff side-by-side, making the habit stick.


> **🧠 Remember: Five colour-coded bands — Role, Context, Task, Format, Constraints — picture the card**

and you'll never send a bare one-liner again.


### ❓ Quiz (5 Questions)


**Q1. What does the R-C-T-F-C framework stand for?**
a) Read, Compute, Test, Format, Check
- b) Role, Context, Task, Format, Constraints
- c) Request, Confirm,
Try, Fix, Close
- d) Research, Cite, Trust, Finalise, Commit


> ✅ **Answer:**
- b) 📝 Why: A strong prompt gives the AI a Role, real Context, a precise Task, a Format, and

Constraints/guardrails. Missing parts lower output quality.


**Q2. Which two parts of a prompt are most commonly missing or too thin?**
a) Role and Task
- b) Real Context and explicit Constraints (guardrails)
- c) Format and Role
- d) Task and
Format


> ✅ **Answer:**
- b) 📝 Why: People usually state a task but starve the model of the actual data and forget

guardrails like "use only my text" and "don't invent numbers."


**Q3. The master principle beneath good prompting is:**
a) Brevity above all
- b) Specificity — vague in, vague out; narrowing the target sharpens the answer
- c)
Politeness to the AI
- d) Using the longest possible prompt


> ✅ **Answer:**
- b) 📝 Why: The more precisely you define the target, the better the output. Specificity, not

length or tone, is what drives quality.


**Q4. True or False: A bare one-liner like "summarise this annual report" is a reliable way to**
get high-quality finance output.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: A contextless one-liner gives the model no role, data, format, or guardrails, so

it falls back on generic or fabricated output. Add the R-C-T-F-C parts.


**Q5. Fill in the blank: A useful way to think about writing a prompt is as a __ brief to a fast,**
literal assistant who knows nothing about your specifics until told.

> ✅ **Answer:** Delegation 📝 Why: Like briefing a new hire, a good prompt states who, what, the desired

outcome, the format, and the don'ts — producing predictably good work.


---

## Session 16.5: Advanced Prompting — Chain-of-

Thought, Few-Shot, Personas & Structured
Outputs

"Beginners ask the AI for an answer. Pros ask it to show its working, give it examples, and demand
the output in a shape they can actually use."


### 🎣 Hook — "The Techniques That Separate Amateurs from Pros"

Once R-C-T-F-C is second nature, a second tier of techniques unlocks dramatically better results — and
almost nobody outside the AI-fluent crowd uses them.

Ask the model to reason step by step and its accuracy on hard problems jumps. Give it examples of what
good looks like and it matches the pattern. Make it adopt a persona and the analysis sharpens. Demand a
structured output and you get something you can drop straight into a model or a workflow.

These aren't tricks. They're how you get expert-grade, reliable, automatable output.


> **🧠 Remember: Four advanced moves — reasoning steps, examples, personas, structured output — turn**

good prompts into expert ones.


### 🔬 Deep Dive — "The Four Power Techniques"

Learn these four and you're ahead of most professionals using AI:

Chain-of-thought ("think step by step") — instruct the model to reason through the problem before
giving the answer. For anything multi-step — a valuation walk-through, a logic check, a "what changed
and why" — this materially improves accuracy, because the model commits to a reasoning path instead
of blurting a guess.
Few-shot (show examples) — give one to three examples of the input→output you want, then your
real input. The model imitates the pattern. Brilliant for enforcing a consistent format across many
companies (e.g. "here's how I want every red-flag entry written").
Personas (assign expertise) — a precise role ("you are a short-seller looking for reasons to avoid this
stock") changes what the model surfaces. Run the same filing through a bull persona and a bear
persona to stress-test your view.
Structured outputs (force a schema) — demand the answer in a defined structure: a table with set
columns, or strict JSON with named fields. This is the bridge from "nice chat answer" to "data my
workflow can use" — essential for the automations in Part D.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Take one multi-step question and run it twice — once plainly, once with "think step by step" — and
compare accuracy and auditability.
2. Write a few-shot prompt with two examples to lock a format, then apply it to three companies and check
the consistency.
3. Run a filing through bull and bear personas and write your own one-line verdict on which case is
stronger.
4. Convert one analysis into a strict-JSON structured output and notice how it's now machine-usable.
5. Save your best version of each technique as a reusable snippet.


> ⏱️ Time saved: These techniques cut the rounds of correction and reformatting to near zero — consistent,

structured, reasoned output first time — and the structured outputs are what later let you automate whole
steps instead of copy-pasting by hand.


### ⚡ Copy-Paste Prompts


**1. The chain-of-thought prompt (for any multi-step analysis):**


Work through this step by step before giving your final answer.
Show each step of your reasoning, the numbers you use at each step, and
where each number comes from. Only after the steps, state your conclusion.
If any input number is something I should verify, flag it with                          ⚠️.
[the problem]


**2. The few-shot format-enforcer (consistent output across companies):**


```
I want every red flag written in EXACTLY this format. Examples:
- FLAG: Rising receivable days | EVIDENCE: "receivables up 40% vs sales up 12%" | RISK:
possible channel stuffing
- FLAG: Pledged promoter shares | EVIDENCE: "62% of promoter holding pledged" | RISK:
forced-sale / governance
Now apply the same format to the document below. Use only its text.
[paste]
```


**3. The dual-persona stress test (bull vs bear):**


```
Using ONLY the filing below, do two passes:
PASS 1 — Persona: optimistic growth investor. Build the strongest BULL case.
PASS 2 — Persona: sceptical short-seller. Build the strongest BEAR case.
Keep each to 5 bullets, grounded in the text, quotes under 15 words.
Do not invent figures.
[paste]
```


**4. The structured-output (JSON) prompt (for automation):**


```
Analyse the filing below and return ONLY valid JSON, no other text, with
these exact fields:
{ "company": "", "fy": "", "revenue_cr": null, "ebitda_margin_pct": null,
"top_risk": "", "auditor_flag": "", "uncertain_fields": [] }
Put any field you couldn't find or are unsure about into "uncertain_fields".
Do not guess values. Use only the provided text.
[paste]
```


> **🧠 Remember: Chain-of-thought for accuracy, few-shot for consistency, personas for perspective,**

structured outputs for automation.


### 💡 Concept — "Make the AI Show Its Working"

The most useful single upgrade is forcing the model to reason out loud before concluding.

Why it works: an LLM generates word by word, so if you let it jump straight to "the answer is X," it has to
commit before it has reasoned. Ask it to lay out the steps first and each step conditions the next — it
effectively "thinks" on the page, and the final answer is better grounded.

For you, there's a second benefit: visible reasoning is auditable. You can see where a conclusion came
from, spot the flawed step, and catch a hallucination mid-chain rather than swallowing a black-box answer.
In finance, an answer you can inspect beats a confident one you can't.


**The human edge — what stays yours**


Few-shot examples teach the model your standard of good — which means you must first know what good
looks like. Personas surface both sides, but weighing bull against bear is judgment no schema can encode.
And auditing a chain of reasoning is precisely the skill of an analyst: following the logic, finding the weak
link, refusing the tidy-but-wrong conclusion. Advanced prompting amplifies your standards and your
scrutiny; it can't supply them.


> **🧠 Remember: Make the AI show its steps — it reasons better, and you can audit exactly where it went**

wrong.


### ⚠️ Mistake — "Trusting Confident Reasoning as Proof"

A subtle trap: chain-of-thought makes answers look rigorous — neat numbered logic — and students start
trusting the conclusion because the reasoning looks tidy.

They do it because structured reasoning feels like proof.

But a model can produce flawless-looking logic built on a hallucinated premise — a made-up starting
number, a misremembered fact — and the tidy steps then carry the error confidently to a wrong conclusion.
Worse, sometimes the visible reasoning doesn't even match how it actually got the answer.

Use the reasoning to audit, not to trust. Check the premises and any numbers, not just the elegance of the
steps.


> **🧠 Remember: Tidy reasoning isn't proof — a clean chain on a false premise still ends in a wrong answer,**

so check the inputs.


### 📊 Real World — "Bull vs Bear in One Sitting"

A practical, powerful use of personas: take one company's filing and run it twice.

First as an optimist — "you are a growth investor; make the strongest bull case from this filing." Then as a
sceptic — "you are a short-seller; find every reason to avoid this stock in the same filing."

You instantly get a structured two-sided view: the bull thesis and the bear thesis, each grounded in the
same document. Your job — the human one — is to weigh them and decide which is more convincing and
why. The AI surfaced both sides fast; you make the call. This single technique forces the balanced thinking
that separates real analysts from cheerleaders.


> **🧠 Remember: Run the same filing through a bull persona and a bear persona — you get both sides fast,**

then you judge.


### 📋 Summary — "Advanced Prompting — Key Takeaways"

This session in 60 seconds:

1. Four power techniques lift you above most professional AI users: chain-of-thought, few-shot, personas,
structured outputs.
2. Chain-of-thought ("think step by step") improves accuracy on multi-step problems and makes the
reasoning auditable.
3. Few-shot (examples) enforces a consistent format; personas change what the model surfaces;
structured outputs make answers usable by workflows.
4. Visible reasoning is for auditing, not blind trust — a tidy chain on a false premise still ends wrong, so
check the inputs.
5. Running bull and bear personas on one filing forces balanced, two-sided analysis fast.

What you can now do: Apply advanced prompting techniques to get expert-grade, consistent, auditable,
and automatable output from any model.


> **🧠 Remember: Reason step by step, show examples, assign a persona, demand a schema — and audit**

the working rather than trusting it.


### 🎨 Visual — "The Four Power Techniques"

Create a dark-themed infographic with a navy background (#02073D) showing a 2×2 grid of four technique
🪜 CHAIN-OF-
cards, each with an icon, a name, and a one-line use. Top-left (glowing blue #246BFD): "
THOUGHT — 'Think step by step' → higher accuracy + auditable reasoning." Top-right (purple #6A5CFF):
"🎯 FEW-SHOT — give 1–3 examples → consistent format every time." Bottom-left (purple): "🎭
PERSONA — 'You are a short-seller' → changes what gets surfaced." Bottom-right (pink #FF6AC1): "🧱
STRUCTURED OUTPUT — force a table/JSON schema → usable by workflows." Across the bottom, a
Lavender White (#F5ECFF) banner: "Use reasoning to AUDIT, not to blindly trust." Title at top: "The Four
Power Techniques." Style: clean, minimal, professional financial infographic.

What this visual shows: It gives the student a memorable 2×2 of the advanced toolkit with the exact use-
case for each, plus the critical caveat about auditing reasoning.


> **🧠 Remember: A 2×2 — accuracy, consistency, perspective, automation — that's the advanced prompting**

toolkit at a glance.


### ❓ Quiz (5 Questions)


**Q1. What does "chain-of-thought" prompting do?**
a) Links several AI tools together
- b) Instructs the model to reason step by step before answering, improving
accuracy and making reasoning auditable
- c) Makes the AI answer faster
- d) Stores the conversation as a
chain


> ✅ **Answer:**
- b) 📝 Why: Asking the model to show its steps conditions each step on the last, improving

multi-step accuracy and letting you audit where it went wrong.


**Q2. "Few-shot" prompting means:**
a) Asking very short questions
- b) Giving the model one to three examples of the input→output you want, so
it imitates the pattern
- c) Using the AI only a few times
- d) Limiting the answer length


> ✅ **Answer:**
- b) 📝 Why: Examples teach the model your desired format and standard, producing consistent

output — especially useful across many companies.


**Q3. Why force a structured output like strict JSON?**
a) It looks more technical
- b) It turns a chat answer into data a workflow or program can use directly — the
bridge to automation
- c) JSON is more accurate than tables
- d) It makes the model reason better


> ✅ **Answer:**
- b) 📝 Why: A defined schema makes output machine-usable, which is essential when you

chain steps or automate them in Part D.


**Q4. True or False: If an AI's step-by-step reasoning looks tidy and rigorous, you can trust its**
conclusion without checking the inputs.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: A clean chain built on a hallucinated premise still ends in a wrong answer.

Use the visible reasoning to audit the premises and numbers, not as proof.


**Q5. Fill in the blank: Running one filing through a _ persona and a _ persona forces**
balanced, two-sided analysis quickly.

> ✅ **Answer:** bull / bear 📝 Why: An optimist persona and a sceptic persona surface both cases from the

same document; you then weigh which is more convincing.


---

## Session 16.6: Grounding & Guardrails — Killing

Hallucinations and Forcing Verification

"You can't stop an AI from hallucinating. But you can box it in so tightly that when it does, you catch it
every single time."


### 🎣 Hook — "The Hallucination Is a Feature, Not a Bug"

Here's the uncomfortable truth: hallucination isn't a glitch that will be patched away. It's a direct
consequence of how LLMs work — they generate plausible text, and sometimes plausible isn't true.

So the goal isn't a model that never hallucinates. The goal is a system where hallucinations can't survive
contact with your process.

You do that with two things: grounding (forcing the AI to work only from real source material) and
guardrails (instructions and checks that surface uncertainty and block fabrication).

Master this and AI becomes safe for finance — not because it stopped lying, but because you stopped it
from lying undetected.


> **🧠 Remember: You can't eliminate hallucination — you build a process that catches it every time.**


### 🔬 Deep Dive — "Grounding — Make the AI Work From Real Sources"

"Grounding" means tying the model's answer to actual source material rather than its free-floating memory.
The more grounded, the less room to fabricate.

Paste the source and restrict to it: "Answer using ONLY the text below. If it's not there, say so." This
is the single most powerful anti-hallucination move — the model can't invent what it's forbidden to go
beyond.
Use live-search tools for current facts: a citation-backed search tool grounds answers in fetched web
pages you can open and check — far safer than asking a no-web model "what's the latest."
Demand source references inline: "For each claim, point to the exact line or page it came from."
Fabricated claims have no real reference, which exposes them.
(Concept) Retrieval-Augmented Generation (RAG): advanced tools fetch relevant documents and
feed them to the model before it answers — automated grounding. You'll meet this idea again with AI
agents; for now, know that "the AI is grounded in my documents" is the safe design, and "the AI is
answering from memory" is the risky one.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Take a filing-based task and run it twice — once ungrounded ("tell me about X"), once with the
maximum-grounding lock — and note how many specifics the grounded version refuses to invent.
2. Apply the confidence-and-source guardrail to an answer and physically verify the "High confidence"
claims too (some will surprise you).
3. Set the anti-fabrication system instruction at the start of a real research chat for a day.
4. Run the "stress-test your own answer" prompt and act on its checklist.
5. Add every new guardrail you like to your Verification Checklist from Session 16.1.


> ⏱️ Time saved: Grounding and guardrails front-load the safety so you're not hunting blind for errors later.

You spend a little structuring the ask and save yourself from the catastrophic, time-and-reputation cost of a
single published fabrication.


### ⚡ Copy-Paste Prompts


**1. The maximum-grounding lock (use on any source-based task):**


```
Answer using ONLY the text I pasted below. Do not use outside knowledge.
For every claim, cite the exact line or section it came from. If something
I asked about is not in the text, reply "NOT IN PROVIDED MATERIAL" — never
fill the gap with a guess.
[paste source]
```


**2. The confidence-and-source guardrail (run on any factual answer):**


```
Re-present your last answer as a table with columns: Claim | Confidence
(High/Medium/Low) | Primary source I should check to verify.
Mark any claim you are not fully certain of as Low and explain why.
Do not invent sources.
```


**3. The anti-fabrication system instruction (set at the top of a chat):**


```
For this entire conversation, follow these rules: never invent figures,
```


⚠️
quotes, citations, or sources; if you don't know, say "unknown"; flag any
uncertain item with   ; and remind me that I must verify every number
against the primary filing. Confirm you understand before we begin.


**4. The "stress-test your own answer" prompt:**


```
Act as a sceptical fact-checker reviewing your previous answer. List every
statement that could be wrong, fabricated, or out of date, and for each,
say exactly what I should check to confirm or refute it. Be harsh.
```


> **🧠 Remember: Ground every answer in real, restricted source material — the model can't fabricate what**

it's forbidden to leave.


### 💡 Concept — "Guardrails — Engineer Uncertainty Into the Open"

The second pillar is guardrails: prompt instructions and process steps that force uncertainty and fabrication
into the light, where you can see them.

The core insight: by default a model hides its uncertainty behind confident prose. Guardrails reverse that —
they make it declare doubt.

"Flag anything you're not certain about with   ⚠️."
"If you don't know or it's not in the source, say 'unknown' — do not guess."
"Rate your confidence (high/medium/low) for each number and name the source I should check."
"Do not invent citations, figures, or quotes under any circumstances."

These don't make the model perfect. They make its weak points visible, converting a silent risk into a
flagged to-do on your verification list.


**The human edge — what stays yours**


Grounding and guardrails surface the uncertainty; only you can resolve it. The model can flag "      ⚠️
unverified," but tracing that figure to the filing, judging whether a source is credible, and deciding the claim
is safe to publish — that's irreducibly human work, and it's the work your name vouches for. AI can tell you
where it might be wrong; closing the gap, and bearing responsibility for the result, is the analyst's job and
the reason the role survives automation.


> **🧠 Remember: Guardrails force the AI to declare its uncertainty instead of hiding it — turning silent risk into**

a visible checklist.


### ⚠️ Mistake — "Verifying Selectively (or Not at All)"

The fatal habit: verifying the numbers that seem important and waving through the rest — or, under time
pressure, skipping verification entirely because the output "looked fine."

Students do it because verification is the slow, boring part and the AI's output is so fluent it feels trustworthy.

But hallucinations hide precisely in the plausible-looking details you didn't check — a slightly wrong margin,
a misattributed quote, a citation that doesn't exist. And the instant you publish one, the fact that "everything
else was right" won't save you.

The rule is total, not selective: every number, quote, and factual claim that leaves your desk has been
traced to a primary source. No exceptions, especially under deadline.


> **🧠 Remember: Selective verification is how the one wrong number gets through — verify every figure,**

quote, and claim, no exceptions.


### 📊 Real World — "The Verification Layer Is the Job"

Step back and notice what's happening across this whole module: nearly every technique ends with "…then
verify." That's not repetition for its own sake. The verification layer is the professional value an analyst adds
on top of AI.

Think of it as a factory with a quality-control station that nothing ships without passing. The AI is the fast
production line; you are QC. A line with no QC produces defects at high speed — which, in research,
means fabricated data in a published report.

Firms that adopt AI responsibly don't remove the human checker; they make the human a better, faster
checker and let AI handle the production. The analyst's seniority increasingly is judgment and verification —
the two things that don't automate.


> **🧠 Remember: AI is the production line; you are quality control — and QC is the part of the job that doesn't**

automate.


### 📋 Summary — "Grounding & Guardrails — Key Takeaways"

This session in 60 seconds:

1. Hallucination is intrinsic to how LLMs work — the goal is a process that catches it, not a model that
never does it.
2. Grounding ties answers to real source material: paste-and-restrict, live-search with citations, inline
source references, and (conceptually) RAG.
3. "Answer using only this text; if it's not here, say so" is the single most powerful anti-hallucination
instruction.
4. Guardrails force uncertainty into the open — confidence ratings,                   ⚠️ flags, "say unknown, don't guess,"
"never invent citations."
5. Verification must be total, not selective — every number, quote, and claim is traced to a primary source
before it leaves your desk.

What you can now do: Box the AI in with grounding and guardrails so hallucinations are surfaced and
caught, making AI output safe to use in finance.


> **🧠 Remember: Ground it, guard-rail it, and verify everything — that's the discipline that makes AI safe for a**

report with your name on it.


### 🎨 Visual — "The Hallucination Containment System"

Create a dark-themed infographic with a navy background (#02073D) shown as a funnel/filter system. At
the top, a glowing pink (#FF6AC1) cloud labelled "RAW AI OUTPUT — fluent, sometimes fabricated." It
passes down through three stacked filter layers: Layer 1 (glowing blue #246BFD) "GROUNDING — answer

only from provided/cited sources," Layer 2 (purple #6A5CFF) "GUARDRAILS —                             ⚠️ flags, confidence
ratings, 'say unknown'," Layer 3 (purple) "VERIFICATION — trace every number/quote to a primary
source." Below the filters, a clean glowing-green-bordered box labelled "                       ✅ SAFE TO USE — every fact
traced." Show small red 'X' particles being caught at each layer, with a caption beside them: "Hallucinations
caught here, not in your published report." A Lavender White (#F5ECFF) strip at the bottom: "You don't stop
it lying — you stop it lying undetected." Title at top: "The Hallucination Containment System." Style: clean,
minimal, professional financial infographic.

What this visual shows: It frames grounding, guardrails, and verification as a three-stage filter that catches
fabrications before they reach a report — making the safety process concrete and memorable.


> **🧠 Remember: Three filters — ground, guard-rail, verify — and the fabrications get caught on the way**

down, not in print.


### ❓ Quiz (5 Questions)


**Q1. Why won't hallucination simply be "fixed" in future models?**
a) Companies don't care about it
- b) It's an intrinsic consequence of how LLMs generate plausible text — so
the goal is a process that catches it, not a model that never does it
- c) It already has been fixed
- d) It only
affects free tools


> ✅ **Answer:**
- b) 📝 Why: Plausible-text generation inherently risks producing plausible-but-false output. The

professional fix is grounding, guardrails, and verification — a process, not a perfect model.


**Q2. What is the single most powerful anti-hallucination instruction?**
a) "Be accurate"
- b) "Answer using only the text I provided; if it's not there, say so"
- c) "Try your best"
- d) "Use
the whole internet"


> ✅ **Answer:**
- b) 📝 Why: Restricting the model to provided source material removes its room to fabricate — it

can't invent what it's forbidden to go beyond.


**Q3. What do "guardrails" do in a prompt?**
a) Make the AI answer faster
- b) Force the model to declare uncertainty (flags, confidence ratings, "say
unknown") instead of hiding it behind confident prose
- c) Block the AI from answering finance questions
- d)
Improve the formatting only


> ✅ **Answer:**
- b) 📝 Why: Guardrails surface doubt and fabrication into the open, converting silent risk into a

visible verification checklist.


**Q4. True or False: It's acceptable to verify only the numbers that look important and trust the**
rest if the output seems fine.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: Hallucinations hide in the plausible details you skip. Verification must be total

— every number, quote, and claim traced to a primary source.


**Q5. Fill in the blank: A useful way to see your role is that the AI is the production line and you**
are _ _ — the part of the job that doesn't automate.

> ✅ **Answer:** quality control 📝 Why: AI handles fast production; the human checks every output before it

ships. Judgment and verification are the enduring, non-automatable value.


---

## Session 16.7: Your Finance Prompt Library —

Reusable Templates That Compound

"Amateurs rewrite the same prompt from scratch every time. Pros build it once, perfectly, and reuse it
a thousand times. That gap, compounded over a year, is enormous."


### 🎣 Hook — "Stop Rewriting, Start Reusing"

Every week you run roughly the same analytical tasks: scan a filing for red flags, summarise a concall,
structure a comps table, draft a stock note. If you re-improvise the prompt each time, you waste effort and
get inconsistent results.

The fix is a prompt library — a saved, organised collection of your best prompts, each refined over time,
each with verification baked in.

It's the difference between a chef inventing every recipe nightly and one with a tested, written recipe book.
The library is where your prompting skill becomes a permanent, compounding asset.


> **🧠 Remember: A prompt library converts your best one-off prompts into reusable assets that compound**

every week.


### 🔬 Deep Dive — "What Belongs in a Finance Prompt Library"

Organise your library by the recurring jobs of research. A solid starter set:

Filing analysis: red-flag scanner, year-on-year "diff," auditor-note checker, contingent-liability finder.
Concall analysis: tone-and-guidance extractor, dodged-question finder, prior-call consistency checker.
Modelling support: model-skeleton builder, formula writer/explainer, integrity checker, error debugger.
Screening & ideas: theme-to-stock mapper, screen-criteria designer, screened-list synthesiser.
Valuation: scenario builder, sensitivity-table builder, reverse-DCF framer, comps-structure organiser.
Writing & output: stock-note drafter (inverted pyramid), executive-summary writer, deck-content
structurer.
Verification & safety: the maximum-grounding lock, the confidence-and-source guardrail, the "stress-
test your own answer" prompt.

Each entry should be a complete R-C-T-F-C prompt with brackets for the variables — drop in the company
and data, and run.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Create your library home — a Notion database, a doc, or a notes folder — with sections for each
research job.
2. Move in the three prompts you built in Session 16.4 and the safety prompts from 16.6, formatted as
templates with bracketed variables.
3. Use the library-builder kickstart to draft a starter set, then test each on a real company and refine before
saving — never save an untested prompt.
4. Name every prompt clearly (e.g. "Filing — Red-Flag Scan v2") so you can find it in seconds.
5. Adopt the rule: every time a prompt underperforms, refine it and save the better version.


> ⏱️ Time saved: Once built, the library turns minutes of prompt-crafting per task into seconds of paste-and-

run — across dozens of tasks a week, that's hours reclaimed, with more consistent output and a ready-
made foundation for automation.


### ⚡ Copy-Paste Prompts


**1. The "turn this into a reusable template" prompt:**


```
Here's a prompt that worked well: "[paste]". Convert it into a reusable
TEMPLATE: replace the specific company, period, and data with clearly
labelled [VARIABLES] in brackets, keep the structure and the verification
constraints, and add a one-line note on when to use it.
```


**2. The library-builder kickstart (generate your starter set):**


```
You are helping me build a finance research prompt library. For each of
these tasks, draft a reusable R-C-T-F-C template with bracketed variables
and built-in verification guardrails: (1) red-flag scan of a filing,
(2) concall tone-and-guidance extraction, (3) comps-table structuring,
(4) reverse-DCF framing, (5) 2-page stock-note draft.
Label the variables clearly. Do not include any real figures.
```


**3. The library-audit prompt (refine what you have):**


```
Here is one of my saved prompts: "[paste]". Critique it: is the role clear,
is the context slot well-defined, is the task specific, is the format
explicit, and are the verification guardrails strong enough? Suggest a
tightened version.
```


> **🧠 Remember: Organise the library by research job — filings, concalls, modelling, screening, valuation,**

writing, verification — each a ready R-C-T-F-C template.


### 💡 Concept — "Templates With Variables, Not One-Offs"

The unlock is treating each prompt as a template with variables, not a single-use message.

A good template looks like: "ROLE… CONTEXT: [paste FY__ notes for [Company]]… TASK…

```
CONSTRAINTS: use only my text, flag      ⚠️…". The bracketed parts are the only thing you change.
Analogy: it's a mail-merge for analysis. Build the structure once, swap the inputs, get consistent output
across every company you cover. Consistency is itself a feature — when every red flag is written the same
way, you can compare across companies and spot patterns.
```


This templating is also the precise foundation for automation: a parameterised prompt is something a
workflow or agent can run with different inputs automatically (Part D). Your library is the script your
automations will execute.


**The human edge — what stays yours**


A prompt library encodes your standards — what a complete red-flag scan must catch, what a concall
summary must contain, where verification is non-negotiable. Two analysts build very different libraries
because they think differently, and the better library reflects the better thinker. The tools hand everyone the
same raw capability; your library is the accumulated judgment of how you choose to wield it. That judgment
is the asset — and it's yours, not the model's.


> **🧠 Remember: Build each prompt as a template with bracketed variables — that's mail-merge for analysis,**

and the seed of automation.


### ⚠️ Mistake — "Hoarding Prompts You Never Refine or Reuse"

Two failure modes kill a prompt library: never starting one (so you re-improvise forever), or starting a messy
dumping ground you never organise, refine, or actually reuse.

Students fall into the second because saving feels like progress even without structure.

But an unorganised pile you can't search is no faster than rewriting, and a prompt you never refine stays
mediocre forever. The value comes from curation — naming prompts clearly, grouping by task, and
improving each one every time it underperforms.

A small, sharp, well-organised library beats a huge messy one every time.


> **🧠 Remember: A prompt library only pays off if you organise, refine, and actually reuse it — a messy hoard**

is no better than starting over.


### 📊 Real World — "The Library as a Personal Moat"

Two students start with the same AI tools. A year later, one has a battle-tested library of fifty refined prompts
covering every research task, each improved through dozens of real uses; the other still types from scratch.

The first is dramatically faster and more consistent — and crucially, that library is theirs. It encodes how
they think a red-flag scan should run, what they consider a complete concall summary, the standards they
hold. The tools are identical and free; the library is bespoke and earned.

This is how prompting maturity becomes a genuine personal edge in an AI-saturated world: not the tools,
but the accumulated, refined, personal system of how you direct them — and, soon, how you automate
them.


> **🧠 Remember: Your refined prompt library is a personal moat — same free tools, but a bespoke system**

only you have built.


### 📋 Summary — "Your Finance Prompt Library — Key Takeaways"

This session in 60 seconds:

1. A prompt library saves and organises your best prompts so you reuse instead of rewriting — your skill
becomes a compounding asset.
2. Organise by research job: filings, concalls, modelling, screening, valuation, writing, and
verification/safety.
3. Build each prompt as a template with bracketed variables — mail-merge for analysis, giving consistent
cross-company output.
4. The value is in curation — naming, grouping, and refining; a small sharp library beats a huge messy
one.
5. A refined personal library is a genuine moat and the exact foundation for the automations in Part D.

What you can now do: Build, organise, and continuously refine a finance prompt library that makes you
faster, more consistent, and ready to automate.


> **🧠 Remember: Build it once, refine it forever, reuse it everywhere — and it becomes the script your future**

automations run.


### 🎨 Visual — "The Compounding Prompt Library"

Create a dark-themed infographic with a navy background (#02073D). On the left, show a tidy "library shelf"
with labelled, colour-coded prompt "books" grouped into sections: a blue (#246BFD) shelf "FILINGS" (red-
flag scan, YoY diff, auditor check), a purple (#6A5CFF) shelf "CONCALLS" (tone & guidance, dodged-Q), a
purple shelf "MODELLING" (skeleton, integrity check), a pink (#FF6AC1) shelf "VALUATION" (scenarios,
reverse DCF), and a pink shelf "VERIFY" (grounding lock, confidence table). Each "book" shows a small "{
}" icon meaning "template with variables." On the right, a rising compounding curve in Lavender White
(#F5ECFF) labelled "Output per hour" climbing over "Week 1 → Week 52," with a note: "Same tools.
Refined library. Compounding edge." A caption at the bottom: "Build once. Swap the inputs. Reuse a
thousand times." Title at top: "The Compounding Prompt Library." Style: clean, minimal, professional
financial infographic.

What this visual shows: It depicts the library as an organised, reusable shelf of parameterised templates
and visualises the compounding productivity gain over a year — making the case for building one now.


> **🧠 Remember: A shelf of bracketed templates that compounds over a year — picture it filling up and paying**

off.


### ❓ Quiz (5 Questions)


**Q1. What is the core benefit of a prompt library?**
a) It makes prompts longer
- b) You reuse refined, tested prompts instead of rewriting from scratch, gaining
speed and consistency that compound over time
- c) It replaces the need to verify outputs
- d) It stores the AI's
answers


> ✅ **Answer:**
- b) 📝 Why: A library turns your best prompts into reusable assets, saving time and producing

consistent output — a compounding advantage.


**Q2. What makes a prompt a reusable "template"?**
a) It's very short
- b) Specific company, period, and data are replaced with clearly labelled bracketed
variables, keeping the structure and guardrails fixed
- c) It has no constraints
- d) It only works for one
company


> ✅ **Answer:**
- b) 📝 Why: Bracketed variables let you swap inputs and run the same structured prompt across

every company — mail-merge for analysis, and the basis for automation.


**Q3. Why is consistency across a library valuable, beyond speed?**
a) It isn't valuable
- b) When every red flag (or summary) is written the same way, you can compare across
companies and spot patterns
- c) Consistency slows you down
- d) It makes outputs harder to read


> ✅ **Answer:**
- b) 📝 Why: A consistent format makes cross-company comparison and pattern-spotting

possible, which improves the analysis itself.


**Q4. True or False: Saving lots of prompts in an unorganised pile is just as useful as a small,**
well-curated, refined library.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: An unsearchable, unrefined hoard is no faster than rewriting. The value is in

curation — naming, grouping, and continuous refinement.


**Q5. Fill in the blank: A refined personal prompt library is a personal __ — the same free tools,**
but a bespoke system only you have built.

> ✅ **Answer:** moat / edge 📝 Why: Tools are commoditised; your accumulated, refined system of directing

them is bespoke and earned — a genuine differentiator.


---

## 📑 PART C — AI ACROSS THE RESEARCH

WORKFLOW
Now you apply the foundations and prompting skills to the actual job. Part C walks the full research
workflow — reading filings and concalls, analysing data, building models, generating ideas, and running
valuations — showing exactly where AI gives genuine speed and where it must never be trusted. Every
session ends the same way it began: AI does the mechanics, you own the judgment and verify every
number.


---

## Session 16.8: AI-Powered Fundamental Research

— Annual Reports, Concalls & Filings at Speed

"A 300-page annual report takes a day to read properly. What if you could find its three buried red
flags in fifteen minutes — and still read the report?"


### 🎣 Hook — "The 300-Page Problem"

An Indian annual report can run 200–400 pages. A concall transcript is 20+ pages of dense talk. Add
quarterly results, investor presentations, and filings, and the reading is relentless.

You cover ten companies. The maths is brutal — you can't read everything deeply, every quarter.

AI changes the economics. It can surface the key points in minutes, telling you where to look.

It doesn't replace reading. It tells you which pages deserve your full, careful attention — and which you can
skim.


> **🧠 Remember: AI doesn't read the report for you — it shows you which pages to read yourself.**


### 🔬 Deep Dive — "What to Extract from a Filing with AI"

Point the AI at specific, high-value tasks — not a vague "summarise this."

Risk factors: pull the disclosed risks and rank which are material versus boilerplate.
Auditor's notes: flag any qualifications, emphases of matter, key audit matters, or related-party items.
MD&A tone: is management's commentary confident or hedging? What are they emphasising and
avoiding?
Year-on-year changes: what language or numbers shifted versus last year's report — the "diff."
Buried items: contingent liabilities, pledged shares, off-balance-sheet exposures, unusual related-party
deals.
Segment and working-capital detail: revenue mix shifts, receivable/inventory days creeping up, cash
conversion.

Each of these is a prompt in your library from Part B. You're not improvising — you're running tested,
grounded, guard-railed templates against a new document.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Pick one company you follow and download its latest annual report and concall transcript from the
investor-relations page or BSE/NSE filings.
2. Run the red-flag scan prompt on the report's notes and risk sections (paste in chunks if it's long).

3. Run the concall tone-and-guidance prompt on the transcript.
4. Take the AI's list of flags and guidance numbers, and verify each one — open the actual filing, find the
line, confirm the figure.
5. Write a 5-bullet "what actually matters" note from your verified findings.


> ⏱️ Time saved: A full first-pass read of an annual report plus concall can take 4–6 hours. AI triage plus

disciplined verification can get you to a confident first view in well under an hour — automating roughly 4
hours of reading into about 30–40 minutes of verified analysis.


### ⚡ Copy-Paste Prompts


**1. The annual-report red-flag scan:**


```
You are a forensic accountant. I'm pasting sections of [Company]'s FY24
annual report (or its key notes). Identify potential red flags: related-party
transactions, contingent liabilities, pledged promoter shares, auditor
qualifications, sudden accounting-policy changes, or aggressive revenue
recognition.
For each, quote the relevant line (under 15 words) and explain the concern
in one sentence. Use ONLY the text I provide. If you find nothing concerning
in a category, say so. Flag anything uncertain with                     ⚠️.
[paste text]
```


**2. The year-on-year "diff" prompt:**


```
You are an equity analyst. I'm pasting the risk-factors section from
[Company]'s FY23 report, then FY24.
Tell me precisely what CHANGED: new risks added, risks removed, and any
shift in tone or emphasis. Quote the changed phrases (under 15 words each).
Explain why each change might matter to an investor.
[paste FY23, then FY24]
```


**3. The concall tone-and-guidance prompt:**


```
You are an experienced buy-side analyst. Below is [Company]'s latest concall
transcript. Extract: (1) management tone — confident or hedging — with
evidence; (2) every forward-looking NUMBER given (growth %, margin target,
capex, guidance), quoted exactly; (3) any analyst question that was dodged.
Use only the transcript. I will verify every figure — do not estimate.
[paste transcript]
```


> **🧠 Remember: Aim the AI at specific high-value extractions — risks, auditor notes, tone, changes, buried**

items — using your saved templates.


### 💡 Concept — "The Diff — What Changed Since Last Year"

The sharpest analyst trick: don't just read this year's report — compare it to last year's.

A subtle change in risk-factor wording, a quietly dropped commitment, or a new "emphasis of matter" often
signals more than the headline numbers.

Analogy: it's like spotting the one edited line in a contract someone hoped you wouldn't notice.

AI is brilliant at this "diff" — feed it both years' relevant sections and ask precisely what changed in tone,
disclosure, and numbers. This is one of the highest-value, hardest-to-do-manually tasks AI unlocks.


**The human edge — what stays yours**


AI can list disclosed risks; it can't tell you which one will actually break the company — that's pattern
recognition built from experience and sector knowledge. It can summarise management's words; it can't
read the room — the hesitation in a CFO's answer, the question conspicuously not answered, the gap
between the script and reality. And it can't pick up the phone to a distributor or competitor for a channel
check. The qualitative judgment and the primary research are yours alone.


> **🧠 Remember: The signal is often in what changed year-on-year — use AI to spot the quiet edits.**


### ⚠️ Mistake — "Summarise Without Verify"

Students get a clean AI summary of a concall and treat it as the gospel record of what was said.

They do it because the summary is fast, tidy, and convincing.

But the AI may misattribute a quote, soften a warning, drop a caveat, or invent a guidance number that was
never given. A polished summary feels authoritative precisely when it's wrong.

Acting on a misremembered "management guided to 15% growth" — when they didn't — can wreck your
model and your call. The grounding and verification discipline from Session 16.6 isn't optional here; it's the
whole safeguard.


> **🧠 Remember: An AI summary is a lead, not a transcript — verify every quote and number against the**

source.


### 📊 Real World — "Reading Concalls at Indian Earnings Speed"

On a heavy results day in India, a dozen companies you track might report within hours, each with a
concall.

No human reads all of them deeply in real time. Desks that use AI to pre-digest transcripts get a first read in
minutes — tone, guidance, surprises — across every name.

The analyst then dives into the parts that matter — the margin commentary, the guidance, the awkward
analyst Q&A — and verifies the key claims before acting.

The edge isn't the summary itself; it's freeing your scarce attention for the judgment only you can apply,
across more names than you could otherwise cover.


> **🧠 Remember: On busy earnings days, AI buys back the attention you spend on judgment — that's the real**

win.


### 📋 Summary — "Fundamental Research at Speed — Key Takeaways"

This session in 60 seconds:

1. Annual reports and concalls are too long to read deeply for every name; AI triages them.
2. Aim the AI at specific extractions — risks, auditor notes, tone, year-on-year changes, buried items —
using your saved templates.
3. The "diff" against last year's report often reveals the real signal and is hard to do manually.
4. Beginners trust the AI summary; analysts verify every quote and number against the source.
5. Time saved is only an edge if you reinvest it into the judgment and coverage AI can't do.

What you can now do: Use AI to triage long filings and concalls in minutes, then focus your verified
attention on what actually moves the thesis.


> **🧠 Remember: AI compresses the reading; you still do the judging — and the verifying.**


### 🎨 Visual — "AI-Powered Filing Triage"

Create a dark-themed flow infographic with a navy background (#02073D). On the left, show a tall stack of
pages labelled "300-page annual report" in faded grey. An arrow flows into a glowing blue (#246BFD) funnel
labelled "AI first-pass extraction." Out of the funnel, show five compact output cards in purple (#6A5CFF),
each labelled: "Material risks," "Auditor flags," "MD&A tone," "Year-on-year changes," "Buried liabilities."
From those five cards, a pink (#FF6AC1) arrow points to a small human figure at a desk labelled "Analyst
reads & VERIFIES the flagged pages." Above the human, a callout in Lavender White (#F5ECFF):
"Judgment + verification = human only." At the bottom, a white caption: "AI tells you WHERE to look. You
decide what it means." Label every element in white. Title at top: "AI-Powered Filing Triage." Style: clean,
minimal, professional financial infographic.

What this visual shows: It reframes AI from "reads the report for me" to "triages the report so I read
smarter," which is the correct and safe mental model.


> **🧠 Remember: AI funnels 300 pages into five flags; you verify and judge them.**


### ❓ Quiz (5 Questions)


**Q1. What is the safest way to think about an AI summary of a 300-page annual report?**
a) A complete replacement for reading it
- b) A triage tool that tells you which sections to read and verify
yourself
- c) A guaranteed-accurate record of the report
- d) A reason to skip the report entirely


> ✅ **Answer:**
- b) 📝 Why: AI surfaces the high-value sections, but you must read and verify the flagged parts.

It directs your attention; it doesn't replace your judgment.


**Q2. Comparing this year's risk-factors section to last year's ("the diff") is valuable because:**
a) It's faster than reading either one
- b) Subtle changes in wording or dropped commitments often reveal the
real signal
- c) Risk factors never change
- d) It lets you skip the financials


> ✅ **Answer:**
- b) 📝 Why: What changed year-on-year — new risks, altered tone, quietly removed promises

— often matters more than the static disclosure.


**Q3. An AI summary says "management guided to 15% revenue growth." Before using it, you**
should:
a) Put it straight into your model
- b) Verify it against the actual transcript or filing, since AI can misattribute or
invent guidance
- c) Assume it's correct because the AI quoted it
- d) Average it with last year's growth


> ✅ **Answer:**
- b) 📝 Why: AI can fabricate or misremember a guidance number. Acting on an unverified figure

can wreck your model and your call.


**Q4. True or False: The main value of AI in fundamental research is that it lets you stop**
reading filings altogether.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: The value is compression and triage — finding what matters fast. You still

read and verify the parts that move the thesis.


**Q5. Fill in the blank: To get the most from AI's time savings, you should __ the saved hours**
into deeper analysis or wider coverage, rather than simply doing less work.

> ✅ **Answer:** Reinvest 📝 Why: Time saved becomes an edge only when redeployed into judgment, channel

checks, or covering more names.


---

## Session 16.9: AI for Data Analysis —

Spreadsheets, Charts & the Code Interpreter

"Never trust a language model's mental arithmetic. But give that same model a code tool, and it
becomes a tireless data analyst that actually computes — and shows its work."


### 🎣 Hook — "The Model That Can't Add — Until It Can"


```
Here's a quirk that trips people up: a plain LLM is genuinely bad at exact arithmetic. Ask it to total a column
of fifteen numbers and it might be off — because it's predicting the answer, not calculating it.
```


So why does everyone say AI is great with data? Because modern tools bolt a code interpreter onto the
model. Now, instead of guessing, the AI writes and runs real code (usually Python) to compute the answer
precisely — and shows you the code.

This is a different, far safer mode: the model reasons about what to compute; actual code does the
computing. Understanding this distinction is the key to using AI on numbers safely.


> **🧠 Remember: A bare LLM guesses at maths; a code-interpreter tool writes real code that actually**

computes — use the latter for numbers.


### 🔬 Deep Dive — "What AI Data Tools Can Actually Do"

Tools like the data-analysis/code-interpreter modes inside the chat assistants, or standalone tools like
Julius, let you upload a spreadsheet or CSV and work with it conversationally. Done well, they can:

Compute ratios and growth rates precisely from your uploaded financials — revenue CAGR,
margins, ROE, debt/equity, working-capital days.
Chart trends — revenue growth, margin trajectory, leverage over time — in seconds, for quick visual
reads.
Clean and reshape messy data — fix inconsistent formats, pivot, merge, filter.
Spot outliers and changes — "flag the biggest year-on-year move in each line."
Run quick statistical checks — correlations, simple comparisons across a peer set.
Show the code — so you can verify the computation and reuse it.

The mode matters: ask it to "calculate," and a good tool runs code. If you're ever unsure, ask "did you
compute this with code or estimate it?" — and prefer the computed answer.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Build a small, verified spreadsheet of one company's 5-year financials from its filings.

2. Upload it to an AI data tool and run the standard-chart-pack prompt, insisting on code-computed results.
3. Run the data-sanity check first and confirm the tool read your columns and units correctly.
4. Hand-check two of the computed figures against your source spreadsheet.
5. Read the charts and write three observations (e.g. "margins compressing since FY22") — the
interpretation is your job.


> ⏱️ Time saved: Computing ratios and building a clean chart pack by hand in Excel can take an hour or

more. An AI data tool does it in minutes — freeing you to interpret the trends and stress-test the story, which
is the actual analysis.


### ⚡ Copy-Paste Prompts

⚠️ Upload only verified data (pulled from filings). Ask the tool to compute with code, and spot-check
key outputs by hand.


**1. The standard financial chart pack:**


```
I'm uploading [Company]'s last 5 years of financials (verified from filings).
Using code, compute and chart: revenue growth %, EBITDA margin, ROE,
debt/equity, and receivable days for each year. Flag the single biggest
year-on-year change in any metric. Show the code you used. Use only the
data in the file — do not fill any gaps with outside numbers.
```


**2. The "compute, don't estimate" enforcer:**


```
For every number you give me, use code to calculate it from the uploaded
data — do not estimate or recall from memory. After each result, state
which rows/columns of my file you used. If a value can't be computed from
the file, say so.
```


**3. The data-sanity check:**


Before computing anything, describe how you've interpreted my uploaded file:
what each column is, the units, and the time periods. Point out anything
ambiguous or that looks like a formatting issue, so I can confirm you've
read it correctly.


**4. The peer-comparison table:**


```
I'm uploading verified key metrics for [Company] and its peers. Using code,
build a comparison table (P/E, EV/EBITDA, ROE, growth), compute the peer
median for each, and flag which names look cheap or expensive versus the
median. Use only the uploaded figures.
```


> **🧠 Remember: AI data tools compute ratios, chart trends, clean data, and flag outliers from your file — and**

they show the code so you can check.


### 💡 Concept — "You Bring the Verified Data; AI Does the Computation"

The safe division of labour mirrors the modelling rule from Part C: you supply verified inputs; the AI handles
the mechanical computation and visualisation.

The data you upload must itself be verified — pulled from filings, not invented by an AI. Garbage in is still
garbage out, even when real code does the maths.

Analogy: a calculator is only as good as the numbers you key in. The code interpreter is a brilliant
calculator-plus-chart-maker, but it can't know your revenue figure is wrong if you typed it wrong. So the
verification moves upstream — to the data you feed it — and you still sanity-check the outputs.


**The human edge — what stays yours**


The code computes; you decide what's worth computing and what the result means. A chart showing
margins falling is data; understanding why — input-cost inflation, a price war, a mix shift — and whether it
threatens the thesis is analysis. The tool can plot a thousand metrics flawlessly and still tell you nothing
about which one matters. Supplying verified data, choosing the right questions, and reading the story in the
numbers is the human contribution — and the source of any edge.


> **🧠 Remember: Upload verified data, let AI compute and chart it — the computation is reliable only if the**

inputs were checked first.


### ⚠️ Mistake — "Trusting Charts Built on Unverified or Misread Data"

Two traps here. First: uploading numbers you grabbed from an unreliable source (or worse, asked another
AI to generate) and treating the resulting clean charts as authoritative. Second: assuming the AI read your
messy spreadsheet correctly — wrong column, merged header, units mixed up — and trusting a beautifully
plotted but wrong chart.

Students fall for both because polished output looks trustworthy, and charts feel objective.

But a chart is only as good as the data and the AI's reading of it. A pristine revenue-growth chart built on a
misread column is confidently wrong.

The fix: verify the source data, confirm the AI understood the structure (spot-check a couple of computed
values by hand), and never let presentation polish substitute for checking.


> **🧠 Remember: A clean chart can be confidently wrong — verify the underlying data and spot-check that the**

AI read it correctly.


### 📊 Real World — "From Raw Financials to a Visual Story in Minutes"

A common real workflow: an analyst pulls five years of verified financials for a company into a spreadsheet
from its filings, uploads it to an AI data tool, and asks for the standard pack — revenue growth, EBITDA
margin trend, ROE, leverage, working-capital days — as charts, with the single biggest year-on-year
change flagged.

What once meant an hour of careful Excel work becomes a few minutes of conversation. The analyst then
reads the charts — spotting the margin compression, the rising receivable days — and forms a view, after
spot-checking a couple of the computed numbers against the source.

The tool did the plotting; the analyst supplied verified data and did the interpreting. That's the pattern for
every numbers task with AI.


> **🧠 Remember: Verified financials in → instant standard chart pack out → you interpret and spot-check.**

Minutes, not an hour.


### 📋 Summary — "AI for Data Analysis — Key Takeaways"

This session in 60 seconds:

1. A bare LLM guesses at arithmetic; a code-interpreter tool writes and runs real code to compute
precisely — use the latter for numbers.
2. AI data tools compute ratios, chart trends, clean messy data, flag outliers, and show the code so you
can verify.
3. The safe split: you upload verified data; AI does the computation and visualisation; you interpret and
spot-check.
4. A polished chart can be confidently wrong — verify the source data and confirm the AI read the
structure correctly.
5. Verified financials in → standard chart pack out in minutes → your interpretation and a couple of hand-
checks.

What you can now do: Use AI data tools to compute ratios and build charts from verified financials fast —
while keeping the data and the interpretation firmly in your hands.


> **🧠 Remember: Let code do the maths and the charts; you supply verified data and read what it means.**


### 🎨 Visual — "Guesser vs Calculator — The Code Interpreter"

Create a dark-themed two-panel infographic with a navy background (#02073D). Left panel (faded, pink
#FF6AC1 warning border), "        ❌ BARE LLM": a model icon with a thought bubble showing "Σ = ~probably
1,240?" and a label "Predicts the number — can be wrong." Right panel (glowing, blue #246BFD
border), "       ✅ CODE INTERPRETER": the same model icon, but feeding a small code block (purple

#6A5CFF) labelled "writes & runs real Python," which outputs an exact figure "Σ = 1,238.0" and a small line
chart. Label: "Computes the number — and shows the code." Between the panels, an upload icon with a
Lavender White (#F5ECFF) note: "You upload VERIFIED data." Across the bottom, a caption: "Reason
about what to compute (AI) + actually compute it (code) = safe numbers." Title at top: "Guesser vs
Calculator — The Code Interpreter." Style: clean, minimal, professional financial infographic.

What this visual shows: It crisply contrasts the unsafe "model guesses the maths" mode with the safe
"model runs real code" mode, and reminds the student that verified input data is still their responsibility.


> **🧠 Remember: Guesser on the left, real-code calculator on the right — always work in the right-hand mode**

for numbers.


### ❓ Quiz (5 Questions)


**Q1. Why is a plain LLM (no code tool) unreliable for exact arithmetic?**
a) It refuses to do maths
- b) It predicts a plausible answer rather than calculating, so it can be wrong
- c) It's
always perfectly accurate
- d) It only does maths in other languages


> ✅ **Answer:**
- b) 📝 Why: A bare LLM generates the most likely answer token by token rather than computing

— so exact arithmetic can be off. A code interpreter fixes this by running real code.


**Q2. What does a "code interpreter" mode do differently?**
a) It makes the AI talk faster
- b) The model writes and runs actual code (e.g. Python) to compute results
precisely, and can show the code
- c) It searches the web
- d) It only formats text


> ✅ **Answer:**
- b) 📝 Why: Instead of guessing, the model produces real code that calculates exactly — a far

safer mode for numbers, and one you can verify via the shown code.


**Q3. Whose responsibility is the accuracy of the data you upload to an AI data tool?**
a) The AI's — it checks your data for you
- b) Yours — you must upload verified data, because garbage in is
still garbage out even with real code
- c) Nobody's — charts are always right
- d) The tool vendor's


> ✅ **Answer:**
- b) 📝 Why: The computation is only as good as the inputs. Verified data is your job; the tool just

computes and charts it.


**Q4. True or False: A clean, professional-looking chart from an AI tool can be trusted without**
checking the underlying data or how the AI read it.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: A polished chart built on a misread column or unverified numbers is

confidently wrong. Verify the data and spot-check that the AI interpreted the file correctly.


**Q5. Fill in the blank: With AI data tools, verification moves __ — to the data you feed in —**
and you still sanity-check the outputs.

> ✅ **Answer:** upstream 📝 Why: Because real code does the maths reliably, the main risk shifts to input

quality. Verify the source data first, then spot-check results.


---

## Session 16.10: Your AI Financial Modelling

Assistant — 3-Statement Models Done Right

"AI can build you a three-statement model in two minutes. It can also build you a beautifully formatted
model where the balance sheet doesn't balance. Guess which one ends careers."


### 🎣 Hook — "The Model That Looks Perfect and Is Wrong"

AI can generate a financial model fast — formulas, formatting, the lot.

Here's the danger: it can produce something that looks immaculate but is built on a broken link or a
hallucinated assumption.

A model is a chain of dependencies. One wrong link and every output downstream is wrong — silently.

The speed is real. So is the risk. The analyst's job is to be the auditor of the machine.


> **🧠 Remember: AI builds models fast, but a polished model can still be silently broken — you must audit it.**


### 🔬 Deep Dive — "What AI Can and Can't Do in a Model"

Be precise about where AI helps and where it must not be trusted.

Great at: writing formulas, structuring tabs, explaining functions, debugging an error message.
Great at: generating boilerplate — a model skeleton, a schedule layout, a standard linkage structure.
Useful for: sanity-checking your logic if you describe it clearly, and explaining why something broke.
Dangerous for: supplying the actual historical numbers (verify these from filings, per Session 16.9).
Dangerous for: setting the assumptions — growth, margins, capital — that's your judgment, not the
AI's.

The pattern is identical to the data session: AI handles mechanics and structure; you own the inputs, the
assumptions, and the integrity.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Gather verified historical financials for one company (3–5 years) from its filings — not from AI.
2. Use the model-skeleton prompt to lay out the structure and the linkages.
3. Input your verified historicals and set your own assumptions for the forecast.
4. Run the integrity-check prompt on your totals until the balance sheet balances and cash ties every year.
5. Use the error-debugger prompt on any break, fix it yourself, and re-run the integrity check before
trusting any output.


> ⏱️ Time saved: Laying out a clean model structure and chasing a stubborn linkage error can eat hours. AI

compresses the scaffolding and the debugging — so your time goes to choosing and defending
assumptions, which is the real modelling skill.


### ⚡ Copy-Paste Prompts

⚠️ For all of these, you supply the verified numbers and assumptions. The AI structures and
computes; you check that it balances.


**1. The model-skeleton prompt:**


```
You are a financial modelling expert. Build the STRUCTURE of a 3-statement
model for [Company] in a clear layout I can replicate in Excel.
Lay out the income statement, balance sheet, and cash flow statement line
items, and show how they should link (e.g. net income → retained earnings →
cash flow).
Do NOT invent any numbers — use placeholders like [INPUT] where my verified
data goes. List the assumptions I will need to provide.
```


**2. The formula-writer prompt:**


```
You are an Excel expert. I need a formula that [describe exactly what you want,
e.g. "calculates the closing debt balance given opening debt, new borrowing,
and repayment, across columns C to G"].
Give me the exact formula, explain what each part does in plain English,
and tell me the most common mistake people make with it.
```


**3. The integrity-check prompt:**


```
You are a model auditor. Here are my three statements' totals for each year:
[paste your assets, liabilities+equity, and the cash figures from both
the balance sheet and cash flow statement]
For each year, check: (1) do assets equal liabilities plus equity?
(2) does balance-sheet cash equal cash-flow closing cash?
List any year that fails and the size of the gap. Do not assume — only
use the numbers I gave you.
```


**4. The error-debugger prompt:**


I'm getting a [#REF! / circular reference / #VALUE!] error in my model.
Here's the formula and what I'm trying to do: [paste].
Explain the likely cause and how to fix it, step by step.


> **🧠 Remember: Trust AI for structure, formulas, and debugging; never for the historical data or the**

assumptions.


### 💡 Concept — "AI as Co-Pilot, You as Pilot"

The right relationship: AI flies the routine stretches; you command the aircraft.

It can draft the model, write the formulas, and catch a circular reference. You input the verified data, set the
assumptions, and own every output.

Analogy: a co-pilot handles the controls competently, but the captain is responsible for the plane and makes
the calls that matter.

Never let the co-pilot land the plane unsupervised — and never publish a number from a model you couldn't
defend yourself.


**The human edge — what stays yours**


Setting the assumptions is forming a view of the future, and a view is an argument only a human can make
and defend. AI averages what has been; an analyst projects what will be, and stakes their name on it. The
integrity check, too, is yours — a model that doesn't balance is wrong no matter how confidently the AI built
it, and catching that is judgment plus rigour. AI builds the machine; deciding what future it should model,
and guaranteeing it actually works, is the job.


> **🧠 Remember: AI co-pilots the build; you pilot the assumptions, the data, and the accountability.**


### ⚠️ Mistake — "Letting AI Set the Assumptions"

Students ask the AI "what growth rate should I use for this company?" and just take its answer.

They do it because picking assumptions is the hard, scary part — and offloading it feels like relief.

But the assumptions are the analysis. The whole value of a model is your defensible view on growth,
margins, and capital.

Hand that to the AI and you've outsourced your thesis to a tool that's averaging the past — and you'll
crumble the moment an interviewer (or your PM) asks "why 15%?" The AI can help you pressure-test an
assumption you chose; it must not choose it for you.


> **🧠 Remember: The assumptions are your thesis — never let AI choose them, or you've outsourced your**

judgment.


### 📊 Real World — "AI-Assisted Modelling in Practice"

Analysts and finance students increasingly use AI to accelerate model-building — and some build their own
tools on top of AI APIs to do it (you'll see how in Session 16.16).

A well-designed assistant might take verified inputs and a set of assumptions, then draft a structured three-
statement model or a schedule.

But the credible ones always keep a human in the loop: the analyst supplies and checks the data, sets the
assumptions, and validates that the three statements actually tie together.

The tool speeds the mechanics; the analyst guarantees the integrity. A fast model that doesn't balance isn't
faster — it's a liability produced quickly.


> **🧠 Remember: AI can draft the model mechanics, but a human must guarantee the data, assumptions, and**

that it all ties.


### 📋 Summary — "AI Financial Model Assistant — Key Takeaways"

This session in 60 seconds:

1. AI builds models fast but can produce polished, silently broken ones — you must audit.
2. Trust AI for structure, formulas, and debugging; never for historical data or assumptions.
3. AI co-pilots; you pilot — you own the data, the assumptions, and the outputs.
4. Beginners let AI set the assumptions; analysts know the assumptions are the thesis.
5. Always run the integrity check first — the balance sheet must balance and cash must tie before any
output is trusted.

What you can now do: Use AI to accelerate model construction and debugging while personally owning the
verified data, assumptions, and integrity checks that make a model trustworthy.


> **🧠 Remember: Let AI build the engine, but you check that it runs — and you decide where it drives.**


### 🎨 Visual — "Co-Pilot, Not Autopilot — The AI Modelling Split"

Create a dark-themed two-zone infographic with a navy background (#02073D), divided by a vertical line
into "   🤖 AI DOES" and "🧑 YOU DO." Left zone (glowing blue #246BFD), "AI DOES": four cards —
"Write the formulas," "Structure the tabs & schedules," "Debug errors (#REF!, circular refs)," "Generate the
model skeleton." Right zone (pink #FF6AC1), "YOU DO": four cards — "Input VERIFIED historical data,"
"Set the assumptions (your thesis)," "Run the integrity check (does it balance?)," "Own every output & the
recommendation." At the bottom spanning both, a purple (#6A5CFF) banner with a small airplane icon: "AI
is the co-pilot. You are the captain." Label every card in Lavender White (#F5ECFF) / white text. Title at top:
"Co-Pilot, Not Autopilot." Style: clean, minimal, professional financial infographic.

What this visual shows: It draws a hard line between the mechanical work (safe to delegate) and the
judgment work (never delegate), which is the exact discipline that keeps AI-assisted models trustworthy.


> **🧠 Remember: Two columns — AI builds; you decide, verify, and own.**


### ❓ Quiz (5 Questions)


**Q1. What should you never delegate to AI when building a model?**
a) Writing formulas
- b) Setting the assumptions and supplying the historical data — and owning the integrity
check
- c) Structuring the tabs
- d) Debugging an error message


> ✅ **Answer:**
- b) 📝 Why: Assumptions are your thesis and historical data must be verified from filings. AI can

do mechanics; judgment and verified inputs are yours.


**Q2. An AI-built model looks immaculate but the balance sheet is off by ₹2. What does this**
mean?
a) It's close enough to use
- b) The model is wrong — a link, sign, or figure is broken — and no output can be
trusted until it's fixed
- c) The AI rounded; ignore it
- d) Balance sheets never balance exactly


> ✅ **Answer:**
- b) 📝 Why: A balance sheet that doesn't balance signals a broken model, and every

downstream number is suspect. Fix it before trusting anything.


**Q3. The "co-pilot, not autopilot" framing means:**
a) AI flies the plane alone
- b) AI handles the routine mechanics while you, the captain, set assumptions,
verify data, and own every output
- c) You do everything manually
- d) The co-pilot makes the final call


> ✅ **Answer:**
- b) 📝 Why: AI accelerates the build; the human owns the assumptions, the data, the integrity,

and the accountability.


**Q4. True or False: It's fine to ask AI "what growth rate should I use?" and just adopt its**
number in your model.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: The growth assumption is your thesis — you must choose and defend it. AI

can pressure-test an assumption you picked, not pick it for you.


**Q5. Fill in the blank: A trustworthy model must tie — total assets equal liabilities plus equity,**
and the balance-sheet cash equals the closing cash on the _ _ statement.

> ✅ **Answer:** cash flow 📝 Why: The closing cash on the cash flow statement must match the cash line on

the balance sheet, or the model is broken.


---

## Session 16.11: Sector Screening & Idea

Generation at Scale Using AI

"There are 5,000+ listed companies in India. You can analyse maybe 30 deeply. AI's first job isn't to
analyse them — it's to help you decide which 30 are worth your time."


### 🎣 Hook — "The Funnel Problem"

The market has thousands of stocks. Your attention fits a few dozen. That gap is the analyst's first real
problem.

Most students skip straight to deep analysis on whatever name is in the news. That's not idea generation —
it's chasing headlines.

Real idea generation is a funnel: start wide with the whole universe, narrow ruthlessly to a shortlist.

AI helps you widen the top of the funnel and narrow it faster — so your deep work lands on the right names.


> **🧠 Remember: Idea generation is a funnel — AI widens the top and speeds the narrowing so you analyse**

the right few.


### 🔬 Deep Dive — "How AI Fits Into Screening"

Be honest about the division of labour — quantitative screening and AI play different roles.

Hard numerical screens (ROE > 15%, debt/equity < 0.5) are best done in a proper screener like
screener.in — not invented by an LLM.
AI's role is the qualitative layer: themes, narratives, "which companies benefit from X trend."
AI helps frame the screen — turning a fuzzy idea ("rural recovery plays") into concrete, screenable
criteria.
AI helps synthesise — taking a screened list and clustering it by business model or theme.
AI never supplies the live financial data for the screen — that comes from a real data source you can
verify.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Pick a macro theme you find interesting and run the theme-to-stock mapping prompt to generate
candidate categories and names.
2. Use the screen-design prompt to convert one idea into concrete criteria.
3. Apply those criteria on a real screener (screener.in) to get an actual, current list.
4. Paste that screened list into the list-synthesis prompt to cluster and prioritise.

5. Choose 2–3 names for a proper deep dive — and verify their live fundamentals before any further work.


> ⏱️ Time saved: Going from a vague theme to a structured, prioritised shortlist can take a day of manual

brainstorming and sorting. AI can compress the framing and clustering to under an hour — leaving the
deep, verified analysis where it belongs: with you.


### ⚡ Copy-Paste Prompts

⚠️ AI is brainstorming candidates here, not giving verified buy lists. Validate every name with live
data.


**1. The theme-to-stock mapping prompt:**


```
You are an Indian equity strategist. The theme I'm exploring is [e.g.
"premiumisation of Indian consumption"].
Brainstorm the categories and types of listed Indian companies that could
benefit across the value chain (e.g. makers, suppliers, retailers).
For each, explain the link to the theme in one line.
These are CANDIDATES for me to research — do not claim they are good buys,
and flag that I must verify current fundamentals and valuation myself.
```


**2. The screen-design prompt:**


```
You are a value investor. I want to find [describe your idea, e.g.
"high-quality, low-debt Indian companies growing steadily"].
Translate this into concrete, screenable criteria I can apply on screener.in
(specific ratios and thresholds, e.g. ROE, debt/equity, sales growth,
interest coverage). Explain why each criterion fits the idea.
```


**3. The list-synthesis prompt:**


```
You are an equity analyst. Here is a list of companies that passed my screen:
[paste the names and a few key metrics]
Cluster them by business model or sub-theme, and tell me which 3–4 are most
worth a deep dive and why, based only on the info I've given.
Note what additional data I'd need to confirm each.
```


> **🧠 Remember: Use a real screener for the numbers; use AI for the themes, framing, and synthesis around**

them.


### 💡 Concept — "Top-Down vs Bottom-Up Idea Generation"

Two routes to a stock idea, and AI assists both.

Top-down: start with a macro theme ("electrification," "premiumisation," "China+1 manufacturing") and find
the companies that ride it. AI is great at mapping a theme to candidate names across the value chain.

Bottom-up: start with a screen for cheap, high-quality businesses and investigate them one by one.

Analogy: top-down is picking the fastest-growing neighbourhood, then the house; bottom-up is finding the
underpriced house anywhere in the city.

AI can brainstorm the theme and help you reason through the screen — but in both cases the live data and
the final call are yours.


**The human edge — what stays yours**


AI gives you the consensus map of a theme — and consensus, by definition, has no edge. The
differentiated idea — the beneficiary nobody's connected to the theme yet, the quality business the screen
missed, the contrarian read — comes from your own thinking, your channel checks, and your synthesis of
things that aren't in any training set. AI is superb at telling you what everyone would think of; your value is
seeing what they wouldn't.


> **🧠 Remember: Top-down starts with a theme, bottom-up with a screen — AI assists both routes to an idea.**


### ⚠️ Mistake — "Letting AI Pick Your Stocks"

The trap: "AI, give me the 5 best stocks to buy in India right now." Then treating the list as gospel.

Students do it because it feels like a shortcut to alpha.

But that list is built from stale training data and consensus narratives — it has no current prices, no live
fundamentals, and no edge. It may even include companies that have since changed completely or de-
listed.

Acting on an AI's stock tips is outsourcing your judgment to a tool that is, by design, average and out-of-
date.


> **🧠 Remember: AI's "best stocks" list is stale consensus — use AI to generate candidates to research,**

never to pick.


### 📊 Real World — "Theme-to-Stock Mapping in Indian Markets"

When a macro theme takes hold in India — say, manufacturing-led capex, or premium consumption —
analysts race to map it to listed beneficiaries across the value chain.

AI can accelerate that mapping: name the theme, and it brainstorms the suppliers, manufacturers, and
adjacent players who might benefit.

The analyst then validates each candidate against live data and a real thesis — many "obvious"
beneficiaries don't survive scrutiny, and the best idea is often a non-obvious name the consensus map
missed.

The AI widens the idea net; the analyst hauls in only the names that hold up.


> **🧠 Remember: AI brainstorms the beneficiaries of a theme; you validate which ones actually have an edge.**


### 📋 Summary — "Sector Screening & Idea Generation — Key Takeaways"

This session in 60 seconds:

1. Idea generation is a funnel from a huge universe down to a few conviction names.
2. Use a real screener for hard numbers; use AI for themes, framing, and synthesis.
3. Top-down (theme-first) and bottom-up (screen-first) both work — AI assists each.
4. Beginners let AI pick stocks; analysts use AI to generate candidates, then validate with live data.
5. The funnel's power is rejection — narrowing fast, and finding the non-obvious name, is the real skill.

What you can now do: Use AI to widen and structure your idea funnel — mapping themes and clustering
screens — while keeping stock selection grounded in live data and your own judgment.


> **🧠 Remember: AI fills the top of the funnel with candidates; you do the narrowing and the choosing.**


### 🎨 Visual — "The AI-Assisted Idea Funnel"

Create a dark-themed funnel infographic with a navy background (#02073D). Show a large vertical funnel
narrowing top to bottom, with five labelled bands and a shrinking count on the right. Top (widest, faded
grey): "UNIVERSE — 5,000+ listed companies." Band 2 (glowing blue #246BFD): "QUANT SCREEN —
real screener (ROE, debt, growth) → ~50." Band 3 (purple #6A5CFF): "AI / QUALITATIVE FILTER —
cluster by theme → ~10." Band 4 (purple): "DEEP DIVE — you analyse each → ~3." Bottom (narrowest,
pink #FF6AC1): "CONVICTION IDEAS — what you'd pitch → 1–2." To the left, small icons: a database for
the screen, a brain for AI, a magnifying glass for the deep dive. A Lavender White (#F5ECFF) caption at the
bottom: "The skill is what you reject. AI fills the top; you do the narrowing." Label every band clearly. Title at
top: "The AI-Assisted Idea Funnel." Style: clean, minimal, professional financial infographic.

What this visual shows: It makes idea generation a disciplined, narrowing process rather than headline-
chasing, and shows exactly where AI helps (widening, clustering) versus where you decide.


> **🧠 Remember: Five narrowing bands from universe to conviction — AI at the top, judgment at the bottom.**


### ❓ Quiz (5 Questions)


**Q1. What is the appropriate role of AI in stock screening?**
a) Generating the live financial data for the screen
- b) Helping frame the idea into criteria and clustering the
results qualitatively
- c) Picking the final stocks to buy
- d) Replacing a proper screener entirely


> ✅ **Answer:**
- b) 📝 Why: AI helps with the qualitative and framing work. Hard, current numbers must come

from a real screener, and selection stays with you.


**Q2. Why is "AI, give me the 5 best Indian stocks to buy now" a flawed request?**
a) AI isn't allowed to discuss stocks
- b) The answer is built on stale training data and consensus, with no live
prices or fundamentals and no edge
- c) Five is too few
- d) It would be perfectly reliable


> ✅ **Answer:**
- b) 📝 Why: Such a list is out-of-date and average by design. Use AI to generate candidates to

research, never as a verified buy list.


**Q3. Top-down idea generation means:**
a) Screening for cheap stocks first, then investigating
- b) Starting with a macro theme and finding the
companies that benefit
- c) Only buying large-cap stocks
- d) Letting AI choose your portfolio


> ✅ **Answer:**
- b) 📝 Why: Top-down begins with a theme and maps it to beneficiaries. Bottom-up begins with

a screen for individual businesses.


**Q4. True or False: The main skill in idea generation is finding as many stocks to buy as**
possible.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: The skill is rejection — narrowing a huge universe to a few conviction names,

including the non-obvious ones. A funnel that never narrows leads to drowning.


**Q5. Fill in the blank: AI excels at giving you the __ view of a theme, which means the**
differentiated, edge-bearing idea must come from your own thinking.

> ✅ **Answer:** consensus 📝 Why: AI reflects what everyone would think of. The variant idea — your edge —

has to come from you, not the model.


---

## Session 16.12: Valuation Automation — DCF,

Comps & Scenario Analysis with AI

"AI can run a thousand DCF scenarios in a second. But if your single base-case assumption is wrong,
you've just automated being confidently wrong a thousand times."


### 🎣 Hook — "Automating the Wrong Answer"

AI and modern tools make valuation mechanics trivially fast — DCFs, comps, a hundred scenarios in
moments.

Here's the trap that catches the over-eager: speed multiplies whatever you put in.

If your core assumption — the growth rate, the margin, the discount rate — is off, automation just spreads
that error across every scenario.

A valuation is only as good as its assumptions. AI makes the maths instant; it doesn't make the
assumptions right.


> **🧠 Remember: Automation multiplies your assumptions — get the inputs wrong and you've scaled the**

error, not solved it.


### 🔬 Deep Dive — "Where AI Genuinely Speeds Valuation"

Used well, AI removes the drudgery from valuation. Aim it here.

Scenario generation: instantly build bull, base, and bear cases from your assumptions and ranges.
Sensitivity tables: show how value changes as growth or WACC moves — the grid that beats a single
number.
Comps gathering structure: organise peer multiples into a clean table (you verify the figures, the AI
structures).
Sanity narration: explain why a value changed when you tweak an input — useful for pressure-testing.
Reverse DCF framing: work out what growth the current price is implying, so the market states your
thesis.

Combine this with the data tool from Session 16.9 (real computation) and your modelling discipline from
16.10 (verified inputs, integrity), and valuation becomes fast and safe.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Take a company you've modelled (with verified historicals) and your own base-case assumptions.
2. Run the scenario-builder prompt to generate bull/base/bear cases from your ranges.

3. Run the sensitivity-table prompt (computed with code) to see how terminal value swings with g and
WACC.
4. Run the reverse-DCF prompt to see what growth the current price implies — and judge if it's realistic.
5. Write your conclusion as a range with a base case, plus one line on which scenario you find most likely
and why.


> ⏱️ Time saved: Manually building three scenarios and a sensitivity grid in Excel can eat an afternoon. AI

can produce the structure in minutes — so you spend your time judging which scenario is realistic, which is
the actual analysis.


### ⚡ Copy-Paste Prompts

⚠️ You supply and verify the assumptions and the historical FCF. AI computes and explains; you
judge. Use a code/data tool for the actual maths.


**1. The scenario-builder prompt:**


```
You are a valuation analyst. Using these base-case assumptions for [Company]:
[list your verified FCF, growth rate, WACC, terminal growth]
Build three scenarios — bull, base, bear — by adjusting growth and margin
assumptions to reasonable high/low ends I specify: [give your ranges].
Show the resulting valuation for each and explain in one line what drives
the difference. Use ONLY my inputs; do not invent numbers.
```


**2. The sensitivity-table prompt:**


```
You are a valuation analyst. For a DCF with final-year FCF of [X],
build a sensitivity table of terminal value (Gordon Growth) across:
terminal growth g from [3%] to [5%] in 0.5% steps, and
WACC from [9%] to [11%] in 0.5% steps.
Compute with code, show the grid, and point out how sensitive the value is
to small changes. Use the formula TV = FCF × (1+g) / (WACC − g).
```


**3. The reverse-DCF framing prompt:**


```
You are a valuation analyst. [Company] currently trades at [price], with
[shares outstanding] and current free cash flow of roughly [verified FCF].
Assuming a WACC of [X], roughly what perpetual growth rate would the market
be implying at this price? Walk through the logic step by step.
Then tell me: is that implied growth realistic for this kind of business?
Note your assumptions and that I should verify the inputs.
```


**4. The comps-structure prompt:**


```
You are an equity analyst. Organise these peer companies and their multiples
into a clean comparison table (P/E, EV/EBITDA, P/B, growth, ROE):
[paste the verified figures you gathered]
Compute the peer median for each multiple and flag which company looks
cheap or expensive versus peers, and why. Use only the figures I provide.
```


> **🧠 Remember: AI shines at scenarios, sensitivities, comps structure, and reverse-DCF framing — the**

mechanics, not the judgment.


### 💡 Concept — "The Reverse DCF — Let the Price Talk"

A powerful, underused move: instead of computing a value, ask what the current price already assumes.

If a stock trades at today's price, what growth rate must the market be baking in? AI can help you solve for
it.

Analogy: instead of guessing a fair price for a cricketer, you ask "what performance does his current auction
price imply?" — then judge if that's realistic.

If the implied growth is absurd — wildly high or implausibly low — you have your thesis, long or short,
without forecasting a single number yourself. It reframes valuation from "what's it worth?" to "what would
have to be true?"


**The human edge — what stays yours**


A valuation is an argument about the future dressed up in numbers — and the argument is yours, not the
model's. AI can compute infinite scenarios, but choosing which assumptions are reasonable, and which
scenario is most likely, requires understanding the business, the industry, and the cycle. It also takes
judgment to resist false precision and present an honest range. The maths is automatable; the conviction —
and the humility — are not.


> **🧠 Remember: A reverse DCF asks what the price already implies — sometimes the market states your**

thesis for you.


### ⚠️ Mistake — "False Precision"

Students produce a DCF target of "₹3,617.42" and present it as if it's exact.

They do it because a precise-looking number feels rigorous and impressive.

But a DCF rests on assumptions about the distant future — it's an estimate with a wide range, not a precise
measurement. Quoting it to the paisa is false precision dressed up as rigour.

Quoting a value to the paisa signals you don't understand uncertainty, and any sharp interviewer or PM will
pounce. AI makes this worse if you let it: it will happily output a precise-looking number you didn't earn.


> **🧠 Remember: A DCF is a range, not a precise number — false precision exposes that you don't grasp the**

uncertainty.


### 📊 Real World — "Scenario Thinking in Indian Equity Research"

Good Indian research reports rarely give one number — they give bull, base, and bear cases, because the
future is uncertain.

AI lets an analyst spin up those scenarios fast and stress-test the assumptions behind each.

For a high-growth name — a Zomato-type platform or a fast-expanding retailer — the scenario spread is
often the real story: the gap between bull and bear reveals how much rides on a few assumptions.

The analyst's job is to judge which scenario is most likely and why — the part AI can't do. The model
produces the spread; you supply the conviction about where reality sits within it.


> **🧠 Remember: Strong research gives bull/base/bear scenarios; AI speeds them, but you judge which is**

likely.


### 📋 Summary — "Valuation Automation — Key Takeaways"

This session in 60 seconds:

1. Automation multiplies your assumptions — wrong inputs scale the error across every scenario.
2. AI speeds the mechanics: scenarios, sensitivity tables, comps structure, reverse DCFs.
3. A reverse DCF asks what the current price already implies — sometimes that is the thesis.
4. Beginners quote false-precise targets; analysts present a range and respect uncertainty.
5. The scenario spread is often the real story; you judge which case is most likely, which AI can't.

What you can now do: Use AI to automate valuation mechanics — scenarios, sensitivities, and reverse
DCFs — while owning the assumptions and presenting value as a defensible range.


> **🧠 Remember: AI runs the valuation maths instantly; you supply the assumptions and the humility about**

uncertainty.


### 🎨 Visual — "The DCF Sensitivity Grid"

Create a dark-themed infographic with a navy background (#02073D) centred on a sensitivity table (a grid
/ heatmap). Show a 5×5 matrix: the rows labelled with WACC values (e.g. 9%, 9.5%, 10%, 10.5%, 11%)
and the columns labelled with terminal growth g (e.g. 3%, 3.5%, 4%, 4.5%, 5%). Fill the cells with implied
per-share values, colour-graded from glowing blue (#246BFD, lower values, top-left) through purple
(#6A5CFF, middle) to pink (#FF6AC1, higher values, bottom-right). Highlight the centre "base case" cell
with a white border and label it "BASE CASE." Add an arrow across the grid labelled "Small input changes

→ big value swings." Below the grid, a Lavender White (#F5ECFF) caption: "Don't quote ₹3,617.42. Quote
a range — and know which corner is realistic." Label the axes clearly in white. Title at top: "The DCF
Sensitivity Grid." Style: clean, minimal, professional financial infographic.

What this visual shows: It makes the danger of false precision vivid — the student sees value swing
dramatically across the grid and understands why a range, with judgment about which cell is realistic, beats
a single number.


> **🧠 Remember: Value is a grid, not a point — show the range and judge the realistic corner.**


### ❓ Quiz (5 Questions)


**Q1. Why is automating a DCF risky if your base assumption is wrong?**
a) Automation fixes wrong assumptions
- b) Automation multiplies the error across every scenario, scaling a
wrong answer
- c) DCFs don't use assumptions
- d) It makes no difference


> ✅ **Answer:**
- b) 📝 Why: Speed multiplies whatever you input. A flawed core assumption gets spread across

all scenarios — you've automated being wrong.


**Q2. A reverse DCF is used to:**
a) Compute a fair value from your assumptions
- b) Determine what growth rate the current market price is
implying
- c) Reverse a calculation error
- d) Value a company backwards from its founding


> ✅ **Answer:**
- b) 📝 Why: A reverse DCF solves for the growth the price already assumes. If that implied

growth is unrealistic, you have a thesis.


**Q3. Why is terminal value so sensitive to small changes in the growth rate g?**
a) Because g is multiplied by a huge number
- b) Because (WACC − g) sits in the denominator, so a small
change in g sharply changes the result
- c) Because g is irrelevant
- d) Because FCF dominates everything


> ✅ **Answer:**
- b) 📝 Why: g enters via (WACC − g) in the denominator. When that gap is small, tiny changes

in g swing terminal value dramatically — hence the need for a sensitivity grid.


**Q4. True or False: Presenting a DCF target as "₹3,617.42" demonstrates rigour and**
precision.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: A DCF rests on uncertain future assumptions — it's a range, not a precise

measurement. False precision signals you don't grasp the uncertainty.


**Q5. Fill in the blank: Because valuation is so sensitive to assumptions, a good analyst**
presents a __ table and a value range rather than a single number.

> ✅ **Answer:** sensitivity 📝 Why: A sensitivity table shows how value moves across a range of growth and

WACC — far more honest and useful than one figure.


---

## 📑 PART D — WORKFLOWS, AGENTS &

AUTOMATION
So far AI has been a brilliant assistant you talk to one task at a time. Part D is where you stop chatting and
start building systems. You'll learn to chain prompts into repeatable pipelines, understand what an AI
"agent" really is (and where it's dangerous), wire apps together with no-code automation, and finally build
your own AI tools. This is the leap from using AI to engineering with it — the skill that genuinely 10x's an
analyst.


---

## Session 16.13: Building Multi-Step AI Research

Workflows & Pipelines

"A single great prompt is a knife. A workflow is a kitchen. Analysts who win don't have sharper knives
— they have a system that produces the same dish, perfectly, every single time."


### 🎣 Hook — "The One-Off Chat Trap"

Most people use AI like a slot machine. They type a request, get an answer, and start from scratch next
time.

It works — but nothing compounds. Every analysis is a fresh negotiation with a blank box.

Real productivity comes from turning a good result into a repeatable process. Not "I got a good summary
once," but "I run the same five steps on every company, every quarter, and the quality never drops."

That's a workflow. It's the difference between cooking a lucky meal and running a kitchen that serves the
same dish flawlessly a hundred times.


> **🧠 Remember: One-off prompts don't compound — workflows do. Build the system, not just the answer.**


### 🔬 Deep Dive — "What a Workflow Actually Is"

A workflow is a sequence of steps where the output of one becomes the input of the next. You break a
big, messy task into small, reliable stations.

Take "analyse this company." That's too big for one prompt. Decompose it:

1. Ingest — feed in the annual report and concall.
2. Summarise — extract the business model, segments, and management's key messages.
3. Extract data — pull the financials you need into a clean table (then verify them).
4. Analyse — run ratios, spot trends, flag red flags.
5. Draft — assemble an investment note from the verified outputs above.

Each step is a focused prompt that does one thing well. The magic is the chain: step 2's summary feeds
step 3's extraction; step 4's analysis feeds step 5's draft. This is prompt chaining — the core technique of
Part D.

Why decompose? Because a single mega-prompt asking for everything produces shallow, error-prone
mush. Five focused steps each produce something you can check before passing it on. You catch errors at
each station instead of discovering them buried in a final report.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Pick one company and gather its latest annual report and concall transcript.
2. Run Station 1 (triage) and read the 3 flagged sections it points you to — yourself.
3. Run Station 2 (extraction), then open the actual report and verify every extracted number; fix anything
marked [VERIFY].
4. Feed your verified table into Station 3 (ratios) and sanity-check the outputs.
5. Run Station 4 (draft) on the verified material, then edit the note in your own voice.
6. Save all four prompts, in order, as a document titled "My Company Analysis Pipeline" — that's your
reusable SOP.


> ⏱️ Time saved: A full first-pass company analysis that might take a day of reading and assembling can be

triaged and structured in an afternoon — and you now own a repeatable pipeline that makes the next
company faster still.


### ⚡ Copy-Paste Prompts

⚠️ These are the stations of a pipeline. Run them in order, verify the output of each before feeding it
to the next, and save the whole sequence as your reusable SOP.


**Station 1 — Filing triage:**


```
You are an equity research analyst. I will paste an annual report / concall
transcript for [Company]. Produce a structured brief with: (a) the business
in 3 lines, (b) each reporting segment and what it does, (c) management's
3 key messages this period, (d) the 3 things that most deserve my deeper
reading, with page/section pointers. Do not invent figures — point me to
where to verify them.
```


**Station 2 — Data extraction (then verify):**


```
From the document above, extract into a clean table the following line items
for the periods shown: revenue, EBITDA, PAT, total debt, cash, operating
cash flow. Mark anything you are not fully certain about with [VERIFY].
Do not estimate or fill gaps — leave blank if not stated.
```


**Station 3 — Ratio analysis (on verified data):**


```
Here is the VERIFIED financial data I confirmed against the report:
[paste your checked table]
Compute and interpret: revenue growth, EBITDA margin trend, ROE,
debt-to-equity, and the cash conversion (OCF/EBITDA). Flag any trend that
looks like a red flag and explain why in one line each. Use only my figures.
```


**Station 4 — Note drafting (assembling verified outputs):**


```
You are writing an investment note. Using ONLY the verified summary and
analysis below, draft a 1-page note with: thesis in 2 lines, key positives,
key risks, and what to watch next quarter. Neutral, evidence-based tone.
[paste your verified Station 1 brief + Station 3 analysis]
```


> **🧠 Remember: A workflow chains focused steps — each does one job, and each output is checkable**

before it feeds the next.


### 💡 Concept — "The Research Pipeline as an SOP"

Think of your workflow as a Standard Operating Procedure — a documented recipe you (or a junior, or a
future you) can run identically every time.

Analogy: a McDonald's kitchen makes the same fries in Delhi and Detroit because the process is fixed, not
because every cook is a genius. The system guarantees the output.

Your research pipeline is the same idea. Write down the exact sequence of prompts — your "filing triage
prompt," then your "data extraction prompt," then your "ratio analysis prompt," then your "note drafting
prompt" — in order, with notes on what to verify at each stage. Save it as a document.

Now "analyse a company" isn't a daunting blank page. It's: open the SOP, run station 1, check, run station
2, check, and so on. The quality is baked into the process, not dependent on your mood or memory that
day. This is exactly how you'll assemble the full automated engine in Part E — by stitching these
documented stations together.


**The human edge — what stays yours**


A workflow is only as trustworthy as its verification gates — and you are those gates. AI can chain a dozen
steps in seconds, but it cannot know which station's output is subtly wrong, or which flagged risk actually
matters to the thesis. Designing the pipeline, deciding where the checkpoints go, and standing at each one
to confirm the truth before it propagates — that is irreducibly human. The machine runs the assembly line;
you are quality control, and quality control is the job.


> **🧠 Remember: Document your pipeline as an SOP — a fixed recipe means consistent quality every time,**

regardless of who runs it.


### ⚠️ Mistake — "The Unbroken Chain"

Beginners build a workflow, run it end-to-end, and only check the final output.

They do it because it feels efficient — why stop midway when the machine is humming?

But errors compound through a chain. If station 2 misreads a number, station 3 analyses the wrong figure,
station 4 draws a false conclusion, and station 5 writes it up convincingly. One small error at the top

becomes a confident, polished mistake at the bottom — and it's now buried three steps deep where you'll
never spot it.

The fix is a verification gate between stations: a checkpoint where you confirm the output is correct before
it feeds the next step. Especially after any data-extraction step — that's where a wrong number does the
most damage. An unbroken, unchecked chain doesn't save time; it manufactures errors at speed.


> **🧠 Remember: Check between stations, not just at the end — errors compound through a chain into**

confident, buried mistakes.


### 📊 Real World — "How a Research Desk Actually Runs"

A professional equity research desk doesn't reinvent its process for every stock. It has a template: the same
model structure, the same note format, the same checklist of things to cover.

When a covered company reports results, the analyst runs a known sequence — update the model, check
against the estimate, read the concall, refresh the thesis, publish the note — often within hours. Speed
comes from the repeatable process, not from working faster under panic.

For an Indian analyst covering, say, ten mid-cap names, an AI workflow is the modern version of that desk
discipline. The same pipeline — triage the filing, extract and verify the data, run the ratios, draft the update
— applied to each name, every quarter. The analyst's edge isn't doing it once brilliantly; it's doing it
consistently across a whole coverage list, fast enough to react before the market fully digests the news.


> **🧠 Remember: Real desks run repeatable templates, not heroics — an AI pipeline is that same discipline,**

applied across your whole coverage.


### 📋 Summary — "Multi-Step Workflows — Key Takeaways"

This session in 60 seconds:

1. One-off prompts don't compound; a repeatable workflow does — build the system, not just the answer.
2. A workflow chains focused steps, where each output feeds the next (prompt chaining).
3. Decompose big tasks (ingest → summarise → extract → analyse → draft) into checkable stations.
4. Document the pipeline as an SOP so quality lives in the process, not your memory.
5. Put a verification gate between stations — errors compound through an unchecked chain.

What you can now do: Take any large research task, break it into a documented sequence of focused,
verified steps, and run it consistently across many companies — the foundation for true automation.


> **🧠 Remember: A workflow turns a lucky one-off result into a reliable system you can run a hundred times**

without losing quality.


### 🎨 Visual — "The Research Pipeline"

Create a dark-themed infographic with a navy background (#02073D) showing a horizontal pipeline of
five connected stations, left to right, like a flowchart or assembly line. Each station is a rounded rectangle
glowing in a gradient from blue (#246BFD) on the left through purple (#6A5CFF) to pink (#FF6AC1) on the
right. Label the stations in order: "1. INGEST (report + concall)", "2. SUMMARISE", "3. EXTRACT DATA",
"4. ANALYSE", "5. DRAFT NOTE". Between each pair of stations, draw a glowing arrow showing flow, and
on each arrow place a small white shield icon labelled "✓ verify" to show the verification gate. Above the
whole pipeline, a title in Lavender White (#F5ECFF): "One task in. A finished note out. Every time." Below
the pipeline, a caption: "Each station does one job. You check between each. Quality lives in the process."
Style: clean, minimal, professional financial infographic, assembly-line feel.

What this visual shows: It makes the abstract idea of "prompt chaining" concrete — the student sees a task
flowing through discrete, checkable stations and understands that a workflow is an assembly line with
quality gates, not one giant prompt.


> **🧠 Remember: A pipeline is an assembly line with verification gates between every station.**


### ❓ Quiz (5 Questions)


**Q1. What is "prompt chaining"?**
a) Writing one very long prompt
- b) A sequence of steps where each prompt's output becomes the next
prompt's input
- c) Sending the same prompt repeatedly
- d) Linking two unrelated chatbots


> ✅ **Answer:**
- b) 📝 Why: A workflow chains focused steps — the output of one station feeds the next —

rather than asking one mega-prompt to do everything.


**Q2. Why decompose "analyse this company" into separate stations instead of one big**
prompt?
a) It looks more professional
- b) Each focused step produces a checkable output, so you catch errors before
they propagate
- c) Big prompts are not allowed
- d) It uses fewer words overall


> ✅ **Answer:**
- b) 📝 Why: Focused steps each do one job well and let you verify before passing on, whereas

a mega-prompt produces shallow, error-prone output you can't easily check.


**Q3. Where should verification gates go in a pipeline?**
a) Only at the very end
- b) Between stations — especially after any data-extraction step
- c) Nowhere; trust
the chain
- d) Only at the very start


> ✅ **Answer:**
- b) 📝 Why: Errors compound through a chain. Checking between stations, particularly after

data extraction, stops one small mistake from becoming a buried, confident error in the final note.


**Q4. True or False: Documenting your workflow as an SOP means quality depends on the**
process rather than your mood or memory on a given day.
a) True
- b) False


> ✅ **Answer:**
- a) True 📝 Why: A documented SOP is a fixed recipe — like a fast-food kitchen producing

identical fries everywhere — so output quality is consistent regardless of who runs it or when.


**Q5. Fill in the blank: In a workflow, errors __ through an unchecked chain, turning one small**
mistake into a confident, polished error in the final output.

> ✅ **Answer:** compound 📝 Why: Without verification gates between stations, a single early error gets

analysed, concluded upon, and written up — compounding into a buried mistake.


---

## Session 16.14: AI Agents Explained — From

Chatbots to Autonomous Analysts

"A chatbot answers your question. An agent goes off and does the task. The difference is the
difference between a calculator and an intern — and an unsupervised intern who makes things up
can do a lot of damage very fast."


### 🎣 Hook — "The Intern Who Never Sleeps"

Everything so far has been you driving — you prompt, AI responds, you prompt again. You're the one taking
each step.

An agent changes that. You give it a goal, and it figures out the steps itself — searching, calculating,
reading, looping — until the task is done. It's less like a calculator and more like an intern you hand a task
to and walk away from.

That's thrilling and dangerous in equal measure. A tireless intern who researches all night is a gift. An intern
who confidently fabricates a number when stuck — and never tells you — is a liability. Understanding
agents means understanding both halves.


> **🧠 Remember: An agent pursues a goal on its own — powerful as a tireless intern, dangerous as one who**

fabricates when stuck and never admits it.


### 🔬 Deep Dive — "Chatbot vs Agent — The Real Difference"

A chatbot is reactive: it takes your message and produces a response. One turn, one answer. It has no
ability to act on the world.

An agent is a language model wrapped in two extra powers:

1. Tools — the ability to do things: search the web, run code, read a file, query a database, send an email,
call an API.
2. A loop — the ability to take multiple steps toward a goal, deciding each next move based on what just
happened.

The loop is the heart of it, often called the reason–act–observe loop:

Reason: "To answer this, I first need the latest revenue figure."
Act: uses a tool — searches, or runs code.
Observe: reads the result of that action.
...then reasons again about the next step, and repeats until the goal is met.

So instead of you manually running your five-station pipeline from 16.13, an agent could, in principle, run
those stations itself — fetch the filing, extract data, compute ratios, draft the note — looping through them
autonomously. That's the leap from "tool you operate" to "worker you delegate to."


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Take an agentic AI tool (one that can search and/or run code) and give it a bounded research goal on
one company — e.g. "draft a first-pass brief using only these documents."
2. Use prompt 1 so it exposes each reason–act–observe step as it goes.
3. Watch how it works — note where it reasons well and where it tries to guess.
4. Run the verification-checklist prompt as the final step.
5. Personally verify three of the figures it claimed against the primary source — and note how many were
off. That number is your lesson in why checkpoints exist.


> ⏱️ Time saved: An agent can do hours of fetching and structuring while you do other work — but the time

you save is only real because you spend a fraction of it verifying, which is the part that keeps you
accountable.


### ⚡ Copy-Paste Prompts

⚠️ Even when working with an agent or an agentic tool, you frame the task and the guardrails. These
prompts make the agent show its work and flag uncertainty — so you can verify every step.

1. Make the agent expose its reasoning and tool use:


```
You are acting as a research agent for [Company]. Work toward this goal:
[state goal, e.g. "a verified one-page first-pass brief"].
For EACH step, show me: (1) what you're trying to find, (2) which tool you
used, (3) what it returned, (4) your next step. Mark any figure you could
not retrieve from a source as [UNVERIFIED]. Do not fabricate to fill gaps.
```


2. Bound the agent's task (scope guardrail):


```
Act as a research agent, but stay strictly within this scope: only use the
documents I have provided and the code tool for calculations. Do NOT use
outside knowledge for any figure. If a needed number is not in my documents,
stop and ask me for it rather than estimating.
```


3. Force a verification checklist as the final step:


```
As your final step, produce a VERIFICATION CHECKLIST: list every numerical
figure and every factual claim in your output, and for each, state the exact
source (document name + section) it came from. Flag any item where the source
is your own knowledge rather than my provided data.
```


> **🧠 Remember: An agent = a language model + tools + a reason-act-observe loop, so it can take multiple**

steps toward a goal on its own.


### 💡 Concept — "Grounding the Agent — RAG and Tools"

An agent is only as trustworthy as what it can check against. Left to its own knowledge, it will guess. So the
most useful agents are grounded in real data through tools.

Recall RAG (Retrieval-Augmented Generation) from earlier: instead of answering from memory, the system
first retrieves the relevant real document, then answers from that. An agent does this with tools — it can pull
the actual annual report, the actual price, the actual filing, and reason over those rather than its training
data.

Analogy: an ungrounded agent is a confident student answering from memory in a closed-book exam. A
grounded agent is the same student with the textbook open and a calculator on the desk — far more likely
to be right, because it's working from sources, not recall.

This is why "agent + tools" matters so much in finance. An agent that can run code computes instead of
guessing. An agent that can retrieve the filing quotes instead of hallucinating. The tools are what convert a
creative-but-unreliable model into something approaching a useful junior analyst — if you've given it the
right ones and still verify.


**The human edge — what stays yours**


An agent can run all night; it cannot be accountable in the morning. When a number goes into a report with
your name on it, the responsibility is yours, not the loop's — and that accountability is precisely what cannot
be automated. SEBI-registered research, a recommendation to a client, a figure shown to a PM: these carry
a human signature for a reason. The agent is the tireless legs; you are the judgment, the verification, and
the name on the line. Delegating the running around is smart. Delegating the responsibility is impossible —
so never pretend you have.


> **🧠 Remember: A grounded agent works from retrieved sources and real tools (RAG, code, search), not**

memory — that's what makes it useful instead of just confident.


### ⚠️ Mistake — "Trusting the Autonomous Loop"

The seductive error: you give an agent a goal, it runs for twenty steps, hands you a polished report, and you
trust it — because it looks complete and it did so much work.

People do this because autonomy feels like competence. Surely something that took twenty independent
steps and produced a formatted report knows what it's doing?

But here's the brutal truth: an unsupervised agent fabricates at scale. Every weakness you've learned
about AI — hallucinated numbers, invented quotes, false confidence — doesn't disappear in an agent. It
multiplies, because now those errors are generated across many steps with no human checking each one.

A single chat error is one wrong number you might catch. An agent error is a wrong number that got
computed, analysed, and written into a conclusion — autonomously, invisibly.

The fix is human checkpoints: the agent does the legwork, but a human reviews the critical outputs —
especially every figure and every factual claim — before they're used or acted upon. Autonomy is for the
drudgery, never for the accountability.


> **🧠 Remember: An unsupervised agent fabricates at scale — autonomy multiplies errors, so keep a human**

checkpoint on every number and claim.


### 📊 Real World — "Where Agents Fit (and Don't) in Finance"

The honest state of play for an Indian analyst: agents are genuinely useful for bounded, verifiable legwork,
and genuinely dangerous for unsupervised judgment.

Good fits — the drudgery that's checkable: - Monitoring filings and flagging when a covered company
reports. - Gathering and structuring data into a draft table (that you then verify). - Running a fixed multi-step
research pipeline as a first pass. - Watching for news or price triggers across a coverage list.

Bad fits — anything where a fabricated input causes real harm: - Producing a final investment
recommendation no human verified. - Anything that acts on money — placing trades, moving funds — off its
own unchecked conclusion. - Generating numbers presented to clients or a PM without primary-source
verification.

The pattern: an agent is a superb researcher and monitor, a dangerous decision-maker. SEBI-registered
research carries accountability that cannot be delegated to a loop. The analyst stays the verifier and the
signatory — the agent just does the running around. As the tooling matures, the legwork it can handle
grows; the accountability never transfers.


> **🧠 Remember: Agents fit bounded, checkable legwork — monitoring, gathering, first-pass pipelines —**

never unsupervised judgment or anything that acts on money.


### 📋 Summary — "AI Agents — Key Takeaways"

This session in 60 seconds:

1. A chatbot reacts with one answer; an agent pursues a goal over many steps, on its own.
2. An agent = a language model + tools (search, code, files) + a reason–act–observe loop.
3. Grounding via RAG and tools (real documents, real computation) is what makes an agent useful
instead of just confident.
4. An unsupervised agent fabricates at scale — autonomy multiplies errors, not just speed.
5. Agents fit bounded, verifiable legwork; humans keep the checkpoints and the accountability.

What you can now do: Explain clearly what an AI agent is and how it works, identify exactly where agents
help an analyst and where they're dangerous, and insist on human checkpoints around every figure an
agent touches.


> **🧠 Remember: Delegate the legwork to the agent; never delegate the verification or the accountability.**


### 🎨 Visual — "Chatbot vs Agent"

Create a dark-themed infographic with a navy background (#02073D) split into two halves. LEFT half, titled
"CHATBOT" in blue (#246BFD): a simple two-way arrow between a person icon and an "AI" bubble,
labelled "You ask → it answers. One turn." Make it look static and simple. RIGHT half, titled "AGENT" in
pink (#FF6AC1): a circular loop diagram with four nodes glowing in a blue-to-purple-to-pink gradient,
labelled clockwise "REASON → ACT (use tool) → OBSERVE → repeat", with small tool icons around it (a
magnifying glass for search, a code bracket for code, a document for retrieval). At the centre of the loop, the
word "GOAL." Below the loop, a warning banner in Lavender White (#F5ECFF) with a small shield icon:
"Powerful — but unsupervised, it fabricates at scale. Keep a human checkpoint on every number." Title at
top spanning both halves: "Answering vs Acting." Style: clean, minimal, professional financial infographic.

What this visual shows: It crystallises the single most important distinction in the session — a chatbot is a
static one-turn exchange, while an agent is a self-driving loop that uses tools — and visually pairs that
power with the non-negotiable human checkpoint.


> **🧠 Remember: A chatbot answers in one turn; an agent loops through reason-act-observe with tools — and**

needs a human checkpoint.


### ❓ Quiz (5 Questions)


**Q1. What two things turn a language model into an "agent"?**
a) A bigger screen and faster internet
- b) Tools (the ability to act) and a loop (the ability to take multiple steps
toward a goal)
- c) A paid subscription and a longer prompt
- d) Nothing — they're the same thing


> ✅ **Answer:**
- b) 📝 Why: An agent is a language model wrapped in tools (search, code, file access) plus a

reason–act–observe loop that lets it pursue a goal over multiple steps.


**Q2. What is the "reason–act–observe loop"?**
a) A way to make prompts shorter
- b) The cycle where an agent reasons about the next step, acts using a
tool, observes the result, and repeats
- c) A type of financial ratio
- d) The process of logging into an AI tool


> ✅ **Answer:**
- b) 📝 Why: It's the core mechanism of an agent — think about what's needed, use a tool to do

it, read the result, then decide the next step, looping until the goal is met.


**Q3. Why is an unsupervised agent especially dangerous in finance?**
a) It works too slowly
- b) It fabricates at scale — autonomy multiplies hallucinated numbers and claims
across many unchecked steps
- c) It refuses to use tools
- d) It can only answer one question


> ✅ **Answer:**
- b) 📝 Why: Every AI weakness (hallucination, false confidence) multiplies in an agent because

errors are generated across many autonomous steps with no human checking each — a wrong number
gets computed, analysed, and concluded upon invisibly.


**Q4. True or False: Because an agent ran twenty independent steps and produced a polished**
report, you can trust its figures without checking.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: Autonomy is not competence. The amount of work done says nothing about

accuracy — an unsupervised agent can fabricate across all twenty steps. Human checkpoints on every
number remain essential.


**Q5. Fill in the blank: Grounding an agent through RAG and tools means it works from**
retrieved __ and real computation, rather than guessing from memory.

> ✅ **Answer:** sources (accept: documents / data) 📝 Why: A grounded agent retrieves the actual filing or

runs actual code — like a student with the textbook open — making it far more reliable than one answering
from recall.


---

## Session 16.15: No-Code Automation — Zapier,

Make & n8n for Finance

"The most valuable automations aren't clever — they're boring. 'When this happens, do that.' Wire ten
boring rules together and you've built a system that watches the market while you sleep."


### 🎣 Hook — "The Analyst Who Cloned Himself"

There are tasks you do over and over that have nothing to do with judgment: checking whether a company
filed results, copying a number into a tracker, sending yourself a reminder when a stock moves.

These eat hours and require zero skill. They're pure repetition — and repetition is exactly what machines
are for.

No-code automation lets you hand these off without writing a line of code. You define a rule — "when X
happens, do Y" — and a service runs it forever, automatically. It's the closest thing to cloning the boring half
of yourself.


> **🧠 Remember: Repetitive, judgment-free tasks are what automation is for — define "when X, do Y" once**

and it runs forever.


### 🔬 Deep Dive — "Triggers and Actions — The Whole Idea"

Every no-code automation is built from two pieces:

1. A trigger — the event that starts it. "A new email arrives." "A company posts a filing." "A stock crosses a
price." "A new row is added to a sheet."
2. An action — what happens in response. "Summarise it with AI." "Add a row to a spreadsheet." "Send
me a message." "Post to a Slack channel."

String them together and you get: "When [trigger], do [action]." That's an automation. Chain several
actions and one trigger can kick off a whole sequence.

A finance-flavoured example, end to end: - Trigger: an email alert arrives saying a covered company filed
quarterly results. - Action 1: the filing text is sent to an AI step that summarises the key numbers and
management commentary. - Action 2: that summary is posted to your private Slack or Telegram. - Action
3: a row is added to your tracking spreadsheet with the date and a link.

You did nothing. You wake up to a structured summary waiting for you — which you then verify before
trusting. The automation did the fetching and structuring; you do the judging.


### 🛠️ 🛠️ Put this into practice — the same-day workflow


1. Pick one repetitive task you do — e.g. logging interesting articles, or wanting a heads-up when a stock
moves.
2. Sign up for a beginner connector (Zapier is the gentlest start) and identify your trigger (a saved article, a
price level, an email alert).
3. Add an AI action step using one of the prompts above, and a delivery action (message yourself, or add
a sheet row).
4. Turn it on and test it once with a real example.
5. Add the rule to yourself: this automation fetches and structures — I verify before I trust or share. Build
one flow today; you can layer more later.


> ⏱️ Time saved: A single filing-watch or daily-brief automation can save 20–30 minutes every single day of

manual checking and copying — hours per month — freeing that time for the analysis the automation can't
do.


### ⚡ Copy-Paste Prompts

⚠️ In a no-code flow, your AI "action" step needs a tight prompt baked in. These are designed to be
the AI step inside an automation — note how each one flags uncertainty so your later human check is
easy.


**1. The filing-summary action (AI step in a filing-watch flow):**


```
You are summarising a quarterly filing for an analyst's first read. From the
text provided, output: (1) revenue, EBITDA, PAT with YoY change if stated,
(2) management's 3 key messages, (3) anything that looks unusual. Keep it
under 150 words. Mark every figure with [VERIFY] since this is an automated
first-pass that a human will check.
```


**2. The daily-digest action (AI step in a morning-brief flow):**


```
You are compiling a morning brief. From the headlines provided about these
companies [list], write a 5-bullet digest of what matters for an equity
analyst today. Neutral tone, one line each, most material first. If a
headline is ambiguous or unverified, say so rather than asserting it.
```


**3. The article-logger action (AI step in a reading-queue flow):**


```
Summarise this article in exactly one sentence capturing its single most
important point for an investor. Then output a comma-separated list of up to
3 companies or sectors it concerns, for tagging in a tracker. No commentary.
```


> **🧠 Remember: Every automation is "when [trigger], do [action]" — an event fires, and one or more actions**

run in response, with no code.


### 💡 Concept — "The Connectors — Zapier, Make, n8n & Webhooks"

The services that run these automations are connectors — they sit between your apps (Gmail, Google
Sheets, Slack, Telegram, an AI model) and pass data between them on your rules. The three you'll hear
about:

Zapier — the most beginner-friendly. Huge library of app connections, simple "trigger → action" builder.
Best for getting started fast.
Make (formerly Integromat) — a more visual, flexible canvas where you wire modules together; better
for multi-step branching flows. A middle ground of power and approachability.
n8n — the most powerful and flexible, can be self-hosted, more technical. Where you go when you've
outgrown the simpler tools.

And one concept that unlocks everything: a webhook. Think of it as a custom doorbell with a unique URL.
When something sends data to that URL, your automation fires. It's the universal connector — it lets any
service that can "send a web request" trigger your flow, even one without a pre-built integration. You don't
need to master webhooks today; just know the word means "a URL that, when pinged, starts an
automation."

Analogy: connectors are the staff in a building's mailroom. A trigger is mail arriving; actions are what they do
with it — copy it, forward it, file it. A webhook is a private PO box anyone can drop mail into to set the staff
in motion.


**The human edge — what stays yours**


Automation is wonderful at carrying water and useless at deciding whether the water is clean. It will fetch,
structure, and deliver tirelessly — but it cannot judge whether the summarised figure is right, whether the
flagged risk matters, or whether to act on the alert it just sent you. The verification gate, the interpretation,
and the decision are yours. The analyst who automates well isn't the one who removes themselves from the
loop — it's the one who removes themselves from the grind and plants themselves firmly at the judgment.


> **🧠 Remember: Connectors (Zapier, Make, n8n) wire your apps together on "when X, do Y" rules; a**

webhook is a URL that, when pinged, starts the flow.


### ⚠️ Mistake — "Automating Away the Verification"

The classic trap: someone builds a slick automation where AI summarises a filing and posts it straight to a
group — or worse, into a published note — with no human in between.

They do it because the automation works so smoothly that adding a manual check feels like it defeats the
purpose. The whole point was to remove the human, right?

Wrong — and dangerously so. You've now built a machine that broadcasts unverified AI output at speed
and scale. Every hallucinated number, every misread figure, now goes straight to readers automatically,
with no one catching it. You haven't saved work; you've automated the spreading of errors and attached
your name to it.

The rule: automate the gathering, structuring, and routing of information freely — but keep a human
verification step before anything is trusted, published, or acted upon. The automation can deliver the
summary to your desk; you decide whether it's true before it goes anywhere that matters.


> **🧠 Remember: Automate gathering and routing, never the verification — an unchecked automation**

broadcasts AI errors at scale under your name.


### 📊 Real World — "Automation an Indian Analyst Can Actually Use"

You don't need a trading desk's budget to automate the grind. Practical flows a student or junior analyst can
build:

Filing watch: trigger on a news/email alert that a covered company reported → AI summarises →
drops into a Telegram channel and a Google Sheet. You get a first read before the market fully reacts.
Price-trigger alert: trigger when a stock on your watchlist crosses a level you set → message yourself
to go look. (The alert is automated; the decision stays yours.)
Concall-to-notes: when you save a transcript to a Drive folder → AI extracts management's key
messages into a notes doc for your review.
Daily brief: every morning at 7am → AI compiles headlines on your coverage names into one digest,
so you start the day oriented.
Reading queue: when an interesting article is saved → it's logged to a sheet with a one-line AI
summary, so your research reading list builds itself.

Notice the pattern: every one of these automates fetching, structuring, and delivering — the judgment-free
grind — while the analysis and the decision stay firmly with you. That's the whole philosophy of safe
automation: let the machine carry the water; you decide what to do with it.


> **🧠 Remember: Practical analyst automations — filing watches, price alerts, daily briefs — all automate the**

grind and leave the judgment to you.


### 📋 Summary — "No-Code Automation — Key Takeaways"

This session in 60 seconds:

1. Automation hands off repetitive, judgment-free tasks with no code required.
2. Every automation is "when [trigger], do [action]" — chain actions for whole sequences.
3. Connectors (Zapier for beginners, Make for flexibility, n8n for power) wire your apps together; a
webhook is a URL that starts a flow.
4. Never automate away the verification — an unchecked flow broadcasts AI errors at scale.
5. Automate the gathering, structuring, and routing; keep the analysis and decisions human.

What you can now do: Design and build simple no-code automations — filing watches, alerts, daily briefs —
that handle the repetitive grind of research while preserving a human verification step before anything is
trusted or acted upon.


> **🧠 Remember: Wire up the boring "when X, do Y" rules; let the machine watch and fetch while you keep**

the judgment.


### 🎨 Visual — "When This, Then That"

Create a dark-themed infographic with a navy background (#02073D) showing a single trigger branching
into a chain of actions. On the LEFT, a glowing blue (#246BFD) circle labelled "TRIGGER: Company files
results" with a small bell icon. An arrow flows right into three stacked action boxes in a purple-to-pink
gradient (#6A5CFF → #FF6AC1), labelled top to bottom: "ACTION 1: AI summarises filing", "ACTION 2:
Post to Telegram", "ACTION 3: Log row in Google Sheet". After the action chain, draw a clear white
checkpoint gate with a shield icon labelled "👤 YOU VERIFY before trusting." Across the top, a title in
Lavender White (#F5ECFF): "When this happens → do that. Automatically." Small app-style icons
(envelope, robot, chat bubble, spreadsheet) sit beside their respective steps. Below, a caption: "Automate
the fetching and routing. Never automate the verification." Style: clean, minimal, professional financial
infographic, flowchart feel.

What this visual shows: It makes the trigger-action model instantly graspable and bakes in the safety
principle visually — the automation runs the chain, but a human gate stands between the AI output and
trusting or publishing it.


> **🧠 Remember: One trigger fires a chain of actions automatically — but a human verification gate sits**

before anything is trusted.


### ❓ Quiz (5 Questions)


**Q1. Every no-code automation is built from which two pieces?**
a) A password and a username
- b) A trigger (the event that starts it) and an action (what happens in
response)
- c) A chart and a table
- d) A model and a forecast


> ✅ **Answer:**
- b) 📝 Why: The whole pattern is "when [trigger], do [action]" — an event fires, and one or more

actions run in response.


**Q2. Which connector is generally the most beginner-friendly starting point?**
a) n8n
- b) Make
- c) Zapier
- d) A spreadsheet


> ✅ **Answer:**
- c) 📝 Why: Zapier has the simplest trigger-action builder and the largest library of ready app

connections, making it the gentlest entry point; Make adds flexibility and n8n adds power for when you
outgrow it.


**Q3. What is a webhook, in plain terms?**
a) A type of spreadsheet formula
- b) A URL that, when something sends data to it, starts an automation
- c) A
financial ratio
- d) A kind of AI model


> ✅ **Answer:**
- b) 📝 Why: A webhook is like a custom doorbell with a unique URL — when it's pinged with

data, your flow fires. It's the universal connector for services without a pre-built integration.


**Q4. True or False: It's fine to build an automation that posts AI-summarised filings straight to**
readers with no human check, since the automation works smoothly.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: That automates the broadcasting of unverified AI output at scale under your

name. You automate gathering and routing freely, but a human verification step must come before anything
is trusted, published, or acted upon.


**Q5. Fill in the blank: The safe principle of automation is to automate the gathering,**
structuring, and routing of information, while keeping the __ and the decisions human.

> ✅ **Answer:** analysis (accept: verification / judgment) 📝 Why: Let the machine carry the water — fetch,

structure, deliver — but the interpretation, verification, and the decision stay with you.


---

## Session 16.16: Building Your Own AI Tools —

APIs, Custom GPTs, Projects & Mini-Apps

"There's a moment when you stop being someone who uses AI tools and become someone who
builds them. You don't need to be a programmer to cross that line — you need to understand four
ideas. Here they are."


### 🎣 Hook — "From Tenant to Architect"

Until now you've lived in tools other people built — the chat box, the connectors, the agents. You're a skilled
tenant.

But the analysts who truly stand out build their own tools: a custom assistant pre-loaded with their process,
a small app that runs a specific analysis, a packaged expert anyone on their team can use.

Crossing from tenant to architect sounds like it requires deep coding. It doesn't — not anymore. It requires
understanding four building blocks: the API, custom assistants, projects, and mini-apps. Master the
concepts and you can direct AI to build the rest.


> **🧠 Remember: Standing out means building your own AI tools — and that now takes understanding four**

concepts, not a computer-science degree.


### 🔬 Deep Dive — "The API — The Engine Behind Everything"

Every AI tool you've used is, underneath, talking to a model through an API (Application Programming
Interface). Understanding it conceptually unlocks the rest.

Plain definition: an API is a way for one piece of software to talk to another. The AI model sits on a server
somewhere; the API is the doorway you send a request through and get a response back. A chat app is just
a friendly face over that doorway.

A single API "call" has three parts you should recognise: - The model — which AI you're asking (a more
capable one for hard reasoning, a faster/cheaper one for simple, high-volume tasks). - The input (the
prompt) — what you send: your instructions and any data. - The output (the response) — what comes
back, which your software then uses.

Why does this matter to an analyst who isn't a developer? Because every custom tool — a Custom GPT, an
automation's AI step, a mini-app — is ultimately wrapping that call. Once you grasp "send a structured
prompt to a chosen model, get a structured response, use it in my software," you understand the engine
inside every AI product. You can then ask AI itself to write the small amount of code that makes the call —
you direct, it builds.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Take the single best prompt from your Part B library — the one you reuse most.
2. Create a Custom GPT or a Project and paste that prompt (expanded using template 1 or 2) as its
standing instructions; upload any reference files it should always know.
3. Save it with a clear name like "My Annual Report Analyst."
4. Test it on a real company — notice you no longer re-prompt; you just hand it the task.
5. Confirm it still flags figures for verification. If it hides them, fix the instructions. You've just built your first
reusable AI tool.


> ⏱️ Time saved: Every future use of that packaged expert skips the entire setup-and-prompting step —

minutes saved per use, compounding across hundreds of uses, and it produces consistent, house-style,
verification-flagged output every time.


### ⚡ Copy-Paste Prompts

⚠️ The first two are instruction sets you bake into a packaged expert (not one-off chats). The third
directs AI to help you build. All keep verification central.


**1. Instructions for a "packaged expert" assistant (paste as the tool's system instructions):**


```
You are [Name], an equity research assistant for Indian markets. Your job:
[e.g. produce first-pass company briefs in our house format].
Always: use ₹ and Indian context; structure output as [your fixed format];
mark every figure with [VERIFY] and state where it should be confirmed
(e.g. screener.in / the filing); never invent numbers; flag uncertainty
plainly. If asked for a recommendation, present a reasoned range and remind
the user that a human must verify and own the call.
```


**2. Instructions for a "concept explainer" assistant (for a learning tool):**


```
You are a finance tutor for Indian students. Explain any concept asked with:
a one-line analogy first, then plain definition, then a small Indian example
(₹, NSE/BSE, real documented cases only). Keep it accessible (Zerodha Varsity
style). Never fabricate data; if you use an illustrative figure, label it
clearly as illustrative. End with a one-line memory prompt.
```


**3. Directing AI to build a simple mini-tool (the "you direct, it builds" prompt):**


```
I want to build a simple tool where I paste a company's verified financials
and it returns a clean ratio table with brief interpretations. I am not an
expert coder. Walk me through building this step by step, write the code,
explain what each part does, and make sure the tool CLEARLY shows that inputs
are user-provided and that outputs should be verified. Keep it as simple as
possible to start.
```


> **🧠 Remember: An API is the doorway software uses to talk to the AI model — send a prompt to a chosen**

model, get a response back, use it. Every AI tool wraps this.


### 💡 Concept — "Packaged Experts — Custom GPTs and Projects"

You don't need code at all for the highest-leverage build: a packaged expert. This is a reusable AI
assistant where you've pre-loaded the instructions and knowledge once, so you (and others) never have to
set it up again.

Two common forms: - Custom GPTs / custom assistants — you give the AI a fixed role, a set of standing
instructions, and reference files, and save it as a named tool. "My Annual Report Analyst," pre-loaded with
your triage process and what to look for. Open it, paste a report, get your analysis — no re-prompting. -
Projects (e.g. Claude Projects) — a workspace with persistent instructions and uploaded reference
documents, so every chat inside it already knows your context, your style, and your source material.

Analogy: a normal chat is hiring a brilliant temp who knows nothing about you each morning. A packaged
expert is a trained employee who already knows your process, your format, and your sources — you just
hand them the task.

This is where your prompt library from Part B graduates: instead of pasting a great prompt each time, you
bake it into a packaged expert. The instructions live in the tool. This is almost certainly the first "tool" you
should build — it's pure setup, no code, and enormous repeated leverage. (A founder building finance tools
— a DCF assistant, a fundamental-analysis assistant — is doing exactly this at scale: packaging an expert
process into a reusable product.)


**The human edge — what stays yours**


Building a tool feels like the most "automated" thing you can do — and yet it demands the most human
judgment of all. You decide what the tool should do, what good output looks like, where verification must sit,
and how to stop it becoming a black box that launders guesses into confident numbers. The model can
write the code; only you can design the wisdom into the tool — the cited sources, the flagged uncertainty,
the human checkpoint. A great custom tool is human judgment, crystallised into something reusable. That
crystallising is the job no model can do for you.


> **🧠 Remember: A packaged expert (Custom GPT / Project) bakes your instructions and sources into a**

reusable tool — your prompt library, made permanent and shareable.


### ⚠️ Mistake — "Building a Black Box You Can't Verify"

The eager builder creates a custom tool or mini-app that spits out polished financial outputs — valuations,
summaries, recommendations — and then, because they built it, trusts it implicitly. It's their tool, so surely
it's right?

People fall for this because building something creates ownership and pride, and pride quietly becomes
misplaced trust. The effort of construction feels like proof of reliability.

But a tool you built is still a wrapper around the same model with the same flaws. If anything, it's more
dangerous, because it hides the AI behind a clean interface — you no longer see the raw output and its
hedges; you see a confident number in a box you made. The hallucination risk didn't vanish; it got
concealed by good design.

The discipline: every tool you build must show its sources and expose its workings, not hide them.
Design verification into the tool — make it cite where figures came from, flag uncertainty, and surface the
inputs — so the human using it can still check. A good custom tool makes verification easier, never
impossible. Never build a black box that launders AI guesses into trustworthy-looking outputs.


> **🧠 Remember: A tool you built still wraps a flawed model — design it to show its sources and workings,**

never to hide them behind a confident interface.


### 📊 Real World — "What Indian Analysts and Fintechs Are Actually

Building"

The build-your-own-tool wave is real and accelerating across Indian finance. The pattern is consistent: take
a repetitive expert process and package it.

A research analyst builds a Custom GPT pre-loaded with their note format and sector context, so
first drafts come out in-house style every time.
A finance creator or edtech builds assistants that explain concepts or analyse a user's uploaded
statement — packaging expertise into a product students can use.
Fintechs wrap model APIs into features: a summariser inside an app, a Q&A bot over a document, an
assistant that drafts a first-pass analysis.
Independent builders create mini-apps — a small interface where you paste data and get a structured,
verifiable output — without a full engineering team, by directing AI to write the code.

The lesson for a student: the barrier to building has collapsed. You can package your own research process
into a reusable tool this year, with little or no code, by understanding these four concepts and letting AI
handle the construction. The analysts who do this don't just use the AI wave — they ship on it, and that's
exactly the story that stands out in an interview. Crucially, the ones building well are the ones who bake
verification in — their tools surface sources, not hide them.


> **🧠 Remember: Indian analysts and fintechs are packaging expert processes into reusable AI tools — the**

barrier has collapsed, and building (with verification baked in) is what stands out.


### 📋 Summary — "Building Your Own AI Tools — Key Takeaways"

This session in 60 seconds:

1. Crossing from AI user to AI builder takes understanding four concepts, not a CS degree.

2. An API is the doorway software uses to talk to the model — send a prompt to a chosen model, get a
response, use it; every AI tool wraps this.
3. A packaged expert (Custom GPT / Project) bakes your instructions and sources into a reusable,
shareable tool — your prompt library made permanent.
4. A tool you built still wraps a flawed model — design it to show sources and workings, never to hide
them.
5. The barrier to building has collapsed; package your own research process this year, with little code, by
directing AI.

What you can now do: Explain how AI tools work under the hood, build a packaged-expert assistant loaded
with your own research process, and direct AI to construct simple custom tools — all with verification
designed in rather than hidden away.


> **🧠 Remember: Build packaged experts and mini-tools that make verification easier; shipping your own AI**

tool is what turns a user into a standout.


### 🎨 Visual — "The Four Building Blocks"

Create a dark-themed infographic with a navy background (#02073D) showing four building blocks
stacked or arranged as a 2×2 grid, each a glowing rounded tile in the cosmic palette. Tile 1 (blue
#246BFD): "THE API" with a doorway icon and subtitle "Software talks to the model: prompt in → response
out." Tile 2 (purple #6A5CFF): "CUSTOM GPT / ASSISTANT" with a robot-with-badge icon and subtitle
"Your process, baked in. Reusable." Tile 3 (pink #FF6AC1): "PROJECTS" with a folder icon and subtitle "A
workspace that knows your context & sources." Tile 4 (lavender #F5ECFF outline): "MINI-APPS" with a
small app-window icon and subtitle "Direct AI to build it — little code needed." Across the top, a title in
Lavender White: "From Tenant to Architect — Build Your Own AI Tools." At the bottom, a white banner with
a shield icon: "Whatever you build, make it SHOW its sources — never a black box." Style: clean, minimal,
professional financial infographic, building-blocks feel.

What this visual shows: It gives the student a clear mental map of the four ways to build, demystifying each
in one line, and anchors the whole session in the non-negotiable rule that any tool must expose its workings
rather than hide them.


> **🧠 Remember: Four building blocks — API, Custom GPT, Projects, mini-apps — and one rule: build tools**

that show their sources.


### ❓ Quiz (5 Questions)


**Q1. What is an API, in plain terms?**
a) A type of financial statement
- b) A doorway that lets one piece of software talk to another — here, sending
a prompt to a model and getting a response back
- c) A premium AI subscription
- d) A spreadsheet macro


> ✅ **Answer:**
- b) 📝 Why: An API (Application Programming Interface) is how software talks to the AI model

on its server — you send a structured prompt to a chosen model and get a response your software uses.
Every AI tool wraps this.


**Q2. What is a "packaged expert" like a Custom GPT or Project?**
a) A faster internet connection
- b) A reusable AI assistant with your instructions and sources baked in, so you
don't re-prompt each time
- c) A type of agent that needs no human
- d) A paid human consultant


> ✅ **Answer:**
- b) 📝 Why: It's a trained "employee" rather than a daily temp — your process, format, and

reference files live inside the tool, so you just hand it the task. It's where your prompt library becomes
permanent.


**Q3. Why can a tool you built yourself be more dangerous than a raw chat?**
a) It's slower
- b) It hides the AI behind a clean interface, concealing hallucination risk behind a confident-
looking output
- c) It can't make mistakes
- d) It uses a different model


> ✅ **Answer:**
- b) 📝 Why: A custom tool still wraps a flawed model, but the polished interface hides the raw

output and its hedges — so you see a confident number in a box you made and trust it. The risk is
concealed, not removed.


**Q4. True or False: Any custom AI tool you build should be designed to show its sources and**
expose its workings, not hide them.
a) True
- b) False


> ✅ **Answer:**
- a) True 📝 Why: A good custom tool makes verification easier — citing where figures came

from, flagging uncertainty, surfacing inputs — never building a black box that launders AI guesses into
trustworthy-looking outputs.


**Q5. Fill in the blank: A Custom GPT or Project lets you bake your standing instructions and**
reference __ into a reusable tool, so every use already knows your context and style.

> ✅ **Answer:** documents (accept: sources / files / knowledge) 📝 Why: A packaged expert holds persistent

instructions and uploaded reference documents, so every chat inside it starts already knowing your process
and source material.


---

## 📑 PART E — FULL AUTOMATION & STANDING

OUT
This is where everything converges. You've built foundations, mastered prompting, applied AI across the
research workflow, and learned to chain, agent-ify, automate, and build. Part E assembles those pieces into
one end-to-end engine that automates as much of the equity research and finance process as is safely
possible — then shows you how to turn these rare skills into a career advantage that makes you impossible
to ignore. The thread never breaks: AI does the mechanics at scale; you remain the verifier, the judge, and
the name on the work.


---

## Session 16.17: The Fully Automated Equity

Research Engine — End to End

"We've built every station separately. Now we connect the assembly line. By the end of this session
you'll have a single engine that takes a company in one end and produces a verified, near-finished
research note out the other — with you standing at every quality gate."


### 🎣 Hook — "Connecting the Assembly Line"

Across Parts C and D you built the pieces, one at a time: a filing-triage station, a data station, a modelling
assistant, an idea funnel, a valuation station, a pipeline that chains them, automations that monitor, and
packaged tools that run them.

Separately, each saves time. Connected, they become something else entirely — a research engine.

Imagine pointing this engine at a company on Monday morning and, hours later, having a structured,
sourced, near-complete first draft of a research note waiting — every number flagged for your verification,
every claim traceable. That's not science fiction. It's just the stations, wired together, with you at the gates.
Let's build it.


> **🧠 Remember: The whole module's pieces, connected into one pipeline, become a research engine —**

company in one end, verified draft note out the other.


### 🔬 Deep Dive — "The Engine, Station by Station"


```
Here is the full equity research engine — the assembly line that fulfils the promise of this module. Each
station is something you already built; the power is the sequence, with a verification gate after every step.
```


Station 1 — Filing Triage (from 16.8). Feed in the annual report, concall transcript, and latest results. AI
produces a structured brief: business model, segments, management's key messages, and the sections
that most deserve your deep reading. → Gate: you read the flagged sections yourself.

Station 2 — Data Pack (from 16.9). Extract the financial line items into a clean table and compute the core
ratios with a code tool (real maths, not guessed). → Gate: you verify every extracted figure against the
primary source (screener.in / the filing). This is the most important gate in the engine.

Station 3 — Model Update (from 16.10). Feed verified historicals into your model structure; AI helps
assemble the three-statement logic and check integrity (balance sheet balances, cash flow ties). → Gate:
you confirm the model's integrity checks and own every assumption.

Station 4 — Valuation (from 16.12). Run bull/base/bear scenarios, a sensitivity grid, and a reverse-DCF
on your verified inputs and assumptions. → Gate: you judge which scenario is realistic and present a range,

not a point.

Station 5 — Idea Context (from 16.11). Pull the company's screening context and peer comps to frame
where it sits versus the sector. → Gate: you verify the peer figures and the screening logic.

Station 6 — Note Assembly (from 16.13). Feed all the verified outputs above into a final drafting prompt
that assembles a structured investment note — thesis, positives, risks, valuation range, what to watch. →
Gate: you edit it in your own voice, confirm every figure traces to a verified source, and add the judgment AI
cannot.

The output isn't a finished, publishable note — it's a verified first draft at 10x speed, with the grunt work
done and your judgment layered on top. The engine carries the water; you decide it's clean and sign it.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Pick one Indian company you can get full filings for. Open your documented pipeline (your SOP from
16.13) and your packaged tools from 16.16.
2. Run Stations 1–5 in order. At each gate, stop and verify — read the flagged sections, check every
extracted number against screener.in / the filing, confirm model integrity, judge the valuation scenarios,
verify the comps.
3. Carry only verified outputs forward to the keystone assembly prompt.
4. Run the audit/trace step and personally confirm every flagged item.
5. Edit the draft into your own voice, add your judgment and the actual call, and you have a verified first-
draft note — produced in a fraction of the usual time.


> ⏱️ Time saved: A first-draft research note that might take 2–3 days of manual reading, extracting,

modelling, and writing can reach verified-first-draft stage in well under a day — with your judgment and
verification spent on what actually matters, across far more companies than you could ever cover by hand.


### ⚡ Copy-Paste Prompts

⚠️ This is the master sequence — run the stations in order, passing only VERIFIED output forward.
The final assembly prompt is the keystone. Never skip a gate.

The engine's keystone — final note assembly (run ONLY on verified outputs):


```
You are assembling an equity research note for [Company] (Indian markets, ₹).
Use ONLY the verified material I provide below — do not add, estimate, or
infer any figure beyond it. Produce a structured note:
1. THESIS (2-3 lines)
2. BUSINESS SNAPSHOT (from my verified triage brief)
3. KEY FINANCIALS & TRENDS (from my verified data pack)
4. VALUATION (present the range and scenarios I provide, not a single number)
5. KEY RISKS
6. WHAT TO WATCH NEXT QUARTER
Neutral, evidence-based tone. At the end, list every figure used and the
verified source I attached it to. If any required input is missing, say so
rather than filling the gap.
```


--- VERIFIED INPUTS ---
[paste: verified triage brief from Station 1]
[paste: verified data pack + ratios from Station 2]
[paste: verified valuation range + scenarios from Station 4]
[paste: verified peer/context from Station 5]

The engine's audit step — run after assembly:

Review the note you just produced. Produce a TRACE TABLE: every numerical
figure and every factual claim in the note, in one column; the exact verified
source I provided for it, in the second column. Flag in bold any item that
cannot be traced to my verified inputs. This is a final integrity check before
a human signs off.


> **🧠 Remember: Six stations — triage, data, model, valuation, context, assembly — each with a verification**

gate, chain into one research engine producing a verified first-draft note.


### 💡 Concept — "Why the Gates ARE the Engine"

It's tempting to think the AI stations are the valuable part and the verification gates are an annoying tax. The
opposite is true: the gates are what make the engine usable at all.

An engine of six AI stations with no gates is a machine for producing a confident, polished, completely
unverifiable note — fabrication assembled at speed. Worthless, even dangerous. The exact same six
stations with gates become a genuine productivity multiplier, because now every output is something a
professional can actually stand behind.

Analogy: a factory assembly line without quality control produces defective products faster — that's not
progress, it's liability at scale. The QC stations don't slow the good factory down; they're what make its
speed valuable. Without them, faster just means more defects shipped.

So the mental model flips. You're not running AI stations and reluctantly checking them. You're running a
verification process that uses AI to do the heavy lifting between checks. The human gates aren't friction in

the engine — they're the engine's whole reason for being trustworthy. Remove them and you don't have a
faster analyst; you have an automated rumour mill.


**The human edge — what stays yours**


This engine is the sharpest possible illustration of the module's whole philosophy: the more powerful the
automation, the more the human becomes the point. The engine can assemble a note in hours — but it
cannot decide whether the thesis is right, whether the assumptions hold, whether the risk that isn't in the
filing is the one that matters, or whether to stake your name on the call. Every station is mechanics; every
gate is judgment; the signature at the end is accountability. You haven't automated the analyst out of the
job. You've automated the drudgery out of the analyst's day, so that the irreplaceably human part — the
judgment and the responsibility — is all that's left for you to do. That's not a smaller job. It's the real one.


> **🧠 Remember: The verification gates aren't a tax on the engine — they're what convert assembled AI**

output into work a professional can stand behind.


### ⚠️ Mistake — "Letting the Engine Run Unattended"

The ultimate temptation, having built this beautiful engine: switch it fully autonomous. Point it at a company,
walk away, come back to a finished note. Maybe even automate publishing it. The engine is so capable —
why babysit it?

People reach for this because the engine genuinely looks finished. Six stations of polished output
assembled into a clean note feels complete, authoritative, done. Surely the human is now optional?

This is the single most dangerous mistake in the entire module, because it combines every risk you've
learned into one. An unattended engine fabricates numbers (Part A), assembles them through unverified
chains (16.13), agentically multiplies errors (16.14), and broadcasts them automatically (16.15) — all
wearing the costume of a finished, professional research note. You haven't built a robo-analyst. You've built
a machine that produces confident, sourced-looking, totally unverified investment advice — and in a
regulated context (SEBI-registered research, advice to clients), that's not just wrong, it's a serious liability
with your name on it.

The engine is for speed through the drudgery, with a human at every gate. The accountability — the
verification, the judgment, the signature — never goes autonomous. Ever.


> **🧠 Remember: Never run the engine unattended — that combines every AI risk into one polished,**

fabricated, auto-published note with your name on it. Speed automates; accountability never does.


### 📊 Real World — "What This Looks Like for an Indian Analyst"

Picture a junior analyst covering twelve mid-cap Indian names through earnings season — the period when
everything reports at once and the workload is crushing.

Without the engine: they can deeply analyse maybe three or four companies before the news goes stale;
the rest get a rushed once-over. Coverage suffers, and the late reports barely get looked at.

With the engine: a covered company reports → a monitoring automation (16.15) flags it → the analyst runs
the engine → within hours they have a verified first-draft note for each company. The verification gates
mean they spend their time checking and judging rather than fetching and formatting. Suddenly all twelve
names get real, timely analysis, and the analyst's judgment — the scarce resource — is spent where it
matters: on the assumptions, the thesis, and the call.

That's the genuine 10x. Not "AI writes my reports" — that's the fantasy that gets people burned. The reality
is "AI does the grunt work across my whole coverage, fast enough that my judgment reaches every name,
every quarter, while I verify every number." The analyst who runs this engine with discipline covers more,
reacts faster, and makes fewer errors than one drowning in manual work — and crucially, fewer errors than
one who let the engine run unchecked. In Indian equity research, where coverage breadth and speed are
real competitive edges, that is a career-defining advantage.


> **🧠 Remember: The real 10x is judgment reaching your whole coverage list every quarter — AI does the**

grunt work at scale, you verify and judge every name.


### 📋 Summary — "The Automated Research Engine — Key Takeaways"

This session in 60 seconds:

1. The module's separate stations, connected in sequence, form one end-to-end research engine.
2. Six stations — triage, data pack, model, valuation, context, note assembly — each chain into the next.
3. A verification gate sits after every station; the data gate (verify every figure) is the most important.
4. The gates aren't a tax — they're what make the engine's output something a professional can stand
behind.
5. Never run the engine unattended; it combines every AI risk into one polished, fabricated, auto-published
note. The 10x is judgment reaching your whole coverage, fast — not AI writing your call.

What you can now do: Assemble the stations from Parts C and D into a single, disciplined research engine
that produces a verified first-draft note at vastly higher speed — with a human gate at every step and your
accountability intact.


> **🧠 Remember: Company in, verified draft note out — six chained stations, a gate after each, your judgment**

and signature at the end.


### 🎨 Visual — "The Equity Research Engine"

Create a dark-themed infographic with a navy background (#02073D) showing a large end-to-end engine /
assembly line flowing left to right. On the far LEFT, an input labelled "                  📥 COMPANY (report, concall,
results)" glowing blue (#246BFD). It flows through six connected station-blocks in a blue→purple→pink

gradient, each labelled in order: "1. TRIAGE", "2. DATA PACK", "3. MODEL", "4. VALUATION", "5.
CONTEXT/COMPS", "6. NOTE ASSEMBLY". Between every pair of stations, and after the last, draw a
prominent white verification gate — a small shield-and-checkmark icon labelled "✓ HUMAN VERIFY" —
with the gate after Station 2 (data) drawn larger/brighter and labelled "✓ MOST CRITICAL GATE." On the
far RIGHT, an output labelled " 📄 VERIFIED FIRST-DRAFT NOTE" glowing pink (#FF6AC1). Across the
top, a title in Lavender White (#F5ECFF): "The Equity Research Engine — Company In, Verified Draft Out."
At the bottom, a banner: "AI does the grunt work at every station. You stand at every gate. Never run it
unattended." Style: clean, minimal, professional financial infographic, industrial assembly-line feel with
glowing gates.

What this visual shows: It is the capstone diagram of the entire module — the student sees every station
they built connected into one flowing engine, with the human verification gates standing between each,
making vivid that the value comes from AI-speed plus human checkpoints, never from autonomy.


> **🧠 Remember: One engine, six stations, a human gate after each — that's the whole module made into a**

single picture.


### ❓ Quiz (5 Questions)


**Q1. What does the fully automated research engine produce at the end?**
a) A finished, publishable note that needs no human input
- b) A verified first-draft note — grunt work done,
with human judgment and the final call still required
- c) A trade order
- d) A single precise price target


> ✅ **Answer:**
- b) 📝 Why: The engine produces a verified first draft at high speed — the fetching, extracting,

and structuring are done, but the human still verifies, judges, edits in their voice, and owns the actual call.


**Q2. Which is the most critical verification gate in the engine?**
a) The triage gate
- b) The data gate — verifying every extracted figure against the primary source
- c) There
are no important gates
- d) The formatting gate


> ✅ **Answer:**
- b) 📝 Why: A wrong number at the data station propagates through the model, valuation, and

final note. Verifying every figure against screener.in / the filing is the gate that prevents a fabricated input
from corrupting everything downstream.


**Q3. Why are the verification gates described as the engine's whole reason for being**
trustworthy?
a) They slow it down, which is good
- b) Without them, six AI stations just assemble confident, polished,
unverifiable output — fabrication at speed; the gates make the output something a professional can stand
behind
- c) They are optional decoration
- d) They make the note longer


> ✅ **Answer:**
- b) 📝 Why: Like QC on an assembly line, the gates don't slow the good engine — they're what

make its speed valuable, by ensuring every output can be stood behind rather than being defects shipped
faster.


**Q4. True or False: Once the engine is built and works well, it's safe to run it fully**
autonomously and even auto-publish its notes.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: This is the module's most dangerous mistake — it combines every AI risk

(fabrication, unverified chains, agentic error multiplication, automated broadcasting) into one polished,
sourced-looking but unverified note with your name on it, which in regulated research is a serious liability.


**Q5. Fill in the blank: The genuine 10x from the engine is that the analyst's __ — the scarce**
resource — reaches every company in their coverage, every quarter, because AI handles the
grunt work at scale.

> ✅ **Answer:** judgment 📝 Why: The real advantage isn't "AI writes my reports"; it's that AI does the drudgery

fast enough that the analyst's judgment and verification can reach their whole coverage list, with fewer
errors than manual work.


---

## Session 16.18: Automating the Wider Finance

Function — Monitoring, Reporting & Alerts

"Equity research is one corner of finance. The same playbook — automate the grind, verify the
output, keep the judgment human — transforms reporting, monitoring, and analysis across the entire
finance function."


### 🎣 Hook — "Beyond the Research Desk"

The engine you built is specific to equity research. But step back and the pattern is universal: repetitive data
work, periodic reporting, constant monitoring, and analysis on top.

That pattern lives everywhere in finance — in corporate FP&A, in treasury, in audit, in personal portfolio
tracking, in any role that touches numbers regularly.

So the skills from this module aren't trapped in research. The same four moves — chain prompts, deploy
agents carefully, automate the routine, build packaged tools — upgrade any finance workflow. Let's see
how the playbook generalises beyond the research desk.


> **🧠 Remember: The automation playbook — automate the grind, verify, keep judgment human —**

generalises to the entire finance function, not just research.


### 🔬 Deep Dive — "The Three Pillars of Finance Automation"

Almost every finance task that AI can help automate falls into three buckets. Recognise which you're facing
and you know which tool to reach for.

1. Monitoring — "tell me when something changes." Watching for events and flagging them. A covered
company files. A KPI crosses a threshold. A portfolio position moves sharply. A budget line exceeds its limit.
This is the home turf of no-code automation (16.15): a trigger fires, an AI step summarises or assesses, and
you're alerted. The machine watches so you don't have to stare at dashboards.

2. Reporting — "turn this data into that document, regularly." Recurring outputs: a monthly
performance summary, a weekly portfolio update, a variance commentary, a board pack narrative. This is
the home turf of workflows and packaged tools (16.13, 16.16): a documented pipeline takes the period's
verified data and produces the standard report in the standard format, every time, in a fraction of the
manual hours.

3. Analysis — "make sense of this." The judgment-heavy work: interpreting a variance, assessing a risk,
deciding what a trend means, choosing a course of action. AI assists here — structuring, computing,
drafting — but this is where the human stays firmly in control, exactly as in research. Analysis is
augmented, never automated.

The skill is diagnosis: look at any finance task and sort it into monitoring, reporting, or analysis. Monitoring
→ automate the watch. Reporting → automate the assembly (with verification). Analysis → augment the
human, never replace them. The whole finance function, viewed this way, becomes a map of what to
automate and what to protect.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Pick one recurring finance task in your life — even a personal one (a monthly portfolio review, a
watchlist, an expense summary).
2. Diagnose it: is it Monitoring, Reporting, or Analysis?
3. If monitoring → build a simple alert automation (16.15) with prompt 1. If reporting → build a
workflow/packaged tool (16.13/16.16) with prompt 2. If analysis → set up an assistant that augments
you with prompt 3, keeping the decision yours.
4. Run it once on real data and verify every figure it touched.
5. Note how the same discipline you learned for research applied cleanly here. That portability is the point.


> ⏱️ Time saved: Automating a recurring monthly report or monitoring task can save hours every cycle —

and the discipline you practise on a low-stakes personal task is exactly the one that makes you valuable in
a professional finance role.


### ⚡ Copy-Paste Prompts

⚠️ These adapt the engine's discipline to common finance tasks beyond research. Each keeps
figures flagged for the human gate — even for "routine" internal work.


**1. The monitoring-alert assessor (AI step in a finance-monitoring flow):**


```
You are assessing a finance alert for a [role, e.g. FP&A analyst]. Given this
data change: [trigger data], state in 2-3 lines (1) what changed, (2) whether
it looks routine or warrants attention and why, (3) what the human should
check. Do not conclude or recommend action — flag for human review. Mark any
figure [VERIFY].
```


**2. The recurring-report drafter (verified data → standard report):**


```
You are drafting a [monthly MIS / portfolio / variance] report in our standard
format. Using ONLY the verified data below, produce: [your fixed sections].
Use ₹ and Indian conventions. Present variances with a one-line plain-language
explanation each, clearly labelled as preliminary pending human review. List
every figure and its source at the end. Do not infer missing numbers.
[paste verified data]
```


**3. The anomaly-flagger (assist, never conclude):**


```
You are assisting a reviewer. Scan the data/document below and list anything
that looks unusual or inconsistent — outliers, figures that don't tie, unusual
movements — as items for a HUMAN to investigate. For each, say why it caught
your attention and what to check. Do NOT conclude that anything is wrong; only
point the reviewer to where to look.
```


> **🧠 Remember: Finance automation has three pillars — Monitoring (automate the watch), Reporting**

(automate the assembly, verified), Analysis (augment the human, never replace).


### 💡 Concept — "The Same Verification Discipline, Everywhere"

Here's what does not change when you leave research: every figure in an automated report or alert is still
AI-touched until a human verifies it.

A board pack with a wrong number is a governance failure. A variance commentary built on a misread figure
misleads the whole leadership team. A portfolio alert based on a fabricated price triggers a bad decision.
The stakes shift by context, but the discipline is identical to research: the automation gathers, structures,
and drafts; a human verifies before anyone trusts, presents, or acts.

Analogy: in research, the verification gate protects the investment call. In corporate finance, the same gate
protects the board's decisions, the auditor's sign-off, the treasurer's cash management. It's the same gate,
guarding a different door. The instinct you've built — don't trust an AI number until you've checked it against
the source — transfers wholesale.

This is why the module's philosophy is so portable. You haven't just learned to automate equity research.
You've internalised a general principle: AI multiplies your output, and verification protects your integrity, in
any numbers-driven role. Master that balance once and it serves you for an entire career, across whatever
finance function you end up in.


**The human edge — what stays yours**


The wider you spread automation across finance, the clearer it becomes that judgment is the through-line of
the whole profession. Monitoring tells you what changed; only a human decides whether it matters.
Reporting assembles the numbers; only a human interprets what they mean for the business. And analysis
— the deciding, the recommending, the owning of consequences — was always the human's job and
always will be. Finance, stripped of its drudgery by automation, reveals itself as fundamentally a judgment
profession. The person who automates the grind everywhere isn't making themselves replaceable —
they're concentrating their entire working day onto the one thing that was never automatable: deciding what
it all means and what to do about it.


> **🧠 Remember: The verification gate is the same in every finance role — automation drafts, a human**

verifies before anyone trusts, presents, or acts. The discipline is fully portable.


### ⚠️ Mistake — "Assuming Lower Stakes Mean No Verification"

Outside high-profile equity research, people relax. "It's just an internal monthly report." "It's only my
personal portfolio tracker." "Nobody important reads this." So they let automated AI output flow through
unchecked.

They do it because the visible stakes feel lower than a published research note seen by clients, so the
verification discipline feels like overkill for routine internal work.

But low-visibility errors are often the most corrosive, precisely because no one's checking. A quietly wrong
figure that flows into every monthly report for a year becomes a trusted baseline that's silently false — and
decisions get made on it. An unverified personal tracker leads you to believe you're up when you're down.
The error compounds in the dark, unnoticed, until it surfaces as a nasty shock. There's no client to catch it,
which makes it worse, not safer.

The discipline must be constant, not proportional to how important the output looks. A small verification
habit on every automated finance output — internal or external, high-stakes or routine — is what keeps the
quiet errors from accumulating into expensive ones. The gate doesn't get to take a day off because the
report is "just internal."


> **🧠 Remember: Lower visibility doesn't mean lower need to verify — unchecked errors in routine outputs**

compound silently into expensive shocks. Verify everything, always.


### 📊 Real World — "Finance Automation Across Indian Roles"

The playbook shows up across the finance careers an Indian student might enter:

FP&A / corporate finance: automate the monthly MIS pack assembly and variance commentary
drafting (verified before it reaches leadership), and monitor budget lines for breaches. Hours of
repetitive reporting compressed, judgment spent on the why.
Treasury: monitor cash positions and currency moves with alerts; auto-draft routine liquidity summaries
for human review.
Audit & assurance: AI assists in summarising documents and flagging anomalies for the auditor to
investigate — never concluding, always pointing the human to where to look.
Investment / portfolio roles: monitor holdings for news and price triggers; auto-assemble periodic
performance reports (figures verified) so the analyst focuses on allocation decisions.
Personal finance / retail investor: a student can automate their own portfolio tracking, a watchlist alert
system, and a monthly review digest — practising the exact discipline on low stakes before applying it
professionally.

Across all of them, the same three pillars and the same one gate. The Indian finance professional who
carries this playbook into any role — research, corporate, treasury, audit — arrives with a capability most of
their peers don't have: the ability to automate the grind responsibly. That portability is what makes these
skills a career asset rather than a niche trick.


> **🧠 Remember: The same playbook upgrades FP&A, treasury, audit, and portfolio roles across Indian**

finance — automate the grind, verify, judge. It travels with you anywhere.


### 📋 Summary — "Automating the Finance Function — Key Takeaways"

This session in 60 seconds:

1. The research engine's pattern — automate the grind, verify, keep judgment human — generalises
across all of finance.
2. Finance automation has three pillars: Monitoring (automate the watch), Reporting (automate the
assembly), Analysis (augment the human).
3. Diagnose any task into one of the three, then apply the right tool — and protect analysis from full
automation.
4. The verification gate is identical everywhere; only the door it guards changes.
5. Don't relax verification for "low-stakes" internal work — unchecked errors compound silently into
expensive shocks.

What you can now do: Take the automation skills from this module beyond equity research — diagnosing
and upgrading monitoring, reporting, and analysis workflows across any finance role, while keeping
verification constant and judgment human.


> **🧠 Remember: Three pillars, one gate, everywhere in finance — the playbook travels with you into any**

numbers-driven career.


### 🎨 Visual — "The Three Pillars of Finance Automation"

Create a dark-themed infographic with a navy background (#02073D) showing three vertical pillars /
columns supporting a single horizontal beam. The three pillars glow in the cosmic palette: Pillar 1 (blue
#246BFD) labelled "MONITORING" with a bell/radar icon and subtitle "Tell me when something changes →
automate the watch." Pillar 2 (purple #6A5CFF) labelled "REPORTING" with a document icon and subtitle
"Turn data into a standard report → automate the assembly." Pillar 3 (pink #FF6AC1) labelled "ANALYSIS"
with a brain icon and subtitle "Make sense of it → augment the human." The horizontal beam resting on all
three pillars is a glowing white bar labelled " 👤 ONE VERIFICATION GATE — verify before anyone trusts,
presents, or acts." Above the structure, a title in Lavender White (#F5ECFF): "The Three Pillars of Finance
Automation." Below, a caption: "Diagnose the task. Automate monitoring & reporting. Protect analysis.
Verify everything." Style: clean, minimal, professional financial infographic, architectural pillars-and-beam
feel.

What this visual shows: It gives the student a portable diagnostic framework for any finance task — which
pillar is this? — while the single beam of verification resting across all three reinforces that the discipline is
constant regardless of the task or its visibility.


> **🧠 Remember: Three pillars — monitoring, reporting, analysis — held together by one constant verification**

gate across all of finance.


### ❓ Quiz (5 Questions)


**Q1. What are the three pillars of finance automation?**
a) Buying, selling, holding
- b) Monitoring (watch for changes), Reporting (assemble standard outputs),
Analysis (make sense of it)
- c) Email, calendar, spreadsheet
- d) Past, present, future


> ✅ **Answer:**
- b) 📝 Why: Almost every automatable finance task sorts into monitoring (automate the watch),

reporting (automate the assembly, verified), or analysis (augment the human, never replace).


**Q2. Which pillar should be augmented by AI but never fully automated?**
a) Monitoring
- b) Reporting
- c) Analysis
- d) None of them


> ✅ **Answer:**
- c) 📝 Why: Analysis is judgment-heavy — interpreting, assessing, deciding, owning

consequences. AI assists by structuring and drafting, but the human stays firmly in control, exactly as in
research.


**Q3. How does the verification discipline change when you move from equity research to**
corporate finance?
a) It disappears
- b) It's identical — automation drafts, a human verifies before anyone trusts, presents, or
acts; only the door it guards changes
- c) It becomes optional for internal reports
- d) It only applies to external
documents


> ✅ **Answer:**
- b) 📝 Why: The same gate protects the board's decisions or the treasurer's cash management

instead of the investment call. The instinct — don't trust an AI number until checked against the source —
transfers wholesale.


**Q4. True or False: It's acceptable to skip verification on a routine internal report or a personal**
tracker because the visible stakes are low.
a) True
- b) False


> ✅ **Answer:**
- b) False 📝 Why: Low-visibility errors are often the most corrosive — a quietly wrong figure

flowing into every monthly report becomes a trusted but false baseline, compounding in the dark until it
surfaces as an expensive shock. Verification must be constant, not proportional to visibility.


**Q5. Fill in the blank: To automate any finance task, first __ it into one of the three pillars, then**
apply the right tool — automating monitoring and reporting while protecting analysis.

> ✅ **Answer:** diagnose (accept: sort / categorise) 📝 Why: The core skill is diagnosis — identifying whether a

task is monitoring, reporting, or analysis tells you which tool to reach for and what to automate versus
protect.


---

## Session 16.19: Your AI Analyst Operating System

— The 10x Productivity Engine

"You now have all the parts. This session is about the operating system that runs them — the daily
and weekly rhythm that turns scattered AI skills into a compounding personal advantage. Tools don't
10x you. A system does."


### 🎣 Hook — "Parts Don't Make a Machine"

You've built an impressive collection: a prompt library, a research engine, automations, packaged tools, a
verification discipline. Powerful parts.

But a pile of brilliant parts isn't a machine. A drawer full of premium tools doesn't build a house — a
workflow does. The advantage isn't in owning the capabilities; it's in running them as a coherent system,
day after day.

This session assembles your personal AI Analyst Operating System — the routine, the rhythm, and the
rules that turn everything you've learned into a compounding edge. Same skills you have now, organised
into a system that actually multiplies your output.


> **🧠 Remember: Owning AI capabilities isn't the edge — running them as a daily system is. Parts don't make**

a machine; a workflow does.


### 🔬 Deep Dive — "The Operating System, Layer by Layer"

Your AI Analyst OS has four layers. Together they form a complete personal system.

Layer 1 — The Library (your knowledge base). Everything reusable, saved and organised: your prompt
templates from Part B, your documented pipeline SOPs from 16.13, your packaged-expert tools from 16.16.
This is your toolkit — nothing gets rebuilt from scratch because everything good is captured and findable.

Layer 2 — The Engine (your production line). Your assembled research engine from 16.17 and your
finance automations from 16.18 — the machinery that turns raw inputs into verified drafts and reports. This
is how the work gets produced at speed.

Layer 3 — The Gates (your quality system). Your verification discipline, applied consistently — the
human checkpoints that make every output trustworthy. This is what protects your integrity and is non-
negotiable across all the other layers.

Layer 4 — The Rhythm (your operating routine). The daily and weekly cadence that runs it all: Morning
— review your automated briefs and alerts (monitoring layer did the watching overnight). During the day —
run the engine on whatever needs analysis, standing at each gate. Weekly — refine a prompt, improve a

tool, add an automation, prune what's not working. This is how the system stays alive and improving
instead of decaying.

The four layers interlock: the Library feeds the Engine, the Gates protect everything, and the Rhythm keeps
it all running and improving. That interlocking system — not any single tool — is what produces a genuine,
sustained 10x. A tool gives you a one-time boost; a system compounds.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Gather everything you've built across this module — prompts, the pipeline SOP, packaged tools,
automations — into one place.
2. Run the system-audit prompt to sort them into the four layers (Library, Engine, Gates, Rhythm) and
reveal gaps.
3. Build or fix the one highest-impact missing piece it identifies.
4. Define your Rhythm explicitly: what you check each morning, what you run during the day, what you
refine each week. Write it down.
5. Put a recurring weekly slot in your calendar to run the refinement prompt. Your OS is now live — and
set up to compound.


> ⏱️ Time saved: This doesn't save time on one task — it compounds time savings across every task, every

week, indefinitely. A well-run AI Analyst OS is the difference between a one-time productivity bump and a
year of accelerating output.


### ⚡ Copy-Paste Prompts

⚠️ These help you build and maintain the system itself rather than do a single analysis. Use them to
set up your OS and keep it improving.


**1. The system-audit prompt (assess and organise what you have):**


```
Act as a productivity coach for an equity analyst building an AI system.
I'll describe my current setup: [list your saved prompts, any pipelines,
tools, and automations you have]. Help me organise these into four layers —
Library, Engine, Gates, Rhythm — point out what's missing in each, and
suggest the single highest-impact thing to build next. Keep verification
central to every suggestion.
```


**2. The weekly-refinement prompt (the improvement rhythm):**


```
Act as my weekly AI-system reviewer. This week I used these prompts/tools:
[describe]. Here's what worked and what was clunky: [describe]. Suggest: one
prompt to refine and how, one tool or automation to improve, and one thing to
prune. Keep it to the highest-leverage three changes only.
```


**3. The prompt-library organiser (maintain Layer 1):**


Help me organise my prompt library. Here are the prompts I use: [paste them].
Group them by research workflow stage (triage, data, modelling, valuation,
drafting, monitoring), give each a clear name, and flag any that overlap or
could be merged into a single stronger template. Note where each should remind
the user to verify figures.


> **🧠 Remember: The AI Analyst OS has four interlocking layers — Library, Engine, Gates, Rhythm — and it's**

the system, not any single tool, that compounds into a 10x edge.


### 💡 Concept — "Compounding — Why a System Beats a Tool"

The deepest idea in this module: AI productivity compounds when it's a system, and stays flat when it's a
one-off.

A single great prompt helps once. But save it to your Library, and it helps every time forever. Bake it into a
packaged tool, and it helps others too. Wire it into the Engine, and it helps across your whole coverage.
Each improvement you capture doesn't just add — it multiplies against everything else already in the
system.

Analogy: it's the difference between earning interest and earning compound interest. A tool used once is
simple interest — a fixed, one-time gain. A skill captured into a system is compound interest — it earns on
itself, building over months into something far larger than the sum of the individual gains. The student who
saves, organises, and refines their AI system over a year doesn't end up a little faster; they end up
operating at a level that looks like magic to someone starting fresh.

This reframes the whole module. The point was never any individual prompt or trick — those date quickly
as models change. The point is building a system and a discipline that compound: capture what works,
organise it, run it on a rhythm, protect it with verification, and improve it continuously. Do that, and your
edge grows every single week, automatically. That compounding is the real 10x — and unlike any specific
tool, it's durable.


**The human edge — what stays yours**


A system runs on tools, but it's designed, maintained, and improved by judgment — yours. AI can run inside
every layer, but it cannot decide what your system should prioritise, which gate matters most, what to build
next, or what to prune. The discipline to keep verification central while everything speeds up, the wisdom to
be slow to switch tools and fast to improve the system, the steady weekly habit of refinement — these are
human virtues, not features of any app. Your operating system is, in the end, a reflection of your own
judgment and discipline made operational. The tools will keep changing; the judgment that organises them
into a compounding advantage is the durable, human core. That's what you're really building.


> **🧠 Remember: A tool is simple interest — a one-time gain; a system is compound interest — it builds on**

itself. Capture, organise, run, verify, refine, and your edge compounds weekly.


### ⚠️ Mistake — "Tool-Chasing Instead of System-Building"

The most common way people waste the AI wave: they chase every shiny new tool, jumping from one to
the next, never building anything that lasts. New model drops? Drop everything and chase it. New app
trends? Abandon the last one.

People do this because the AI space moves fast and the fear of missing out is intense — there's always a
newer, flashier tool, and chasing it feels like progress.

But tool-chasing is the enemy of compounding. Every jump resets you to zero — no accumulated library, no
refined pipeline, no improving system, just a perpetual beginner with the latest app. You stay busy and feel
cutting-edge while building nothing durable. Meanwhile, the person quietly refining one solid system pulls
steadily ahead, compounding while you reset.

The discipline: be slow to switch tools, fast to improve your system. Pick capable-enough tools, then
pour your energy into building the Library, the Engine, the Gates, and the Rhythm around them. When a
genuinely better tool arrives, you slot it into your existing system rather than starting over — your system is
the asset, the tool is just a component. Chase systems, not tools. The tools will keep changing; a good
system absorbs the change and keeps compounding.


> **🧠 Remember: Tool-chasing resets you to zero every time; system-building compounds. Be slow to switch**

tools, fast to improve your system.


### 📊 Real World — "The Compounding Analyst vs The Tool-Chaser"

Picture two students who finish this module on the same day.

Student A — the tool-chaser: spends the year hopping between every new AI app, always trying the latest
thing, always impressed, never settling. A year on, they know of many tools but have no saved library, no
repeatable pipeline, no automations running. They're a perpetual beginner with current vocabulary. Asked in
an interview what they've built, they have demos and opinions, but nothing that lasts.

Student B — the system-builder: picks solid tools and spends the year building. They save every good
prompt, document their research pipeline, build two or three packaged tools, set up a handful of
automations that run daily, and refine the whole thing weekly. A year on, they have an operating system —
a personal research machine that covers more companies, faster, with verified output, than they could have
imagined. Asked what they've built, they walk the interviewer through a real, compounding system they run
every day.

In the Indian job market, where standing out is everything, Student B is in a different league — not because
they had better tools (the tools were similar), but because they built a system and a discipline that
compounded all year. That's the entire thesis of this module made personal: the durable edge isn't the AI;
it's the disciplined system you build around it and the verification habit that makes its output trustworthy. Be
Student B.


> **🧠 Remember: The tool-chaser ends the year a perpetual beginner; the system-builder ends it with a**

compounding research machine. Be the system-builder.


### 📋 Summary — "Your AI Analyst Operating System — Key Takeaways"

This session in 60 seconds:

1. Owning AI capabilities isn't the edge — running them as a daily system is; parts don't make a machine.
2. The AI Analyst OS has four interlocking layers: Library, Engine, Gates, Rhythm.
3. A system compounds like compound interest; a one-off tool is simple interest — a single gain.
4. Tool-chasing resets you to zero each time; be slow to switch tools, fast to improve your system.
5. The compounding system-builder ends the year in a different league from the tool-chaser — that's the
durable edge.

What you can now do: Organise everything you've learned into a coherent personal operating system —
Library, Engine, Gates, and Rhythm — and run and refine it on a daily and weekly cadence so your
productivity advantage compounds rather than resets.


> **🧠 Remember: Build the four-layer system, run it on a rhythm, protect it with verification, refine it weekly —**

and your edge compounds into a 10x that no single tool can match.


### 🎨 Visual — "The AI Analyst Operating System"

Create a dark-themed infographic with a navy background (#02073D) showing four stacked horizontal
layers forming a single system, like a tech stack diagram. From bottom to top: Layer 1 (foundation, blue
#246BFD) labelled "THE LIBRARY — saved prompts, SOPs, packaged tools." Layer 2 (purple #6A5CFF)
labelled "THE ENGINE — research pipeline + automations." Layer 3 (pink #FF6AC1) labelled "THE GATES
— verification on every output." Layer 4 (top, lavender #F5ECFF outline) labelled "THE RHYTHM — daily
briefs · run the engine · weekly refine." To the right of the stack, a vertical upward arrow with a
compounding curve (a small exponential growth curve) labelled "COMPOUNDS WEEKLY." Across the top,
a title in Lavender White: "Your AI Analyst Operating System." At the bottom, a caption: "Don't chase tools.
Build the system. A system compounds; a tool doesn't." Style: clean, minimal, professional financial
infographic, layered tech-stack feel with a growth curve.

What this visual shows: It presents the student's complete personal system as a single coherent stack,
making clear how the four layers interlock, and the compounding growth curve drives home the session's
core insight — a system grows on itself over time, unlike any individual tool.


> **🧠 Remember: Four stacked layers — Library, Engine, Gates, Rhythm — plus a compounding curve: the**

system, not the tool, is what grows.


### ❓ Quiz (5 Questions)


**Q1. What are the four layers of the AI Analyst Operating System?**
a) Hardware, software, network, power
- b) Library, Engine, Gates, Rhythm
- c) Buy, hold, sell, review
- d) Past,
present, future, forecast


> ✅ **Answer:**
- b) 📝 Why: The Library (saved prompts, SOPs, tools), the Engine (pipeline + automations), the

Gates (verification discipline), and the Rhythm (daily/weekly routine) interlock into one compounding
system.


**Q2. Why does a system beat a single tool over time?**
a) Systems are cheaper
- b) A system compounds like compound interest — each captured improvement
multiplies against everything already in it — while a one-off tool is simple interest, a single gain
- c) Tools are
always worse
- d) Systems require no effort


> ✅ **Answer:**
- b) 📝 Why: A saved, organised, refined system earns on itself over months, growing into far

more than the sum of individual gains — the durable 10x — whereas a tool used once gives only a fixed,
one-time boost.


**Q3. What is the mistake of "tool-chasing"?**
a) Using too few tools
- b) Jumping to every shiny new tool, which resets you to zero each time and prevents
any system from compounding
- c) Refining one system too much
- d) Saving your prompts


> ✅ **Answer:**
- b) 📝 Why: Every jump abandons your accumulated library, pipeline, and automations —

leaving you a perpetual beginner with the latest app, while the system-builder compounds steadily ahead.


**Q4. True or False: The right discipline is to be slow to switch tools and fast to improve your**
system.
a) True
- b) False


> ✅ **Answer:**
- a) True 📝 Why: Pick capable-enough tools and pour energy into building the Library, Engine,

Gates, and Rhythm around them. When a genuinely better tool arrives, slot it into your existing system
rather than starting over — the system is the asset, the tool is a component.


**Q5. Fill in the blank: The fourth layer, the __, is the daily and weekly cadence — morning**
briefs, running the engine, weekly refinement — that keeps the whole system alive and
improving.

> ✅ **Answer:** Rhythm 📝 Why: The Rhythm is the operating routine that runs and continuously improves the

other three layers, ensuring the system compounds rather than decays.


---

## Session 16.20: Standing Out — AI Skills in Your

Resume, CV & Interviews

"You've built rare, real skills. This final session makes sure the world knows it. The job doesn't go to
the most capable candidate — it goes to the one who proves capability most convincingly. Let's make
that you."


### 🎣 Hook — "The Skill Nobody Can See"

You've done the hard part. You can operate an AI research engine, build tools, automate workflows, and —
rarest of all — do it with verification discipline. Genuinely valuable, genuinely uncommon.

But here's the brutal reality of hiring: a skill nobody can see might as well not exist. The job doesn't go to
the most capable person; it goes to the one who proves capability most convincingly, on a page and across
a desk.

This final session translates everything you've built into the language of resumes, CVs, and interviews — so
your rare ability becomes an offer letter. The work is done. Now you make it visible.


> **🧠 Remember: A skill nobody can see might as well not exist — the job goes to whoever proves capability**

most convincingly. Now make yours visible.


### 🔬 Deep Dive — "Show, Don't Claim — The Portfolio Principle"

Every applicant in 2026 claims AI skills. "Proficient in AI tools" is on a thousand resumes and means
nothing. The way to stand out is to show, not claim — to point at things you've actually built.

This is where the Mini-Projects from this entire module become your secret weapon. You didn't just learn;
you built — and you have the artefacts to prove it:

A documented research pipeline (16.13).
A working no-code automation (16.15).
A packaged-expert AI tool you created (16.16).
A verified research note produced by your engine (16.17).
A documented AI Analyst Operating System (16.19).

That's a portfolio. While other candidates say "I know AI," you say "I built an AI research engine that
produces verified first-draft notes across a coverage list — here, let me show you." One of those is a claim;
the other is proof. The difference between them is the difference between getting screened out and getting
hired.

The principle: collect your builds into a simple portfolio — a folder, a few screenshots, a short write-up of
each — that you can show or link. Concrete artefacts beat adjectives every single time. Your whole journey
through this module has, quietly, been building exactly this evidence.


### 🛠️ 🛠️ Put this into practice — the same-day workflow

1. Gather your Mini-Project artefacts from across this module — the pipeline doc, the automation, the
packaged tool, the engine's research note, your OS document.
2. Put them in one simple "AI Portfolio" folder with a one-paragraph write-up of each (what it does, what it
saved, how you verify it).
3. Run the resume-bullet crafter on your two strongest builds and add the evidenced lines to your resume.
4. Run the interview-story builder on your single best build and rehearse the STAR answer aloud, landing
the verification differentiator.
5. Run the differentiator pressure-test and refine your framing against the tough questions. You're now
ready to prove your AI skills, not just claim them.


> ⏱️ Time saved: This is the step that converts months of skill-building into an actual job offer — arguably

the highest-return hour in the whole module. The skill was the investment; this is where it pays out.


### ⚡ Copy-Paste Prompts

⚠️ These help you craft and pressure-test how you present your AI skills. Keep every claim honest
and backed by something you actually built — the prompts assist, your real artefacts are the proof.


**1. The resume-bullet crafter:**


```
Act as a finance recruiter and resume coach. I built this in a project:
[describe what you actually built — e.g. an AI research pipeline, a packaged
tool, an automation, and how you verified its output].
Help me write 1-2 crisp, specific resume bullets that show this capability for
an Indian equity research / finance role. Emphasise the real build and the
verification discipline. Avoid buzzword stuffing; only state what I can prove.
```


**2. The interview-story builder:**


```
Help me prepare an interview answer for "How do you use AI in your work?"
for an equity research role. The build I'll describe: [your project].
Structure a STAR-style answer (Situation, Task, Action, Result) that tells the
story of what I built, the time it saved, and — critically — how I kept it
accurate by verifying every figure against primary sources. End on the point
that I use AI powerfully but understand exactly where it fails.
```


**3. The differentiator pressure-test:**


```
Act as a tough finance interviewer. I'm going to claim I have AI skills with
verification discipline. Ask me 5 probing questions a sceptical PM or research
head would ask to test whether I really understand AI's limits and actually
verify, versus just saying the words. Then tell me how convincing my framing
sounds and where it's weak.
```


> **🧠 Remember: Everyone claims AI skills; almost no one shows them. Turn your Mini-Projects into a**

portfolio — concrete builds beat adjectives every time.


### 💡 Concept — "The Verification Differentiator — Your Real Edge"

Here's the positioning that will genuinely set you apart, and it's the one almost no other candidate will think
to use: you are the candidate who understands AI's limits.

Most people selling AI skills talk only about what AI can do. But anyone hiring for finance — where a wrong
number has real consequences — is quietly terrified of the candidate who'll trust AI blindly and put a
fabricated figure in front of a client or a board. The reckless AI-user is a liability, and good interviewers know
it.

So your differentiator isn't "I use AI." It's "I use AI powerfully and I verify everything it produces —
because I understand exactly where it fails." That sentence does something magic in a finance
interview: it signals capability and judgment, enthusiasm and safety. It tells the interviewer you'll get the
productivity benefits without being the person who blows up their credibility with a hallucinated number.

Analogy: a hiring manager choosing between two candidates who both drive fast — one who only knows
the accelerator, and one who knows the accelerator and the brakes and when to use each. In finance, they
hire the one with the brakes, every time. The whole philosophy threaded through this module — "AI is an
assistant, not an analyst; verify every number; the human edge is the judgment" — isn't just good practice.
It's your single most powerful interview differentiator. Lead with it.


**The human edge — what stays yours**


In a world where AI can do so much, the candidates who stand out are the ones who bring what AI cannot:
judgment, discipline, and the wisdom to know the difference between a tool and a decision. Your entire
journey through this module has been building exactly that — not just the ability to use AI, but the judgment
to use it well and the discipline to verify it always. That combination is rare and it is precisely what finance
employers are searching for. So present yourself not as someone who can run AI tools — those are
common — but as someone who wields AI powerfully while understanding its limits and owning the
verification. That is the human edge, distilled. It got you through this module, and it's exactly what will get
you the job.


> **🧠 Remember: Your real edge isn't "I use AI" — it's "I use AI powerfully AND verify everything, because I**

know where it fails." In finance, they hire the candidate with the brakes.


### ⚠️ Mistake — "Buzzword Stuffing"

The tempting shortcut: cram your resume with every AI term you've heard — "LLMs, RAG, agents, prompt
engineering, automation, APIs" — in a dense list, hoping it signals expertise.

People do this because the terms sound impressive and listing them feels like the fastest way to look
current and qualified.

But buzzword stuffing backfires badly with anyone who actually knows the field. A list of terms with nothing
concrete behind it screams surface-level — and worse, it sets a trap you'll fall into the moment an
interviewer asks "tell me about a time you used RAG" or "walk me through an agent you built." If you listed
it but can't demonstrate it, you've manufactured your own most painful interview moment, and your
credibility collapses in real time. Hollow keywords don't just fail to help; they actively invite exposure.

The fix: only claim what you can demonstrate, and attach evidence to every claim. Don't write
"proficient in AI agents." Write "built a bounded research agent that drafts first-pass company briefs, with
human verification of every figure" — and have the artefact ready to show. Fewer claims, each backed by a
real build, beats a long list of hollow keywords every time. Depth you can prove always beats breadth you
can't.


> **🧠 Remember: Buzzword stuffing invites exposure the moment you're asked to demonstrate it — only claim**

what you can show, and attach evidence to every claim.


### 📊 Real World — "How to Present AI Skills in the Indian Finance Job

Market"

Concretely, here's how to weave your AI capability through each part of your application for Indian equity
research and finance roles.

On the resume / CV: Add a short, specific line under relevant projects or skills — not a buzzword dump,
but an evidenced statement. E.g.: "Built an AI-augmented equity research workflow that produces verified
first-draft initiation notes on NSE-listed companies, with primary-source verification (screener.in/filings) of
every figure." It names a real build, shows the discipline, and is India-specific.

In the cover letter / SOP: One or two lines on how you combine AI productivity with verification discipline
— positioning yourself as someone who gets the speed without the recklessness. This is your differentiator
in prose.

On LinkedIn: Where appropriate, a short post or a project entry walking through something you built (e.g.
your research engine or a packaged tool) demonstrates the skill publicly and builds a visible track record —
exactly what stands out to Indian recruiters scanning for genuine AI capability.

In the interview: When AI comes up — and it will — don't recite tools. Tell the story of something you built:
the problem, what you made, how it saved time, and — crucially — how you kept it accurate by verifying
every figure. Then, if you can, show it. Land the differentiator out loud: "AI does the grunt work; I do the
judgment and verify everything, because I know exactly where it fails." In a market where most candidates

either fear AI or trust it blindly, the one who wields it with discipline is exactly who a SEBI-regulated
research desk or a finance team wants to hire.


> **🧠 Remember: Across resume, cover letter, LinkedIn, and interview — name real builds, lead with the**

verification differentiator, and tell the story rather than reciting tools.


### 📋 Summary — "Standing Out with AI Skills — Key Takeaways"

This session in 60 seconds:

1. A skill nobody can see might as well not exist — make your capability visible.
2. Show, don't claim — turn your module Mini-Projects into a portfolio of real builds.
3. Your strongest differentiator is the verification discipline: "I use AI powerfully and I verify everything,
because I know where it fails."
4. Avoid buzzword stuffing — it invites exposure; only claim what you can demonstrate, with evidence
attached.
5. Weave evidenced AI capability through resume, cover letter, LinkedIn, and interview — tell the story of
what you built, India-specific.

What you can now do: Translate the rare, real AI skills you've built in this module into a compelling,
evidence-backed presence across your resume, CV, LinkedIn, and interviews — leading with the
verification discipline that makes you the candidate finance employers actually want.


> **🧠 Remember: You built the rare skill with the rare discipline — now show it, prove it, and lead with**

verification to become impossible to ignore.


### 🎨 Visual — "Claim vs Proof"

Create a dark-themed infographic with a navy background (#02073D) split into two contrasting halves with
a clear dividing line. LEFT half, dimmer, titled "THE CLAIM" in muted blue (#246BFD): a generic resume
snippet showing a dense list of buzzwords — "LLMs · RAG · Agents · Prompt Engineering · APIs ·
Automation" — with a small grey label beneath: "Sounds impressive. Proves nothing. Invites exposure."
RIGHT half, brighter and glowing, titled "THE PROOF" in vivid pink (#FF6AC1): a small portfolio of cards in
a purple-to-pink gradient, each labelled with a real artefact — "              📄 Verified research note (my engine)", "🔧
Packaged AI tool I built", " ⚙️ Live automation", "🗂️ My AI Operating System" — with a bright label beneath:
"Concrete builds. Demonstrable. Hireable." Across the top, a title in Lavender White (#F5ECFF): "Don't
Claim AI Skills — Prove Them." At the bottom, a banner with a brake/shield icon: "Your edge: 'I use AI
powerfully AND verify everything — because I know where it fails.'" Style: clean, minimal, professional
financial infographic, side-by-side contrast.

What this visual shows: It makes the core career lesson unmistakable — a list of claimed buzzwords versus
a portfolio of demonstrable builds — and anchors the verification differentiator as the closing line, leaving
the student with the exact sentence that sets them apart in a finance interview.


> **🧠 Remember: Claim is a buzzword list that proves nothing; proof is a portfolio of real builds — and the**

verification line is your closing edge.


### ❓ Quiz (5 Questions)


**Q1. What is the "show, don't claim" principle for AI skills?**
a) Claim as many AI skills as possible on your resume
- b) Point at concrete things you've actually built (a
portfolio) rather than just stating "proficient in AI"
- c) Hide your AI skills entirely
- d) Only talk about AI in
interviews, never on the resume


> ✅ **Answer:**
- b) 📝 Why: Everyone claims AI skills; almost no one shows them. Turning your Mini-Projects

into a portfolio of real builds — pipelines, tools, automations, a research engine — proves capability where
adjectives can't.


**Q2. What is described as your single most powerful differentiator in a finance interview?**
a) Knowing the most AI tools
- b) The verification discipline — "I use AI powerfully AND verify everything,
because I understand where it fails"
- c) Having the newest AI subscription
- d) Typing the fastest prompts


> ✅ **Answer:**
- b) 📝 Why: Finance employers fear the candidate who trusts AI blindly. Signalling that you get

the productivity and keep the discipline marks you as capable and safe — the candidate "with the brakes,"
whom they hire every time.


**Q3. Why does buzzword stuffing backfire?**
a) It's too short
- b) A list of terms with nothing concrete behind it screams surface-level and sets a trap when
an interviewer asks you to demonstrate something you listed but can't
- c) Buzzwords are illegal on resumes
d) It always works


> ✅ **Answer:**
- b) 📝 Why: Hollow keywords invite exposure the moment you're asked "walk me through an

agent you built." Only claim what you can demonstrate, with a real artefact attached to every claim.


**Q4. True or False: A skill that you can't make visible to an employer is, for hiring purposes,**
almost as good as not having it.
a) True
- b) False


> ✅ **Answer:**
- a) True 📝 Why: The job goes to whoever proves capability most convincingly, not necessarily

to the most capable person. A rare skill must be made visible — through a portfolio, evidenced resume
lines, and a well-told interview story — to count.


**Q5. Fill in the blank: Instead of reciting tools in an interview, you should tell the __ of**
something you built — the problem, what you made, the time it saved, and how you verified
every figure.

> ✅ **Answer:** story 📝 Why: A concrete STAR-style story of a real build, landing the verification differentiator,

is far more convincing than a list of tool names — it demonstrates capability and judgment together.


---

## 📁 MODULE 16 PROJECT: "Build & Run Your AI

Analyst Operating System"
🎯 Objective: Assemble everything from this module's five parts into one working AI Analyst Operating
System, then run a real Indian stock through your complete research engine end-to-end — from raw filings
to a fully verified first-draft research note — and finally package the whole thing into a portfolio that proves
your capability to an employer. This capstone proves three things at once: that you can use AI to multiply
output, that you personally verify every fact, and that you can present these rare skills as a genuine career
advantage.

🏢 Company Assigned: Choose one NSE/BSE-listed company you can access full filings for — e.g.
Asian Paints, Titan, Varun Beverages, or a mid-cap you follow. (Pick one with a recent annual report
and concall available on its investor-relations page or BSE/NSE, so you can verify every number against
the primary source.)


### To-Do List


Part A & B — Foundations and your prompt library: 1. Write a one-paragraph statement, in your own
words, of why AI hallucinates and what that means for a finance professional — your governing principle for
the whole project. 2. Build your Prompt Library: at least 6 reusable, R-C-T-F-C-style prompts for your core
research tasks (triage, data extraction, ratio analysis, valuation, drafting, monitoring), each with an explicit
uncertainty-flag and verification instruction. 3. Organise the library by workflow stage, give each prompt a
clear name, and save it as a single document — this is Layer 1 of your OS.

Part C — Run the research stations on your company: 4. Use a live-search tool to gather your
company's latest news and official filings, prioritising primary sources (investor-relations page, BSE/NSE,
screener.in). 5. Run your filing-triage station on the annual report and concall — extract the business
model, segments, management's key messages, risks, and the sections that most deserve deep reading. 6.
Read the flagged sections yourself — the first human gate. 7. Run your data station: extract the key
financial line items into a clean table and compute the core ratios with a code/data tool (real maths, not
guessed). 8. Verify every extracted figure against the actual filing / screener.in — this is the single
most important step in the entire project and is non-negotiable. 9. Produce charts of revenue growth,
margins, ROE, and leverage from your verified data. 10. Build (or have AI help structure) a three-
statement model from your verified historicals and your own assumptions; run the integrity check until the
balance sheet balances and the cash flow ties. 11. Run your valuation station: bull/base/bear scenarios
plus a g-vs-WACC sensitivity grid; state a target range, not a single number. 12. Run a reverse DCF to see
what growth the current price implies, and judge whether that's realistic. 13. Pull peer comps and
screening context to frame where your company sits versus its sector, verifying the peer figures.

Part D — Chain, automate, and build: 14. Document your six stations, in order, as a single research
pipeline SOP with the verification gate noted at each step — this is Layer 2 of your OS. 15. Build one
working no-code automation relevant to your company (e.g. a filing-watch or news-alert flow with an AI

summary step that flags figures for verification). 16. Build one packaged-expert AI tool (a Custom GPT or
Project) loaded with your own research process and sources, that produces consistent, verification-flagged
output — and confirm it surfaces sources rather than hiding them.

Part E — Assemble the engine, the OS, and the portfolio: 17. Run the full engine end-to-end: feed
only your verified station outputs into the keystone note-assembly prompt to produce a structured first-draft
research note, then run the audit/trace step and confirm every figure traces to a verified source. 18. Edit the
note into your own voice, add your judgment and the actual call (as a range), and keep a short verification
log of what you checked and corrected at each gate. 19. Assemble your complete AI Analyst Operating
System document: your four layers (Library, Engine, Gates, Rhythm) laid out, plus a written weekly-
refinement routine. 20. Build your AI Analyst Portfolio: collect your best artefacts (pipeline SOP,
automation, packaged tool, the engine's verified note, your OS document) with a one-paragraph write-up of
each. 21. Write two evidenced resume bullets and one rehearsed STAR interview story about what you
built — leading with the verification differentiator ("I use AI powerfully and verify everything, because I know
where it fails"). 22. Write a one-page "Human Edge" reflection: list exactly which parts of this project AI
did, which parts only you could do, and every place you caught an AI error or an unverified claim.

📤 Deliverable: A complete package — your prompt library, the verified triage summary, charts, a balanced
3-statement model, a scenario-and-sensitivity valuation, a verified first-draft research note with its
verification log, one live automation, one packaged AI tool, your master AI Analyst Operating System
document, your AI Analyst Portfolio with resume bullets and a STAR story, and the one-page Human Edge
reflection.

⏱️ Time Estimate: 16–20 hours (and a complete operating system plus a career-ready portfolio you reuse
forever).

🏆 What Great Looks Like: 1. Not a single number in the final note is unverified — every figure traces to a
primary source, and you can show exactly where. 2. The three-statement model balances and ties for every
year, and you set and can defend every assumption yourself; the valuation is a range with scenarios and a
sensitivity grid — no false precision. 3. Your packaged AI tool and automation both show their sources and
flag uncertainty — neither is a black box that launders AI guesses into confident-looking output. 4. The
Human Edge reflection honestly documents at least three places you caught an AI error or unverified claim
— proof you operated the engine with discipline, not blind trust. 5. The whole package was produced
through a deliberate, repeatable operating system you could run on any new stock tomorrow — and your
portfolio, resume bullets, and STAR story would convince a sceptical Indian finance interviewer that you
wield AI powerfully and verify everything.

End of Module 16 — Valuevade Zero to Analyst.

