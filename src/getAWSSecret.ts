import {SecretsManager, GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import { asyncTryCatch } from './tryCatch'
/**
 * Fetch a Secret from the AWS secrets manager.
 * @param secretName
 * @returns {*}
 */
export const getAWSSecret = async (secretName: string) => {

    // Create a Secrets Manager client
    const client = new SecretsManager({
        region: process.env.AWS_REGION
    });
    const params = {
        /** input parameters */
        SecretId: secretName
    };
    const command = new GetSecretValueCommand(params);

    const [secret, error] = await asyncTryCatch(client.send(command))
    /* 
        if SecretBinary is expected, could use something like:
        const secretValue = SecretString || Buffer(SecretBinary, 'base64').toString('ascii') // though TS didn't like Buffer use.
        return secretValue
    */
    if (error) {
      console.log('executed AWS secrets with error', error);
      throw new Error(error)
    }
  
    const {SecretString} = secret

    const parsedSecret = JSON.parse(SecretString);

    return parsedSecret
}