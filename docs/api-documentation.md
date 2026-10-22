# ALEX API Documentation

## Overview

ALEX uses **Firebase Cloud Functions (Gen 2)** as the primary backend API, exposed via **Callable HTTPS Functions**. The Next.js frontend communicates with these functions using the Firebase Functions SDK.

## Base URL

```
https://<region>-<project-id>.cloudfunctions.net/api
```

Or via Firebase SDK (recommended):
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'region');
const myFunction = httpsCallable(functions, 'api.functionName');
```

## Authentication

All API calls require Firebase Auth. The Functions SDK automatically attaches the current user's ID token.

```typescript
// Client side - automatic with Firebase Auth
const result = await myFunction({ data: 'value' });
```

## API Structure

Functions are organized by domain:

```
api
├── user.*              # User profile & membership
├── document.*          # Document upload, processing, management
├── rag.*               # RAG queries, vector search
├── ai.*                # AI provider management, chat
├── study.*             # Study materials, flashcards, mind maps
├── planner.*           # Calendar, tasks, events
├── research.*          # Notebooks, sources, notes
├── project.*           # Projects, tasks, milestones, members
├── attendance.*        # Sessions, records, alerts
├── assessment.*        # Assessments, results
├── assignment.*        # Assignments, submissions
├── achievement.*       # Student achievements
├── notification.*      # Notifications, preferences
├── subject.*           # Subjects, enrollments, resources
└── system.*            # Admin, health, maintenance
```

## Core API Reference

### User Functions

#### `api.getUserProfile`
Get current user's profile with memberships.

```typescript
const getUserProfile = httpsCallable(functions, 'api.getUserProfile');
const result = await getUserProfile();
// Returns: { user: UserWithMembership }
```

#### `api.updateUserProfile`
Update user profile (name, avatar).

```typescript
const updateUserProfile = httpsCallable(functions, 'api.updateUserProfile');
await updateUserProfile({ firstName: 'John', lastName: 'Doe' });
```

#### `api.createUserProfile`
Create initial profile on first login.

```typescript
const createUserProfile = httpsCallable(functions, 'api.createUserProfile');
await createUserProfile({ 
  firstName: 'John', 
  lastName: 'Doe',
  institutionId: '...',
  role: 'STUDENT'
});
```

### Document Functions

#### `api.uploadDocument`
Initiate document upload (returns signed URL).

```typescript
const uploadDocument = httpsCallable(functions, 'api.uploadDocument');
const result = await uploadDocument({
  fileName: 'notes.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024000,
  subjectId: 'subject-id' // optional
});
// Returns: { uploadUrl: string, documentId: string }
```

#### `api.getDocuments`
List user's documents with filters.

```typescript
const getDocuments = httpsCallable(functions, 'api.getDocuments');
const result = await getDocuments({
  subjectId: 'subject-id',
  projectId: 'project-id',
  status: 'READY',
  limit: 20,
  offset: 0
});
// Returns: { documents: Document[], total: number }
```

#### `api.deleteDocument`
Delete a document and its chunks.

```typescript
const deleteDocument = httpsCallable(functions, 'api.deleteDocument');
await deleteDocument({ documentId: 'doc-id' });
```

#### `api.reprocessDocument`
Reprocess a failed document.

```typescript
const reprocessDocument = httpsCallable(functions, 'api.reprocessDocument');
await reprocessDocument({ documentId: 'doc-id' });
```

### RAG Functions

#### `api.queryRAG`
Query the RAG system with a question.

```typescript
const queryRAG = httpsCallable(functions, 'api.queryRAG');
const result = await queryRAG({
  query: 'What is photosynthesis?',
  subjectId: 'subject-id', // optional
  projectId: 'project-id', // optional
  notebookId: 'notebook-id', // optional
  topK: 5,
  model: 'nvidia/nemotron-3-ultra'
});
// Returns: { answer: string, sources: Source[], confidence: number }
```

#### `api.searchDocuments`
Semantic search across user's documents.

```typescript
const searchDocuments = httpsCallable(functions, 'api.searchDocuments');
const result = await searchDocuments({
  query: 'machine learning',
  subjectId: 'subject-id',
  limit: 10
});
// Returns: { results: DocumentChunk[] }
```

### AI Functions

#### `api.chatWithAI`
Chat with AI using user's configured provider.

```typescript
const chatWithAI = httpsCallable(functions, 'api.chatWithAI');
const result = await chatWithAI({
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'nvidia/nemotron-3-ultra',
  temperature: 0.7,
  maxTokens: 2048
});
// Returns: { message: string, usage: Usage }
```

#### `api.getAIModels`
List available AI models for user.

```typescript
const getAIModels = httpsCallable(functions, 'api.getAIModels');
const result = await getAIModels();
// Returns: { models: AIModelConfig[] }
```

#### `api.setAICredentials`
Store encrypted AI API key.

```typescript
const setAICredentials = httpsCallable(functions, 'api.setAICredentials');
await setAICredentials({
  provider: 'NVIDIA_NEMOTRON',
  providerName: 'NVIDIA Nemotron',
  apiKey: 'nvapi-...',
  isDefault: true
});
```

### Study Functions

#### `api.generateStudyMaterial`
Generate study material from document.

```typescript
const generateStudyMaterial = httpsCallable(functions, 'api.generateStudyMaterial');
const result = await generateStudyMaterial({
  documentId: 'doc-id',
  type: 'summary', // 'summary' | 'flashcards' | 'mindmap' | 'quiz' | 'notes'
  topic: 'Chapter 1',
  model: 'nvidia/nemotron-3-ultra'
});
// Returns: { studyMaterialId: string }
```

#### `api.getStudyMaterials`
List user's study materials.

```typescript
const getStudyMaterials = httpsCallable(functions, 'api.getStudyMaterials');
const result = await getStudyMaterials({
  subjectId: 'subject-id',
  type: 'flashcards'
});
// Returns: { materials: StudyMaterial[] }
```

#### `api.generateFlashcards`
Generate flashcards from document.

```typescript
const generateFlashcards = httpsCallable(functions, 'api.generateFlashcards');
const result = await generateFlashcards({
  documentId: 'doc-id',
  deckTitle: 'Biology Chapter 1',
  count: 20,
  algorithm: 'SM2'
});
// Returns: { deckId: string }
```

### Planner Functions

#### `api.createTask`
Create a task.

```typescript
const createTask = httpsCallable(functions, 'api.createTask');
const result = await createTask({
  title: 'Complete assignment',
  description: 'Math homework due Friday',
  dueDate: '2024-01-15T23:59:00Z',
  priority: 2
});
// Returns: { task: Task }
```

#### `api.getPlannerEvents`
Get calendar events for date range.

```typescript
const getPlannerEvents = httpsCallable(functions, 'api.getPlannerEvents');
const result = await getPlannerEvents({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z'
});
// Returns: { events: PlannerEvent[] }
```

### Research Functions

#### `api.createNotebook`
Create a research notebook.

```typescript
const createNotebook = httpsCallable(functions, 'api.createNotebook');
const result = await createNotebook({
  title: 'Thesis Research',
  description: 'Machine learning thesis',
  projectId: 'project-id' // optional
});
// Returns: { notebook: ResearchNotebook }
```

#### `api.addResearchSource`
Add a source to notebook.

```typescript
const addResearchSource = httpsCallable(functions, 'api.addResearchSource');
const result = await addResearchSource({
  notebookId: 'notebook-id',
  title: 'Attention Is All You Need',
  authors: [{ name: 'Vaswani', etAl: true }],
  publicationYear: 2017,
  doi: '10.48550/arXiv.1706.03762',
  url: 'https://arxiv.org/abs/1706.03762'
});
// Returns: { source: ResearchSource }
```

### Project Functions

#### `api.createProject`
Create a project.

```typescript
const createProject = httpsCallable(functions, 'api.createProject');
const result = await createProject({
  title: 'Capstone Project',
  description: 'Final year project',
  category: 'software',
  tags: ['react', 'firebase', 'ai']
});
// Returns: { project: Project }
```

#### `api.addProjectMember`
Invite member to project.

```typescript
const addProjectMember = httpsCallable(functions, 'api.addProjectMember');
await addProjectMember({
  projectId: 'project-id',
  userId: 'user-id',
  role: 'MEMBER'
});
```

### Attendance Functions

#### `api.markAttendance`
Mark attendance for session.

```typescript
const markAttendance = httpsCallable(functions, 'api.markAttendance');
await markAttendance({
  sessionId: 'session-id',
  records: [
    { userId: 'student-1', status: 'PRESENT' },
    { userId: 'student-2', status: 'ABSENT' }
  ]
});
```

#### `api.getAttendanceReport`
Get attendance report for subject.

```typescript
const getAttendanceReport = httpsCallable(functions, 'api.getAttendanceReport');
const result = await getAttendanceReport({
  subjectId: 'subject-id',
  semesterId: 'semester-id',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});
