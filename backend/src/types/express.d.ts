import 'express';

declare module 'express' {
  interface Request {
    projectId?: string;
    projectRole?: string;
  }
}
