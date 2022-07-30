import * as cdk from "@aws-cdk/core";
import { TEST as envName } from "../../lib/constants";
// Stack name prefix, based on envName
const stackPrefix = `${envName.slice(0, 1).toUpperCase()}${envName.slice(1)}`;
// App
const app = new cdk.App();
const { account, region } = app.node.tryGetContext(envName);

// Enviroments
const defaultEnv = {
    account: account || process.env.CDK_DEFAULT_ACCOUNT,
    region: region || process.env.CDK_DEFAULT_REGION,
};

// Stacks

// 
