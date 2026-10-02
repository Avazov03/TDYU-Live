const LOGO = {
  /** Temporary; restore with `{ mark: "Lx", head: "Lex", tail: "ify" }`. */
  mark: "AI",
  head: "AI ",
  tail: "Ta’lim",
};

export const BRAND = {
  name: "Lexify",
  short: "Lx",
  tagline: "Jonli dars va kurslar",
  /** Temporary landing hero title; set back to `name` to restore "Lexify". */
  heroTitle: "AI TA’LIM",
  /** Logo shown in headers/footer; `head` + `tail` render as two tones in the footer. */
  logo: { ...LOGO, text: `${LOGO.head}${LOGO.tail}` },
};
