import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.B2_ENDPOINT;
const region = process.env.B2_REGION;
const accessKeyId = process.env.B2_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY;

if (!endpoint) {
    throw new Error("B2_ENDPOINT is not configured");
}

if (!region) {
    throw new Error("B2_REGION is not configured");
}

if (!accessKeyId) {
    throw new Error("B2_KEY_ID is not configured");
}

if (!secretAccessKey) {
    throw new Error("B2_APPLICATION_KEY is not configured");
}

export const b2 = new S3Client({
    region,
    endpoint,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});