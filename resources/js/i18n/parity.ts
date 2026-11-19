import { en } from './en';
import { selfAssessmentForm as enSelfAssessment } from './en/self-assessment-form';
import { survey as enSurvey } from './en/survey';
import { id } from './id';
import { selfAssessmentForm as idSelfAssessment } from './id/self-assessment-form';
import { survey as idSurvey } from './id/survey';

// Pemeriksaan saat kompilasi (npm run types:check): kunci teks bahasa Inggris harus sama persis dengan kunci bahasa
// Indonesia, untuk konsol dan untuk kedua paket responden. Bila ada kunci yang hilang, tsc menyebut kuncinya. Berkas
// ini tidak diimpor oleh paket mana pun.

type Keys<T> = T extends string
    ? never
    : { [K in keyof T & string]: T[K] extends string ? K : K | `${K}.${Keys<T[K]>}` }[keyof T & string];
type Mismatch<A, B> = Exclude<Keys<A>, Keys<B>> | Exclude<Keys<B>, Keys<A>>;
type MustBeEmpty<T extends never> = T;

export type ConsoleParity = MustBeEmpty<Mismatch<typeof id, typeof en>>;
export type SurveyParity = MustBeEmpty<Mismatch<typeof idSurvey, typeof enSurvey>>;
export type SelfAssessmentParity = MustBeEmpty<Mismatch<typeof idSelfAssessment, typeof enSelfAssessment>>;
