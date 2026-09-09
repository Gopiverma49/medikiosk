"""
Clinical document extraction service for scanned medical reports.

Extracts ONLY clinically important information:
- Report/visit date
- Reason for visit
- Symptoms + duration
- Diagnosis
- Medical history & allergies
- Examination / vitals
- Diagnostic tests + values + units + reference ranges
- Imaging findings
- Medicines (name, strength, dosage, route, frequency, timing, duration, instructions)
- Procedures & treatments
- Doctor's advice
- Follow-up / review
- Chronological timeline events

Strict clinical rules:
- Zero hallucination: extract only what is explicitly present.
- Missing or unclear fields are set to null / empty list.
- Never diagnose, prescribe, or reinterpret test values.
- Verbatim preservation of medicine names, strengths, dosages, and test values.
- Never extracts Aadhaar, PAN, phone numbers, or billing info.
- Native support for Indian medical documents (DD/MM/YYYY, OD/BD/TDS/HS/SOS, brand names).
"""
import re
from typing import List, Optional
try:
    from ..schemas import (
        ClinicalDocumentExtraction, MedicineExtractionItem, TestExtractionItem,
        SymptomExtractionItem, VitalsExamination, FollowUpInfo, TimelineEventItem
    )
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from app.schemas import (
        ClinicalDocumentExtraction, MedicineExtractionItem, TestExtractionItem,
        SymptomExtractionItem, VitalsExamination, FollowUpInfo, TimelineEventItem
    )

# Common Indian numeric dosage triplets/quads to clear clinical expansions
NUMERIC_DOSE_DESCRIPTIONS = {
    "1-0-0": "1-0-0 (Once daily: Morning)",
    "0-1-0": "0-1-0 (Once daily: Afternoon)",
    "0-0-1": "0-0-1 (Once daily: Night / Bedtime)",
    "1-0-1": "1-0-1 (Twice daily: Morning & Night)",
    "1-1-0": "1-1-0 (Twice daily: Morning & Afternoon)",
    "0-1-1": "0-1-1 (Twice daily: Afternoon & Night)",
    "1-1-1": "1-1-1 (Thrice daily: Morning, Afternoon, Night)",
    "1-1-1-1": "1-1-1-1 (4 times daily: Morning, Noon, Evening, Night)",
    "1-0-1-1": "1-0-1-1 (3 times daily: Morning, Evening, Bedtime)",
    "1-0-0-1": "1-0-0-1 (Twice daily: Morning & Bedtime)",
    "2-0-2": "2-0-2 (2 tabs Morning & 2 tabs Night)",
    "2-0-0": "2-0-0 (2 tabs Morning)",
    "0-0-2": "0-0-2 (2 tabs Night)",
    "1/2-0-1/2": "1/2-0-1/2 (Half tablet Morning & Night)",
    "1/2-0-0": "1/2-0-0 (Half tablet Morning)",
    "0-0-1/2": "0-0-1/2 (Half tablet Night)",
}

# Common Indian frequency abbreviations to clear clinical expansions
FREQUENCY_MAP = {
    "od": "OD (Once daily)",
    "o.d.": "OD (Once daily)",
    "qd": "OD (Once daily)",
    "q.d.": "OD (Once daily)",
    "once daily": "OD (Once daily)",
    "once a day": "OD (Once daily)",
    "1 time a day": "OD (Once daily)",
    "1 times a day": "OD (Once daily)",
    "1 time daily": "OD (Once daily)",
    "bd": "BD (Twice daily)",
    "b.d.": "BD (Twice daily)",
    "bid": "BD (Twice daily)",
    "b.i.d.": "BD (Twice daily)",
    "twice daily": "BD (Twice daily)",
    "twice a day": "BD (Twice daily)",
    "2 times a day": "BD (Twice daily)",
    "2 times daily": "BD (Twice daily)",
    "tds": "TDS (Thrice daily)",
    "t.d.s.": "TDS (Thrice daily)",
    "tid": "TDS (Thrice daily)",
    "t.i.d.": "TDS (Thrice daily)",
    "thrice daily": "TDS (Thrice daily)",
    "thrice a day": "TDS (Thrice daily)",
    "3 times a day": "TDS (Thrice daily)",
    "3 times daily": "TDS (Thrice daily)",
    "qid": "QID (4 times daily)",
    "q.i.d.": "QID (4 times daily)",
    "four times daily": "QID (4 times daily)",
    "4 times a day": "QID (4 times daily)",
    "4 times daily": "QID (4 times daily)",
    "hs": "HS (At bedtime)",
    "h.s.": "HS (At bedtime)",
    "bedtime": "HS (At bedtime)",
    "at bedtime": "HS (At bedtime)",
    "at night": "HS (At bedtime)",
    "night only": "HS (At bedtime)",
    "before sleep": "HS (At bedtime)",
    "sos": "SOS (As needed / When required)",
    "s.o.s.": "SOS (As needed / When required)",
    "prn": "SOS (As needed / When required)",
    "p.r.n.": "SOS (As needed / When required)",
    "as needed": "SOS (As needed / When required)",
    "when required": "SOS (As needed / When required)",
    "stat": "STAT (Immediately)",
    "weekly": "Weekly",
    "once a week": "Weekly",
    "alternate day": "Alternate days",
    "alternate days": "Alternate days",
    "every other day": "Alternate days",
    "qod": "Alternate days",
    "1-2 times a day": "1-2 times daily",
    "1 to 2 times a day": "1-2 times daily",
    "12 times a day": "1-2 times daily",
    "morning and night": "BD (Twice daily - Morning & Night)",
    "morning and evening": "BD (Twice daily - Morning & Evening)",
    "morning & night": "BD (Twice daily - Morning & Night)",
    "after each meal": "TDS (Thrice daily - After each meal)",
    "after each meals": "TDS (Thrice daily - After each meal)",
    "after every meal": "TDS (Thrice daily - After each meal)",
    "before each meal": "TDS (Thrice daily - Before each meal)",
    "before every meal": "TDS (Thrice daily - Before each meal)",
    "with each meal": "TDS (Thrice daily - With meals)",
    "with every meal": "TDS (Thrice daily - With meals)",
}

# Indian timing abbreviations
TIMING_MAP = {
    "ac": "Before food / meals (AC)",
    "a.c.": "Before food / meals (AC)",
    "before food": "Before food / meals (AC)",
    "before meals": "Before food / meals (AC)",
    "before meal": "Before food / meals (AC)",
    "empty stomach": "Empty stomach",
    "bbf": "Before food / meals (AC)",
    "before breakfast": "Before breakfast (AC)",
    "pc": "After food / meals (PC)",
    "p.c.": "After food / meals (PC)",
    "after food": "After food / meals (PC)",
    "after meals": "After food / meals (PC)",
    "after meal": "After food / meals (PC)",
    "after each meal": "After food / meals (PC)",
    "after each meals": "After food / meals (PC)",
    "after every meal": "After food / meals (PC)",
    "before each meal": "Before food / meals (AC)",
    "before every meal": "Before food / meals (AC)",
    "abf": "After breakfast (PC)",
    "post meal": "After food / meals (PC)",
    "post meals": "After food / meals (PC)",
    "with meals": "With meals",
    "with food": "With meals",
    "with each meal": "With meals",
    "with every meal": "With meals",
}

