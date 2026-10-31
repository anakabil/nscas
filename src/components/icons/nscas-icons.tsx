// Dibuat oleh scripts/generate-icons.ts dari public/icons/nav/*.svg. Jangan disunting langsung:
// ubah berkas SVG-nya, lalu jalankan `npm run icons`. Tes svg-to-jsx memastikan berkas ini selalu sesuai.

import { createIcon } from "./create-icon";

export const NavAccount = createIcon(
  "nav-account",
  <>
    <circle cx="10" cy="7.5" r="3" />
    <path d="M3.5 20 V18 Q4 13.5 10 13.5 Q13.3 13.5 15 15.2" />
    <path d="M17.5 14.2 L21 15.5 V19 Q20 21.2 17.5 22 Q15 21.2 14 19 V15.5 Z" />
    <path d="M16.5 18 V17 A1 1 0 0 1 18.5 17 V18 M16.5 18 H18.5" />
  </>,
);

export const NavActionPlan = createIcon(
  "nav-action-plan",
  <>
    <path d="M4 4 V20 H20 V10" />
    <path d="M7 10 L9 12 L12 8 M7 17 H15" />
    <path d="M15 3 V10 L18 8 L21 10 V3Z" />
  </>,
);

export const NavAssessments = createIcon(
  "nav-assessments",
  <>
    <rect x="4" y="4.5" width="16" height="17" rx="2" />
    <path d="M8 5 V4.6 Q8 2.4 12 2.4 Q16 2.4 16 4.6 V5.2 M7.8 6.5 H16.2" />
    <path d="M7 10 l1.3 1.1 1.6 -2 M12 10 H17" />
    <path d="M7 14 l1.3 1.1 1.6 -2 M12 14 H17" />
    <path d="M7 18 l1.3 1.1 1.6 -2 M12 18 H17" />
  </>,
);

export const NavAudit = createIcon(
  "nav-audit",
  <>
    <path d="M3 10 A9 9 0 1 1 5 18 M3 5 V10 H8" />
    <path d="M12 7 V12 L15 14" />
  </>,
);

export const NavDashboard = createIcon(
  "nav-dashboard",
  <>
    <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
    <rect x="6" y="12" width="3" height="5" rx="0" fill="currentColor" />
    <rect x="11" y="9" width="3" height="8" rx="0" fill="currentColor" />
    <rect x="16" y="6" width="3" height="11" rx="0" fill="currentColor" />
  </>,
);

export const NavDetails = createIcon(
  "nav-details",
  <>
    <path d="M5 2 H14 L20 8 V22 H5 Z M14 2 V8 H20" />
    <path d="M9 12 L16 12" />
    <path d="M9 16 L16 16" />
    <path d="M9 20 L14 20" />
  </>,
);

export const NavEvidence = createIcon(
  "nav-evidence",
  <>
    <path d="M3 9 V6 H10 L12 9 H21 V20 H3Z" />
    <path d="M8 9 V3 H17 V9 M11 5 H14" />
    <path d="M6 13 H18" />
  </>,
);

export const NavLogout = createIcon(
  "nav-logout",
  <>
    <path d="M10 3 H4 V21 H10 M13 8 L18 12 L13 16 M18 12 H8" />
  </>,
);

export const NavMenu = createIcon(
  "nav-menu",
  <>
    <path d="M4 6 L20 6" />
    <path d="M4 12 L20 12" />
    <path d="M4 18 L20 18" />
  </>,
);

export const NavObservations = createIcon(
  "nav-observations",
  <>
    <rect x="2" y="7" width="16" height="12" rx="2" />
    <path d="M6 7 L8 4 H12 L14 7" />
    <circle cx="10" cy="13" r="3" />
    <path d="M18 2 Q22 2 22 6 Q22 8.3 20 10 Q18 8.3 18 6 Q18 2 20 2Z" />
    <circle cx="20" cy="5.5" r="0.6" fill="currentColor" />
  </>,
);

