export type GenericObject = {
  [x: string]: any;
}
export const CO_EARLIEST_RECORD_YEAR = 2000;
export const CURRENT_YEAR = 2021;


export const CONTRIBUTION = 'Contribution';
export const EXPENDITURE = 'Expenditure';
export const LOAN = 'Loan';

export const FILE_TYPES: GenericObject = {
  [CONTRIBUTION]: `${__dirname}/../data/${CONTRIBUTION.toLowerCase()}s`,
  [EXPENDITURE]: `${__dirname}/../data/${EXPENDITURE.toLowerCase()}s`,
  [LOAN]: `${__dirname}/../data/${LOAN.toLowerCase()}s`,
};

export const PROMISE_STATUS_FULFILLED = 'fulfilled';
export const PROMISE_STATUS_REJECTED = 'rejected';