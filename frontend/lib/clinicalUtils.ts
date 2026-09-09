/**
 * Shared Clinical String & Entity Normalization Utilities
 * Eliminates duplication across Doctor, Nurse, and Patient interfaces.
 */
import type { TreatmentRecord } from "./types";

/**
 * Clean and normalize symptom, concept, or raw medical text string.
 */
export function cleanSymptomText(str: string): string {
  if (!str) return "None reported";
  const cleaned = str
    .replace(/\{.*?['"]displayLabel['"]:\s*['"](.*?)['"].*?\}/g, "$1")
    .replace(/\[\s*['"](.*?)['"]\s*\]/g, "$1")
    .replace(/\(\s*\[.*?\]\s*\)/g, "")
    .replace(/\(\s*['"](.*?)['"]\s*\)/g, "($1)")
    .replace(/['"[\]]/g, "")
    .replace(/_/g, " ")
    .replace(/\b(true|false|null|undefined)\b/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*|\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "None reported";
}

/**
 * Extract a concise, readable illness or consultation title from a treatment record.
 */
export function formatShortIllnessName(rec: TreatmentRecord): string {
  let name = (rec.illness_name || rec.diagnosis || "Medical Consultation").trim();
  name = name.replace(/^follow[- ]up:\s*/i, "").replace(/^past\s+/i, "");
  if (name.includes("Duration:")) {
    name = name.split("Duration:")[0].trim();
  }
  if (!name && rec.symptoms) {
    name = rec.symptoms.split(",")[0].trim();
  }
  const words = (name || "Medical Consultation").split(/\s+/);
  if (words.length > 5) {
    name = words.slice(0, 4).join(" ");
  }
  return cleanSymptomText(name) || "Medical Consultation";
}

/**
 * Filter and format secondary/associated symptoms from a treatment record,
 * excluding the primary diagnosis to avoid redundancy.
 */
export function getPastAssociatedSymptoms(rec: TreatmentRecord): string {
  if (!rec.symptoms) return "";
  const shortName = formatShortIllnessName(rec).toLowerCase();
  const parts = rec.symptoms
    .split(",")
    .map((s) => cleanSymptomText(s))
    .filter((s) => {
      const low = s.toLowerCase();
      return (
        s &&
        low !== "none reported" &&
        low !== "general symptoms" &&
        low !== "general consultation" &&
        !shortName.includes(low)
      );
    });
  return parts.join(", ");
}
