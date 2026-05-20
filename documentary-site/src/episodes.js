import ep01 from './episodes/episode-01-the-problem-nobody-talks-about.md?raw'
import ep02 from './episodes/episode-02-designing-before-building.md?raw'
import ep03 from './episodes/episode-03-four-apis-four-battles.md?raw'
import ep04 from './episodes/episode-04-turning-raw-data-into-intelligence.md?raw'
import ep05 from './episodes/episode-05-the-bugs-that-hit-harder.md?raw'
import ep06 from './episodes/episode-06-the-face-of-risk.md?raw'
import ep07 from './episodes/episode-07-shipping-and-what-broke.md?raw'
import ep08 from './episodes/episode-08-looking-back-at-the-journey.md?raw'

export const EPISODES = [
  {
    id: 1,
    title: 'The Problem Nobody Talks About',
    hook: 'Every company depends on packages maintained by a stranger with no SLA. Nobody asks who that stranger is.',
    readTime: '5 min read',
    content: ep01,
  },
  {
    id: 2,
    title: 'Designing Before Building',
    hook: 'The biggest mistake engineers make — opening a code editor before asking "what am I actually building?"',
    readTime: '7 min read',
    content: ep02,
  },
  {
    id: 3,
    title: 'Four APIs, Four Battles',
    hook: 'Every data source had a hidden trap. None of them advertised it in the documentation.',
    readTime: '8 min read',
    content: ep03,
  },
  {
    id: 4,
    title: 'Turning Raw Data into Intelligence',
    hook: 'Data is not information. Information requires structure. Structure requires decisions.',
    readTime: '7 min read',
    content: ep04,
  },
  {
    id: 5,
    title: 'The Bugs That Hit Harder',
    hook: 'A passing pipeline and a working system are not the same thing. These are the ones that stayed silent.',
    readTime: '7 min read',
    content: ep05,
  },
  {
    id: 6,
    title: 'The Face of Risk',
    hook: 'You can build the most accurate risk model in the world. If nobody can read it, you built nothing.',
    readTime: '7 min read',
    content: ep06,
  },
  {
    id: 7,
    title: 'Shipping and What Broke',
    hook: '"It\'s deployed" is not the same as "it\'s working." Here is everything that broke between those two states.',
    readTime: '8 min read',
    content: ep07,
  },
  {
    id: 8,
    title: 'Looking Back at the Journey',
    hook: 'The honest accounting — what held up, what I would change, and what DESK proved about building alone.',
    readTime: '6 min read',
    content: ep08,
  },
]
