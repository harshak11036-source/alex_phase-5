import { z } from 'zod';
import {
  UserRole,
  MembershipStatus,
  DocumentStatus,
  DocumentType,
  AttendanceStatus,
  AssessmentType,
  AssignmentStatus,
  AchievementCategory,
  NotificationCategory,
  ProjectStatus,
  ProjectRole,
  MemoryCategory,
  AIProviderType,
} from '@alex/shared-types';

export const userRoleSchema = z.nativeEnum(UserRole);
export const membershipStatusSchema = z.nativeEnum(MembershipStatus);
export const documentStatusSchema = z.nativeEnum(DocumentStatus);
export const documentTypeSchema = z.nativeEnum(DocumentType);
export const attendanceStatusSchema = z.nativeEnum(AttendanceStatus);
export const assessmentTypeSchema = z.nativeEnum(AssessmentType);
export const assignmentStatusSchema = z.nativeEnum(AssignmentStatus);
export const achievementCategorySchema = z.nativeEnum(AchievementCategory);
export const notificationCategorySchema = z.nativeEnum(NotificationCategory);
export const projectStatusSchema = z.nativeEnum(ProjectStatus);
export const projectRoleSchema = z.nativeEnum(ProjectRole);
export const memoryCategorySchema = z.nativeEnum(MemoryCategory);
export const aiProviderTypeSchema = z.nativeEnum(AIProviderType);

export const institutionSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  domain: z.string().url().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const departmentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  institutionId: z.string().cuid(),
  description: z.string().max(1000).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const courseSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  institutionId: z.string().cuid(),
  departmentId: z.string().cuid(),
  durationYears: z.number().int().positive(),
  description: z.string().max(1000).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const academicYearSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  institutionId: z.string().cuid(),
  startDate: z.date(),
  endDate: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const semesterSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  number: z.number().int().positive(),
  institutionId: z.string().cuid(),
  academicYearId: z.string().cuid(),
  courseId: z.string().cuid(),
  startDate: z.date(),
  endDate: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const userSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  emailVerified: z.date().nullable().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  avatarUrl: z.string().url().nullable().optional(),
  role: userRoleSchema,
  isActive: z.boolean(),
  lastLoginAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const collegeMembershipSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  institutionId: z.string().cuid(),
  departmentId: z.string().cuid().nullable().optional(),
  courseId: z.string().cuid().nullable().optional(),
  semesterId: z.string().cuid().nullable().optional(),
  academicYearId: z.string().cuid().nullable().optional(),
  role: userRoleSchema,
  status: membershipStatusSchema,
  studentId: z.string().max(50).nullable().optional(),
  employeeId: z.string().max(50).nullable().optional(),
  enrolledAt: z.date(),
  verifiedAt: z.date().nullable().optional(),
  verifiedBy: z.string().cuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const subjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  institutionId: z.string().cuid(),
  departmentId: z.string().cuid(),
  semesterId: z.string().cuid(),
  credits: z.number().int().positive().default(3),
  description: z.string().max(2000).nullable().optional(),
  syllabus: z.string().max(10000).nullable().optional(),
  textbooks: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const subjectEnrollmentSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  subjectId: z.string().cuid(),
  semesterId: z.string().cuid(),
  enrolledAt: z.date(),
  isActive: z.boolean().default(true),
});

export const lecturerAssignmentSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  subjectId: z.string().cuid(),
  assignedAt: z.date(),
  assignedBy: z.string().cuid().nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const documentSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  fileName: z.string().min(1).max(255),
  fileSize: z.bigint(),
  mimeType: z.string().min(1).max(100),
  documentType: documentTypeSchema,
  storagePath: z.string().min(1).max(500),
  storageBucket: z.string().min(1).max(100).default('documents'),
  checksum: z.string().min(1).max(128),
  status: documentStatusSchema.default(DocumentStatus.UPLOADED),
  errorMessage: z.string().max(2000).nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  ownerId: z.string().cuid(),
  subjectId: z.string().cuid().nullable().optional(),
  projectId: z.string().cuid().nullable().optional(),
  notebookId: z.string().cuid().nullable().optional(),
  processorId: z.string().cuid().nullable().optional(),
  processedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const documentChunkSchema = z.object({
  id: z.string().cuid(),
  documentId: z.string().cuid(),
  content: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().nullable().optional(),
  sectionTitle: z.string().max(500).nullable().optional(),
  tokenCount: z.number().int().positive(),
  embedding: z.instanceof(Uint8Array).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
});

