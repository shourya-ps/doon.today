import type { EventRecord } from '../types/event';
import rawEvents from '../../data/events.json';
export const events = rawEvents as EventRecord[];
