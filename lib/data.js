// lib/data.js

import { Clock, Umbrella, DollarSign, Zap, MapPin, Calendar, TrendingUp } from "lucide-react";

export const features = [
  {
    id: 1,
    name: "Time keeping",
    icon: Clock,
    description: "Track employee time-ins and time-outs with real-time logs and summaries.",
  },
  {
    id: 2,
    name: "Leaves",
    icon: Umbrella,
    description: "Submit, review, and manage leave requests with approval workflows.",
  },
  {
    id: 3,
    name: "Payroll",
    icon: DollarSign,
    description: "Automate payroll computation based on attendance and leave data.",
  },
  {
    id: 4,
    name: "Offline Punch",
    icon: Zap,
    description: "Allow users to punch in and out even without internet, syncing when online.",
  },
  {
    id: 5,
    name: "Location Punch",
    icon: MapPin,
    description: "Restrict or record punches based on the user's GPS location.",
  },
];

export const featureDetails = [
  {
    id: "schedule",
    name: "Schedule",
    icon: Calendar,
    details: "Effortlessly manage and organize work schedules to keep your team on track.",
    moreDetails: {
      firstDetail:
        "Create and manage shifts: Easily set up schedules for your team, ensuring everyone knows their hours in advance.",
      secondDetail:
        "Automatic reminders: Stay on top of things with push notifications that remind your team about upcoming shifts or changes.",
      thirdDetail: "Flexible adjustments: Quickly modify shifts and work hours to adapt to changes, ensuring optimal staffing.",
    },
  },
  {
    id: "tracking",
    name: "Tracking",
    icon: TrendingUp,
    details: "Track employee work hours accurately to streamline time management and payroll processes.",
    moreDetails: {
      firstDetail:
        "Real-time tracking: Capture time spent on tasks instantly, helping you keep tabs on productivity throughout the day.",
      secondDetail:
        "Detailed reporting: Generate accurate reports to simplify payroll, ensuring employees are paid fairly and on time.",
      thirdDetail: "Error-free logging: Minimize manual errors by automating time logs and reducing administrative burden.",
    },
  },
  {
    id: "geofencing",
    name: "Geofencing",
    icon: MapPin,
    details: "Enhance accountability by using location-based tracking to ensure employees are where they need to be.",
    moreDetails: {
      firstDetail:
        "Set virtual boundaries: Define job site locations with geofencing, ensuring your team clocks in and out when arriving or leaving specific sites.",
      secondDetail:
        "Automated time tracking: Employees' work hours are logged automatically when they enter or exit a defined geofenced area, ensuring accurate data.",
      thirdDetail:
        "Prevent time fraud: Ensure accountability and prevent time fraud by tracking employee movements with GPS, only allowing time entries within authorized zones.",
    },
  },
];

export const testimonials = [
  {
    id: 1,
    testimonial:
      "Bizbuddy has completely transformed the way our team manages time. The interface is intuitive and the support is exceptional!",
    stars: 5,
    name: "John Doe",
    occupation: "Project Manager",
  },
  {
    id: 2,
    testimonial: "I love how seamlessly I can track my work hours. It has really improved my productivity and work-life balance.",
    stars: 4,
    name: "Jane Smith",
    occupation: "Software Engineer",
  },
  {
    id: 3,
    testimonial: "A must-have tool for any business. The scheduling and time tracking features are efficient and easy to use.",
    stars: 5,
    name: "Alice Johnson",
    occupation: "Operations Manager",
  },
];

export const appData = [
  {
    id: 1,
    metric: "App Downloads",
    quantity: 1500000,
  },
  {
    id: 2,
    metric: "Active Users",
    quantity: 750000,
  },
  {
    id: 3,
    metric: "App Reviews",
    quantity: 25000,
  },
  {
    id: 4,
    metric: "5 Star Rating",
    quantity: 4.8,
  },
];

export const trustedPartners = [
  {
    id: 1,
    src: "/express.png",
  },
  {
    id: 2,
    src: "/nodejs.png",
  },
  {
    id: 3,
    src: "/aws.png",
  },
  {
    id: 4,
    src: "/mongodb.png",
  },
  {
    id: 5,
    src: "/next.png",
  },
  {
    id: 6,
    src: "/postgresql.png",
  },
];

export const faqItems = [
  {
    value: "item-1",
    question: "What is BizBuddy?",
    answer: "BizBuddy is a smart time management app design to help individuals and teams track time",
  },
  {
    value: "item-2",
    question: "How long does shipping take?",
    answer: "Shipping typically takes between 3-5 business days depending on your location.",
  },
  {
    value: "item-3",
    question: "Can I change my order?",
    answer: "Yes, orders can be modified within 24 hours of placement. Please contact our support team for assistance.",
  },
  {
    value: "item-4",
    question: "Do you offer international shipping?",
    answer: "Yes, we offer international shipping to select countries. Shipping times and costs vary by location.",
  },
  {
    value: "item-5",
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and bank transfers for your convenience.",
  },
  {
    value: "item-6",
    question: "Is my data secure?",
    answer: "Yes, we use industry-standard encryption and security measures to protect your data.",
  },
];
