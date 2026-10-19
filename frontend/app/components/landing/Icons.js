const PATHS = {
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </>
  ),
  send: <path d="M21 3 3 10.5l6.5 2.5L12 20.5zM9.5 13 21 3" />,
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  message: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z" />,
  plug: (
    <>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v4" />
    </>
  ),
  chevronUp: <path d="m6 15 6-6 6 6" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z" />,
  quote: (
    <path
      d="M7 17c-2 0-3-1.3-3-3.2C4 10 6.5 7 9 6.5L9.4 8C8 8.6 7.4 9.6 7.3 11H10v6zm9 0c-2 0-3-1.3-3-3.2 0-3.8 2.5-6.8 5-7.3L18.4 8c-1.4.6-2 1.6-2.1 3H19v6z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.8, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
