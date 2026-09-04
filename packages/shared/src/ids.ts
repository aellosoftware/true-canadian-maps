import { monotonicFactory } from "ulidx";
const ulid = monotonicFactory();

/**
 * Prefixed, time-sortable identifiers: `${prefix}_${ULID}`.
 * Prefixes are stable and never encode customer names.
 */
export const ID_PREFIXES = {
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "ver",
  organization: "org",
  member: "mem",
  invitation: "inv",
  project: "prj",
  environment: "env",
  style: "sty",
  preset: "prs",
  marker: "mkr",
  icon: "ico",
  apiKey: "key",
  release: "rel",
  audit: "aud",
  basemap: "bmv",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

export function newId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`;
}

const ID_PATTERN = /^([a-z]{3})_([0-9A-HJKMNP-TV-Z]{26})$/;

export function parseId(value: string): { prefix: IdPrefix; ulid: string } | null {
  const m = ID_PATTERN.exec(value);
  if (!m) return null;
  const prefix = m[1] as IdPrefix;
  if (!Object.values(ID_PREFIXES).includes(prefix)) return null;
  return { prefix, ulid: m[2]! };
}

export function isId(value: unknown, kind?: IdKind): value is string {
  if (typeof value !== "string") return false;
  const parsed = parseId(value);
  if (!parsed) return false;
  return kind ? parsed.prefix === ID_PREFIXES[kind] : true;
}

/** Map Better Auth model names to our prefixes so its tables share the id scheme. */
export function idForAuthModel(model: string): string {
  switch (model) {
    case "user":
      return newId("user");
    case "session":
      return newId("session");
    case "account":
      return newId("account");
    case "verification":
      return newId("verification");
    case "organization":
      return newId("organization");
    case "member":
      return newId("member");
    case "invitation":
      return newId("invitation");
    default:
      return `${model.slice(0, 3).toLowerCase()}_${ulid()}`;
  }
}