export const NavOrganizations = createIcon(
  "nav-organizations",
  <>
    <rect x="3" y="3" width="13" height="18" rx="1" />
    <path d="M7 7 L9 7" />
    <path d="M12 7 L12.5 7" />
    <path d="M7 10 L8.4 10" />
    <path d="M11 10 L12.5 10" />
    <path d="M7 13 L8.4 13" />
    <path d="M11 13 L12.5 13" />
    <path d="M7 16 L8.4 16" />
    <path d="M11 16 L12.5 16" />
    <circle cx="18.2" cy="16.6" r="2" />
    <path d="M14.8 22 Q15.0 19 18.2 19 Q21.5 19 22 22" />
  </>,
);

export const NavOverview = createIcon(
  "nav-overview",
  <>
    <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
  </>,
);

export const NavPanel = createIcon(
  "nav-panel",
  <>
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
    <rect x="9" y="2" width="6" height="3" rx="1" />
    <rect x="9" y="19" width="6" height="3" rx="1" />
    <path d="M4 7 L6.5 8.5 M20 7 L17.5 8.5 M4 17 L6.5 15.5 M20 17 L17.5 15.5" />
  </>,
);

export const NavParameters = createIcon(
  "nav-parameters",
  <>
    <path d="M3 5 H5 M11 5 H21" />
    <circle cx="8" cy="5" r="2" />
    <path d="M3 12 H13 M19 12 H21" />
    <circle cx="16" cy="12" r="2" />
    <path d="M3 19 H8 M14 19 H21" />
    <circle cx="11" cy="19" r="2" />
  </>,
);

export const NavParticipation = createIcon(
  "nav-participation",
  <>
    <path d="M3 20 L3 11 L9 15 L15 8 L21 5" />
    <circle cx="3" cy="11" r="1" />
    <circle cx="9" cy="15" r="1" />
    <circle cx="15" cy="8" r="1" />
    <circle cx="21" cy="5" r="1.1" />
    <circle cx="19.6" cy="2.4" r="1.2" />
    <path d="M17.2 8 Q17.2 5.8 19.6 5.8" />
  </>,
);

export const NavPhaseDataCollection = createIcon(
  "nav-phase-data-collection",
  <>
    <path d="M3 15 V20 H21 V15 L18 15 L17 18 H7 L6 15Z" />
    <path d="M12 3 L12 14" />
    <path d="M8.5 10.5 L12 14 L15.5 10.5" />
    <circle cx="5.5" cy="5" r="0.7" fill="currentColor" />
    <circle cx="9" cy="5" r="0.7" fill="currentColor" />
    <circle cx="19" cy="5" r="0.7" fill="currentColor" />
  </>,
);

export const NavPhasePreparation = createIcon(
  "nav-phase-preparation",
  <>
    <path d="M5 4 V19 H18 M5 4 H15 L18 7 V14 M15 4 V7 H18" />
    <path d="M8 10 L12 10" />
    <path d="M8 14 L12 14" />
    <path d="M8 18 L12 18" />
    <path d="M16 15 l4 4 M17 14 l-2 2 M20 17 l-2 2" />
  </>,
);

export const NavPhaseResults = createIcon(
  "nav-phase-results",
  <>
    <circle cx="9" cy="10" r="5" />
    <circle cx="9" cy="10" r="2" />
    <path d="M9 10 L20 4 L17 4 M20 4 V7" />
    <path d="M14 19 L17 16 L19 18 L22 14" />
  </>,
);

export const NavPhaseScoring = createIcon(
  "nav-phase-scoring",
  <>
    <path d="M12 3 V20 M7 20 H17 M3 8 H21 M4 8 L6 16 H10 L12 8 M14 8 L16 16 H20 L22 8" />
    <path d="M6 16 Q8 19 10 16 M16 16 Q18 19 20 16" />
  </>,
);

