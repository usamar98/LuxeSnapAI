export const FAL_IMAGE_COST_CENTS = 4;

export const creditPacks = [
  {
    id: "starter",
    name: "Starter",
    credits: 25,
    priceCents: 900,
    description: "25 luxury edits",
  },
  {
    id: "creator",
    name: "Creator",
    credits: 80,
    priceCents: 2400,
    description: "80 edits for weekly campaigns",
  },
  {
    id: "studio",
    name: "Studio",
    credits: 220,
    priceCents: 5900,
    description: "220 edits for teams and agencies",
  },
] as const;

export type CreditPackId = (typeof creditPacks)[number]["id"];

export function getCreditPack(id: string) {
  return creditPacks.find((pack) => pack.id === id) ?? null;
}
