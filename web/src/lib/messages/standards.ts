// Messages for the standards area, in the three site languages. Keys start with "standards." so areas never clash.
// Greek and Italian may leave a key out; it then falls back to English.
// Standard, resource and profile names (FHIR, Observation, LocationOah, SMART App Launch 2.0...) stay as they are.
export const en = {
  "standards.title": "Standards",
  "standards.subtitle": "Every report, baseline and alert is an HL7 FHIR R4 resource you can check at the source.",
  "standards.subtitleInfo":
    "Everything is profiled with the OneAquaHealth Implementation Guide (OAH IG). The FHIR server is public and read-only, so anything shown in the app can be checked there.",

  "standards.glance": "At a glance",
  "standards.card.fhir.use": "Every record is a resource",
  "standards.card.oah.use": "Sites, indicators, cohorts, health measures",
  "standards.card.stc.name": "Our FSH profiles",
  "standards.card.stc.use": "Alerts, clinic messages, lineage",
  "standards.card.stc.link": "FSH source",
  "standards.card.validator.use": "Checked on every change",
  "standards.card.smart.use": "Clinician sign-in for the clinic view",
  "standards.card.smart.info":
    "The clinic view is a SMART App Launch 2.0 app and our API is its authorization server: standalone sign-in or EHR launch, code flow with PKCE. The token carries the clinic and the clinician (fhirContext, fhirUser), and a signed reply gets a Provenance naming the Practitioner.",
  "standards.card.mcp.use": "Any AI client can read the data",
  "standards.card.mcp.info":
    "A Model Context Protocol server (Streamable HTTP, POST only) with the same read-only FHIR tools as the Ask page. It needs no key, so any MCP client can bring its own model.",

  "standards.mapping.title": "How each concept maps to FHIR",
  "standards.mapping.info":
    "Indicators use codes from the OAH code system (temporarySystem-oah-eu) and UCUM units. Presence readings (absent, present, abundant), risk types and clinic replies use three small code systems of ours, published on the same server with a value set each. Demo clinics, cohorts and health figures carry the HL7 HTEST tag for synthetic data.",
  "standards.mapping.caption": "Stream-to-Clinic concepts and the FHIR resources and profiles that carry them",
  "standards.mapping.concept": "Concept",
  "standards.mapping.resource": "FHIR resource",
  "standards.mapping.profile": "Profile",
  "standards.coreR4": "Core R4",
  "standards.tag.ours": "ours",
  "standards.concept.site": "Stream site",
  "standards.concept.report": "Citizen report",
  "standards.concept.reportInfo": "Temperature, pH, dissolved oxygen, conductivity, foam, algae and larvae.",
  "standards.concept.photo": "Report photo",
  "standards.concept.provenance": "Who reported it, and when",
  "standards.concept.cohort": "District cohort near a stream",
  "standards.concept.baseline": "Baseline disease prevalence",
  "standards.concept.clinic": "Clinic and the streams it serves",
  "standards.concept.alert": "Health alert with its evidence",
  "standards.concept.clinicAlert": "Alert sent to a clinic",
  "standards.concept.reply": "Clinic's reply",
  "standards.concept.advisory": "AI-drafted plain-language notice",
  "standards.concept.trigger": "Trigger for outside observations",

  "standards.profiles.title": "Our own profiles, built on the OAH IG",
  "standards.profiles.lead": "Seven profiles for what happens after the stream: alert, clinic messages, AI advisory, lineage.",
  "standards.profiles.info":
    "The OAH IG covers the stream (sites, indicators, cohorts, health measures) but has nothing yet for what happens next. Our profiles are written in FSH and built with SUSHI with the OAH IG as a dependency: the alert's site must be a LocationOah, the cohort a GroupOah. They are loaded into the public FHIR server, so each canonical URL resolves. Every resource the API writes declares its profile in meta.profile, so a partner can find them with _profile searches.",
  "standards.profile.stc-stream-risk-alert": "Health alert with evidence",
  "standards.profile.stc-stream-risk-alert.info":
    "Risk code from our value set, the stream site as a LocationOah, one evidence entry per condition met, and the decision narrative.",
  "standards.profile.stc-clinic-alert": "Alert sent to a clinic",
  "standards.profile.stc-clinic-alert.info":
    "Category alert, about a StcStreamRiskAlert, one clinic as recipient, and the GroupOah cohort as subject.",
  "standards.profile.stc-clinic-response": "Clinic's coded reply",
  "standards.profile.stc-clinic-response.info":
    "A reply to a StcClinicAlert (inResponseTo) with a coded action from the alert-response value set.",
  "standards.profile.stc-clinic-advisory": "AI-drafted notice",
  "standards.profile.stc-clinic-advisory.info":
    "Category instruction, sent by the StcAdvisorDevice, so text written by a model is marked as such.",
  "standards.profile.stc-advisor-device": "The language model",
  "standards.profile.stc-advisor-device.info": "The language model as a named Device.",
  "standards.profile.stc-report-provenance": "Who reported what",
  "standards.profile.stc-report-provenance.info":
    "A citizen report and its photo as targets, with the reporter as author and the app as assembler.",
  "standards.profile.stc-advisory-provenance": "Where AI text came from",
  "standards.profile.stc-advisory-provenance.info":
    "The advisory model as author, and the alert it was drafted from as the source.",

  "standards.examples.title": "Live examples",
  "standards.examples.lead": "Real resources on the public FHIR server, right now.",
  "standards.examples.loading": "Loading live examples",
  "standards.examples.site": "Stream site",
  "standards.examples.report": "Latest citizen report",
  "standards.examples.cohort": "District cohort",
  "standards.examples.alert": "Health alert",
  "standards.examples.message": "Message to a clinic",
  "standards.examples.trigger": "Observation trigger",
  "standards.examples.bundle": "Whole site as one Bundle",
  "standards.examples.noSites": "No sites loaded yet.",
  "standards.examples.noReports": "No reports yet.",
  "standards.examples.noAlert": "No active alert right now.",
  "standards.examples.noAlertInfo": "One appears as soon as a risk rule fires; see the map.",
  "standards.examples.noMessage": "No clinic messaged right now.",

  "standards.conformance.title": "Conformance, checked on every change",
  "standards.conformance.step1": "Build the OAH IG at a pinned commit",
  "standards.conformance.step1Info":
    "The OAH IG is still a draft and not published as a package, so CI builds it from source with SUSHI at commit {commit}.",
  "standards.conformance.step2": "Generate samples from the app's code",
  "standards.conformance.step2Info":
    "Samples come from the app's own mapping, seed and alert code, not written by hand: a report for every indicator and value, the sites, cohorts, baselines, clinics, a photo, an alert, a clinic message and a site Bundle.",
  "standards.conformance.step3": "Build our profiles from FSH",
  "standards.conformance.step3Info":
    "Built on top of the OAH IG. CI also checks that the definitions the server is seeded with match a fresh build.",
  "standards.conformance.step4": "Validate with the HL7 validator",
  "standards.conformance.step4Info":
    "The official HL7 validator_cli checks the samples against FHIR 4.0.1, the OAH profiles and ours. Any error fails the build.",
  "standards.conformance.badge": "Validate FHIR workflow status",

  "standards.integration.title": "Plugging in another system",
  "standards.integration.lead": "Any system that writes an ObservationIndicatorsOah Observation gets the same assessment.",
  "standards.integration.step1": "Partner writes an Observation",
  "standards.integration.step1Info":
    "The Observation is created on the FHIR server with the stream site as subject. The public endpoint is read-only in this demo; a partner would be given write access.",
  "standards.integration.step2": "Subscription passes it on",
  "standards.integration.step2Info":
    "The server matches it against the citizen-observations Subscription and delivers it to the risk engine over a rest-hook.",
  "standards.integration.step3": "Risk engine re-checks the site",
  "standards.integration.step3Info": "It uses the recent reports and live rainfall from Open-Meteo.",
  "standards.integration.step4": "Alert reaches the clinics",
  "standards.integration.step4Info":
    "If a rule fires, a DetectedIssue and one Communication per serving clinic appear on the FHIR server, where a clinic system can read them, for example with Communication?recipient=Organization/…",
  "standards.integration.step5": "Clinic replies in FHIR",
  "standards.integration.step5Info":
    "The reply is another Communication whose inResponseTo points at the one we sent, so the loop closes in standard resources rather than in a private status column.",
  "standards.integration.step6": "Plain-language advisory, marked as AI",
  "standards.integration.step6Info":
    "A clinic can ask for the alert in plainer words. A language model rewrites the engine's own reasons; it is given nothing else and changes no risk or level. The draft is a Communication whose sender is a Device, with a Provenance naming that device as the author, so any reader can tell text written by a machine from a clinician's.",

  "standards.curl.title": "Try it with curl",
  "standards.curl.show": "Show commands",
  "standards.curl.metadata": "What the server supports",
  "standards.curl.sites": "Stream sites conforming to LocationOah",
  "standards.curl.latest": "Latest citizen reports at one site",
  "standards.curl.alerts": "Health alerts and the messages sent to clinics",
  "standards.curl.replies": "Clinic replies, found by our profile",
  "standards.curl.bundle": "Everything about one site as a single Bundle",
} as const;

