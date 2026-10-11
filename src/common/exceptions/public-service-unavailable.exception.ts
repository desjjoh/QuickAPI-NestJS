import { ServiceUnavailableException } from '@nestjs/common';

/** Use only fixed, reviewed public messages; never pass through provider errors. */
export class PublicServiceUnavailableException extends ServiceUnavailableException {}
