import { StorageData } from './models';
import { scoreContent } from './moderation';

const now = new Date().toISOString();

export const seedData: StorageData = {
  users: [
    {
      id: 'u1',
      username: 'demo',
      email: 'demo@tausocial.local',
      passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d',
      createdAt: now
    },
    {
      id: 'u2',
      username: 'coach',
      email: 'coach@tausocial.local',
      passwordHash: '26428eec00d677c85feba1689f33c3afb546177689b38acfdbfad6c0d5ba97e6',
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