export const documentProcessingJobSchema = z.object({
  id: z.string().cuid(),
  documentId: z.string().cuid(),
  step: z.string().min(1).max(100),
  status: documentStatusSchema,
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const conversationSchema = z.object({
  id: z.string().cuid(),
  title: z.string().max(500).nullable().optional(),
  userId: z.string().cuid(),
  projectId: z.string().cuid().nullable().optional(),
  notebookId: z.string().cuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const messageSchema = z.object({
  id: z.string().cuid(),
  conversationId: z.string().cuid(),
  senderId: z.string().cuid(),
  role: z.string().min(1).max(50),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  toolCalls: z.record(z.string(), z.unknown()).nullable().optional(),
  toolResults: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
});

export const userMemorySchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  category: memoryCategorySchema,
  key: z.string().min(1).max(255),
  value: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  source: z.string().max(500).nullable().optional(),
  isVerified: z.boolean().default(false),
  expiresAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const taskSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  assigneeId: z.string().cuid(),
  creatorId: z.string().cuid(),
  dueDate: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  isCompleted: z.boolean().default(false),
  priority: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const plannerEventSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  startTime: z.date(),
  endTime: z.date(),
  allDay: z.boolean().default(false),
  eventType: z.string().min(1).max(100),
  subjectId: z.string().cuid().nullable().optional(),
  taskId: z.string().cuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const notificationSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  category: notificationCategorySchema,
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  referenceId: z.string().cuid().nullable().optional(),
  referenceType: z.string().max(100).nullable().optional(),
  isRead: z.boolean().default(false),
  readAt: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
});

export const notificationPreferenceSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  category: notificationCategorySchema,
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const aiCredentialSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  provider: aiProviderTypeSchema,
  providerName: z.string().min(1).max(100),
  encryptedKey: z.string().min(1),
  keyHash: z.string().min(1).max(128),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  models: z.record(z.string(), z.unknown()).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  usageCount: z.number().int().nonnegative().default(0),
  lastUsedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const aiModelConfigSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  provider: aiProviderTypeSchema,
  modelId: z.string().min(1).max(255),
  taskType: z.string().min(1).max(100),
  isDefault: z.boolean().default(false),
  parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const researchNotebookSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  ownerId: z.string().cuid(),
  projectId: z.string().cuid().nullable().optional(),
  isPublic: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const researchSourceSchema = z.object({
  id: z.string().cuid(),
  notebookId: z.string().cuid(),
  documentId: z.string().cuid().nullable().optional(),
  title: z.string().min(1).max(500),
  authors: z.record(z.string(), z.unknown()).nullable().optional(),
  publicationYear: z.number().int().positive().nullable().optional(),
  doi: z.string().max(255).nullable().optional(),
  url: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const researchNoteSchema = z.object({
  id: z.string().cuid(),
  notebookId: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(500),
  content: z.string(),
  sourceIds: z.array(z.string().cuid()),
  tags: z.array(z.string().max(50)),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)),
  ownerId: z.string().cuid(),
  status: projectStatusSchema.default(ProjectStatus.PLANNING),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectMemberSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  userId: z.string().cuid(),
  role: projectRoleSchema.default(ProjectRole.MEMBER),
  joinedAt: z.date(),
  invitedBy: z.string().cuid().nullable().optional(),
});

export const projectMentorSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  userId: z.string().cuid(),
  assignedAt: z.date(),
  assignedBy: z.string().cuid().nullable().optional(),
});