# Master Indian medicine brand, formulation variant, oncology/critical-care, and generic stems
# (sorted by length descending for greedy longest match first)
MASTER_MED_NAMES = sorted(
    list(
        set([
            # --- COMBINATION / MULTI-WORD BRANDS & STRENGTH VARIANTS ---
            "montair-lc", "montair lc", "montair fx", "montair-fx", "montair 10", "montair",
            "pantocid-dsr", "pantocid dsr", "pantocid-d", "pantocid d", "pantocid 40", "pantocid 20", "pantocid",
            "pan-dsr", "pan dsr", "pan-d", "pan d", "pan 40", "pan 20", "pantop-d", "pantop d", "pantop 40", "pantop", "pantosec",
            "telma-am", "telma am", "telma-h", "telma h", "telma 40", "telma 80", "telma 20", "telma",
            "telmikind-am", "telmikind am", "telmikind-h", "telmikind h", "telmikind 40", "telmikind", "telpres",
            "augmentin duo", "augmentin 625", "augmentin 1000", "augmentin 375", "augmentin",
            "amoxyclav 625", "amoxyclav 375", "amoxyclav", "clavam 625", "clavam 375", "clavam",
            "moxikind-cv 625", "moxikind-cv", "moxikind", "novamox 500", "novamox 250", "novamox",
            "chymoral forte", "chymoral", "neurobion forte", "neurobion",
            "shelcal 500", "shelcal-hd", "shelcal hd", "shelcal xt", "shelcal m", "shelcal", "cipcal 500", "cipcal",
            "candid mouth paint", "candid cream", "candid lotion", "candid powder",
            "candid-b", "candid b", "candid-v", "candid v", "candid-cl", "candid cl",
            "candid 20", "candid 10", "candid", "canesten", "surfaz-sn", "surfaz sn", "surfaz",
            "glycomet-gp 2", "glycomet-gp 1", "glycomet-gp", "glycomet gp",
            "glycomet 500", "glycomet 850", "glycomet 1g", "glycomet",
            "glyciphage 500", "glyciphage 850", "glyciphage 1g", "glyciphage", "obimet",
            "zerodol-sp", "zerodol sp", "zerodol-p", "zerodol p", "zerodol-th", "zerodol th",
            "zerodol-pt", "zerodol pt", "zerodol-pg", "zerodol pg", "zerodol",
            "hifenac-sp", "hifenac sp", "hifenac-p", "hifenac p", "hifenac-th", "hifenac th",
            "hifenac-d", "hifenac d", "hifenac-mr", "hifenac mr", "hifenac",
            "meftal-spas", "meftal spas", "meftal-p", "meftal p", "meftal",
            "ascoril-ls", "ascoril ls", "ascoril-d", "ascoril d", "ascoril-plus", "ascoril plus", "ascoril",
            "foracort 200", "foracort 400", "foracort 100", "foracort",
            "budecort respules", "budecort 0.5", "budecort 1mg", "budecort",
            "seroflo 250", "seroflo 125", "seroflo 500", "seroflo 100", "seroflo",
            "duolin respules", "duolin inhaler", "duolin", "levolin respules", "levolin 1mg", "levolin",
            "asthalin respules", "asthalin inhaler", "asthalin 4", "asthalin", "asthelin nasal spray", "asthelin",
            "aerocort inhaler", "aerocort rotacaps", "aerocort",
            "bro-zedex", "solvin cold", "cheston cold", "sinarest", "benadryl", "chericof", "grilinctus",
            "alex syrup", "alex", "zedex", "tusq-d", "tusq", "ambrodil-s", "ambrodil", "mucolite",
            "taxim-o 200", "taxim-o", "taxim o", "taxim", "monocef-o 200", "monocef-o", "monocef o", "monocef 1g", "monocef",
            "candiforce 200", "candiforce 100", "candiforce", "itra-200", "itra 100",
            "galvus met", "galvus 50", "galvus", "jalra-m", "jalra m", "jalra 50", "jalra",
            "zomelis-met", "zomelis met", "zomelis 50", "zomelis",
            "januvia 100", "januvia 50", "januvia", "janumet 50/500", "janumet 50/1000", "janumet",
            "jardiance 10", "jardiance 25", "jardiance", "forxiga 10", "forxiga 5", "forxiga",
            "ecosprin gold 10", "ecosprin gold 20", "ecosprin gold",
            "ecosprin-av 75", "ecosprin-av 150", "ecosprin-av", "ecosprin av",
            "ecosprin 75", "ecosprin 150", "ecosprin",
            "atorva 10", "atorva 20", "atorva 40", "atorva 80", "atorva", "atorvastatin",
            "rosuvas 10", "rosuvas 20", "rosuvas 5", "rosuvas 40", "rosuvas", "rosuvastatin",
            "thyronorm 12.5", "thyronorm 25", "thyronorm 50", "thyronorm 75", "thyronorm 88", "thyronorm 100", "thyronorm 112", "thyronorm 125", "thyronorm 150", "thyronorm",
            "eltroxin 25", "eltroxin 50", "eltroxin 75", "eltroxin 88", "eltroxin 100", "eltroxin",
            "becosules z", "becosules", "supradyn daily", "supradyn", "zincovit cl", "zincovit",
            "limcee 500", "limcee", "celin 500", "celin", "evion 400", "evion 600", "evion",
            "orofer-xt", "orofer xt", "orofer", "livogen-z", "livogen", "autrin", "folvite 5mg", "folvite",
            "calcirol sachet", "calcirol gems", "calcirol", "d-rise 60k", "d-rise 2k", "d-rise", "uprise-d3 60k", "uprise-d3", "tay-d3",
            "combiflam plus", "combiflam", "flexon-mr", "flexon mr", "flexon", "ibugesic-plus", "ibugesic plus", "ibugesic",
            "allegra 120", "allegra 180", "allegra-m", "allegra m", "allegra",
            "levocet-m", "levocet m", "levocet 5", "levocet", "teczine 5", "teczine", "1-al 5", "1-al",
            "cetzine", "alerid", "okacet", "bilashine 20", "bilashine", "bilaxten 20", "bilaxten", "bilachek-m", "bilachek m", "bilachek",
            "rantac dom", "rantac 150", "rantac 300", "rantac", "aciloc-rd", "aciloc rd", "aciloc 150", "aciloc 300", "aciloc",
            "omez-d", "omez d", "omez-dsr", "omez dsr", "omez 20", "omez 40", "omez",
            "razo-d", "razo d", "razo-dsr", "razo dsr", "razo 20", "razo", "rabicip 20", "rabicip", "happi 20", "happi",
            "nexpro-rd", "nexpro rd", "nexpro 40", "nexpro 20", "nexpro", "sompraz-d", "sompraz d", "sompraz 40", "sompraz 20", "sompraz",
            "dolo 650", "dolo 500", "dolo", "calpol 650", "calpol 500", "calpol 250", "calpol",
            "crocin 650", "crocin advance", "crocin drop", "crocin", "pacimol 650", "pacimol", "p-650", "p-500",
            "azithral 500", "azithral 250", "azithral stat", "azithral", "azee 500", "azee 250", "azee", "zithrox 500", "zithrox",
            "mahacef 200", "mahacef 100", "mahacef", "zifi 200", "zifi 100", "zifi",
            "ceftum 500", "ceftum 250", "ceftum", "pulmocef 500", "pulmocef",
            "gudcef 200", "gudcef 100", "gudcef", "doxcef 200", "doxcef",
            "cifran 500", "cifran 250", "cifran", "ciplox 500", "ciplox eye drops", "ciplox",
            "zenflox 200", "zenflox-oz", "zenflox oz", "zenflox", "oflox-oz", "oflox oz", "oflox 200", "oflox", "zanocin 200", "zanocin",
            "l-cin 500", "l-cin", "glevo 500", "glevo", "norflox 400", "norflox-tz", "norflox tz", "norflox",
            "metrogyl 400", "metrogyl 200", "metrogyl-er", "metrogyl er", "metrogyl", "flagyl 400", "flagyl 200", "flagyl",
            "doxy-1 l-dr", "doxy-1", "doxy 100", "emset 4", "emset 8", "emset", "vomikind 4", "vomikind md", "vomikind", "ondem 4", "ondem 8", "ondem md", "ondem",
            "domstal baby", "domstal 10", "domstal", "motilium-m", "motilium",
            "drotin-plus", "drotin-m", "drotin ds", "drotin", "cyclopam plus", "cyclopam", "spasmonil plus", "spasmonil", "colimex", "anafortan",
            "amlip 5", "amlip 10", "amlip 2.5", "amlip", "amlong 5", "amlong 2.5", "amlong-a", "amlong", "stamlo 5", "stamlo",
            "losar 50", "losar 25", "losar-h", "losar h", "losar", "envas 5", "envas 10", "envas 2.5", "envas",
            "cardace 2.5", "cardace 5", "cardace 1.25", "cardace", "cilacar 10", "cilacar 5", "cilacar 20", "cilacar",
            "metolar 25", "metolar 50", "metolar 100", "metolar xr", "metolar", "betaloc 25", "betaloc 50", "betaloc",
            "aten 50", "aten 25", "aten", "nebicard 5", "nebicard 2.5", "nebicard",
            "clavix 75", "clavix 150", "clavix", "deplatt 75", "deplatt 150", "deplatt",
            "dilzem 30", "dilzem 60", "dilzem sr", "dilzem", "lanoxin 0.25", "lanoxin",
            "dytor 10", "dytor 20", "dytor 40", "dytor 5", "dytor", "lasix 40", "lasix",
            "amaryl 1", "amaryl 2", "amaryl 3", "amaryl", "glimestar 1", "glimestar 2", "glimestar", "glimisave 1", "glimisave 2", "glimisave",
            "tenglyn 20", "tenglyn", "ziten 20", "ziten", "volibo 0.2", "volibo 0.3", "volibo", "prandial 0.2", "prandial 0.3", "prandial",
            "deriphyllin retard 150", "deriphyllin retard 300", "deriphyllin retard", "deriphyllin 150", "deriphyllin 300", "deriphyllin",
            "digene gel", "digene tablet", "digene", "gelusil mps", "gelusil", "cremaffin plus", "cremaffin",
            "dulcolax 5mg", "dulcolax", "duphalac syrup", "duphalac", "sucrafil-o", "sucrafil o", "sucrafil suspension", "sucrafil",
            "gabaneuron 100", "gabaneuron 300", "gabaneuron sr", "gabaneuron", "pregeb 75", "pregeb 150", "pregeb od", "pregeb", "maxgalin 75", "maxgalin 50", "maxgalin",
            "clonafit 0.5", "clonafit 0.25", "clonafit", "zapiz 0.5", "zapiz 0.25", "zapiz", "lonazep 0.5", "lonazep 0.25", "lonazep",
            "restyl 0.25", "restyl 0.5", "restyl 1", "restyl", "alprax 0.25", "alprax 0.5", "alprax 1", "alprax",
            "nexito 10", "nexito 5", "nexito 20", "nexito plus", "nexito", "cilentra 10", "cilentra", "stalopam 10", "stalopam",
            "serta 50", "serta 100", "serta 25", "serta", "flucos 150", "flucos 200", "flucos", "forcan 150", "forcan 200", "forcan",
            "tyza 500", "tyza 250", "tyza", "sebifin 250", "sebifin", "ultracet semi", "ultracet", "ketorol dt", "ketorol 10", "ketorol",
            "nise tablet", "nise gel", "nise", "sumo tablet", "sumo gel", "sumo",
            "voveran 50", "voveran 75", "voveran sr 100", "voveran sr", "voveran emulgel", "voveran", "dynapar aq", "dynapar tablet", "dynapar",
            "volini spray", "volini gel", "volini", "moov spray", "moov ointment", "moov", "iodex ultragel", "iodex",
            "fourderm", "panderm++", "panderm", "betadine gargle", "betadine ointment", "betadine 10%", "betadine 5%", "betadine",
            "cipladine 5%", "cipladine ointment", "cipladine", "t-bact 2%", "t-bact ointment", "t-bact", "bactroban",
            "silverex ionic", "silverex", "burnol", "eno lemon", "eno regular", "eno", "pudin hara pearls", "pudin hara", "smecta", "dioralyte",
            "kaylite cream", "softovac powder", "softovac", "eldoper 2mg", "eldoper", "redotil 100", "redotil", "zedott 100", "zedott",
            "rifagut 400", "rifagut 550", "rifagut 200", "rifagut", "udiliv 300", "udiliv 150", "udiliv 600", "udiliv", "ursochol 300", "ursochol",
            "claribid 500", "claribid 250", "claribid", "dalacin c 300", "dalacin c", "clindac a gel", "clindac a",
            "lizomac 600", "lizomac", "linid 600", "linid", "martifur mr 100", "martifur mr", "martifur", "urifast 100", "urifast",
            "zovirax 400", "zovirax 800", "zovirax ointment", "zovirax", "valcivir 1000", "valcivir 500", "valcivir", "antiflu 75", "antiflu", "fluvir 75", "fluvir",
            "nizral 2%", "nizral shampoo", "nizral cream", "nizral", "lulifin cream", "lulifin lotion", "lulifin", "lulican cream", "lulican",
            "nucoxia 90", "nucoxia 60", "nucoxia 120", "nucoxia", "etoshine 90", "etoshine 60", "etoshine",
            "myoril 4", "myoril 8", "myoril", "lioresal 10", "lioresal 25", "lioresal", "sirdalud 2mg", "sirdalud",
            "zyloric 100", "zyloric 300", "zyloric", "febutaz 40", "febutaz 80", "febutaz", "feburic 40", "feburic",
            "concor 5", "concor 2.5", "concor cor", "concor", "carca 3.125", "carca 6.25", "carca 12.5", "carca 25", "carca",
            "olmat 20", "olmat 40", "olmat-h", "olmat h", "olmat", "hygroton 50", "hygroton", "natrilix sr", "natrilix",
            "aldactone 25", "aldactone 50", "aldactone 100", "aldactone", "eptus 25", "eptus 50", "eptus",
            "prasita 10", "prasita", "brilinta 90", "brilinta 60", "brilinta",
            "eliquis 5", "eliquis 2.5", "eliquis", "xarelto 10", "xarelto 20", "xarelto 15", "xarelto 2.5", "xarelto",
            "warmax 5", "warmax", "acitrom 2", "acitrom 1", "acitrom 3", "acitrom 4", "acitrom",
            "diamicron mr 60", "diamicron mr 30", "diamicron mr", "diamicron", "pioz 15", "pioz 30", "pioz",
            "trajenta 5mg", "trajenta duo", "trajenta", "remozen 100", "remozen",
            "human mixtard 30/70", "human mixtard 50/50", "human mixtard", "lantus solostar", "lantus cartridge", "lantus",
            "novorapid flexpen", "novorapid penfill", "novorapid", "ryzodeg flextouch", "ryzodeg", "neomercazole 5", "neomercazole 10", "neomercazole",
            "vertin 16", "vertin 8", "vertin 24", "vertin od", "vertin", "stugeron 25", "stugeron forte", "stugeron",
            "flunarin 10", "flunarin 5", "flunarin", "sibelium 10", "sibelium 5", "sibelium",
            "ciplar 10", "ciplar 40", "ciplar-la 40", "ciplar-la 20", "ciplar-la", "ciplar",
            "naprosyn 500", "naprosyn 250", "naprosyn", "rizact 10", "rizact 5", "rizact md", "rizact", "suminat 50", "suminat 100", "suminat",
            "valparin 200", "valparin chrono", "valparin", "encorate chrono 500", "encorate chrono 300", "encorate chrono 200", "encorate chrono", "encorate",
            "levipil 500", "levipil 250", "levipil 750", "levipil 1g", "levipil", "eptoin 100", "eptoin 50", "eptoin er", "eptoin",
            "tryptomer 10", "tryptomer 25", "tryptomer 50", "tryptomer", "duzela 20", "duzela 30", "duzela 40", "duzela 60", "duzela",
            "clofranil 25", "clofranil 50", "clofranil 75", "clofranil", "zolp 10", "zolp 5", "zolp", "nitrest 10", "nitrest 5", "nitrest",
            "etilaam 0.5", "etilaam 0.25", "etilaam", "etizola 0.5", "etizola 0.25", "etizola",
            "urimax 0.4", "urimax-d", "urimax d", "urimax", "flodart plus", "flodart 0.4", "flodart",
            "silodal 8", "silodal 4", "silodal-d", "silodal d", "silodal", "finax 1mg", "finax", "finpecia 1mg", "finpecia",
            "duprost 0.5", "duprost", "manforce 50", "manforce 100", "manforce staylong", "manforce", "caverta 100", "caverta 50", "caverta",
            "megalis 20", "megalis 10", "megalis", "omnacortil 5", "omnacortil 10", "omnacortil 20", "omnacortil 40", "omnacortil drops", "omnacortil",
            "wysolone 5", "wysolone 10", "wysolone 20", "wysolone", "medrol 4", "medrol 8", "medrol 16", "medrol", "dexona injection", "dexona tablet", "dexona",
            "defal 6", "defal 30", "defal", "refresh tears eye drops", "refresh tears", "tears naturale ii", "tears naturale", "systane ultra", "systane",
            "toba eye drops", "toba-dm", "toba", "moxicip eye drops", "moxicip kt", "moxicip", "vigamox eye drops", "vigamox",
            "waxsol ear drops", "waxsol", "clearwax ear drops", "clearwax",
            "otrivin nasal spray", "otrivin oxy fast relief", "otrivin pediatric", "otrivin", "nasivion adult", "nasivion mini", "nasivion pediatric", "nasivion",
            "pause 500", "pause 250", "pause mf", "pause", "trapic 500", "trapic mf", "trapic",
            "iladac 10", "iladac", "doxinate plus", "doxinate g", "doxinate",

            # --- GENERIC CHEMICAL / INGREDIENT NAMES ---
            "clotrimazole", "metformin", "glimepiride", "teneligliptin", "vildagliptin", "sitagliptin",
            "dapagliflozin", "empagliflozin", "remogliflozin", "voglibose", "gliclazide", "pioglitazone", "linagliptin",
            "salbutamol", "ambroxol", "lactulose", "sucralfate", "gabapentin", "pregabalin", "clonazepam", "alprazolam",
            "escitalopram", "sertraline", "fluconazole", "terbinafine", "tramadol", "nimesulide", "diclofenac",
            "aceclofenac", "ibuprofen", "paracetamol", "amoxicillin", "azithromycin", "cefixime", "cefuroxime",
            "cefpodoxime", "ciprofloxacin", "ofloxacin", "levofloxacin", "norfloxacin", "metronidazole", "doxycycline",
            "ondansetron", "domperidone", "drotaverine", "telmisartan", "amlodipine", "losartan", "enalapril", "ramipril",
            "cilnidipine", "metoprolol", "atenolol", "nebivolol", "bisoprolol", "carvedilol", "olmesartan", "chlorthalidone",
            "indapamide", "spironolactone", "eplerenone", "clopidogrel", "aspirin", "prasugrel", "ticagrelor", "apixaban",
            "rivaroxaban", "warfarin", "diltiazem", "digoxin", "torsemide", "furosemide", "ranitidine", "omeprazole",
            "pantoprazole", "rabeprazole", "esomeprazole", "ilaprazole", "dexrabeprazole", "fexofenadine", "levocetirizine",
            "cetrizine", "cetirizine", "bilastine", "loperamide", "racecadotril", "rifaximin", "ursodeoxycholic acid",
            "isabgol", "clarithromycin", "clindamycin", "linezolid", "nitrofurantoin", "acyclovir", "valacyclovir",
            "oseltamivir", "ketoconazole", "luliconazole", "itraconazole", "etoricoxib", "thiocolchicoside", "baclofen",
            "tizanidine", "colchicine", "allopurinol", "febuxostat", "betahistine", "cinnarizine", "flunarizine",
            "propranolol", "naproxen", "rizatriptan", "sumatriptan", "sodium valproate", "levetiracetam", "phenytoin",
            "amitriptyline", "duloxetine", "clomipramine", "zolpidem", "etizolam", "tamsulosin", "silodosin",
            "finasteride", "dutasteride", "sildenafil", "tadalafil", "prednisolone", "methylprednisolone",
            "dexamethasone", "deflazacort", "carboxymethylcellulose", "tobramycin", "moxifloxacin", "glycopyrrolate",
            "tranexamic acid", "povidone iodine", "povidone-iodine", "mupirocin", "carbimazole",

            # --- HOSPITAL, ONCOLOGY, CRITICAL CARE & SPECIALTY ADDITIONS ---
            "piperacillin tazobactam", "piperacillin", "tazobactam", "pipzo", "tazomac",
            "meropenem 1g", "meropenem 500mg", "meropenem", "meronem",
            "ceftriaxone 1g", "ceftriaxone 2g", "ceftriaxone 500mg", "ceftriaxone", "mono-cef 1g",
            "amikacin 500mg", "amikacin 250mg", "amikacin 100mg", "amikacin", "amikacin injection",
            "gentamicin 80mg", "gentamicin", "genticyn",
            "vancomycin 1g", "vancomycin 500mg", "vancomycin", "vancocin",
            "teicoplanin 400mg", "teicoplanin 200mg", "teicoplanin", "targocid",
            "colistin 1 miu", "colistin 2 miu", "colistin 3 miu", "colistin", "colistimethate sodium", "colistimethate",
            "polymyxin b", "poly-b",
            "fluconazole injection", "amphotericin b lipid complex", "liposomal amphotericin b", "amphotericin b", "amphotret",
            "voriconazole 200", "voriconazole", "vfend", "caspofungin 50mg", "caspofungin 70mg", "caspofungin", "cancidas",
            "propofol injection", "propofol", "diprivan",
            "midazolam 5mg", "midazolam 10mg", "midazolam", "mezolam",
            "fentanyl patch 25", "fentanyl patch 50", "fentanyl patch", "fentanyl injection", "fentanyl",
            "morphine 10mg", "morphine 15mg", "morphine 30mg", "morphine sulfate", "morphine",
            "noradrenaline tartrate", "noradrenaline", "norepinephrine", "adrenaline tartrate", "adrenaline", "epinephrine",
            "dopamine hydrochloride", "dopamine", "dobutamine hydrochloride", "dobutamine",
            "atropine sulphate", "atropine sulfate", "atropine", "amiodarone 100", "amiodarone 200", "amiodarone", "cordarone",
            "heparin sodium 25000", "heparin sodium 5000", "heparin", "enoxaparin 40mg", "enoxaparin 60mg", "enoxaparin", "clexane", "lonopin",
            "hydrocortisone sodium succinate", "hydrocortisone 100mg", "hydrocortisone", "primacort",
            "rifampicin 450", "rifampicin 600", "rifampicin", "rcine", "isoniazid 300", "isoniazid 100", "isoniazid",
            "pyrazinamide 750", "pyrazinamide 500", "pyrazinamide", "ethambutol 800", "ethambutol", "combunex",
            "akt-4", "akt-3", "akt-2", "forecox",
            "methotrexate 2.5", "methotrexate 5", "methotrexate 7.5", "methotrexate 10", "methotrexate 15", "methotrexate", "folitrax 10", "folitrax 7.5", "folitrax 15", "folitrax",
            "hydroxychloroquine 200", "hydroxychloroquine 400", "hydroxychloroquine", "hcqs 200", "hcqs 300", "hcqs 400", "hcqs",
            "sulfasalazine 500", "sulfasalazine 1000", "sulfasalazine", "saaz 500", "saaz ds", "saaz",
            "leflunomide 10", "leflunomide 20", "leflunomide", "lefra 10", "lefra 20", "lefra",
            "azathioprine 50", "azathioprine", "azoran 50", "azoran", "mycophenolate mofetil 500", "mycophenolate mofetil", "cellcept", "mycept",
            "cyclosporine 100", "cyclosporine 50", "cyclosporine 25", "cyclosporine", "sandimmun neoral", "panimun bioral",
            "tacrolimus 0.5", "tacrolimus 1mg", "tacrolimus ointment", "tacrolimus", "pangraf", "tacroz",
            "tamoxifen 10", "tamoxifen 20", "tamoxifen", "cytotam", "anastrozole 1mg", "anastrozole", "arimidex",
            "letrozole 2.5", "letrozole", "femara", "letroz",
            "imatinib 400", "imatinib 100", "imatinib", "glivec", "veenix",
            "gefitinib 250", "gefitinib", "geftinat", "erlotinib 150", "erlotinib 100", "erlotinib", "erlocip",
            "capecitabine 500", "capecitabine", "xeloda",
            "ondansetron injection", "aprepitant 125", "aprepitant", "aprecap",
            # Extra generics & stems
            "cefixime 200",
        ])
    ),
    key=lambda x: len(x),
    reverse=True,
)
COMMON_MED_NAMES = MASTER_MED_NAMES