// Returns: { report: AttendanceReport }
```

### Assessment Functions

#### `api.createAssessment`
Create an assessment (lecturer only).

```typescript
const createAssessment = httpsCallable(functions, 'api.createAssessment');
const result = await createAssessment({
  subjectId: 'subject-id',
  semesterId: 'semester-id',
  name: 'Midterm Exam',
  type: 'SEMESTER_EXAM',
  maxMarks: 100,
  weight: 0.3,
  assessmentDate: '2024-03-15T10:00:00Z'
});
```

#### `api.getAssessments`
Get assessments for subject.

```typescript
const getAssessments = httpsCallable(functions, 'api.getAssessments');
const result = await getAssessments({ subjectId: 'subject-id' });
// Returns: { assessments: Assessment[] }
```

### Assignment Functions

#### `api.createAssignment`
Create an assignment (lecturer only).

```typescript
const createAssignment = httpsCallable(functions, 'api.createAssignment');
const result = await createAssignment({
  subjectId: 'subject-id',
  title: 'Essay on Climate Change',
  description: 'Write 1000 words...',
  maxMarks: 50,
  assignedDate: '2024-01-10T00:00:00Z',
  dueDate: '2024-01-24T23:59:59Z',
  allowedFormats: ['pdf', 'docx'],
  allowResubmission: true,
  maxSubmissions: 2
});
```

#### `api.submitAssignment`
Submit assignment (student).

```typescript
const submitAssignment = httpsCallable(functions, 'api.submitAssignment');
const result = await submitAssignment({
  assignmentId: 'assignment-id',
  content: 'My essay content...',
  attachments: ['file-id-1', 'file-id-2']
});
// Returns: { submission: AssignmentSubmission }
```

### Notification Functions

#### `api.getNotifications`
Get user notifications.

```typescript
const getNotifications = httpsCallable(functions, 'api.getNotifications');
const result = await getNotifications({
  unreadOnly: false,
  limit: 50
});
// Returns: { notifications: Notification[] }
```

#### `api.markNotificationRead`
Mark notification as read.

```typescript
const markNotificationRead = httpsCallable(functions, 'api.markNotificationRead');
await markNotificationRead({ notificationId: 'notif-id' });
```

### Subject Functions

#### `api.getSubjects`
Get subjects for current user.

```typescript
const getSubjects = httpsCallable(functions, 'api.getSubjects');
const result = await getSubjects({
  semesterId: 'semester-id',
  includeEnrollments: true
});
// Returns: { subjects: SubjectWithRelations[] }
```

#### `api.enrollInSubject`
Enroll in a subject.

```typescript
const enrollInSubject = httpsCallable(functions, 'api.enrollInSubject');
await enrollInSubject({ subjectId: 'subject-id' });
```

## Error Handling

All functions return standardized errors:

```typescript
try {
  const result = await api.someFunction({ data });
} catch (error) {
  // error is HttpsError with:
  // error.code: 'unauthenticated' | 'permission-denied' | 'not-found' | 'invalid-argument' | 'internal'
  // error.message: Human-readable message
  // error.details: Additional data
  
  switch (error.code) {
    case 'unauthenticated':
      // Redirect to login
      break;
    case 'permission-denied':
      // Show access denied
      break;
    case 'not-found':
      // Resource doesn't exist
      break;
  }
}
```

## Rate Limits

| Function Category | Limit |
|-------------------|-------|
| AI Chat | 30 req/min per user |
| Document Upload | 10 req/min per user |
| RAG Queries | 20 req/min per user |
| General API | 100 req/min per user |

## Versioning

API version is managed via Firebase Functions deployments. Breaking changes require new function names (e.g., `api.v2.functionName`).

## Testing API Locally

```bash
# Start emulators
firebase emulators:start

# Functions available at:
# http://localhost:5001/<project-id>/<region>/api/<functionName>

# Test with Functions shell
firebase functions:shell
```

## SDK Usage (Frontend)

```typescript
// lib/api.ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

export const api = {
  getUserProfile: () => httpsCallable(functions, 'api.getUserProfile')(),
  uploadDocument: (data) => httpsCallable(functions, 'api.uploadDocument')(data),
  queryRAG: (data) => httpsCallable(functions, 'api.queryRAG')(data),
  // ... all functions
};
```

```typescript
// Component usage
import { api } from '@/lib/api';

const result = await api.queryRAG({ query: 'What is AI?' });
console.log(result.data.answer);
```