export const el: Partial<Record<keyof typeof en, string>> = {
  "standards.title": "Πρότυπα",
  "standards.subtitle": "Κάθε αναφορά, τιμή αναφοράς και ειδοποίηση είναι πόρος HL7 FHIR R4 που μπορείτε να ελέγξετε στην πηγή.",
  "standards.subtitleInfo":
    "Όλα ακολουθούν τα προφίλ του Οδηγού Υλοποίησης OneAquaHealth (OAH IG). Ο διακομιστής FHIR είναι δημόσιος και μόνο για ανάγνωση, οπότε ό,τι εμφανίζεται στην εφαρμογή μπορεί να ελεγχθεί εκεί.",

  "standards.glance": "Με μια ματιά",
  "standards.card.fhir.use": "Κάθε εγγραφή είναι πόρος",
  "standards.card.oah.use": "Θέσεις, δείκτες, πληθυσμοί, μέτρα υγείας",
  "standards.card.stc.name": "Τα δικά μας προφίλ FSH",
  "standards.card.stc.use": "Ειδοποιήσεις, μηνύματα κλινικών, προέλευση",
  "standards.card.stc.link": "Πηγαίος κώδικας FSH",
  "standards.card.validator.use": "Έλεγχος σε κάθε αλλαγή",
  "standards.card.smart.use": "Σύνδεση ιατρών στην προβολή κλινικής",
  "standards.card.smart.info":
    "Η προβολή κλινικής είναι εφαρμογή SMART App Launch 2.0 και το API μας είναι ο διακομιστής εξουσιοδότησης: αυτόνομη σύνδεση ή εκκίνηση από EHR, ροή κωδικού με PKCE. Το token περιέχει την κλινική και τον ιατρό (fhirContext, fhirUser), και κάθε υπογεγραμμένη απάντηση παίρνει ένα Provenance που ονομάζει τον Practitioner.",
  "standards.card.mcp.use": "Κάθε πελάτης AI μπορεί να διαβάσει τα δεδομένα",
  "standards.card.mcp.info":
    "Διακομιστής Model Context Protocol (Streamable HTTP, μόνο POST) με τα ίδια εργαλεία FHIR μόνο για ανάγνωση με τη σελίδα «Ερώτηση». Δεν χρειάζεται κλειδί, οπότε κάθε πελάτης MCP μπορεί να φέρει το δικό του μοντέλο.",

  "standards.mapping.title": "Πώς αντιστοιχεί κάθε έννοια στο FHIR",
  "standards.mapping.info":
    "Οι δείκτες χρησιμοποιούν κωδικούς από το σύστημα κωδικών OAH (temporarySystem-oah-eu) και μονάδες UCUM. Οι ενδείξεις παρουσίας (απουσία, παρουσία, αφθονία), οι τύποι κινδύνου και οι απαντήσεις κλινικών χρησιμοποιούν τρία μικρά δικά μας συστήματα κωδικών, δημοσιευμένα στον ίδιο διακομιστή με ένα σύνολο τιμών το καθένα. Οι κλινικές, οι πληθυσμοί και τα στοιχεία υγείας της επίδειξης φέρουν την ετικέτα HL7 HTEST για συνθετικά δεδομένα.",
  "standards.mapping.caption": "Οι έννοιες του Stream-to-Clinic και οι πόροι και τα προφίλ FHIR που τις μεταφέρουν",
  "standards.mapping.concept": "Έννοια",
  "standards.mapping.resource": "Πόρος FHIR",
  "standards.mapping.profile": "Προφίλ",
  "standards.coreR4": "Βασικό R4",
  "standards.tag.ours": "δικό μας",
  "standards.concept.site": "Θέση ρέματος",
  "standards.concept.report": "Αναφορά πολίτη",
  "standards.concept.reportInfo": "Θερμοκρασία, pH, διαλυμένο οξυγόνο, αγωγιμότητα, αφρός, φύκια και προνύμφες.",
  "standards.concept.photo": "Φωτογραφία αναφοράς",
  "standards.concept.provenance": "Ποιος την έκανε και πότε",
  "standards.concept.cohort": "Πληθυσμός περιοχής κοντά σε ρέμα",
  "standards.concept.baseline": "Αρχικός επιπολασμός νόσων",
  "standards.concept.clinic": "Κλινική και τα ρέματα που εξυπηρετεί",
  "standards.concept.alert": "Ειδοποίηση υγείας με τα στοιχεία της",
  "standards.concept.clinicAlert": "Ειδοποίηση προς κλινική",
  "standards.concept.reply": "Απάντηση της κλινικής",
  "standards.concept.advisory": "Απλή ενημέρωση γραμμένη από AI",
  "standards.concept.trigger": "Ενεργοποίηση για εξωτερικές παρατηρήσεις",

  "standards.profiles.title": "Τα δικά μας προφίλ, πάνω στο OAH IG",
  "standards.profiles.lead": "Επτά προφίλ για ό,τι ακολουθεί μετά το ρέμα: ειδοποίηση, μηνύματα κλινικών, ενημέρωση AI, προέλευση.",
  "standards.profiles.info":
    "Το OAH IG καλύπτει το ρέμα (θέσεις, δείκτες, πληθυσμούς, μέτρα υγείας) αλλά δεν έχει ακόμη τίποτα για ό,τι ακολουθεί. Τα προφίλ μας είναι γραμμένα σε FSH και χτίζονται με το SUSHI με το OAH IG ως εξάρτηση: η θέση της ειδοποίησης πρέπει να είναι LocationOah και ο πληθυσμός GroupOah. Είναι φορτωμένα στον δημόσιο διακομιστή FHIR, οπότε κάθε κανονικό URL λειτουργεί. Κάθε πόρος που γράφει το API δηλώνει το προφίλ του στο meta.profile, ώστε ένας συνεργάτης να τους βρίσκει με αναζητήσεις _profile.",
  "standards.profile.stc-stream-risk-alert": "Ειδοποίηση υγείας με στοιχεία",
  "standards.profile.stc-stream-risk-alert.info":
    "Κωδικός κινδύνου από το σύνολο τιμών μας, η θέση του ρέματος ως LocationOah, μία καταχώριση στοιχείων για κάθε συνθήκη που ισχύει και η αιτιολόγηση της απόφασης.",
  "standards.profile.stc-clinic-alert": "Ειδοποίηση προς κλινική",
  "standards.profile.stc-clinic-alert.info":
    "Κατηγορία alert, σχετικά με ένα StcStreamRiskAlert, μία κλινική ως παραλήπτης και ο πληθυσμός GroupOah ως subject.",
  "standards.profile.stc-clinic-response": "Κωδικοποιημένη απάντηση κλινικής",
  "standards.profile.stc-clinic-response.info":
    "Απάντηση σε ένα StcClinicAlert (inResponseTo) με κωδικοποιημένη ενέργεια από το σύνολο τιμών alert-response.",
  "standards.profile.stc-clinic-advisory": "Ενημέρωση γραμμένη από AI",
  "standards.profile.stc-clinic-advisory.info":
    "Κατηγορία instruction, με αποστολέα το StcAdvisorDevice, ώστε το κείμενο που έγραψε μοντέλο να φαίνεται ως τέτοιο.",
  "standards.profile.stc-advisor-device": "Το γλωσσικό μοντέλο",
  "standards.profile.stc-advisor-device.info": "Το γλωσσικό μοντέλο ως επώνυμη συσκευή (Device).",
  "standards.profile.stc-report-provenance": "Ποιος ανέφερε τι",
  "standards.profile.stc-report-provenance.info":
    "Μια αναφορά πολίτη και η φωτογραφία της ως στόχοι, με τον πολίτη ως συντάκτη και την εφαρμογή ως συναρμολογητή.",
  "standards.profile.stc-advisory-provenance": "Από πού ήρθε το κείμενο AI",
  "standards.profile.stc-advisory-provenance.info":
    "Το μοντέλο ενημέρωσης ως συντάκτης και η ειδοποίηση από την οποία γράφτηκε ως πηγή.",

  "standards.examples.title": "Ζωντανά παραδείγματα",
  "standards.examples.lead": "Πραγματικοί πόροι στον δημόσιο διακομιστή FHIR, αυτή τη στιγμή.",
  "standards.examples.loading": "Φόρτωση ζωντανών παραδειγμάτων",
  "standards.examples.site": "Θέση ρέματος",
  "standards.examples.report": "Πιο πρόσφατη αναφορά πολίτη",
  "standards.examples.cohort": "Πληθυσμός περιοχής",
  "standards.examples.alert": "Ειδοποίηση υγείας",
  "standards.examples.message": "Μήνυμα προς κλινική",
  "standards.examples.trigger": "Ενεργοποίηση παρατηρήσεων",
  "standards.examples.bundle": "Όλη η θέση σε ένα Bundle",
  "standards.examples.noSites": "Δεν έχουν φορτωθεί ακόμη θέσεις.",
  "standards.examples.noReports": "Δεν υπάρχουν ακόμη αναφορές.",
  "standards.examples.noAlert": "Καμία ενεργή ειδοποίηση αυτή τη στιγμή.",
  "standards.examples.noAlertInfo": "Εμφανίζεται μόλις ενεργοποιηθεί ένας κανόνας κινδύνου· δείτε τον χάρτη.",
  "standards.examples.noMessage": "Καμία κλινική δεν έχει λάβει μήνυμα αυτή τη στιγμή.",

  "standards.conformance.title": "Συμμόρφωση, ελεγμένη σε κάθε αλλαγή",
  "standards.conformance.step1": "Χτίσιμο του OAH IG σε σταθερό commit",
  "standards.conformance.step1Info":
    "Το OAH IG είναι ακόμη προσχέδιο και δεν έχει δημοσιευτεί ως πακέτο, οπότε το CI το χτίζει από τον πηγαίο κώδικα με το SUSHI στο commit {commit}.",
  "standards.conformance.step2": "Δείγματα από τον κώδικα της εφαρμογής",
  "standards.conformance.step2Info":
    "Τα δείγματα παράγονται από τον ίδιο κώδικα αντιστοίχισης, αρχικών δεδομένων και ειδοποιήσεων της εφαρμογής, όχι με το χέρι: μια αναφορά για κάθε δείκτη και τιμή, οι θέσεις, οι πληθυσμοί, οι τιμές αναφοράς, οι κλινικές, μια φωτογραφία, μια ειδοποίηση, ένα μήνυμα κλινικής και ένα Bundle θέσης.",
  "standards.conformance.step3": "Χτίσιμο των προφίλ μας από FSH",
  "standards.conformance.step3Info":
    "Χτίζονται πάνω στο OAH IG. Το CI ελέγχει επίσης ότι οι ορισμοί με τους οποίους γεμίζει ο διακομιστής ταιριάζουν με ένα νέο χτίσιμο.",
  "standards.conformance.step4": "Επικύρωση με τον επικυρωτή HL7",
  "standards.conformance.step4Info":
    "Ο επίσημος validator_cli του HL7 ελέγχει τα δείγματα έναντι του FHIR 4.0.1, των προφίλ OAH και των δικών μας. Οποιοδήποτε σφάλμα αποτυγχάνει το build.",
  "standards.conformance.badge": "Κατάσταση ροής εργασίας Validate FHIR",

  "standards.integration.title": "Σύνδεση άλλου συστήματος",
  "standards.integration.lead": "Κάθε σύστημα που γράφει ένα Observation ObservationIndicatorsOah λαμβάνει την ίδια αξιολόγηση.",
  "standards.integration.step1": "Ο συνεργάτης γράφει ένα Observation",
  "standards.integration.step1Info":
    "Το Observation δημιουργείται στον διακομιστή FHIR με τη θέση του ρέματος ως subject. Στην επίδειξη το δημόσιο endpoint είναι μόνο για ανάγνωση· ένας συνεργάτης θα έπαιρνε δικαίωμα εγγραφής.",
  "standards.integration.step2": "Το Subscription το προωθεί",
  "standards.integration.step2Info":
    "Ο διακομιστής το ταιριάζει με το Subscription citizen-observations και το παραδίδει στη μηχανή κινδύνου μέσω rest-hook.",
  "standards.integration.step3": "Η μηχανή κινδύνου ελέγχει ξανά τη θέση",
  "standards.integration.step3Info": "Χρησιμοποιεί τις πρόσφατες αναφορές και ζωντανά στοιχεία βροχόπτωσης από το Open-Meteo.",
  "standards.integration.step4": "Η ειδοποίηση φτάνει στις κλινικές",
  "standards.integration.step4Info":
    "Αν ενεργοποιηθεί κανόνας, ένα DetectedIssue και ένα Communication για κάθε κλινική που εξυπηρετεί την περιοχή εμφανίζονται στον διακομιστή FHIR, όπου ένα σύστημα κλινικής μπορεί να τα διαβάσει, για παράδειγμα με Communication?recipient=Organization/…",
  "standards.integration.step5": "Η κλινική απαντά σε FHIR",
  "standards.integration.step5Info":
    "Η απάντηση είναι ένα ακόμη Communication του οποίου το inResponseTo δείχνει σε αυτό που στείλαμε, οπότε ο κύκλος κλείνει με τυπικούς πόρους και όχι σε μια ιδιωτική στήλη κατάστασης.",
  "standards.integration.step6": "Απλή ενημέρωση, σημασμένη ως AI",
  "standards.integration.step6Info":
    "Μια κλινική μπορεί να ζητήσει την ειδοποίηση σε πιο απλά λόγια. Ένα γλωσσικό μοντέλο ξαναγράφει τους λόγους της ίδιας της μηχανής· δεν λαμβάνει τίποτε άλλο και δεν αλλάζει κανέναν κίνδυνο ή επίπεδο. Το προσχέδιο είναι ένα Communication με αποστολέα ένα Device και ένα Provenance που ορίζει αυτή τη συσκευή ως συντάκτη, ώστε κάθε αναγνώστης να ξεχωρίζει το κείμενο μηχανής από αυτό ενός ιατρού.",

  "standards.curl.title": "Δοκιμάστε το με curl",
  "standards.curl.show": "Εμφάνιση εντολών",
  "standards.curl.metadata": "Τι υποστηρίζει ο διακομιστής",
  "standards.curl.sites": "Θέσεις ρεμάτων σύμφωνες με το LocationOah",
  "standards.curl.latest": "Οι πιο πρόσφατες αναφορές πολιτών σε μία θέση",
  "standards.curl.alerts": "Ειδοποιήσεις υγείας και τα μηνύματα προς τις κλινικές",
  "standards.curl.replies": "Απαντήσεις κλινικών, βάσει του προφίλ μας",
  "standards.curl.bundle": "Όλα για μία θέση σε ένα Bundle",
};

