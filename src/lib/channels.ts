// Channel pages: one URL slug per sidebar item, mapped to the service(s) it shows.

export type ChannelDef = {
  slug: string;
  title: string;
  subtitle: string;
  serviceKeys: string[];
  defaultGroup: "client" | "service";
};

export const CHANNELS: ChannelDef[] = [
  { slug: "google-ads", title: "Google Ads", subtitle: "Google Ads management tasks", serviceKeys: ["google_ads"], defaultGroup: "client" },
  { slug: "meta-ads", title: "Meta Ads", subtitle: "Meta (Facebook / Instagram) ad management", serviceKeys: ["meta_ads"], defaultGroup: "client" },
  { slug: "websites-seo", title: "Websites & SEO", subtitle: "Website builds, redesigns, and SEO — all in one place", serviceKeys: ["seo", "website"], defaultGroup: "service" },
  { slug: "outreach", title: "Outreach", subtitle: "Cold email and referral outreach", serviceKeys: ["outreach"], defaultGroup: "client" },
  { slug: "automations", title: "Automations", subtitle: "Workflows and automations we build inside each client's stack", serviceKeys: ["automations"], defaultGroup: "client" },
  { slug: "ad-hoc", title: "Ad Hoc / Extras", subtitle: "Free work, favors, one-offs — track what's eating your time", serviceKeys: ["ad_hoc"], defaultGroup: "client" },
];

export const findChannel = (slug: string) => CHANNELS.find((c) => c.slug === slug);