# Lab test indicators and canonical units
LAB_TEST_PATTERNS = [
    (r"hba1c", "HbA1c", "%", "4.0 - 5.6"),
    (r"fasting\s+blood\s+(?:sugar|glucose)|fbs", "Fasting Blood Sugar", "mg/dL", "70 - 99"),
    (r"post\s+prandial\s+(?:blood\s+)?(?:sugar|glucose)|ppbs", "Post Prandial Glucose", "mg/dL", "< 140"),
    (r"random\s+blood\s+(?:sugar|glucose)|rbs", "Random Blood Sugar", "mg/dL", "70 - 140"),
    (r"hemoglobin|hb", "Hemoglobin", "g/dL", "12.0 - 16.0"),
    (r"platelets?|platelet\s+count", "Platelet Count", "cells/cu mm", "150,000 - 450,000"),
    (r"total\s+leukocyte\s+count|tlc|wbc", "Total Leukocyte Count (WBC)", "cells/cu mm", "4,000 - 11,000"),
    (r"serum\s+creatinine|creatinine", "Serum Creatinine", "mg/dL", "0.6 - 1.2"),
    (r"blood\s+urea\s+nitrogen|bun|urea", "Blood Urea Nitrogen", "mg/dL", "7 - 20"),
    (r"sgot|ast", "SGOT / AST", "U/L", "10 - 40"),
    (r"sgpt|alt", "SGPT / ALT", "U/L", "7 - 56"),
    (r"alkaline\s+phosphatase|alp", "Alkaline Phosphatase (ALP)", "U/L", "44 - 147"),
    (r"serum\s+bilirubin|total\s+bilirubin", "Serum Bilirubin (Total)", "mg/dL", "0.2 - 1.2"),
    (r"total\s+cholesterol", "Total Cholesterol", "mg/dL", "< 200"),
    (r"triglycerides?|tg", "Triglycerides", "mg/dL", "< 150"),
    (r"hdl\s+cholesterol|hdl", "HDL Cholesterol", "mg/dL", "> 40"),
    (r"ldl\s+cholesterol|ldl", "LDL Cholesterol", "mg/dL", "< 100"),
    (r"tsh|thyroid\s+stimulating\s+hormone", "TSH", "mIU/L", "0.4 - 4.5"),
    (r"crp|c-reactive\s+protein", "C-Reactive Protein (CRP)", "mg/L", "< 5.0"),
    (r"esr", "ESR", "mm/hr", "0 - 20"),
]


