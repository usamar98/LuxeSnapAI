export const luxuryScenes = [
  {
    id: "private-jet",
    name: "Private jet",
    caption: "Cabin window light",
    backgroundPosition: "0% 0%",
    prompt:
      "inside a private jet cabin with leather seats, oval windows, champagne highlights, and realistic aviation interior lighting",
  },
  {
    id: "yacht",
    name: "Yacht deck",
    caption: "Golden-hour marina",
    backgroundPosition: "50% 0%",
    prompt:
      "on a luxury yacht deck at golden hour with ocean reflections, polished teak, soft wind, and cinematic coastal depth",
  },
  {
    id: "penthouse",
    name: "Penthouse",
    caption: "Skyline suite",
    backgroundPosition: "100% 0%",
    prompt:
      "in a modern penthouse living room with floor-to-ceiling skyline views, marble, warm city lights, and premium interior styling",
  },
  {
    id: "supercar",
    name: "Supercar",
    caption: "Coastal road",
    backgroundPosition: "0% 100%",
    prompt:
      "beside a red exotic sports car on a coastal road, no visible brand marks, sunset reflections, editorial automotive photography",
  },
  {
    id: "runway-lounge",
    name: "Runway lounge",
    caption: "Airport club",
    backgroundPosition: "50% 100%",
    prompt:
      "in an exclusive runway-side airport lounge with moody glass, runway lights, tailored seating, and private travel atmosphere",
  },
  {
    id: "hotel-suite",
    name: "Hotel suite",
    caption: "Marble retreat",
    backgroundPosition: "100% 100%",
    prompt:
      "in a luxury marble hotel suite with soft linen, city view, warm lamps, and refined editorial lifestyle lighting",
  },
] as const;

export const stylePresets = [
  {
    id: "editorial",
    name: "Editorial",
    prompt: "premium magazine editorial lighting, realistic lens texture",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    prompt: "cinematic color grade, shallow depth of field, controlled highlights",
  },
  {
    id: "social",
    name: "Social",
    prompt: "polished creator content, natural skin, crisp but believable finish",
  },
  {
    id: "executive",
    name: "Executive",
    prompt: "wealthy founder portrait, sharp tailoring, understated confidence",
  },
] as const;

export const aspectRatios = ["1:1", "4:3", "3:2", "9:16", "16:9"] as const;

export type SceneId = (typeof luxuryScenes)[number]["id"];
export type StylePresetId = (typeof stylePresets)[number]["id"];
export type AspectRatio = (typeof aspectRatios)[number];

export function getScene(id: string) {
  return luxuryScenes.find((scene) => scene.id === id) ?? luxuryScenes[0];
}

export function getStylePreset(id: string) {
  return stylePresets.find((style) => style.id === id) ?? stylePresets[0];
}
