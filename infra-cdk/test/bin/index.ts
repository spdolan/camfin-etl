
import * as cdk from "@aws-cdk/core";
import { TEST as envName } from "../../lib/constants";
import {FileETLStack} from '../../lib/file-etl/create-file-etl-stack'

// Stack name prefix, based on envName
const stackPrefix = `${envName.slice(0, 1).toUpperCase()}${envName.slice(1)}`;
// check for App with context
const app = new cdk.App();
const { account, region } = app.node.tryGetContext(envName);

// Enviroments
const defaultEnv = {
    account: account || process.env.CDK_DEFAULT_ACCOUNT,
    region: region || process.env.CDK_DEFAULT_REGION,
};

const fileETLStack = new FileETLStack(app, `${stackPrefix}-FileETLStack`, {
  environmentName: stackPrefix,
  env: defaultEnv
})
