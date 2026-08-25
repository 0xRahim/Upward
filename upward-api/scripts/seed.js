import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { all, migrate, run } from '../src/db/database.js';

const uuid = () => crypto.randomUUID();
const hash = (pw) => bcrypt.hashSync(pw, 10);
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function insertLesson(moduleId, title, type, { durationMinutes, preview } = {}) {
  const id = uuid();
  await run(
    `INSERT INTO lessons
       (id, module_id, title, type, content_url, content, duration_minutes, position, is_previewable)
     VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM lessons WHERE module_id = ?), ?)`,
    [
      id,
      moduleId,
      title,
      type,
      type === 'video' ? `https://cdn.upward.lms/videos/${slugify(title)}.mp4` : null,
      type === 'text' ? `# ${title}\n\nLesson notes go here.` : null,
      type === 'video' ? (durationMinutes ?? 12) : null,
      moduleId,
      preview ? 1 : 0,
    ],
  );
  return id;
}

async function insertModule(courseId, title, lessons) {
  const moduleId = uuid();
  await run(
    'INSERT INTO modules (id, course_id, title, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM modules WHERE course_id = ?))',
    [moduleId, courseId, title, courseId],
  );
  const ids = [];
  for (const [title2, type, opts] of lessons) ids.push(await insertLesson(moduleId, title2, type, opts));
  return { moduleId, lessonIds: ids };
}

