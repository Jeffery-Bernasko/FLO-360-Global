const s = { width: 20, height: 20, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" /><path d="M9 22V12h6v10" /></svg>;
}
export function IconInbound(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>;
}
export function IconOutbound(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M12 21V9m0 0l-4 4m4-4l4 4" /><path d="M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2" /></svg>;
}
export function IconInbox(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M3 8l3.89 5.26a2 2 0 001.65.84h6.92a2 2 0 001.65-.84L21 8" /><rect x="3" y="4" width="18" height="16" rx="2" /></svg>;
}
export function IconCustomers(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
}
export function IconSuppliers(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M3 9l2.45-4.9A2 2 0 017.24 3h9.52a2 2 0 011.79 1.1L21 9" /><path d="M12 3v6" /></svg>;
}
export function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
}
export function IconAdjustment(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M12 3v18M3 12h18" /><path d="M7 7l10 10M17 7L7 17" /></svg>;
}
export function IconReports(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M4 4h16v16H4z" /><path d="M8 16V12M12 16V8M16 16v-6" /></svg>;
}
export function IconSignOut(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>;
}
export function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
export function IconClose(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
export function IconBox(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M21 8L12 2 3 8v8l9 6 9-6V8z" /><path d="M3 8l9 6 9-6M12 22V14" /></svg>;
}
export function IconChevron(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M9 18l6-6-6-6" /></svg>;
}
export function IconDownload(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}
export function IconFile(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>;
}
export function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
}
export function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
}
export function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}
export function IconEyeOff(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...s} {...props}><path d="M3 3l18 18" /><path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" /><path d="M9.88 4.24A9.6 9.6 0 0112 4c6.5 0 10 8 10 8a18.5 18.5 0 01-2.64 3.88" /><path d="M6.61 6.61C3.63 8.61 2 12 2 12s3.5 8 10 8a9.5 9.5 0 005.39-1.61" /></svg>;
}
