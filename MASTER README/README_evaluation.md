# 📊 Evaluation Guide — The Medical AI Test & Report Card

> **Folder:** `evaluation/`  
> **What it does:** In healthcare, an AI must never guess or make dangerous mistakes. This folder contains automated quizzes and benchmark tests that verify our medical algorithms are safe, accurate, and reliable.

---

## 📁 What is Inside the `evaluation/` Folder?

```
evaluation/
├── run_evaluation.py          # The test runner script that quizzes the system
├── report.html                # A colorful web report card showing test scores
├── results.json               # The raw mathematical score numbers
└── *_cases.json               # 9 test files containing practice medical scenarios
```

---

## 🧪 The Practice Medical Quizzes (`*_cases.json`)

To make sure the system works in real life, we created hundreds of realistic clinical test scenarios:

| Test Quiz File | What We Are Testing (In Simple Words) |
| :--- | :--- |
| [`red_flag_cases.json`](file:///d:/medikiosk/evaluation/red_flag_cases.json) | **Emergency Danger Signs:** Does the system immediately catch life-threatening emergencies (like heart attacks, acute breathing failure, or strokes)? *(Our target score here is 100%!)* |
| [`medication_cases.json`](file:///d:/medikiosk/evaluation/medication_cases.json) | **Prescription Reading:** Can the system correctly read medicine names (like Paracetamol or Metformin), their strengths (500mg), and when to take them (once daily, twice daily)? |
| [`lab_cases.json`](file:///d:/medikiosk/evaluation/lab_cases.json) | **Blood & Lab Tests:** Does the system understand lab reports (like Blood Sugar, Hemoglobin, or Creatinine) and accurately spot abnormally high or low numbers? |
| [`contradiction_cases.json`](file:///d:/medikiosk/evaluation/contradiction_cases.json) | **Catching Inconsistencies:** If a patient claims "I have no chronic diseases" but their uploaded prescription lists blood pressure tablets, does the system spot the contradiction? |
| [`multilingual_cases.json`](file:///d:/medikiosk/evaluation/multilingual_cases.json) | **Language Understanding:** Can the system understand symptoms when spoken or typed across 7 regional languages (Kannada, Hindi, Marathi, Tamil, Odia, Nepali, English) and normalize them into canonical medical concepts? |
| [`symptom_cases.json`](file:///d:/medikiosk/evaluation/symptom_cases.json) | **Symptom Extraction:** Does it accurately pull out chief complaints (fever, cough, vomiting) from everyday conversational sentences? |
| [`allergy_cases.json`](file:///d:/medikiosk/evaluation/allergy_cases.json) | **Drug Allergies:** Does it catch when a patient reports an allergy (e.g. to Penicillin) so the doctor doesn't prescribe it by accident? |
| [`duration_cases.json`](file:///d:/medikiosk/evaluation/duration_cases.json) | **Time & Duration:** Can it convert natural phrases like "started 3 days ago" or "since yesterday night" into clear numbers for the doctor? |
| [`summary_cases.json`](file:///d:/medikiosk/evaluation/summary_cases.json) | **Summary Quality:** Is the summary prepared for the doctor tidy, clear, and free from made-up facts? |

---

## 🏃 How to Run the Quiz Yourself

You can test the entire system right from your terminal with one simple command:

```bash
python evaluation/run_evaluation.py
```

### What Happens When You Run It:
1. It tests every scenario in all 9 quiz files.
2. It calculates real mathematical accuracy scores (**Precision**, **Recall**, and **F1-Score**).
3. It writes a shiny, beautiful report card file called **`evaluation/report.html`**.
4. You can double-click **`evaluation/report.html`** to see green pass badges, pie charts, and detailed scores in your web browser!

---

## 💡 Why This is Special
Many AI projects just show fake, hardcoded numbers on their presentations. In MediKiosk, **every number is 100% real and calculated live**. Anyone can run the script and see the exact accuracy for themselves!