export const NavQr = createIcon(
  "nav-qr",
  <>
    <rect x="3" y="3" width="5" height="5" rx="0" />
    <rect x="4.4" y="4.4" width="2.2" height="2.2" rx="0" fill="currentColor" />
    <rect x="16" y="3" width="5" height="5" rx="0" />
    <rect x="17.4" y="4.4" width="2.2" height="2.2" rx="0" fill="currentColor" />
    <rect x="3" y="16" width="5" height="5" rx="0" />
    <rect x="4.4" y="17.4" width="2.2" height="2.2" rx="0" fill="currentColor" />
    <circle cx="12" cy="4" r="0.85" fill="currentColor" />
    <circle cx="12" cy="9" r="0.85" fill="currentColor" />
    <circle cx="9" cy="12" r="0.85" fill="currentColor" />
    <circle cx="14" cy="13" r="0.85" fill="currentColor" />
    <circle cx="18" cy="12" r="0.85" fill="currentColor" />
    <circle cx="20" cy="17" r="0.85" fill="currentColor" />
    <circle cx="14" cy="19" r="0.85" fill="currentColor" />
    <circle cx="19" cy="21" r="0.85" fill="currentColor" />
    <circle cx="11" cy="21" r="0.85" fill="currentColor" />
    <circle cx="8" cy="17" r="0.85" fill="currentColor" />
  </>,
);

export const NavReport = createIcon(
  "nav-report",
  <>
    <path d="M5 2 H14 L20 8 V22 H5Z M14 2 V8 H20" />
    <rect x="8" y="12" width="2" height="4" rx="0" fill="currentColor" />
    <rect x="11" y="10" width="2" height="6" rx="0" fill="currentColor" />
    <rect x="14" y="8" width="2" height="8" rx="0" fill="currentColor" />
    <path d="M8 19 Q11 17.5 13 19 Q15 20 18 18" />
  </>,
);

export const NavRespondents = createIcon(
  "nav-respondents",
  <>
    <path d="M2.3 9 Q2.5 5 5 5 Q7.5 5 7.7 9Z" />
    <circle cx="5" cy="11" r="2.3" />
    <path d="M9.3 9 Q9.5 5 12 5 Q14.5 5 14.7 9Z" />
    <circle cx="12" cy="11" r="2.3" />
    <path d="M16.3 9 Q16.5 5 19 5 Q21.5 5 21.7 9Z" />
    <circle cx="19" cy="11" r="2.3" />
    <path d="M1.5 20 Q2 15.5 5 15.5 Q8 15.5 8.5 20 M8 21 Q8 15.3 12 15.3 Q16 15.3 16 21 M15.5 20 Q16 15.5 19 15.5 Q22 15.5 22.5 20" />
  </>,
);

export const NavRetention = createIcon(
  "nav-retention",
  <>
    <rect x="2" y="5" width="16" height="14" rx="2" />
    <path d="M2 8 H18 M6 5 V3 H13 V5 M6 12 H12" />
    <path d="M18 13 L22 13 M18.5 13.5 L21.5 16 M21.5 13.5 L18.5 16 M18.5 16.5 H21.5" />
  </>,
);

export const NavSampling = createIcon(
  "nav-sampling",
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="7.2" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16.16" cy="9.6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16.16" cy="14.4" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="16.8" r="1.1" strokeWidth="1.2" />
    <circle cx="7.84" cy="14.4" r="1.1" strokeWidth="1.2" />
    <circle cx="7.84" cy="9.6" r="1.1" strokeWidth="1.2" />
  </>,
);

export const NavScoring = createIcon(
  "nav-scoring",
  <>
    <path d="M4 4 H15 V20 H4Z" />
    <path d="M7 9 L8 10 L10 8 M7 14 L8 15 L10 13 M11 10 H13" />
    <path d="M19 13 L20 15 L22 15.3 L20.5 17 L21 19.5 L19 18.1 L17 19.5 L17.5 17 L16 15.3 L18.1 15 Z" />
  </>,
);

