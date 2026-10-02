/** Set to e.g. "/ai/robot.png" once the final artwork is in /public. */
const ROBOT_IMAGE: string | null = null;

export function RobotMark() {
  if (ROBOT_IMAGE) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ROBOT_IMAGE} alt="" className="lx-ai-robot" draggable={false} />;
  }
  return (
    <svg className="lx-ai-robot" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lx-ai-robot-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-grad-1)" />
          <stop offset="1" stopColor="var(--brand-grad-2)" />
        </linearGradient>
      </defs>
      <line x1="32" y1="9" x2="32" y2="16" stroke="url(#lx-ai-robot-g)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="8" r="3.5" fill="url(#lx-ai-robot-g)" />
      <rect x="10" y="16" width="44" height="34" rx="14" fill="url(#lx-ai-robot-g)" />
      <rect x="16" y="23" width="32" height="19" rx="9.5" fill="#0f1716" />
      <ellipse className="lx-ai-eye" cx="25" cy="32.5" rx="3.2" ry="4" fill="#d4f5ef" />
      <ellipse className="lx-ai-eye" cx="39" cy="32.5" rx="3.2" ry="4" fill="#d4f5ef" />
      <rect x="5" y="28" width="5" height="11" rx="2.5" fill="url(#lx-ai-robot-g)" />
      <rect x="54" y="28" width="5" height="11" rx="2.5" fill="url(#lx-ai-robot-g)" />
      <rect x="24" y="52" width="16" height="5" rx="2.5" fill="url(#lx-ai-robot-g)" opacity="0.7" />
    </svg>
  );
}
