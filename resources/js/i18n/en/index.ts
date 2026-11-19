import { account } from './account';
import { core } from './core';
import { respondents } from './respondents';
import { setup } from './setup';

export const en = { ...core, ...account, ...setup, ...respondents };
