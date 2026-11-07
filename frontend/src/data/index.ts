import apiSource from './api';
import { mockSource } from './mock';
import type { BusDataSource } from './types';

const base = import.meta.env.VITE_API_BASE;
const forceMock = new URLSearchParams(window.location.search).get('mock') === '1';

/** Uses the backend when VITE_API_BASE is set, otherwise mock data. `?mock=1` forces mock. */
export const source: BusDataSource = base && !forceMock ? apiSource(base) : mockSource;

export * from './types';