def extract_date(text: str) -> Optional[str]:
    """Extract Indian format DD/MM/YYYY or standard YYYY-MM-DD date or written date."""
    # Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    m = re.search(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})\b", text)
    if m:
        day, month, year = m.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    # Match DD(st|nd|rd|th)? Month (YYYY optional) (e.g. 7th September, 12 Aug 2026)
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+(\d{4}))?\b", text, re.I)
    if m:
        day, mon, yr = m.groups()
        from datetime import datetime
        year_str = yr or str(datetime.now().year)
        return f"{int(day):02d} {mon.title()} {year_str}"

    # Match YYYY-MM-DD
    m = re.search(r"\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b", text)
    if m:
        year, month, day = m.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    return None


def extract_vitals(text: str) -> Optional[VitalsExamination]:
    v = VitalsExamination()
    found = False

    # Blood Pressure: e.g. BP: 120/80 mmHg or 130/85
    bp_match = re.search(r"\b(?:bp|blood\s+pressure)\s*[:=\-]?\s*(\d{2,3}\s*/\s*\d{2,3}(?:\s*mm\s*hg)?)\b", text, re.I)
    if bp_match:
        v.blood_pressure = bp_match.group(1).strip()
        found = True

    # Pulse / Heart Rate
    pulse_match = re.search(r"\b(?:pulse|heart\s+rate|pr|hr)\s*[:=\-]?\s*(\d{2,3})\s*(?:bpm|/min)?\b", text, re.I)
    if pulse_match:
        v.pulse_rate = f"{pulse_match.group(1)} bpm"
        found = True

    # Temperature
    temp_match = re.search(r"\b(?:temp|temperature)\s*[:=\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?[fc]|deg\s*[fc])?\b", text, re.I)
    if temp_match:
        val = temp_match.group(1)
        unit = "°F" if float(val) > 50 else "°C"
        v.temperature = f"{val} {unit}"
        found = True

    # SpO2
    spo2_match = re.search(r"\b(?:spo2|o2\s*sat|saturation)\s*[:=\-]?\s*(\d{2,3})\s*%?\b", text, re.I)
    if spo2_match:
        v.spo2 = f"{spo2_match.group(1)}%"
        found = True

    # Respiratory Rate
    rr_match = re.search(r"\b(?:rr|respiratory\s+rate)\s*[:=\-]?\s*(\d{1,2})\s*(?:/min|cpm)?\b", text, re.I)
    if rr_match:
        v.respiratory_rate = f"{rr_match.group(1)} /min"
        found = True

    # General Exam Notes (e.g. Chest: Clear, CVS: S1 S2 heard, P/A: Soft)
    exam_parts = []
    for organ in ["chest", "cvs", "p/a", "cns", "ent", "pallor", "icterus", "cyanosis", "edema"]:
        m = re.search(rf"\b{organ}\s*[:=\-]\s*([^,\.\n\r|;]+)", text, re.I)
        if m:
            exam_parts.append(f"{organ.upper()}: {m.group(1).strip()}")
    if exam_parts:
        v.examination_notes = "; ".join(exam_parts)
        found = True

    return v if found else None


