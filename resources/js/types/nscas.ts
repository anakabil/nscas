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
