import { BadRequestException } from '@nestjs/common';
import { record } from './ai-request';

const number = (value: unknown, name: string, positive = false): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (positive && value <= 0)
  )
    throw new BadRequestException(
      `${name} must be ${positive ? 'a positive' : 'a finite'} number in SI units.`,
    );
  return value;
};

export const calculate = (input: unknown) => {
  const args = record(input);
  if (args.operation === 'ohms_law') {
    const supplied = ['voltageV', 'currentA', 'resistanceOhms'].filter(
      (key) => args[key] !== undefined,
    );
    if (supplied.length !== 2)
      throw new BadRequestException(
        'Provide exactly two of voltageV, currentA and resistanceOhms.',
      );
    let voltage =
      args.voltageV === undefined
        ? undefined
        : number(args.voltageV, 'Voltage');
    let current =
      args.currentA === undefined
        ? undefined
        : number(args.currentA, 'Current');
    let resistance =
      args.resistanceOhms === undefined
        ? undefined
        : number(args.resistanceOhms, 'Resistance', true);
    if (voltage === undefined) voltage = current! * resistance!;
    else if (current === undefined) current = voltage / resistance!;
    else {
      if (current === 0)
        throw new BadRequestException(
          'Cannot infer resistance from zero current.',
        );
      resistance = voltage / current;
      number(resistance, 'Calculated resistance', true);
    }
    const result = {
      voltageV: voltage,
      currentA: current!,
      resistanceOhms: resistance!,
      powerW: voltage * current!,
    };
    if (Object.values(result).some((value) => !Number.isFinite(value)))
      throw new BadRequestException(
        'Calculation exceeds the supported numeric range.',
      );
    return {
      formula: 'V = I × R; P = V × I',
      assumptions: 'Ideal ohmic component. Values in volts, amperes and ohms.',
      ...result,
    };
  }
  if (
    args.operation === 'series_resistance' ||
    args.operation === 'parallel_resistance'
  ) {
    if (
      !Array.isArray(args.resistancesOhms) ||
      args.resistancesOhms.length < 1 ||
      args.resistancesOhms.length > 50
    )
      throw new BadRequestException('Provide 1 to 50 resistances in ohms.');
    const values = args.resistancesOhms.map((value: unknown) =>
      number(value, 'Resistance', true),
    );
    const minimum = Math.min(...values);
    const result =
      args.operation === 'series_resistance'
        ? values.reduce((sum, value) => sum + value, 0)
        : minimum / values.reduce((sum, value) => sum + minimum / value, 0);
    number(result, 'Equivalent resistance', true);
    return {
      formula:
        args.operation === 'series_resistance'
          ? 'R = R1 + R2 + ...'
          : '1/R = 1/R1 + 1/R2 + ...',
      resistanceOhms: result,
      assumptions: 'Ideal resistors connected in the specified topology.',
    };
  }
  if (args.operation === 'compare_measurement') {
    const reading = number(args.reading, 'Reading');
    const minimum = number(args.minimum, 'Minimum');
    const maximum = number(args.maximum, 'Maximum');
    if (minimum > maximum)
      throw new BadRequestException('Minimum must not exceed maximum.');
    if (
      typeof args.unit !== 'string' ||
      !args.unit.trim() ||
      args.unit.length > 40
    )
      throw new BadRequestException(
        'Provide the common unit for the reading and limits.',
      );
    return {
      reading,
      minimum,
      maximum,
      unit: args.unit.trim(),
      withinTolerance: reading >= minimum && reading <= maximum,
      source:
        'Student-provided reading; not a simulated or verified measurement.',
    };
  }
  throw new BadRequestException('Unsupported calculation.');
};
