import { EventEmitter } from 'events';

// In Next.js, we use a global variable to ensure the EventEmitter 
// instance persists across hot reloads in development.
const globalForEvents = global;

/** @type {EventEmitter} */
export const eventBus = globalForEvents.eventBus || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
    globalForEvents.eventBus = eventBus;
}
