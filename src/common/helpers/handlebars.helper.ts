import Handlebars from 'handlebars';

type CompileOptions<T> = {
  template: string;
  data?: T;
};

export function compile<T>({ template, data }: CompileOptions<T>): string {
  const delegate = Handlebars.compile(template);
  return delegate(data);
}
