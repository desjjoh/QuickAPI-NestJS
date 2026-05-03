import { ClassConstructor } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const Match = <T>(
  _type: ClassConstructor<T>,
  property: (o: T) => unknown,
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
};

@ValidatorConstraint({ name: 'Match' })
class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [fn] = args.constraints;
    return fn(args.object) === value;
  }

  defaultMessage(args: ValidationArguments): string {
    const [constraintProperty]: Array<() => unknown> = args.constraints;
    return `${(constraintProperty + '').split('.')[1]} and ${
      args.property
    } don't match`;
  }
}

export { MatchConstraint, Match };