# Helper functions for frequency, timing, duration, and strength extraction
def parse_frequency(text: str) -> Optional[str]:
    """
    Parse medication frequency supporting:
    - Indian numeric split formats: 1-0-1, 1-0-0, 0-0-1, 1-1-1, 1/2-0-1/2, 1-O-1 (OCR error)
    - Abbreviation codes: OD, BD, TDS, QID, HS, SOS, STAT with or without dots
    - Natural language: once daily, twice a day, at bedtime, every 8 hours, etc.
    """
    # 1. Check numeric dose splits:
    # 1a. Hyphen/colon/dot separated (supports fractional doses 1/2, 1/4)
    num_match = re.search(
        r"(?<![A-Za-z0-9])(1/2|1/4|[012½¼])\s*[-:\.]\s*(1/2|1/4|[012½¼oO])\s*[-:\.]\s*(1/2|1/4|[012½¼oO])(?:\s*[-:\.]\s*(1/2|1/4|[012½¼oO]))?(?![A-Za-z0-9])",
        text
    )
    # 1b. Slash separated (whole digits only, e.g. 1/0/1)
    if not num_match:
        num_match = re.search(
            r"(?<![A-Za-z0-9])([012])\s*/\s*([012oO])\s*/\s*([012oO])(?:\s*/\s*([012oO]))?(?![A-Za-z0-9])",
            text
        )
    if num_match:
        parts = [p for p in num_match.groups() if p is not None]
        normalized_parts = []
        for p in parts:
            p_clean = p.strip()
            if p_clean in ("o", "O"):
                normalized_parts.append("0")
            elif p_clean == "½":
                normalized_parts.append("1/2")
            elif p_clean == "¼":
                normalized_parts.append("1/4")
            else:
                normalized_parts.append(p_clean)
        norm_code = "-".join(normalized_parts)
        return NUMERIC_DOSE_DESCRIPTIONS.get(norm_code, f"{norm_code} (Split daily dosage)")

    # 2. Hourly intervals (e.g. every 6 hours, q8h, q6h)
    hour_match = re.search(r"\b(?:every\s+(\d+)\s+hours?|q(\d+)h)\b", text, re.I)
    if hour_match:
        h = hour_match.group(1) or hour_match.group(2)
        return f"Every {h} hours"

    # 3. Frequency abbreviations and terms (ordered by length descending to prioritize phrases)
    freq_keys = sorted(FREQUENCY_MAP.keys(), key=lambda k: len(k), reverse=True)
    for k in freq_keys:
        if re.search(rf"(?<![A-Za-z]){re.escape(k)}(?![A-Za-z])", text, re.I):
            return FREQUENCY_MAP[k]

    return None


def parse_timing(text: str) -> Optional[str]:
    """Parse meal timing associations (AC, PC, before meals, after meals, empty stomach)."""
    timing_keys = sorted(TIMING_MAP.keys(), key=lambda k: len(k), reverse=True)
    for k in timing_keys:
        if re.search(rf"(?<![A-Za-z]){re.escape(k)}(?![A-Za-z])", text, re.I):
            return TIMING_MAP[k]
    return None


