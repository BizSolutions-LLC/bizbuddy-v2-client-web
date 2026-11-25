// components/Home/landing/content.js
// BB-145 — copy and links for the public site (landing page, /faq, /contact, footer).
// Screens in /public/landing use demo data only.

export const CONTACT = {
  email: "info@bizsolutions.us",
  phone: "+1 833-249-7418",
  phoneHref: "tel:+18332497418",
};

export const QR = {
  ios: {
    label: "iPhone and iPad",
    store: "App Store",
    src: "/app-qr/bizbuddy-ios-app-store-qr-orange.png",
  },
  android: {
    label: "Android",
    store: "Google Play store",
    src: "/app-qr/bizbuddy-android-google-play-qr-orange.png",
  },
};

// Hero rail. `stage` picks what the product frame shows:
//   web   — browser frame only
//   both  — browser frame + iPhone (online)
//   phone — iPhone only, centered (offline)
export const STORIES = [
  {
    id: "time-keeping",
    eyebrow: "Time keeping",
    short: "Hours at a glance",
    title: "Every hour worked, counted for you.",
    body: "Track time-ins and time-outs with real-time logs and summaries: hours worked, late clock-ins, absences and overtime for any period.",
    caption: "Overview on the web, Punch on iPhone",
    alt: "BizBuddy overview with hours worked and attendance, next to the iPhone punch screen",
    stage: "both",
    web: "/landing/overview.png",
    webSize: [1118, 856],
    phone: "/landing/phone-online.png",
  },
  {
    id: "leaves",
    eyebrow: "Leaves",
    short: "Requests and balances",
    title: "Leave requests without the paperwork.",
    body: "Submit, review and manage leave requests with approval workflows, and see every balance and its expiry at a glance.",
    caption: "Leave requests on the web",
    alt: "Leave requests page with totals, balances and request history",
    stage: "web",
    web: "/landing/leaves.png",
    webSize: [846, 764],
  },
  {
    id: "payroll",
    eyebrow: "Payroll",
    short: "Cutoffs per department",
    title: "Payroll cutoffs that run themselves.",
    body: "Automated cutoffs for each department, computed from attendance and leave, with what needs your review shown first.",
    caption: "Cutoff periods on the web",
    alt: "Cutoff periods page with records to review and departments",
    stage: "web",
    web: "/landing/cutoff.png",
    webSize: [824, 854],
  },
  {
    id: "offline-punch",
    eyebrow: "Offline punch",
    short: "No signal, no problem",
    title: "Clock in with no signal.",
    body: "Punch in and out even without internet. BizBuddy keeps your punches and syncs them when you’re back online.",
    caption: "Punch on iPhone, network disconnected",
    alt: "iPhone punch screen showing Network Disconnected with the Time In button",
    stage: "phone",
    phone: "/landing/phone-offline.png",
  },
  {
    id: "location-punch",
    eyebrow: "Location punch",
    short: "Inside the work zone",
    title: "Punches that know where they happened.",
    body: "Restrict or record punches by GPS location, and see on a map where every clock-in and clock-out happened.",
    caption: "Employee Map on the web, in Street and Satellite views",
    alt: "Employee Map with clock-in and clock-out pins on a street map and the employee list, with the same pin on the satellite view in front",
    stage: "web",
    web: "/landing/employee-map-v3.png",
    webSize: [1141, 880],
    // Smaller second screen in front of the main one (another map style of the same spot)
    inset: "/landing/employee-map-satellite.png",
    insetSize: [741, 634],
  },
  {
    id: "schedules",
    eyebrow: "Schedules",
    short: "Shifts on a calendar",
    title: "Every shift, on one calendar.",
    body: "View and manage upcoming shifts, with today’s schedule and this month’s hours right on top.",
    caption: "Schedule on the web",
    alt: "Schedule page with a monthly calendar and today’s shift",
    stage: "web",
    web: "/landing/schedule.png",
    webSize: [1118, 864],
  },
];

export const HIGHLIGHTS = [
  { title: "Every platform", body: "iPhone, Android and the web, all on one account." },
  { title: "Works offline", body: "Punch in with no signal. It syncs when you’re back online." },
  { title: "Work zones", body: "Record or restrict punches by GPS location." },
  { title: "Your overtime rules", body: "Daily, weekly or per-cutoff, applied to every session." },
];

// No prices on purpose: plans are quoted per company.
export const PLANS = [
  {
    name: "Basic",
    headline: "Time keeping for small teams.",
    blurb: "Everything your team needs to clock in, clock out and see their hours.",
    features: [
      "Punch on iPhone, Android and the web",
      "Offline punch that syncs later",
      "Punch logs, overview and exports",
      "Shifts and schedules",
    ],
  },
  {
    name: "Pro",
    badge: "Most teams",
    headline: "Leaves, payroll and work zones.",
    blurb: "For teams that run payroll and leave from their attendance.",
    features: [
      "Everything in Basic",
      "Leave requests, approvals and balances",
      "Payroll cutoffs per department",
      "Work zones and overtime rules",
    ],
  },
];

