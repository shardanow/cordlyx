import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  createProjectSchema,
  updateProjectSchema,
  createItemSchema,
  updateItemSchema,
  createCommentSchema,
  updateCommentSchema,
  createTagSchema,
  addMemberSchema,
  updateMemberSchema,
  createRelationSchema,
  createItemTypeSchema,
  createItemStatusSchema,
  createItemPrioritySchema,
  searchSchema,
} from './index.js';

describe('registerSchema', () => {
  it('should accept valid input', () => {
    const result = registerSchema.parse({ username: 'testuser', email: 'test@test.com', password: 'password123', name: 'Test' });
    expect(result.email).toBe('test@test.com');
    expect(result.username).toBe('testuser');
  });

  it('should reject invalid email', () => {
    expect(() => registerSchema.parse({ username: 'u', email: 'bad', password: 'password123', name: 'Test' })).toThrow();
  });

  it('should reject short password', () => {
    expect(() => registerSchema.parse({ username: 'u', email: 'test@test.com', password: '123', name: 'Test' })).toThrow();
  });

  it('should reject missing name', () => {
    expect(() => registerSchema.parse({ username: 'u', email: 'test@test.com', password: 'password123' })).toThrow();
  });

  it('should reject invalid username characters', () => {
    expect(() => registerSchema.parse({ username: 'bad user!', email: 'test@test.com', password: 'password123', name: 'Test' })).toThrow();
  });
});

describe('loginSchema', () => {
  it('should accept username login', () => {
    const result = loginSchema.parse({ login: 'alice', password: 'password123' });
    expect(result.login).toBe('alice');
  });

  it('should accept email login', () => {
    const result = loginSchema.parse({ login: 'test@test.com', password: 'password123' });
    expect(result.login).toBe('test@test.com');
  });

  it('should reject missing password', () => {
    expect(() => loginSchema.parse({ login: 'alice' })).toThrow();
  });
});

describe('refreshSchema', () => {
  it('should accept valid token', () => {
    const result = refreshSchema.parse({ refreshToken: 'some-token' });
    expect(result.refreshToken).toBe('some-token');
  });

  it('should reject missing token', () => {
    expect(() => refreshSchema.parse({})).toThrow();
  });
});

describe('createProjectSchema', () => {
  it('should accept valid input', () => {
    const result = createProjectSchema.parse({ name: 'My Project', slug: 'my-project' });
    expect(result.name).toBe('My Project');
  });

  it('should reject empty name', () => {
    expect(() => createProjectSchema.parse({ name: '', slug: 'my-project' })).toThrow();
  });
});

describe('createItemSchema', () => {
  it('should accept valid input', () => {
    const result = createItemSchema.parse({ title: 'Test', typeId: '00000000-0000-0000-0000-000000000001' });
    expect(result.title).toBe('Test');
  });

  it('should reject missing title', () => {
    expect(() => createItemSchema.parse({ typeId: '00000000-0000-0000-0000-000000000001' })).toThrow();
  });
});

describe('updateItemSchema', () => {
  it('should accept partial update', () => {
    const result = updateItemSchema.parse({ title: 'Updated' });
    expect(result.title).toBe('Updated');
  });

  it('should accept statusId only', () => {
    const result = updateItemSchema.parse({ statusId: '00000000-0000-0000-0000-000000000001' });
    expect(result.statusId).toBe('00000000-0000-0000-0000-000000000001');
  });
});

describe('createCommentSchema', () => {
  it('should accept valid input', () => {
    const result = createCommentSchema.parse({ body: 'Nice work!' });
    expect(result.body).toBe('Nice work!');
  });

  it('should reject empty body', () => {
    expect(() => createCommentSchema.parse({ body: '' })).toThrow();
  });
});

describe('updateCommentSchema', () => {
  it('should accept valid input', () => {
    const result = updateCommentSchema.parse({ body: 'Updated' });
    expect(result.body).toBe('Updated');
  });
});

describe('createTagSchema', () => {
  it('should accept valid input', () => {
    const result = createTagSchema.parse({ name: 'bug' });
    expect(result.name).toBe('bug');
  });

  it('should accept optional color', () => {
    const result = createTagSchema.parse({ name: 'feature', color: '#ff0000' });
    expect(result.color).toBe('#ff0000');
  });
});

describe('addMemberSchema', () => {
  it('should accept valid input', () => {
    const result = addMemberSchema.parse({ userId: '00000000-0000-0000-0000-000000000001', email: 'user@test.com', role: 'member' });
    expect(result.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.email).toBe('user@test.com');
  });

  it('should reject invalid role', () => {
    expect(() => addMemberSchema.parse({ userId: '00000000-0000-0000-0000-000000000001', email: 'user@test.com', role: 'superadmin' })).toThrow();
  });
});

describe('updateMemberSchema', () => {
  it('should accept valid role', () => {
    const result = updateMemberSchema.parse({ role: 'admin' });
    expect(result.role).toBe('admin');
  });
});

describe('createRelationSchema', () => {
  it('should accept valid input', () => {
    const result = createRelationSchema.parse({
      sourceItemId: '00000000-0000-0000-0000-000000000001', targetItemId: '00000000-0000-0000-0000-000000000002', relationType: 'blocks',
    });
    expect(result.relationType).toBe('blocks');
  });

  it('should reject invalid relation type', () => {
    expect(() => createRelationSchema.parse({
      sourceItemId: 'a', targetItemId: 'b', relationType: 'invalid',
    })).toThrow();
  });
});

describe('createItemTypeSchema', () => {
  it('should accept valid input', () => {
    const result = createItemTypeSchema.parse({ name: 'Story', color: '#ff0000' });
    expect(result.name).toBe('Story');
  });

  it('should reject missing color', () => {
    expect(() => createItemTypeSchema.parse({ name: 'Story' })).toThrow();
  });
});

describe('createItemStatusSchema', () => {
  it('should accept valid input', () => {
    const result = createItemStatusSchema.parse({ name: 'In Review', color: '#ff00ff', category: 'active' });
    expect(result.name).toBe('In Review');
  });

  it('should reject invalid category', () => {
    expect(() => createItemStatusSchema.parse({ name: 'X', color: '#ffffff', category: 'invalid' })).toThrow();
  });
});

describe('createItemPrioritySchema', () => {
  it('should accept valid input', () => {
    const result = createItemPrioritySchema.parse({ name: 'High', color: '#ff0000' });
    expect(result.name).toBe('High');
  });
});

describe('searchSchema', () => {
  it('should accept valid query', () => {
    const result = searchSchema.parse({ q: 'search term' });
    expect(result.q).toBe('search term');
  });

  it('should reject empty query', () => {
    expect(() => searchSchema.parse({ q: '' })).toThrow();
  });

  it('should accept optional cursor', () => {
    const result = searchSchema.parse({ q: 'term', cursor: 'abc' });
    expect(result.cursor).toBe('abc');
  });
});
