import { account } from './account';
import { core } from './core';
import { setup } from './setup';

export const id = { ...core, ...account, ...setup };