export const projectTaskSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  creatorId: z.string().cuid(),
  status: z.string().min(1).max(50).default('TODO'),
  priority: z.number().int().default(0),
  dueDate: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectMilestoneSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.date(),
  completedAt: z.date().nullable().optional(),
  isCompleted: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectDiscussionSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(500),
  content: z.string(),
  parentId: z.string().cuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const attendanceSessionSchema = z.object({
  id: z.string().cuid(),
  subjectId: z.string().cuid(),
  semesterId: z.string().cuid(),
  date: z.date(),
  period: z.number().int().positive(),
  topic: z.string().max(500).nullable().optional(),
  conductedBy: z.string().cuid(),
  isCancelled: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const attendanceRecordSchema = z.object({
  id: z.string().cuid(),
  sessionId: z.string().cuid(),
  userId: z.string().cuid(),
  status: attendanceStatusSchema,
  markedBy: z.string().cuid(),
  markedAt: z.date(),
  notes: z.string().max(1000).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const assessmentSchema = z.object({
  id: z.string().cuid(),
  subjectId: z.string().cuid(),
  semesterId: z.string().cuid(),
  name: z.string().min(1).max(255),
  type: assessmentTypeSchema,
  maxMarks: z.number().int().positive(),
  weight: z.number().positive().default(1),
  assessmentDate: z.date(),
  description: z.string().max(2000).nullable().optional(),
  isPublished: z.boolean().default(false),
  publishedAt: z.date().nullable().optional(),
  createdBy: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const assessmentResultSchema = z.object({
  id: z.string().cuid(),
  assessmentId: z.string().cuid(),
  userId: z.string().cuid(),
  marksObtained: z.number(),
  feedback: z.string().max(2000).nullable().optional(),
  gradedBy: z.string().cuid().nullable().optional(),
  gradedAt: z.date().nullable().optional(),
  isPublished: z.boolean().default(false),
  publishedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const assignmentSchema = z.object({
  id: z.string().cuid(),
  subjectId: z.string().cuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  maxMarks: z.number().int().positive(),
  weight: z.number().positive().default(1),
  assignedDate: z.date(),
  dueDate: z.date(),
  allowedFormats: z.array(z.string().max(50)),
  allowResubmission: z.boolean().default(false),
  maxSubmissions: z.number().int().positive().default(1),
  isPublished: z.boolean().default(false),
  createdBy: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const assignmentAttachmentSchema = z.object({
  id: z.string().cuid(),
  assignmentId: z.string().cuid(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  fileSize: z.bigint(),
  mimeType: z.string().min(1).max(100),
  createdAt: z.date(),
});

export const assignmentSubmissionSchema = z.object({
  id: z.string().cuid(),
  assignmentId: z.string().cuid(),
  userId: z.string().cuid(),
  status: assignmentStatusSchema.default(AssignmentStatus.DRAFT),
  submissionNumber: z.number().int().positive().default(1),
  content: z.string().nullable().optional(),
  submittedAt: z.date().nullable().optional(),
  gradedAt: z.date().nullable().optional(),
  marksObtained: z.number().nullable().optional(),
  feedback: z.string().max(2000).nullable().optional(),
  gradedBy: z.string().cuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const submissionAttachmentSchema = z.object({
  id: z.string().cuid(),
  submissionId: z.string().cuid(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  fileSize: z.bigint(),
  mimeType: z.string().min(1).max(100),
  createdAt: z.date(),
});

export const studentAchievementSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  category: achievementCategorySchema,
  organization: z.string().max(255).nullable().optional(),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.string().max(50).default('COMPLETED'),
  verificationStatus: z.string().max(50).default('UNVERIFIED'),
  verifiedBy: z.string().cuid().nullable().optional(),
  verifiedAt: z.date().nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const guardianContactSchema = z.object({
  id: z.string().cuid(),
  institutionId: z.string().cuid(),
  studentId: z.string().cuid(),
  name: z.string().min(1).max(255),
  relationship: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  isPrimary: z.boolean().default(false),
  consentGiven: z.boolean().default(false),
  consentAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditLogSchema = z.object({
  id: z.string().cuid(),
  institutionId: z.string().cuid(),
  userId: z.string().cuid().nullable().optional(),
  action: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: z.string().cuid().nullable().optional(),
  oldValues: z.record(z.string(), z.unknown()).nullable().optional(),
  newValues: z.record(z.string(), z.unknown()).nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  createdAt: z.date(),
});

export const subjectResourceSchema = z.object({
  id: z.string().cuid(),
  subjectId: z.string().cuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().min(1).max(100),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  fileSize: z.bigint(),
  mimeType: z.string().min(1).max(100),
  version: z.number().int().positive().default(1),
  isPublished: z.boolean().default(false),
  publishedAt: z.date().nullable().optional(),
  uploadedBy: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const studyMaterialSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  content: z.string(),
  type: z.string().min(1).max(100),
  sourceDocId: z.string().cuid().nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  topic: z.string().max(255).nullable().optional(),
  tags: z.array(z.string().max(50)),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const flashcardDeckSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  sourceDocId: z.string().cuid().nullable().optional(),
  algorithm: z.string().min(1).max(50).default('SM2'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const flashcardSchema = z.object({
  id: z.string().cuid(),
  deckId: z.string().cuid(),
  front: z.string(),
  back: z.string(),
  difficulty: z.number().default(0),
  interval: z.number().int().nonnegative().default(0),
  repetitions: z.number().int().nonnegative().default(0),
  easeFactor: z.number().default(2.5),
  nextReview: z.date(),
  lastReviewed: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const flashcardReviewSchema = z.object({
  id: z.string().cuid(),
  cardId: z.string().cuid(),
  userId: z.string().cuid(),
  rating: z.number().int().min(0).max(5),
  previousEase: z.number(),
  newEase: z.number(),
  previousInterval: z.number().int(),
  newInterval: z.number().int(),
  reviewedAt: z.date(),
});

export const mindMapSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  sourceDocId: z.string().cuid().nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  topic: z.string().max(255).nullable().optional(),
  nodes: z.record(z.string(), z.unknown()),
  edges: z.record(z.string(), z.unknown()),
  viewport: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const diagramSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  sourceDocId: z.string().cuid().nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  definition: z.record(z.string(), z.unknown()),
  renderedUrl: z.string().url().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const quizSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  sourceDocId: z.string().cuid().nullable().optional(),
  topic: z.string().max(255).nullable().optional(),
  difficulty: z.string().min(1).max(50),
  questions: z.record(z.string(), z.unknown()),
  timeLimit: z.number().int().positive().nullable().optional(),
  isPublished: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const quizAttemptSchema = z.object({
  id: z.string().cuid(),
  quizId: z.string().cuid(),
  userId: z.string().cuid(),
  answers: z.record(z.string(), z.unknown()),
  score: z.number(),
  maxScore: z.number(),
  startedAt: z.date(),
  completedAt: z.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const generatedImageSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  prompt: z.string().min(1).max(2000),
  sourceDocId: z.string().cuid().nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  imageUrl: z.string().url(),
  model: z.string().min(1).max(100),
  parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
});

export const guardianContactInputSchema = guardianContactSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const institutionInputSchema = institutionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const departmentInputSchema = departmentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const courseInputSchema = courseSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const academicYearInputSchema = academicYearSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const semesterInputSchema = semesterSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const userInputSchema = userSchema.omit({ id: true, createdAt: true, updatedAt: true, emailVerified: true, lastLoginAt: true });
export const collegeMembershipInputSchema = collegeMembershipSchema.omit({ id: true, createdAt: true, updatedAt: true, enrolledAt: true, verifiedAt: true });
export const subjectInputSchema = subjectSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const subjectEnrollmentInputSchema = subjectEnrollmentSchema.omit({ id: true, enrolledAt: true });
export const lecturerAssignmentInputSchema = lecturerAssignmentSchema.omit({ id: true, assignedAt: true });
export const documentInputSchema = documentSchema.omit({ id: true, createdAt: true, updatedAt: true, processedAt: true });
export const documentChunkInputSchema = documentChunkSchema.omit({ id: true, createdAt: true });
export const documentProcessingJobInputSchema = documentProcessingJobSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const conversationInputSchema = conversationSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const messageInputSchema = messageSchema.omit({ id: true, createdAt: true });
export const userMemoryInputSchema = userMemorySchema.omit({ id: true, createdAt: true, updatedAt: true });
export const taskInputSchema = taskSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const plannerEventInputSchema = plannerEventSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const notificationInputSchema = notificationSchema.omit({ id: true, createdAt: true, readAt: true });
export const notificationPreferenceInputSchema = notificationPreferenceSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const aiCredentialInputSchema = aiCredentialSchema.omit({ id: true, createdAt: true, updatedAt: true, lastUsedAt: true });
export const aiModelConfigInputSchema = aiModelConfigSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const researchNotebookInputSchema = researchNotebookSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const researchSourceInputSchema = researchSourceSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const researchNoteInputSchema = researchNoteSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const projectInputSchema = projectSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const projectMemberInputSchema = projectMemberSchema.omit({ id: true, joinedAt: true });
export const projectMentorInputSchema = projectMentorSchema.omit({ id: true, assignedAt: true });
export const projectTaskInputSchema = projectTaskSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const projectMilestoneInputSchema = projectMilestoneSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const projectDiscussionInputSchema = projectDiscussionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const attendanceSessionInputSchema = attendanceSessionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const attendanceRecordInputSchema = attendanceRecordSchema.omit({ id: true, createdAt: true, updatedAt: true, markedAt: true });
export const assessmentInputSchema = assessmentSchema.omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const assessmentResultInputSchema = assessmentResultSchema.omit({ id: true, createdAt: true, updatedAt: true, gradedAt: true, publishedAt: true });
export const assignmentInputSchema = assignmentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const assignmentAttachmentInputSchema = assignmentAttachmentSchema.omit({ id: true, createdAt: true });
export const assignmentSubmissionInputSchema = assignmentSubmissionSchema.omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, gradedAt: true });
export const submissionAttachmentInputSchema = submissionAttachmentSchema.omit({ id: true, createdAt: true });
export const studentAchievementInputSchema = studentAchievementSchema.omit({ id: true, createdAt: true, updatedAt: true, verifiedAt: true });
export const auditLogInputSchema = auditLogSchema.omit({ id: true, createdAt: true });
export const subjectResourceInputSchema = subjectResourceSchema.omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const studyMaterialInputSchema = studyMaterialSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const flashcardDeckInputSchema = flashcardDeckSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const flashcardInputSchema = flashcardSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const flashcardReviewInputSchema = flashcardReviewSchema.omit({ id: true, reviewedAt: true });
export const mindMapInputSchema = mindMapSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const diagramInputSchema = diagramSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const quizInputSchema = quizSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const quizAttemptInputSchema = quizAttemptSchema.omit({ id: true, startedAt: true, completedAt: true });
export const generatedImageInputSchema = generatedImageSchema.omit({ id: true, createdAt: true });

export type InstitutionInput = z.infer<typeof institutionInputSchema>;
export type DepartmentInput = z.infer<typeof departmentInputSchema>;
export type CourseInput = z.infer<typeof courseInputSchema>;
export type AcademicYearInput = z.infer<typeof academicYearInputSchema>;
export type SemesterInput = z.infer<typeof semesterInputSchema>;
export type UserInput = z.infer<typeof userInputSchema>;
export type CollegeMembershipInput = z.infer<typeof collegeMembershipInputSchema>;
export type SubjectInput = z.infer<typeof subjectInputSchema>;
export type SubjectEnrollmentInput = z.infer<typeof subjectEnrollmentInputSchema>;
export type LecturerAssignmentInput = z.infer<typeof lecturerAssignmentInputSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentChunkInput = z.infer<typeof documentChunkInputSchema>;
export type DocumentProcessingJobInput = z.infer<typeof documentProcessingJobInputSchema>;
export type ConversationInput = z.infer<typeof conversationInputSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
export type UserMemoryInput = z.infer<typeof userMemoryInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type PlannerEventInput = z.infer<typeof plannerEventInputSchema>;
export type NotificationInput = z.infer<typeof notificationInputSchema>;
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceInputSchema>;
export type AICredentialInput = z.infer<typeof aiCredentialInputSchema>;
export type AIModelConfigInput = z.infer<typeof aiModelConfigInputSchema>;
export type ResearchNotebookInput = z.infer<typeof researchNotebookInputSchema>;
export type ResearchSourceInput = z.infer<typeof researchSourceInputSchema>;
export type ResearchNoteInput = z.infer<typeof researchNoteInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectMemberInput = z.infer<typeof projectMemberInputSchema>;
export type ProjectMentorInput = z.infer<typeof projectMentorInputSchema>;
export type ProjectTaskInput = z.infer<typeof projectTaskInputSchema>;
export type ProjectMilestoneInput = z.infer<typeof projectMilestoneInputSchema>;
export type ProjectDiscussionInput = z.infer<typeof projectDiscussionInputSchema>;
export type AttendanceSessionInput = z.infer<typeof attendanceSessionInputSchema>;
export type AttendanceRecordInput = z.infer<typeof attendanceRecordInputSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type AssessmentResultInput = z.infer<typeof assessmentResultInputSchema>;
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
export type AssignmentAttachmentInput = z.infer<typeof assignmentAttachmentInputSchema>;
export type AssignmentSubmissionInput = z.infer<typeof assignmentSubmissionInputSchema>;
export type SubmissionAttachmentInput = z.infer<typeof submissionAttachmentInputSchema>;
export type StudentAchievementInput = z.infer<typeof studentAchievementInputSchema>;
export type GuardianContactInput = z.infer<typeof guardianContactInputSchema>;
export type AuditLogInput = z.infer<typeof auditLogInputSchema>;
export type SubjectResourceInput = z.infer<typeof subjectResourceInputSchema>;
export type StudyMaterialInput = z.infer<typeof studyMaterialInputSchema>;
export type FlashcardDeckInput = z.infer<typeof flashcardDeckInputSchema>;
export type FlashcardInput = z.infer<typeof flashcardInputSchema>;
export type FlashcardReviewInput = z.infer<typeof flashcardReviewInputSchema>;
export type MindMapInput = z.infer<typeof mindMapInputSchema>;
export type DiagramInput = z.infer<typeof diagramInputSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;
export type QuizAttemptInput = z.infer<typeof quizAttemptInputSchema>;
export type GeneratedImageInput = z.infer<typeof generatedImageInputSchema>;