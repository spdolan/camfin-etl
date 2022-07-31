import * as cdk from "@aws-cdk/core";
import { STAGE as envName } from "../../lib/constants";
import {StartFileETLStack} from '../../lib/file-etl/create-start-file-etl-stack'

// Stack name prefix, based on envName
const stackPrefix = `${envName.slice(0, 1).toUpperCase()}${envName.slice(1)}`;
// check for App with context
const app = new cdk.App();

new StartFileETLStack(app, `${stackPrefix}-StartFileETLStack`, {
  environmentName: stackPrefix,
  // env: defaultEnv
})