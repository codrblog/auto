import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
export const newTask = (task) => eventBus.emit('task', task);