/** The Saffra mark: a leaf and a saffron thread. Colors follow the theme (see .logo-mark in globals.css). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo-mark" aria-hidden="true" width={size} height={size} viewBox="-2 30 448 448">
      <path className="leaf" d="M12 212C120 215 225 290 235 478C120 470 20 380 12 212Z" />
      <path className="thread" d="M268 477C277 418 270 372 254 334C236 300 216 278 216 244C216 150 330 88 432 30C362 110 300 168 305 225C310 282 372 330 356 400C346 444 306 470 268 477Z" />
    </svg>
  );
}
