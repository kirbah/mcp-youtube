import { jest } from "@jest/globals";

/**
 * Casts a mocked class or object to its Jest Mocked type.
 * This is useful when you've used `jest.mock` on a class and need to
 * interact with its mocked instance methods with proper TypeScript types.
 *
 * @template T The type of the class or object being mocked.
 * @param {T} classOrObject The class or object to cast.
 * @returns {jest.Mocked<T>} The mocked version of the class or object.
 */
export const mocked = <T extends object>(classOrObject: T): jest.Mocked<T> => {
  return classOrObject as jest.Mocked<T>;
};

/**
 * Casts a mocked module to its Jest Mocked type.
 * This is useful when you've used `jest.mock('module-path')` and need to
 * interact with its exports as mocked functions with proper TypeScript types.
 *
 * @template T The type of the module being mocked.
 * @param {T} module The module to cast.
 * @returns {jest.Mocked<T>} The mocked version of the module.
 */
export const mockedModule = <T extends object>(module: T): jest.Mocked<T> => {
  return module as jest.Mocked<T>;
};
