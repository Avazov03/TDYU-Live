const LOGO = {
  mark: "Lx",
  head: "Lex",
  tail: "ify",
};

export const BRAND = {
  name: "Lexify",
  short: "Lx",
  tagline: "Jonli dars va kurslar",
  heroTitle: "Lexify",
  /** Logo shown in headers/footer; `head` + `tail` render as two tones in the footer. */
  logo: { ...LOGO, text: `${LOGO.head}${LOGO.tail}` },
};
