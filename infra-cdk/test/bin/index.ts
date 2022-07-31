import * as cdk from "@aws-cdk/core";
import { TEST as envName } from "../../lib/constants";
import {StartFileETLStack} from '../../lib/file-etl/create-start-file-etl-stack'

// Stack name prefix, based on envName
const stackPrefix = `${envName.slice(0, 1).toUpperCase()}${envName.slice(1)}`;
// check for App with context
const app = new cdk.App();

// Enviroments
// const defaultEnv = {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION,
// };

new StartFileETLStack(app, `${stackPrefix}-StartFileETLStack`, {
  environmentName: stackPrefix,
  // env: defaultEnv
})