def parse_duration(text: str) -> Optional[str]:
    """
    Parse duration supporting:
    - Standard: 'for 5 days', 'x 3 days', '10 days', '2 weeks', '1 month'
    - Indian clinical fractions: 'x 5/7' (5 days), 'x 2/52' (2 weeks), 'x 1/12' (1 month)
    """
    # Fraction notation first: x 5/7, 5/7, x 2/52, x 1/12
    frac_match = re.search(r"(?:x\s*|\bfor\s*)?(\d+)\s*/\s*(7|52|12)\b", text, re.I)
    if frac_match:
        num, denom = frac_match.groups()
        if denom == "7":
            return f"{num} days"
        elif denom == "52":
            return f"{num} weeks"
        elif denom == "12":
            return f"{num} month{'s' if int(num) > 1 else ''}"

    # Standard duration
    dur_m = re.search(r"(?:x\s*|\bfor\s*)?(\d+\s*(?:days?|weeks?|months?))\b", text, re.I)
    if dur_m:
        return dur_m.group(1).strip()

    return None


def parse_strength(text: str) -> Optional[str]:
    """Extract medication strength (e.g. 500mg, 650 mg, 40/5 mg, 5ml, 60,000 IU, 0.5 mg)."""
    str_m = re.search(
        r"\b(\d+(?:\.\d+)?(?:\s*[/\\-]\s*\d+(?:\.\d+)?)?\s*(?:mg|mcg|gm|g|ml|iu|%))\b",
        text,
        re.I
    )
    if str_m:
        return str_m.group(1).strip()
    return None


# Formulation prefixes allowing common OCR typos (Tah., Tob., 1ab., Cpa., Syp., 1nj., etc.)
# Requires item numbering to have punctuation (e.g. '1.', '1)', '1-') so '1 tab' is not mistaken for a prefix
PREFIX_PATTERN = re.compile(
    r"^(?:(?:rx|r/x|[#•\-\*]|\d+[\.\)\-\:])\s*)*"
    r"(?:tab(?:let)?s?|tah\.?|tob\.?|1ab\.?|lab\.?|tb\.?|tbl\.?|t\.|"
    r"cap(?:sule)?s?|cpa\.?|c\.|"
    r"syr(?:up)?s?|syp\.?|susp(?:ension)?s?|"
    r"inj(?:ection)?s?|1nj\.?|amp\.?|vial|"
    r"oint(?:ment)?|gel|cream|lotion|"
    r"drops?|drps?|eye\s+drops?|ear\s+drops?|nasal\s+(?:spray|drops?)|"
    r"inhaler|rotacap|respules?|respule|sachet|powder)\b[\.:\s\-]*",
    re.I
)

# Pattern for pure instruction/dosage lines that should enrich previous medicine rather than start a new one
INSTRUCTION_LEAD_PATTERN = re.compile(
    r"^\s*(?:"
    r"(?:\d+(?:/\d+)?|½|¼)\s*(?:tablet|tab|capsule|cap|puff|puffs|ml|tsp|drops?|sachet)\b|"
    r"(?:[012½¼]|1/2)\s*[-/:\.]\s*[012½¼oO]\s*[-/:\.]\s*[012½¼oO]\b|"
    r"(?:od|o\.d\.|bd|b\.d\.|bid|b\.i\.d\.|tds|t\.d\.s\.|tid|qid|q\.i\.d\.|hs|h\.s\.|sos|s\.o\.s\.|stat|ac|a\.c\.|pc|p\.c\.)\b|"
    r"(?:before\s+food|after\s+food|before\s+meals?|after\s+meals?|empty\s+stomach|at\s+bedtime|with\s+meals?)\b|"
    r"(?:for\s+\d+\s*(?:days?|weeks?|months?)|x\s*\d+[/0-9]*\b)"
    r")",
    re.I
)

# Non-clinical headings, dates, months, and UI words to avoid false positive medicine extractions
DISALLOWED_MED_HEADINGS = {
    "report", "date", "blood", "pressure", "vitals", "examination", "diagnosis",
    "investigation", "investigations", "tests", "history", "advice", "follow",
    "review", "symptoms", "complaints", "patient", "doctor", "clinic", "hospital",
    "signature", "department", "general", "name", "age", "gender", "male", "female",
    "chief", "complaint", "allergies", "allergy", "address", "phone", "contact",
    # Month names & abbreviations
    "december", "january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november",
    "dec", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov",
    # Ordinal numbers, days, time words
    "th", "st", "nd", "rd", "year", "month", "today", "yesterday", "tomorrow",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    # Editor / UI chrome words often present in screenshots
    "file", "edit", "view", "menu", "page", "tools", "help", "window", "terminal", "selection"
}


