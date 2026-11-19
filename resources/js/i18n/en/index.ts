import { account } from './account';
import { core } from './core';
import { fieldwork } from './fieldwork';
import { respondents } from './respondents';
import { setup } from './setup';
import { validation } from './validation';

export const en = { ...core, ...account, ...setup, ...respondents, ...fieldwork, ...validation };
