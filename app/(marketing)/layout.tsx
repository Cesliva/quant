/**
 * Marketing Layout
 * 
 * This layout ensures the marketing/landing pages don't get
 * wrapped in the dashboard layout
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