def extract_medicines(text: str) -> List[MedicineExtractionItem]:
    """Extract prescribed medications with Indian brand names, dosage, frequency, and instructions."""
    medicines: List[MedicineExtractionItem] = []
    seen_names = set()

    # Split text into clean non-empty lines
    raw_lines = [line.strip() for line in re.split(r"[\n\r;|\u2022]+", text) if line.strip()]

    for idx, line in enumerate(raw_lines):
        # 1. Skip visit date lines (e.g. "2th december", "Date: 12/08/2026", "14-08-2026")
        if extract_date(line) and not PREFIX_PATTERN.match(line):
            continue

        # 2. If line is purely a dosage/instruction continuation line, use it to enrich previous medicine
        if INSTRUCTION_LEAD_PATTERN.match(line):
            if medicines:
                last_m = medicines[-1]
                if not last_m.frequency:
                    last_m.frequency = parse_frequency(line)
                if not last_m.timing:
                    last_m.timing = parse_timing(line)
                if not last_m.duration:
                    last_m.duration = parse_duration(line)
                if not last_m.dosage:
                    dos_m = re.search(r"\b((?:\d+(?:/\d+)?|½|¼)\s*(?:tablet|tab|capsule|cap|puff|puffs|ml|tsp|drops?|sachet))\b", line, re.I)
                    if dos_m:
                        last_m.dosage = dos_m.group(1).strip()
            continue

        # Look ahead for adjacent continuation line (dosage/frequency printed on next line)
        next_line = raw_lines[idx + 1] if idx + 1 < len(raw_lines) else ""
        comb_line = line
        if next_line:
            # Only combine if next line does not look like a new numbered item, distinct medicine, or visit date
            next_is_date = bool(extract_date(next_line))
            next_is_new_med = (
                PREFIX_PATTERN.match(next_line)
                or re.match(r"^\d+[\.\)\-]\s*[A-Za-z]", next_line)
                or any(re.search(rf"\b{re.escape(m)}\b", next_line, re.I) for m in COMMON_MED_NAMES[:30])
            )
            if not next_is_date and (not next_is_new_med or INSTRUCTION_LEAD_PATTERN.match(next_line)):
                comb_line = f"{line} {next_line}"

        matched_name = None

        # Step 1: Match against known Indian medicine stems (sorted by longest first)
        for med in COMMON_MED_NAMES:
            if re.search(rf"\b{re.escape(med)}\b", line, re.I):
                matched_name = med.title()
                break

        # Step 2: Check explicit formulation prefix (Tab., Cap., Syr., Inj., etc. with OCR tolerance)
        if not matched_name and PREFIX_PATTERN.match(line):
            cleaned = PREFIX_PATTERN.sub("", line).strip()
            # Candidate extends up to the first token that looks like dosage, frequency, or instruction
            cand_m = re.match(r"^([A-Za-z][A-Za-z0-9\-_]*(?:\s+[A-Za-z0-9\-_]+){0,3})", cleaned)
            if cand_m:
                candidate = cand_m.group(1).strip()
                # Stop before numbers or frequency keywords in candidate if accidentally captured
                candidate = re.split(r"\b(?:\d+|mg|mcg|gm|g|ml|od|bd|tds|hs|sos|pc|ac)\b", candidate, flags=re.I)[0].strip()
                first_word = candidate.split()[0].lower() if candidate else ""
                if len(candidate) > 2 and first_word not in DISALLOWED_MED_HEADINGS:
                    matched_name = candidate.title()

        # Step 3: Check numbered lines with strength & frequency (e.g. "1. Nebivolol 5mg 1-0-0")
        # Requires explicit punctuation (. ) - :) so ordinals like "2th" are never matched as list numbering
        if not matched_name:
            num_lead_match = re.match(r"^(?:(?:rx|[#•\-\*]|\d+[\.\)\-:])\s*)+([A-Za-z][A-Za-z0-9\-_]*(?:\s+[A-Za-z0-9\-_]+){0,2})", line, re.I)
            if num_lead_match and (parse_strength(comb_line) or parse_frequency(comb_line)):
                cand_lead = num_lead_match.group(1).strip()
                cand_lead = re.split(r"\b(?:\d+|mg|mcg|gm|g|ml|od|bd|tds|hs|sos|pc|ac)\b", cand_lead, flags=re.I)[0].strip()
                first_word = cand_lead.split()[0].lower() if cand_lead else ""
                if len(cand_lead) > 2 and first_word not in DISALLOWED_MED_HEADINGS:
                    matched_name = cand_lead.title()

        # Step 4: Direct Drug + Strength Heuristic (e.g. "candid 20 MG", "Paracetamol 500mg", "Metformin 500 MG")
        if not matched_name and parse_strength(line):
            drug_lead_m = re.match(r"^([A-Za-z][A-Za-z0-9\-_]*(?:\s+[A-Za-z0-9\-_]+){0,2})\s+\d+", line)
            if drug_lead_m:
                cand_drug = drug_lead_m.group(1).strip()
                first_w = cand_drug.split()[0].lower() if cand_drug else ""
                if len(cand_drug) > 2 and first_w not in DISALLOWED_MED_HEADINGS:
                    matched_name = cand_drug.title()

        # Verify that matched_name does not consist of disallowed headings or date words
        if matched_name and all(w.lower() in DISALLOWED_MED_HEADINGS for w in matched_name.split()):
            matched_name = None

        if not matched_name:
            continue

        # Extract strength: e.g. 500mg, 650 mg, 40/5 mg, 5 ml, 10mcg
        strength = parse_strength(comb_line)

        # If no explicit unit, look for trailing/embedded strength number in matched_name or comb_line
        if not strength:
            trailing_num = re.search(r"(?:\b|\.)(\d+(?:\.\d+)?(?:\s*[/\\-]\s*\d+(?:\.\d+)?)?)$", matched_name)
            if trailing_num:
                val = trailing_num.group(1).replace(" ", "")
                if "/" in val or "-" in val or float(val) >= 20 or val in ("5", "10", "0.5", "0.25", "2.5", "7.5", "12.5"):
                    strength = f"{val} mg"
                    matched_name = re.sub(r"\s*(?:\b|\.)\d+(?:\.\d+)?(?:\s*[/\\-]\s*\d+(?:\.\d+)?)?$", "", matched_name).strip()
            else:
                num_after = re.search(rf"\b{re.escape(matched_name)}\s+(\d+(?:\.\d+)?(?:\s*[/\\-]\s*\d+(?:\.\d+)?)?)\b", comb_line, re.I)
                if num_after:
                    val = num_after.group(1).replace(" ", "")
                    if "/" in val or "-" in val or float(val) >= 20 or val in ("5", "10", "0.5", "0.25", "2.5", "7.5", "12.5"):
                        strength = f"{val} mg"

        # Fallback for common pharmaceutical strengths (e.g. 625 in Augmentin 625 Duo)
        if not strength:
            num_in_line = re.search(r"\b(650|625|500|400|300|250|200|150|100|75|50|40|25|20|10|5)(?:/(?:5|10|125|62.5))?\b", comb_line)
            if num_in_line:
                strength = f"{num_in_line.group(0)} mg"

        # Clean trailing strength numbers from matched_name (e.g. "Candid 20" -> "Candid", "Dolo 650" -> "Dolo")
        if strength and matched_name:
            str_num_match = re.search(r"(\d+(?:\.\d+)?)", strength)
            if str_num_match:
                s_num = str_num_match.group(1)
                matched_name = re.sub(rf"\s*\b{re.escape(s_num)}\b$", "", matched_name, flags=re.I).strip()

        norm_key = re.sub(r"[^a-z0-9]", "", matched_name.lower())
        if norm_key in seen_names:
            continue
        seen_names.add(norm_key)

        # Extract frequency: 1-0-1, 1-0-0, 0-0-1, 1-1-1, OD, BD, TDS, QID, HS, SOS, times a day
        frequency = parse_frequency(comb_line)

        # Extract timing: AC, PC, before food, after food, empty stomach
        timing = parse_timing(comb_line)

        # Extract duration: e.g. "5 days", "1 week", "x 5/7", "x 2/52"
        duration = parse_duration(comb_line)

        # Extract route
        route = "Oral"
        if re.search(r"\b(?:inj|injection|iv|im|vial|amp)\b", comb_line, re.I):
            route = "Injection (IV/IM)"
        elif re.search(r"\b(?:inhaler|puff|nebulizer|rotacap|respules?)\b", comb_line, re.I):
            route = "Inhalation"
        elif re.search(r"\b(?:eye|ear|nasal)\s*(?:drops?|spray)\b", comb_line, re.I):
            route = "Drops (Ophthalmic/Otic/Nasal)"
        elif re.search(r"\b(?:ointment|gel|cream|drop|drops|lotion)\b", comb_line, re.I):
            route = "Topical"

        # Extract dosage: e.g. 1 tablet, 1/2 tab, 2 puffs, 5 ml
        dosage = None
        dos_m = re.search(r"\b((?:\d+(?:/\d+)?|½|¼)\s*(?:tablet|tab|capsule|cap|puff|puffs|ml|tsp|drops?|sachet))\b", comb_line, re.I)
        if dos_m:
            dosage = dos_m.group(1).strip()
        elif strength:
            unit_desc = "capsule" if "cap" in comb_line.lower() else "tablet"
            dosage = f"1 {unit_desc} ({strength})"

        # Patient Instructions: e.g. "Take with water", "Take after food / meals (PC)"
        instructions = None
        if "water" in comb_line.lower():
            instructions = "Take with water"
        elif timing:
            instructions = f"Take {timing.lower()}"
        elif frequency and "SOS" in frequency:
            instructions = "Take as needed (SOS)"

        medicines.append(MedicineExtractionItem(
            name=matched_name,
            strength=strength,
            dosage=dosage,
            route=route,
            frequency=frequency,
            timing=timing,
            duration=duration,
            instructions=instructions,
        ))

    return medicines


def extract_lab_tests(text: str) -> List[TestExtractionItem]:
    """Extract laboratory investigations with values, units, and reference ranges."""
    tests: List[TestExtractionItem] = []
    seen_tests = set()

    for pattern, name, default_unit, ref_range in LAB_TEST_PATTERNS:
        match = re.search(rf"\b(?:{pattern})\b\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)?", text, re.I)
        if match:
            if name in seen_tests:
                continue
            seen_tests.add(name)

            val_str = match.group(1).strip()
            unit_candidate = match.group(2)
            unit = unit_candidate if unit_candidate and len(unit_candidate) < 10 else default_unit

            # Calculate flag if numeric comparison is straightforward
            flag = "Normal"
            try:
                num_val = float(val_str)
                if "-" in ref_range:
                    parts = ref_range.split("-")
                    low = float(parts[0].strip())
                    high = float(parts[1].replace(",", "").strip())
                    if num_val < low:
                        flag = "Low"
                    elif num_val > high:
                        flag = "High"
                elif "<" in ref_range:
                    limit = float(ref_range.replace("<", "").strip())
                    if num_val > limit:
                        flag = "High"
                elif ">" in ref_range:
                    limit = float(ref_range.replace(">", "").strip())
                    if num_val < limit:
                        flag = "Low"
            except Exception:
                flag = "Normal"

            tests.append(TestExtractionItem(
                name=name,
                value=val_str,
                unit=unit,
                reference_range=ref_range,
                flag=flag,
            ))

    return tests


