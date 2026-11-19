// Bentuk data yang dikirim App\Http\Presenters\AssessmentPresenter dan pengendali beranda.

export type RoleCode = 'SUPER_ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'CLIENT_ADMIN' | 'UNIT_COORDINATOR' | 'EXECUTIVE_VIEWER';

export type StageState = 'done' | 'current' | 'upcoming';

export type ModuleLink = {
    key: string;
    stage: number | null;
    href: string;
    ready: boolean;
    buildPhase: string;
};

export type StageGroup = {
    key: string;
    number: number;
    state: StageState;
    statuses: string[];
    modules: ModuleLink[];
};

export type AssessmentSummary = {
    id: string;
    name: string;
    organization: string;
    status: string;
    stage: number | null;
    closed: boolean;
    periodStart: string;
    periodEnd: string;
    targetLevel: number;
    role: RoleCode | null;
    href: string;
};

export type AssessmentMenu = AssessmentSummary & {
    roles: RoleCode[];
    stages: StageGroup[];
    roleTasks: ModuleLink[];
    crossStage: ModuleLink[];
    next: { to: string; toStage: number | null; actor: RoleCode; conditions: string[] } | null;
};

export type AccountMenuItem = {
    key: string;
    path: string;
    ready: boolean;
    buildPhase: string;
};

export type Persona = {
    primaryRole: RoleCode | null;
    roles: RoleCode[];
    organizations: string[];
};

// Progres pengukuran satu asesmen (App\Http\Presenters\ProgressPresenter).
export type ConditionCheck = { key: string; met: boolean | null; href: string | null };

export type AssessmentProgress = {
    id: string;
    stage: number | null;
    status: string;
    next: { to: string; toStage: number | null; actor: RoleCode; canTransition: boolean; conditions: ConditionCheck[] } | null;
    readiness: { met: number; checkable: number; total: number };
    planning: { items: { key: string; done: boolean; href: string }[]; done: number; total: number };
    schedule: { phase: 'notStarted' | 'running' | 'ended'; elapsed: number; daysRemaining: number; totalDays: number };
    attention: string[];
    teamSize: number;
    units: number;
    workers: number;
    surveyTarget: number | null;
    participation: {
        roster: number;
        tokens: number;
        completed: { value: number | null; suppressed: boolean };
        minCell: number;
        strataBelowMinimum: number;
        minParticipation: number;
        rateOfTarget: number | null;
    };
};

export type DashboardRow = AssessmentSummary & AssessmentProgress;

export type Dashboard = {
    updatedAt: string;
    totals: { active: number; closed: number; attention: number; ready: number; byStage: number[] };
    rows: DashboardRow[];
};
