export type User = {
    id: number;
    name: string;
    email: string;
    isSuperAdmin: boolean;
    twoFactorEnabled: boolean;
};

export type Auth = {
    user: User;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
