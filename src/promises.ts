import { PROMISE_STATUS_FULFILLED, PROMISE_STATUS_REJECTED } from './constants';

export const filterForFulfilled = (promise: any) => promise.status === PROMISE_STATUS_FULFILLED;
export const filterForRejected = (promise: any) => promise.status === PROMISE_STATUS_REJECTED;