export const NavSelfAssessments = createIcon(
  "nav-self-assessments",
  <>
    <circle cx="9" cy="7" r="3" />
    <path d="M3 20 V18 Q4 13.5 9 13.5 Q12.5 13.5 14.6 16" />
    <polygon points="8,12 10,12 11,16 9,18 7,16" />
    <path d="M15.8 18 L18 20 L22 15" />
  </>,
);

export const NavStrata = createIcon(
  "nav-strata",
  <>
    <polygon points="12,3 21,7 12,11 3,7" />
    <polygon points="3,11 12,15 21,11 21,14 12,18 3,14" />
    <path d="M3 18 L12 22 L21 18" />
  </>,
);

export const NavTeam = createIcon(
  "nav-team",
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20 V18 Q3 14 9 14 Q15 14 15 18 V20" />
    <circle cx="17" cy="8.5" r="2.5" />
    <path d="M16 14.5 Q21 14.5 21 16" />
    <circle cx="18" cy="19" r="2" />
    <path d="M17 19 L18 20 L19.5 18" />
  </>,
);

export const NavUnits = createIcon(
  "nav-units",
  <>
    <path d="M12 22 Q4 14 4 10 A8 8 0 1 1 20 10 Q20 14 12 22Z" />
    <rect x="9" y="7" width="6" height="8" rx="1" />
    <path d="M12 8 L12 14" />
  </>,
);

export const NavValidation = createIcon(
  "nav-validation",
  <>
    <path d="M3 5 H15 Q17 5 17 7 V14 Q17 16 15 16 H8 L4 19 V16 Q3 15 3 13Z" />
    <path d="M10 18 H18 L21 21 V18 Q22 17 22 15 V11 Q22 9 19 9" />
    <circle cx="7" cy="11" r="0.65" fill="currentColor" />
    <circle cx="10" cy="11" r="0.65" fill="currentColor" />
    <circle cx="13" cy="11" r="0.65" fill="currentColor" />
  </>,
);

export const UiActivity = createIcon(
  "ui-activity",
  <>
    <path d="M2 12 H6 L9 5 L12 19 L15 9 L18 12 H22" />
  </>,
);

export const UiArrowRight = createIcon(
  "ui-arrow-right",
  <>
    <path d="M4 12 H20 M14 6 L20 12 L14 18" />
  </>,
);

export const UiCheckCircle = createIcon(
  "ui-check-circle",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M7 12 L10.5 15.5 L17.5 8.5" />
  </>,
);

export const UiCheck = createIcon(
  "ui-check",
  <>
    <path d="M4 12 L10 18 L20 6" />
  </>,
);

export const UiChevronDown = createIcon(
  "ui-chevron-down",
  <>
    <path d="M6 9 L12 15 L18 9" />
  </>,
);

export const UiCircle = createIcon(
  "ui-circle",
  <>
    <circle cx="12" cy="12" r="9" />
  </>,
);

export const UiDatabase = createIcon(
  "ui-database",
  <>
    <path d="M4 5 C4 1 20 1 20 5 V19 C20 23 4 23 4 19Z" />
    <path d="M4 5 C4 9 20 9 20 5 M4 12 C4 16 20 16 20 12" />
  </>,
);

export const UiHardDrive = createIcon(
  "ui-hard-drive",
  <>
    <rect x="2" y="5" width="20" height="14" rx="3" />
    <path d="M4 12 L20 12" />
    <circle cx="7" cy="16" r="1" fill="currentColor" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </>,
);

export const UiLogin = createIcon(
  "ui-login",
  <>
    <path d="M14 3 H21 V21 H14 M10 8 L14 12 L10 16 M14 12 H3" />
  </>,
);

export const UiPlus = createIcon(
  "ui-plus",
  <>
    <path d="M12 4 V20 M4 12 H20" />
  </>,
);

export const UiXCircle = createIcon(
  "ui-x-circle",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9 L15 15 M15 9 L9 15" />
  </>,
);
