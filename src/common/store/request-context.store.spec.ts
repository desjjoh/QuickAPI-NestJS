import { RequestContext } from './request-context.store';

describe(RequestContext.name, () => {
  it('isolates concurrent asynchronous contexts', async () => {
    const context = new RequestContext();
    const observe = (requestId: string, delay: number) =>
      context.run({ requestId, source: 'system' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return context.get('requestId');
      });

    await expect(
      Promise.all([observe('one', 10), observe('two', 1)]),
    ).resolves.toEqual(['one', 'two']);
  });

  it.each(['queue', 'scheduled_job', 'seed', 'system'] as const)(
    'runs %s work in an explicit non-HTTP context',
    async (source) => {
      const context = new RequestContext();
      const store = await context.runNonHttp(
        { requestId: `work-${source}`, source },
        async () => context.getStore(),
      );

      expect(store).toEqual({
        requestId: `work-${source}`,
        source,
        actorType: 'system',
      });
      expect(context.getStore()).toBeUndefined();
    },
  );
});
