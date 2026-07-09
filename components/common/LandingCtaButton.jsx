// Full-width CTA for landing/footer forms — avoids Safari <button> + flex layout bugs
"use client";

export default function LandingCtaButton({ children, type = "submit", className = "", disabled, ...props }) {
  return (
    <div className={`landing-cta-wrap w-full ${className}`.trim()}>
      <button type={type} className="landing-cta-submit" disabled={disabled} {...props}>
        {children}
      </button>
    </div>
  );
}
