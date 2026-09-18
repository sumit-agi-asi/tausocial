import { StorageData } from './models';
import { scoreContent } from './moderation';
import { hashPassword } from './auth';

const now = new Date().toISOString();

export const seedData: StorageData = {
  users: [
    {
      id: 'u1',
      username: 'demo',
      email: 'demo@tausocial.local',
      passwordHash: hashPassword('demo1234'),
      createdAt: now
    },
    {
      id: 'u2',
      username: 'coach',
      email: 'coach@tausocial.local',
      passwordHash: hashPassword('coach1234'),
      createdAt: now
    }
  ],
  posts: [
    {
      id: 'p1',
      userId: 'u2',
      username: 'coach',
      content: 'Daily check-in: share your top accountability win today.',
      createdAt: now,
      likes: ['u1'],
      comments: [
        {
          id: 'c1',
          userId: 'u1',
          username: 'demo',
          content: 'Completed my workout and posted progress publicly.',
          createdAt: now
        }
      ],
      moderation: scoreContent('Daily check-in: share your top accountability win today.')
    }
  ]
};