// Shown on the landing page (first LANDING_FAQ_COUNT) and in full on /faq.
export const LANDING_FAQ_COUNT = 7;

export const FAQS = [
  {
    q: "What is BizBuddy?",
    a: [
      "BizBuddy is an app for time keeping, payroll and leaves. Your team clocks in and out, requests leave and follows their schedules, and payroll is computed from that attendance.",
    ],
  },
  {
    q: "Where can I get the BizBuddy app?",
    a: [
      "BizBuddy is on the App Store for iPhone and iPad and on Google Play for Android. Scan the QR code on this page with your phone’s camera to open the right store.",
      "On a computer, sign in at mybizbuddy.co to use BizBuddy in your browser.",
    ],
  },
  {
    q: "What are the key services offered by BizBuddy?",
    a: [
      "Time keeping, leaves, payroll cutoffs, offline punch, location punch with work zones, schedules and overtime. Managers also get punch log reviews, time-log corrections and exports to PDF and Excel.",
    ],
  },
  {
    q: "How flexible is BizBuddy?",
    a: [
      "You set it up the way your company works: departments with their own cutoff schedules, daily, weekly or per-cutoff overtime rules, work zones that restrict or just record punches, and leave types with their own balances.",
      "It runs on iPhone, Android and the web, and punches still work offline.",
    ],
  },
  {
    q: "How does BizBuddy’s pricing compare to others?",
    a: [
      "Plans are based on your team size and the features you use, so you don’t pay for tools you won’t open. Contact us and we’ll put together a quote for your team.",
    ],
  },
  {
    q: "Is my data secure?",
    a: [
      "We use reasonable measures to protect your information. Inside your company, roles decide who can view and approve what: admins, supervisors and employees each see only what they need.",
      "We don’t sell your information. Our Privacy Policy has the details.",
    ],
  },
  {
    q: "What payment methods do you accept?",
    a: [
      "Subscriptions are paid by credit or debit card. For invoices or other arrangements, contact us.",
    ],
  },
  {
    q: "Is there a free trial?",
    a: [
      "The app is free to download. Contact us and we’ll help you try BizBuddy with your team before you pick a plan.",
    ],
  },
  {
    q: "How long does setup take?",
    a: [
      "Most companies are running the same day. Add your departments, shifts and employees, or import employees, schedules and past punch logs from a CSV file. A setup checklist in the dashboard walks you through each step.",
    ],
  },
  {
    q: "Can employees fix a wrong punch?",
    a: [
      "Yes. Employees can contest a time log and propose the right times. A supervisor or admin reviews the request, and the change is kept on record.",
    ],
  },
  {
    q: "How does offline punch work?",
    a: [
      "If the phone has no signal, the app keeps the punch with the time it happened. When the phone is back online, the punch syncs automatically.",
    ],
  },
  {
    q: "Can I limit where employees clock in?",
    a: [
      "Yes. Set up work zones for your locations. A zone can block punches made outside it, or allow them and record where each punch came from.",
    ],
  },
  {
    q: "Does BizBuddy handle overtime?",
    a: [
      "Yes. Choose daily, weekly or per-cutoff overtime. Punch logs show the overtime each session earned, and overtime requests go through approval before payroll.",
    ],
  },
  {
    q: "What can supervisors see?",
    a: [
      "Supervisors see and act on their own team: their department and their direct reports. Admins see the whole company.",
    ],
  },
  {
    q: "Which time zone does BizBuddy use?",
    a: [
      "Each company has its own time zone. Punches, schedules and cutoffs are all shown in that zone, wherever your team is.",
    ],
  },
];

export const FOOTER_PRODUCT = STORIES.map((s) => ({ label: s.eyebrow, href: "/#top" }));

export const FOOTER_COMPANY = [
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact us", href: "/contact" },
  { label: "Sign in", href: "/sign-in" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms" },
];

export const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/bizsolutions-llc/posts/" },
  { label: "Facebook", href: "https://www.facebook.com/SupportusBizSolutions" },
  { label: "Instagram", href: "https://www.instagram.com/bizsolutionsllc/" },
  { label: "YouTube", href: "https://www.youtube.com/@BizSolutionsLLC" },
  { label: "TikTok", href: "https://www.tiktok.com/@bizsolutionsllc" },
];

export const NAV_LINKS = [
  { label: "Features", href: "/#top" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact us", href: "/#contact" },
];
