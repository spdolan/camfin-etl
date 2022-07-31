import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";

interface BucketsProps extends cdk.StackProps {
    envName: string;
    bucketName: string;
}

export class CreateS3Bucket extends cdk.Stack {
    public readonly bucket: s3.Bucket
    constructor(scope: cdk.Construct, id: string, props: BucketsProps) {
        super(scope, id, props);


        this.bucket = new s3.Bucket(this,  "MyBucket", {
            bucketName: props?.bucketName,
            autoDeleteObjects: false,
            versioned: false,
            publicReadAccess: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

    }
}
