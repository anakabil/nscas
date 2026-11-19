import { account } from './account';
import { core } from './core';
import { respondents } from './respondents';
import { setup } from './setup';

export const id = { ...core, ...account, ...setup, ...respondents };
