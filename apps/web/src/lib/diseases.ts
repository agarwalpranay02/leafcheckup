/**
 * Field guide content for every class the model predicts.
 * Management advice follows integrated pest/disease management (IPM) practice
 * published by Indian agricultural universities and ICAR institutes
 * (TNAU Agritech, ICAR-IIHR, KAU, NHB). Chemical options are named by active
 * ingredient only; doses must come from the product label and the local
 * Krishi Vigyan Kendra (KVK), because registrations differ by state and crop.
 */
export type L = string;
export type Severity = "none" | "watch" | "act";

export type Condition = {
  id: string; // matches model class id
  slug: string;
  crop: CropId;
  name: L;
  /** Name inside a list of this crop's conditions: "healthy", "leaf miner" */
  short: L;
  scientific: string;
  kind: L;
  severity: Severity;
  sample: string; // public image path
  summary: L;
  symptoms: L[];
  lookalikes: L[];
  spread: L;
  act: { now: L[]; prevent: L[]; chemical?: L[] };
  sources: { label: string; url: string }[];
};

/**
 * Every crop the model knows. To add one, append it here (same id as the
 * `crop` field in ml/crops.json), add its conditions below, and retrain.
 * `local` is the everyday Hindi name shown next to the English one.
 */
export const CROPS = {
  ridge_gourd: { en: "Ridge gourd", local: "tori", scientific: "Luffa acutangula" },
  brinjal: { en: "Brinjal", local: "baingan", scientific: "Solanum melongena" },
} as const satisfies Record<string, { en: string; local?: string; scientific: string }>;

export type CropId = keyof typeof CROPS;
export const CROP_IDS = Object.keys(CROPS) as CropId[];