async function createCourse({ title, description, level, categorySlug, modules }) {
  const courseId = uuid();
  await run(
    `INSERT INTO courses (id, category_id, title, slug, description, level, is_published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [courseId, categories[categorySlug], title, slugify(title), description, level],
  );
  const moduleLessonIds = [];
  for (const [moduleTitle, lessons] of modules) {
    moduleLessonIds.push(await insertModule(courseId, moduleTitle, lessons));
  }
  courses.push({ id: courseId, title });
  return { courseId, moduleLessonIds };
}

const categories = {};
const courses = [];

async function main() {
  await migrate();

  console.log('Clearing existing data...');
  for (const table of [
    'certificates', 'review_votes', 'reviews', 'lesson_progress', 'enrollments',
    'bundle_courses', 'bundles', 'lessons', 'modules', 'courses', 'categories',
    'refresh_tokens', 'users',
  ]) {
    await run(`DELETE FROM ${table}`);
  }

  console.log('Creating users...');
  const adminId = uuid();
  const demoId = uuid();
  const saraId = uuid();
  await run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
    adminId, 'Upward Admin', 'admin@upward.lms', hash('Admin1234'), 'admin',
  ]);
  await run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
    demoId, 'Demo User', 'demo@upward.lms', hash('Demo1234'), 'user',
  ]);
  await run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
    saraId, 'Sara Khan', 'sara@upward.lms', hash('Sara1234'), 'user',
  ]);

  console.log('Creating categories...');
  for (const name of ['Web Development', 'Data Science', 'Design']) {
    const id = uuid();
    categories[slugify(name)] = id;
    await run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, name, slugify(name)]);
  }

  console.log('Creating courses...');
  const js = await createCourse({
    title: 'Intro to JavaScript',
    description:
      'A complete beginner-friendly JavaScript course covering variables, functions, the DOM and ES6+ features.',
    level: 'beginner',
    categorySlug: 'web-development',
    modules: [
      ['Getting Started', [
        ['What is JavaScript?', 'video', { durationMinutes: 10, preview: true }],
        ['Setting Up Your Environment', 'video', { durationMinutes: 14, preview: true }],
        ['Course Resources', 'text'],
      ]],
      ['Language Basics', [
        ['Variables & Types', 'video', { durationMinutes: 18 }],
        ['Functions & Scope', 'video', { durationMinutes: 22 }],
        ['Arrays & Objects', 'video', { durationMinutes: 25 }],
        ['Knowledge Check: Basics', 'quiz'],
      ]],
      ['The DOM', [
        ['Selecting Elements', 'video', { durationMinutes: 16 }],
        ['Events & Listeners', 'video', { durationMinutes: 20 }],
        ['Final Project Brief', 'text'],
      ]],
    ],
  });

  const node = await createCourse({
    title: 'Backend Development with Node.js',
    description:
      'Build production-ready REST APIs with Node.js and Express, including authentication, testing and deployment.',
    level: 'intermediate',
    categorySlug: 'web-development',
    modules: [
      ['Node Fundamentals', [
        ['The Event Loop', 'video', { durationMinutes: 15, preview: true }],
        ['Modules & npm', 'video', { durationMinutes: 17 }],
      ]],
      ['Express in Depth', [
        ['Routing & Middleware', 'video', { durationMinutes: 24 }],
        ['Error Handling Patterns', 'video', { durationMinutes: 19 }],
        ['REST Cheat Sheet', 'text'],
      ]],
    ],
  });

  await createCourse({
    title: 'Data Analysis with Python',
    description:
      'Learn pandas, matplotlib and statistics through hands-on analysis of real-world datasets.',
    level: 'beginner',
    categorySlug: 'data-science',
    modules: [
      ['Pandas Essentials', [
        ['Series & DataFrames', 'video', { durationMinutes: 20, preview: true }],
        ['Cleaning Messy Data', 'video', { durationMinutes: 26 }],
      ]],
      ['Visualization', [
        ['Plotting with Matplotlib', 'video', { durationMinutes: 21 }],
        ['Dashboard Exercise', 'text'],
      ]],
    ],
  });

  const react = await createCourse({
    title: 'Advanced React Patterns',
    description:
      'Master hooks architecture, state management strategies, rendering performance and component composition.',
    level: 'advanced',
    categorySlug: 'web-development',
    modules: [
      ['Hooks Deep Dive', [
        ['Custom Hooks that Scale', 'video', { durationMinutes: 28, preview: true }],
        ['useReducer vs useState', 'video', { durationMinutes: 23 }],
      ]],
    ],
  });

  console.log('Creating bundle...');
  const bundleId = uuid();
  await run(
    'INSERT INTO bundles (id, title, slug, description, is_published) VALUES (?, ?, ?, ?, 1)',
    [
      bundleId,
      'Fullstack Web Developer Bundle',
      'fullstack-web-developer-bundle',
      'Everything you need to become a fullstack web developer: JavaScript, Node.js and advanced React.',
    ],
  );
  for (const [i, courseId] of [js.courseId, node.courseId, react.courseId].entries()) {
    await run('INSERT INTO bundle_courses (bundle_id, course_id, position) VALUES (?, ?, ?)', [
      bundleId,
      courseId,
      i + 1,
    ]);
  }

  console.log('Creating enrollments, progress, reviews and certificates...');
  // Demo user: enrolled in Intro to JS, completed the first 2 lessons (~22%)
  const firstTwoLessons = js.moduleLessonIds[0].lessonIds.slice(0, 2);
  const demoEnrollmentId = uuid();
  await run(
    "INSERT INTO enrollments (id, user_id, course_id, bundle_id, status, last_lesson_id) VALUES (?, ?, ?, NULL, 'active', ?)",
    [demoEnrollmentId, demoId, js.courseId, firstTwoLessons.at(-1)],
  );
  for (const lessonId of firstTwoLessons) {
    await run('INSERT INTO lesson_progress (id, user_id, lesson_id) VALUES (?, ?, ?)', [
      uuid(), demoId, lessonId,
    ]);
  }

  // Sara: fully completed Intro to JS -> certificate + 5-star review
  await run(
    "INSERT INTO enrollments (id, user_id, course_id, bundle_id, status, last_lesson_id) VALUES (?, ?, ?, NULL, 'active', NULL)",
    [uuid(), saraId, js.courseId],
  );
  const allJsLessons = (
    await all(
      `SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?`,
      [js.courseId],
    )
  ).map((r) => r.id);
  for (const lessonId of allJsLessons) {
    await run('INSERT INTO lesson_progress (id, user_id, lesson_id) VALUES (?, ?, ?)', [
      uuid(), saraId, lessonId,
    ]);
  }
  await run(
    "UPDATE enrollments SET status = 'completed', completed_at = ? WHERE user_id = ? AND course_id = ?",
    [new Date().toISOString(), saraId, js.courseId],
  );
  await run('INSERT INTO certificates (id, user_id, course_id) VALUES (?, ?, ?)', [
    `cert-${uuid()}`, saraId, js.courseId,
  ]);

  // Demo user also enrolled via the bundle into Node + React
  for (const courseId of [node.courseId, react.courseId]) {
    await run(
      "INSERT INTO enrollments (id, user_id, course_id, bundle_id, status) VALUES (?, ?, ?, ?, 'active')",
      [uuid(), demoId, courseId, bundleId],
    );
  }

  const review1 = uuid();
  await run(
    'INSERT INTO reviews (id, course_id, user_id, rating, comment, helpful_votes) VALUES (?, ?, ?, ?, ?, ?)',
    [review1, js.courseId, saraId, 5, 'Fantastic explanations and exercises.', 1],
  );
  const review2 = uuid();
  await run(
    'INSERT INTO reviews (id, course_id, user_id, rating, comment, helpful_votes) VALUES (?, ?, ?, ?, ?, ?)',
    [review2, js.courseId, demoId, 4, 'Very clear intro. The DOM section could be longer.', 0],
  );
  await run('INSERT INTO review_votes (review_id, user_id) VALUES (?, ?)', [review1, demoId]);

  // Denormalized aggregates
  await run(`
    UPDATE courses SET
      rating = COALESCE(ROUND((SELECT AVG(rating) FROM reviews WHERE reviews.course_id = courses.id) * 10) / 10.0, 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE reviews.course_id = courses.id),
      student_count = (SELECT COUNT(DISTINCT user_id) FROM enrollments WHERE enrollments.course_id = courses.id)
  `);

  console.log('\nSeed complete');
  console.log('---------------------------------------------');
  console.log('Admin : admin@upward.lms / Admin1234');
  console.log('User  : demo@upward.lms  / Demo1234');
  console.log('User  : sara@upward.lms  / Sara1234');
  console.log('---------------------------------------------');

  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
