import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as mime from "mime";
import { scanDirectory } from "./utils";

export interface S3FolderArgs {

    /**
     * Path for the s3 folder
     */
    path: string;

    /**
     * AssetMap for pulumi
     */
    assets: pulumi.Output<pulumi.asset.AssetMap>
}

/**
 * Define a component for serving a static website on S3
 */
export class S3Folder extends pulumi.ComponentResource {
    bucketName?: pulumi.Output<string>;
    websiteUrl?: pulumi.Output<string>;
    objects?: pulumi.Output<aws.s3.BucketObject[]>;

    constructor(componentName: string, args: S3FolderArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:S3Folder", componentName, {}, opts);

        const siteBucket = new aws.s3.Bucket(componentName, {
            website: {
                indexDocument: "index.html",
            },
        }, {
            parent: this
        });

        const objects = []
        const pathFilter = args.path.replace("./", "") + "/";
        for (const filePath of scanDirectory(args.path)) {
            const object = new aws.s3.BucketObject(filePath, {
                bucket: siteBucket,
                source: new pulumi.asset.FileAsset(filePath),
                key: filePath.replace(pathFilter, ""),
                contentType: mime.getType(filePath) || undefined,
            }, {
                parent: this
            });
            objects.push(object);
        }
        this.objects = pulumi.output(objects);

        const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
            bucket: siteBucket.bucket,
            policy: siteBucket.bucket.apply(this.publicReadPolicyForBucket),
        }, {
            parent: this
        });
        this.bucketName = siteBucket.bucket;
        this.websiteUrl = siteBucket.websiteEndpoint;
        
        this.registerOutputs({
            bucketName: this.bucketName,
            websiteUrl: this.websiteUrl,
            objects: this.objects,
        });
    }

    publicReadPolicyForBucket(bucketName: string) {
        return JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: "*",
                Action: [
                    "s3:GetObject"
                ],
                Resource: [
                    `arn:aws:s3:::${bucketName}/*`
                ]
            }]
        });
    }
}