export const CONDITIONS: Condition[] = [
  {
    id: "ridge_gourd__healthy",
    slug: "ridge-gourd-healthy",
    crop: "ridge_gourd",
    name: "Healthy ridge gourd leaf",
    short: "healthy",
    scientific: "Luffa acutangula",
    kind: "No disease found",
    severity: "none",
    sample: "/samples/ridge_gourd__healthy.jpg",
    summary: "Even green colour, intact leaf surface, no trails, spots or yellow patches.",
    symptoms: [
      "Uniform green lamina with clear veins",
      "No winding white trails or holes",
      "No yellow–green mottling on young leaves",
    ],
    lookalikes: [
      "Nutrient-deficient leaves can look pale but evenly so, not in a mosaic",
    ],
    spread: "Keep scouting weekly, especially the youngest leaves.",
    act: {
      now: [
        "No treatment needed. Check 10 plants across the field each week.",
      ],
      prevent: [
        "Use yellow sticky traps to watch for whitefly and leaf miner adults",
        "Remove weeds around the field that host whitefly",
      ],
    },
    sources: [{ label: "TNAU Agritech: Pests of cucurbits", url: "https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_insect-veg_cucurbit.html" }],
  },
  {
    id: "ridge_gourd__leaf_miner",
    slug: "ridge-gourd-leaf-miner",
    crop: "ridge_gourd",
    name: "Leaf miner",
    short: "leaf miner",
    scientific: "Liriomyza trifolii (serpentine leaf miner)",
    kind: "Insect pest",
    severity: "act",
    sample: "/samples/ridge_gourd__leaf_miner.jpg",
    summary: "Tiny fly larvae tunnel inside the leaf, leaving pale, winding trails. Heavy mining dries leaves and cuts yield.",
    symptoms: [
      "Pale white or silver serpentine trails on the upper leaf surface",
      "Trails widen as the larva grows; a dark line of frass inside",
      "Badly mined leaves turn papery, dry and drop early",
    ],
    lookalikes: [
      "Fungal leaf spots are round lesions, not winding tunnels",
      "Mosaic virus shows yellow–green patches, not white trails",
    ],
    spread: "Adult flies lay eggs inside leaf tissue; populations build quickly in warm weather and on many host crops.",
    act: {
      now: [
        "Pick and destroy mined leaves at the first sign; don't leave them in the field",
        "Spray neem seed kernel extract (NSKE) 5%",
      ],
      prevent: [
        "Yellow sticky traps catch adult flies early",
        "Avoid back-to-back cucurbit or tomato crops in the same plot",
        "Over-use of broad-spectrum insecticides kills the parasitoids that keep miners in check",
      ],
      chemical: [
        "If damage keeps rising: cyantraniliprole 10.26% OD is used against leaf miner in cucurbits. Dose and waiting period from the label; confirm with your KVK.",
      ],
    },
    sources: [
      { label: "TNAU Agritech: Leaf miner of cucurbits", url: "https://agritech.tnau.ac.in/crop_protection/cucurbitae/cucurbitae_8.html" },
      { label: "Journal of Entomological Research 42(2), 2018", url: "https://indianjournals.com/article/jer-42-2-006" },
    ],
  },
  {
    id: "ridge_gourd__mosaic_virus",
    slug: "ridge-gourd-mosaic-virus",
    crop: "ridge_gourd",
    name: "Yellow mosaic virus",
    short: "yellow mosaic virus",
    scientific: "Begomovirus, mainly Tomato leaf curl New Delhi virus (ToLCNDV)",
    kind: "Virus, spread by whitefly",
    severity: "act",
    sample: "/samples/ridge_gourd__mosaic_virus.jpg",
    summary: "Bright yellow and green mottling on young leaves, often with curling and stunting. There is no cure for infected plants; control the whitefly that spreads it.",
    symptoms: [
      "Yellow–green mosaic, first on the youngest leaves",
      "Leaves smaller, puckered or curled; veins may thicken",
      "Short internodes, stunted vines, few and deformed fruits",
    ],
    lookalikes: [
      "Nitrogen deficiency yellows older leaves evenly, not in a mosaic",
      "Leaf miner gives white trails rather than yellow patches",
    ],
    spread: "Whitefly (Bemisia tabaci) carries the virus between plants. Losses can reach 100% when infection starts at the seedling stage.",
    act: {
      now: [
        "Uproot and destroy infected plants early so they stop being a virus source",
        "Control whitefly: yellow sticky traps and neem-based sprays",
      ],
      prevent: [
        "Raise seedlings under 40–50 mesh insect-proof net",
        "Remove weed hosts and avoid planting next to infected cucurbit or tomato fields",
        "Ask your KVK about tolerant varieties for your region",
      ],
      chemical: [
        "Sprays target the whitefly, not the virus. Use a whitefly-registered insecticide only when counts are high, and rotate modes of action to avoid resistance.",
      ],
    },
    sources: [
      { label: "ICAR-IIHR, Journal of Horticultural Sciences 16(2), 2021", url: "https://jhs.iihr.res.in/index.php/jhs/article/download/1113/906/7387" },
      { label: "ICAR KRISHI: ToLCNDV in ridge gourd", url: "https://krishi.icar.gov.in/jspui/bitstream/123456789/51682/1/6.%20Manpreet%20Kaur%20et%20al%202021%20Australian%20plant%20pathology.pdf" },
    ],
  },
  {
    id: "brinjal__healthy",
    slug: "brinjal-healthy",
    crop: "brinjal",
    name: "Healthy brinjal leaf",
    short: "healthy",
    scientific: "Solanum melongena",
    kind: "No disease found",
    severity: "none",
    sample: "/samples/brinjal__healthy.jpg",
    summary: "Full-size leaf, even colour, no spots, no blight and no bunching of small leaves.",
    symptoms: [
      "Broad lobed leaf with a soft, slightly hairy surface",
      "No grey-brown spots with pale centres",
    ],
    lookalikes: ["Dust on leaves can look like pale spots; wipe and re-check"],
    spread: "Keep scouting weekly.",
    act: {
      now: ["No treatment needed."],
      prevent: [
        "Watch for leafhoppers on the underside of leaves",
        "Use seed from healthy fruits and rotate crops",
      ],
    },
    sources: [{ label: "National Horticulture Board: Brinjal", url: "https://www.nhb.gov.in/pdf/vegetable/brinjal/bri002.pdf" }],
  },
  {
    id: "brinjal__little_leaf",
    slug: "brinjal-little-leaf",
    crop: "brinjal",
    name: "Little leaf",
    short: "little leaf",
    scientific: "Phytoplasma ('Candidatus Phytoplasma trifolii')",
    kind: "Phytoplasma, spread by leafhopper",
    severity: "act",
    sample: "/samples/brinjal__little_leaf.jpg",
    summary: "Leaves become tiny, pale and crowded; the plant turns bushy and stops fruiting. Infected plants do not recover; remove them and control the leafhopper.",
    symptoms: [
      "Very small, narrow, soft leaves clustered on short stems",
      "Bushy look from many side shoots (witches' broom)",
      "Flowers turn green and leafy; little or no fruit",
    ],
    lookalikes: [
      "Herbicide drift can also shrink and distort leaves, but appears suddenly across many plants",
    ],
    spread: "The leafhopper Hishimonus phycitis carries the phytoplasma. Datura and other weeds act as reservoirs.",
    act: {
      now: [
        "Uproot and destroy infected plants as soon as you see them",
        "Check leaf undersides for leafhoppers and act on the vector",
      ],
      prevent: [
        "Remove datura and other weed hosts around the field",
        "Transplant healthy seedlings from a protected nursery",
        "Incidence is often highest in the summer (Zaid) season; scout more often then",
      ],
      chemical: [
        "Sprays only reduce the leafhopper population; they do not cure infected plants. Choose a product registered for brinjal leafhopper and follow the label.",
      ],
    },
    sources: [
      { label: "BMC Plant Biology 24:576 (2024), TNAU", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11184749/" },
      { label: "National Horticulture Board: Brinjal", url: "https://www.nhb.gov.in/pdf/vegetable/brinjal/bri002.pdf" },
    ],
  },
  {
    id: "brinjal__phomopsis_blight",
    slug: "brinjal-phomopsis-blight",
    crop: "brinjal",
    name: "Phomopsis blight",
    short: "Phomopsis blight",
    scientific: "Phomopsis vexans (Diaporthe vexans)",
    kind: "Fungal disease",
    severity: "act",
    sample: "/samples/brinjal__phomopsis_blight.jpg",
    summary: "Grey-brown spots with lighter centres that merge into blight; the same fungus rots fruit. Spreads by rain splash and survives on seed and crop debris.",
    symptoms: [
      "Round to irregular grey-brown spots with pale centres",
      "Spots merge; leaf yellows, cracks and withers",
      "Tiny black dots (fruiting bodies) on older lesions; sunken rot on fruit",
    ],
    lookalikes: [
      "Cercospora leaf spot is smaller and angular, without black dots",
    ],
    spread: "Rain splash, irrigation water and tools carry spores. Warm, humid weather favours it.",
    act: {
      now: [
        "Remove and destroy infected leaves and fruits",
        "Avoid overhead irrigation; keep foliage dry",
      ],
      prevent: [
        "Use clean seed; hot-water seed treatment at 50 °C for 30 minutes",
        "Rotate away from brinjal for 3–4 years and bury or remove crop debris",
        "Resistant varieties such as Pusa Bhairav are reported; ask your KVK",
      ],
      chemical: [
        "Protective sprays of mancozeb or copper oxychloride are commonly recommended. Dose and interval from the label; confirm with your KVK.",
      ],
    },
    sources: [
      { label: "Kerala Agricultural University: Phomopsis blight", url: "https://celkau.in/crops/vegetables/brinjal/blight.php" },
      { label: "COL Integrated Disease Management (CC BY-SA)", url: "https://openbooks.col.org/integrateddiseasemanagement/chapter_5-brinjal-diseases-and-their-management.html" },
    ],
  },
];

export const conditionsOf = (crop: CropId) => CONDITIONS.filter((c) => c.crop === crop);

/** "a", "a and b", "a, b and c" */
export const joinList = (xs: string[], conj = "and") => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${conj} ${xs.at(-1)}`);

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** Spell small numbers the way the copy does ("six conditions"); digits from 13 up. */
export const numberWord = (n: number) => WORDS[n] ?? String(n);
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Copy fragments derived from the crop list, so adding a crop updates the whole site. */
export const COVERAGE = {
  /** "ridge gourd and brinjal" */
  crops: joinList(CROP_IDS.map((c) => CROPS[c].en.toLowerCase())),
  /** "ridge gourd (tori) and brinjal (baingan)" */
  cropsLocal: joinList(CROP_IDS.map((c) => {
    const k = CROPS[c] as { en: string; local?: string };
    return k.local ? `${k.en.toLowerCase()} (${k.local})` : k.en.toLowerCase();
  })),
  /** "six" */
  conditionCount: numberWord(CONDITIONS.length),
  /** "Six" */
  ConditionCount: cap(numberWord(CONDITIONS.length)),
  cropCount: numberWord(CROP_IDS.length),
  /** "ridge gourd or brinjal" */
  cropsOr: joinList(CROP_IDS.map((c) => CROPS[c].en.toLowerCase()), "or"),
  /** "Ridge gourd: healthy, leaf miner and yellow mosaic virus. Brinjal: …" */
  coverageDetail: CROP_IDS.map((c) => `${CROPS[c].en}: ${joinList(conditionsOf(c).map((x) => x.short))}.`).join(" "),
};

export const byId = Object.fromEntries(CONDITIONS.map((c) => [c.id, c])) as Record<string, Condition>;
export const bySlug = Object.fromEntries(CONDITIONS.map((c) => [c.slug, c])) as Record<string, Condition>;
/** Text accessor kept for call-site stability; the site is English-only. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const t = (l: L | { en: string }, _locale?: string): string => (typeof l === "string" ? l : l.en);