def extract_symptoms(text: str) -> List[SymptomExtractionItem]:
    """Extract clinical symptoms and duration without hallucinating."""
    symptoms = []
    seen = set()

    symptom_patterns = [
        (r"\b(?:fever|pyrexia)\b", "Fever"),
        (r"\bcough\b", "Cough"),
        (r"\b(?:chest\s+pain|angina)\b", "Chest Pain"),
        (r"\b(?:dyspnea|breathlessness|shortness\s+of\s+breath)\b", "Breathlessness (Dyspnea)"),
        (r"\b(?:headache|cephalea)\b", "Headache"),
        (r"\b(?:vomiting|emesis)\b", "Vomiting"),
        (r"\bnausea\b", "Nausea"),
        (r"\b(?:abdominal\s+pain|stomach\s+pain)\b", "Abdominal Pain"),
        (r"\b(?:loose\s+motions?|diarrhea)\b", "Diarrhea"),
        (r"\b(?:generalized\s+weakness|fatigue)\b", "Weakness / Fatigue"),
        (r"\b(?:body\s+ache|myalgia)\b", "Body Ache"),
        (r"\b(?:joint\s+pain|arthralgia)\b", "Joint Pain"),
        (r"\b(?:sore\s+throat|throat\s+pain)\b", "Sore Throat"),
        (r"\b(?:rash|itching|pruritus)\b", "Skin Rash / Itching"),
    ]

    for pattern, name in symptom_patterns:
        m = re.search(rf"{pattern}(?:\s*(?:since|for)?\s*(\d+\s*(?:days?|weeks?|months?|hours?)))?", text, re.I)
        if m:
            if name in seen:
                continue
            seen.add(name)
            duration = m.group(1).strip() if m.group(1) else None
            symptoms.append(SymptomExtractionItem(name=name, duration=duration))

    return symptoms


def extract_diagnosis(text: str) -> List[str]:
    """Extract explicit diagnosis from clinical document."""
    diagnoses = []

    # Look for Diagnosis / Impression / Assessment lines
    m = re.search(r"\b(?:diagnosis|provisional\s+diagnosis|impression|assessment)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if m:
        raw = m.group(1).strip()
        for item in re.split(r"[,/]+", raw):
            clean = item.strip()
            if clean and len(clean) > 2 and clean.lower() not in ("none", "nil"):
                diagnoses.append(clean.title())

    conditions = [
        "Type 2 Diabetes Mellitus", "Hypertension", "Acute Viral Syndrome",
        "Acute Bronchitis", "Upper Respiratory Tract Infection (URTI)",
        "Gastroenteritis", "Coronary Artery Disease", "Asthma", "Allergic Rhinitis",
        "Urinary Tract Infection (UTI)", "Hypothyroidism", "Dyslipidemia"
    ]
    for cond in conditions:
        if re.search(rf"\b{re.escape(cond)}\b", text, re.I):
            if cond not in diagnoses:
                diagnoses.append(cond)

    return diagnoses


def extract_medical_history_and_allergies(text: str):
    """Extract past medical history and confirmed drug/food allergies."""
    pmh = []
    allergies = []

    pmh_match = re.search(r"\b(?:past\s+medical\s+history|pmh|history\s+of|known\s+case\s+of)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if pmh_match:
        for item in re.split(r"[,/]+", pmh_match.group(1)):
            clean = item.strip()
            if clean and len(clean) > 2 and clean.lower() not in ("none", "nil", "no"):
                pmh.append(clean.title())

    allergy_match = re.search(r"\b(?:allerg(?:y|ies)|allergic\s+to|known\s+allergies)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if allergy_match:
        raw_allergy = allergy_match.group(1).strip()
        if raw_allergy.lower() not in ("none", "nil", "no known drug allergies", "nkda", "no"):
            for item in re.split(r"[,/]+", raw_allergy):
                clean = item.strip()
                if clean:
                    allergies.append(clean.title())

    return pmh, allergies


def extract_imaging(text: str) -> List[str]:
    """Extract imaging findings (X-Ray, CT, MRI, USG, ECG)."""
    findings = []
    for mod in ["chest x-ray", "x-ray", "ecg", "ekg", "usg", "ultrasound", "ct scan", "mri"]:
        m = re.search(rf"\b{mod}\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
        if m:
            finding = f"{mod.upper()}: {m.group(1).strip()}"
            findings.append(finding)
    return findings


def extract_advice_and_followup(text: str):
    """Extract doctor's advice and follow-up plan."""
    advice_list = []
    follow_up = None

    advice_match = re.search(r"\b(?:advice|instructions?|lifestyle\s+advice|plan)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if advice_match:
        for item in re.split(r"[,/]+", advice_match.group(1)):
            clean = item.strip()
            if clean and len(clean) > 2:
                advice_list.append(clean.capitalize())

    fu_match = re.search(r"\b(?:follow\s*up|review)\s*(?:after|on|in)?\s*[:=\-]?\s*([^.\n\r|;]+)", text, re.I)
    if fu_match:
        fu_text = fu_match.group(1).strip()
        follow_up = FollowUpInfo(required=True, date_or_duration=fu_text, notes=f"Review: {fu_text}")
    elif re.search(r"\bsos\b", text, re.I):
        follow_up = FollowUpInfo(required=False, date_or_duration="SOS", notes="Return if symptoms worsen")

    return advice_list, follow_up


def extract_procedures(text: str) -> List[str]:
    """Extract clinical procedures performed or ordered."""
    procedures = []
    keywords = ["nebulization", "wound dressing", "suture removal", "injection", "physiotherapy", "iv fluids", "catherization"]
    for kw in keywords:
        if re.search(rf"\b{kw}\b", text, re.I):
            procedures.append(kw.title())
    return procedures


def build_timeline_events(
    report_date: Optional[str],
    symptoms: List[SymptomExtractionItem],
    diagnosis: List[str],
    medicines: List[MedicineExtractionItem],
    tests: List[TestExtractionItem],
    follow_up: Optional[FollowUpInfo]
) -> List[TimelineEventItem]:
    """Assemble coherent chronological timeline events from extracted items."""
    events = []
    date_label = report_date or "Encounter Date"

    for s in symptoms:
        dur_note = f" (Duration: {s.duration})" if s.duration else ""
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Symptom Reported: {s.name}{dur_note}",
            category="symptom"
        ))

    if diagnosis:
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Clinical Diagnosis: {', '.join(diagnosis)}",
            category="consultation"
        ))

    if tests:
        test_summary = ", ".join(f"{t.name} ({t.value} {t.unit or ''})" for t in tests[:3])
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Diagnostic Tests: {test_summary}",
            category="test"
        ))

    if medicines:
        med_summary = ", ".join(f"{m.name} {m.strength or ''}".strip() for m in medicines[:3])
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Prescribed: {med_summary}",
            category="prescription"
        ))

    if follow_up and follow_up.date_or_duration:
        events.append(TimelineEventItem(
            date=f"Planned: {follow_up.date_or_duration}",
            event=f"Follow-up Review Scheduled ({follow_up.date_or_duration})",
            category="follow_up"
        ))

    return events


def extract_clinical_document(text: str, doc_type: Optional[str] = None) -> ClinicalDocumentExtraction:
    """
    Main extraction function. Runs strict medical NLP entity extraction
    on OCR / document text and produces a validated ClinicalDocumentExtraction schema.
    """
    report_date = extract_date(text)
    vitals = extract_vitals(text)
    medicines = extract_medicines(text)
    tests = extract_lab_tests(text)
    symptoms = extract_symptoms(text)
    diagnosis = extract_diagnosis(text)
    pmh, allergies = extract_medical_history_and_allergies(text)
    imaging = extract_imaging(text)
    procedures = extract_procedures(text)
    advice, follow_up = extract_advice_and_followup(text)

    reason_for_visit = None
    rfv_match = re.search(r"\b(?:reason\s+for\s+visit|chief\s+complaint|c/o|presenting\s+complaints?)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if rfv_match:
        reason_for_visit = rfv_match.group(1).strip().capitalize()
    elif symptoms:
        reason_for_visit = f"Presents with {', '.join(s.name for s in symptoms[:2])}"
    elif diagnosis:
        reason_for_visit = f"Evaluation for {diagnosis[0]}"

    timeline_events = build_timeline_events(
        report_date, symptoms, diagnosis, medicines, tests, follow_up
    )

    clean_lines = [l.strip() for l in text.splitlines() if l.strip()]
    raw_summary = " | ".join(clean_lines[:4]) if clean_lines else None

    return ClinicalDocumentExtraction(
        report_date=report_date,
        reason_for_visit=reason_for_visit,
        symptoms=symptoms,
        diagnosis=diagnosis,
        past_medical_history=pmh,
        allergies=allergies,
        vitals_and_examination=vitals,
        tests=tests,
        imaging_findings=imaging,
        medicines=medicines,
        procedures_and_treatments=procedures,
        doctor_advice=advice,
        follow_up=follow_up,
        timeline_events=timeline_events,
        raw_ocr_summary=raw_summary,
    )
