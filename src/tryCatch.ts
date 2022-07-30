export const tryCatch = (tryer: () => any) => {
  try {
    const result = tryer();
    return [result, null];
  } catch (error) {
    return [null, error];
  }
};

export const asyncTryCatch = async (tryFunction: any) => {
  try {
    const result = await tryFunction;
    return [result, null];
  } catch (error) {
    return [null, error];
  }
};

/* 
  Note on using asyncTryCatch with Promise.allSettled():
  
  We are no longer leveraging the expected signature from an
  Error response, so all Promises show as fulfilled, e.g.

  const values = await Promise.allSettled([
    asyncTryCatch(Promise.resolve(33)),
    asyncTryCatch(new Promise(resolve => setTimeout(() => resolve(66), 0))),
    asyncTryCatch(99),
    asyncTryCatch(Promise.reject(new Error('an error')))
  ])

  values will equal:

  [
    {status: "fulfilled", value: [33, null]},
    {status: "fulfilled", value: [66, null]},
    {status: "fulfilled", value: [99, null]},
    {status: "fulfilled",  value: [null, Error: an error]}
  ]
*/
