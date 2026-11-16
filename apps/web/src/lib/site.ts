/** Single source of truth for brand, research facts and links. */
export const SITE = {
  name: "LeafCheckup",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://leafcheckup.com",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "leafcheckup@gmail.com",
  github: "https://github.com/agarwalpranay02/Hybrid-Deep-Learning-for-Plant-Disease-Diagnosis",
  founder: "Pranay Agarwal",
} as const;

export const RESEARCH = {
  papers: [
    {
      id: "mind2025",
      title:
        "A Hybrid Deep Learning Approach for Automated Plant Disease Diagnosis in Indian Ridge Gourd: Dataset Creation and Real-World Application",
      venue: "MIND 2025, MNIT Jaipur. Springer Communications in Computer and Information Science (CCIS 2980–2981)",
      year: 2026,
      url: null as string | null,
    },
    {
      id: "discover2026",
      title: "A comprehensive review and bibliometric analysis of deep learning applications in plant disease detection",
      venue: "Discover Artificial Intelligence 6, 1459. Springer Nature, open access",
      year: 2026,
      url: "https://doi.org/10.1007/s44163-026-02310-z",
    },
  ],
  datasets: [
    {
      id: "ridge-gourd",
      title: "Preprocessed Indian Ridge Gourd Leaf Image Dataset (Healthy, Leaf Miner, Mosaic Virus)",
      host: "IEEE DataPort",
      doi: "10.21227/469z-vm04",
      url: "https://doi.org/10.21227/469z-vm04",
      license: "CC BY 4.0",
      originals: 600,
      images: 9000,
      downloads: 9217,
      where: "Vidhani, Jaipur, Rajasthan",
    },
    {
      id: "brinjal",
      title: "Brinjal Leaf Image Dataset (Healthy, Little Leaf, Phomopsis Blight)",
      host: "Mendeley Data",
      doi: "10.17632/c39p3k87g2.1",
      url: "https://doi.org/10.17632/c39p3k87g2.1",
      license: "See dataset page",
      originals: 850,
      images: 13600,
      downloads: null as number | null,
      where: "Rajasthan, India",
    },
  ],
  patent: {
    number: "476293-001",
    office: "Government of India, Designs Act 2000",
    klass: "Class 14-02",
    title: "Internet of Things based device for real-time data collection and augmentation for plant and agricultural samples",
    filed: "2025-10-09",
    certified: "2026-01-06",
  },
  press: [{ outlet: "Punjab Kesari", city: "Jaipur", date: "2025-10-10" }],
} as const;
