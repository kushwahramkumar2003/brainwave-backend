export {};

declare global {
  namespace Express {
    export interface Request {
      userId?: string;
      cookie?: {
        token?: string;
      };
    }
  }
}
