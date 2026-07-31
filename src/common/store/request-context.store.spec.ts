import { RequestContext } from './request-context.store';

describe(RequestContext.name, () => {
  it('isolates concurrent asynchronous contexts', async () => {
    const context = new RequestContext();
    const observe = (requestId: string, actorId: string, delay: number) =>
      context.run({ requestId, actorId, source: 'service' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return context.getStore();
      });

    await expect(
      Promise.all([
        observe('one', 'actor-one', 10),
        observe('two', 'actor-two', 1),
      ]),
    ).resolves.toEqual([
      { requestId: 'one', actorId: 'actor-one', source: 'service' },
      { requestId: 'two', actorId: 'actor-two', source: 'service' },
    ]);
  });

  it.each(['queue', 'scheduled_job', 'seed', 'service', 'system'] as const)(
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
