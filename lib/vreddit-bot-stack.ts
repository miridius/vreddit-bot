import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

const loadEnvOrThrow = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} environment variable not set!`);
  return value;
};

const BOT_API_TOKEN = loadEnvOrThrow('BOT_API_TOKEN');
const BOT_ERROR_CHAT_ID = loadEnvOrThrow('BOT_ERROR_CHAT_ID');
const CACHE_TABLE_NAME = loadEnvOrThrow('CACHE_TABLE_NAME');
const DOWNLOAD_TIMEOUT = process.env.DOWNLOAD_TIMEOUT || '20';
const NODE_ENV = process.env.NODE_ENV || 'production';

export class VredditBotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const handler = new lambda.DockerImageFunction(this, 'WebhookHandler', {
      code: lambda.DockerImageCode.fromImageAsset('.', {
        cmd: ['src/webhook.webhook'],
      }),
      // At 1,769 MB, a function has the equivalent of one vCPU
      memorySize: 1769,
      timeout: Duration.seconds(29),
      environment: {
        BOT_API_TOKEN,
        BOT_ERROR_CHAT_ID,
        CACHE_TABLE_NAME,
        DOWNLOAD_TIMEOUT,
        NODE_ENV,
      },
    });

    const api = new apigateway.RestApi(this, 'WebhookApi');
    api.root
      .addResource('webhook')
      .addMethod('POST', new apigateway.LambdaIntegration(handler));

    const table = new dynamodb.Table(this, 'CacheTable', {
      tableName: CACHE_TABLE_NAME,
      partitionKey: { name: 'url', type: dynamodb.AttributeType.STRING },
    });
    table.grantReadWriteData(handler);

    new CfnOutput(this, 'WebhookApiEndpoint', {
      description: 'HTTP API endpoint URL for Telegram webhook',
      value: `${api.url}webhook`,
    });
  }
}
