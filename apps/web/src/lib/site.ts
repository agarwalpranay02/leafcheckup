/** Single source of truth for brand, research facts and links. */
export const SITE = {
  name: "LeafCheckup",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://leafcheckup.com",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "leafcheckup@gmail.com",
  github: "https://github.com/agarwalpranay02/leafcheckup",
  founder: "Pranay Agarwal",
} as const;

export const RESEARCH = {
  papers: [
    {
      id: "mind2025",
      title:
        "A Hybrid Deep Learning Approach for Automated Plant Disease Diagnosis in Indian Ridge Gourd: Dataset Creation and Real-World Application",
      venue: "MIND 2025, MNIT Jaipur. Springer Communications in Computer and Information Science, vol. 2980, pp. 83–94",
      year: 2026,
      doi: "10.1007/978-3-032-31233-4_7",
      url: "https://doi.org/10.1007/978-3-032-31233-4_7" as string | null,
      code: "https://github.com/agarwalpranay02/Hybrid-Deep-Learning-for-Plant-Disease-Diagnosis" as string | null,
    },
    {
      id: "discover2026",
      title: "A comprehensive review and bibliometric analysis of deep learning applications in plant disease detection",
      venue: "Discover Artificial Intelligence 6, 1459. Springer Nature, open access",
      year: 2026,
      doi: "10.1007/s44163-026-02310-z",
      url: "https://doi.org/10.1007/s44163-026-02310-z" as string | null,
      code: null as string | null,
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
    // Scan of the Certificate of Registration issued by the Patent Office
    certificateUrl: "https://drive.google.com/file/d/1fnbNIrKeal7NGtuPIZunkuAs7jU-0VHw/view?usp=sharing",
  },
  press: [{ outlet: "Punjab Kesari", city: "Jaipur", date: "2025-10-10", url: "https://drive.google.com/file/d/18E9B6SJ9ubYkws0eT9Z8jRuzZ3ren0bo/view?usp=sharing" }],
} as const;
