export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);

    this.name = ConfigurationError.name;
  }
}
