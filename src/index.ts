import { Logger, LogLevel } from '@aws-lambda-powertools/logger';
import { AppSyncEventsResolver } from '@aws-lambda-powertools/event-handler/appsync-events';
import type { Context } from 'aws-lambda';

const logger = new Logger({
  serviceName: 'AppSyncEvents',
  logLevel: LogLevel.DEBUG,
});
const app = new AppSyncEventsResolver({ logger });

app.onPublish('/foo/*', (payload, event) => {
  logger.debug('processing', { channel: event.info.channel.path, payload });
  return {
    processed: true,
    original_payload: payload,
  };
});

app.onSubscribe('/foo/*', (event) => {
  logger.debug('New subscription', { channel: event.info.channel.path });
});

export const handler = async (event: unknown, context: Context) =>
  app.resolve(event, context);
