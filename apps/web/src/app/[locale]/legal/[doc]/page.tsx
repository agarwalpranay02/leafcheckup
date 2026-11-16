import { COVERAGE } from "@/lib/diseases";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SITE } from "@/lib/site";

const UPDATED = "16 November 2026";

const P = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[var(--muted)] prose-measure">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h2 className="title mt-10 text-2xl">{children}</h2>;
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[var(--muted)] prose-measure">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);

const DOCS: Record<string, { title: string; body: ReactNode }> = {
  privacy: {
    title: "Privacy policy",
    body: (
      <>
        <P>LeafCheckup is built so that the most sensitive thing you give it, a photo of your crop, never leaves your device. This policy explains exactly what is processed, where, and why. It is written to meet India&apos;s Digital Personal Data Protection Act, 2023.</P>
        <H>Leaf photos</H>
        <P>Diagnosis on leafcheckup.com runs inside your browser. Photos are decoded and analysed on your phone or computer and are not uploaded to us. Your scan history (a small thumbnail, the result and any note you add) is stored in your browser&apos;s IndexedDB on that device only. You can export or delete it at any time from My scans. Clearing your browser data also deletes it.</P>
        <P>If you call the developer API, the image you send is processed in memory to return a result and is not stored. We log the time, key identifier, response code and latency for billing and abuse prevention.</P>
        <H>Accounts</H>
        <P>You only need an account to create API keys. We store your name, email address, profile picture URL (if you sign in with Google), and session records (including IP address and browser user agent, used to protect your account). Sign-in links are sent by email through Resend; Google sign-in is handled by Google.</P>
        <H>Other data</H>
        <UL items={[
          "Contact form: your name, email, organisation and message, stored so we can reply.",
          "Rate limiting: a salted hash of your IP address, kept briefly in memory or in our cache provider.",
          "Weather risk: if you use it, your browser sends the coordinates or place name directly to Open-Meteo to fetch the forecast. We do not receive them.",
          "Security reports: browsers may send us Content-Security-Policy violation reports, which contain the page URL.",
        ]} />
        <H>What we don&apos;t do</H>
        <UL items={["No advertising, no ad trackers, no selling or sharing of personal data.", "No third-party analytics scripts on the site.", "Photos are not used to train models unless you explicitly choose to contribute them in a future opt-in feature."]} />
        <H>Cookies</H>
        <P>Only essential cookies: a session cookie when you sign in, and a language preference. No consent banner is needed because nothing non-essential is set.</P>
        <H>Retention and your rights</H>
        <P>Account data is kept while your account is active and deleted within 30 days of a deletion request; contact messages are kept for up to two years. You can ask to access, correct or erase your data, withdraw consent, or nominate someone to act for you, by writing to {SITE.email}. We reply within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.</P>
        <H>Processors</H>
        <P>Hosting and database, Resend (email), Google (optional sign-in) and Cloudflare (network security). Each processes data only to provide its service to us.</P>
      </>
    ),
  },
  terms: {
    title: "Terms of use",
    body: (
      <>
        <P>By using LeafCheckup you agree to these terms. If you use LeafCheckup for an organisation, you accept them on its behalf.</P>
        <H>The service</H>
        <P>LeafCheckup provides AI-assisted identification of a limited set of crop leaf conditions, field guides and planning tools. Results are probabilistic and can be wrong. See the disclaimer.</P>
        <H>Acceptable use</H>
        <UL items={[
          "Don't attempt to break, overload, scrape or reverse-engineer the service or API beyond what the published model card and code permit.",
          "Don't share API keys publicly or use them to resell raw API access without a written agreement.",
          "Don't upload images you have no right to use, or content that is unlawful.",
        ]} />
        <H>Free service and the API</H>
        <P>LeafCheckup is free to use, including the API. Fair-use limits are listed on the API page. We may suspend keys that are abused or that put the service at risk, and we may change or end the service at any time.</P>
        <H>Intellectual property</H>
        <P>The LeafCheckup name, app and model weights belong to LeafCheckup and their authors. The training datasets remain under their own licences (see Licences). Results you generate are yours to use.</P>
        <H>No warranty, limitation of liability</H>
        <P>The service is provided &quot;as is&quot;. To the maximum extent permitted by law, LeafCheckup is not liable for crop loss, treatment costs or indirect damages arising from reliance on a result. Because the service is free, our total liability for any claim is limited to ₹1,000.</P>
        <H>Law</H>
        <P>These terms are governed by the laws of India. Courts at Jaipur, Rajasthan have exclusive jurisdiction.</P>
        <H>Changes</H>
        <P>We will post changes here with a new date at the top.</P>
      </>
    ),
  },
  disclaimer: {
    title: "Disclaimer",
    body: (
      <>
        <P>LeafCheckup is a decision-support tool. It is not a substitute for a qualified agronomist, plant pathologist, or the advice of your Krishi Vigyan Kendra (KVK) or state agriculture department.</P>
        <UL items={[
          `The model recognises only ${COVERAGE.conditionCount} leaf conditions in ${COVERAGE.cropCount} crops. Other diseases, pests and nutrient problems may be misclassified.`,
          "A single leaf photo cannot show whole-plant or field-level symptoms. Check the symptom list and scout several plants.",
          "Chemical options are named by active ingredient for orientation only. Use only products registered by the Central Insecticides Board & Registration Committee (CIB&RC) for your crop, follow the label dose, safety precautions and pre-harvest interval, and wear protective equipment.",
          "Weather risk scores are rules of thumb, not a forecast of disease.",
        ]} />
        <P>Confirm serious or spreading problems with a local expert before acting.</P>
      </>
    ),
  },
  licenses: {
    title: "Licences and credits",
    body: (
      <>
        <H>Datasets</H>
        <UL items={[
          "Preprocessed Indian Ridge Gourd Leaf Image Dataset, IEEE DataPort, DOI 10.21227/469z-vm04, Creative Commons Attribution 4.0. Sample photos on this site come from this dataset.",
          "Brinjal Leaf Image Dataset: Mendeley Data, DOI 10.17632/c39p3k87g2.1, under the licence stated on the dataset page.",
        ]} />
        <H>Software and models</H>
        <UL items={[
          "EfficientNet-B0 ImageNet weights from PyTorch Image Models (timm), Apache 2.0.",
          "ONNX Runtime Web, MIT licence.",
          "Next.js and React, MIT licence.",
          "Anek Latin and Anek Devanagari typefaces by Ek Type, SIL Open Font Licence 1.1.",
          "Weather data by Open-Meteo.com, CC BY 4.0.",
        ]} />
        <H>Field guide sources</H>
        <P>Management guidance is summarised in our own words from TNAU Agritech, ICAR-IIHR publications, Kerala Agricultural University, the National Horticulture Board, peer-reviewed papers and the Commonwealth of Learning Integrated Disease Management course (CC BY-SA 4.0). Each condition page links its sources.</P>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return DOCS[doc] ? { title: DOCS[doc].title } : {};
}

export default async function Legal({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <>
      <PageHeader title={d.title} sub={`Last updated ${UPDATED}`} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6" lang="en">{d.body}</div>
    </>
  );
}
