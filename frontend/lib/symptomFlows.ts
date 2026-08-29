import { Language } from "./translations";

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "body_location"
  | "pain_scale"
  | "duration"
  | "yes_no"
  | "text_or_voice";

export interface SymptomOption {
  id: string;
  label: { en: string; hi: string };
  concept_value?: any;
  triggers_followup?: string[]; // IDs of conditional follow-up questions
}

export interface AdaptiveQuestion {
  id: string;
  concept: string;
  title?: { en: string; hi: string };
  prompt: { en: string; hi: string };
  type: QuestionType;
  options?: SymptomOption[];
  allowUnknown?: boolean;
  required?: boolean;
  category?: string;
  isRedFlagCheck?: boolean;
  inverse?: boolean;
}

export interface SymptomCategory {
  id: string;
  icon: string;
  label: { en: string; hi: string };
  description: { en: string; hi: string };
  questionIds: string[];
}

export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    id: "fever",
    icon: "🌡️",
    label: { en: "Fever", hi: "बुखार" },
    description: { en: "High temperature, chills, sweating", hi: "तेज़ तापमान, ठंड लगना, पसीना" },
    questionIds: ["fever_duration", "fever_associated", "fever_chills"],
  },
  {
    id: "pain",
    icon: "⚡",
    label: { en: "Pain", hi: "दर्द / तकलीफ" },
    description: { en: "Body ache, leg, arm, back, or chest pain", hi: "शरीर में दर्द, हाथ-पैर, पीठ या छाती में दर्द" },
    questionIds: ["pain_location", "pain_severity", "pain_duration", "pain_character"],
  },
  {
    id: "cough_cold",
    icon: "🤧",
    label: { en: "Cough / Cold", hi: "खांसी / जुकाम" },
    description: { en: "Running nose, throat irritation, sputum", hi: "बहती नाक, गले में खराश, बलगम" },
    questionIds: ["cough_duration", "cough_type", "cough_fever_present"],
  },
  {
    id: "headache",
    icon: "🤕",
    label: { en: "Headache / Dizziness", hi: "सिरदर्द / चक्कर" },
    description: { en: "Head pressure, migraine, vertigo", hi: "सिर में भारीपन, माइग्रेन, चक्कर आना" },
    questionIds: ["headache_duration", "headache_severity", "headache_sudden"],
  },
  {
    id: "eye_problem",
    icon: "👁️",
    label: { en: "Eye Problem", hi: "आंख की समस्या" },
    description: { en: "Redness, vision change, irritation", hi: "लालिमा, धुंधला दिखना, जलन" },
    questionIds: ["eye_which", "eye_symptoms", "eye_duration"],
  },
  {
    id: "stomach_problem",
    icon: "🤢",
    label: { en: "Stomach Problem", hi: "पेट की समस्या" },
    description: { en: "Acidity, vomiting, loose motions, cramps", hi: "एसिडिटी, उल्टी, दस्त, पेट में मरोड़" },
    questionIds: ["stomach_symptoms", "stomach_duration", "stomach_severity"],
  },
  {
    id: "breathing_problem",
    icon: "🫁",
    label: { en: "Breathing Problem", hi: "सांस लेने में तकलीफ" },
    description: { en: "Shortness of breath, wheezing, tightness", hi: "सांस फूलना, घरघराहट, सीने में जकड़न" },
    questionIds: ["breathing_onset", "breathing_severity", "breathing_chest_pain"],
  },
  {
    id: "skin_problem",
    icon: "🧴",
    label: { en: "Skin Problem", hi: "त्वचा / दाने / खुजली" },
    description: { en: "Rashes, itching, allergy, swelling", hi: "दाने, खुजली, एलर्जी, सूजन" },
    questionIds: ["skin_symptoms", "skin_duration", "skin_spreading"],
  },
  {
    id: "injury",
    icon: "🩹",
    label: { en: "Injury", hi: "चोट / दुर्घटना" },
    description: { en: "Fall, cut, burn, sports impact", hi: "गिरना, घाव, जलना, चोट लगना" },
    questionIds: ["injury_mechanism", "injury_location", "injury_duration", "injury_bleeding"],
  },
  {
    id: "dental_problem",
    icon: "🦷",
    label: { en: "Dental Problem", hi: "दांत / मुंह की समस्या" },
    description: { en: "Toothache, gum swelling, bleeding", hi: "दांत दर्द, मसूड़ों में सूजन, खून आना" },
    questionIds: ["dental_symptoms", "dental_duration", "dental_severity"],
  },
  {
    id: "urine_problem",
    icon: "🚽",
    label: { en: "Urine Problem", hi: "पेशाब में समस्या" },
    description: { en: "Burning sensation, frequency, pain", hi: "पेशाब में जलन, बार-बार जाना, दर्द" },
    questionIds: ["urine_symptoms", "urine_duration", "urine_blood"],
  },
  {
    id: "animal_bite",
    icon: "🐕",
    label: { en: "Animal Bite / Scratch", hi: "जानवर का काटना / खरोंच" },
    description: { en: "Dog, cat, monkey, or other animal exposure", hi: "कुत्ता, बिल्ली, बंदर या अन्य जानवर का हमला" },
    questionIds: ["animal_type", "animal_skin_broken", "animal_time_elapsed", "animal_bleeding"],
  },
  {
    id: "other_problem",
    icon: "📝",
    label: { en: "Other Problem", hi: "अन्य कोई समस्या" },
    description: { en: "Describe in your own words (voice / text)", hi: "अपनी भाषा में बोलकर या लिखकर बताएं" },
    questionIds: ["other_description", "other_duration", "other_severity"],
  },
];

