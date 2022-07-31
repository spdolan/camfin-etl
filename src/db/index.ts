import {logger} from '../logger';
import { getAWSSecret } from '../getAWSSecret';
import { EnvironmentsStrings, Environments, GenericObject } from '../types';
/*
  pg-promise requires the esModuleInterop flag to be set = true
  more info here:
    https://stackoverflow.com/questions/66940129/import-as-pgpromise-from-pg-promise-in-pg-promise-example-causes-typescript
*/ 
import pgPromise from 'pg-promise'
const pgp = pgPromise();

const ENVIRONMENTS: EnvironmentsStrings[] = Object.values(Environments)
// TODO: include pgp typing more explicitly - see https://github.com/vitaly-t/pg-promise/tree/master/typescript
/**
 * Create a database connection for the given environment.
 *
 * @param {*} pgp - initialized pgp library, i.e. const pgp = require('pg-promise')()
 * @param {*} env
 * @returns
 */
export const getDbConnection = async (pgp: any, secretName: string) => {
  try {
    const { user, host, database, password, port, sslrootcert } = await getAWSSecret(
        secretName,
      );
  
      const pgConfig = {
        user,
        host,
        database,
        password,
        port,
        ssl: {
            sslrootcert,
            rejectUnauthorized: false,
        },
        max: 1,
        idleTimeoutMillis: 10 * 1000
      };
  
      const client = pgp(pgConfig);
      logger.info('DB connected succesfully');
      return client;
  } catch (error) {
    logger.error(`Error received within PG-PROMISE getDbConnection: ${error}`)
    return null
  }  
};

/* 
  conn = requires pg-promise initialized connection
*/
export const executeTasks = async (conn:any, queries: string[]) => {
  return await conn.task((t:any) => {
    const batch = queries.map((query) => t.none(query));
    return t.batch(batch);
  });
}

/*
  Helper function to create an Upsert query
    cs: pg Promise column set, i.e:
      const cs = new pgp.helpers.ColumnSet(
        [
            'point_loc_id',
            'decadal_state_type',
            'hazard_metric_id',
            'scenario_id',
            'decade',
            'not_in_model',
            'hazard_metric_mean',
            'batch_id',
        ],
        { table: 'decadal_states' },
    );
*/
export const upsertReplaceQuery = (data: GenericObject, cs: any, constraintText: string, skipColumns: string[]) => {
    return (
      `
        ${pgp.helpers.insert(data, cs)} 
          ON CONFLICT(${constraintText}) 
          DO UPDATE SET ${
            cs.assignColumns({
              from: 'EXCLUDED',
              skip: skipColumns,
            })
          }
      `
    );
}