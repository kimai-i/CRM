// Onboarding content. Edit these lists to change the standard checklist and questionnaire.

export type ChecklistTemplateItem = { title: string; description?: string; assignee: "agency" | "client" };

export const DEFAULT_CHECKLIST: ChecklistTemplateItem[] = [
  { title: "Fill in the business profile", description: "Services, pricing, service area, competitors and brand voice.", assignee: "client" },
  { title: "Upload logo and brand files", description: "Logo (PNG or SVG), brand colors, any brand guidelines.", assignee: "client" },
  { title: "Share access to ad accounts", description: "Add the agency as a user on Google Ads and Meta Business.", assignee: "client" },
  { title: "Share website and Google Business Profile access", assignee: "client" },
  { title: "Kickoff call", description: "Walk through goals, budget and what success looks like.", assignee: "agency" },
  { title: "Audit current marketing", description: "Ads, website, Google Business Profile, reviews, tracking.", assignee: "agency" },
  { title: "Set up call and form tracking", assignee: "agency" },
  { title: "Agree on ad budgets", description: "Record them on the Ad Budgets page.", assignee: "agency" },
  { title: "Add recurring routines for this client's services", description: "Use Recurring → Apply preset.", assignee: "agency" },
  { title: "Send the 30-day plan", assignee: "agency" },
];

export type ProfileQuestion = { id: string; label: string; help?: string; type: "text" | "textarea" };
export type ProfileSection = { id: string; title: string; questions: ProfileQuestion[] };

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    id: "basics",
    title: "Business basics",
    questions: [
      { id: "legal_name", label: "Business name (as customers know it)", type: "text" },
      { id: "years", label: "Years in business", type: "text" },
      { id: "team_size", label: "Team size (office + field)", type: "text" },
      { id: "hours", label: "Business hours and emergency availability", type: "textarea" },
      { id: "licenses", label: "Licenses, certifications and warranties", type: "textarea" },
    ],
  },
  {
    id: "services",
    title: "Services and pricing",
    questions: [
      { id: "services", label: "Services you offer", help: "List them, most important first.", type: "textarea" },
      { id: "best_jobs", label: "Your most profitable jobs — what you want more of", type: "textarea" },
      { id: "avoid_jobs", label: "Jobs you don't want", type: "textarea" },
      { id: "pricing", label: "Typical price ranges, financing, free estimates?", type: "textarea" },
      { id: "avg_job", label: "Average job value ($)", type: "text" },
    ],
  },
  {
    id: "area",
    title: "Service area",
    questions: [
      { id: "cities", label: "Cities and ZIP codes you serve", type: "textarea" },
      { id: "priority_areas", label: "Areas you most want to grow in", type: "textarea" },
    ],
  },
  {
    id: "market",
    title: "Customers and competitors",
    questions: [
      { id: "ideal_customer", label: "Describe your ideal customer", type: "textarea" },
      { id: "competitors", label: "Main competitors (names or websites)", type: "textarea" },
      { id: "why_you", label: "Why customers choose you over them", type: "textarea" },
    ],
  },
  {
    id: "brand",
    title: "Brand and voice",
    questions: [
      { id: "voice", label: "How should your brand sound?", help: "e.g. friendly and local, straight-talking, premium", type: "textarea" },
      { id: "words_avoid", label: "Words or claims to avoid", type: "textarea" },
      { id: "reviews", label: "Where customers leave reviews", type: "text" },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    questions: [
      { id: "goals", label: "What does a great year look like?", type: "textarea" },
      { id: "monthly_budget", label: "Monthly marketing budget you're comfortable with", type: "text" },
      { id: "notes", label: "Anything else we should know", type: "textarea" },
    ],
  },
];

export const ALL_QUESTIONS = PROFILE_SECTIONS.flatMap((s) => s.questions);

export function parseAnswers(json: string | null | undefined): Record<string, string> {
  try {
    const value = JSON.parse(json ?? "{}");
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Share of questions answered (0–1). */
export function profileCompletion(answers: Record<string, string>): number {
  const answered = ALL_QUESTIONS.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  return ALL_QUESTIONS.length ? answered / ALL_QUESTIONS.length : 0;
}