export const QUESTION_DEFINITIONS: Record<string, AdaptiveQuestion> = {
  // --- FEVER QUESTIONS ---
  fever_duration: {
    id: "fever_duration",
    concept: "symptom_onset",
    prompt: {
      en: "How long have you had the fever?",
      hi: "आपको बुखार कितने समय से है?",
    },
    type: "duration",
    allowUnknown: true,
  },
  fever_associated: {
    id: "fever_associated",
    concept: "fever_associated_symptoms",
    prompt: {
      en: "Do you have any of these associated symptoms?",
      hi: "क्या आपको इनमें से कोई अन्य लक्षण भी हैं?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "cough", label: { en: "Cough / Cold", hi: "खांसी / जुकाम" } },
      { id: "headache", label: { en: "Headache", hi: "सिरदर्द" } },
      { id: "body_pain", label: { en: "Body pain", hi: "बदन दर्द" } },
      { id: "vomiting", label: { en: "Vomiting", hi: "उल्टी" } },
      { id: "diarrhea", label: { en: "Diarrhea / Loose motions", hi: "दस्त" } },
      { id: "rash", label: { en: "Skin rash", hi: "त्वचा पर दाने" } },
      { id: "chills", label: { en: "Chills / Shivering", hi: "कंपकंपी / ठंड लगना" } },
      { id: "none", label: { en: "None of these", hi: "इनमें से कोई नहीं" } },
    ],
  },
  fever_chills: {
    id: "fever_chills",
    concept: "sweating",
    prompt: {
      en: "Are you experiencing severe chills or high sweating?",
      hi: "क्या आपको बहुत तेज कंपकंपी या पसीना आ रहा है?",
    },
    type: "yes_no",
    allowUnknown: true,
  },

  // --- PAIN QUESTIONS ---
  pain_location: {
    id: "pain_location",
    concept: "location",
    prompt: {
      en: "Where is the pain located?",
      hi: "दर्द शरीर के किस हिस्से में है?",
    },
    type: "body_location",
    allowUnknown: true,
  },
  pain_severity: {
    id: "pain_severity",
    concept: "severity",
    prompt: {
      en: "How severe is the pain on a scale from 0 (no pain) to 10 (worst pain)?",
      hi: "दर्द की तीव्रता 0 (बिल्कुल नहीं) से 10 (असहनीय) में कितनी है?",
    },
    type: "pain_scale",
    allowUnknown: true,
  },
  pain_duration: {
    id: "pain_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did the pain start?",
      hi: "यह दर्द कब शुरू हुआ था?",
    },
    type: "duration",
    allowUnknown: true,
  },
  pain_character: {
    id: "pain_character",
    concept: "character",
    prompt: {
      en: "How would you describe the pain sensation?",
      hi: "यह दर्द किस प्रकार का महसूस होता है?",
    },
    type: "single_choice",
    allowUnknown: true,
    options: [
      { id: "throbbing", label: { en: "Throbbing / Pulsing", hi: "धड़कता हुआ / टीस मारने वाला" } },
      { id: "sharp", label: { en: "Sharp / Stabbing", hi: "तेज़ चुभने वाला" } },
      { id: "dull", label: { en: "Dull ache / Heaviness", hi: "मीठा दर्द / भारीपन" } },
      { id: "burning", label: { en: "Burning sensation", hi: "जलन जैसा" } },
      { id: "cramping", label: { en: "Cramping / Spasm", hi: "ऐंठन / मरोड़" } },
    ],
  },

  // --- CHEST PAIN FOLLOW-UPS (If chest selected in location) ---
  chest_radiation: {
    id: "chest_radiation",
    concept: "radiation_to_arm",
    prompt: {
      en: "Does the chest pain spread to your left arm, jaw, neck, or back?",
      hi: "क्या सीने का दर्द बाएं हाथ, जबड़े, गर्दन या पीठ की तरफ फैलता है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },
  chest_dyspnea: {
    id: "chest_dyspnea",
    concept: "dyspnea",
    prompt: {
      en: "Do you feel short of breath or difficulty breathing with chest pain?",
      hi: "क्या सीने के दर्द के साथ सांस लेने में कठिनाई हो रही है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },
  chest_sweating: {
    id: "chest_sweating",
    concept: "sweating",
    prompt: {
      en: "Have you noticed unusual cold sweating or clamminess?",
      hi: "क्या आपको असामान्य रूप से ठंडा पसीना आ रहा है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },

  // --- EYE PROBLEM QUESTIONS ---
  eye_which: {
    id: "eye_which",
    concept: "eye_side",
    prompt: {
      en: "Which eye is affected?",
      hi: "किस आंख में समस्या है?",
    },
    type: "single_choice",
    allowUnknown: true,
    options: [
      { id: "left", label: { en: "Left eye", hi: "बाईं आंख" } },
      { id: "right", label: { en: "Right eye", hi: "दाईं आंख" } },
      { id: "both", label: { en: "Both eyes", hi: "दोनों आंखें" } },
    ],
  },
  eye_symptoms: {
    id: "eye_symptoms",
    concept: "eye_symptoms_list",
    prompt: {
      en: "What are you experiencing in your eye?",
      hi: "आंख में क्या तकलीफ महसूस हो रही है?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "pain", label: { en: "Eye pain", hi: "आंख में दर्द" } },
      { id: "redness", label: { en: "Redness", hi: "लालिमा" } },
      { id: "itching", label: { en: "Itching / Irritation", hi: "खुजली / जलन" } },
      { id: "watering", label: { en: "Watering / Discharge", hi: "पानी या कीचड़ आना" } },
      { id: "blurred_vision", label: { en: "Blurred vision", hi: "धुंधला दिखना" } },
      { id: "swelling", label: { en: "Eyelid swelling", hi: "पलकों में सूजन" } },
      { id: "foreign_body", label: { en: "Something entered eye (dust/particle)", hi: "आंख में कुछ चला गया" } },
    ],
  },
  eye_duration: {
    id: "eye_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did the eye discomfort begin?",
      hi: "आंख की तकलीफ कब शुरू हुई थी?",
    },
    type: "duration",
    allowUnknown: true,
  },

  // --- INJURY QUESTIONS ---
  injury_mechanism: {
    id: "injury_mechanism",
    concept: "injury_cause",
    prompt: {
      en: "How did the injury happen?",
      hi: "चोट कैसे लगी?",
    },
    type: "single_choice",
    allowUnknown: true,
    options: [
      { id: "fall", label: { en: "Fall", hi: "गिरने से" } },
      { id: "accident", label: { en: "Road / Vehicle accident", hi: "सड़क दुर्घटना" } },
      { id: "cut", label: { en: "Cut / Sharp object wound", hi: "कटने या घाव से" } },
      { id: "burn", label: { en: "Burn (heat / fire / chemical)", hi: "जलने से" } },
      { id: "hit", label: { en: "Blunt hit / Heavy impact", hi: "भारी वस्तु लगने से" } },
      { id: "sports", label: { en: "Sports / Twist / Sprain", hi: "खेल में मोच या खिंचाव" } },
      { id: "other", label: { en: "Other incident", hi: "अन्य कारण" } },
    ],
  },
  injury_location: {
    id: "injury_location",
    concept: "location",
    prompt: {
      en: "Where is the injury located?",
      hi: "शरीर के किस भाग में चोट लगी है?",
    },
    type: "body_location",
    allowUnknown: true,
  },
  injury_duration: {
    id: "injury_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did this injury happen?",
      hi: "यह चोट कब लगी थी?",
    },
    type: "duration",
    allowUnknown: true,
  },
  injury_bleeding: {
    id: "injury_bleeding",
    concept: "active_bleeding",
    prompt: {
      en: "Is there active or continuous bleeding?",
      hi: "क्या लगातार खून बह रहा है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },

  // --- ANIMAL BITE / SCRATCH ---
  animal_type: {
    id: "animal_type",
    concept: "animal_exposure_type",
    prompt: {
      en: "Which animal was involved?",
      hi: "किस जानवर ने काटा या खरोंचा?",
    },
    type: "single_choice",
    allowUnknown: true,
    options: [
      { id: "dog", label: { en: "Dog (Stray / Pet)", hi: "कुत्ता (आवारा / पालतू)" } },
      { id: "cat", label: { en: "Cat", hi: "बिल्ली" } },
      { id: "monkey", label: { en: "Monkey", hi: "बंदर" } },
      { id: "bat", label: { en: "Bat", hi: "चमगादड़" } },
      { id: "snake", label: { en: "Snake / Reptile", hi: "सांप / विषैला जीव" } },
      { id: "other", label: { en: "Other animal", hi: "अन्य जानवर" } },
    ],
  },
  animal_skin_broken: {
    id: "animal_skin_broken",
    concept: "animal_exposure_broken_skin",
    prompt: {
      en: "Did the bite or scratch break the skin or cause bleeding?",
      hi: "क्या त्वचा कटी, छिल गई या खून निकला?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },
  animal_time_elapsed: {
    id: "animal_time_elapsed",
    concept: "animal_exposure_time",
    prompt: {
      en: "When did the animal exposure happen?",
      hi: "यह घटना कब हुई थी?",
    },
    type: "duration",
    allowUnknown: true,
  },
  animal_bleeding: {
    id: "animal_bleeding",
    concept: "wound_washed",
    prompt: {
      en: "Did you immediately wash the wound with soap and running water for 15 minutes?",
      hi: "क्या आपने घाव को साबुन और बहते पानी से तुरंत 15 मिनट धोया था?",
    },
    type: "yes_no",
    allowUnknown: true,
  },

  // --- COUGH / COLD ---
  cough_duration: {
    id: "cough_duration",
    concept: "symptom_onset",
    prompt: {
      en: "How long have you been coughing?",
      hi: "आपको खांसी कितने दिनों से है?",
    },
    type: "duration",
    allowUnknown: true,
  },
  cough_type: {
    id: "cough_type",
    concept: "cough_character",
    prompt: {
      en: "What type of cough is it?",
      hi: "खांसी किस प्रकार की है?",
    },
    type: "single_choice",
    allowUnknown: true,
    options: [
      { id: "dry", label: { en: "Dry cough (no mucus)", hi: "सूखी खांसी (बिना बलगम)" } },
      { id: "productive", label: { en: "Wet cough with sputum / mucus", hi: "बलगम वाली खांसी" } },
      { id: "blood", label: { en: "Blood in sputum (Hemoptysis)", hi: "बलगम में खून" } },
    ],
  },
  cough_fever_present: {
    id: "cough_fever_present",
    concept: "fever_present",
    prompt: {
      en: "Do you also feel feverish or have throat pain?",
      hi: "क्या आपको साथ में बुखार या गले में दर्द भी है?",
    },
    type: "yes_no",
    allowUnknown: true,
  },

  // --- HEADACHE ---
  headache_duration: {
    id: "headache_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did the headache begin?",
      hi: "सिरदर्द कब शुरू हुआ?",
    },
    type: "duration",
    allowUnknown: true,
  },
  headache_severity: {
    id: "headache_severity",
    concept: "severity",
    prompt: {
      en: "How severe is the headache (0–10)?",
      hi: "सिरदर्द की तीव्रता (0–10) कितनी है?",
    },
    type: "pain_scale",
    allowUnknown: true,
  },
  headache_sudden: {
    id: "headache_sudden",
    concept: "headache_thunderclap",
    prompt: {
      en: "Did this headache start extremely suddenly like a thunderclap?",
      hi: "क्या यह सिरदर्द अचानक बहुत तेज (बिजली की तरह) शुरू हुआ?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },

  // --- STOMACH PROBLEM ---
  stomach_symptoms: {
    id: "stomach_symptoms",
    concept: "stomach_symptoms_list",
    prompt: {
      en: "What stomach problems are you experiencing?",
      hi: "पेट में क्या समस्या महसूस हो रही है?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "acidity", label: { en: "Burning / Acidity / Heartburn", hi: "सीने में जलन / एसिडिटी" } },
      { id: "vomiting", label: { en: "Vomiting / Nausea", hi: "उल्टी या जी मिचलाना" } },
      { id: "diarrhea", label: { en: "Loose motions / Diarrhea", hi: "दस्त या बार-बार शौच" } },
      { id: "cramps", label: { en: "Severe cramps / Pain", hi: "पेट में तेज मरोड़ या दर्द" } },
      { id: "constipation", label: { en: "Constipation (hard stool)", hi: "कब्ज" } },
      { id: "bloating", label: { en: "Gas / Bloating", hi: "पेट फूलना / गैस" } },
    ],
  },
  stomach_duration: {
    id: "stomach_duration",
    concept: "symptom_onset",
    prompt: {
      en: "How long have you had this stomach complaint?",
      hi: "यह पेट की परेशानी कितने समय से है?",
    },
    type: "duration",
    allowUnknown: true,
  },
  stomach_severity: {
    id: "stomach_severity",
    concept: "severity",
    prompt: {
      en: "How severe is the discomfort (0–10)?",
      hi: "तकलीफ की तीव्रता कितनी है (0–10)?",
    },
    type: "pain_scale",
    allowUnknown: true,
  },

  // --- BREATHING PROBLEM ---
  breathing_onset: {
    id: "breathing_onset",
    concept: "symptom_onset",
    prompt: {
      en: "When did the breathlessness start?",
      hi: "सांस लेने में कठिनाई कब शुरू हुई?",
    },
    type: "duration",
    allowUnknown: true,
  },
  breathing_severity: {
    id: "breathing_severity",
    concept: "dyspnea",
    prompt: {
      en: "Are you unable to speak full sentences without pausing for breath?",
      hi: "क्या आप बिना सांस रुके पूरे वाक्य नहीं बोल पा रहे हैं?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },
  breathing_chest_pain: {
    id: "breathing_chest_pain",
    concept: "chest_pain",
    prompt: {
      en: "Do you also have chest pain or blue lips/fingertips?",
      hi: "क्या आपको साथ में सीने में दर्द या होंठ नीले पड़ने की समस्या है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },

  // --- SKIN PROBLEM ---
  skin_symptoms: {
    id: "skin_symptoms",
    concept: "skin_symptoms_list",
    prompt: {
      en: "What skin issues do you have?",
      hi: "त्वचा में क्या समस्या है?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "red_rash", label: { en: "Red rash / spots", hi: "लाल चकत्ते या दाने" } },
      { id: "severe_itching", label: { en: "Severe itching", hi: "तेज खुजली" } },
      { id: "swelling", label: { en: "Skin swelling / hives", hi: "त्वचा की सूजन" } },
      { id: "boil_pus", label: { en: "Boil / Pus / Wound", hi: "फोड़ा / मवाद / घाव" } },
      { id: "scaling", label: { en: "Dry scaling / peeling", hi: "सूखी पपड़ी" } },
    ],
  },
  skin_duration: {
    id: "skin_duration",
    concept: "symptom_onset",
    prompt: {
      en: "How long has this skin condition been present?",
      hi: "यह त्वचा की समस्या कब से है?",
    },
    type: "duration",
    allowUnknown: true,
  },
  skin_spreading: {
    id: "skin_spreading",
    concept: "skin_spreading",
    prompt: {
      en: "Is the rash spreading rapidly over your body?",
      hi: "क्या यह चकत्ते पूरे शरीर पर तेजी से फैल रहे हैं?",
    },
    type: "yes_no",
    allowUnknown: true,
  },

  // --- DENTAL PROBLEM ---
  dental_symptoms: {
    id: "dental_symptoms",
    concept: "dental_symptoms_list",
    prompt: {
      en: "What dental problem do you have?",
      hi: "दांत या मुंह में क्या तकलीफ है?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "toothache", label: { en: "Toothache / Cavity pain", hi: "दांत में दर्द / कीड़ा" } },
      { id: "gum_swelling", label: { en: "Gum swelling / pain", hi: "मसूड़ों में सूजन या दर्द" } },
      { id: "bleeding_gums", label: { en: "Bleeding gums", hi: "मसूड़ों से खून आना" } },
      { id: "sensitivity", label: { en: "Hot/Cold sensitivity", hi: "ठंडा-गरम लगना" } },
      { id: "mouth_ulcer", label: { en: "Mouth ulcer / sores", hi: "मुंह में छाले" } },
    ],
  },
  dental_duration: {
    id: "dental_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did the dental discomfort begin?",
      hi: "दांत की तकलीफ कब शुरू हुई?",
    },
    type: "duration",
    allowUnknown: true,
  },
  dental_severity: {
    id: "dental_severity",
    concept: "severity",
    prompt: {
      en: "How severe is the dental pain (0–10)?",
      hi: "दांत दर्द की तीव्रता कितनी है (0–10)?",
    },
    type: "pain_scale",
    allowUnknown: true,
  },

  // --- URINE PROBLEM ---
  urine_symptoms: {
    id: "urine_symptoms",
    concept: "urine_symptoms_list",
    prompt: {
      en: "What urinary complaints do you have?",
      hi: "पेशाब से संबंधित क्या परेशानी है?",
    },
    type: "multi_choice",
    allowUnknown: true,
    options: [
      { id: "burning", label: { en: "Burning sensation while urinating", hi: "पेशाब में जलन" } },
      { id: "frequency", label: { en: "Frequent urination (day or night)", hi: "बार-बार पेशाब आना" } },
      { id: "difficulty", label: { en: "Difficulty / straining to pass urine", hi: "पेशाब करने में जोर लगाना" } },
      { id: "blood", label: { en: "Red or dark-colored urine (blood)", hi: "पेशाब में खून या लाल रंग" } },
      { id: "lower_back_pain", label: { en: "Flank / lower back / groin pain", hi: "कमर या पेडू में तेज दर्द" } },
    ],
  },
  urine_duration: {
    id: "urine_duration",
    concept: "symptom_onset",
    prompt: {
      en: "How long have you had this urinary discomfort?",
      hi: "यह परेशानी कितने समय से है?",
    },
    type: "duration",
    allowUnknown: true,
  },
  urine_blood: {
    id: "urine_blood",
    concept: "hematuria",
    prompt: {
      en: "Are you also experiencing fever with chills along with urine pain?",
      hi: "क्या पेशाब की तकलीफ के साथ ठंड लगकर तेज बुखार भी आ रहा है?",
    },
    type: "yes_no",
    allowUnknown: true,
    isRedFlagCheck: true,
  },

  // --- OTHER PROBLEM ---
  other_description: {
    id: "other_description",
    concept: "chief_complaint",
    prompt: {
      en: "Tell us what is troubling you today.",
      hi: "कृपया बोलकर या लिखकर बताएं कि आज आपको क्या तकलीफ है।",
    },
    type: "text_or_voice",
    allowUnknown: true,
  },
  other_duration: {
    id: "other_duration",
    concept: "symptom_onset",
    prompt: {
      en: "When did this trouble begin?",
      hi: "यह समस्या कब से शुरू हुई थी?",
    },
    type: "duration",
    allowUnknown: true,
  },
  other_severity: {
    id: "other_severity",
    concept: "severity",
    prompt: {
      en: "How severe is your discomfort (0–10)?",
      hi: "तकलीफ की तीव्रता (0–10) कितनी है?",
    },
    type: "pain_scale",
    allowUnknown: true,
  },

  // --- ROUTINE GENERAL MEDICINES & ALLERGIES (Universal closing facts) ---
  general_meds: {
    id: "general_meds",
    concept: "medication_reported_none",
    prompt: {
      en: "Are you currently taking any daily medicines or tablets?",
      hi: "क्या आप वर्तमान में कोई नियमित दवा या गोलियां ले रहे हैं?",
    },
    type: "yes_no",
    allowUnknown: true,
    inverse: true,
  },
  general_allergies: {
    id: "general_allergies",
    concept: "allergy_reported_none",
    prompt: {
      en: "Do you have any known drug or medicine allergies?",
      hi: "क्या आपको किसी दवा से कोई एलर्जी है?",
    },
    type: "yes_no",
    allowUnknown: true,
    inverse: true,
  },
};

export interface BodyLocationItem {
  id: string;
  label: { en: string; hi: string };
  subLocations?: { id: string; label: { en: string; hi: string } }[];
  isChest?: boolean;
}

export const BODY_LOCATIONS: BodyLocationItem[] = [
  {
    id: "head",
    label: { en: "Head / Face", hi: "सिर / चेहरा" },
    subLocations: [
      { id: "forehead", label: { en: "Forehead", hi: "माथा" } },
      { id: "temples", label: { en: "Temples (Sides)", hi: "कनपटी" } },
      { id: "back_head", label: { en: "Back of head", hi: "सिर का पिछला हिस्सा" } },
      { id: "jaw", label: { en: "Jaw / Cheek", hi: "जबड़ा / गाल" } },
      { id: "entire_head", label: { en: "Entire head", hi: "पूरा सिर" } },
    ],
  },
  {
    id: "chest",
    label: { en: "Chest", hi: "छाती / सीना" },
    isChest: true,
    subLocations: [
      { id: "centre_chest", label: { en: "Centre of chest", hi: "सीने के बीच में" } },
      { id: "left_chest", label: { en: "Left chest", hi: "सीने के बाईं तरफ" } },
      { id: "right_chest", label: { en: "Right chest", hi: "सीने के दाईं तरफ" } },
      { id: "ribs", label: { en: "Rib cage / Sides", hi: "पसलियां" } },
    ],
  },
  {
    id: "abdomen",
    label: { en: "Abdomen / Stomach", hi: "पेट" },
    subLocations: [
      { id: "upper_stomach", label: { en: "Upper abdomen (Epigastric)", hi: "पेट के ऊपरी हिस्से में" } },
      { id: "lower_stomach", label: { en: "Lower abdomen (Pelvic)", hi: "पेट के निचले हिस्से में" } },
      { id: "right_lower", label: { en: "Right lower side (Appendix area)", hi: "पेट के दाईं तरफ नीचे" } },
      { id: "around_navel", label: { en: "Around navel (Umbilical)", hi: "नाभि के आसपास" } },
      { id: "entire_stomach", label: { en: "Entire abdomen", hi: "पूरे पेट में" } },
    ],
  },
  {
    id: "back",
    label: { en: "Back / Spine", hi: "पीठ / रीढ़" },
    subLocations: [
      { id: "upper_back", label: { en: "Upper back / Shoulder blades", hi: "पीठ के ऊपरी भाग" } },
      { id: "lower_back", label: { en: "Lower back (Lumbar)", hi: "कमर / निचली पीठ" } },
      { id: "neck_spine", label: { en: "Neck & cervical spine", hi: "गर्दन व रीढ़" } },
    ],
  },
  {
    id: "leg",
    label: { en: "Leg / Foot", hi: "पैर / टांग" },
    subLocations: [
      { id: "hip", label: { en: "Hip / Groin", hi: "कूल्हा / जांघ का जोड़" } },
      { id: "thigh", label: { en: "Thigh", hi: "जांघ" } },
      { id: "knee", label: { en: "Knee", hi: "घुटना" } },
      { id: "calf", label: { en: "Calf / Shin", hi: "पिंडली" } },
      { id: "ankle", label: { en: "Ankle", hi: "टखना" } },
      { id: "foot", label: { en: "Foot / Toes", hi: "पैर का पंजा / उंगलियां" } },
      { id: "entire_leg", label: { en: "Entire leg", hi: "पूरी टांग" } },
    ],
  },
  {
    id: "arm",
    label: { en: "Arm / Hand", hi: "हाथ / बांह" },
    subLocations: [
      { id: "shoulder", label: { en: "Shoulder", hi: "कंधा" } },
      { id: "upper_arm", label: { en: "Upper arm / Bicep", hi: "ऊपरी बांह" } },
      { id: "elbow", label: { en: "Elbow", hi: "कोहनी" } },
      { id: "forearm", label: { en: "Forearm", hi: "कलाई के ऊपर" } },
      { id: "wrist", label: { en: "Wrist", hi: "कलाई" } },
      { id: "hand_fingers", label: { en: "Hand & fingers", hi: "हथेली व उंगलियां" } },
      { id: "entire_arm", label: { en: "Entire arm", hi: "पूरा हाथ" } },
    ],
  },
  {
    id: "joint",
    label: { en: "Multiple Joints", hi: "जोड़ / गठिया" },
    subLocations: [
      { id: "knees_both", label: { en: "Both knees", hi: "दोनों घुटने" } },
      { id: "fingers_wrists", label: { en: "Small finger & wrist joints", hi: "उंगलियों व कलाई के जोड़" } },
      { id: "multiple_joints", label: { en: "All over body joints", hi: "शरीर के सभी जोड़" } },
    ],
  },
  {
    id: "other_location",
    label: { en: "Other Part", hi: "अन्य भाग" },
  },
];

export const DURATION_OPTIONS = [
  { id: "today", value: "today", label: { en: "Today (Less than 24 hours)", hi: "आज (24 घंटे से कम)" } },
  { id: "1_3_days", value: "1–3 days", label: { en: "1–3 days ago", hi: "1–3 दिन पहले" } },
  { id: "4_7_days", value: "4–7 days", label: { en: "4–7 days ago", hi: "4–7 दिन पहले" } },
  { id: "more_than_week", value: "More than a week", label: { en: "More than a week", hi: "एक सप्ताह से अधिक" } },
  { id: "chronic_month", value: "More than a month", label: { en: "More than a month (chronic)", hi: "एक महीने से अधिक (पुराना)" } },
];
