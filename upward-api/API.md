# Upward API Documentation

**Base URL:** `http://localhost:3000/v1`

Upward is a free learning platform API. Two user roles exist:

| Role | Capabilities |
| --- | --- |
| **Admin** | Create and manage courses, modules, lessons, bundles, categories, and users |
| **User** | Browse content, enroll in courses/bundles, track learning progress, leave reviews |

All content on Upward is free — enrollment is instant and no payment flow exists.

---

## Table of Contents

1. [General Conventions](#general-conventions)
2. [Authentication](#authentication)
3. [Users](#users)
4. [Courses](#courses)
5. [Modules & Lessons](#modules--lessons)
6. [Bundles](#bundles)
7. [Categories](#categories)
8. [Enrollment](#enrollment)
9. [Progress Tracking](#progress-tracking)
10. [Reviews & Ratings](#reviews--ratings)
11. [Search](#search)
12. [Error Handling](#error-handling)
13. [Pagination](#pagination)
14. [Rate Limiting](#rate-limiting)

---

## General Conventions

### Request Format

- Request and response bodies are **JSON** (`Content-Type: application/json`).
- Dates are ISO 8601 UTC strings: `2026-08-22T10:30:00Z`.
- IDs are UUIDs: `"9b2f4c3e-1a5d-4e8f-b6c0-7d2e9a1f3b45"`.

### Authentication Header

Protected endpoints require a Bearer token:

```http
Authorization: Bearer <access_token>
```

### Common Response Envelope

Successful responses return the resource directly (or a `data` wrapper on lists):

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 143,
    "totalPages": 8
  }
}
```

### Standard Status Codes

| Code | Meaning |
| --- | --- |
| `200 OK` | Success |
| `201 Created` | Resource created |
| `204 No Content` | Success with no body |
| `400 Bad Request` | Validation error |
| `401 Unauthorized` | Missing/expired token or bad credentials |
| `403 Forbidden` | Insufficient permissions / not enrolled |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Duplicate resource / invalid state |
| `422 Unprocessable Entity` | Semantically invalid request |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Server error |

---

## Authentication

All auth endpoints are under `/auth`. Access tokens expire in **15 minutes**; refresh tokens expire in **7 days**.

### Register User

Creates a new user account with the `user` role. The account is active immediately.

```
POST /auth/register
```

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `name` | string | Yes | 2–80 chars |
| `email` | string | Yes | Valid email, unique |
| `password` | string | Yes | Min 8 chars, 1 uppercase, 1 number |

```json
{
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "password": "Secret123"
}
```

**Response — `201 Created`**

```json
{
  "id": "9b2f4c3e-...",
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "role": "user",
  "createdAt": "2026-08-22T10:30:00Z"
}
```

**Errors:** `409 Conflict` if the email is already registered.

> There is no email verification or password reset. A user who forgets their password must register again with a different email.

---

### Login

Returns an access token and refresh token.

```
POST /auth/login
```

**Request body**

```json
{
  "email": "rahim@example.com",
  "password": "Secret123"
}
```

**Response — `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "d8f0a1c2...",
  "expiresIn": 900,
  "user": {
    "id": "9b2f4c3e-...",
    "name": "Rahim Ahmed",
    "email": "rahim@example.com",
    "role": "user"
  }
}
```

**Errors**

| Code | Reason |
| --- | --- |
| `401` | Invalid credentials |
| `403` | Account deactivated |

---

### Refresh Token

Rotates the refresh token; the old one becomes invalid.

```
POST /auth/refresh
```

**Request body**

```json
{ "refreshToken": "d8f0a1c2..." }
```

**Response — `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "new-refresh-token",
  "expiresIn": 900
}
```

**Errors:** `401` if the token is invalid, expired, or already used.

---

### Logout

Invalidates the provided refresh token (must belong to the authenticated user).

```
POST /auth/logout
🔒 Requires authentication
```

**Request body**

```json
{ "refreshToken": "d8f0a1c2..." }
```

**Response — `204 No Content`**

---

## Users

### Get Current User

```
GET /users/me
🔒 Requires authentication
```

**Response — `200 OK`**

```json
{
  "id": "9b2f4c3e-...",
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "role": "user",
  "avatarUrl": null,
  "isActive": true,
  "createdAt": "2026-08-22T10:30:00Z",
  "stats": {
    "enrolledCourses": 4,
    "completedCourses": 1,
    "activeBundles": 1
  }
}
```

### Update Current User

```
PATCH /users/me
🔒 Requires authentication
```

**Request body** (all fields optional)

```json
{
  "name": "Rahim A.",
  "avatarUrl": "https://cdn.example.com/avatars/rahim.png"
}
```

**Response — `200 OK`** — updated user object.

### Change Password

Revokes all existing refresh tokens.

```
POST /users/me/change-password
🔒 Requires authentication
```

```json
{ "currentPassword": "Secret123", "newPassword": "NewSecret456" }
```

**Response — `200 OK`**

```json
{ "message": "Password changed successfully" }
```

**Errors:** `400` if `currentPassword` is incorrect.

### Admin: List Users

```
GET /users?page=1&perPage=20&role=user&search=rahim
🔒 Admin only
```

**Query parameters**

| Param | Type | Description |
| --- | --- | --- |
| `page` | int | Page number (default 1) |
| `perPage` | int | Items per page (default 20, max 100) |
| `role` | string | Filter: `user` \| `admin` |
| `search` | string | Search by name or email |

**Response — `200 OK`** — paginated list of user objects.

### Admin: Update Any User

```
PATCH /users/:userId
🔒 Admin only
```

```json
{ "role": "admin", "isActive": false }
```

Deactivating a user revokes all of that user's refresh tokens.
Admins cannot change their own role or deactivate/delete themselves.

**Response — `200 OK`** — updated user object.

### Admin: Delete User

```
DELETE /users/:userId
🔒 Admin only
```

**Response — `204 No Content`**

Cascades: removes the user's enrollments, progress, reviews and certificates.

---

## Courses

A course contains ordered modules, which contain ordered lessons.

### List Courses (Public)

```
GET /courses?category=web-development&level=beginner&sort=-rating&page=1&perPage=12
🔓 Public
```

Only published courses are returned.

**Query parameters**

| Param | Type | Description |
| --- | --- | --- |
| `page`, `perPage` | int | Pagination |
| `category` | string | Category slug filter |
| `level` | string | `beginner` \| `intermediate` \| `advanced` |
| `sort` | string | `title`, `-title`, `rating`, `-rating`, `newest` (default) |
| `search` | string | Search on title/description |

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": "c1a7e2b0-...",
      "slug": "intro-to-javascript",
      "title": "Intro to JavaScript",
      "description": "Learn JavaScript from scratch.",
      "coverImageUrl": null,
      "level": "beginner",
      "language": "en",
      "durationMinutes": 480,
      "lessonCount": 32,
      "rating": 4.7,
      "reviewCount": 132,
      "studentCount": 1540,
      "isPublished": true,
      "category": { "id": "f3d9...", "name": "Web Development", "slug": "web-development" },
      "createdAt": "2026-01-15T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "perPage": 12, "totalItems": 87, "totalPages": 8 }
}
```

### Get Course by Slug or ID

```
GET /courses/:idOrSlug
🔓 Public
```

**Response — `200 OK`** — course object including module/lesson outline:

```json
{
  "id": "c1a7e2b0-...",
  "slug": "intro-to-javascript",
  "title": "Intro to JavaScript",
  "description": "...",
  "modules": [
    {
      "id": "m1-...",
      "title": "Getting Started",
      "position": 1,
      "lessons": [
        { "id": "l1-...", "title": "What is JS?", "durationMinutes": 12, "isPreviewable": true },
        { "id": "l2-...", "title": "Setting Up Your Environment", "durationMinutes": 18, "isPreviewable": true }
      ]
    }
  ]
}
```

> Lessons marked `isPreviewable: true` can be viewed without enrolling.

**Errors:** `404` for unknown or unpublished courses.

### Admin: Create Course

```
POST /courses
🔒 Admin only
```

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `title` | string | Yes | 3–120 chars |
| `description` | string | Yes | Min 20 chars |
| `categoryId` | UUID | Yes | Must reference existing category |
| `level` | string | No | `beginner` \| `intermediate` \| `advanced` |
| `coverImageUrl` | string | No | URL |
| `isPublished` | boolean | No | Default `false` (draft) |

```json
{
  "title": "Intro to JavaScript",
  "description": "A complete beginner-friendly JavaScript course.",
  "categoryId": "f3d9a2c1-...",
  "level": "beginner"
}
```

**Response — `201 Created`** — full course object with `slug` auto-generated from the title.

**Errors:** `422 Unprocessable Entity` if `categoryId` does not reference an existing category.

### Admin: Update Course

```
PATCH /courses/:courseId
🔒 Admin only
```

Any subset of create fields may be sent. Changing the title regenerates the slug.

**Response — `200 OK`** — updated course object.

### Admin: Delete Course

```
DELETE /courses/:courseId
🔒 Admin only
```

**Response — `204 No Content`**

> Deleting a course with active enrollments requires `?force=true`; otherwise returns `409 Conflict`.

---

## Modules & Lessons

### Admin: Add Module to Course

```
POST /courses/:courseId/modules
🔒 Admin only
```

```json
{
  "title": "Functions & Scope",
  "position": 3
}
```

If `position` is omitted the module is appended at the end. Existing modules shift down to make room.

**Response — `201 Created`**

```json
{
  "id": "m3-...",
  "courseId": "c1a7e2b0-...",
  "title": "Functions & Scope",
  "position": 3,
  "lessons": []
}
```

### Admin: Update Module

```
PATCH /modules/:moduleId
🔒 Admin only
```

```json
{ "title": "Functions, Scope & Closures", "position": 4 }
```

Positions are re-normalized after a move.

**Response — `200 OK`** — module object including its lessons.

### Admin: Delete Module

```
DELETE /modules/:moduleId
🔒 Admin only
```

**Response — `204 No Content`** — cascades to its lessons and progress records.

### Admin: Add Lesson

```
POST /modules/:moduleId/lessons
🔒 Admin only
```

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | |
| `type` | string | Yes | `video` \| `text` \| `quiz` |
| `contentUrl` | string | If video | Video URL |
| `content` | string | If text | Markdown body |
| `durationMinutes` | int | If video | |
| `position` | int | No | Appended to end if omitted |
| `isPreviewable` | boolean | No | Default `false` |

**Validation:** video lessons require `contentUrl` + `durationMinutes`; text lessons require `content`.

**Response — `201 Created`** — lesson object.

### Admin: Update Lesson

```
PATCH /lessons/:lessonId
🔒 Admin only
```

Any subset of create fields may be sent. Providing `position` reorders within the module.

**Response — `200 OK`**

### Admin: Delete Lesson

```
DELETE /lessons/:lessonId
🔒 Admin only
```

**Response — `204 No Content`**

### Get Lesson Content

```
GET /lessons/:lessonId/content
🔒 Requires authentication
```

Accessible by admins, by enrolled users, and for previewable lessons.

**Response — `200 OK`**

```json
{
  "id": "l1-...",
  "moduleId": "m1-...",
  "courseId": "c1a7e2b0-...",
  "title": "What is JS?",
  "type": "video",
  "contentUrl": "https://cdn.example.com/videos/l1.mp4",
  "durationMinutes": 12,
  "position": 1,
  "isPreviewable": true,
  "completed": false
}
```

Text lessons additionally include a `content` field (Markdown).

Accessing a lesson updates the enrollment's `lastAccessedLessonId`.

**Errors:** `403 Forbidden` (`NOT_ENROLLED`) if not enrolled and lesson is not previewable.

---

## Bundles

A bundle groups multiple published courses. Enrolling in a bundle enrolls the user into every contained course.

### List Bundles (Public)

```
GET /bundles?page=1&perPage=12&search=fullstack
🔓 Public
```

Same pagination conventions as courses.

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": "b4e8-...",
      "slug": "fullstack-web-developer-bundle",
      "title": "Fullstack Web Developer Bundle",
      "description": "Everything you need to become a fullstack developer.",
      "coverImageUrl": null,
      "courseCount": 3,
      "courses": [
        { "id": "c1a7e2b0-...", "title": "Intro to JavaScript", "slug": "intro-to-javascript" }
      ],
      "isPublished": true,
      "createdAt": "2026-03-02T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "perPage": 12, "totalItems": 9, "totalPages": 1 }
}
```

### Get Bundle by Slug or ID

```
GET /bundles/:idOrSlug
🔓 Public
```

**Response — `200 OK`** — single bundle object as above.

### Admin: Create Bundle

```
POST /bundles
🔒 Admin only
```

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `title` | string | Yes | 3–120 chars |
| `description` | string | Yes | Min 10 chars |
| `courseIds` | array of UUID | Yes | Min 2 distinct courses; all must exist |
| `coverImageUrl` | string | No | |
| `isPublished` | boolean | No | Default `false` |

```json
{
  "title": "Fullstack Web Developer Bundle",
  "description": "Everything you need to become a fullstack developer.",
  "courseIds": ["c1a7e2b0-...", "c2b8f3c1-...", "c3c9a4d2-..."]
}
```

**Response — `201 Created`** — bundle object including course summaries.

**Errors:** `422 Unprocessable Entity` if fewer than 2 valid course IDs are supplied.

### Admin: Update Bundle

```
PATCH /bundles/:bundleId
🔒 Admin only
```

Any subset of create fields may be sent. Sending `courseIds` replaces the contained set.

**Response — `200 OK`**

### Admin: Delete Bundle

```
DELETE /bundles/:bundleId
🔒 Admin only
```

**Response — `204 No Content`**

> Deleting a bundle does **not** delete its courses or revoke already-granted access.

---

## Categories

### List Categories

```
GET /categories
🔓 Public
```

**Response — `200 OK`**

```json
{
  "data": [
    { "id": "f3d9a2c1-...", "name": "Web Development", "slug": "web-development", "courseCount": 87 }
  ]
}
```

### Admin: Create Category

```
POST /categories
🔒 Admin only
```

```json
{ "name": "Data Science" }
```

**Response — `201 Created`** — category object (`slug` auto-generated).

### Admin: Update Category

```
PATCH /categories/:categoryId
🔒 Admin only
```

Regenerates the slug when the name changes.

### Admin: Delete Category

```
DELETE /categories/:categoryId
🔒 Admin only
```

> Returns `409 Conflict` if the category still contains courses.

---

## Enrollment

Upward is entirely free — enrollment activates immediately.

### Enroll in a Course

```
POST /enrollments
🔒 Requires authentication
```

**Request body** *(exactly one of `courseId` / `bundleId`)*

```json
{ "courseId": "c1a7e2b0-..." }
```

or

```json
{ "bundleId": "b4e8-..." }
```

**Response — `201 Created`** (single course)

```json
{
  "id": "e7f1-...",
  "userId": "9b2f4c3e-...",
  "courseId": "c1a7e2b0-...",
  "bundleId": null,
  "status": "active",
  "progressPercent": 0,
  "enrolledAt": "2026-08-22T11:00:00Z",
  "completedAt": null,
  "expiresAt": null
}
```

**Response — `201 Created`** (bundle) — creates one active enrollment per contained course, skipping already-enrolled ones:

```json
{
  "bundleId": "b4e8-...",
  "bundleSlug": "fullstack-web-developer-bundle",
  "status": "active",
  "enrollments": [
    { "...": "enrollment object per course" }
  ]
}
```

**Errors**

| Code | Reason |
| --- | --- |
| `409 ALREADY_ENROLLED` | Already enrolled (or already enrolled in every bundle course) |
| `422 UNPROCESSABLE_ENTITY` | Course/bundle unpublished or does not exist |

### List My Enrollments

```
GET /enrollments/me?status=active&type=course&page=1
🔒 Requires authentication
```

| Param | Type | Description |
| --- | --- | --- |
| `status` | string | `active` \| `completed` |
| `type` | string | `course` (direct enrollments) \| `bundle` (granted via a bundle) |

Each item embeds a course summary and live `progressPercent`.

### Cancel Enrollment

```
DELETE /enrollments/:enrollmentId
🔒 Requires authentication (owner)
```

**Response — `204 No Content`**

> Owners can only cancel enrollments with `status: active`. Admins may cancel any enrollment.

### Admin: List All Enrollments

```
GET /admin/enrollments?userId=&courseId=&status=
🔒 Admin only
```

**Response — `200 OK`** — paginated enrollment list embedding `user` and `course` details.

---

## Progress Tracking

### Mark Lesson Complete

```
POST /progress/lessons/:lessonId/complete
🔒 Requires enrollment
```

**Response — `200 OK`**

```json
{
  "lessonId": "l1-...",
  "completedAt": "2026-08-22T12:05:00Z",
  "courseProgressPercent": 34
}
```

> Completing lessons out of order is allowed. Re-completing a completed lesson is idempotent.
> Reaching 100% sets the enrollment to `completed` and automatically issues a certificate.

### Mark Lesson Incomplete

```
DELETE /progress/lessons/:lessonId/complete
🔒 Requires enrollment
```

**Response — `200 OK`** — updated progress object. Reverts a completed enrollment back to `active`.

### Get My Course Progress

```
GET /progress/courses/:courseId
🔒 Requires enrollment
```

**Response — `200 OK`**

```json
{
  "courseId": "c1a7e2b0-...",
  "progressPercent": 34,
  "lessonsCompleted": 11,
  "lessonsTotal": 32,
  "lastAccessedLessonId": "l12-...",
  "completedLessons": ["l1-...", "l2-..."],
  "startedAt": "2026-08-22T11:00:00Z",
  "completedAt": null
}
```

### Issue Certificate

Automatically generated when `progressPercent` reaches `100`. Can also be fetched explicitly:

```
POST /progress/courses/:courseId/certificate
🔒 Requires authentication, 100% progress required
```

**Response — `200 OK`**

```json
{
  "certificateId": "cert-88a1-...",
  "certificateUrl": "http://localhost:3000/v1/certificates/cert-88a1-.../download",
  "issuedAt": "2026-08-22T13:00:00Z"
}
```

**Errors:** `409 Conflict` if course not yet completed; `403 NOT_ENROLLED` if not enrolled.

### Download Certificate

```
GET /certificates/:certificateId/download
🔒 Requires authentication (owner or admin)
```

**Response — `200 OK`** — certificate details incl. course title and recipient.

---

## Reviews & Ratings

Only enrolled users who have completed at least one lesson may review a course. One review per user per course.

### List Course Reviews

```
GET /courses/:courseId/reviews?page=1&sort=-helpfulVotes
🔓 Public
```

| Param | Values |
| --- | --- |
| `sort` | `helpfulVotes`, `-helpfulVotes`, `newest` (default), `-createdAt` |

When authenticated, each review includes `votedByMe`.

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": "r2c3-...",
      "userId": "9b2f4c3e-...",
      "userName": "Rahim Ahmed",
      "rating": 5,
      "comment": "Fantastic explanations and exercises.",
      "helpfulVotes": 12,
      "createdAt": "2026-07-10T08:20:00Z"
    }
  ],
  "meta": { "page": 1, "perPage": 20, "totalItems": 132, "totalPages": 7 }
}
```

### Create Review

```
POST /courses/:courseId/reviews
🔒 Requires enrollment with progress > 0%
```

```json
{ "rating": 5, "comment": "Fantastic explanations and exercises." }
```

**Constraints:** `rating` is an integer 1–5; `comment` max 2000 chars (optional).

Course `rating` and `reviewCount` are recalculated after every review write.

**Response — `201 Created`**

**Errors:** `403 Forbidden` if not enrolled or no progress; `409 Conflict` if review already exists.

### Update My Review

```
PATCH /reviews/:reviewId
🔒 Requires authentication (owner)
```

### Delete My Review

```
DELETE /reviews/:reviewId
🔒 Requires authentication (owner or admin)
```

**Response — `204 No Content`**

### Mark Review Helpful

```
POST /reviews/:reviewId/helpful
🔒 Requires authentication
```

Toggling is supported; calling again removes the vote.

**Response — `200 OK`**

```json
{ "helpfulVotes": 13, "votedByMe": true }
```

---

## Search

Unified search across published courses and bundles.

### Global Search

```
GET /search?q=javascript&type=course&limit=10&offset=0
🔓 Public
```

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `q` | string | Yes | Query text (min 2 chars) |
| `type` | string | No | `course` \| `bundle` \| omit for all |
| `limit` | int | No | Default `10`, max `50` |
| `offset` | int | No | Default `0` |

Matches are wrapped in `<em>` tags in `highlightedTitle` and `snippet`.

**Response — `200 OK`**

```json
{
  "query": "javascript",
  "results": {
    "courses": [
      {
        "id": "c1a7e2b0-...",
        "slug": "intro-to-javascript",
        "title": "Intro to JavaScript",
        "highlightedTitle": "Intro to <em>JavaScript</em>",
        "snippet": "Learn <em>JavaScript</em> from scratch, covering ES6+ ...",
        "rating": 4.7
      }
    ],
    "bundles": []
  },
  "total": { "courses": 14, "bundles": 2 }
}
```

### Search Suggestions (Autocomplete)

```
GET /search/suggest?q=jav&limit=5
🔓 Public
```

**Response — `200 OK`**

```json
{
  "suggestions": [
    { "type": "course", "label": "Intro to JavaScript", "slug": "intro-to-javascript" },
    { "type": "category", "label": "JavaScript Frameworks", "slug": "javascript-frameworks" }
  ]
}
```

---

## Error Handling

All errors share a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "password", "issue": "must contain at least one number" }
    ]
  }
}
```

### Common Error Codes

| HTTP | Code | Triggered when |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed JSON / invalid body or query params |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid access/refresh token |
| `401` | `INVALID_CREDENTIALS` | Wrong email/password on login |
| `403` | `FORBIDDEN` | Authenticated but lacking role/ownership |
| `403` | `NOT_ENROLLED` | Accessing locked lesson content, progress, or reviewing without progress |
| `404` | `NOT_FOUND` | Unknown route or resource ID |
| `409` | `ALREADY_ENROLLED` | Duplicate enrollment |
| `409` | `DUPLICATE_RESOURCE` | e.g., email already registered, duplicate review |
| `409` | `CONFLICT` | Invalid state (delete non-empty category, cancel non-active enrollment, certificate before completion) |
| `422` | `UNPROCESSABLE_ENTITY` | Semantically invalid (bad category, < 2 courses in bundle, unpublished target) |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server failure |

---

## Pagination

List endpoints accept:

| Param | Default | Max |
| --- | --- | --- |
| `page` | `1` | — |
| `perPage` | `20` | `100` |

Every paginated response includes:

```json
{
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 143,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Rate Limiting

Limits are applied per IP + token:

| Endpoint group | Limit |
| --- | --- |
| `/auth/login` | 5 requests / minute |
| `/auth/register` | 3 requests / minute |
| General endpoints | 100 requests / minute |

Rate-limited requests receive `429 Too Many Requests` plus headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724325600
Retry-After: 42
```

---

*Last updated: August 25, 2026 · API version: v1*
