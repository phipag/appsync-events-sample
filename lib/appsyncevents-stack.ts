import { Stack, type StackProps, RemovalPolicy } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  ChannelNamespace,
  Code,
  EventApi,
  LambdaInvokeType,
} from 'aws-cdk-lib/aws-appsync';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';

export class AppsynceventsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const fnName = 'AppsynceventsFn';
    const fn = new NodejsFunction(this, 'MyFunction', {
      functionName: fnName,
      logGroup: new LogGroup(this, 'MyLogGroup', {
        logGroupName: `/aws/lambda/${fnName}`,
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.ONE_DAY,
      }),
      runtime: Runtime.NODEJS_22_X,
      entry: './src/index.ts',
      handler: 'handler',
      tracing: Tracing.ACTIVE,
      bundling: {
        minify: true,
        mainFields: ['module', 'main'],
        sourceMap: true,
        format: OutputFormat.ESM,
      },
    });

    const api = new EventApi(this, 'EventApiLambda', {
      apiName: 'MyEventApi',
    });
    const lambdaDs = api.addLambdaDataSource('MyLambdaDataSource', fn, {
      name: 'MyLambdaDataSource',
      description: 'My Lambda Data Source',
    });

    const table = new TableV2(this, 'table', {
      tableName: 'event-messages',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    const ddbDs = api.addDynamoDbDataSource('ddbsource', table);

    new ChannelNamespace(this, 'MyChannelNamespace', {
      api,
      channelNamespaceName: 'foo',
      publishHandlerConfig: {
        direct: true,
        dataSource: lambdaDs,
        lambdaInvokeType: LambdaInvokeType.REQUEST_RESPONSE,
      },
      subscribeHandlerConfig: {
        direct: true,
        dataSource: lambdaDs,
        lambdaInvokeType: LambdaInvokeType.REQUEST_RESPONSE,
      },
    });

    const ddbns = new ChannelNamespace(this, 'MyDynamoDBChannelNamespace', {
      api,
      channelNamespaceName: 'bar',
      code: Code.fromInline(`import * as ddb from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

const TABLE = '${table.tableName}'

export const onPublish = {
  request(ctx) {
    const channel = ctx.info.channel.path
    const timestamp = util.time.nowISO8601()
    return ddb.batchPut({
      tables: {
        [TABLE]: ctx.events.map(({id, payload}) => ({
          channel, id, timestamp, ...payload,
        })),
      },
    })
  },
  response(ctx) {
    return ctx.result.data[TABLE].map(({ id, ...payload }) => ({ id, payload }))
  },
}

export const onSubscribe = {
  request(ctx) {
    const channel = ctx.info.channel.path
    const timestamp = util.time.nowISO8601()
    const id = util.autoId()
    return ddb.batchPut({
      tables: {
        [TABLE]: [{
          channel, id, timestamp
        }]
      },
    })
  },
  response(ctx) {
    return null
  }
}`),
      publishHandlerConfig: {
        dataSource: ddbDs,
      },
      subscribeHandlerConfig: {
        dataSource: ddbDs,
      },
    });
  }
}
