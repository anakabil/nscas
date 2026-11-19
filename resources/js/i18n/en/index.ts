import { account } from './account';
import { actionPlan } from './action-plan';
import { core } from './core';
import { fieldwork } from './fieldwork';
import { report } from './report';
import { respondents } from './respondents';
import { results } from './results';
import { scoring } from './scoring';
import { security } from './security';
import { setup } from './setup';
import { validation } from './validation';

export const en = {
    ...core,
    ...account,
    ...setup,
    ...respondents,
    ...fieldwork,
    ...validation,
    ...scoring,
    ...results,
    ...actionPlan,
    ...report,
    ...security,
};