export const it: Partial<Record<keyof typeof en, string>> = {
  "standards.title": "Standard",
  "standards.subtitle": "Ogni segnalazione, valore di riferimento e allerta è una risorsa HL7 FHIR R4 verificabile alla fonte.",
  "standards.subtitleInfo":
    "Tutto segue i profili della Guida all'implementazione OneAquaHealth (OAH IG). Il server FHIR è pubblico e in sola lettura, quindi tutto ciò che l'app mostra si può verificare lì.",

  "standards.glance": "In breve",
  "standards.card.fhir.use": "Ogni dato è una risorsa",
  "standards.card.oah.use": "Siti, indicatori, coorti, misure sanitarie",
  "standards.card.stc.name": "I nostri profili FSH",
  "standards.card.stc.use": "Allerte, messaggi alle cliniche, provenienza",
  "standards.card.stc.link": "Sorgenti FSH",
  "standards.card.validator.use": "Verificato a ogni modifica",
  "standards.card.smart.use": "Accesso dei medici alla vista clinica",
  "standards.card.smart.info":
    "La vista clinica è un'app SMART App Launch 2.0 e la nostra API è il suo server di autorizzazione: accesso autonomo o avvio da EHR, flusso con codice e PKCE. Il token porta la clinica e il medico (fhirContext, fhirUser), e ogni risposta firmata riceve un Provenance che nomina il Practitioner.",
  "standards.card.mcp.use": "Qualsiasi client AI può leggere i dati",
  "standards.card.mcp.info":
    "Un server Model Context Protocol (Streamable HTTP, solo POST) con gli stessi strumenti FHIR in sola lettura della pagina «Chiedi». Non serve alcuna chiave, quindi ogni client MCP può usare il proprio modello.",

  "standards.mapping.title": "Come ogni concetto corrisponde a FHIR",
  "standards.mapping.info":
    "Gli indicatori usano i codici del sistema di codifica OAH (temporarySystem-oah-eu) e le unità UCUM. Le letture di presenza (assente, presente, abbondante), i tipi di rischio e le risposte delle cliniche usano tre piccoli sistemi di codifica nostri, pubblicati sullo stesso server con un value set ciascuno. Le cliniche, le coorti e i dati sanitari della demo portano il tag HL7 HTEST per i dati sintetici.",
  "standards.mapping.caption": "I concetti di Stream-to-Clinic e le risorse e i profili FHIR che li rappresentano",
  "standards.mapping.concept": "Concetto",
  "standards.mapping.resource": "Risorsa FHIR",
  "standards.mapping.profile": "Profilo",
  "standards.coreR4": "R4 di base",
  "standards.tag.ours": "nostro",
  "standards.concept.site": "Sito del corso d'acqua",
  "standards.concept.report": "Segnalazione del cittadino",
  "standards.concept.reportInfo": "Temperatura, pH, ossigeno disciolto, conducibilità, schiuma, alghe e larve.",
  "standards.concept.photo": "Foto della segnalazione",
  "standards.concept.provenance": "Chi l'ha fatta e quando",
  "standards.concept.cohort": "Coorte del distretto vicino al corso d'acqua",
  "standards.concept.baseline": "Prevalenza di base delle malattie",
  "standards.concept.clinic": "Clinica e i corsi d'acqua che copre",
  "standards.concept.alert": "Allerta sanitaria con le sue prove",
  "standards.concept.clinicAlert": "Allerta inviata a una clinica",
  "standards.concept.reply": "Risposta della clinica",
  "standards.concept.advisory": "Avviso semplice scritto dall'AI",
  "standards.concept.trigger": "Attivazione per osservazioni esterne",

  "standards.profiles.title": "I nostri profili, basati sull'OAH IG",
  "standards.profiles.lead": "Sette profili per ciò che succede dopo il corso d'acqua: allerta, messaggi alle cliniche, avviso AI, provenienza.",
  "standards.profiles.info":
    "L'OAH IG copre il corso d'acqua (siti, indicatori, coorti, misure sanitarie) ma non ha ancora nulla per ciò che viene dopo. I nostri profili sono scritti in FSH e compilati con SUSHI con l'OAH IG come dipendenza: il sito dell'allerta deve essere un LocationOah, la coorte un GroupOah. Sono caricati sul server FHIR pubblico, quindi ogni URL canonico funziona. Ogni risorsa scritta dall'API dichiara il suo profilo in meta.profile, così un partner può trovarle con ricerche _profile.",
  "standards.profile.stc-stream-risk-alert": "Allerta sanitaria con prove",
  "standards.profile.stc-stream-risk-alert.info":
    "Codice di rischio dal nostro value set, il sito come LocationOah, una voce di evidenza per ogni condizione soddisfatta e la motivazione della decisione.",
  "standards.profile.stc-clinic-alert": "Allerta inviata a una clinica",
  "standards.profile.stc-clinic-alert.info":
    "Categoria alert, riferita a uno StcStreamRiskAlert, una clinica come destinatario e la coorte GroupOah come subject.",
  "standards.profile.stc-clinic-response": "Risposta codificata della clinica",
  "standards.profile.stc-clinic-response.info":
    "Una risposta a uno StcClinicAlert (inResponseTo) con un'azione codificata dal value set alert-response.",
  "standards.profile.stc-clinic-advisory": "Avviso scritto dall'AI",
  "standards.profile.stc-clinic-advisory.info":
    "Categoria instruction, inviato dallo StcAdvisorDevice, così il testo scritto da un modello è riconoscibile come tale.",
  "standards.profile.stc-advisor-device": "Il modello linguistico",
  "standards.profile.stc-advisor-device.info": "Il modello linguistico come Device con un nome.",
  "standards.profile.stc-report-provenance": "Chi ha segnalato cosa",
  "standards.profile.stc-report-provenance.info":
    "Una segnalazione del cittadino e la sua foto come target, con chi segnala come autore e l'app come assemblatore.",
  "standards.profile.stc-advisory-provenance": "Da dove viene il testo AI",
  "standards.profile.stc-advisory-provenance.info":
    "Il modello dell'avviso come autore e l'allerta da cui è stato scritto come fonte.",

  "standards.examples.title": "Esempi dal vivo",
  "standards.examples.lead": "Risorse reali sul server FHIR pubblico, in questo momento.",
  "standards.examples.loading": "Caricamento degli esempi dal vivo",
  "standards.examples.site": "Sito del corso d'acqua",
  "standards.examples.report": "Ultima segnalazione del cittadino",
  "standards.examples.cohort": "Coorte del distretto",
  "standards.examples.alert": "Allerta sanitaria",
  "standards.examples.message": "Messaggio a una clinica",
  "standards.examples.trigger": "Attivazione delle osservazioni",
  "standards.examples.bundle": "Tutto il sito in un Bundle",
  "standards.examples.noSites": "Nessun sito ancora caricato.",
  "standards.examples.noReports": "Ancora nessuna segnalazione.",
  "standards.examples.noAlert": "Nessuna allerta attiva al momento.",
  "standards.examples.noAlertInfo": "Ne compare una appena scatta una regola di rischio; guarda la mappa.",
  "standards.examples.noMessage": "Nessuna clinica ha ricevuto messaggi al momento.",

  "standards.conformance.title": "Conformità, verificata a ogni modifica",
  "standards.conformance.step1": "Compilare l'OAH IG a un commit fisso",
  "standards.conformance.step1Info":
    "L'OAH IG è ancora una bozza e non è pubblicato come pacchetto, quindi la CI lo compila dai sorgenti con SUSHI al commit {commit}.",
  "standards.conformance.step2": "Generare esempi dal codice dell'app",
  "standards.conformance.step2Info":
    "Gli esempi nascono dal codice di mappatura, di seed e di allerta dell'app, non scritti a mano: una segnalazione per ogni indicatore e valore, i siti, le coorti, i valori di riferimento, le cliniche, una foto, un'allerta, un messaggio a una clinica e un Bundle del sito.",
  "standards.conformance.step3": "Compilare i nostri profili da FSH",
  "standards.conformance.step3Info":
    "Compilati sopra l'OAH IG. La CI verifica anche che le definizioni caricate sul server corrispondano a una compilazione nuova.",
  "standards.conformance.step4": "Validare con il validatore HL7",
  "standards.conformance.step4Info":
    "Il validator_cli ufficiale di HL7 verifica gli esempi rispetto a FHIR 4.0.1, ai profili OAH e ai nostri. Qualsiasi errore fa fallire la build.",
  "standards.conformance.badge": "Stato del workflow Validate FHIR",

  "standards.integration.title": "Collegare un altro sistema",
  "standards.integration.lead": "Qualsiasi sistema che scrive un'Observation ObservationIndicatorsOah riceve la stessa valutazione.",
  "standards.integration.step1": "Il partner scrive un'Observation",
  "standards.integration.step1Info":
    "L'Observation viene creata sul server FHIR con il sito come subject. In questa demo l'endpoint pubblico è in sola lettura; un partner riceverebbe l'accesso in scrittura.",
  "standards.integration.step2": "La Subscription la inoltra",
  "standards.integration.step2Info":
    "Il server la confronta con la Subscription citizen-observations e la consegna al motore di rischio tramite rest-hook.",
  "standards.integration.step3": "Il motore di rischio ricontrolla il sito",
  "standards.integration.step3Info": "Usa le segnalazioni recenti e la pioggia in tempo reale da Open-Meteo.",
  "standards.integration.step4": "L'allerta arriva alle cliniche",
  "standards.integration.step4Info":
    "Se scatta una regola, un DetectedIssue e una Communication per ogni clinica interessata compaiono sul server FHIR, dove un sistema clinico può leggerli, ad esempio con Communication?recipient=Organization/…",
  "standards.integration.step5": "La clinica risponde in FHIR",
  "standards.integration.step5Info":
    "La risposta è un'altra Communication il cui inResponseTo punta a quella che abbiamo inviato, così il ciclo si chiude con risorse standard e non in una colonna di stato privata.",
  "standards.integration.step6": "Avviso semplice, segnato come AI",
  "standards.integration.step6Info":
    "Una clinica può chiedere l'allerta in parole più semplici. Un modello linguistico riscrive le motivazioni del motore stesso; non riceve nient'altro e non cambia alcun rischio o livello. La bozza è una Communication il cui mittente è un Device, con un Provenance che indica quel dispositivo come autore, così chiunque legga distingue il testo scritto da una macchina da quello di un medico.",

  "standards.curl.title": "Provalo con curl",
  "standards.curl.show": "Mostra i comandi",
  "standards.curl.metadata": "Cosa supporta il server",
  "standards.curl.sites": "Siti conformi a LocationOah",
  "standards.curl.latest": "Ultime segnalazioni dei cittadini in un sito",
  "standards.curl.alerts": "Allerte sanitarie e messaggi inviati alle cliniche",
  "standards.curl.replies": "Risposte delle cliniche, trovate tramite il nostro profilo",
  "standards.curl.bundle": "Tutto su un sito in un unico Bundle",
};
